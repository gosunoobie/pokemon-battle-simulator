import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveMoveImpact } from '../apps/simulation/src/impact.js'

const event = (cursor, opcode, ...fields) => ({ cursor, args: { opcode, fields } })
function view() {
  return {
    matchId: 'match-17', seat: 'p1', cursor: 40,
    own: { active: 'p1:1', team: [
      { memberId: 'p1:1', species: 'Charizard', hp: { current: 250, max: 300 }, hpPrecision: 'exact' },
      { memberId: 'p1:2', species: 'Blastoise', hp: { current: 300, max: 300 }, hpPrecision: 'exact' },
    ] },
    opponent: { active: 'p2:revealed:1', known: [
      { memberId: 'p2:revealed:1', species: 'Venusaur', hp: { current: 48, max: 48 }, hpPrecision: 'public' },
      { memberId: 'p2:revealed:2', species: 'Slowbro', hp: { current: 48, max: 48 }, hpPrecision: 'public' },
    ] },
  }
}
const target = 'p2:revealed:1'
const own = 'p1:1'
function hit({ source = own, receiver = target, marker = '-supereffective', health = '30/48' } = {}) {
  return [event(41, 'move', source, 'Flamethrower', receiver), event(42, marker, receiver), event(43, '-damage', receiver, health)]
}

test('an effective hit displays only the public target bar loss and a stable per-move key', () => {
  const input = hit(), before = view()
  assert.deepEqual(deriveMoveImpact(input, before), {
    key: 'match-17:41:impact', kind: 'super-effective', label: 'Super effective!',
    actorId: 'target', memberId: target, damageText: '≈ −38% HP',
  })
  assert.equal(deriveMoveImpact(input, before).key, deriveMoveImpact(input, structuredClone(before)).key)
  const otherMatch = structuredClone(before); otherMatch.matchId = 'next-trainer'
  assert.notEqual(deriveMoveImpact(input, otherMatch).key, deriveMoveImpact(input, before).key)
})

test('an opponent attack uses the near actor and exact displayed own HP', () => {
  const result = deriveMoveImpact(hit({ source: target, receiver: own, marker: '-resisted', health: '220/300' }), view())
  assert.equal(result.actorId, 'source')
  assert.equal(result.memberId, own)
  assert.equal(result.kind, 'resisted')
  assert.equal(result.label, 'Not very effective…')
  assert.equal(result.damageText, '−30 HP')
})

test('actor placement follows own/opponent slots even when the viewer is p2', () => {
  const before = view()
  before.seat = 'p2'
  before.own.active = 'p2:1'; before.own.team[0].memberId = 'p2:1'
  before.opponent.active = 'p1:revealed:1'; before.opponent.known[0].memberId = 'p1:revealed:1'
  const group = hit({ source: 'p1:revealed:1', receiver: 'p2:1', health: '200/300' })
  const result = deriveMoveImpact(group, before)
  assert.equal(result.actorId, 'source')
  assert.equal(result.memberId, 'p2:1')
  assert.equal(result.damageText, '−50 HP')
})

test('multi-hit moves sum the direct target losses once without counting recoil, drain or residual effects', () => {
  const before = view()
  before.opponent.known[0].hp.current = 40
  const group = [
    event(41, 'move', own, 'Bullet Seed', target),
    event(42, '-supereffective', target),
    event(43, '-damage', target, '36/48'),
    event(44, '-damage', own, '245/300', '[from] recoil'),
    event(45, '-heal', own, '250/300', '[from] drain', `[of] ${target}`),
    event(46, '-damage', target, '30/48', '[from] psn'),
    event(47, '-supereffective', target),
    event(48, '-damage', target, '24/48'),
    event(49, '-hitcount', target, '2'),
  ]
  const result = deriveMoveImpact(group, before)
  assert.equal(result.damageText, '≈ −21% HP', 'only 4 + 6 public bar units belong to the move')
  assert.equal(result.key, 'match-17:41:impact')
})

