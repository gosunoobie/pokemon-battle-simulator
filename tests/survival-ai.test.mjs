import test from 'node:test'
import assert from 'node:assert/strict'
import { rankSurvivalActions, driveSurvivalAI } from '../apps/server/survival-ai.js'

const own = (species, hp = 100, extra = {}) => ({ memberId: 'p2:1', species, hp: { current: hp, max: 100 }, condition: null, stats: {}, stages: {}, volatiles: [], moves: [], ...extra })
const foe = (species, extra = {}) => ({ memberId: 'p1:revealed:1', species, hp: { current: 48, max: 48 }, condition: null, stats: {}, stages: {}, volatiles: [], moves: [], ...extra })
function view(moves, options = {}) {
  return {
    seat: 'p2', turn: 1, own: { active: 'p2:1', team: [options.own ?? own('Alakazam'), ...(options.bench ?? [])] },
    opponent: { active: 'p1:revealed:1', known: [options.foe ?? foe('Machamp')] }, sideConditions: { p1: [], p2: [] },
    decision: { id: 'test:p2:1', kind: options.kind ?? 'move', moves: moves.map((id, index) => ({ id, slot: index + 1, pp: 10, maxpp: 10, disabled: false })), switches: options.switches ?? [] },
    ...options.patch,
  }
}

test('ranks legal attacks by visible type and own physical/special stats with deterministic ties', () => {
  const state = view(['tackle', 'psychic', 'shadowball'])
  assert.deepEqual(rankSurvivalActions(state)[0], { kind: 'move', slot: 2 })
  assert.deepEqual(rankSurvivalActions(state), rankSurvivalActions(structuredClone(state)))
  state.decision.moves[1].disabled = true
  state.decision.moves[2].pp = 0
  assert.deepEqual(rankSurvivalActions(state), [{ kind: 'move', slot: 1 }])
})

test('avoids type/known ability immunities and switches when every usable move is immune', () => {
  assert.equal(rankSurvivalActions(view(['thunderbolt', 'surf'], { own: own('Lanturn'), foe: foe('Quagsire') }))[0].slot, 2)
  assert.equal(rankSurvivalActions(view(['earthquake', 'rockslide'], { own: own('Golem'), foe: foe('Gengar', { ability: 'Levitate' }) }))[0].slot, 2)
  const switched = rankSurvivalActions(view(['earthquake'], { own: own('Dugtrio'), foe: foe('Charizard'), bench: [own('Blastoise', 100, { memberId: 'p2:2' })], switches: [{ memberId: 'p2:2' }] }))
  assert.deepEqual(switched[0], { kind: 'switch', memberId: 'p2:2' })
  // The same unrevealed species may have a different ability. The policy must
  // not infer a hidden choice: only the view's known ability changes the rank.
  const unknown = view(['surf', 'tackle'], { own: own('Blastoise'), foe: foe('Poliwrath') })
  assert.equal(rankSurvivalActions(unknown)[0].slot, 1)
  unknown.opponent.known[0].ability = 'Water Absorb'
  assert.equal(rankSurvivalActions(unknown)[0].slot, 2)
})

test('Hidden Power uses the AI own legal IVs; Gen 3 Ghost attacks use Attack', () => {
  const state = view(['hiddenpower', 'tackle'], { own: own('Unown'), foe: foe('Gyarados') })
  const actions = rankSurvivalActions(state, { ownTeam: [{ ivs: { hp: 31, atk: 31, def: 31, spe: 31, spa: 30, spd: 31 } }] })
  assert.equal(actions[0].slot, 1)
  const mixed = view(['shadowball', 'psychic'], { own: own('Alakazam', 100, { stats: { atk: 50, spa: 350 } }), foe: foe('Mew') })
  assert.equal(rankSurvivalActions(mixed)[0].slot, 2)
})

test('recovery, Rest, sleep moves and setup are bounded by current public conditions', () => {
  assert.equal(rankSurvivalActions(view(['recover', 'tackle'], { own: own('Alakazam', 30) }))[0].slot, 1)
  assert.equal(rankSurvivalActions(view(['recover', 'psychic']))[0].slot, 2)
  assert.equal(rankSurvivalActions(view(['rest', 'tackle'], { own: own('Snorlax', 30) }))[0].slot, 1)
  assert.equal(rankSurvivalActions(view(['sleeptalk', 'tackle'], { own: own('Snorlax', 50, { condition: 'slp' }) }))[0].slot, 1)
  assert.equal(rankSurvivalActions(view(['dreameater', 'tackle'], { foe: foe('Machamp') }))[0].slot, 2)
  assert.equal(rankSurvivalActions(view(['spore', 'tackle'], { own: own('Shroomish'), foe: foe('Snorlax', { condition: 'par' }) }))[0].slot, 2)
  assert.equal(rankSurvivalActions(view(['swordsdance', 'tackle'], { own: own('Farfetch’d', 100, { stages: { atk: 6 } }) }))[0].slot, 2)
  assert.equal(rankSurvivalActions(view(['fakeout', 'tackle'], { patch: { turn: 5 } }))[0].slot, 2)
})

