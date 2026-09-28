import { getForm, getMove, getSpecies, getType } from '@battle/game-data'

export const SURVIVAL_AI_VERSION = 'gen3-survival-ai-v1'
const id = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const species = value => getSpecies(id(value)) ?? getForm(id(value))
const ratio = member => member?.hp?.max ? member.hp.current / member.hp.max : 1
const recovery = new Set(['recover', 'softboiled', 'milkdrink', 'slackoff', 'moonlight', 'morningsun', 'synthesis'])
const physicalTypes = new Set(['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel'])
const setup = {
  swordsdance: ['atk'], howl: ['atk'], meditate: ['atk'], dragondance: ['atk', 'spe'], bulkup: ['atk', 'def'],
  calmmind: ['spa', 'spd'], growth: ['spa'], amnesia: ['spd'], barrier: ['def'], irondefense: ['def'],
  acidarmor: ['def'], defensecurl: ['def'], harden: ['def'], withdraw: ['def'], agility: ['spe'],
  doubleteam: ['evasion'], minimize: ['evasion'],
}
const hiddenPowerTypes = ['fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark']

function hiddenPower(set) {
  const values = ['hp', 'atk', 'def', 'spe', 'spa', 'spd'].map(stat => set?.ivs?.[stat] ?? 31)
  const bits = values.reduce((total, value, index) => total + (value & 1) * 2 ** index, 0)
  const power = values.reduce((total, value, index) => total + ((value >> 1) & 1) * 2 ** index, 0)
  return { type: hiddenPowerTypes[Math.floor(bits * 15 / 63)], power: Math.floor(power * 40 / 63) + 30 }
}

function effectiveness(type, foe, moveId) {
  if (moveId === 'struggle') return 1
  const types = species(foe?.species)?.types ?? []
  let value = types.reduce((result, target) => result * (getType(target)?.damageTaken[type] ?? 1), 1)
  const ability = id(foe?.ability)
  if ((type === 'ground' && ability === 'levitate') || (type === 'fire' && ability === 'flashfire') ||
      (type === 'water' && ability === 'waterabsorb') || (type === 'electric' && ability === 'voltabsorb')) value = 0
  if (ability === 'wonderguard' && value <= 1) value = 0
  return value
}

function fixedPower(move, own, foe) {
  const hp = ratio(own)
  if (['seismictoss', 'nightshade'].includes(move.id)) return 100
  if (move.id === 'dragonrage') return 40
  if (move.id === 'sonicboom') return 20
  if (move.id === 'superfang') return ratio(foe) > .4 ? 105 : 25
  if (move.id === 'psywave') return 100
  if (['counter', 'mirrorcoat'].includes(move.id)) {
    const last = getMove(id(foe?.moves?.at(-1)))
    const foeStats = species(foe?.species)?.baseStats
    const physical = last && last.category !== 'Status' ? last.category === 'Physical' : (foeStats?.atk ?? 80) >= (foeStats?.spa ?? 80)
    return (move.id === 'counter') === physical ? 110 : 35
  }
  if (['return', 'frustration'].includes(move.id)) return 102
  if (['eruption', 'waterspout'].includes(move.id)) return Math.max(1, 150 * hp)
  if (['flail', 'reversal'].includes(move.id)) return hp < .04 ? 200 : hp < .1 ? 150 : hp < .2 ? 100 : hp < .35 ? 80 : hp < .7 ? 40 : 20
  if (move.id === 'lowkick') {
    const weight = species(foe?.species)?.weightkg ?? 50
    return weight >= 200 ? 120 : weight >= 100 ? 100 : weight >= 50 ? 80 : weight >= 25 ? 60 : weight >= 10 ? 40 : 20
  }
  if (move.id === 'magnitude') return 71
  if (['guillotine', 'fissure', 'horndrill', 'sheercold'].includes(move.id)) return 200
  return move.basePower || 40
}

