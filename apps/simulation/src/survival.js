// Client intent and display only. HP recovery and run progression belong to the server.
const START_KEY = 'battle-lab:survival-start:v1'

export function survivalStartCommand({ selection, leadIndex, matchId = null, revision = null, ownerId, ownerRevision, operationId }) {
  return JSON.parse(JSON.stringify({ ...selection, mode: 'survival', leadIndex, expectedMatchId: matchId, expectedRunRevision: revision, expectedOwnerId: ownerId, expectedOwnerRevision: ownerRevision, operationId }))
}

export function survivalAdvanceCommand(run, matchId, leadMemberId, operationId) {
  if (!run || run.kind !== 'survival') throw new TypeError('A Survival run is required.')
  const pending = run.pending
  if (pending) return { runId: run.id, matchId: pending.matchId ?? matchId, revision: pending.expectedRevision, operationId: pending.operationId, leadMemberId: pending.leadMemberId }
  if (run.status !== 'between-rounds' || !run.roster.some(member => member.id === leadMemberId && !member.eliminated && member.hp > 0)) throw new TypeError('Choose an available Pokémon to lead the next round.')
  return { runId: run.id, matchId, revision: run.revision, operationId, leadMemberId }
}

export function readSurvivalStart(storage) {
  try {
    const raw = storage?.getItem(START_KEY)
    if (!raw || raw.length > 25000) return null
    const value = JSON.parse(raw)
    return value?.mode === 'survival' && typeof value.operationId === 'string' && Number.isInteger(value.leadIndex) && value.leadIndex >= 0 && value.leadIndex < 6 ? value : null
  } catch { return null }
}
export function saveSurvivalStart(storage, command) {
  try { command ? storage?.setItem(START_KEY, JSON.stringify(command)) : storage?.removeItem(START_KEY) } catch { /* In-memory retry still works without storage. */ }
}

export function displayedSurvivors(run, displayed, playing = false) {
  return (run?.roster ?? []).map(member => {
    const current = displayed?.own?.team?.find(candidate => candidate.memberId === member.memberId)
    // A terminal response already contains recovery. Wait for the final impact and
    // faint presentation before exposing that committed recovery to the player.
    return current && (run.status === 'active' || playing) ? { ...member, hp: current.hp?.current ?? member.hp, maxHp: current.hp?.max ?? member.maxHp, eliminated: current.fainted } : member
  })
}

export function survivalEndingText(reason) {
  return ({ forfeit: 'You forfeited this run.', loss: 'Your team was defeated.', defeat: 'Your team was defeated.', draw: 'This round ended in a draw.', 'turn-limit': 'This round reached the turn limit.', 'no-survivors': 'No Pokémon remain to continue.', interrupted: 'Your progress is preserved. Sync or retry to continue.' })[reason] ?? 'Your Survival run has ended.'
}
