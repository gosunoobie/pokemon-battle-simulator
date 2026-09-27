import { GEN3, getLearnset } from '@battle/game-data'

export const VERSION = 'gen3-starters-v1'
export const POLICY_VERSION = 1
export const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
export const id = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
export const stats = value => Object.fromEntries(STATS.map(stat => [stat, value]))

// These species cannot provide four distinct useful starting moves in Gen 3.
// Keep them in the equal-species pool; document their limitations instead of
// fabricating a fourth move or pretending that a weak species is competitive.
export const LOW_MOVE_EXCEPTIONS = Object.freeze({
  caterpie: 'Tackle and String Shot are its complete usable Gen 3 learnset.',
  metapod: 'Tackle, String Shot and Harden include its pre-evolution moves.',
  weedle: 'Poison Sting and String Shot are its complete Gen 3 learnset.',
  kakuna: 'Poison Sting, String Shot and Harden include its pre-evolution moves.',
  magikarp: 'Tackle and Flail are its only attacks; Splash adds no utility.',
  ditto: 'Transform is its only move. Defensive investment supports surviving the transformation.',
  unown: 'Hidden Power is its only move; its IVs preserve the selected type and 70 power.',
  wurmple: 'Tackle, Poison Sting and String Shot exhaust its useful move choices.',
  silcoon: 'Its three Wurmple moves and Harden are the limited evolution-line movepool.',
  cascoon: 'Its three Wurmple moves and Harden are the limited evolution-line movepool.',
  beldum: 'Take Down is its only obtainable Gen 3 move.',
})

// Narrow project-authored exceptions for unusual mechanics/limited movepools.
// They are still admitted by the real whole-team validator, never exempted.
export const OVERRIDES = Object.freeze({
  caterpie: { moves: ['Tackle', 'String Shot'], role: 'limited physical attacker' },
  metapod: { moves: ['Tackle', 'String Shot', 'Harden'], role: 'limited physical attacker' },
  weedle: { moves: ['Poison Sting', 'String Shot'], role: 'limited physical attacker' },
  kakuna: { moves: ['Poison Sting', 'String Shot', 'Harden'], role: 'limited physical attacker' },
  magikarp: { moves: ['Flail', 'Tackle'], item: 'Salac Berry', role: 'limited physical attacker' },
  ditto: { moves: ['Transform'], item: 'Metal Powder', role: 'transform support', nature: 'Bold', evs: { hp: 252, def: 252, spd: 4 } },
  unown: { moves: ['Hidden Power'], role: 'special attacker', item: 'Twisted Spoon', nature: 'Modest',
    // Pinned Psychic HPivs: Attack and Speed even; retain second-lowest bits.
    ivs: { hp: 31, atk: 2, def: 31, spa: 31, spd: 31, spe: 30 } },
  wobbuffet: { moves: ['Counter', 'Mirror Coat', 'Encore', 'Destiny Bond'], role: 'counter support', nature: 'Bold', evs: { hp: 252, def: 128, spd: 128 } },
  wynaut: { moves: ['Counter', 'Mirror Coat', 'Encore', 'Destiny Bond'], role: 'counter support', nature: 'Bold', evs: { hp: 252, def: 128, spd: 128 } },
  smeargle: { moves: ['Spore', 'Spikes', 'Substitute', 'Baton Pass'], role: 'support', nature: 'Jolly', evs: { hp: 252, def: 4, spe: 252 } },
  wurmple: { moves: ['Tackle', 'Poison Sting', 'String Shot'], role: 'limited physical attacker' },
  silcoon: { moves: ['Tackle', 'Poison Sting', 'String Shot', 'Harden'], role: 'limited physical attacker' },
  cascoon: { moves: ['Tackle', 'Poison Sting', 'String Shot', 'Harden'], role: 'limited physical attacker' },
  beldum: { moves: ['Take Down'], role: 'limited physical attacker' },
  chansey: { moves: ['Seismic Toss', 'Soft-Boiled', 'Thunder Wave', 'Ice Beam'], role: 'bulky support', nature: 'Bold', evs: { hp: 252, def: 252, spd: 4 } },
  clamperl: { moves: ['Surf', 'Ice Beam', 'Toxic', 'Protect'], item: 'Deep Sea Tooth', role: 'special attacker' },
  cubone: { moves: ['Earthquake', 'Rock Slide', 'Swords Dance', 'Double-Edge'], item: 'Thick Club', role: 'physical attacker' },
  marill: { moves: ['Return', 'Surf', 'Substitute', 'Encore'], ability: 'Huge Power', role: 'mixed attacker' },
  azurill: { moves: ['Return', 'Substitute', 'Encore', 'Toxic'], ability: 'Huge Power', role: 'physical attacker' },
})