function statusScore(move, own, foe, view) {
  const hp = ratio(own)
  const ownVolatiles = (own?.volatiles ?? []).map(id)
  const foeVolatiles = (foe?.volatiles ?? []).map(id)
  if (recovery.has(move.id)) return hp <= .5 ? 170 : hp < .75 ? 45 : -90
  if (move.id === 'rest') return own?.condition === 'slp' ? -100 : hp < .45 ? 160 : hp < .7 && own?.condition ? 100 : -90
  if (move.id === 'wish') return hp < .65 && !ownVolatiles.includes('wish') ? 100 : -40
  if (move.id === 'transform') return own?.transformedInto ? -100 : 120
  if (move.id === 'sleeptalk') return own?.condition === 'slp' ? 120 : -100
  if (['toxic', 'poisonpowder', 'poisongas', 'willowisp', 'thunderwave', 'stunspore', 'glare', 'spore', 'sleeppowder', 'hypnosis', 'sing', 'grasswhistle', 'lovelykiss', 'yawn'].includes(move.id)) {
    if (foe?.condition) return -100
    const types = species(foe?.species)?.types ?? []
    const poison = ['toxic', 'poisonpowder', 'poisongas'].includes(move.id)
    if ((poison && (types.includes('poison') || types.includes('steel') || id(foe?.ability) === 'immunity')) ||
        (move.id === 'willowisp' && (types.includes('fire') || id(foe?.ability) === 'waterveil')) ||
        (move.id === 'thunderwave' && types.includes('ground'))) return -100
    const sleeping = ['spore', 'sleeppowder', 'hypnosis', 'sing', 'grasswhistle', 'lovelykiss', 'yawn'].includes(move.id)
    if (move.id === 'yawn' && foeVolatiles.includes('yawn')) return -100
    if (sleeping && ['insomnia', 'vitalspirit'].includes(id(foe?.ability))) return -100
    // Prefer a damaging action once sleep has already constrained a publicly
    // known opponent; this is a policy choice, not a new format clause.
    if (sleeping && view.opponent.known.some(member => member.memberId !== foe?.memberId && !member.fainted && member.condition === 'slp')) return -80
    return (sleeping ? 110 : 85) * (move.accuracy === true ? 1 : move.accuracy / 100)
  }
  if (setup[move.id]) {
    const stages = setup[move.id].map(stat => own?.stages?.[stat] ?? 0)
    return hp > .55 && stages.some(stage => stage < 2) ? 82 : -70
  }
  if (move.id === 'destinybond') return hp < .25 && !ownVolatiles.includes('destinybond') ? 135 : 12
  if (move.id === 'encore') return getMove(id(foe?.moves?.at(-1)))?.category === 'Status' && !foeVolatiles.includes('encore') ? 95 : -40
  if (move.id === 'spikes') return (view.sideConditions?.[view.seat === 'p1' ? 'p2' : 'p1'] ?? []).map(id).includes('spikes') ? -65 : 70
  if (['reflect', 'lightscreen'].includes(move.id)) return (view.sideConditions?.[view.seat] ?? []).map(id).includes(move.id) ? -65 : 70
  if (['healbell', 'aromatherapy'].includes(move.id)) return view.own.team.some(member => !member.fainted && member.condition) ? 95 : -80
  if (move.id === 'refresh') return own?.condition ? 100 : -90
  if (['haze', 'psychup'].includes(move.id)) return Object.values(foe?.stages ?? {}).some(value => value > 1) ? 100 : -60
  if (['confuseray', 'supersonic', 'swagger', 'flatter'].includes(move.id)) return foeVolatiles.includes('confusion') ? -70 : 55
  if (['splash', 'teleport', 'celebrate', 'sketch'].includes(move.id)) return -150
  if (['protect', 'detect', 'endure'].includes(move.id)) return -30
  if (['metronome', 'assist', 'naturepower'].includes(move.id)) return 40
  return 5
}

