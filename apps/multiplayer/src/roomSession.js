/** Delivery and presentation are independent. No rules, transport or Vue here. */
export function createRoomSession({ present, sync, clear = () => {}, onChange = () => {}, onEvents = () => {}, onError = () => {}, maxQueue = 8 }) {
  if (typeof present !== 'function' || typeof sync !== 'function' || !Number.isSafeInteger(maxQueue) || maxQueue < 1) throw new TypeError('Presentation callbacks and a positive queue limit are required.')
  let envelope = null, revision = -1, cursor = 0, pending = null
  let generation = 0, disposed = false, displayed = null, queue = [], playback = null, synchronization = null
  const snapshot = () => ({ envelope, revision, cursor, pending, playing: Boolean(playback || synchronization || queue.length), displayed })
  const report = error => { if (!disposed) { try { onError(error) } catch {} } }
  const notify = (callback, ...args) => { try { callback(...args) } catch (error) { report(error) } }
  const publish = () => { if (!disposed) notify(onChange, snapshot()) }
  const fail = message => { report(new Error(message)); return false }
  const current = operation => !disposed && operation.generation === generation
  function stop() { generation++; queue = []; playback = null; synchronization = null }
  function reconcile(view, events = []) {
    stop(); displayed = view
    const operation = { generation }
    synchronization = operation
    publish()
    // Invoke synchronously so the host invalidates old cues before its first
    // await. New batches wait for this sync instead of racing its nextTick.
    let work
    try { work = sync(view, { events, isCurrent: () => current(operation) }) }
    catch (error) { work = Promise.reject(error) }
    Promise.resolve(work).catch(error => { if (current(operation)) report(error) }).finally(() => {
      if (!current(operation) || synchronization !== operation) return
      synchronization = null
      if (queue.length) void drain()
      else publish()
    })
  }
  async function drain() {
    if (playback || synchronization || !queue.length || disposed) return
    const operation = { generation }
    playback = operation; publish()
    try {
      while (queue.length && current(operation)) {
        const batch = queue.shift()
        await present({ ...batch, before: displayed }, { isCurrent: () => current(operation) })
        if (!current(operation)) return
        // Eventless acknowledgements may have changed the legal decision while
        // this exact cursor was animating. Preserve that newer metadata.
        displayed = envelope?.view?.cursor === batch.after.cursor ? envelope.view : batch.after
      }
    } catch (error) {
      if (current(operation)) {
        report(error)
        reconcile(envelope?.view ?? null)
      }
    } finally {
      if (current(operation) && playback === operation) { playback = null; publish() }
    }
  }
  function ack(response) {
    if (!pending || !response.ack) return
    const ids = [response.ack.operationId, response.ack.commandId].filter(id => typeof id === 'string' && id.length > 0)
    if (ids.some(id => id === pending.operationId || id === pending.commandId)) pending = null
  }
  function ingest(response, { synchronize = false } = {}) {
    if (disposed || !response?.room) return false
    if (response.protocolVersion !== 1 || typeof response.room.id !== 'string' || !response.room.id || !['p1', 'p2'].includes(response.room.seat)) return fail('The server returned an incompatible room view. Reconnect before continuing.')
    if (envelope && response.room.id !== envelope.room.id) return false
    if (envelope && response.room.seat !== envelope.room.seat) return fail('Room ownership changed. Reconnect before continuing.')
    if (!Number.isSafeInteger(response.revision) || response.revision < 0) return fail('The server returned an invalid room revision. Sync before continuing.')
    if (envelope?.matchId && response.matchId !== envelope.matchId) return fail('The room match changed unexpectedly. Reconnect before continuing.')
    const previous = envelope
    // Receipts are independent of delivery age, but never independent of room,
    // match and seat identity. An absent ID cannot match another absent field.
    ack(response)
    if (response.revision < revision) { publish(); return false }
    const unchanged = response.mode === 'unchanged'
    if (unchanged && (!previous || response.revision !== revision)) return fail('An unchanged update cannot replace a missing room snapshot. Sync before continuing.')
    if (unchanged || response.revision === revision && !synchronize && response.mode !== 'sync') {
      // Small heartbeats omit view/events. Retain their clock sample without
      // discarding the authoritative snapshot or touching active presentation.
      envelope = { ...previous,
        ...(Number.isFinite(response.serverNow) ? { serverNow: response.serverNow } : {}),
        ...(Number.isFinite(response._receivedAt) ? { _receivedAt: response._receivedAt } : {}),
      }
      publish(); return true
    }
    const view = response.view ?? null
    if (view && (!view.complete || view.seat !== response.room.seat || view.matchId !== response.matchId || !Number.isSafeInteger(view.cursor) || view.cursor < 0)) return fail('The server returned an incomplete battle view. Sync before continuing.')
    if (!view && previous?.view) return fail('The server omitted the active battle snapshot. Sync before continuing.')
    if (view && view.cursor < cursor) return fail('The server returned an older battle snapshot. Sync before continuing.')
    const freshMatch = !!view && !previous?.view
    const supplied = Array.isArray(response.events) ? response.events : []
    const validEvents = supplied.every(event => event && Number.isSafeInteger(event.cursor) && event.cursor >= 0)
    const events = validEvents ? supplied.filter(event => event.cursor > cursor) : []
    const ordered = validEvents && events.every((event, index) => event.cursor === cursor + index + 1)
    const complete = !view || view.cursor === cursor + events.length
    const fallback = synchronize || response.mode === 'sync' || !ordered || !complete || queue.length >= maxQueue || response.room.status === 'interrupted'
    envelope = response; revision = response.revision
    if (view) cursor = view.cursor
    if (pending?.decisionId && view && (view.decision?.id !== pending.decisionId || ['wait', 'finished'].includes(view.decision?.kind))) pending = null
    publish()
    if (!view) return true
    const completeEvents = ordered && complete ? events : []
    notify(onEvents, completeEvents, previous?.view ?? null, view, { synchronize: fallback })
    if (fallback) reconcile(view, completeEvents)
    else if (freshMatch || events.length) {
      queue.push({ after: view, events })
      void drain()
    } else if (!playback && !synchronization && !queue.length) {
      displayed = view; publish()
    }
    return true
  }
  function empty() {
    stop(); notify(clear); envelope = null; revision = -1; cursor = 0; pending = null; displayed = null
  }
  function enter(response, options = {}) {
    if (disposed) return false
    empty()
    return ingest(response, options)
  }
  function reset() {
    if (disposed) return
    empty(); publish()
  }
  return {
    enter, ingest, reset, snapshot,
    setPending(command) { if (!disposed) { pending = structuredClone(command); publish() } },
    clearPending() { if (!disposed) { pending = null; publish() } },
    dispose() { if (!disposed) { empty(); disposed = true } },
  }
}
