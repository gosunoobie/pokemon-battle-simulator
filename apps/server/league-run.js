import { randomUUID } from 'node:crypto'

const clone = value => structuredClone(value)
const trainerInfo = ({ id, name, title, specialty }) => ({ id, name, title, specialty })

export function publicLeague(league) {
  return {
    id: league.id, name: league.name, edition: league.edition, description: league.description,
    trainers: league.trainers.map(trainerInfo),
  }
}

export class LeagueRunError extends Error {
  constructor(code, message) { super(message); this.code = code; this.status = 409 }
}

/** Server-owned progression, independent of battle mechanics and presentation.
 * createBattle is the engine port. Only its authoritative result unlocks a round.
 */
export function createLeagueRun({ league, playerTeam, presetId, createBattle }) {
  if (league.trainers.length !== 5) throw new TypeError('A regional league requires four Elite Four members and one Champion.')
  const id = randomUUID()
  const startingTeam = clone(playerTeam)
  let stageIndex = 0
  let current
  let disposed = false
  const completedMatches = new Set()

  function createRound(index) {
    const matchId = randomUUID()
    // A new engine restores HP, PP, status, held items and all temporary state.
    // Retain the selected lead and initial team; never import a client's HP.
    const engine = createBattle({ matchId, teams: { p1: clone(startingTeam), p2: clone(league.trainers[index].team) } })
    return { matchId, engine }
  }
  function ensureAlive() { if (disposed) throw new Error('This league run has been disposed.') }
  function summary() {
    ensureAlive()
    const result = current.engine.getPlayerView('p1').result
    const won = result?.kind === 'win' && result.winnerSeat === 'p1'
    const status = !result ? 'active' : !won ? 'lost' : stageIndex === 4 ? 'won' : 'between-battles'
    return {
      id, regionId: league.id, regionName: league.name, edition: league.edition, presetId,
      stageIndex, totalStages: 5, wins: stageIndex + (won ? 1 : 0), status,
      opponent: trainerInfo(league.trainers[stageIndex]),
      nextOpponent: status === 'between-battles' ? trainerInfo(league.trainers[stageIndex + 1]) : null,
      trainers: league.trainers.map(trainerInfo),
    }
  }
  current = createRound(0)
  return Object.freeze({
    current() { ensureAlive(); return { ...current } },
    summary,
    advance({ runId, matchId }) {
      ensureAlive()
      if (runId !== id) throw new LeagueRunError('RUN_CHANGED', 'This session has a different league challenge. Sync before continuing.')
      if (matchId !== current.matchId) {
        // Retrying a lost response (including from another tab) is read-only.
        if (completedMatches.has(matchId)) return { ...current }
        throw new LeagueRunError('MATCH_CHANGED', 'This challenge has a different battle. Sync before continuing.')
      }
      const state = summary()
      if (state.status !== 'between-battles') throw new LeagueRunError('ROUND_NOT_WON', 'Win the current battle before challenging the next trainer. Completed runs cannot advance.')
      const next = createRound(stageIndex + 1)
      completedMatches.add(current.matchId)
      current.engine.dispose()
      current = next
      stageIndex++
      return { ...current }
    },
    dispose() {
      if (disposed) return
      disposed = true
      current.engine.dispose()
    },
  })
}
