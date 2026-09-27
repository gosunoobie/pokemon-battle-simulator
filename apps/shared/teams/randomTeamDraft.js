import { createTeamDraft, toTeamPayload } from './teamDraft.js'

const indices = Array.from({ length: 6 }, (_, index) => index)
const copy = value => createTeamDraft(value)
const draftIdentity = value => JSON.stringify([copy(value.team), value.context ?? null])
const identity = value => JSON.stringify([copy(value.team), value.context ?? null, Boolean(value.disabled)])
const occupied = (team, index) => Boolean(team[index]?.species)

/** Keep preparation requests independent of either host's battle/room lifecycle.
 * Cancellation saves work; the snapshot comparison is the correctness boundary.
 */
export function createRandomTeamDraftController({ read, generate, commit, onState = () => {} }) {
  let lastIdentity = identity(read()), lastDraftIdentity = draftIdentity(read())
  let sequence = 0, pending = null, disposed = false, previous = null
  let state = { lockedSlots: [], busy: false, errors: [], notice: '', canUndo: false, collection: null }
  const publish = patch => { state = { ...state, ...patch }; if (!disposed) onState(state) }
  function cancel() {
    sequence++
    pending?.abort(); pending = null
    if (state.busy) publish({ busy: false })
  }
  function sync() {
    if (disposed) return
    const current = read(), nextIdentity = identity(current), nextDraftIdentity = draftIdentity(current)
    if (nextIdentity === lastIdentity) return
    lastIdentity = nextIdentity
    cancel()
    // Checking or submitting a team temporarily disables the editor. That must
    // cancel in-flight generation without consuming a completed generation's undo.
    if (nextDraftIdentity === lastDraftIdentity) return
    lastDraftIdentity = nextDraftIdentity; previous = null
    const team = copy(current.team)
    publish({ lockedSlots: state.lockedSlots.filter(index => occupied(team, index)), errors: [], notice: '', canUndo: false })
  }
  function update(team, patch = {}) {
    // A controlled Vue parent applies emitted values on its next render. Register
    // our expected value first, so that render does not look like an outside edit.
    lastIdentity = identity({ ...read(), team })
    lastDraftIdentity = draftIdentity({ ...read(), team })
    publish(patch)
    commit(copy(team))
  }
  function edit(team) {
    if (disposed || read().disabled) return
    cancel(); previous = null
    const next = copy(team)
    update(next, { lockedSlots: state.lockedSlots.filter(index => occupied(next, index)), errors: [], notice: '', canUndo: false })
  }
  function toggleLock(index) {
    sync()
    if (disposed || read().disabled || !indices.includes(index) || !occupied(copy(read().team), index)) return
    cancel()
    publish({ lockedSlots: state.lockedSlots.includes(index)
      ? state.lockedSlots.filter(slot => slot !== index)
      : [...state.lockedSlots, index].sort((a, b) => a - b), errors: [], notice: '' })
  }
  function unlockAll() {
    sync()
    if (disposed || read().disabled) return
    cancel(); publish({ lockedSlots: [], errors: [], notice: '' })
  }
  async function run(slot = null) {
    sync()
    if (disposed || read().disabled || typeof generate !== 'function') return false
    const team = copy(read().team), locks = [...state.lockedSlots]
    if (slot !== null && (!indices.includes(slot) || locks.includes(slot))) return false
    const retained = slot === null ? locks : indices.filter(index => index !== slot && occupied(team, index))
    if (retained.length === 6) return false
    cancel()
    const ticket = ++sequence, snapshotIdentity = identity(read()), request = new AbortController()
    pending = request
    publish({ busy: true, errors: [], notice: '' })
    const current = () => !disposed && ticket === sequence && identity(read()) === snapshotIdentity
    try {
      const result = await generate({ team: toTeamPayload(team), lockedSlots: retained }, { signal: request.signal })
      if (!current()) return false
      if (!result?.valid) {
        publish({ errors: result?.errors?.length ? result.errors : [{ code: 'GENERATION_FAILED', message: 'Could not generate a team. Your current team has been kept.' }] })
        return false
      }
      if (!Array.isArray(result.team) || result.team.length !== 6 || result.team.some(member => !member?.species)) {
        throw new Error('The server returned an incomplete team. Your current team has been kept.')
      }
      const next = copy(result.team)
      // Retained drafts stay byte-for-byte editable copies, including move-slot
      // placement and user aliases. The server validated their complete sets.
      for (const index of retained) next[index] = team[index]
      previous = { team, lockedSlots: locks }
      pending = null
      const count = 6 - retained.length
      update(next, { busy: false, canUndo: true, collection: result.collection ?? null,
        notice: `${count === 1 ? 'One new Pokémon' : `${count} new Pokémon`} ready. ${retained.length ? `${retained.length} retained. ` : ''}You can edit every move and setting.` })
      return true
    } catch (cause) {
      if (current()) publish({ errors: cause?.issues?.length ? cause.issues : [{ code: cause?.code ?? 'GENERATION_FAILED', message: cause?.message || 'Could not generate a team. Try again.' }] })
      return false
    } finally {
      if (!disposed && ticket === sequence) { pending = null; publish({ busy: false }) }
    }
  }
  function undo() {
    sync()
    if (disposed || read().disabled || !previous) return false
    cancel()
    const saved = previous; previous = null
    update(saved.team, { lockedSlots: saved.lockedSlots, errors: [], notice: 'Restored the team before the last generation.', canUndo: false })
    return true
  }
  return { getState: () => state, sync, edit, toggleLock, unlockAll, run, undo,
    dispose() { cancel(); disposed = true; previous = null } }
}