function moveScore(option, own, foe, view, ownSet) {
  const move = getMove(id(option.id).replace(/^hiddenpower.+/, 'hiddenpower')) ?? getMove(id(option.name).replace(/^hiddenpower.+/, 'hiddenpower'))
  if (!move) return 1
  if (move.category === 'Status') return statusScore(move, own, foe, view)
  if ((move.id === 'dreameater' && foe?.condition !== 'slp') || (move.id === 'snore' && own?.condition !== 'slp') ||
      (move.id === 'fakeout' && view.turn > 1)) return -120
  const hp = move.id === 'hiddenpower' ? hiddenPower(ownSet) : null
  const type = hp?.type ?? move.type
  const multiplier = effectiveness(type, foe, move.id)
  if (!multiplier) return -300
  const physical = hp ? physicalTypes.has(type) : move.category === 'Physical'
  const ownSpecies = species(own?.species)
  const foeSpecies = species(foe?.species)
  const attack = own?.stats?.[physical ? 'atk' : 'spa'] ?? ownSpecies?.baseStats?.[physical ? 'atk' : 'spa'] ?? 80
  const defense = foeSpecies?.baseStats?.[physical ? 'def' : 'spd'] ?? 80
  const stage = own?.stages?.[physical ? 'atk' : 'spa'] ?? 0
  const stageMultiplier = stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage)
  const stab = ownSpecies?.types?.includes(type) ? 1.5 : 1
  const accuracy = move.accuracy === true ? 1 : (move.accuracy ?? 100) / 100
  let score = (hp?.power ?? fixedPower(move, own, foe)) * multiplier * stab * accuracy * Math.min(2, Math.max(.5, attack / Math.max(1, defense))) * stageMultiplier
  if (physical && own?.condition === 'brn' && id(own?.ability) !== 'guts') score *= .5
  if (['explosion', 'selfdestruct'].includes(move.id)) score *= ratio(own) < .25 ? 1 : .55
  if (['gigadrain', 'megadrain', 'absorb', 'leechlife', 'dreameater'].includes(move.id) && ratio(own) < .6) score *= 1.25
  if (move.id === 'falseswipe' && ratio(foe) < .2) score *= .1
  return score
}

/** Rank only engine-provided legal actions. The policy sees its own private
 * view/set and already-public foe facts; it never receives the player's team. */
export function rankSurvivalActions(view, { ownTeam = [] } = {}) {
  const decision = view.decision
  if (!decision || ['wait', 'finished'].includes(decision.kind)) return []
  const own = view.own.team.find(member => member.memberId === view.own.active)
  const foe = view.opponent.known.find(member => member.memberId === view.opponent.active)
  const ownIndex = Number(own?.memberId?.split(':')[1]) - 1
  const moves = decision.moves.filter(move => !move.disabled && (move.pp === null || move.pp > 0)).map(move => ({
    action: { kind: 'move', slot: move.slot }, score: moveScore(move, own, foe, view, ownTeam[ownIndex]),
  }))
  const switches = decision.switches.map(member => {
    const candidate = view.own.team.find(pokemon => pokemon.memberId === member.memberId)
    const target = species(foe?.species)
    const defensive = (target?.types ?? []).reduce((worst, type) => Math.max(worst, effectiveness(type, candidate)), 0)
    const offensive = (species(candidate?.species)?.types ?? []).reduce((best, type) => Math.max(best, effectiveness(type, foe)), 0)
    return { action: { kind: 'switch', memberId: member.memberId }, score: (decision.kind === 'switch' ? 0 : -60) + ratio(candidate) * 12 + offensive * 3 - defensive * 3 }
  })
  // Stable input order breaks ties, without advancing battle mechanics RNG.
  return [...moves, ...switches].map((entry, index) => ({ ...entry, index }))
    .sort((left, right) => right.score - left.score || left.index - right.index).map(entry => entry.action)
}

/** Bounded automation; the caller owns a candidate engine and atomic commit. */
export function driveSurvivalAI(engine, { commandNumber = 0, ownTeam = [], maxSteps = 64 } = {}) {
  const attempted = new Set()
  for (let step = 0; step < maxSteps; step++) {
    const player = engine.getDecision('p1')
    const decision = engine.getDecision('p2')
    if (player.kind === 'finished' || decision.kind === 'finished' || decision.kind === 'wait' || (decision.kind !== 'switch' && player.kind !== 'wait')) return commandNumber
    const view = engine.getPlayerView('p2')
    const action = rankSurvivalActions(view, { ownTeam }).find(candidate => !attempted.has(`${decision.id}:${JSON.stringify(candidate)}`))
    if (!action) throw new Error('Survival AI has no usable legal action.')
    attempted.add(`${decision.id}:${JSON.stringify(action)}`)
    const ack = engine.submitDecision('p2', { commandId: `survival-ai-${++commandNumber}`, decisionId: decision.id, action })
    if (!engine.getPlayerView('p1').complete || !engine.getPlayerView('p2').complete) throw new Error('Survival projection is incomplete.')
    if (!ack.accepted && !['ILLEGAL_ACTION', 'INVALID_ACTION'].includes(ack.code)) throw new Error('Survival AI decision could not be admitted.')
  }
  throw new Error('Survival AI exceeded the decision limit.')
}
