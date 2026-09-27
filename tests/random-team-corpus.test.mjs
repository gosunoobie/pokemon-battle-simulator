import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { GEN3, GEN3_MANIFEST } from '@battle/game-data'
import { createEngineFactory } from '../packages/battle-engine/src/index.js'
import { validateTeam } from '../packages/battle-engine/src/teams.js'
import { createStarterSetAdapter } from '../packages/battle-engine/src/generation.js'
import { getIdentity } from '../packages/battle-engine/src/profile.js'
import { PINNED_SOURCE, canonicalJson } from '../packages/battle-engine/src/vendor.js'
import collection from '../apps/server/teams/starter-sets.generated.json' with { type: 'json' }
import { buildCollection, fixtureTeam, editableSet } from '../tools/team-generation/build.mjs'
import { LOW_MOVE_EXCEPTIONS, qualityIssues, offensiveCounts } from '../tools/team-generation/policy.mjs'
import { createTeamDraft, toTeamPayload } from '../apps/simulation/src/teamDraft.js'

const adapter = createStarterSetAdapter()
const byId = new Map(collection.entries.map(entry => [entry.speciesId, entry]))
const speciesById = new Map(GEN3.species.map(species => [species.id, species]))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

test('collection covers each base species once and binds its source, policy and profile', () => {
  assert.equal(collection.entries.length, 386)
  assert.equal(byId.size, 386)
  assert.deepEqual([...byId.keys()].sort(), GEN3.species.map(species => species.id).sort())
  assert.equal(collection.profileId, 'gen3opensinglesv1')
  assert.equal(collection.source.vendor.version, PINNED_SOURCE.version)
  assert.equal(collection.source.vendor.treeSha256, PINNED_SOURCE.treeSha256)
  assert.equal(collection.source.dataSha256, GEN3_MANIFEST.artifacts['data/gen3.json'].sha256)
  assert.equal(collection.source.profileSha256, getIdentity().format.definitionSha256)
  for (const [field, path] of [['policySha256', 'tools/team-generation/policy.mjs'], ['builderSha256', 'tools/team-generation/build.mjs'], ['adapterSha256', 'packages/battle-engine/src/generation.js']]) {
    assert.equal(collection.source[field], hash(readFileSync(new URL(`../${path}`, import.meta.url))))
  }
  assert.ok(collection.entries.some(entry => entry.origin === 'vendor-derived'))
  assert.ok(collection.entries.some(entry => entry.origin === 'project-generated'))
  for (const entry of collection.entries) {
    assert.equal(entry.reviewStatus, 'baseline-checked')
    assert.ok(entry.notes.length && entry.role)
    assert.equal(entry.set.species, speciesById.get(entry.speciesId).name)
    assert.ok(!('hpType' in entry.set) && !('role' in entry.set) && !('speciesId' in entry.set))
  }
})

test('every advertised starter set passes actual six-member legality, editor round trip and quality gates', () => {
  for (const entry of collection.entries) {
    const team = fixtureTeam(entry.set)
    const result = validateTeam(team)
    assert.equal(result.valid, true, `${entry.speciesId}: ${JSON.stringify(result.errors)}`)
    const edited = toTeamPayload(createTeamDraft(result.team))
    const repeated = validateTeam(edited)
    assert.equal(repeated.valid, true, `${entry.speciesId} editor round trip: ${JSON.stringify(repeated.errors)}`)
    assert.deepEqual(editableSet(repeated.team[0], adapter), entry.set, `${entry.speciesId} meaningful settings changed`)
    assert.deepEqual(qualityIssues(entry.set, speciesById.get(entry.speciesId), adapter), [], entry.speciesId)
    assert.ok(entry.set.moves.length === 4 || Object.hasOwn(LOW_MOVE_EXCEPTIONS, entry.speciesId))
  }
  // Collection members must also coexist, not only pass alongside one fixture.
  for (let offset = 0; offset < collection.entries.length; offset += 6) {
    const entries = collection.entries.slice(offset, offset + 6)
    entries.push(...collection.entries.slice(0, 6 - entries.length))
    const result = validateTeam(entries.map(entry => structuredClone(entry.set)))
    assert.equal(result.valid, true, JSON.stringify(result.errors))
  }
})