test('intervening target heals, attributed damage and both sethp positions update the next hit baseline', () => {
  const group = [
    event(41, 'move', target, 'Rock Blast', own), event(42, '-supereffective', own),
    event(43, '-damage', own, '200/300'), // 50 direct HP
    event(44, '-heal', own, '230/300', '[from] item: Sitrus Berry'),
    event(45, '-damage', own, '210/300', '[from] ability: Rough Skin'),
    event(46, '-damage', own, '200/300'), // 10 direct HP
    event(47, '-sethp', target, '40/48', own, '180/300', '[from] move: Pain Split'),
    event(48, '-damage', own, '160/300'), // 20 direct HP
    event(49, '-sethp', own, '100/300', target, '30/48', '[from] move: Pain Split'),
    event(50, '-damage', own, '70/300'), // 30 direct HP
  ]
  assert.equal(deriveMoveImpact(group, view()).damageText, '−110 HP')
})

test('any from attribution excludes that loss rather than relying on a finite residual damage allowlist', () => {
  for (const from of ['[from] psn', '[from] recoil', '[from] confusion', '[from] drain', '[from] item: Life Orb', '[from] ability: Unknown', '[from]']) {
    const group = [event(41, 'move', target, 'Thunderbolt', own), event(42, '-supereffective', own),
      event(43, '-damage', own, '200/300', from), event(44, '-damage', own, '190/300')]
    assert.equal(deriveMoveImpact(group, view()).damageText, '−10 HP', from)
  }
})

test('a knockout counts only remaining visible HP, including public colour/condition health strings', () => {
  const before = view()
  before.own.team[0].hp.current = 10
  assert.equal(deriveMoveImpact(hit({ source: target, receiver: own, health: '0 fnt' }), before).damageText, '−10 HP')
  assert.equal(deriveMoveImpact(hit({ health: '24/48y par' }), before).damageText, '≈ −50% HP')
  assert.equal(deriveMoveImpact(hit({ health: '0 fnt' }), before).damageText, '≈ −100% HP')
})

test('a confirmed effectiveness marker without target HP loss never invents substitute damage', () => {
  const group = [event(41, 'move', own, 'Flamethrower', target), event(42, '-supereffective', target),
    event(43, '-activate', target, 'Substitute', '[damage]'), event(44, '-end', target, 'Substitute')]
  const result = deriveMoveImpact(group, view())
  assert.equal(result.label, 'Super effective!')
  assert.equal(result.damageText, null)
  assert.equal(deriveMoveImpact(hit({ health: '48/48' }), view()).damageText, null)
})

test('status immunity is displayed from the protocol alone and never includes a damage number', () => {
  const group = [event(41, 'move', own, 'Toxic', target), event(42, '-immune', target, '[from] ability: Immunity')]
  assert.deepEqual(deriveMoveImpact(group, view()), {
    key: 'match-17:41:impact', kind: 'immune', label: 'No effect', actorId: 'target', memberId: target, damageText: null,
  })
  group.push(event(43, '-damage', target, '40/48', '[from] brn'))
  assert.equal(deriveMoveImpact(group, view()).damageText, null)
})

test('a later secondary immunity cannot claim an already damaging move had no effect', () => {
  const effective = hit()
  effective.push(event(44, '-immune', target, '[from] ability: Water Veil'))
  assert.equal(deriveMoveImpact(effective, view()).kind, 'super-effective')
  assert.equal(deriveMoveImpact(effective, view()).damageText, '≈ −38% HP')
  const noEffectiveness = [event(41, 'move', own, 'Flamethrower', target), event(42, '-damage', target, '30/48'),
    event(43, '-immune', target, '[from] ability: Water Veil')]
  assert.equal(deriveMoveImpact(noEffectiveness, view()), null)
  noEffectiveness[1] = event(42, '-damage', target, '48/48')
  assert.equal(deriveMoveImpact(noEffectiveness, view()), null, 'the rounded bar may conceal a real small hit')
})

test('unrelated target markers and health updates cannot manufacture a label or increase its damage', () => {
  const group = [event(41, 'move', own, 'Flamethrower', target), event(42, '-supereffective', own), event(43, '-damage', target, '30/48')]
  assert.equal(deriveMoveImpact(group, view()), null)
  group.push(event(44, '-resisted', target), event(45, '-damage', own, '0 fnt'), event(46, '-damage', 'p2:revealed:2', '0 fnt'))
  assert.equal(deriveMoveImpact(group, view()).kind, 'resisted')
  assert.equal(deriveMoveImpact(group, view()).damageText, '≈ −38% HP')
})

