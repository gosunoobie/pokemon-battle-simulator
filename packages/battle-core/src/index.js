import { MOVE_RULES } from './moves.js'
export { MOVE_RULES }
const CONDITION_TEXT = Object.freeze({ paralysis: 'paralyzed', poison: 'poisoned', sleep: 'asleep', 'bad-poison': 'badly poisoned', burn: 'burned' })
const GUARD_TEXT = Object.freeze({ protected: 'is protected! Guard preview only.', lightScreen: 'put up Light Screen! Own-side protection preview only.', reflect: 'put up Reflect! Own-side protection preview only.' })
const WEATHER_TEXT = Object.freeze({ rain: 'Rain began to fall!', sun: 'The sunlight turned harsh!', sandstorm: 'A sandstorm kicked up!', hail: 'Hail began to fall!' })
const RESTRICTION_TEXT = Object.freeze({ disabled: 'has a move disabled', encored: 'received an encore', tormented: 'is tormented', imprisoning: 'sealed shared moves with Imprison', taunted: 'was taunted' })
const SUPPORT_TEXT = Object.freeze({ infatuated: 'became infatuated', wishPending: 'made a wish for later healing', safeguard: 'raised a Safeguard', magicCoat: 'put up a reflective Magic Coat', enduring: 'braced to endure', perishSong: 'heard the Perish Song', aimed: 'was marked for accurate aim', identified: 'was identified', seeded: 'was seeded', ingrained: 'put down roots', nightmare: 'was caught in a nightmare', grudge: 'bore a grudge', cursed: 'was cursed', destinyBond: 'prepared a Destiny Bond', drowsy: 'became drowsy', attention: 'became the center of attention' })
const SPORT_TEXT = Object.freeze({ mudSport: 'Mud Sport was scattered over the field', waterSport: 'Water Sport soaked the field' })
const BOOST_FIELDS = Object.freeze([
  ['attackStage', 'attackChange', 'Attack'],
  ['specialAttackStage', 'specialAttackChange', 'Special Attack'],
  ['specialDefenseStage', 'specialDefenseChange', 'Special Defense'],
  ['speedStage', 'speedChange', 'Speed'],
  ['evasionStage', 'evasionChange', 'Evasion'],
])

function freezeState(state) {
  return Object.freeze({ ...state, actors: Object.freeze(Object.fromEntries(
    Object.entries(state.actors).map(([id, actor]) => [id, Object.freeze({ ...actor })])
  )) })
}

