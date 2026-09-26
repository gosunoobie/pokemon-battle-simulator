import test from 'node:test'
import assert from 'node:assert/strict'
import { createAudioPlayer, createAudioSession } from '../packages/battle-audio/src/index.js'
import { createSimulationAudio } from '../apps/simulation/src/audio.js'

function harness(options = {}) {
  const calls = { created: 0, resumed: 0, closed: 0, suspended: 0, gains: [], sources: [] }
  const listeners = new Set()
  const context = {
    state: 'suspended', currentTime: 10, destination: {},
    addEventListener: (_name, listener) => listeners.add(listener),
    removeEventListener: (_name, listener) => listeners.delete(listener),
    resume() {
      calls.resumed += 1
      if (options.resume) return options.resume(context)
      context.state = 'running'; return Promise.resolve()
    },
    close() { calls.closed += 1; context.state = 'closed'; return Promise.resolve() },
    suspend() { calls.suspended += 1; context.state = 'suspended'; return Promise.resolve() },
    async decodeAudioData() { return { length: 3, numberOfChannels: 1, duration: 1, getChannelData: () => Float32Array.of(-1, 1, 0) } },
    createGain() {
      const gain = { gain: { value: 1 }, disconnected: 0,
        connect(output) { gain.output = output }, disconnect() { gain.disconnected += 1 } }
      calls.gains.push(gain)
      return gain
    },
    createBufferSource() {
      const source = { started: 0, stopped: 0, disconnected: 0,
        connect(output) { source.output = output }, start() { source.started += 1 },
        stop() { source.stopped += 1 }, disconnect() { source.disconnected += 1 } }
      calls.sources.push(source)
      return source
    },
  }
  const session = createAudioSession({ createContext: () => { calls.created += 1; return context }, ...options.session })
  const player = config => createAudioPlayer({
    session, resolveAsset: id => ({ url: `/${id}.ogg` }),
    fetch: async () => ({ ok: true, arrayBuffer: async () => Uint8Array.of(1).buffer }), ...config,
  })
  const changeState = value => { context.state = value; for (const listener of [...listeners]) listener() }
  return { calls, context, session, player, changeState, listeners }
}

test('a shared session is lazy, resumes within the gesture, and owns exactly one output', async t => {
  const { session, calls, context } = harness()
  t.after(() => session.dispose())
  assert.deepEqual(session.getState(), { enabled: true, volume: .6, status: 'locked' })
  session.setVolume(.7)
  session.setEnabled(false)
  assert.equal(await session.unlock(), false)
  assert.equal(calls.created, 0)
  session.setEnabled(true)
  const unlocking = session.unlock()
  assert.equal(calls.created, 1)
  assert.equal(calls.resumed, 1)
  assert.equal(calls.gains.length, 1)
  assert.equal(calls.gains[0].gain.value, .7)
  assert.equal(calls.gains[0].output, context.destination)
  assert.equal(await unlocking, true)
  assert.equal(session.ensure().context, context)
  assert.equal(session.ensure().output, calls.gains[0])
  await session.unlock()
  assert.equal(calls.created, 1)
  assert.equal(calls.resumed, 1)
})

test('master preferences and interruption states notify isolated subscribers without creating playback', async t => {
  const { session, calls, changeState, listeners } = harness()
  t.after(() => session.dispose())
  const states = []
  const unsubscribe = session.subscribe(state => states.push(state))
  session.subscribe(() => { throw new Error('observer failed') })
  assert.equal(states.length, 1)
  session.setVolume(.4)
  session.setVolume(.4)
  session.setVolume(NaN)
  assert.equal(states.length, 2)
  await session.unlock()
  changeState('interrupted')
  assert.equal(session.getState().status, 'locked')
  changeState('running')
  assert.equal(session.getState().status, 'ready')
  session.setEnabled(false)
  assert.equal(calls.gains[0].gain.value, 0)
  session.setVolume(2)
  assert.equal(calls.gains[0].gain.value, 0)
  session.setEnabled(true)
  assert.equal(calls.gains[0].gain.value, 1)
  unsubscribe()
  const received = states.length
  session.setVolume(-1)
  assert.equal(states.length, received)
  session.dispose(); session.dispose()
  assert.equal(calls.closed, 1)
  assert.equal(listeners.size, 0)
  assert.equal(session.getState().status, 'unavailable')
  assert.equal(await session.unlock(), false)
  assert.throws(() => session.ensure(), /disposed/)
})

test('resume rejection and late resume after disposal never report successful unlock', async () => {
  let settle
  const first = harness({ resume: () => Promise.reject(new Error('blocked')) })
  assert.equal(await first.session.unlock(), false)
  assert.equal(first.session.getState().status, 'locked')
  first.session.dispose()
  const second = harness({ resume: () => new Promise(resolve => { settle = resolve }) })
  const pending = second.session.unlock()
  assert.equal(second.session.unlock(), pending)
  second.session.dispose()
  settle()
  assert.equal(await pending, false)
  assert.equal(second.session.getState().status, 'unavailable')
})

