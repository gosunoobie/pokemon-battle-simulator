import test from 'node:test'
import assert from 'node:assert/strict'
import { createProjection } from '../src/projection.js'
import { getVendor } from '../src/vendor.js'
import { getFormat } from '../src/profile.js'
import { createTeamFixture } from '../fixtures/team-fixtures.js'

const teams = {
  p1: createTeamFixture().map((set, index) => ({ ...set, name: `First ${index + 1}` })),
  p2: createTeamFixture().map((set, index) => ({ ...set, name: `Secret ${index + 1}` })),
}
const makeProjection = () => createProjection({ matchId: 'projection-test', teams })
const requestPokemon = (seat, index, active = false) => ({
  ident: `${seat}: ${seat}-${index + 1}`,
  details: `${teams[seat][index].species}, M`, condition: '297/297', active,
  moves: ['privatehiddenmove'], item: 'privatehiddenitem', ability: 'privatehiddenability',
  stats: { atk: 277, def: 222, spa: 301, spd: 249, spe: 263 },
})
const request = (seat, order = [0, 1, 2, 3, 4, 5]) => ({
  active: [{ moves: [{ id: 'privatehiddenmove', move: 'Private Hidden Move', pp: 8, maxpp: 8, target: 'normal', disabled: false }] }],
  side: { id: seat, name: seat, pokemon: order.map((index, position) => requestPokemon(seat, index, position === 0)) },
})
const sendRequest = (projection, seat, value = request(seat)) => projection.consume('sideupdate', `${seat}\n|request|${JSON.stringify(value)}`)
const splitSwitch = (seat, index, species, exact = '297/297', publicHp = '100/100') =>
  `|split|${seat}\n|switch|${seat}a: ${seat}-${index}|${species}, M|${exact}\n|switch|${seat}a: ${seat}-${index}|${species}, M|${publicHp}`

test('split channels expose exact own HP and only public opponent HP and observed identities', () => {
  const projection = makeProjection()
  sendRequest(projection, 'p1')
  sendRequest(projection, 'p2')
  projection.consume('update', `${splitSwitch('p1', 1, 'Charizard')}\n${splitSwitch('p2', 6, 'Machamp', '383/383')}`)
  const p1 = projection.getView('p1')
  assert.deepEqual(p1.own.team[0].hp, { current: 297, max: 297 })
  assert.equal(p1.own.team[0].name, 'First 1')
  assert.equal(p1.own.active, 'p1:1')
  assert.deepEqual(p1.opponent.known[0].hp, { current: 100, max: 100 })
  assert.equal(p1.opponent.active, 'p2:revealed:1')
  assert.equal(p1.opponent.known[0].species, 'Machamp')
  assert.equal(p1.opponent.known.length, 1)
  assert.deepEqual(p1.opponent.known[0].moves, [])
  assert.equal(p1.opponent.known[0].ability, null)
  assert.equal(p1.opponent.known[0].item, null)
  const publicBytes = JSON.stringify({ view: p1.opponent, events: projection.getEvents('p1') })
  for (const secret of ['383/383', 'Secret 6', 'p2-6', 'privatehiddenmove', 'privatehiddenability', 'privatehiddenitem']) {
    assert(!publicBytes.includes(secret), `Leaked ${secret}`)
  }
})

test('private requests advance only their viewer cursor and remain outside public events', () => {
  const projection = makeProjection()
  const before = projection.getView('p2')
  sendRequest(projection, 'p1')
  assert.deepEqual(projection.getView('p2'), before)
  assert.deepEqual(projection.getEvents('p2'), [])
  assert.equal(projection.getView('p1').cursor, 1)
  assert.equal(projection.getRequest('p1').side.pokemon[0].item, 'privatehiddenitem')
  assert.equal(projection.getRequest('p2'), null)
  assert(!JSON.stringify(projection.getEvents('p1')).includes('privatehidden'))
  projection.consume('update', '|turn|1')
  assert.equal(projection.getEvents('p1')[1].cursor, 2)
  assert.equal(projection.getEvents('p2')[0].cursor, 1)
})