/** Renderer-free state. Rules own fixed damage, level damage and explicit HP adjustments. */
export function createBattleState(actors = [
  { id: 'source', name: 'Charizard', hp: 156, maxHp: 156 },
  { id: 'target', name: 'Venusaur', hp: 160, maxHp: 160 },
]) {
  if (!actors.length || new Set(actors.map(a => a.id)).size !== actors.length) throw new Error('Actors need unique IDs.')
  for (const a of actors) {
    if (typeof a.id !== 'string' || !a.id || typeof a.name !== 'string' || !a.name || !Number.isFinite(a.maxHp) || a.maxHp <= 0 || !Number.isFinite(a.hp) || a.hp < 0 || a.hp > a.maxHp) throw new Error('Invalid actor health.')
    if (a.level != null && (!Number.isInteger(a.level) || a.level < 1 || a.level > 100)) throw new Error('Invalid actor level.')
    if (a.accuracyStage != null && (!Number.isInteger(a.accuracyStage) || a.accuracyStage < -6 || a.accuracyStage > 6)) throw new Error('Invalid accuracy stage.')
    if (a.defenseStage != null && (!Number.isInteger(a.defenseStage) || a.defenseStage < -6 || a.defenseStage > 6)) throw new Error('Invalid defense stage.')
    for (const [key] of BOOST_FIELDS) if (a[key] != null && (!Number.isInteger(a[key]) || a[key] < -6 || a[key] > 6)) throw new Error(`Invalid ${key}.`)
    if (a.trapped != null && typeof a.trapped !== 'boolean') throw new Error('Invalid trapping preview flag.')
    if (a.confused != null && typeof a.confused !== 'boolean') throw new Error('Invalid confusion preview flag.')
    if (a.focusEnergy != null && typeof a.focusEnergy !== 'boolean') throw new Error('Invalid Focus Energy flag.')
    for (const key of Object.keys(RESTRICTION_TEXT)) if (a[key] != null && typeof a[key] !== 'boolean') throw new Error('Invalid move restriction preview flag.')
    for (const key of Object.keys(SUPPORT_TEXT)) if (a[key] != null && typeof a[key] !== 'boolean') throw new Error('Invalid support preview flag.')
    if (a.heldItem != null && (typeof a.heldItem !== 'string' || !a.heldItem.trim())) throw new Error('Invalid held item label.')
    if (a.consumedItem != null && (typeof a.consumedItem !== 'string' || !a.consumedItem.trim())) throw new Error('Invalid consumed item label.')
    if (a.substituteHp != null && (!Number.isInteger(a.substituteHp) || a.substituteHp < 0 || a.substituteHp > a.maxHp)) throw new Error('Invalid substitute HP.')
    if (a.spikesLayers != null && (!Number.isInteger(a.spikesLayers) || a.spikesLayers < 0 || a.spikesLayers > 3)) throw new Error('Invalid Spikes layers.')
    for (const key of Object.keys(GUARD_TEXT)) if (a[key] != null && typeof a[key] !== 'boolean') throw new Error('Invalid protection flag.')
  }
  return freezeState({ revision: 0, weather: null, mudSport: false, waterSport: false, actors: Object.fromEntries(actors.map(a => [a.id, { ...a,
    level: a.level ?? 50, condition: a.condition ?? null, accuracyStage: a.accuracyStage ?? 0, defenseStage: a.defenseStage ?? 0,
    attackStage: a.attackStage ?? 0, specialAttackStage: a.specialAttackStage ?? 0, specialDefenseStage: a.specialDefenseStage ?? 0, speedStage: a.speedStage ?? 0, evasionStage: a.evasionStage ?? 0, focusEnergy: a.focusEnergy ?? false,
    trapped: a.trapped ?? false, confused: a.confused ?? false, protected: a.protected ?? false, lightScreen: a.lightScreen ?? false, reflect: a.reflect ?? false,
    ...Object.fromEntries(Object.keys(RESTRICTION_TEXT).map(key => [key, a[key] ?? false])),
    ...Object.fromEntries(Object.keys(SUPPORT_TEXT).map(key => [key, a[key] ?? false])), heldItem: a.heldItem ?? null,
    consumedItem: a.consumedItem ?? null, substituteHp: a.substituteHp ?? 0, spikesLayers: a.spikesLayers ?? 0,
  }])) })
}

