// Bounded local probe; never targets a deployed service or claims production capacity.
import { fork } from 'node:child_process'
import { once } from 'node:events'
import { cpus, totalmem } from 'node:os'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

const mib = value => Math.round(value / 1024 / 1024 * 100) / 100
const memory = () => {
  const usage = process.memoryUsage()
  return { rssMiB: mib(usage.rss), heapUsedMiB: mib(usage.heapUsed), heapTotalMiB: mib(usage.heapTotal), maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024 * 100) / 100 }
}

if (process.argv.includes('--server')) {
  const { createSimulationHttpServer } = await import('../apps/server/start.mjs')
  const { createMemoryRoomStore } = await import('../apps/server/rooms/memoryStore.js')
  const roomStore = createMemoryRoomStore()
  let offset = 0
  const server = createSimulationHttpServer({
    serviceOptions: { maxSessions: 14 },
    multiplayerOptions: { roomStore, clock: () => Date.now() + offset, autoCleanup: false, policy: { maxActiveMatches: 10 } },
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  process.send({ ready: true, origin: `http://127.0.0.1:${server.address().port}` })
  process.on('message', async message => {
    try {
      let result
      if (message.action === 'advance') { offset += message.ms; result = { advancedMs: message.ms } }
      else if (message.action === 'sample') {
        global.gc?.()
        const measured = memory()
        const records = await roomStore.transact('probe', tx => {
          const rooms = tx.values('rooms')
          const sizes = rooms.filter(room => room.match).map(room => Buffer.byteLength(JSON.stringify(room.match.checkpoint)))
          return { rooms: rooms.length, activeMatches: rooms.filter(room => room.status === 'active').length, guests: tx.size('guests'), checkpointBytes: sizes.reduce((a, b) => a + b, 0), largestCheckpointBytes: Math.max(0, ...sizes) }
        })
        result = { ...measured, ...records }
      } else if (message.action === 'close') {
        await new Promise(resolve => { server.close(resolve); server.closeAllConnections() })
        await roomStore.close()
        await new Promise(resolve => setImmediate(resolve))
        global.gc?.()
        result = memory()
      } else throw new Error('Unknown probe command')
      process.send({ id: message.id, result })
      if (message.action === 'close') process.disconnect()
    } catch (error) { process.send({ id: message.id, error: error.message }) }
  })
} else {
  const rounds = 5
  const started = performance.now()
  const child = fork(fileURLToPath(import.meta.url), ['--server'], { execArgv: ['--expose-gc'], stdio: ['ignore', 'ignore', 'inherit', 'ipc'] })
  const pending = new Map()
  let messageId = 0
  const ready = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.on('message', message => {
      if (message.ready) resolve(message)
      else {
        const entry = pending.get(message.id)
        if (!entry) return
        pending.delete(message.id)
        if (message.error) entry.reject(new Error(message.error)); else entry.resolve(message.result)
      }
    })
    child.once('exit', code => {
      if (code) reject(new Error(`Probe server exited ${code}`))
      for (const entry of pending.values()) entry.reject(new Error('Probe server exited'))
    })
  })
  const ipc = (action, rest = {}) => new Promise((resolve, reject) => {
    const id = ++messageId
    pending.set(id, { resolve, reject })
    child.send({ id, action, ...rest })
  })
  const samples = { create: [], command: [], round: [], unchangedPoll: [] }
  const quantiles = values => {
    const sorted = [...values].sort((a, b) => a - b)
    const value = percentile => Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentile) - 1)] * 100) / 100
    return { count: sorted.length, p50Ms: value(0.5), p95Ms: value(0.95), maxMs: value(1) }
  }
  try {
    const { origin } = await ready
    const browser = () => {
      let cookie
      return async (path, body, method = body === undefined ? 'GET' : 'POST') => {
        const response = await fetch(`${origin}${path}`, {
          method, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        })
        const setCookie = response.headers.get('set-cookie')
        if (setCookie) cookie = setCookie.split(';')[0]
        const data = await response.json()
        if (!response.ok || data.ack?.accepted === false) throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(data.error ?? data.ack)}`)
        return data
      }
    }
    const baseline = await ipc('sample')
    const pairs = []
    for (let index = 0; index < 10; index++) {
      const creationStarted = performance.now()
      const p1 = browser()
      const p2 = browser()
      await p1('/api/multiplayer/guest', { name: `Probe ${index}A` })
      await p2('/api/multiplayer/guest', { name: `Probe ${index}B` })
      let a = await p1('/api/multiplayer/rooms', { operationId: 'create', presetId: 'kanto', leadIndex: 0 })
      let b = await p2('/api/multiplayer/rooms/join', { operationId: 'join', inviteToken: a.room.inviteToken })
      const path = `/api/multiplayer/rooms/${a.room.id}`
      a = await p1(`${path}/updates`)
      const readyBody = state => ({ operationId: 'ready', ready: true, selectionRevision: state.room.own.selectionRevision, membershipEpoch: state.room.membershipEpoch })
      await p1(`${path}/ready`, readyBody(a))
      b = await p2(`${path}/ready`, readyBody(b))
      a = await p1(`${path}/updates`)
      pairs.push({ p1, p2, path, a, b })
      samples.create.push(performance.now() - creationStarted)
    }
    const solos = []
    for (let index = 0; index < 2; index++) {
      const api = browser()
      const state = await api('/api/simulation/match', { presetId: 'kanto', leadIndex: 0, expectedMatchId: null })
      solos.push({ api, state })
    }
    const warm = await ipc('sample')
    for (let round = 0; round < rounds; round++) {
      await Promise.all(pairs.map(async pair => {
        const roundStarted = performance.now()
        for (const [apiKey, stateKey] of [['p1', 'a'], ['p2', 'b']]) {
          const state = pair[stateKey]
          const decision = state.view.decision
          if (!['move', 'switch'].includes(decision.kind)) continue
          const action = decision.kind === 'switch' ? { kind: 'switch', memberId: decision.switches[0].memberId } : { kind: 'move', slot: decision.moves.find(move => !move.disabled).slot }
          const commandStarted = performance.now()
          pair[stateKey] = await pair[apiKey](`${pair.path}/choice`, { commandId: `round-${round}-${apiKey}`, matchId: state.matchId, decisionId: decision.id, action, afterCursor: state.view.cursor })
          samples.command.push(performance.now() - commandStarted)
        }
        pair.a = await pair.p1(`${pair.path}/updates`)
        pair.b = await pair.p2(`${pair.path}/updates`)
        samples.round.push(performance.now() - roundStarted)
      }))
    }
    for (let pass = 0; pass < 10; pass++) {
      await Promise.all(pairs.map(async pair => {
        const state = pair.a
        const start = performance.now()
        const result = await pair.p1(`${pair.path}/updates?afterRevision=${state.revision}&afterCursor=${state.view.cursor}&matchId=${state.matchId}`)
        if (result.mode !== 'unchanged') throw new Error('Idle poll unexpectedly changed')
        samples.unchangedPoll.push(performance.now() - start)
      }))
    }
    const afterRounds = await ipc('sample')
    for (const pair of pairs) await pair.p1(`${pair.path}/forfeit`, { operationId: 'finish-probe', matchId: pair.a.matchId })
    for (const { api, state } of solos) await api('/api/simulation/match', { matchId: state.matchId }, 'DELETE')
    const terminalRetention = await ipc('sample')
    await ipc('advance', { ms: 24 * 60 * 60 * 1000 + 1 })
    await browser()('/api/multiplayer/guest', { name: 'Expiry probe' })
    const afterExpiry = await ipc('sample')
    const afterClose = await ipc('close')
    console.log(JSON.stringify({
      measuredAt: new Date().toISOString(), node: process.version, platform: process.platform, arch: process.arch,
      cpu: cpus()[0]?.model, logicalCpus: cpus().length, systemMemoryMiB: mib(totalmem()),
      setup: 'Separate child backend process; loopback HTTP clients in parent; 10 parallel PvP rooms plus 2 idle solo sessions; 5 action rounds/room; forced GC before memory samples; no renderer or Vercel/Render network',
      durationMs: Math.round(performance.now() - started), memory: { baseline, warm, afterRounds, terminalRetention, afterExpiry, afterClose },
      latency: Object.fromEntries(Object.entries(samples).map(([name, values]) => [name, quantiles(values)])),
    }, null, 2))
  } finally {
    if (child.connected) child.disconnect()
    if (child.exitCode === null) child.kill('SIGTERM')
  }
}