test('optional canonical teams can be populated from the owning private request using stable tokens', () => {
  const projection = createProjection({ matchId: 'request-only' })
  sendRequest(projection, 'p1', request('p1', [5, 1, 2, 3, 4, 0]))
  assert.deepEqual(projection.getView('p1').own.team.map(member => member.memberId), ['p1:1', 'p1:2', 'p1:3', 'p1:4', 'p1:5', 'p1:6'])
  assert.equal(projection.getView('p1').own.active, 'p1:6')
  assert.equal(projection.getView('p1').own.team[0].name, 'Charizard')
  assert.deepEqual(projection.getView('p2').opponent.known, [])
})

test('party reorder, return switches, form changes and Transform retain stable identities', () => {
  const projection = makeProjection()
  sendRequest(projection, 'p1', request('p1', [5, 1, 2, 3, 4, 0]))
  assert.equal(projection.getView('p1').own.active, 'p1:6')
  assert.equal(projection.getView('p1').own.team[0].name, 'First 1')
  projection.consume('update', splitSwitch('p2', 6, 'Machamp'))
  projection.consume('update', splitSwitch('p2', 2, 'Blastoise'))
  projection.consume('update', splitSwitch('p2', 6, 'Machamp'))
  assert.equal(projection.getView('p1').opponent.active, 'p2:revealed:1')
  assert.equal(projection.getView('p1').opponent.known.length, 2)
  projection.consume('update', '|-formechange|p2a: p2-6|Castform-Rainy')
  assert.equal(projection.getView('p1').opponent.known[0].species, 'Castform-Rainy')
  projection.consume('update', '|-transform|p1a: p1-6|p2a: p2-6')
  assert.equal(projection.getView('p1').own.team[5].species, 'Castform-Rainy')
  assert.equal(projection.getView('p1').own.team[5].transformedInto, 'p2:revealed:1')
  projection.consume('update', splitSwitch('p1', 6, 'Machamp'))
  assert.equal(projection.getView('p1').own.team[5].species, 'Machamp')
  assert.equal(projection.getView('p1').own.team[5].transformedInto, undefined)
})

test('public HP color suffixes retain bar units and status without exposing exact HP', () => {
  const projection = makeProjection()
  projection.consume('update', splitSwitch('p2', 1, 'Charizard', '150/297 brn', '24/48y brn'))
  assert.deepEqual(projection.getView('p1').opponent.known[0].hp, { current: 24, max: 48 })
  assert.equal(projection.getView('p1').opponent.known[0].hpColor, 'yellow')
  assert.equal(projection.getView('p1').opponent.known[0].condition, 'brn')
  projection.consume('update', '|-damage|p2a: p2-1|9/48r brn')
  assert.deepEqual(projection.getView('p1').opponent.known[0].hp, { current: 9, max: 48 })
  assert.equal(projection.getView('p1').opponent.known[0].hpColor, 'red')
  assert(!JSON.stringify(projection.getEvents('p1')).includes('150/297'))
})

test('transient conditions remain events only and side-wide cures clear known party statuses', () => {
  const projection = makeProjection()
  projection.consume('update', `${splitSwitch('p2', 1, 'Charizard')}\n${splitSwitch('p2', 2, 'Blastoise')}`)
  projection.consume('update', '|-status|p2: p2-1|brn\n|-status|p2a: p2-2|par\n|-status|p1a: p1-1|slp\n|-singleturn|p2a: p2-2|Protect\n|-singlemove|p2a: p2-2|Destiny Bond\n|-start|p2a: p2-2|confusion\n|turn|2')
  assert.deepEqual(projection.getView('p1').opponent.known[1].volatiles, ['confusion'])
  assert(projection.getEvents('p1').some(event => event.args.opcode === '-singleturn'))
  assert(projection.getEvents('p1').some(event => event.args.opcode === '-singlemove'))
  projection.consume('update', '|-cureteam|p2\n|-cureteam|p1: p1')
  assert(projection.getView('p1').opponent.known.every(member => member.condition === null))
  assert.equal(projection.getView('p1').own.team[0].condition, null)
  assert.equal(projection.getView('p1').opponent.known.length, 2)
})

