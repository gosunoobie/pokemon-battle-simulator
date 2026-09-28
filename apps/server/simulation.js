import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto'
import { createEngineFactory } from '@battle/battle-engine'
import { GEN3, getMove } from '@battle/game-data'
import { PRESET_TEAMS } from './presets.js'
import { REGIONAL_LEAGUES } from './league-rosters.js'
import { createLeagueRun, LeagueRunError, publicLeague } from './league-run.js'
import { getTeamBuilderCatalog } from './team-builder.js'
import { createRandomTeamGenerator } from './teams/random-team.js'
import { editableTeam } from './teams/selection.js'
import { createSurvivalRun, SurvivalRunError, SURVIVAL_RULES_VERSION } from './survival-run.js'

const PREFIX = '/api/simulation'
const COOKIE = 'battle_simulation_v1'
const MAX_BODY = 4096
const MAX_TEAM_BODY = 20 * 1024
const TOKEN = /^[a-f0-9]{64}$/
const ID = /^[a-zA-Z0-9:_-]{1,128}$/
const DECISION_ID = /^[a-zA-Z0-9:_-]{1,160}$/
const MAX_OWNERS = 128
const MAX_START_RECEIPTS = 16
const clone = value => structuredClone(value)
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
const keysAre = (value, keys) => plain(value) && Object.keys(value).every(key => keys.includes(key))
const moveId = value => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const canonical = value => JSON.stringify(value, function (_key, item) {
  return plain(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item
})
const intentDigest = value => createHash('sha256').update(canonical(value)).digest('hex')
const isSurvival = session => session?.mode === 'survival'

class HttpError extends Error {
  constructor(status, code, message, errors) { super(message); this.status = status; this.code = code; this.errors = errors }
}
const badRequest = (code, message) => { throw new HttpError(400, code, message) }
const publicTeamErrors = errors => errors.slice(0, 32).map(({ code, message, setIndex }) => ({
  code: code.slice(0, 64), message: message.slice(0, 512),
  ...(Number.isInteger(setIndex) && setIndex >= 0 && setIndex < 6 ? { setIndex } : {}),
}))

function send(res, status, data) {
  if (res.writableEnded || res.destroyed) return
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(JSON.stringify(data))
}

function parsePublicOrigin(value) {
  if (value === undefined) return null
  const invalid = () => { throw new TypeError('PUBLIC_ORIGIN must be one HTTP(S) origin without credentials, a path, query, fragment or wildcard.') }
  if (typeof value !== 'string' || !/^https?:\/\/[^/\\\s?#]+\/?$/.test(value)) invalid()
  let url
  try { url = new URL(value) } catch { invalid() }
  if (url.username || url.password || url.hostname.includes('*')) invalid()
  return url.origin
}

function checkOrigin(req, required, publicOrigin) {
  const host = req.headers.host
  if (typeof host !== 'string' || /[\s/\\,#]/.test(host)) throw new HttpError(403, 'ORIGIN_REJECTED', 'The request must come from this application.')
  // Deployment configuration is authoritative; never trust caller-supplied
  // Forwarded/X-Forwarded-* headers to expand the allowed browser origin.
  const expected = publicOrigin ?? `${req.socket.encrypted ? 'https' : 'http'}://${host}`
  if ((required && !req.headers.origin) || (req.headers.origin && req.headers.origin !== expected) ||
      (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) {
    throw new HttpError(403, 'ORIGIN_REJECTED', 'The request must come from this application.')
  }
}

async function readBody(req, maxBody = MAX_BODY) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) throw new HttpError(415, 'JSON_REQUIRED', 'Send application/json.')
  if (Number(req.headers['content-length']) > maxBody) throw new HttpError(413, 'BODY_TOO_LARGE', 'The request is too large.')
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBody) throw new HttpError(413, 'BODY_TOO_LARGE', 'The request is too large.')
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
export function createSimulationService({ ttlMs = 30 * 60 * 1000, maxSessions = 24, requestsPerMinute = 600, teamRequestsPerMinute = 120, publicOrigin } = {}) {
  for (const [name, value] of Object.entries({ ttlMs, maxSessions, requestsPerMinute, teamRequestsPerMinute })) {
    if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`Invalid ${name}`)
  }
  publicOrigin = parsePublicOrigin(publicOrigin)
  const sessions = new Map()
  // Pre-run ownership makes a lost Start response recoverable. These records
  // allocate no engines, are bounded/expiring, and are never sent to clients.
  const owners = new Map()
  let factory
  let leagueFactory
  let survivalFactory
  let leagues
  let config
  let randomTeams
  let closed = false
  let createWindow = { started: Date.now(), count: 0 }
  let teamWindow = { started: Date.now(), count: 0 }
  let ownerWindow = { started: Date.now(), count: 0 }

  function admitTeamRequest(res) {
    const now = Date.now()
    if (now - teamWindow.started >= 60_000) teamWindow = { started: now, count: 0 }
    if (++teamWindow.count > teamRequestsPerMinute) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((teamWindow.started + 60_000 - now) / 1000))))
      throw new HttpError(429, 'RATE_LIMITED', 'Team preparation is busy. Please wait before checking or rerolling again.')
    }
  }

  function initialize() {
    if (config) return
    factory = createEngineFactory()
    leagueFactory = createEngineFactory({ profileId: 'gen3regionalleaguev1' })
    leagues = REGIONAL_LEAGUES.map(league => ({ ...league, trainers: league.trainers.map(trainer => {
      const checked = leagueFactory.validateOpponentTeam(trainer.team)
      if (!checked.valid) throw new Error(`Invalid league trainer ${league.id}/${trainer.id}: ${JSON.stringify(checked.errors)}`)
      return { ...trainer, team: checked.team }
    }) }))
    const presets = PRESET_TEAMS.map(preset => {
      const checked = factory.validateTeam(preset.team)
      if (!checked.valid) throw new Error(`Invalid simulation preset ${preset.id}: ${JSON.stringify(checked.errors)}`)
      return { ...preset, team: checked.team }
    })
    config = {
      presets,
      leagues: leagues.map(publicLeague),
      leagueProfile: { id: leagueFactory.getProfile().id, label: 'Gen 3 Regional League · level 100 · full recovery between battles' },
      moves: Object.fromEntries(GEN3.moves.map(move => [move.id, {
        id: move.id, name: move.name, type: move.type, category: move.category,
        basePower: move.basePower, accuracy: move.accuracy, pp: move.pp,
        target: move.target, priority: move.priority, shortDesc: move.shortDesc,
      }])),
      profile: { id: factory.getProfile().id, label: 'Gen 3 Open Singles · level 100 · six Pokémon' },
      survivalProfile: { id: 'gen3survivalsinglesv1', label: 'Gen 3 Survival · level 100 · 50% HP revives after wins',
        rulesVersion: SURVIVAL_RULES_VERSION, healingPercent: 25, revivePercent: 50,
        restorePp: true, restoreStartingItems: true, inactivityMs: ttlMs, durable: false },
    }
  }

  function removeSession(token) {
    const session = sessions.get(token)
    if (session) { if (session.run) session.run.dispose(); else session.engine?.dispose(); sessions.delete(token) }
  }
  function expire() {
    const now = Date.now()
    for (const [token, session] of sessions) if (session.expiresAt <= now) removeSession(token)
    for (const [token, owner] of owners) if (owner.expiresAt <= now) owners.delete(token)
  }
  const cleanup = setInterval(expire, Math.max(10, Math.min(ttlMs, 60_000)))
  cleanup.unref()

  function setCookie(req, res, token, maxAge = Math.ceil(ttlMs / 1000)) {
    const secure = publicOrigin?.startsWith('https://') || req.socket.encrypted
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=${PREFIX}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`)
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
    const owner = owners.get(token)
    if (owner) owner.expiresAt = session.expiresAt
    setCookie(req, res, token)
    return session
  }

  function permittedView(session) {
    const view = (isSurvival(session) ? session.run.current().engine : session.engine).getPlayerView('p1')
    if (!view.complete) {
      if (isSurvival(session)) throw new HttpError(503, 'SURVIVAL_INTERRUPTED', 'This run could not display the latest battle. Your last saved progress is retained; reconnect or retry.')
      removeSession(session.token)
      throw new HttpError(503, 'PROJECTION_UNAVAILABLE', 'This battle produced an unsupported display update. Start a new battle.')
    }
    return view
  }

  function snapshot(session, afterCursor = 0, ack) {
    if (isSurvival(session)) {
      const current = session.run.current()
      session.matchId = current.matchId
      session.engine = current.engine
    }
    const view = permittedView(session)
    if (afterCursor > view.cursor) badRequest('INVALID_CURSOR', 'The event cursor is ahead of this battle.')
    return {
      matchId: session.matchId, view,
      events: session.engine.getEvents('p1', afterCursor), profileId: session.profileId,
      run: session.run?.summary() ?? null,
      teamSelection: session.teamSelection,
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
    removeSession(session.token)
    throw new HttpError(503, 'AUTOMATION_UNAVAILABLE', 'The automated opponent could not continue this battle. Start a new battle.')
  }

  async function route(req, res, url) {
    if (closed) throw new HttpError(503, 'SERVICE_CLOSED', 'The simulation server is stopping.')
    checkOrigin(req, !['GET', 'HEAD'].includes(req.method), publicOrigin)
    if (req.method === 'GET' && url.pathname === `${PREFIX}/owner`) {
      if (url.search) badRequest('INVALID_QUERY', 'This endpoint does not accept query parameters.')
      expire()
      const suppliedToken = cookieToken(req)
      let owner = suppliedToken && owners.get(suppliedToken)
      if (!owner) {
        const now = Date.now()
        if (now - ownerWindow.started >= 60_000) ownerWindow = { started: now, count: 0 }
        if (++ownerWindow.count > 120) throw new HttpError(429, 'RATE_LIMITED', 'Too many new sessions. Please wait a minute.')
        if (owners.size >= MAX_OWNERS) throw new HttpError(503, 'SESSION_LIMIT', 'Team preparation is at its session limit. Please try again later.')
        const token = suppliedToken && sessions.has(suppliedToken) ? suppliedToken : randomBytes(32).toString('hex')
        owner = { token, id: randomUUID(), revision: 0, receipts: new Map(), pending: null, expiresAt: now + ttlMs, window: { started: now, count: 0 } }
        owners.set(token, owner)
      }
      owner.expiresAt = Date.now() + ttlMs
      setCookie(req, res, owner.token)
      send(res, 200, { ready: true, id: owner.id, revision: owner.revision, ...(owner.pending ? { pendingStart: clone(owner.pending.request) } : {}) })
      return
    }
    if (req.method === 'DELETE' && url.pathname === `${PREFIX}/owner`) {
      if (url.search) badRequest('INVALID_QUERY', 'This endpoint does not accept query parameters.')
      const body = await readBody(req)
      if (!keysAre(body, ['revision']) || !Number.isSafeInteger(body.revision) || body.revision < 0) badRequest('INVALID_REQUEST', 'Send the current owner revision.')
      expire()
      const owner = owners.get(cookieToken(req))
      if (!owner) throw new HttpError(401, 'OWNER_REQUIRED', 'Prepare this browser session before starting Survival.')
      if (body.revision !== owner.revision) throw new HttpError(409, 'OWNER_CHANGED', 'This browser session changed. Reconnect before clearing its pending start.')
      owner.pending = null
      owner.revision++
      send(res, 200, { cleared: true, revision: owner.revision })
      return
    }
    if (req.method === 'GET' && url.pathname === `${PREFIX}/config`) {
      if (url.search) badRequest('INVALID_QUERY', 'This endpoint does not accept query parameters.')
      initialize()
      send(res, 200, config)
      return
    }
    if (req.method === 'GET' && url.pathname === `${PREFIX}/team-builder`) {
      if (url.search) badRequest('INVALID_QUERY', 'This endpoint does not accept query parameters.')
      send(res, 200, getTeamBuilderCatalog())
      return
    }
    if (req.method === 'POST' && url.pathname === `${PREFIX}/team/validate`) {
      if (url.search) badRequest('INVALID_QUERY', 'This endpoint does not accept query parameters.')
      admitTeamRequest(res)
      const body = await readBody(req, MAX_TEAM_BODY)
      if (!keysAre(body, ['team']) || !Object.hasOwn(body, 'team')) badRequest('INVALID_REQUEST', 'Send only the team to validate.')
      initialize()
      send(res, 200, factory.validateTeam(body.team))
      return
    }
    if (req.method === 'POST' && url.pathname === `${PREFIX}/team/random`) {
      if (url.search) badRequest('INVALID_QUERY', 'This endpoint does not accept query parameters.')
      admitTeamRequest(res)
      const body = await readBody(req, MAX_TEAM_BODY)
      if (!keysAre(body, ['team', 'lockedSlots']) || !Object.hasOwn(body, 'team') || !Object.hasOwn(body, 'lockedSlots')) {
        badRequest('INVALID_REQUEST', 'Send only the draft team and locked slot indexes.')
      }
      initialize()
      randomTeams ??= createRandomTeamGenerator({ validateTeam: factory.validateTeam })
      send(res, 200, randomTeams.generate(body))
      return
    }
    if (req.method === 'POST' && url.pathname === `${PREFIX}/match`) {
      if (url.search) badRequest('INVALID_QUERY', 'This endpoint does not accept query parameters.')
      const body = await readBody(req, MAX_TEAM_BODY)
      const survival = body?.mode === 'survival'
      const allowed = ['presetId', 'team', 'leadIndex', 'expectedMatchId', 'regionId',
        ...(survival ? ['mode', 'operationId', 'expectedOwnerId', 'expectedOwnerRevision', 'expectedRunRevision'] : [])]
      if (!keysAre(body, allowed) || Object.hasOwn(body, 'presetId') === Object.hasOwn(body, 'team') ||
        (body.regionId !== undefined && typeof body.regionId !== 'string') || (Object.hasOwn(body, 'presetId') && typeof body.presetId !== 'string') || !Number.isInteger(body.leadIndex) || body.leadIndex < 0 || body.leadIndex > 5 ||
        !(body.expectedMatchId === null || typeof body.expectedMatchId === 'string' && ID.test(body.expectedMatchId))) {
        badRequest('INVALID_MATCH', 'Choose one preset or custom team and a lead from its six Pokémon.')
      }
      if (survival && (Object.hasOwn(body, 'regionId') || typeof body.operationId !== 'string' || !ID.test(body.operationId) ||
          typeof body.expectedOwnerId !== 'string' || !ID.test(body.expectedOwnerId) ||
          !Number.isSafeInteger(body.expectedOwnerRevision) || body.expectedOwnerRevision < 0 ||
          !(body.expectedRunRevision === null || Number.isSafeInteger(body.expectedRunRevision) && body.expectedRunRevision >= 0))) {
        badRequest('INVALID_SURVIVAL', 'Send the confirmed owner revision, current run revision, operation identity and one starting team for Survival.')
      }
      expire()
      const existingToken = cookieToken(req)
      const existing = existingToken && sessions.get(existingToken)
      const owner = existingToken && owners.get(existingToken)
      let digest
      if (survival) {
        if (!owner) throw new HttpError(401, 'OWNER_REQUIRED', 'Prepare this browser session before starting Survival.')
        if (body.expectedOwnerId !== owner.id) throw new HttpError(409, 'OWNER_CHANGED', 'The earlier session expired or was replaced. Clear its pending start before beginning a new run.')
        const now = Date.now()
        if (now - owner.window.started >= 60_000) owner.window = { started: now, count: 0 }
        if (++owner.window.count > requestsPerMinute) throw new HttpError(429, 'RATE_LIMITED', 'Too many requests. Please pause before continuing.')
        owner.expiresAt = now + ttlMs
        digest = intentDigest(body)
        const receipt = owner.receipts.get(body.operationId)
        if (receipt) {
          if (receipt.digest !== digest) throw new HttpError(409, 'OPERATION_CONFLICT', 'This operation was already used for a different team or run.')
          if (!isSurvival(existing) || existing.run.summary().id !== receipt.runId) throw new HttpError(409, 'RUN_CHANGED', 'That run has ended or been replaced. Sync before starting another.')
          existing.expiresAt = owner.expiresAt
          setCookie(req, res, owner.token)
          send(res, 200, snapshot(existing))
          return
        }
        if (owner.pending && owner.pending.operationId !== body.operationId) throw new HttpError(409, 'START_PENDING', 'A Survival start is still pending. Retry its original request or clear the pending start.')
        if (owner.pending && owner.pending.digest !== digest) throw new HttpError(409, 'OPERATION_CONFLICT', 'Retry the original Survival start without changing its team.')
        if (body.expectedOwnerRevision !== owner.revision || body.expectedRunRevision !== (isSurvival(existing) ? existing.run.summary().revision : null)) {
          throw new HttpError(409, 'RUN_CHANGED', 'This session changed. Sync before starting another run.')
        }
      }
      if (!survival && isSurvival(existing)) throw new HttpError(409, 'SURVIVAL_ACTIVE', 'End the current Survival run before starting a different challenge.')
      initialize()
      const custom = Object.hasOwn(body, 'team')
      const preset = custom ? null : config.presets.find(candidate => candidate.id === body.presetId)
      if (!custom && !preset) badRequest('INVALID_PRESET', 'Choose an available team preset.')
      const checked = custom ? factory.validateTeam(body.team) : null
      if (checked && !checked.valid) throw new HttpError(400, 'INVALID_TEAM', 'The custom team does not meet Gen 3 Open Singles rules.', publicTeamErrors(checked.errors))
      const startingTeam = custom ? checked.team : preset.team
      const teamSelection = custom
        ? { kind: 'custom', team: clone(startingTeam), leadIndex: body.leadIndex }
        : { kind: 'preset', presetId: preset.id, leadIndex: body.leadIndex }
      const league = body.regionId === undefined ? null : leagues.find(candidate => candidate.id === body.regionId)
      if (body.regionId !== undefined && !league) badRequest('INVALID_REGION', 'Choose Kanto, Johto or Hoenn.')
      if (body.expectedMatchId !== (existing?.matchId ?? null)) throw new HttpError(409, 'MATCH_CHANGED', 'This session changed. Reload its current state before starting another battle.')
      if (!existing && sessions.size >= maxSessions) throw new HttpError(503, 'SESSION_LIMIT', 'This local server has reached its session limit. Try again later.')
      if (Date.now() - createWindow.started >= 60_000) createWindow = { started: Date.now(), count: 0 }
      if (++createWindow.count > 60) throw new HttpError(429, 'RATE_LIMITED', 'Too many new battles. Please wait a minute.')
      const playerTeam = editableTeam(startingTeam)
      const presetId = custom ? 'custom' : preset.id
      if (survival) {
        survivalFactory ??= createEngineFactory({ profileId: 'gen3survivalsinglesv1' })
        randomTeams ??= createRandomTeamGenerator({ validateTeam: factory.validateTeam })
        const generateOpponent = () => {
          const candidate = randomTeams.generate({ team: Array(6).fill(null), lockedSlots: [] })
          if (!candidate.valid) throw new HttpError(503, 'SURVIVAL_INTERRUPTED', 'The next opponent could not be prepared. Your current run has been retained; retry.')
          return candidate.team
        }
        // Freeze the first encounter before constructing an engine. Failed
        // construction can retry this same intent without drawing another team.
        if (!owner.pending) owner.pending = {
          operationId: body.operationId, digest, id: randomUUID(), matchId: randomUUID(),
          seed: `sodium,${randomBytes(32).toString('hex')}`, opponent: generateOpponent(), request: clone(body),
        }
        const pending = owner.pending
        let first = true
        let run
        try {
          run = createSurvivalRun({
            id: pending.id, initialMatchId: pending.matchId, initialSeed: pending.seed,
            playerTeam, leadIndex: body.leadIndex, presetId, factory: survivalFactory,
            collection: randomTeams.collection,
            generateOpponent: () => { if (first) { first = false; return clone(pending.opponent) } return generateOpponent() },
          })
        } catch {
          throw new HttpError(503, 'SURVIVAL_INTERRUPTED', 'Survival could not start. Your selected team and prepared opponent are retained; retry the same start.')
        }
        const { matchId, engine } = run.current()
        const session = { token: owner.token, mode: 'survival', matchId, engine, run, teamSelection,
          profileId: 'gen3survivalsinglesv1', expiresAt: Date.now() + ttlMs, window: { started: Date.now(), count: 0 } }
        let initial
        try { initial = snapshot(session) } catch (error) { run.dispose(); throw error }
        if (existing) removeSession(existingToken)
        sessions.set(owner.token, session)
        owner.revision++
        owner.pending = null
        owner.receipts.set(body.operationId, { digest, runId: pending.id })
        while (owner.receipts.size > MAX_START_RECEIPTS) owner.receipts.delete(owner.receipts.keys().next().value)
        setCookie(req, res, owner.token)
        send(res, 200, initial)
        return
      }
      playerTeam.unshift(...playerTeam.splice(body.leadIndex, 1))
      const run = league ? createLeagueRun({ league, playerTeam, presetId, createBattle: leagueFactory.create }) : null
      // Keep the earlier single-battle API compatible; the simulation UI now
      // always supplies a region and starts an independent league challenge.
      const candidates = config.presets.filter(candidate => candidate.id !== presetId)
      const matchId = run?.current().matchId ?? randomUUID()
      const engine = run?.current().engine ?? factory.create({ matchId, teams: { p1: playerTeam, p2: candidates[randomInt(candidates.length)].team } })
      const token = existing || owner ? existingToken : randomBytes(32).toString('hex')
      const session = { token, matchId, engine, run, teamSelection, profileId: run ? config.leagueProfile.id : config.profile.id, botCommands: 0, expiresAt: Date.now() + ttlMs, window: { started: Date.now(), count: 0 } }
      if (existing) removeSession(existingToken)
      if (owner) { owner.revision++; owner.pending = null }
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
    if (req.method === 'POST' && url.pathname === `${PREFIX}/advance`) {
      if (url.search) badRequest('INVALID_QUERY', 'This endpoint does not accept query parameters.')
      const body = await readBody(req)
      const session = requireSession(req, res)
      const allowed = isSurvival(session) ? ['matchId', 'runId', 'revision', 'operationId', 'leadMemberId'] : ['matchId', 'runId']
      if (!keysAre(body, allowed) || typeof body.matchId !== 'string' || !ID.test(body.matchId) || typeof body.runId !== 'string' || !ID.test(body.runId) ||
        isSurvival(session) && (!Number.isSafeInteger(body.revision) || body.revision < 0 || typeof body.operationId !== 'string' || !ID.test(body.operationId) || !/^slot:[1-6]$/.test(body.leadMemberId))) {
        badRequest('INVALID_ADVANCE', 'Send the current run and battle identities, plus a surviving lead and operation revision for Survival.')
      }
      if (!session.run) throw new HttpError(409, 'NO_LEAGUE', 'Start a regional challenge first.')
      const next = session.run.advance(body)
      if (next.matchId !== session.matchId) {
        session.matchId = next.matchId
        session.engine = next.engine
        session.botCommands = 0
      }
      send(res, 200, snapshot(session))
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
        if (isSurvival(session)) session.run.adjudicate({ kind: 'forfeit', seat: 'p1' })
        else session.engine.adjudicate({ kind: 'forfeit', seat: 'p1' })
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
      const command = { commandId: body.commandId, decisionId: body.decisionId, action: body.action }
      const ack = isSurvival(session) ? session.run.submitDecision(command) : session.engine.submitDecision('p1', command)
      if (ack.accepted && !isSurvival(session)) driveBot(session)
      send(res, 200, snapshot(session, cursor, ack))
      return
    }
    if (req.method === 'DELETE' && url.pathname === `${PREFIX}/match`) {
      if (url.search) badRequest('INVALID_QUERY', 'This endpoint does not accept query parameters.')
      const body = await readBody(req)
      const session = requireSession(req, res)
      if (!keysAre(body, isSurvival(session) ? ['matchId', 'runId', 'revision'] : ['matchId'])) badRequest('INVALID_REQUEST', 'Send the match identity and current Survival run revision, if applicable.')
      matchCheck(session, body.matchId)
      if (isSurvival(session)) {
        const run = session.run.summary()
        if (body.runId !== run.id || body.revision !== run.revision) throw new HttpError(409, 'RUN_CHANGED', 'This run progressed. Reconnect before ending it.')
      }
      removeSession(session.token)
      const owner = owners.get(session.token)
      if (owner) { owner.revision++; owner.pending = null }
      setCookie(req, res, '', 0)
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
        // Only bounded validation issues about the submitted player team are
        // public. Engine internals, NPC teams and seeds never enter errors.
        const expected = error instanceof HttpError || error instanceof LeagueRunError || error instanceof SurvivalRunError
        send(res, expected ? error.status : 503, { error: {
          code: expected ? error.code : 'SIMULATION_UNAVAILABLE',
          message: expected ? error.message : 'The simulation could not continue. Reconnect or retry to check your latest saved progress.',
          ...(error instanceof HttpError && error.errors ? { errors: error.errors } : {}),
        } })
      })
    },
    close() {
      if (closed) return
      closed = true
      clearInterval(cleanup)
      for (const token of sessions.keys()) removeSession(token)
      owners.clear()
    },
  })
}

/** The Node service is created only when a dev/preview server receives an API request. */
export function simulationPlugin(options = {}) {
  const install = server => {
    let service
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith(PREFIX)) { next(); return }
      service ??= createSimulationService(options)
      service.middleware(req, res, next)
    })
    server.httpServer?.once('close', () => service?.close())
  }
  return { name: 'battle-simulation-api', configureServer: install, configurePreviewServer: install }
}