/** Resolve exactly once; callers commit after independently of presentation. */
export function resolveMove(before, { moveId, sourceId, targetId, previousHit }) {
  const move = MOVE_RULES.find(m => m.id === moveId)
  if (!move) throw new Error(`Unknown battle move: ${moveId}`)
  const affectedId = move.target === 'self' ? sourceId : targetId
  const source = Object.hasOwn(before.actors, sourceId) ? before.actors[sourceId] : null
  if (move.target === 'field') {
    if (!source) throw new Error('Invalid move participants.')
    if (source.hp <= 0) throw new Error('A fainted actor cannot participate.')
    const listeners = Object.values(before.actors).filter(actor => actor.hp > 0)
    const failed = Boolean((move.perishSong && listeners.every(actor => actor.perishSong)) || (move.sportPreview && before[move.sportPreview]))
    const after = freezeState({ ...before, revision: before.revision + 1, ...(move.sportPreview ? { [move.sportPreview]: true } : move.perishSong
      ? { actors: { ...before.actors, ...Object.fromEntries(listeners.map(actor => [actor.id, { ...actor, perishSong: true }])) } }
      : { weather: move.weather }) })
    const id = `move-${after.revision}-${sourceId}-${moveId}`
    const event = Object.freeze({ id, moveId, sourceId, targetIds: Object.freeze([]), outcome: failed ? 'failed' : 'hit',
      usedMessage: `${source.name} used ${move.name}!`,
      resultMessage: move.sportPreview ? failed ? `${move.name} is already active in this preview.` : `${SPORT_TEXT[move.sportPreview]}! Power reduction and duration are not simulated.` : move.perishSong ? `${failed ? 'All active Pokémon already heard' : 'All active Pokémon heard'} Perish Song! Countdown and fainting are not simulated.` : `${WEATHER_TEXT[move.weather]} Weather preview only.`,
    })
    return Object.freeze({ id, before, after, event })
  }
  const target = Object.hasOwn(before.actors, affectedId) ? before.actors[affectedId] : null
  if (!source || !target || (sourceId === affectedId && move.target !== 'self')) throw new Error('Invalid move participants.')
  if (source.hp <= 0 || target.hp <= 0) throw new Error('A fainted actor cannot participate.')
  if (move.requiresTargetSleep && target.condition !== 'sleep') {
    const after = freezeState({ ...before, revision: before.revision + 1 })
    const id = `move-${after.revision}-${sourceId}-${moveId}`
    const event = Object.freeze({ id, moveId, sourceId, targetIds: Object.freeze([affectedId]), outcome: 'failed',
      beforeHp: target.hp, afterHp: target.hp, usedMessage: `${source.name} used ${move.name}!`,
      resultMessage: `${target.name} must be asleep for ${move.name}.`,
    })
    return Object.freeze({ id, before, after, event })
  }
  // Explicit Ghost-style Curse sample; no type-dependent variant or residual-turn engine.
  if (move.ghostCurse) {
    const failed = target.cursed, cost = Math.min(source.hp, Math.max(1, Math.floor(source.maxHp / 2)))
    const sourceHp = failed ? source.hp : source.hp - cost
    const after = freezeState({ ...before, revision: before.revision + 1, actors: failed ? before.actors : {
      ...before.actors, [sourceId]: { ...source, hp: sourceHp }, [affectedId]: { ...target, cursed: true },
    } })
    const id = `move-${after.revision}-${sourceId}-${moveId}`
    const event = Object.freeze({ id, moveId, sourceId, targetIds: Object.freeze([affectedId]), outcome: failed ? 'failed' : 'hit',
      beforeHp: target.hp, afterHp: target.hp, sourceBeforeHp: source.hp, sourceAfterHp: sourceHp,
      usedMessage: `${source.name} used ${move.name}!`,
      resultMessage: failed ? `${target.name} already has the Curse preview badge.`
        : `${source.name} spent ${cost} HP and cursed ${target.name}!${sourceHp === 0 ? ` ${source.name} fainted!` : ''} Recurring damage is not simulated.`,
    })
    return Object.freeze({ id, before, after, event })
  }
  // Bounded utility previews; no party, turn history, called moves or ability engine.
  if (move.previewOnly || move.substitute || move.recycle || move.spikes || move.copyStages) {
    let failed = false, resultMessage, changes = {}
    if (move.substitute) {
      const cost = Math.max(1, Math.floor(source.maxHp / 4))
      failed = source.hp <= cost || source.substituteHp > 0
      if (!failed) changes[sourceId] = { ...source, hp: source.hp - cost, substituteHp: cost }
      resultMessage = failed ? `${source.name} cannot create a substitute: insufficient HP or one already exists.` : `${source.name} spent ${cost} HP and created a substitute! Damage interception is not simulated.`
    } else if (move.recycle) {
      failed = Boolean(source.heldItem) || !source.consumedItem
      if (!failed) changes[sourceId] = { ...source, heldItem: source.consumedItem, consumedItem: null }
      resultMessage = failed ? `${source.name} has no recoverable consumed item or already holds an item.` : `${source.name} recovered its ${source.consumedItem}! Item effects are not simulated.`
    } else if (move.spikes) {
      failed = target.spikesLayers >= 3
      changes[affectedId] = { ...target, spikesLayers: Math.min(3, target.spikesLayers + 1) }
      resultMessage = failed ? 'Spikes already has three layers in this preview.' : `${target.name}’s side has ${target.spikesLayers + 1} layer(s) of Spikes! Switch-in damage is not simulated.`
    } else if (move.copyStages) {
      const keys = [...BOOST_FIELDS.map(([key]) => key), 'defenseStage', 'accuracyStage', 'focusEnergy']
      changes[sourceId] = { ...source, ...Object.fromEntries(keys.map(key => [key, target[key]])) }
      resultMessage = `${source.name} copied ${target.name}’s stat stages and focus! HP and conditions are unchanged.`
    } else {
      failed = Boolean(move.requiresSleep && source.condition !== 'sleep')
      resultMessage = failed ? `${source.name} must be asleep to use ${move.name}.` : `${source.name} ${move.previewOnly}`
    }
    const after = freezeState({ ...before, revision: before.revision + 1, actors: { ...before.actors, ...changes } })
    const id = `move-${after.revision}-${sourceId}-${moveId}`
    const event = Object.freeze({ id, moveId, sourceId, targetIds: Object.freeze([affectedId]), outcome: failed ? 'failed' : 'hit', beforeHp: target.hp, afterHp: after.actors[affectedId].hp,
      usedMessage: `${source.name} used ${move.name}!`, resultMessage })
    return Object.freeze({ id, before, after, event })
  }
  // Local preview outcomes; no item effects, delayed turns or defensive enforcement.
  if (move.healFraction || move.weatherHeal || move.bellyDrum || move.swapItems || move.supportPreview || (move.requiresSleep && source.condition !== 'sleep')) {
    let failed = false, resultMessage, changes = {}
    if (move.healFraction || move.weatherHeal) {
      const fraction = move.weatherHeal ? before.weather === 'sun' ? .667 : before.weather ? 1 / 4 : 1 / 2 : move.healFraction
      const amount = move.weatherHeal ? Math.floor((source.maxHp * Math.floor(fraction * 4096) + 2047) / 4096) : Math.round(source.maxHp * fraction)
      const healed = Math.min(source.maxHp - source.hp, Math.max(1, amount))
      failed = healed === 0; changes[sourceId] = { ...source, hp: source.hp + healed }
      resultMessage = failed ? `${source.name} already has full HP.` : `${source.name} restored ${healed} HP!`
    } else if (move.bellyDrum) {
      const cost = Math.max(1, Math.floor(source.maxHp / 2))
      failed = source.hp <= cost || source.attackStage === 6
      if (!failed) changes[sourceId] = { ...source, hp: source.hp - cost, attackStage: 6 }
      resultMessage = failed ? `${source.name} could not use Belly Drum: insufficient HP or Attack already maximized.` : `${source.name} spent ${cost} HP and maximized Attack! Stat preview only.`
    } else if (move.swapItems) {
      failed = !source.heldItem && !target.heldItem
      if (!failed) changes = { [sourceId]: { ...source, heldItem: target.heldItem }, [affectedId]: { ...target, heldItem: source.heldItem } }
      resultMessage = failed ? 'Trick failed: neither Pokémon holds an item.' : `${source.name} and ${target.name} exchanged held items! Item effects are not simulated.`
    } else if (move.supportPreview) {
      const key = move.supportPreview, hasCondition = move.requiresClearTargetCondition && target.condition !== null
      failed = Boolean(hasCondition || target[key])
      if (!failed) changes[affectedId] = { ...target, [key]: true }
      resultMessage = hasCondition ? `${target.name} already has a major condition; ${move.name} failed.`
        : failed ? `${target.name} already has the ${move.name} preview badge.` : `${target.name} ${SUPPORT_TEXT[key]}! Preview only.`
    } else {
      failed = true; resultMessage = `${source.name} must be asleep to use Snore.`
    }
    const after = freezeState({ ...before, revision: before.revision + 1, actors: { ...before.actors, ...changes } })
    const id = `move-${after.revision}-${sourceId}-${moveId}`
    const event = Object.freeze({ id, moveId, sourceId, targetIds: Object.freeze([affectedId]), outcome: failed ? 'failed' : 'hit',
      beforeHp: target.hp, afterHp: after.actors[affectedId].hp, usedMessage: `${source.name} used ${move.name}!`, resultMessage })
    return Object.freeze({ id, before, after, event })
  }
  // Illustrative badges only: the integrating game owns move history and restrictions.
  if (move.restrictionPreview) {
    const key = move.restrictionPreview, failed = target[key]
    const after = freezeState({ ...before, revision: before.revision + 1, actors: { ...before.actors, [affectedId]: { ...target, [key]: true } } })
    const id = `move-${after.revision}-${sourceId}-${moveId}`
    const event = Object.freeze({ id, moveId, sourceId, targetIds: Object.freeze([affectedId]), outcome: failed ? 'failed' : 'hit', beforeHp: target.hp, afterHp: target.hp,
      usedMessage: `${source.name} used ${move.name}!`,
      resultMessage: failed ? `${target.name} already has the ${move.name} preview badge.`
        : `${target.name} ${RESTRICTION_TEXT[key]}! Illustrative preview; move restrictions and duration are not simulated.`,
    })
    return Object.freeze({ id, before, after, event })
  }
  // Special HP previews are resolved atomically; an integrating game owns hit history.
  if (move.retaliates || move.splitsHp || move.endeavor) {
    let sourceHp = source.hp, targetHp = target.hp, failed = false, resultMessage
    if (move.retaliates) {
      const eligible = previousHit && previousHit.sourceId === affectedId && previousHit.targetId === sourceId
        && previousHit.category === move.retaliates && Number.isSafeInteger(previousHit.damage) && previousHit.damage > 0
      failed = !eligible
      if (eligible) targetHp = Math.max(0, target.hp - previousHit.damage * 2)
      resultMessage = eligible ? `${source.name} returned the ${move.retaliates} hit! ${target.name} took ${target.hp - targetHp} damage.`
        : `${move.name} failed: no matching ${move.retaliates} hit was supplied.`
    } else if (move.splitsHp) {
      const average = Math.max(1, Math.floor((source.hp + target.hp) / 2))
      sourceHp = Math.min(source.maxHp, average); targetHp = Math.min(target.maxHp, average)
      resultMessage = `${source.name} and ${target.name} shared their remaining HP! ${source.name}: ${sourceHp} HP; ${target.name}: ${targetHp} HP.`
    } else {
      failed = source.hp >= target.hp
      if (!failed) targetHp = source.hp
      resultMessage = failed ? `${move.name} failed: the user must have less HP than the target.`
        : `${target.name} took ${target.hp - targetHp} damage and now has ${targetHp} HP, matching ${source.name}.`
    }
    const after = freezeState({ ...before, revision: before.revision + 1, actors: { ...before.actors,
      [sourceId]: { ...source, hp: sourceHp }, [affectedId]: { ...target, hp: targetHp },
    } })
    const id = `move-${after.revision}-${sourceId}-${moveId}`
    const event = Object.freeze({ id, moveId, sourceId, targetIds: Object.freeze([affectedId]), outcome: failed ? 'failed' : 'hit',
      beforeHp: target.hp, afterHp: targetHp, sourceBeforeHp: source.hp, sourceAfterHp: sourceHp,
      ...(move.splitsHp ? { hpSplit: true } : {}), usedMessage: `${source.name} used ${move.name}!`, resultMessage,
    })
    return Object.freeze({ id, before, after, event })
  }
  const canCure = Boolean(move.cure && target.condition && (move.cure === 'all' || ['burn', 'poison', 'bad-poison', 'paralysis'].includes(target.condition)))
  const restFailed = move.rest && (source.hp === source.maxHp || source.condition === 'sleep')
  const knockedItem = move.knockOff ? target.heldItem : null
  const sourceBoosts = [
    ['attackStage', 'sourceAttackChange', 'Attack'], ['defenseStage', 'sourceDefenseChange', 'Defense'],
    ['specialAttackStage', 'sourceSpecialAttackChange', 'Special Attack'],
  ].filter(([, change]) => move[change]).map(([key, change, label]) => ({
    key, label, requested: move[change], before: source[key], after: Math.max(-6, Math.min(6, source[key] + move[change])),
  }))
  const sourceBoostMessage = sourceBoosts.map(b => `${b.label} ${b.after === b.before ? b.requested < 0 ? 'cannot fall further' : 'cannot rise further' : b.after < b.before ? b.after - b.before === -2 ? 'fell harshly' : 'fell' : 'rose'}`).join('; ')
  // A caller supplies the current-turn hit; no turn history or hit records are stored here.
  const revengeBoosted = Boolean(move.revengeBoost && previousHit && previousHit.sourceId === affectedId
    && previousHit.targetId === sourceId && previousHit.thisTurn === true && ['physical', 'special'].includes(previousHit.category)
    && Number.isSafeInteger(previousHit.damage) && previousHit.damage > 0)
  const hpBand = Math.max(1, Math.floor(source.hp * 48 / source.maxHp))
  const powerUsed = move.lowHpPower ? hpBand < 2 ? 200 : hpBand < 5 ? 150 : hpBand < 10 ? 100 : hpBand < 17 ? 80 : hpBand < 33 ? 40 : 20 : move.power
  const baseDamage = move.halfCurrentHp ? Math.max(1, Math.floor(target.hp / 2)) : move.lowHpPower ? Math.round(powerUsed * .7) : move.levelDamage ? source.level : move.damage
  const boostedDamage = (move.statusDamageBoost && ['burn', 'poison', 'bad-poison', 'paralysis'].includes(source.condition)) || (move.paralysisDamageBoost && target.condition === 'paralysis')
  // OHKO entries preview an already-successful hit; eligibility and accuracy belong to a full battle engine.
  const damage = move.ohko ? target.hp : baseDamage * (boostedDamage || revengeBoosted ? 2 : 1) * (knockedItem ? 1.5 : 1)
  const hp = move.rest && !restFailed ? source.maxHp : Math.max(Math.min(target.hp, move.minimumTargetHp ?? 0), target.hp - damage)
  const healing = move.drain ? Math.min(source.maxHp - source.hp, Math.round((target.hp - hp) * move.drain)) : 0
  const hasRecoil = Boolean(move.recoilMaxHp || move.recoilDamage)
  const recoilBase = move.recoilMaxHp ? source.maxHp * move.recoilMaxHp : (target.hp - hp) * (move.recoilDamage ?? 0)
  const recoil = hasRecoil && recoilBase > 0 ? Math.min(source.hp, Math.max(1, Math.round(recoilBase))) : 0
  const sourceHp = move.selfDestruct ? 0 : source.hp + healing - recoil
  const damageMessage = move.ohko ? `${target.name} was knocked out in one hit!`
    : `${move.effective ? 'It’s super effective! ' : ''}${target.name} took ${target.hp - hp} damage.`
  const conditionFailed = Boolean(move.requiresClearCondition && target.condition)
  const curedParalysis = move.cureParalysis && target.condition === 'paralysis' && hp > 0
  const inflictedCondition = move.conditionOnHit && hp > 0 && !target.condition ? move.conditionOnHit : null
  const condition = move.rest && !restFailed ? 'sleep' : canCure || curedParalysis ? null : conditionFailed ? target.condition : move.condition ?? inflictedCondition ?? target.condition
  const causedConfusion = move.confuses && hp > 0 && !target.confused
  const confusionFailed = move.confuses && move.damage === 0 && target.confused
  const previousAccuracy = target.accuracyStage ?? 0
  // Guaranteed damaging accuracy drops apply only to a surviving recipient; status-only rules stay independent.
  const accuracyDropOnHit = hp > 0 ? move.accuracyChangeOnHit ?? 0 : 0
  const accuracyStage = Math.max(-6, Math.min(6, previousAccuracy + (move.accuracyChange ?? accuracyDropOnHit)))
  const previousDefense = target.defenseStage ?? 0
  const defenseStage = Math.max(-6, Math.min(6, previousDefense + (move.defenseChange ?? 0)))
  // Defense boosts use cap/failure handling while Barrier retains its original standalone preview behavior.
  const boostFields = move.defenseChange && move.id !== 'barrier' ? [...BOOST_FIELDS, ['defenseStage', 'defenseChange', 'Defense']] : BOOST_FIELDS
  const boosts = boostFields.filter(([, change]) => move[change] && !(move.damage > 0 && hp === 0)).map(([key, change, label]) => ({
    key, label, requested: move[change], before: target[key] ?? 0, after: Math.max(-6, Math.min(6, (target[key] ?? 0) + move[change])),
  }))
  const boostsFailed = !move.selfDestruct && move.damage === 0 && boosts.length > 0 && boosts.every(b => b.after === b.before)
  const boostMessage = boosts.map(b => {
    const delta = b.after - b.before
    const description = delta === 0 ? (b.requested < 0 ? 'cannot fall further' : 'cannot rise further')
      : delta < 0 ? (delta === -2 ? 'fell harshly' : 'fell') : (delta >= 3 ? 'rose drastically' : delta === 2 ? 'rose sharply' : 'rose')
    return `${b.label} ${description}`
  }).join('; ')
  const trapFailed = move.trapPreview && target.trapped
  const focusFailed = move.focusEnergy && target.focusEnergy
  const brokeScreens = move.breakScreens && (target.lightScreen || target.reflect)
  const after = freezeState({ ...before, revision: before.revision + 1,
    actors: { ...before.actors, ...(move.drain || hasRecoil || move.selfDestruct || sourceBoosts.length ? { [sourceId]: { ...source, hp: sourceHp, ...Object.fromEntries(sourceBoosts.map(b => [b.key, b.after])) } } : {}), [affectedId]: { ...target, hp, condition, accuracyStage, defenseStage,
      ...(knockedItem ? { heldItem: null } : {}),
      ...(target.nightmare && condition !== 'sleep' ? { nightmare: false } : {}),
      ...Object.fromEntries(boosts.map(b => [b.key, b.after])), ...(move.focusEnergy ? { focusEnergy: true } : {}),
      ...(move.trapPreview ? { trapped: true } : {}),
      ...(causedConfusion ? { confused: true } : {}),
      ...(move.guard ? { [move.guard]: true } : {}), ...(move.breakScreens ? { lightScreen: false, reflect: false } : {}),
    } } })
  const id = `move-${after.revision}-${sourceId}-${moveId}`
  const event = Object.freeze({ id, moveId, sourceId, targetIds: Object.freeze([affectedId]),
    outcome: (move.failAtAccuracyFloor && accuracyStage === previousAccuracy) || restFailed || (move.cure && !canCure) || (boostsFailed && !causedConfusion) || focusFailed || trapFailed || conditionFailed || (confusionFailed && !boosts.some(b => b.after !== b.before)) ? 'failed' : 'hit', beforeHp: target.hp, afterHp: hp, condition, accuracyStage,
    ...(move.lowHpPower ? { powerUsed } : {}),
    ...(move.revengeBoost ? { revengeBoosted } : {}),
    ...(move.drain ? { healing, sourceBeforeHp: source.hp, sourceAfterHp: sourceHp, impactMessage: damageMessage } : {}),
    ...(hasRecoil ? { recoil, sourceBeforeHp: source.hp, sourceAfterHp: sourceHp } : {}),
    ...(move.selfDestruct ? { selfDestruct: true, sourceBeforeHp: source.hp, sourceAfterHp: sourceHp } : {}),
    usedMessage: `${source.name} used ${move.name}!`,
    resultMessage: boosts.length ? `${move.damage > 0 ? damageMessage + ' ' : ''}${target.name}’s ${boostMessage}!${move.selfDestruct ? ` ${source.name} fainted!` : ' Stat preview only.'}${move.confuses ? causedConfusion ? ` ${target.name} became confused!` : ` ${target.name} is already confused.` : ''}`
      : move.focusEnergy ? focusFailed ? `${source.name} is already focused! Focus Energy does not stack.`
      : `${source.name} is getting pumped! Critical-hit ratio +2; critical hits are not rolled in this preview.`
      : move.rest ? restFailed
      ? `${source.name} could not use Rest: ${source.condition === 'sleep' ? 'already asleep' : 'HP is already full'}.`
      : `${source.name} restored ${hp - source.hp} HP and fell asleep! Sleep turns are not simulated.`
      : move.cure ? canCure ? `${source.name}’s status condition was cured!${move.cure === 'all' ? ' User-only preview; party healing is not simulated.' : ''}`
      : `${source.name} has no condition ${move.name} can cure.`
      : conditionFailed ? `${target.name} already has a status condition; ${move.name} failed.`
      : move.condition ? `${target.name} is ${CONDITION_TEXT[move.condition]}! Status preview only.`
      : move.confuses && move.damage === 0 ? confusionFailed ? `${target.name} is already confused!`
      : `${target.name} became confused! Confusion preview only; no HP damage.`
      : move.defenseChange ? `${target.name}’s Defense ${defenseStage === previousDefense ? 'cannot rise further' : defenseStage - previousDefense === 2 ? 'rose sharply' : 'rose'}! Stat preview only.`
      : move.guard ? `${target.name} ${GUARD_TEXT[move.guard]}`
      : move.accuracyChange ? `${target.name}’s accuracy ${accuracyStage < previousAccuracy ? 'fell' : 'cannot fall further'}! Stat preview only.`
      : move.trapPreview ? `${target.name} ${trapFailed ? 'is already marked as trapped' : move.id === 'mean-look' ? 'was caught in Mean Look' : `was caught by ${move.name}`}! Trapping preview only; switching is not simulated.`
      : move.switchPreview ? `${target.name} was buffeted by Whirlwind! No HP damage; switching is not simulated.`
      : move.drain ? `${damageMessage} ${source.name} restored ${healing} HP.`
      : move.selfDestruct ? `${damageMessage} ${source.name} fainted!`
      : hasRecoil ? `${damageMessage} ${source.name} took ${recoil} recoil damage.`
      : `${damageMessage}${accuracyDropOnHit ? ` ${target.name}’s accuracy ${accuracyStage < previousAccuracy ? 'fell' : 'cannot fall further'}!` : ''}${sourceBoosts.length ? ` ${source.name}’s ${sourceBoostMessage}!` : ''}${move.minimumTargetHp && hp <= move.minimumTargetHp ? ` ${target.name} held on!` : ''}${move.lowHpPower ? ` Remaining-HP power: ${powerUsed}; demo damage uses 70% of power.` : ''}${revengeBoosted ? ' Revenge was boosted by the supplied hit this turn!' : ''}${knockedItem ? ` ${target.name} lost its ${knockedItem}!` : ''}${boostedDamage ? ' Condition-boosted preview.' : ''}${curedParalysis ? ` ${target.name} was cured of paralysis!` : ''}${inflictedCondition ? ` ${target.name} is ${CONDITION_TEXT[inflictedCondition]}!` : ''}${brokeScreens ? ' The target’s screens were broken!' : ''}${causedConfusion ? ` ${target.name} became confused! Confusion preview only.` : ''}`,
  })
  return Object.freeze({ id, before, after, event })
}