test('Gen 3 base request data does not undo observed ability changes or active Transform appearance', () => {
  const projection = makeProjection()
  const baseRequest = request('p1')
  for (const [index, pokemon] of baseRequest.side.pokemon.entries()) {
    delete pokemon.ability
    pokemon.baseAbility = teams.p1[index].ability.toLowerCase()
  }
  sendRequest(projection, 'p1', baseRequest)
  projection.consume('update', `${splitSwitch('p1', 1, 'Charizard')}\n${splitSwitch('p2', 2, 'Blastoise')}`)
  projection.consume('update', '|-ability|p1a: p1-1|Torrent|Blaze|[from] move: Role Play|[of] p2a: p2-2')
  sendRequest(projection, 'p1', baseRequest)
  assert.equal(projection.getView('p1').own.team[0].ability, 'Torrent')
  projection.consume('update', '|-ability|p2a: p2-2|Torrent\n|-transform|p1a: p1-1|p2a: p2-2')
  sendRequest(projection, 'p1', baseRequest)
  assert.equal(projection.getView('p1').own.team[0].species, 'Blastoise')
  assert.equal(projection.getView('p1').own.team[0].ability, 'Torrent')
  projection.consume('update', splitSwitch('p1', 2, 'Blastoise'))
  assert.equal(projection.getView('p1').own.team[0].species, 'Charizard')
  assert.equal(projection.getView('p1').own.team[0].ability.toLowerCase(), 'blaze')
  assert.equal(projection.getView('p1').own.team[0].transformedInto, undefined)
  projection.consume('update', splitSwitch('p1', 1, 'Charizard'))
  assert.equal(projection.getView('p1').own.team[0].ability.toLowerCase(), 'blaze')
})

test('Gen 3 Skill Swap preserves observer-known information and keeps unknown copied abilities unknown', () => {
  const projection = makeProjection()
  projection.consume('update', `${splitSwitch('p1', 1, 'Charizard')}\n${splitSwitch('p2', 2, 'Blastoise')}`)
  projection.consume('update', '|-activate|p1a: p1-1|Skill Swap|||[of] p2a: p2-2')
  assert.equal(projection.getView('p1').own.team[0].ability, null)
  assert.equal(projection.getView('p1').opponent.known[0].ability, 'Blaze')
  assert.equal(projection.getView('p2').own.team[1].ability, null)
  assert.equal(projection.getView('p2').opponent.known[0].ability, 'Torrent')
  const nextRequest = request('p1')
  delete nextRequest.side.pokemon[0].ability
  nextRequest.side.pokemon[0].baseAbility = 'blaze'
  sendRequest(projection, 'p1', nextRequest)
  assert.equal(projection.getView('p1').own.team[0].ability, null)
  const restored = createProjection({ state: projection.exportState() })
  restored.consume('update', splitSwitch('p1', 2, 'Blastoise'))
  assert.equal(restored.getView('p1').own.team[0].ability, 'Blaze')
})

test('Trace reveals the copied ability on both actors and retains the tracer original ability for switching', () => {
  const projection = makeProjection()
  projection.consume('update', `${splitSwitch('p1', 1, 'Charizard')}\n${splitSwitch('p2', 2, 'Gardevoir')}`)
  projection.consume('update', '|-ability|p2a: p2-2|Blaze|Trace|[from] ability: Trace|[of] p1a: p1-1')
  assert.equal(projection.getView('p1').own.team[0].ability, 'Blaze')
  assert.equal(projection.getView('p1').opponent.known[0].ability, 'Blaze')
  projection.consume('update', splitSwitch('p2', 3, 'Venusaur'))
  assert.equal(projection.getView('p1').opponent.known[0].ability, 'Trace')
})

