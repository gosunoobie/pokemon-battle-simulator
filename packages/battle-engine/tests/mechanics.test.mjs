import test from 'node:test'
import assert from 'node:assert/strict'
import { createEngineFactory } from '../src/index.js'

// These expected values do not call the simulator, its Dex or the data importer.
// They cover selected Gen 3 mechanics, not independent cartridge certification.
const seed = [1, 2, 3, 4]
const allIVs = value => Object.fromEntries(['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(stat => [stat, value]))
const pokemon = (species, ability, moves, extra = {}) => ({
  species, ability, moves, nature: 'Serious', level: 100,
  ivs: allIVs(31), evs: { hp: 1 }, ...extra,
})
const reserves = [
  pokemon('Blastoise', 'Torrent', ['Tackle']),
  pokemon('Venusaur', 'Overgrow', ['Growl']),
  pokemon('Pikachu', 'Static', ['Tail Whip']),
  pokemon('Snorlax', 'Immunity', ['Amnesia']),
  pokemon('Ditto', 'Limber', ['Transform']),
  pokemon('Butterfree', 'Compound Eyes', ['Harden']),
]
const team = lead => structuredClone([lead, ...reserves.filter(row => row.species !== lead.species)].slice(0, 6))

function fixture(one, two) {
  const factory = createEngineFactory()
  const battle = factory.create({ teams: { p1: team(one), p2: team(two) }, seed, matchId: 'mechanics-fixture' })
  return { factory, battle }
}
function active(battle, seat) {
  const own = battle.getPlayerView(seat).own
  const member = own.team.find(row => row.memberId === own.active)
  assert.ok(member, seat + ' exposes its active party member')
  return member
}
function move(battle, seat, slot = 1) {
  const decision = battle.getDecision(seat)
  assert.equal(decision.kind, 'move', seat + ' has an actionable move decision')
  const option = decision.moves.find(row => row.slot === slot)
  assert.ok(option, seat + ' has move slot ' + slot)
  return option
}
async function turn(battle, order = ['p1', 'p2'], label = 'turn') {
  const requests = Object.fromEntries(['p1', 'p2'].map(seat => [seat, battle.getDecision(seat)]))
  for (const seat of order) {
    assert.equal(requests[seat].kind, 'move')
    const result = await battle.submitDecision(seat, {
      commandId: `${label}-${seat}`, decisionId: requests[seat].id, action: { kind: 'move', slot: 1 },
    })
    assert.equal(result.accepted, true, `${seat} move accepted: ${JSON.stringify(result)}`)
  }
}

// Neutral-nature, level-100 fixture stats. EV=1 intentionally contributes zero.
const stat = (base, iv = 31, ev = 1) => 2 * base + iv + Math.floor(ev / 4) + 5
const maximumHP = (base, iv = 31, ev = 1) => 2 * base + iv + Math.floor(ev / 4) + 110
function damageRolls({ power, attack, defense, stab = false, effectiveness = 1 }) {
  let damage = Math.floor(Math.floor(42 * power * attack / defense) / 50) + 2
  if (stab) damage = Math.floor(damage * 1.5)
  if (effectiveness > 1) damage *= effectiveness
  else if (effectiveness < 1) damage = Math.floor(damage * effectiveness)
  return new Set(Array.from({ length: 16 }, (_, i) => Math.floor(damage * (85 + i) / 100)))
}
function expectDamage(actual, parameters, description) {
  assert.ok(damageRolls(parameters).has(actual), `${description}: ${actual} is outside the independently calculated Gen 3 rolls ${[...damageRolls(parameters)]}`)
}

test('Flamethrower uses Gen 3 power 95, real stats, STAB, type effectiveness and integer damage rolls', async () => {
  const { battle } = fixture(pokemon('Charizard', 'Blaze', ['Flamethrower']), pokemon('Venusaur', 'Overgrow', ['Growl']))
  try {
    assert.equal(active(battle, 'p1').hp.max, maximumHP(78))
    assert.equal(active(battle, 'p2').hp.max, maximumHP(80))
    const before = active(battle, 'p2').hp.current
    const pp = move(battle, 'p1').pp
    await turn(battle)
    const damage = before - active(battle, 'p2').hp.current
    const parameters = { power: 95, attack: stat(109), defense: stat(100), stab: true, effectiveness: 2 }
    expectDamage(damage, parameters, 'Flamethrower')
    assert.ok(!damageRolls({ ...parameters, power: 90 }).has(damage), 'the pinned fixture distinguishes power 95 from modern power 90')
    assert.equal(move(battle, 'p1').pp, pp - 1)
  } finally { battle.dispose() }
})

test('Ghost attacks are physical and Haze works despite having no existing FX recipe', async () => {
  const { battle } = fixture(pokemon('Alakazam', 'Synchronize', ['Shadow Ball']), pokemon('Vaporeon', 'Water Absorb', ['Haze']))
  try {
    assert.equal(move(battle, 'p2').id, 'haze')
    const before = active(battle, 'p2').hp.current, pp = move(battle, 'p2').pp
    await turn(battle)
    const damage = before - active(battle, 'p2').hp.current
    expectDamage(damage, { power: 80, attack: stat(50), defense: stat(60) }, 'physical Shadow Ball')
    assert.ok(damage < Math.min(...damageRolls({ power: 80, attack: stat(135), defense: stat(95) })), 'the special-category result would be observably different')
    assert.equal(move(battle, 'p2').pp, pp - 1, 'Haze executes normally')
  } finally { battle.dispose() }
})

test('Dark attacks are special and Steel retains its Gen 3 Dark resistance', async () => {
  const { battle } = fixture(pokemon('Houndoom', 'Early Bird', ['Crunch']), pokemon('Skarmory', 'Keen Eye', ['Leer']))
  try {
    const before = active(battle, 'p2').hp.current
    await turn(battle)
    const damage = before - active(battle, 'p2').hp.current
    expectDamage(damage, { power: 80, attack: stat(110), defense: stat(70), stab: true, effectiveness: .5 }, 'special resisted Crunch')
    assert.ok(damage > Math.max(...damageRolls({ power: 80, attack: stat(90), defense: stat(140), stab: true, effectiveness: .5 })), 'modern physical-category damage cannot pass')
  } finally { battle.dispose() }
})

test('Hidden Power derives type, category and power from IVs rather than static move metadata', async () => {
  for (const [iv, species, ability] of [[0, 'Gengar', 'Levitate'], [31, 'Gengar', 'Levitate'], [0, 'Vaporeon', 'Water Absorb']]) {
    const { battle } = fixture(pokemon('Alakazam', 'Synchronize', ['Hidden Power'], { ivs: allIVs(iv) }), pokemon(species, ability, ['Haze']))
    try {
      const before = active(battle, 'p2').hp.current
      await turn(battle)
      const damage = before - active(battle, 'p2').hp.current
      if (species === 'Vaporeon') expectDamage(damage, { power: 30, attack: stat(50, 0), defense: stat(60) }, 'all-zero IVs produce physical Hidden Power at power 30')
      else if (iv === 0) assert.equal(damage, 0, 'all-zero IVs produce Fighting Hidden Power, to which Ghost is immune')
      else expectDamage(damage, { power: 70, attack: stat(135), defense: stat(75), effectiveness: 2 }, 'all-31 IVs produce special Dark Hidden Power at power 70')
    } finally { battle.dispose() }
  }
})

test('Spore, absent from the FX catalog, causes sleep and blocks a slower ordinary move without spending its PP', async () => {
  const { battle } = fixture(pokemon('Parasect', 'Effect Spore', ['Spore'], { evs: { hp: 1, spe: 252 } }), pokemon('Slowbro', 'Own Tempo', ['Growl']))
  try {
    const sourcePP = move(battle, 'p1').pp, targetPP = move(battle, 'p2').pp
    const hp = active(battle, 'p2').hp.current
    await turn(battle)
    assert.equal(active(battle, 'p2').condition, 'slp')
    assert.equal(active(battle, 'p2').hp.current, hp)
    assert.equal(move(battle, 'p1').pp, sourcePP - 1)
    assert.equal(move(battle, 'p2').pp, targetPP, 'an ordinary move prevented by sleep does not spend PP')
  } finally { battle.dispose() }
})

test('Grass Pokémon have no later-generation powder immunity', async () => {
  const { battle } = fixture(pokemon('Parasect', 'Effect Spore', ['Spore']), pokemon('Venusaur', 'Overgrow', ['Growl']))
  try {
    await turn(battle)
    assert.equal(active(battle, 'p2').condition, 'slp')
  } finally { battle.dispose() }
})

test('Levitate prevents Earthquake damage while an otherwise legal move still spends PP', async () => {
  const { battle } = fixture(pokemon('Groudon', 'Drought', ['Earthquake']), pokemon('Gengar', 'Levitate', ['Haze']))
  try {
    const hp = active(battle, 'p2').hp.current, pp = move(battle, 'p1').pp
    await turn(battle)
    assert.equal(active(battle, 'p2').hp.current, hp)
    assert.equal(move(battle, 'p1').pp, pp - 1)
  } finally { battle.dispose() }
})

test('Shedinja has exactly one HP and Wonder Guard blocks a neutral Water attack', async () => {
  const { battle } = fixture(pokemon('Blastoise', 'Torrent', ['Water Gun']), pokemon('Shedinja', 'Wonder Guard', ['Harden']))
  try {
    assert.deepEqual(active(battle, 'p2').hp, { current: 1, max: 1 })
    await turn(battle)
    assert.deepEqual(active(battle, 'p2').hp, { current: 1, max: 1 })
  } finally { battle.dispose() }
})

test('fainting requests a legal forced replacement before the next move decision', async () => {
  const { battle } = fixture(pokemon('Groudon', 'Drought', ['Earthquake']), pokemon('Pikachu', 'Static', ['Tail Whip']))
  try {
    const original = active(battle, 'p2').memberId
    await turn(battle)
    const own = battle.getPlayerView('p2').own
    assert.equal(own.team.find(member => member.memberId === original).hp.current, 0)
    const decision = battle.getDecision('p2')
    assert.equal(decision.kind, 'switch')
    assert.equal(battle.getDecision('p1').kind, 'wait')
    assert.ok(decision.switches.length > 0)
    assert.ok(decision.switches.every(option => option.memberId !== original), 'fainted members cannot be selected')
    const next = decision.switches[0].memberId
    const result = await battle.submitDecision('p2', { commandId: 'forced-replacement', decisionId: decision.id, action: { kind: 'switch', memberId: next } })
    assert.equal(result.accepted, true, JSON.stringify(result))
    assert.equal(battle.getPlayerView('p2').own.active, next)
    assert.equal(battle.getDecision('p1').kind, 'move')
    assert.equal(battle.getDecision('p2').kind, 'move')
  } finally { battle.dispose() }
})

test('choice arrival order cannot change damage, PP, status or member identity', async () => {
  const one = pokemon('Charizard', 'Blaze', ['Flamethrower']), two = pokemon('Venusaur', 'Overgrow', ['Growl'])
  const a = fixture(one, two).battle, b = fixture(one, two).battle
  const observable = battle => Object.fromEntries(['p1', 'p2'].map(seat => [seat, {
    active: battle.getPlayerView(seat).own.active,
    team: battle.getPlayerView(seat).own.team.map(({ memberId, hp, condition }) => ({ memberId, hp, condition })),
    moves: battle.getDecision(seat).moves,
  }]))
  try {
    const decision = a.getDecision('p1'), before = observable(a)
    const result = await a.submitDecision('p1', { commandId: 'first-p1', decisionId: decision.id, action: { kind: 'move', slot: 1 } })
    assert.equal(result.accepted, true)
    assert.equal(a.getDecision('p1').kind, 'wait')
    for (const seat of ['p1', 'p2']) assert.deepEqual(a.getPlayerView(seat).own.team.map(({ memberId, hp, condition }) => ({ memberId, hp, condition })), before[seat].team, 'a pending choice does not resolve either actor')
    const remaining = a.getDecision('p2')
    assert.equal((await a.submitDecision('p2', { commandId: 'second-p2', decisionId: remaining.id, action: { kind: 'move', slot: 1 } })).accepted, true)
    await turn(b, ['p2', 'p1'])
    assert.deepEqual(observable(a), observable(b))
  } finally { a.dispose(); b.dispose() }
})

test('Gen 3 Counter responds to special Hidden Power, while Mirror Coat explicitly excludes it', async () => {
  for (const response of ['Counter', 'Mirror Coat']) {
    const { battle } = fixture(pokemon('Alakazam', 'Synchronize', ['Hidden Power']), pokemon('Wobbuffet', 'Shadow Tag', [response]))
    try {
      const sourceHp = active(battle, 'p1').hp.current, targetHp = active(battle, 'p2').hp.current
      await turn(battle)
      const source = battle.getPlayerView('p1').own.team[0]
      const damage = targetHp - active(battle, 'p2').hp.current
      assert.ok(damage > 0, 'special Dark Hidden Power damages Wobbuffet')
      assert.equal(source.hp.current, response === 'Counter' ? Math.max(0, sourceHp - 2 * damage) : sourceHp, response + ' has Gen 3 Hidden Power eligibility')
    } finally { battle.dispose() }
  }
})