test('shared transient branches apply master volume once and reserve headroom with custom category gains', async t => {
  const { session, calls, player: createPlayer } = harness()
  const states = []
  const player = createPlayer({ categoryVolumes: { cries: 2, sfx: 2, ui: 2 }, onState: state => states.push(state) })
  t.after(() => { player.dispose(); session.dispose() })
  assert.equal(await player.unlock(), true)
  const [master, transient, cries, sfx, ui] = calls.gains
  assert.equal(master.gain.value, .6)
  assert.equal(transient.output, master)
  assert.equal(transient.gain.value, .375)
  assert.equal(transient.gain.value * (2 * cries.gain.value + sfx.gain.value + ui.gain.value), .75)
  assert.equal(cries.output, transient)
  assert.equal(sfx.output, transient)
  assert.equal(ui.output, transient)
  await player.preload(['cry'])
  player.play('cry')
  const voice = calls.sources[0]
  assert.ok(Math.abs(voice.output.gain.value * cries.gain.value * transient.gain.value * master.gain.value - .1575) < 1e-10)
  player.setVolume(.8)
  assert.equal(session.getState().volume, .8)
  assert.equal(player.getState().volume, .8)
  assert.equal(master.gain.value, .8)
  assert.equal(transient.gain.value, .375)
  const count = states.length
  session.setVolume(.8)
  assert.equal(states.length, count)
  session.setVolume(.3)
  assert.equal(player.getState().volume, .3)
})

test('transient cancellation, suspension and disposal leave another session client playing', async t => {
  const { session, context, calls, player: createPlayer } = harness()
  const player = createPlayer()
  t.after(() => { player.dispose(); session.dispose() })
  await session.unlock()
  const { output } = session.ensure()
  const music = context.createBufferSource()
  const musicGain = context.createGain()
  musicGain.gain.value = .25
  music.connect(musicGain); musicGain.connect(output); music.start()
  await player.unlock()
  await player.preload(['a'])
  const handle = player.playSegment('a', { scope: 'batch' })
  player.stopScope('batch')
  assert.equal((await handle.finished).reason, 'cancelled')
  player.stop(); player.setSuspended(true); player.setSuspended(false)
  player.setEnabled(false); player.setEnabled(true)
  assert.equal(session.getState().enabled, true)
  player.dispose()
  assert.equal(music.stopped, 0)
  assert.equal(music.disconnected, 0)
  assert.equal(musicGain.disconnected, 0)
  assert.equal(output.disconnected, 0)
  assert.equal(calls.closed, 0)
  assert.equal(calls.suspended, 0)
  assert.equal(context.state, 'running')
  session.dispose()
  assert.equal(calls.closed, 1)
  assert.equal(output.disconnected, 1)
})

test('battle mix raises move gain 10% and lowers cry gain 15% after shared headroom normalization', async t => {
  const { session, calls, player: createPlayer } = harness()
  const audio = createSimulationAudio({ storage: null, document: null, playerFactory: createPlayer })
  t.after(() => { audio.dispose(); session.dispose() })
  await audio.unlock()
  const [master, transient, cries, sfx, ui] = calls.gains
  const oldTransientGain = .75 / (2 * .35 * .55 + .25 * 1.67475 + .05)
  const oldCryGain = .35 * .55 * oldTransientGain
  const oldMoveGain = .25 * 1.67475 * oldTransientGain
  assert.ok(Math.abs(transient.gain.value * sfx.gain.value / oldMoveGain - 1.1) < 1e-12)
  assert.ok(Math.abs(transient.gain.value * cries.gain.value / oldCryGain - .85) < 1e-12)
  assert.ok(transient.gain.value * (2 * cries.gain.value + sfx.gain.value + ui.gain.value) <= .75)
  assert.equal(master.gain.value, .6)
})

test('shared master mute stops transient voices and prevents new loads or playback', async t => {
  const { session, player: createPlayer } = harness()
  const player = createPlayer()
  t.after(() => { player.dispose(); session.dispose() })
  await player.unlock()
  await player.preload(['a'])
  const voice = player.playSegment('a')
  session.setEnabled(false)
  assert.equal((await voice.finished).reason, 'cancelled')
  assert.equal(await player.unlock(), false)
  assert.equal(player.play('a'), false)
  assert.deepEqual(await player.preload(['b']), [false])
  session.setEnabled(true)
  assert.equal(player.play('a'), true)
})

test('failed transient node initialization cleans its nodes without closing the shared context', async t => {
  const { session, calls, context, player: createPlayer } = harness()
  t.after(() => session.dispose())
  await session.unlock()
  const output = session.ensure().output
  const createGain = context.createGain
  let count = 0
  context.createGain = () => {
    const gain = createGain()
    if (++count === 2) gain.connect = () => { throw new Error('connection failed') }
    return gain
  }
  const player = createPlayer()
  assert.equal(await player.unlock(), false)
  assert.equal(player.getState().status, 'unavailable')
  assert.equal(calls.closed, 0)
  assert.equal(output.disconnected, 0)
  assert.equal(calls.gains[1].disconnected, 1)
  assert.equal(calls.gains[2].disconnected, 1)
  player.dispose()
  assert.equal(calls.closed, 0)
  assert.equal(await session.unlock(), true)
})