test('fresh public protocol updates supersede previous own request HP and preserve causal events', () => {
  const projection = makeProjection()
  sendRequest(projection, 'p1')
  projection.consume('update', splitSwitch('p1', 1, 'Charizard'))
  const cursor = projection.getView('p1').cursor
  projection.consume('update', '|move|p1a: p1-1|Flamethrower|p2a: p2-6\n|split|p1\n|-damage|p1a: p1-1|148/297 brn\n|-damage|p1a: p1-1|50/100 brn\n|-boost|p1a: p1-1|atk|2')
  const member = projection.getView('p1').own.team[0]
  assert.deepEqual(member.hp, { current: 148, max: 297 })
  assert.equal(member.condition, 'brn')
  assert.equal(member.stages.atk, 2)
  assert.deepEqual(projection.getEvents('p1', cursor).map(event => event.type), ['move', 'hp', 'stat'])
  assert.deepEqual(projection.getEvents('p1', cursor)[0].args.fields, ['p1:1', 'Flamethrower', 'p2:revealed:1'])
})

test('opponent items and abilities are learned only through safe public revelations', () => {
  const projection = makeProjection()
  projection.consume('update', splitSwitch('p2', 6, 'Machamp'))
  projection.consume('update', '|move|p2a: p2-6|Cross Chop|p1a: p1-1\n|-heal|p2a: p2-6|100/100|[from] item: Leftovers\n|-weather|SunnyDay|[from] ability: Drought|[of] p2a: p2-6')
  const member = projection.getView('p1').opponent.known[0]
  assert.deepEqual(member.moves, ['Cross Chop'])
  assert.equal(member.item, 'Leftovers')
  assert.equal(member.ability, 'Drought')
  assert.equal(projection.getView('p1').weather, 'SunnyDay')
  projection.consume('update', '|-enditem|p2a: p2-6|Leftovers|[from] move: Knock Off')
  assert.equal(projection.getView('p1').opponent.known[0].item, null)
  assert.equal(projection.getView('p1').opponent.known[0].lastRevealedItem, 'Leftovers')
})

test('raw end records, debug and unrecognized data never enter player views or events', () => {
  const projection = makeProjection()
  projection.consume('end', JSON.stringify({ seed: 'private-seed', teams: ['private-team'], inputLog: 'private-command' }))
  projection.consume('update', '|debug|private-debug\n|html|private-html\n|request|private-request\n|-newmechanic|private-unknown')
  for (const seat of ['p1', 'p2']) {
    const view = projection.getView(seat)
    assert.equal(view.complete, false)
    assert.deepEqual(view.projectionWarnings, ['-newmechanic'])
    assert(!JSON.stringify({ view, events: projection.getEvents(seat) }).includes('private-'))
  }
  projection.consume('result', { kind: 'no-contest', reason: 'worker-recovery-failed', seed: 'private-seed' })
  assert.deepEqual(projection.getView('p1').result, { kind: 'no-contest', winnerSeat: null, reason: 'worker-recovery-failed' })
  const cursor = projection.getView('p1').cursor
  projection.consume('result', { kind: 'no-contest', reason: 'worker-recovery-failed' })
  assert.equal(projection.getView('p1').cursor, cursor)
})

test('private checkpoint restoration reproduces views/cursors and public results are detached and frozen', () => {
  const projection = makeProjection()
  sendRequest(projection, 'p1')
  projection.consume('update', `${splitSwitch('p2', 6, 'Machamp')}\n|move|p2a: p2-6|Cross Chop|p1a: p1-1`)
  const state = projection.exportState()
  const restored = createProjection({ state: JSON.parse(JSON.stringify(state)) })
  for (const seat of ['p1', 'p2']) {
    assert.deepEqual(restored.getView(seat), projection.getView(seat))
    assert.deepEqual(restored.getEvents(seat), projection.getEvents(seat))
    assert.deepEqual(restored.getRequest(seat), projection.getRequest(seat))
  }
  state.viewers.p1.own.team[0].hp.current = 1
  assert.equal(projection.getView('p1').own.team[0].hp.current, 297)
  assert.throws(() => { restored.getView('p1').opponent.known[0].species = 'Mew' }, TypeError)
  assert.throws(() => { restored.getRequest('p1').side.pokemon[0].condition = '0 fnt' }, TypeError)
  const update = '|-status|p2a: p2-6|par\n|turn|2'
  projection.consume('update', update)
  restored.consume('update', update)
  assert.deepEqual(restored.exportState(), projection.exportState())
})

