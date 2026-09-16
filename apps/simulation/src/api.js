export class SimulationError extends Error {
  constructor(message, code, status = 0, issues = []) {
    super(message); this.code = code; this.status = status
    this.issues = Array.isArray(issues) ? issues : []
  }
}

// Deduplication IDs also work on a local-network HTTP origin, where randomUUID is absent.
export function createCommandId(random = globalThis.crypto) {
  if (typeof random.randomUUID === 'function') return random.randomUUID()
  return Array.from(random.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
}

// The cookie identifies this browser's seat. No engine state or credentials live in storage.
export async function simulationRequest(path, { method = 'GET', body, signal, timeoutMs = 15000 } = {}) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const deadline = setTimeout(abort, timeoutMs)
  try {
    const response = await fetch(`/api/simulation/${path}`, {
      method, credentials: 'same-origin', signal: controller.signal,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    let data
    try { data = await response.json() }
    catch { throw new SimulationError('The battle server is unavailable. Wait a moment, then reconnect.', 'SERVER_UNAVAILABLE', response.status) }
    if (!response.ok) throw new SimulationError(data.error?.message || 'The battle request could not be completed.', data.error?.code, response.status, data.error?.errors)
    return data
  } catch (error) {
    if (error instanceof SimulationError) throw error
    throw new SimulationError(controller.signal.aborted ? 'The request timed out or was interrupted. Sync the battle to check its latest result.' : 'Could not reach the battle server. Check your connection and try again.', 'CONNECTION_FAILED')
  } finally {
    clearTimeout(deadline)
    signal?.removeEventListener('abort', abort)
  }
}