test('preparation, neutral hits, missed attacks and non-move groups have no effectiveness impact', () => {
  const prepared = hit(); prepared.push(event(44, '-prepare', own, 'Fly', target))
  assert.equal(deriveMoveImpact(prepared, view()), null)
  assert.equal(deriveMoveImpact([event(41, 'move', own, 'Tackle', target), event(42, '-damage', target, '30/48')], view()), null)
  assert.equal(deriveMoveImpact([event(41, 'move', own, 'Tackle', target), event(42, '-miss', own, target)], view()), null)
  assert.equal(deriveMoveImpact([event(41, '-supereffective', target)], view()), null)
  assert.equal(deriveMoveImpact([...hit(), event(44, 'move', target, 'Surf', own)], view()), null)
})

test('missing target identity, inactive members and malformed event envelopes are ignored safely', () => {
  const before = view()
  for (const receiver of [null, '', 'unknown', 'p1:2', 'p2:revealed:2']) assert.equal(deriveMoveImpact(hit({ receiver }), before), null)
  assert.equal(deriveMoveImpact([event(41, 'move', own, 'Surf'), event(42, '-supereffective', target)], before), null)
  const missingMember = view(); missingMember.opponent.known = []
  assert.equal(deriveMoveImpact(hit(), missingMember), null)
  const missingActive = view(); missingActive.opponent.active = null
  assert.equal(deriveMoveImpact(hit(), missingActive), null)
  const ambiguous = view(); ambiguous.own.active = target
  assert.equal(deriveMoveImpact(hit(), ambiguous), null)
  for (const group of [null, undefined, [], {}, [null], [{ cursor: 41, args: { opcode: 'move', fields: null } }]]) assert.equal(deriveMoveImpact(group, before), null)
  for (const snapshot of [null, {}, { matchId: 'missing-sides' }]) assert.equal(deriveMoveImpact(hit(), snapshot), null)
  const invalidCursor = hit(); invalidCursor[0].cursor = NaN
  assert.equal(deriveMoveImpact(invalidCursor, before), null)
})

test('unknown precision and malformed or incomplete displayed health suppress numeric damage', () => {
  for (const precision of [undefined, null, 'unknown', 'exact']) {
    const before = view(); before.opponent.known[0].hpPrecision = precision
    assert.equal(deriveMoveImpact(hit(), before).damageText, null, 'opponent exact HP must never be exposed')
  }
  for (const hp of [null, {}, { current: '48', max: 48 }, { current: 48, max: 0 }, { current: -1, max: 48 }, { current: 49, max: 48 }, { current: Infinity, max: 48 }]) {
    const before = view(); before.opponent.known[0].hp = hp
    assert.equal(deriveMoveImpact(hit(), before).damageText, null)
  }
  for (const health of ['?', '', '-3/48', '30/0', '99/48', '30', 'NaN/48', '9007199254740993/9007199254740993', null, '20/100']) {
    assert.equal(deriveMoveImpact(hit({ health }), view()).damageText, null, String(health))
  }
  const incomplete = hit({ health: 'malformed' })
  incomplete.push(event(44, '-damage', target, '25/48'), event(45, '-damage', target, '20/48'))
  assert.equal(deriveMoveImpact(incomplete, view()).damageText, null, 'a partial known loss is not the whole move total')
})

test('malformed intervening facts invalidate the baseline instead of including unaccounted losses', () => {
  const group = [event(41, 'move', own, 'Flamethrower', target), event(42, '-supereffective', target),
    event(43, '-damage', target, '40/48'), event(44, '-heal', target, 'unavailable'), event(45, '-damage', target, '30/48')]
  assert.equal(deriveMoveImpact(group, view()).damageText, null)
})

test('impact derivation does not mutate protocol events, HP snapshots or battle state', () => {
  const before = view(), group = hit(), saved = structuredClone({ before, group })
  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
    return value
  }
  freeze(before); freeze(group)
  const impact = deriveMoveImpact(group, before)
  impact.damageText = 'cosmetic caller change'
  assert.deepEqual({ before, group }, saved)
  assert.equal(deriveMoveImpact(group, before).damageText, '≈ −38% HP')
  assert.equal(Object.hasOwn(impact, 'multiplier'), false)
})