test('seat, cursor and private-request routing reject invalid identity inputs', () => {
  const projection = makeProjection()
  assert.throws(() => projection.getView('__proto__'), TypeError)
  assert.throws(() => projection.getEvents('p1', -1), TypeError)
  assert.throws(() => projection.getEvents('p1', 0.5), TypeError)
  assert.throws(() => sendRequest(projection, 'p1', request('p2')), /seat mismatch/)
  assert.equal(projection.getRequest('p1'), null)
  assert.throws(() => createProjection({ matchId: 'other', state: projection.exportState() }), /identity mismatch/)
})

test('direct pinned Battle callbacks produce isolated protocol views through a full decision batch', () => {
  const projection = makeProjection()
  const { Battle } = getVendor()
  const battle = new Battle({ formatid: 'gen3ubers', seed: 'gen5,0001000200030004',
    send: (type, data) => projection.consume(type, data) })
  try {
    for (const seat of ['p1', 'p2']) battle.setPlayer(seat, {
      name: seat, team: teams[seat].map((set, index) => ({ ...set, name: `${seat}-${index + 1}` })),
    })
    battle.sendUpdates()
    assert.equal(projection.getView('p1').turn, 1)
    assert.equal(projection.getView('p1').own.team.length, 6)
    assert.equal(projection.getView('p1').opponent.known.length, 1)
    assert.equal(projection.getView('p1').complete, true)
    battle.makeChoices()
    battle.sendUpdates()
    assert.equal(projection.getView('p1').turn, 2)
    assert.equal(projection.getView('p2').turn, 2)
    assert.equal(projection.getView('p1').complete, true)
    const ownHp = projection.getView('p1').own.team.find(member => member.active).hp
    assert.deepEqual(ownHp, { current: battle.p1.active[0].hp, max: battle.p1.active[0].maxhp })
    const result = JSON.stringify(projection.getEvents('p1'))
    assert(!result.includes('p2-'))
    assert(!result.includes('Secret '))
    assert(!result.includes('gen5,'))
  } finally { battle.destroy() }
})

test('actual Gen 3 Transform and Skill Swap callbacks survive subsequent base-only private requests', () => {
  const { Battle } = getVendor()
  for (const scenario of [
    { species: 'Ditto', ability: 'Limber', move: 'Transform', transformed: true },
    { species: 'Alakazam', ability: 'Synchronize', move: 'Skill Swap', transformed: false },
  ]) {
    const localTeams = {
      p1: [{ species: scenario.species, ability: scenario.ability, moves: [scenario.move], nature: 'Hardy' }],
      p2: [{ species: 'Charizard', ability: 'Blaze', moves: ['Growl'], nature: 'Hardy' }],
    }
    const projection = createProjection({ matchId: scenario.move, teams: localTeams })
    const battle = new Battle({ formatid: getFormat().id, seed: 'gen5,0001000200030004',
      send: (type, data) => projection.consume(type, data) })
    try {
      for (const seat of ['p1', 'p2']) battle.setPlayer(seat, {
        name: seat, team: localTeams[seat].map((set, index) => ({ ...set, name: `${seat}-${index + 1}` })),
      })
      battle.sendUpdates()
      assert.match(battle.p1.active[0].getHealth().shared, /^\d+\/48$/)
      battle.makeChoices('move 1', 'move 1')
      battle.sendUpdates()
      assert.equal(battle.p1.active[0].ability, 'blaze')
      const privateRequest = projection.getRequest('p1')
      assert.equal(privateRequest.side.pokemon[0].ability, undefined)
      assert.equal(privateRequest.side.pokemon[0].baseAbility, scenario.ability.toLowerCase())
      assert(privateRequest.side.pokemon[0].details.startsWith(scenario.species))
      const view = projection.getView('p1')
      assert.equal(view.complete, true)
      assert.equal(view.own.team[0].ability, null, 'An unrevealed copied ability cannot be inferred from private engine state')
      assert.equal(view.own.team[0].species, scenario.transformed ? 'Charizard' : scenario.species)
      const restored = createProjection({ state: projection.exportState() })
      assert.deepEqual(restored.getView('p1'), view)
    } finally { battle.destroy() }
  }
})