const RECOVERY = new Set(['recover', 'softboiled', 'milkdrink', 'slackoff', 'synthesis', 'moonlight', 'morningsun'])
const FIXED = new Set(['counter', 'mirrorcoat', 'seismictoss', 'nightshade', 'superfang', 'endeavor'])
const PHYSICAL_SETUP = new Set(['swordsdance', 'bulkup', 'dragondance', 'bellydrum', 'howl', 'meditate'])
const SPECIAL_SETUP = new Set(['calmmind', 'tailglow', 'growth'])
const PASSIVE_PLAN = new Set(['toxic', 'leechseed', 'spikes', 'perishsong', 'spore', 'batonpass', 'transform', 'counter', 'mirrorcoat'])
const DAMAGE_DEPENDENCIES = new Set(['focuspunch', 'dreameater', 'snore', 'spitup', 'solarbeam', 'doomdesire', 'futuresight'])
const SKIP_ATTACKS = new Set(['explosion', 'selfdestruct', 'hyperbeam', 'blastburn', 'hydrocannon', 'frenzyplant', 'recharge',
  'struggle', 'bide', 'razorwind', 'skullbash', 'skyattack', 'fissure', 'horndrill', 'guillotine', 'sheercold',
  'frustration', 'present', 'magnitude', 'rollout', 'iceball', 'outrage', 'petaldance', 'thrash', 'furycutter', 'rage'])

export function movesFor(set, adapter) { return set.moves.map(move => adapter.move(move, set.ivs)) }
export function offensiveCounts(set, adapter) {
  const moves = movesFor(set, adapter)
  const physical = moves.filter(move => move.category === 'Physical' && !FIXED.has(move.id)).length
  const special = moves.filter(move => move.category === 'Special' && !FIXED.has(move.id)).length
  return { physical, special, status: moves.filter(move => move.category === 'Status').length }
}

/** Project settings derived from Gen 3 damage categories, never modern ones. */
export function applyRoleSettings(set, species, adapter, preferredRole = '') {
  const { physical, special, status } = offensiveCounts(set, adapter)
  const moveIds = set.moves.map(id)
  const role = preferredRole || (status >= 3 ? 'support' : physical && special ? 'mixed attacker' : physical ? 'physical attacker' : special ? 'special attacker' : 'support')
  const bulky = /support|bulky|staller/i.test(role) || (status >= 2 && species.baseStats.spe < 70 && moveIds.some(move => RECOVERY.has(move)))
  const speed = species.baseStats.spe >= 85 && !bulky
  let nature
  const evs = stats(0)
  if (species.id === 'shedinja') {
    nature = 'Adamant'; evs.atk = 252; evs.spe = 252; evs.spd = 4
  } else if (/counter|transform/.test(role)) {
    nature = 'Bold'; evs.hp = 252; evs.def = 128; evs.spd = 128
  } else if (status >= 3 && /support|bulky|staller/i.test(role)) {
    nature = physical ? 'Impish' : 'Bold'; evs.hp = 252; evs.def = 252; evs.spd = 4
  } else if (physical && special) {
    // Keep both attacks usable. The higher attacking base stat gets priority;
    // Hasty/Rash/Mild never lower either offense.
    const main = species.baseStats.atk >= species.baseStats.spa ? 'atk' : 'spa'
    const secondary = main === 'atk' ? 'spa' : 'atk'
    nature = speed ? 'Hasty' : main === 'atk' ? 'Lonely' : 'Mild'
    evs[main] = 252; evs[secondary] = 128; evs[bulky ? 'hp' : 'spe'] = 128
  } else {
    const main = physical ? 'atk' : 'spa'
    nature = physical ? (speed ? 'Jolly' : 'Adamant') : (speed ? 'Timid' : 'Modest')
    evs[main] = 252; evs[bulky || species.baseStats.spe < 60 ? 'hp' : 'spe'] = 252; evs.spd = 4
  }
  set.nature = nature
  set.evs = evs
  // Preserve Hidden Power's two lowest IV bits; do not independently randomize
  // IVs. Transform must retain Attack for the copied physical moves.
  if (!physical && !moveIds.includes('transform') && !moveIds.some(move => move.startsWith('hiddenpower'))) set.ivs.atk = 0
  if (physical && !moveIds.some(move => move.startsWith('hiddenpower'))) set.ivs.atk = 31
  if (moveIds.includes('frustration')) set.happiness = 0
  tuneHp(set, species)
  return role
}

