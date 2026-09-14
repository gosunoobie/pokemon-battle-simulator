import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { createEngineFactory } from '@battle/battle-engine'
import { GEN3, getMove } from '@battle/game-data'
import { PRESET_TEAMS } from './presets.js'

const PREFIX = '/api/simulation'
const COOKIE = 'battle_simulation_v1'
const MAX_BODY = 4096
const TOKEN = /^[a-f0-9]{64}$/
const ID = /^[a-zA-Z0-9:_-]{1,128}$/
const DECISION_ID = /^[a-zA-Z0-9:_-]{1,160}$/
const clone = value => structuredClone(value)
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
const keysAre = (value, keys) => plain(value) && Object.keys(value).every(key => keys.includes(key))
const moveId = value => value.toLowerCase().replace(/[^a-z0-9]/g, '')

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code }
}
const badRequest = (code, message) => { throw new HttpError(400, code, message) }

function send(res, status, data) {
  if (res.writableEnded || res.destroyed) return
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(JSON.stringify(data))
}

function checkOrigin(req, required) {
  const host = req.headers.host
  if (typeof host !== 'string' || /[\s/\\,#]/.test(host)) throw new HttpError(403, 'ORIGIN_REJECTED', 'The request must come from this application.')
  const expected = `${req.socket.encrypted ? 'https' : 'http'}://${host}`
  if ((required && !req.headers.origin) || (req.headers.origin && req.headers.origin !== expected) ||
      (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) {
    throw new HttpError(403, 'ORIGIN_REJECTED', 'The request must come from this application.')
  }
}

async function readBody(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) throw new HttpError(415, 'JSON_REQUIRED', 'Send application/json.')
  if (Number(req.headers['content-length']) > MAX_BODY) throw new HttpError(413, 'BODY_TOO_LARGE', 'The request is too large.')
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw new HttpError(413, 'BODY_TOO_LARGE', 'The request is too large.')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'), (key, value) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe JSON key')
      return value
    })
  } catch { badRequest('INVALID_JSON', 'The request must contain valid JSON.') }
}

function cursorValue(value = 0) {
  if (!Number.isSafeInteger(value) || value < 0) badRequest('INVALID_CURSOR', 'Use a nonnegative integer event cursor.')
  return value
}

function matchCheck(session, matchId) {
  if (typeof matchId !== 'string' || !ID.test(matchId)) badRequest('INVALID_MATCH', 'A valid match identity is required.')
  if (session.matchId !== matchId) throw new HttpError(409, 'MATCH_CHANGED', 'This session now has a different battle. Reload its current state before continuing.')
}

