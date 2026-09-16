import { createRoomService, RoomError } from './service.js'

const PREFIX = '/api/multiplayer'
const COOKIE = 'battle_multiplayer_v1'
const TOKEN = /^[a-f0-9]{64}$/
const ID = /^[a-zA-Z0-9:_-]{1,128}$/
const MAX_BODY = 4096
const DEFAULT_LIMITS = Object.freeze({
  windowMs: 60_000, global: 6000, guest: 120, publicRead: 600,
  read: 240, command: 120, create: 30, maxPrincipals: 5000,
})
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code }
}

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

function checkOrigin(req, publicOrigin) {
  const host = req.headers.host
  if (typeof host !== 'string' || /[\s/\\,#]/.test(host)) throw new HttpError(403, 'ORIGIN_REJECTED', 'The request must come from this application.')
  // A configured browser origin is authoritative, including behind a proxy.
  // Forwarded headers never grant another origin access or identify a guest.
  const expected = publicOrigin ?? `${req.socket.encrypted ? 'https' : 'http'}://${host}`
  if ((req.method !== 'GET' && !req.headers.origin) ||
      (req.headers.origin && req.headers.origin !== expected) ||
      (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) {
    throw new HttpError(403, 'ORIGIN_REJECTED', 'The request must come from this application.')
  }
}

async function readBody(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) throw new HttpError(415, 'JSON_REQUIRED', 'Send application/json.')
  if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') throw new HttpError(415, 'ENCODING_REJECTED', 'Send uncompressed JSON.')
  if (Number(req.headers['content-length']) > MAX_BODY) throw new HttpError(413, 'BODY_TOO_LARGE', 'The request is too large.')
  const chunks = await new Promise((resolve, reject) => {
    let size = 0
    const parts = []
    const cleanup = () => {
      req.off('data', onData)
      req.off('end', onEnd)
      req.off('error', onError)
      req.off('aborted', onAborted)
    }
    const onError = error => { cleanup(); reject(error) }
    const onAborted = () => onError(new Error('Request aborted'))
    const onEnd = () => { cleanup(); resolve(parts) }
    const onData = chunk => {
      size += chunk.length
      if (size > MAX_BODY) {
        cleanup()
        // Drain an oversized chunked body without destroying the response
        // socket before the client receives its bounded 413 error.
        req.resume()
        reject(new HttpError(413, 'BODY_TOO_LARGE', 'The request is too large.'))
      } else parts.push(chunk)
    }
    req.on('data', onData)
    req.once('end', onEnd)
    req.once('error', onError)
    req.once('aborted', onAborted)
  })
  let body
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'), (key, value) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe JSON key')
      return value
    })
  } catch { throw new HttpError(400, 'INVALID_JSON', 'The request must contain valid JSON.') }
  if (!plain(body)) throw new HttpError(400, 'INVALID_REQUEST', 'Send a JSON object.')
  return body
}

