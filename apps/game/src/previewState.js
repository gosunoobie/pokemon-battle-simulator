import { createBattleState, resolveMove } from '@battle/battle-core'

// Actor IDs identify fixed field positions, never who must attack.
export function createPreviewState(move, { sourceId = 'source', targetId, actors } = {}) {
  const state = createBattleState(actors)
  if (!Object.hasOwn(state.actors, sourceId)) throw new Error('Unknown preview attacker.')
  if (move?.minimumTargetHp || move?.lowHpPower || move?.revengeBoost) {
    const recipient = targetId ?? Object.keys(state.actors).find(id => id !== sourceId)
    return createBattleState(Object.values(state.actors).map(actor => actor.hp <= 0 ? actor : {
      ...actor,
      ...(actor.id === recipient && move.minimumTargetHp ? { hp: Math.min(actor.hp, 18) } : {}),
      ...(actor.id === sourceId && move.lowHpPower ? { hp: Math.min(actor.hp, Math.max(1, Math.floor(actor.maxHp * .1))) } : {}),
      ...(actor.id === sourceId && move.revengeBoost ? { hp: Math.min(actor.hp, Math.max(1, actor.hp - 32)) } : {}),
    }))
  }
  if (move?.requiresTargetSleep) {
    const recipient = targetId ?? Object.keys(state.actors).find(id => id !== sourceId)
    return createBattleState(Object.values(state.actors).map(actor => actor.hp <= 0 ? actor : {
      ...actor,
      ...(actor.id === recipient ? { condition: actor.condition ?? 'sleep' } : {}),
      ...(actor.id === sourceId && move.drain ? { hp: Math.min(actor.hp, Math.max(1, Math.floor(actor.maxHp * .65))) } : {}),
    }))
  }
  if (move?.recycle || move?.copyStages || move?.knockOff) {
    const recipient = targetId ?? Object.keys(state.actors).find(id => id !== sourceId)
    return createBattleState(Object.values(state.actors).map(actor => actor.hp <= 0 ? actor : {
      ...actor,
      ...(actor.id === sourceId && move.recycle ? { heldItem: null, consumedItem: 'Oran Berry' } : {}),
      ...(actor.id === recipient && move.knockOff ? { heldItem: actor.heldItem ?? 'Oran Berry' } : {}),
      ...(actor.id === recipient && move.copyStages ? { attackStage: 2, defenseStage: 1, specialAttackStage: 3, specialDefenseStage: -1, speedStage: 1, accuracyStage: 2, evasionStage: -1, focusEnergy: true } : {}),
    }))
  }
  if (move?.statusDamageBoost || move?.paralysisDamageBoost) {
    const recipient = targetId ?? Object.keys(state.actors).find(id => id !== sourceId)
    return createBattleState(Object.values(state.actors).map(actor => actor.hp <= 0 ? actor : {
      ...actor, ...(actor.id === sourceId && move.statusDamageBoost ? { condition: 'burn' } : {}),
      ...(actor.id === recipient && move.paralysisDamageBoost ? { condition: 'paralysis' } : {}),
    }))
  }
  if (move?.healFraction || move?.weatherHeal || move?.requiresSleep || move?.swapItems) {
    return createBattleState(Object.values(state.actors).map(actor => actor.hp <= 0 ? actor : {
      ...actor,
      ...(actor.id === sourceId && (move.healFraction || move.weatherHeal) ? { hp: Math.max(1, Math.floor(actor.maxHp * .4)) } : {}),
      ...(actor.id === sourceId && move.requiresSleep ? { condition: 'sleep' } : {}),
      ...(move.swapItems ? { heldItem: actor.id === sourceId ? 'Oran Berry' : 'Sitrus Berry' } : {}),
    }))
  }
  const condition = ({ refresh: 'poison', 'heal-bell': 'paralysis', aromatherapy: 'burn', rest: 'poison' })[move?.id]
  if (move?.retaliates || move?.splitsHp || move?.endeavor) {
    return createBattleState(Object.values(state.actors).map(actor => actor.id === sourceId && actor.hp > 0
      ? { ...actor, hp: move.retaliates ? Math.max(1, actor.hp - (move.retaliates === 'physical' ? 32 : 36))
        : Math.max(1, Math.floor(actor.maxHp * (move.splitsHp ? .4 : .35))) } : actor))
  }
  if (!move?.drain && !condition) return state
  return createBattleState(Object.values(state.actors).map(actor => actor.id === sourceId
    ? { ...actor, hp: move.rest ? Math.max(1, Math.floor(actor.maxHp * .45)) : move.drain ? Math.max(1, Math.floor(actor.maxHp * .65)) : actor.hp,
      condition: condition ?? actor.condition }
    : actor))
}

// A fresh single-move preview, without turns, AI or an opponent battle engine.
// An integrating game may supply its own generation-specific allowedMoveIds.
export function createPreviewTransaction(move, { sourceId = 'source', targetId = 'target', actors, allowedMoveIds, phase = 'attack' } = {}) {
  if (allowedMoveIds != null && !allowedMoveIds.includes(move.id)) throw new Error('Move is not available to this preview attacker.')
  if (!['prepare', 'attack'].includes(phase) || (phase === 'prepare' && !move.preparation)) throw new Error('Unsupported preview phase.')
  const before = createPreviewState(move, { sourceId, targetId, actors })
  if (phase === 'prepare') {
    const source = before.actors[sourceId]
    if (source.hp <= 0) throw new Error('A fainted actor cannot participate.')
    const id = `prepare-${sourceId}-${move.id}`
    const event = Object.freeze({ id, moveId: move.id, sourceId, targetIds: Object.freeze([]), phase, outcome: 'hit',
      usedMessage: `${source.name} is preparing ${move.name}!`,
      resultMessage: `${source.name} ${move.preparation.result} Round 1 preview complete; choose Round 2 to attack.`,
    })
    return Object.freeze({ id, before, after: before, event })
  }
  const previousHit = move.revengeBoost ? { sourceId: targetId, targetId: sourceId, category: 'physical', damage: 32, thisTurn: true } : move.retaliates ? { sourceId: targetId, targetId: sourceId, category: move.retaliates, damage: move.retaliates === 'physical' ? 32 : 36 } : undefined
  return resolveMove(before, { moveId: move.id, sourceId, targetId, previousHit })
}