test('status immunity rules use Gen 3 behavior and already applied effects are not repeated', () => {
  assert.equal(rankSurvivalActions(view(['toxic', 'tackle'], { foe: foe('Steelix') }))[0].slot, 2)
  assert.equal(rankSurvivalActions(view(['willowisp', 'tackle'], { foe: foe('Charizard') }))[0].slot, 2)
  assert.equal(rankSurvivalActions(view(['thunderwave', 'splash'], { foe: foe('Pikachu') }))[0].slot, 1, 'Electric is not paralysis-immune in Gen 3')
  assert.equal(rankSurvivalActions(view(['thunderwave', 'tackle'], { foe: foe('Golem') }))[0].slot, 2)
  assert.equal(rankSurvivalActions(view(['confuseray', 'tackle'], { foe: foe('Snorlax', { volatiles: ['confusion'] }) }))[0].slot, 2)
  const screen = view(['reflect', 'psychic'], { foe: foe('Umbreon'), bench: [own('Snorlax', 100, { memberId: 'p2:2' })], switches: [{ memberId: 'p2:2' }], patch: { sideConditions: { p1: [], p2: ['Reflect'] } } })
  assert.deepEqual(rankSurvivalActions(screen)[0], { kind: 'switch', memberId: 'p2:2' }, 'display-name screen facts prevent an ineffective screen loop')
  assert.equal(rankSurvivalActions(view(['yawn', 'tackle'], { foe: foe('Snorlax', { volatiles: ['Yawn'] }) }))[0].slot, 2)
})

test('constrained Ditto, Wobbuffet and low-move sets still choose legal useful actions', () => {
  assert.deepEqual(rankSurvivalActions(view(['transform'], { own: own('Ditto') })), [{ kind: 'move', slot: 1 }])
  assert.equal(rankSurvivalActions(view(['counter', 'mirrorcoat', 'destinybond', 'safeguard'], { own: own('Wobbuffet'), foe: foe('Alakazam') }))[0].slot, 2)
  assert.equal(rankSurvivalActions(view(['counter', 'mirrorcoat'], { own: own('Wobbuffet'), foe: foe('Machamp', { moves: ['Cross Chop'] }) }))[0].slot, 1)
  assert.deepEqual(rankSurvivalActions(view(['splash'], { own: own('Magikarp') })), [{ kind: 'move', slot: 1 }])
})

test('forced replacement uses only supplied switch identities and inactive decisions produce no action', () => {
  const state = view([], { kind: 'switch', own: own('Alakazam', 0), foe: foe('Charizard'), bench: [own('Blastoise', 90, { memberId: 'p2:3' }), own('Venusaur', 20, { memberId: 'p2:5' })], switches: [{ memberId: 'p2:3' }, { memberId: 'p2:5' }] })
  assert.deepEqual(rankSurvivalActions(state)[0], { kind: 'switch', memberId: 'p2:3' })
  state.decision.kind = 'wait'
  assert.deepEqual(rankSurvivalActions(state), [])
})

test('bounded driver handles forced replacements while player chooses and fails recoverably on unusable decisions', () => {
  const state = view([], { kind: 'switch', own: own('Alakazam', 0), bench: [own('Blastoise', 100, { memberId: 'p2:2' })], switches: [{ memberId: 'p2:2' }] })
  const commands = []
  const engine = {
    getDecision: seat => seat === 'p1' ? { kind: 'move' } : state.decision,
    getPlayerView: seat => seat === 'p1' ? { complete: true } : { ...state, complete: true },
    submitDecision: (seat, command) => { commands.push([seat, command]); state.decision = { ...state.decision, kind: 'move' }; return { accepted: true } },
  }
  assert.equal(driveSurvivalAI(engine, { commandNumber: 4 }), 5)
  assert.equal(commands[0][0], 'p2')
  assert.deepEqual(commands[0][1].action, { kind: 'switch', memberId: 'p2:2' })
  state.decision = { id: 'stuck', kind: 'switch', moves: [], switches: [] }
  assert.throws(() => driveSurvivalAI(engine), /no usable legal action/)
})