function tuneHp(set, species) {
  const moves = set.moves.map(id)
  const item = id(set.item)
  const hp = () => 2 * species.baseStats.hp + set.ivs.hp + Math.floor(set.evs.hp / 4) + 110
  if (moves.includes('substitute') && ['salacberry', 'petayaberry', 'liechiberry'].includes(item)) {
    const wantRemainder = moves.some(move => ['flail', 'reversal', 'endeavor'].includes(move)) ? 1 : 0
    // For zero HP investment, transfer a few EVs from an offense so a pinch
    // berry still activates on the intended Substitute. No effect on IV type.
    const decrease = set.evs.hp >= 12
    for (let step = 0; step < 4 && (wantRemainder ? hp() % 4 === 0 : hp() % 4 !== 0); step++) {
      if (decrease) set.evs.hp -= 4
      else {
        const donor = STATS.find(stat => stat !== 'hp' && set.evs[stat] >= 4)
        set.evs[donor] -= 4; set.evs.hp += 4
      }
    }
  }
}

/** Small explicit acceptance gate; it does not claim competitive balance. */
export function qualityIssues(set, species, adapter) {
  const moves = movesFor(set, adapter)
  const ids = new Set(moves.map(move => move.id))
  const issue = []
  const { physical, special } = offensiveCounts(set, adapter)
  if (set.moves.length < 4 && !LOW_MOVE_EXCEPTIONS[species.id]) issue.push('Ordinary species require four useful moves.')
  if (ids.has('sleeptalk') && !ids.has('rest')) issue.push('Sleep Talk requires Rest.')
  if (ids.has('snore') && !ids.has('rest')) issue.push('Snore requires Rest.')
  if (ids.has('spitup') && !ids.has('stockpile')) issue.push('Spit Up requires Stockpile.')
  if (ids.has('dreameater') && ![...ids].some(move => ['hypnosis', 'spore', 'sleeppowder', 'sing', 'lovelykiss'].includes(move))) issue.push('Dream Eater requires a sleep move.')
  if (!physical && !special && ![...ids].some(move => PASSIVE_PLAN.has(move))) issue.push('Set requires a damage or explicit support plan.')
  if (id(set.item) === 'choiceband' && moves.filter(move => move.category !== 'Status').length === 0) issue.push('Choice Band cannot serve a wholly passive set.')
  if (id(set.item) === 'choiceband' && !physical && !ids.has('trick') && species.id !== 'ditto') issue.push('Choice Band requires physical offense or Trick.')
  const nature = GEN3.natures.find(nature => id(nature.name) === id(set.nature))
  const defensiveSupport = moves.filter(move => move.category === 'Status').length >= 3 && set.evs.hp >= 248 && set.evs.def + set.evs.spd >= 252
  if (physical && !special && set.evs.atk === 0 && !OVERRIDES[species.id]?.evs && !defensiveSupport) issue.push('Physical offense needs Attack investment.')
  if (special && !physical && set.evs.spa === 0 && !OVERRIDES[species.id]?.evs && !defensiveSupport) issue.push('Special offense needs Special Attack investment.')
  if (physical && set.ivs.atk === 0 && !ids.has('hiddenpower')) issue.push('Physical attacks must not retain special-only Attack IV minimization.')
  if (physical && !special && nature?.minus === 'atk') issue.push('Nature lowers the sole attacking stat.')
  if (special && !physical && nature?.minus === 'spa') issue.push('Nature lowers the sole attacking stat.')
  if (ids.has('hiddenpower') && adapter.hiddenPower(set.ivs).power < 60) issue.push('Hidden Power IVs yield insufficient power.')
  if (species.id === 'shedinja' && set.evs.hp) issue.push('Shedinja cannot benefit from HP investment.')
  return issue
}

