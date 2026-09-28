import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { editableTeam } from './teams/selection.js'
import { driveSurvivalAI, SURVIVAL_AI_VERSION } from './survival-ai.js'

export const SURVIVAL_RULES_VERSION = 'gen3-survival-v2'
const RECEIPT_LIMIT = 64
const HISTORY_LIMIT = 16
const clone = value => structuredClone(value)
const seed = () => `sodium,${randomBytes(32).toString('hex')}`
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,128}$/.test(value)
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export class SurvivalRunError extends Error {
  constructor(code, message, status = 409) { super(message); this.name = 'SurvivalRunError'; this.code = code; this.status = status }
}
const fail = (code, message, status) => { throw new SurvivalRunError(code, message, status) }

/** RAM-backed atomic record ownership. Every battle mutation occurs on a
 * checkpoint-restored candidate; the published engine is never mutated. */
export function createSurvivalRun({ playerTeam, leadIndex = 0, presetId = 'custom', factory, generateOpponent, beforeCommit, collection = null,
  id = randomUUID(), initialSeed = seed(), initialMatchId = randomUUID() }) {
  if (!Array.isArray(playerTeam) || playerTeam.length !== 6 || !Number.isInteger(leadIndex) || leadIndex < 0 || leadIndex > 5 || !validId(id) || !validId(initialMatchId)) {
    fail('INVALID_SURVIVAL_TEAM', 'Choose six Pokémon and one of their leads.', 400)
  }
  const checked = factory.validateTeam(playerTeam)
  if (!checked.valid) fail('INVALID_SURVIVAL_TEAM', 'The starting team must meet Survival rules.', 400)
  const originalTeam = editableTeam(checked.team)
  let engine
  let record
  let disposed = false
  let interruption = null

  function ensureAlive() { if (disposed) fail('RUN_DISPOSED', 'This Survival run has ended.') }
  function checkView(candidate) {
    const view = candidate.getPlayerView('p1')
    if (!view.complete) throw new Error('Survival projection is incomplete.')
    return view
  }
  function commit(next, candidate = engine) {
    // The private hook represents the store publication boundary and supports
    // fault injection. It may throw; neither published value changes then.
    beforeCommit?.(clone(next))
    const old = engine
    record = freeze(next)
    engine = candidate
    interruption = null
    if (old && old !== candidate) old.dispose()
  }
  function operationalFailure(error) {
    if (error instanceof SurvivalRunError) throw error
    interruption = { code: 'SURVIVAL_INTERRUPTED', message: 'Progress is preserved. Sync and retry the interrupted action.', retryable: true }
    fail(interruption.code, interruption.message, 503)
  }
  function drawOpponent() {
    const generated = generateOpponent()
    const team = Array.isArray(generated) ? generated : generated?.valid ? generated.team : null
    if (!Array.isArray(team) || team.length !== 6) throw new Error('Opponent generation failed.')
    return { team: editableTeam(team), collection: clone(generated?.collection ?? collection) }
  }
  function orderedMembers(roster, leadId) {
    const survivors = roster.filter(member => !member.eliminated)
    const index = survivors.findIndex(member => member.id === leadId)
    if (index < 0) fail('INVALID_SURVIVAL_LEAD', 'Choose an available Pokémon as the next lead.', 400)
    survivors.unshift(...survivors.splice(index, 1))
    return survivors
  }
  function prepareBattle({ roster, leadId, opponent, matchId, battleSeed, initial = false }) {
    const members = orderedMembers(roster, leadId)
    const mapping = members.map((member, index) => ({ id: member.id, memberId: `p1:${index + 1}` }))
    const options = {
      matchId, seed: battleSeed,
      teams: { p1: members.map(member => clone(originalTeam[member.slot])), p2: clone(opponent) },
      ...(!initial ? { initialConditions: { p1: members.map((member, index) => ({ memberId: `p1:${index + 1}`, hp: member.hp })) } } : {}),
    }
    return { candidate: factory.create(options), mapping }
  }
  function liveRoster(view = engine.getPlayerView('p1')) {
    return record.roster.map(member => {
      const identity = record.current.mapping.find(mapping => mapping.id === member.id)
      const live = view.own.team.find(pokemon => pokemon.memberId === identity?.memberId)
      const active = record.status === 'active'
      return {
        id: member.id, memberId: identity?.memberId ?? null, name: originalTeam[member.slot].name || originalTeam[member.slot].species,
        species: originalTeam[member.slot].species, hp: active && live?.hp ? live.hp.current : member.hp,
        maxHp: active && live?.hp ? live.hp.max : member.maxHp,
        eliminated: member.eliminated || (active && !!live?.fainted),
      }
    })
  }
  function settle(next, candidate, view) {
    if (!view.result || next.status !== 'active') return
    if (view.result.kind === 'no-contest') throw new Error('An infrastructure result cannot settle a Survival run.')
    const terminal = candidate.getTerminalRoster('p1')
    if (!Array.isArray(terminal) || terminal.length !== next.current.mapping.length) throw new Error('Invalid terminal roster.')
    const byMember = new Map(terminal.map(member => [member.memberId, member]))
    if (byMember.size !== terminal.length) throw new Error('Duplicate terminal roster identity.')
    const won = view.result.kind === 'win' && view.result.winnerSeat === 'p1'
    next.recovery = []
    for (const mapping of next.current.mapping) {
      const finish = byMember.get(mapping.memberId)
      const member = next.roster.find(member => member.id === mapping.id)
      if (!finish || !member || !Number.isInteger(finish.hp) || !Number.isInteger(finish.maxHp) || finish.maxHp < 1 || finish.hp < 0 || finish.hp > finish.maxHp || !!finish.fainted !== (finish.hp === 0)) throw new Error('Invalid terminal health.')
      member.maxHp = finish.maxHp
      const before = finish.hp
      const revived = won && finish.fainted
      // Revive and survivor healing are exclusive. A fainted member receives
      // half its max HP, never half plus the ordinary quarter-HP recovery.
      const after = !won ? before : revived ? Math.max(1, Math.floor(finish.maxHp / 2))
        : Math.min(finish.maxHp, before + Math.max(1, Math.floor(finish.maxHp / 4)))
      member.hp = after
      member.eliminated = after === 0
      if (won) next.recovery.push({ id: member.id, before, after, healed: after - before, maxHp: finish.maxHp, eliminated: member.eliminated, revived })
    }
    next.wins += won ? 1 : 0
    next.totalTurns += view.turn
    next.status = won ? 'between-rounds' : 'ended'
    next.endingReason = !won ? view.result.kind === 'draw' ? view.result.reason === 'turn-limit' ? 'turn-limit' : 'draw' : view.result.reason === 'forfeit' ? 'forfeit' : 'defeat' : null
    next.result = clone(view.result)
    next.recentRounds = [...next.recentRounds, { roundNumber: next.roundNumber, matchId: next.current.matchId, won, turns: view.turn, survivors: next.roster.filter(member => !member.eliminated).length }].slice(-HISTORY_LIMIT)
  }
  function mutate(operation) {
    ensureAlive()
    let candidate
    try {
      candidate = factory.restore(record.checkpoint)
      const response = operation(candidate)
      if (response?.accepted === false) { candidate.dispose(); return response }
      const next = clone(record)
      next.botCommands = driveSurvivalAI(candidate, { commandNumber: next.botCommands, ownTeam: next.current.opponentTeam })
      const view = checkView(candidate)
      settle(next, candidate, view)
      next.checkpoint = candidate.exportCheckpoint()
      if (next.checkpoint === record.checkpoint && next.status === record.status) { candidate.dispose(); interruption = null; return response }
      next.revision++
      commit(next, candidate)
      return response
    } catch (error) { if (candidate && candidate !== engine) candidate.dispose(); operationalFailure(error) }
  }

  let initialCandidate
  try {
    const roster = originalTeam.map((set, slot) => ({ id: `slot:${slot + 1}`, slot, hp: null, maxHp: null, eliminated: false }))
    const opponent = drawOpponent()
    const prepared = prepareBattle({ roster, leadId: `slot:${leadIndex + 1}`, opponent: opponent.team, matchId: initialMatchId, battleSeed: initialSeed, initial: true })
    initialCandidate = prepared.candidate
    const botCommands = driveSurvivalAI(initialCandidate, { ownTeam: opponent.team })
    const view = checkView(initialCandidate)
    for (const mapping of prepared.mapping) {
      const member = roster.find(member => member.id === mapping.id)
      const live = view.own.team.find(member => member.memberId === mapping.memberId)
      if (!live?.hp || !Number.isInteger(live.hp.current) || !Number.isInteger(live.hp.max) || live.hp.max < 1) throw new Error('Initial HP unavailable.')
      member.hp = live.hp.current; member.maxHp = live.hp.max
    }
    const initial = {
      schemaVersion: 1, id, rulesVersion: SURVIVAL_RULES_VERSION, aiVersion: SURVIVAL_AI_VERSION,
      profileId: factory.getProfile().id, engineIdentity: factory.getIdentity?.() ?? null, collection: opponent.collection,
      originalTeam, presetId, roster, revision: 1, roundNumber: 1, wins: 0, totalTurns: 0, status: 'active',
      current: { matchId: initialMatchId, seed: initialSeed, opponentTeam: opponent.team, mapping: prepared.mapping },
      checkpoint: initialCandidate.exportCheckpoint(), botCommands, pending: null, receipts: [], recentRounds: [], recovery: [], result: null, endingReason: null,
    }
    settle(initial, initialCandidate, view)
    commit(initial, initialCandidate)
  } catch (error) { initialCandidate?.dispose(); operationalFailure(error) }

  function summary() {
    ensureAlive()
    const view = engine.getPlayerView('p1')
    const roster = liveRoster(view)
    return {
      id: record.id, kind: 'survival', mode: 'survival', rulesVersion: record.rulesVersion, aiVersion: record.aiVersion,
      presetId: record.presetId, revision: record.revision, roundNumber: record.roundNumber, round: record.roundNumber,
      wins: record.wins, status: record.status, roster, survivors: roster.filter(member => !member.eliminated).length,
      recovery: clone(record.recovery), totalTurns: record.totalTurns + (record.status === 'active' ? view.turn : 0),
      result: clone(record.result), endingReason: record.endingReason, interruption: clone(interruption),
      pending: record.pending ? { operationId: record.pending.operationId, leadMemberId: record.pending.leadMemberId, expectedRevision: record.pending.expectedRevision, matchId: record.pending.fromMatchId } : null,
    }
  }
  function advance(command) {
    ensureAlive()
    if (!command || Object.keys(command).some(key => !['runId', 'matchId', 'revision', 'operationId', 'leadMemberId'].includes(key)) ||
        !validId(command.runId) || !validId(command.matchId) || !validId(command.operationId) || !/^slot:[1-6]$/.test(command.leadMemberId) || !Number.isSafeInteger(command.revision) || command.revision < 1) {
      fail('INVALID_ADVANCE', 'Send the current run, battle, revision, operation and available lead identities.', 400)
    }
    if (command.runId !== record.id) fail('RUN_CHANGED', 'This session has a different Survival run. Sync before continuing.')
    const commandDigest = digest([command.runId, command.matchId, command.revision, command.operationId, command.leadMemberId])
    const receipt = record.receipts.find(receipt => receipt.operationId === command.operationId)
    if (receipt) {
      if (receipt.digest !== commandDigest) fail('OPERATION_ID_REUSED', 'This operation was already used for a different request.')
      return { matchId: record.current.matchId, engine }
    }
    if (record.pending) {
      if (record.pending.operationId === command.operationId && record.pending.digest !== commandDigest) fail('OPERATION_ID_REUSED', 'This operation was already used for a different request.')
      if (record.pending.digest !== commandDigest) fail('RUN_CHANGED', 'The next round is already prepared. Sync and retry its pending operation.')
    } else {
      if (command.matchId !== record.current.matchId) fail('MATCH_CHANGED', 'This run now has a different battle. Sync before continuing.')
      if (command.revision !== record.revision) fail('RUN_CHANGED', 'This run changed. Sync before continuing.')
      if (record.status !== 'between-rounds') fail('ROUND_NOT_WON', 'Win the current round before continuing.')
      orderedMembers(record.roster, command.leadMemberId)
      try {
        const opponent = drawOpponent()
        const next = clone(record)
        next.pending = { operationId: command.operationId, digest: commandDigest, expectedRevision: command.revision, fromMatchId: command.matchId,
          leadMemberId: command.leadMemberId, matchId: randomUUID(), seed: seed(), opponentTeam: opponent.team, collection: opponent.collection }
        next.status = 'starting-next'
        next.revision++
        commit(next)
      } catch (error) { operationalFailure(error) }
    }
    let candidate
    try {
      const pending = record.pending
      const prepared = prepareBattle({ roster: record.roster, leadId: pending.leadMemberId, opponent: pending.opponentTeam, matchId: pending.matchId, battleSeed: pending.seed })
      candidate = prepared.candidate
      const botCommands = driveSurvivalAI(candidate, { ownTeam: pending.opponentTeam })
      const view = checkView(candidate)
      const next = clone(record)
      next.current = { matchId: pending.matchId, seed: pending.seed, opponentTeam: pending.opponentTeam, mapping: prepared.mapping }
      next.roundNumber++
      next.status = 'active'
      next.revision++
      next.collection = pending.collection
      next.checkpoint = candidate.exportCheckpoint()
      next.botCommands = botCommands
      next.receipts = [...next.receipts, { operationId: pending.operationId, digest: pending.digest }].slice(-RECEIPT_LIMIT)
      next.pending = null
      next.recovery = []
      next.result = null
      settle(next, candidate, view)
      commit(next, candidate)
      return { matchId: record.current.matchId, engine }
    } catch (error) { if (candidate && candidate !== engine) candidate.dispose(); operationalFailure(error) }
  }

  return Object.freeze({
    current() { ensureAlive(); return { matchId: record.current.matchId, engine } },
    summary, advance,
    submitDecision(command) { return mutate(candidate => candidate.submitDecision('p1', command)) },
    adjudicate(command) { return mutate(candidate => candidate.adjudicate(command)) },
    getPlayerView() { ensureAlive(); return engine.getPlayerView('p1') },
    getEvents(afterCursor = 0) { ensureAlive(); return engine.getEvents('p1', afterCursor) },
    exportRecord() { ensureAlive(); return clone(record) },
    dispose() { if (!disposed) { disposed = true; engine.dispose() } },
  })
}