test('all offensive sets retain the appropriate stat investment and Hidden Power type/power', () => {
  const natures = new Set()
  let physicalHiddenPower = 0, specialHiddenPower = 0
  for (const { speciesId, set } of collection.entries) {
    natures.add(set.nature)
    const { physical } = offensiveCounts(set, adapter)
    if (physical && !set.moves.includes('Hidden Power')) assert.equal(set.ivs.atk, 31, speciesId)
    if (set.moves.includes('Hidden Power')) {
      const move = adapter.move('hiddenpower', set.ivs)
      assert.equal(adapter.hiddenPower(set.ivs).power, 70, speciesId)
      if (move.category === 'Physical') physicalHiddenPower++
      else specialHiddenPower++
    }
  }
  assert.ok(physicalHiddenPower > 0 && specialHiddenPower > 0)
  assert.ok(natures.size >= 8, 'role-specific natures replace the demo Hardy default')
  assert.equal(byId.get('machamp').set.evs.atk, 252)
  assert.equal(byId.get('machamp').set.evs.spa, 0)
  assert.equal(byId.get('gengar').set.evs.spa, 252)
  assert.equal(byId.get('gengar').set.evs.atk, 0)
  assert.equal(byId.get('bulbasaur').set.ivs.atk, 31, 'later physical coverage must undo incremental special-only minimization')
  assert.equal(byId.get('shedinja').set.evs.hp, 0, 'HP investment cannot benefit Shedinja')
  assert.equal(byId.get('shedinja').set.evs.spe, 252)
})

test('mechanical exceptions and negative quality cases are explicit', () => {
  assert.deepEqual(byId.get('ditto').set.moves, ['Transform'])
  assert.equal(byId.get('ditto').set.item, 'Metal Powder')
  assert.deepEqual(byId.get('unown').set.moves, ['Hidden Power'])
  assert.deepEqual(adapter.hiddenPower(byId.get('unown').set.ivs), { type: 'Psychic', power: 70 })
  assert.deepEqual(byId.get('wobbuffet').set.moves, ['Counter', 'Mirror Coat', 'Encore', 'Destiny Bond'])
  assert.deepEqual(byId.get('smeargle').set.moves, ['Spore', 'Spikes', 'Substitute', 'Baton Pass'])
  assert.equal(byId.get('clamperl').set.item, 'Deep Sea Tooth')
  assert.equal(byId.get('cubone').set.item, 'Thick Club')
  assert.equal(byId.get('chansey').set.evs.def, 252)
  for (const speciesId of ['mew', 'celebi', 'jirachi', 'deoxys']) {
    assert.equal(validateTeam(fixtureTeam(byId.get(speciesId).set)).valid, true, speciesId)
  }
  const broken = structuredClone(byId.get('machamp').set)
  broken.moves = ['Cross Chop', 'Sleep Talk', 'Rock Slide', 'Earthquake']
  broken.ivs.atk = 0
  assert.ok(qualityIssues(broken, speciesById.get('machamp'), adapter).some(message => message.includes('Rest')))
  assert.ok(qualityIssues(broken, speciesById.get('machamp'), adapter).some(message => message.includes('IV')))
})

test('the deterministic collection build reproduces the committed artifact', () => {
  assert.equal(canonicalJson(buildCollection().collection), canonicalJson(collection))
})

test('representative generated sets can enter and advance authentic battles', t => {
  const factory = createEngineFactory()
  const representatives = ['machamp', 'gengar', 'bulbasaur', 'unown', 'ditto', 'smeargle', 'wobbuffet', 'shedinja', 'jirachi']
  for (const speciesId of representatives) {
    const engine = factory.create({ matchId: `starter-${speciesId}`, seed: [1, 2, 3, 4],
      teams: { p1: fixtureTeam(byId.get(speciesId).set), p2: fixtureTeam(byId.get('wartortle').set) } })
    t.after(() => engine.dispose())
    for (let turn = 0; turn < 4; turn++) {
      for (const seat of ['p1', 'p2']) {
        const decision = engine.getDecision(seat)
        if (!['move', 'switch'].includes(decision.kind)) continue
        const moves = decision.moves.filter(move => !move.disabled)
        const action = decision.kind === 'switch' ? { kind: 'switch', memberId: decision.switches[0].memberId }
          : { kind: 'move', slot: moves[turn % moves.length]?.slot }
        assert.equal(engine.submitDecision(seat, { commandId: `${speciesId}-${turn}-${seat}`, decisionId: decision.id, action }).accepted,
          true, `${speciesId} ${seat} ${JSON.stringify(action)}`)
      }
    }
    assert.ok(engine.getPlayerView('p1').turn >= 4, `${speciesId} battle advanced`)
    assert.ok(engine.getEvents('p1').length > 0)
  }
})