function cookieToken(req) {
  const values = (req.headers.cookie ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${COOKIE}=`))
  if (values.length !== 1) return null
  const value = values[0].slice(COOKIE.length + 1)
  return TOKEN.test(value) ? value : null
}

/** In-memory local simulation host. Sessions survive page reloads, not restarts. */
export function createSimulationService({ ttlMs = 30 * 60 * 1000, maxSessions = 24, requestsPerMinute = 600 } = {}) {
  for (const [name, value] of Object.entries({ ttlMs, maxSessions, requestsPerMinute })) {
    if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`Invalid ${name}`)
  }
  const sessions = new Map()
  let factory
  let config
  let closed = false
  let createWindow = { started: Date.now(), count: 0 }

  function initialize() {
    if (config) return
    factory = createEngineFactory()
    const presets = PRESET_TEAMS.map(preset => {
      const checked = factory.validateTeam(preset.team)
      if (!checked.valid) throw new Error(`Invalid simulation preset ${preset.id}: ${JSON.stringify(checked.errors)}`)
      return { ...preset, team: checked.team }
    })
    config = {
      presets,
      moves: Object.fromEntries(GEN3.moves.map(move => [move.id, {
        id: move.id, name: move.name, type: move.type, category: move.category,
        basePower: move.basePower, accuracy: move.accuracy, pp: move.pp,
        target: move.target, priority: move.priority, shortDesc: move.shortDesc,
      }])),
      profile: { id: factory.getProfile().id, label: 'Gen 3 Open Singles · level 100 · six Pokémon' },
    }
  }

  function removeSession(token) {
    const session = sessions.get(token)
    if (session) { session.engine?.dispose(); sessions.delete(token) }
  }
  function expire() {
    const now = Date.now()
    for (const [token, session] of sessions) if (session.expiresAt <= now) removeSession(token)
  }
  const cleanup = setInterval(expire, Math.max(10, Math.min(ttlMs, 60_000)))
  cleanup.unref()

  function setCookie(req, res, token) {
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=${PREFIX}; HttpOnly; SameSite=Strict; Max-Age=${Math.ceil(ttlMs / 1000)}${req.socket.encrypted ? '; Secure' : ''}`)
  }
  function requireSession(req, res) {
    const token = cookieToken(req)
    const session = token && sessions.get(token)
    if (!session || session.expiresAt <= Date.now()) {
      if (token) removeSession(token)
      throw new HttpError(401, 'NO_MATCH', 'Start a battle to create a session. Sessions expire after inactivity or a server restart.')
    }
    const now = Date.now()
    if (now - session.window.started >= 60_000) session.window = { started: now, count: 0 }
    if (++session.window.count > requestsPerMinute) throw new HttpError(429, 'RATE_LIMITED', 'Too many requests. Please pause before continuing.')
    session.expiresAt = now + ttlMs
    setCookie(req, res, token)
    return session
  }

  function permittedView(session) {
    const view = session.engine.getPlayerView('p1')
    if (!view.complete) {
      session.engine.dispose()
      sessions.delete(session.token)
      throw new HttpError(503, 'PROJECTION_UNAVAILABLE', 'This battle produced an unsupported display update. Start a new battle.')
    }
    return view
  }

  function snapshot(session, afterCursor = 0, ack) {
    const view = permittedView(session)
    if (afterCursor > view.cursor) badRequest('INVALID_CURSOR', 'The event cursor is ahead of this battle.')
    return {
      matchId: session.matchId, view,
      events: session.engine.getEvents('p1', afterCursor), profileId: config.profile.id,
      ...(ack === undefined ? {} : { ack }),
    }
  }

  function botActions(decision) {
    if (decision.kind === 'switch') return decision.switches.map(member => ({ kind: 'switch', memberId: member.memberId }))
    const moves = decision.moves.filter(move => !move.disabled && (move.pp === null || move.pp > 0))
    const damaging = moves.filter(move => getMove(moveId(move.id))?.category !== 'Status')
    const others = moves.filter(move => !damaging.includes(move))
    return [...damaging, ...others].map(move => ({ kind: 'move', slot: move.slot }))
      .concat(decision.switches.map(member => ({ kind: 'switch', memberId: member.memberId })))
  }

  function driveBot(session) {
    const attempted = new Set()
    for (let iteration = 0; iteration < 64; iteration++) {
      const player = session.engine.getDecision('p1')
      const bot = session.engine.getDecision('p2')
      if (player.kind === 'finished' || bot.kind === 'finished') return
      // Resolve the automated seat's forced replacement even when the player
      // also has a replacement. Otherwise wait for the next player decision.
      if (bot.kind !== 'switch' && player.kind !== 'wait') return
      if (bot.kind === 'wait') return
      const action = botActions(bot).find(candidate => !attempted.has(`${bot.id}:${JSON.stringify(candidate)}`))
      if (!action) break
      attempted.add(`${bot.id}:${JSON.stringify(action)}`)
      session.engine.submitDecision('p2', {
        commandId: `bot-${++session.botCommands}`, decisionId: bot.id, action,
      })
      permittedView(session)
    }
    session.engine.dispose()
    sessions.delete(session.token)
    throw new HttpError(503, 'AUTOMATION_UNAVAILABLE', 'The automated opponent could not continue this battle. Start a new battle.')
  }

  async function route(req, res, url) {
    if (closed) throw new HttpError(503, 'SERVICE_CLOSED', 'The simulation server is stopping.')
    checkOrigin(req, !['GET', 'HEAD'].includes(req.method))
    if (req.method === 'GET' && url.pathname === `${PREFIX}/config`) {
      if (url.search) badRequest('INVALID_QUERY', 'This endpoint does not accept query parameters.')
      initialize()
      send(res, 200, config)
      return
    }
    if (req.method === 'POST' && url.pathname === `${PREFIX}/match`) {
      if (url.search) badRequest('INVALID_QUERY', 'This endpoint does not accept query parameters.')
      const body = await readBody(req)
      if (!keysAre(body, ['presetId', 'leadIndex', 'expectedMatchId']) || typeof body.presetId !== 'string' || !Number.isInteger(body.leadIndex) || body.leadIndex < 0 || body.leadIndex > 5 ||
        !(body.expectedMatchId === null || typeof body.expectedMatchId === 'string' && ID.test(body.expectedMatchId))) {
        badRequest('INVALID_MATCH', 'Choose a preset and a lead from its six Pokémon.')
      }
      initialize()
      const preset = config.presets.find(candidate => candidate.id === body.presetId)
      if (!preset) badRequest('INVALID_PRESET', 'Choose an available team preset.')
      expire()
      const existingToken = cookieToken(req)
      const existing = existingToken && sessions.get(existingToken)
      if (body.expectedMatchId !== (existing?.matchId ?? null)) throw new HttpError(409, 'MATCH_CHANGED', 'This session changed. Reload its current state before starting another battle.')
      if (!existing && sessions.size >= maxSessions) throw new HttpError(503, 'SESSION_LIMIT', 'This local server has reached its session limit. Try again later.')
      if (Date.now() - createWindow.started >= 60_000) createWindow = { started: Date.now(), count: 0 }
      if (++createWindow.count > 60) throw new HttpError(429, 'RATE_LIMITED', 'Too many new battles. Please wait a minute.')
      const candidates = config.presets.filter(candidate => candidate.id !== preset.id)
      const opponent = candidates[randomInt(candidates.length)]
      const playerTeam = clone(preset.team)
      playerTeam.unshift(...playerTeam.splice(body.leadIndex, 1))
      const matchId = randomUUID()
      const engine = factory.create({ matchId, teams: { p1: playerTeam, p2: opponent.team } })
      const token = existing ? existingToken : randomBytes(32).toString('hex')
      const session = { token, matchId, engine, botCommands: 0, expiresAt: Date.now() + ttlMs, window: { started: Date.now(), count: 0 } }
      if (existing) removeSession(existingToken)
      sessions.set(token, session)
      setCookie(req, res, token)
      send(res, 200, snapshot(session))
      return
    }
    if (req.method === 'GET' && url.pathname === `${PREFIX}/match`) {
      if ([...url.searchParams.keys()].some(key => key !== 'afterCursor') || url.searchParams.getAll('afterCursor').length > 1) badRequest('INVALID_QUERY', 'Only one event cursor is accepted.')
      const raw = url.searchParams.get('afterCursor') ?? '0'
      if (!/^\d{1,12}$/.test(raw)) badRequest('INVALID_CURSOR', 'Use a nonnegative integer event cursor.')
      const session = requireSession(req, res)
      send(res, 200, snapshot(session, cursorValue(Number(raw))))
      return
    }
    if (req.method === 'POST' && [`${PREFIX}/choice`, `${PREFIX}/forfeit`].includes(url.pathname)) {
      if (url.search) badRequest('INVALID_QUERY', 'This endpoint does not accept query parameters.')
      const body = await readBody(req)
      const session = requireSession(req, res)
      if (url.pathname.endsWith('/forfeit')) {
        if (!keysAre(body, ['matchId', 'afterCursor'])) badRequest('INVALID_FORFEIT', 'Send the match identity and an optional event cursor.')
        matchCheck(session, body.matchId)
        const cursor = cursorValue(body.afterCursor)
        if (cursor > permittedView(session).cursor) badRequest('INVALID_CURSOR', 'The event cursor is ahead of this battle.')
        session.engine.adjudicate({ kind: 'forfeit', seat: 'p1' })
        send(res, 200, snapshot(session, cursor))
        return
      }
      if (!keysAre(body, ['matchId', 'commandId', 'decisionId', 'action', 'afterCursor']) || typeof body.commandId !== 'string' || !ID.test(body.commandId) || typeof body.decisionId !== 'string' || !DECISION_ID.test(body.decisionId) ||
        !(keysAre(body.action, ['kind', 'slot']) && body.action.kind === 'move' && Number.isInteger(body.action.slot) && body.action.slot >= 1 && body.action.slot <= 4) &&
        !(keysAre(body.action, ['kind', 'memberId']) && body.action.kind === 'switch' && typeof body.action.memberId === 'string' && /^p1:[1-6]$/.test(body.action.memberId))) {
        badRequest('INVALID_CHOICE', 'Send a move slot or one of your available switch identities.')
      }
      matchCheck(session, body.matchId)
      const cursor = cursorValue(body.afterCursor)
      if (cursor > permittedView(session).cursor) badRequest('INVALID_CURSOR', 'The event cursor is ahead of this battle.')
      const ack = session.engine.submitDecision('p1', { commandId: body.commandId, decisionId: body.decisionId, action: body.action })
      if (ack.accepted) driveBot(session)
      send(res, 200, snapshot(session, cursor, ack))
      return
    }
    if (req.method === 'DELETE' && url.pathname === `${PREFIX}/match`) {
      if (url.search) badRequest('INVALID_QUERY', 'This endpoint does not accept query parameters.')
      const body = await readBody(req)
      if (!keysAre(body, ['matchId'])) badRequest('INVALID_REQUEST', 'Only the match identity is accepted.')
      const session = requireSession(req, res)
      matchCheck(session, body.matchId)
      removeSession(session.token)
      res.setHeader('Set-Cookie', `${COOKIE}=; Path=${PREFIX}; HttpOnly; SameSite=Strict; Max-Age=0`)
      send(res, 200, { cleared: true })
      return
    }
    throw new HttpError(404, 'NOT_FOUND', 'No simulation endpoint exists at this address.')
  }

  return Object.freeze({
    middleware(req, res, next) {
      let url
      try { url = new URL(req.url, 'http://simulation.local') } catch { send(res, 400, { error: { code: 'INVALID_URL', message: 'Invalid request address.' } }); return }
      if (url.pathname !== PREFIX && !url.pathname.startsWith(`${PREFIX}/`)) { next?.(); return }
      route(req, res, url).catch(error => {
        // Engine internals, validation detail, teams and seeds never enter errors.
        send(res, error instanceof HttpError ? error.status : 503, { error: {
          code: error instanceof HttpError ? error.code : 'SIMULATION_UNAVAILABLE',
          message: error instanceof HttpError ? error.message : 'The simulation could not continue. Please start a new battle.',
        } })
      })
    },
    close() {
      if (closed) return
      closed = true
      clearInterval(cleanup)
      for (const token of sessions.keys()) removeSession(token)
    },
  })
}

/** The Node service is created only when a dev/preview server receives an API request. */
export function simulationPlugin() {
  const install = server => {
    let service
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith(PREFIX)) { next(); return }
      service ??= createSimulationService()
      service.middleware(req, res, next)
    })
    server.httpServer?.once('close', () => service?.close())
  }
  return { name: 'battle-simulation-api', configureServer: install, configurePreviewServer: install }
}
