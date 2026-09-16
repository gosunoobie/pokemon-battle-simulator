export class MultiplayerError extends Error {
  constructor(message, code, status = 0) { super(message); this.code = code; this.status = status }
}

export function createOperationId(random = globalThis.crypto) {
  return typeof random.randomUUID === 'function' ? random.randomUUID()
    : Array.from(random.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
}

// Every request owns its cancellation; an update poll must never abort a choice.
export async function multiplayerRequest(path, { method = 'GET', body, signal, timeoutMs = 15000 } = {}) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, timeoutMs)
  try {
    const response = await fetch(`/api/multiplayer/${path}`, {
      method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    })
    let data
    try { data = await response.json() }
    catch { throw new MultiplayerError('The multiplayer server is unavailable. Wait a moment and reconnect.', 'SERVER_UNAVAILABLE', response.status) }
    if (!response.ok) throw new MultiplayerError(data.error?.message || 'The room request failed.', data.error?.code, response.status)
    return data
  } catch (error) {
    if (error instanceof MultiplayerError) throw error
    throw new MultiplayerError(controller.signal.aborted ? 'The request was interrupted. Reconnect or retry to confirm its result.' : 'Could not reach the room server. Your last action may still have arrived.', 'CONNECTION_FAILED')
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort)
  }
}