function cookieToken(req) {
  const values = (req.headers.cookie ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${COOKIE}=`))
  if (values.length !== 1) return undefined
  const token = values[0].slice(COOKIE.length + 1)
  return TOKEN.test(token) ? token : undefined
}

function updateQuery(params) {
  const allowed = ['afterRevision', 'afterCursor', 'matchId', 'sync']
  if ([...params.keys()].some(key => !allowed.includes(key) || params.getAll(key).length !== 1)) {
    throw new HttpError(400, 'INVALID_QUERY', 'Send one value for each supported update parameter.')
  }
  const options = {}
  for (const key of ['afterRevision', 'afterCursor']) {
    if (!params.has(key)) continue
    const raw = params.get(key)
    if (!/^\d{1,16}$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new HttpError(400, 'INVALID_CURSOR', 'Use nonnegative safe integer revisions and event cursors.')
    options[key] = Number(raw)
  }
  if (params.has('matchId')) {
    const matchId = params.get('matchId')
    if (!ID.test(matchId)) throw new HttpError(400, 'INVALID_MATCH', 'Send a valid battle identity.')
    options.matchId = matchId
  }
  if (params.has('sync')) {
    const sync = params.get('sync')
    if (!['0', '1', 'false', 'true'].includes(sync)) throw new HttpError(400, 'INVALID_QUERY', 'The sync parameter must be true or false.')
    options.sync = sync === '1' || sync === 'true'
  }
  return options
}

/** Same-origin HTTP boundary. Room ownership and rules live in the room service. */
export function createMultiplayerService({ publicOrigin, rateLimits = {}, ...serviceOptions } = {}) {
  publicOrigin = parsePublicOrigin(publicOrigin)
  if (!plain(rateLimits) || Object.keys(rateLimits).some(key => !Object.hasOwn(DEFAULT_LIMITS, key))) throw new TypeError('Invalid multiplayer rate limits')
  const limits = { ...DEFAULT_LIMITS, ...rateLimits }
  for (const [key, value] of Object.entries(limits)) if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`Invalid multiplayer rate limit ${key}`)
  const clock = serviceOptions.clock ?? Date.now
  const rooms = createRoomService(serviceOptions)
  const principalWindows = new Map()
  let globalWindow = { started: clock(), counts: {} }
  let closed = false

  function count(window, kind) {
    if ((window.counts[kind] ?? 0) >= limits[kind]) throw new HttpError(429, 'RATE_LIMITED', 'Too many requests. Please wait before trying again.')
    window.counts[kind] = (window.counts[kind] ?? 0) + 1
  }
  function globalRate(kind) {
    if (clock() - globalWindow.started >= limits.windowMs) globalWindow = { started: clock(), counts: {} }
    count(globalWindow, kind)
  }
  function principalRate(guestId, kind) {
    const now = clock()
    let window = principalWindows.get(guestId)
    if (!window || now - window.started >= limits.windowMs) {
      // Bound bookkeeping independently of client-supplied tokens and IDs.
      for (const [id, entry] of principalWindows) if (now - entry.started >= limits.windowMs) principalWindows.delete(id)
      if (!principalWindows.has(guestId) && principalWindows.size >= limits.maxPrincipals) throw new HttpError(503, 'SERVICE_BUSY', 'The room server is busy. Please try again shortly.')
      window = { started: now, counts: {} }
      principalWindows.set(guestId, window)
    }
    count(window, kind)
  }
  function setCookie(req, res, token, expiresAt) {
    const secure = publicOrigin?.startsWith('https://') || req.socket.encrypted
    const maxAge = Math.max(0, Math.ceil((expiresAt - clock()) / 1000))
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=${PREFIX}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`)
  }

  async function route(req, res, url) {
    if (closed) throw new HttpError(503, 'SERVICE_CLOSED', 'The room server is stopping.')
    globalRate('global')
    checkOrigin(req, publicOrigin)
    let operation
    let roomId
    const simple = new Map([['/guest', 'guest'], ['/config', 'config'], ['/session', 'session'], ['/rooms', 'create'], ['/rooms/join', 'join']])
    const suffix = url.pathname.slice(PREFIX.length)
    operation = simple.get(suffix)
    if (!operation) {
      const match = suffix.match(/^\/rooms\/([a-zA-Z0-9:_-]{1,128})\/(selection|ready|choice|forfeit|leave|updates)$/)
      if (match) [, roomId, operation] = match
    }
    if (!operation) throw new HttpError(404, 'NOT_FOUND', 'No multiplayer endpoint exists at this address.')
    const method = ['config', 'session', 'updates'].includes(operation) ? 'GET' : 'POST'
    if (req.method !== method) {
      res.setHeader('Allow', method)
      throw new HttpError(405, 'METHOD_NOT_ALLOWED', `Use ${method} for this endpoint.`)
    }
    if (operation !== 'updates' && url.search) throw new HttpError(400, 'INVALID_QUERY', 'This endpoint does not accept query parameters.')
    if (operation === 'config') {
      globalRate('publicRead')
      return send(res, 200, await rooms.config())
    }
    if (operation === 'guest') {
      globalRate('guest')
      const body = await readBody(req)
      if (Object.keys(body).some(key => key !== 'name')) throw new HttpError(400, 'INVALID_REQUEST', 'Send only an optional guest name.')
      const result = await rooms.guest({ token: cookieToken(req), ...body })
      setCookie(req, res, result.token, result.guest.expiresAt)
      // Raw bearer credentials never enter JSON or browser storage.
      return send(res, 200, { guest: result.guest })
    }
    const guestId = await rooms.authenticate(cookieToken(req))
    principalRate(guestId, method === 'GET' ? 'read' : 'command')
    if (operation === 'session') return send(res, 200, await rooms.session(guestId))
    if (operation === 'updates') return send(res, 200, await rooms.updates(guestId, roomId, updateQuery(url.searchParams)))
    if (operation === 'create' || operation === 'join') principalRate(guestId, 'create')
    const body = await readBody(req)
    if (Object.hasOwn(body, 'roomId')) throw new HttpError(400, 'INVALID_REQUEST', 'The room identity belongs in the request path.')
    return send(res, 200, await rooms.execute(guestId, operation, { ...body, ...(roomId ? { roomId } : {}) }))
  }

  async function handle(req, res) {
    let url
    try { url = new URL(req.url, 'http://multiplayer.local') } catch { return false }
    if (url.pathname !== PREFIX && !url.pathname.startsWith(`${PREFIX}/`)) return false
    try {
      if (req.url.length > 4096) throw new HttpError(414, 'URL_TOO_LONG', 'The request address is too long.')
      await route(req, res, url)
    } catch (error) {
      const expected = error instanceof HttpError || error instanceof RoomError
      const status = expected && Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 503
      if (status === 429) res.setHeader('Retry-After', String(Math.ceil(limits.windowMs / 1000)))
      send(res, status, { error: {
        code: expected && typeof error.code === 'string' ? error.code.slice(0, 64) : 'MULTIPLAYER_UNAVAILABLE',
        message: expected && typeof error.message === 'string' ? error.message.slice(0, 512) : 'The room server could not complete this request. Please try again.',
      } })
    }
    return true
  }

  return Object.freeze({
    handle,
    async middleware(req, res, next) { if (!await handle(req, res)) next?.() },
    close() {
      if (closed) return
      closed = true
      principalWindows.clear()
      return rooms.close()
    },
  })
}

export function multiplayerPlugin(options = {}) {
  const install = server => {
    let service
    server.middlewares.use((req, res, next) => {
      if (req.url !== PREFIX && !req.url?.startsWith(`${PREFIX}/`)) { next(); return }
      service ??= createMultiplayerService(options)
      service.middleware(req, res, next).catch(next)
    })
    server.httpServer?.once('close', () => service?.close())
  }
  return { name: 'battle-multiplayer-api', configureServer: install, configurePreviewServer: install }
}