const UTILITY = {
  spore: 100, sleeppowder: 85, lovelykiss: 85, thunderwave: 80, leechseed: 79,
  recover: 76, softboiled: 76, milkdrink: 76, slackoff: 76, synthesis: 73, moonlight: 70, morningsun: 70,
  encore: 73, toxic: 68, willowisp: 73, stunspore: 65, yawn: 63, hypnosis: 62,
  swordsdance: 68, bulkup: 61, dragondance: 75, calmmind: 68, tailglow: 75, growth: 45,
  reflect: 53, lightscreen: 53, protect: 48, rest: 45, healbell: 59, aromatherapy: 59,
  spikes: 65, taunt: 54, roar: 42, whirlwind: 42, charm: 36,
  stringshot: 20, harden: 10,
}

/** Sources only affect candidate preference. Full combinations still go through
 * the pinned whole-team validator, including after each accepted fallback move. */
export function rankCandidates(species, set, adapter) {
  const learnset = getLearnset(species.id)
  const byMove = new Map()
  for (const source of learnset.sources) {
    if (!source.source.startsWith('3')) continue
    const value = /3[MLT]/.test(source.source) ? 8 : source.source.startsWith('3E') ? 4 : 0
    byMove.set(source.moveId, Math.max(byMove.get(source.moveId) ?? 0, value))
  }
  const selected = movesFor(set, adapter)
  const selectedIds = new Set(selected.map(move => move.id))
  const desired = species.baseStats.atk > species.baseStats.spa * 1.12 ? 'Physical' : 'Special'
  const specialCount = selected.filter(move => move.category === 'Special').length
  const physicalCount = selected.filter(move => move.category === 'Physical').length
  const statusCount = selected.filter(move => move.category === 'Status').length
  const attackCount = physicalCount + specialCount
  return [...byMove].flatMap(([moveId, sourceScore]) => {
    if (selectedIds.has(moveId) || SKIP_ATTACKS.has(moveId) || DAMAGE_DEPENDENCIES.has(moveId)) return []
    // A pinned, explicit IV pattern makes Hidden Power real coverage. It must
    // enter with the move as one unit rather than keeping generic all-31 Dark.
    const hiddenType = desired === 'Physical' ? (species.types.includes('ghost') ? 'Fighting' : 'Ghost')
      : species.types.includes('fire') ? 'Grass' : species.types.includes('water') ? 'Electric'
        : species.types.includes('grass') ? 'Fire' : 'Ice'
    const ivs = moveId === 'hiddenpower' ? adapter.hiddenPowerIvs(hiddenType) : null
    const move = adapter.move(moveId, ivs ?? set.ivs)
    let score
    if (move.category === 'Status') {
      if (!Object.hasOwn(UTILITY, moveId) || attackCount === 0 || statusCount >= 2) return []
      if (PHYSICAL_SETUP.has(moveId) && !physicalCount || SPECIAL_SETUP.has(moveId) && !specialCount) return []
      if (selected.some(chosen => RECOVERY.has(chosen.id)) && RECOVERY.has(moveId)) return []
      const status = ['spore', 'sleeppowder', 'lovelykiss', 'hypnosis', 'thunderwave', 'stunspore', 'yawn', 'toxic', 'willowisp']
      if (status.includes(moveId) && selected.some(chosen => status.includes(chosen.id))) return []
      score = UTILITY[moveId] + (attackCount >= 2 ? 15 : -5) - statusCount * 15
    } else {
      const fixed = move.damage === 'level'
      const power = fixed ? 72 : moveId === 'return' ? 102 : move.basePower
      if (!power) return []
      const accuracy = typeof move.accuracy === 'number' ? move.accuracy / 100 : 1
      const physicalAttack = species.baseStats.atk * (['hugepower', 'purepower'].includes(id(set.ability)) ? 2 : 1)
      const attack = move.category === 'Physical' ? physicalAttack : species.baseStats.spa
      score = Math.min(power, 110) * accuracy * (fixed ? 1 : (attack / Math.max(physicalAttack, species.baseStats.spa)) ** 1.6)
      if (!fixed && species.types.includes(move.type)) score *= 1.32
      if (!fixed && move.category === desired) score += 5
      if (selected.some(chosen => chosen.category !== 'Status' && chosen.type === move.type)) score -= 65
      if (attackCount >= 2) score -= 15
      if (['doubleedge', 'takedown', 'submission'].includes(moveId)) score -= 30
      if (moveId === 'overheat') score -= 24
      if (['fly', 'dig', 'dive', 'bounce'].includes(moveId)) score -= 25
    }
    return [{ ...move, ...(ivs ? { ivs } : {}), score: score + sourceScore }]
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}
