import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { ENGINE_PROFILE, getFormat, getIdentity } from '../src/profile.js'
import { getVendor, PINNED_SOURCE, PINNED_RNG, verifyPinnedPackage } from '../src/vendor.js'
import { validateTeam } from '../src/teams.js'
import { createTeamFixture, createTeamSet } from '../fixtures/team-fixtures.js'

const copy = value => JSON.parse(JSON.stringify(value))
const replacement = set => {
  const team = createTeamFixture()
  team[0] = set
  return team
}
const reject = (team, code) => {
  const result = validateTeam(team)
  assert.equal(result.valid, false)
  assert.equal(result.team, null)
  assert(result.errors.length)
  if (code) assert(result.errors.some(error => error.code === code), JSON.stringify(result.errors))
  return result
}

test('runtime source, data identity and expanded open format are pinned', () => {
  const vendor = getVendor()
  assert.deepEqual(vendor.provenance, {
    ...PINNED_SOURCE, verifiedFileCount: 1585,
    rngDependency: { ...PINNED_RNG, verifiedFileCount: 12 },
  })
  assert.equal(getVendor(), vendor)
  assert.equal(typeof vendor.extractChannelMessages, 'function')
  const format = getFormat()
  const rules = vendor.Dex.formats.getRuleTable(format)
  assert.equal(format.id, 'gen3opensinglesv1')
  assert.equal(format.mod, 'gen3')
  assert.equal(format.debug, false)
  assert.equal(format.battle, undefined)
  assert.equal(rules.maxTeamSize, 6)
  assert.equal(rules.minTeamSize, 6)
  assert.equal(rules.maxMoveCount, 4)
  assert.equal(rules.maxLevel, 100)
  assert.equal(rules.minLevel, 100)
  assert.equal(rules.evLimit, 510)
  for (const rule of ['teampreview', 'cancelmod', 'hppercentagemod', 'sleepclausemod', 'freezeclausemod', 'evasionclause', 'ohkoclause', 'endlessbattleclause']) assert.equal(rules.has(rule), false, rule)
  const identity = getIdentity()
  assert.equal(identity, getIdentity())
  assert.equal(identity.adapter.name, '@battle/battle-engine')
  assert.equal(identity.adapter.checkpointSchemaVersion, 1)
  assert.equal(identity.engine.version, '0.11.11')
  assert.deepEqual(identity.engine.rngDependency, {
    provider: 'ts-chacha20', version: '1.2.0',
    treeSha256: 'e3d334d1573a5331cfa39767a5760d87fedd1d6a677993e8f876dafa6ac01f46',
    verifiedFileCount: 12,
  })
  assert.deepEqual(identity.runtime, { node: process.version, v8: process.versions.v8 })
  assert.match(identity.fingerprint, /^[a-f0-9]{64}$/)
  assert.equal(identity.data.sha256, '1997623fda7c898ff8a4bdc5a5a158cadfdcf2d054a007c40d3c79180a9046fd')
  assert(Object.isFrozen(identity.format))
  assert(Object.isFrozen(ENGINE_PROFILE.definition.ruleset))
  assert.equal(ENGINE_PROFILE.turnLimit, 500)
  assert.equal(ENGINE_PROFILE.choices, 'final')
})

test('RNG provenance rejects changed bytes and versions without touching the installed package', () => {
  const require = createRequire(import.meta.url)
  const upstreamRequire = createRequire(require.resolve('pokemon-showdown/package.json'))
  const installed = dirname(upstreamRequire.resolve('ts-chacha20/package.json'))
  const temporary = mkdtempSync(join(tmpdir(), 'battle-rng-provenance-'))
  const fixture = join(temporary, 'ts-chacha20')
  try {
    cpSync(installed, fixture, { recursive: true })
    assert.equal(verifyPinnedPackage(fixture, PINNED_RNG), 12)
    const implementation = join(fixture, 'build/src/chacha20.js')
    appendFileSync(implementation, '\n// diagnostic tamper in temporary copy\n')
    assert.throws(() => verifyPinnedPackage(fixture, PINNED_RNG), /ts-chacha20.*pinned file tree/)
    const packagePath = join(fixture, 'package.json')
    const metadata = JSON.parse(readFileSync(packagePath, 'utf8'))
    metadata.version = '1.2.1'
    writeFileSync(packagePath, JSON.stringify(metadata))
    assert.throws(() => verifyPinnedPackage(fixture, PINNED_RNG), /exactly ts-chacha20 1\.2\.0/)
    assert.equal(verifyPinnedPackage(installed, PINNED_RNG), 12)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})

test('valid teams are cloned and canonical defaults are explicit changes', () => {
  const input = createTeamFixture()
  delete input[0].evs
  delete input[0].ivs
  delete input[0].level
  input[0].species = 'charizard'
  input[0].ability = 'blaze'
  input[0].moves = ['flamethrower']
  const before = copy(input)
  const result = validateTeam(input)
  assert.equal(result.valid, true, JSON.stringify(result.errors))
  assert.deepEqual(input, before)
  assert.equal(result.team[0].species, 'Charizard')
  assert.equal(result.team[0].level, 100)
  assert.deepEqual(result.team[0].evs, { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 })
  assert.deepEqual(result.team[0].ivs, { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 })
  assert(result.changes.some(change => change.setIndex === 0 && change.field === 'species' && change.before === 'charizard' && change.after === 'Charizard'))
  assert(result.changes.some(change => change.setIndex === 0 && change.field === 'evs' && change.kind === 'added'))
  const again = validateTeam(result.team)
  assert.equal(again.valid, true, JSON.stringify(again.errors))
  assert.deepEqual(again.changes, [])
  result.team[0].ivs.hp = 0
  assert.deepEqual(input, before)
})

test('legal zero EVs remain zero while invalid sets still fail', () => {
  const team = createTeamFixture()
  for (const set of team) set.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  const result = validateTeam(team)
  assert.equal(result.valid, true, JSON.stringify(result.errors))
  assert(result.team.every(set => Object.values(set.evs).every(value => value === 0)))
  team[0].moves = ['Thunderbolt']
  reject(team, 'GEN3_LEGALITY')
})

test('team size, levels, duplicate base species and move limits are enforced', () => {
  reject(createTeamFixture().slice(1), 'TEAM_SIZE')
  reject([...createTeamFixture(), createTeamFixture()[0]], 'TEAM_SIZE')
  for (const level of [0, 50, 99, 101, '100', 100.5, null]) {
    const team = createTeamFixture()
    team[0].level = level
    reject(team, 'LEVEL')
  }
  const duplicate = createTeamFixture()
  duplicate[1] = copy(duplicate[0])
  reject(duplicate, 'SPECIES_CLAUSE')
  const forms = createTeamFixture()
  forms[0] = createTeamSet('Unown', 'Levitate', ['Hidden Power'])
  forms[1] = createTeamSet('Unown-B', 'Levitate', ['Hidden Power'])
  reject(forms, 'SPECIES_CLAUSE')
  for (const moves of [[], ['Scratch', 'Growl', 'Ember', 'Flamethrower', 'Fly']]) {
    const team = createTeamFixture()
    team[0].moves = moves
    reject(team, 'MOVES')
  }
  const repeatedMove = createTeamFixture()
  repeatedMove[0].moves = ['Flamethrower', 'flamethrower']
  reject(repeatedMove, 'DUPLICATE_MOVE')
})

test('open singles admits legendaries, duplicate held items and ordinarily banned moves', () => {
  const team = replacement(createTeamSet('Mewtwo', 'Pressure', ['Double Team', 'Rest', 'Psychic', 'Recover']))
  for (const set of team) set.item = 'Leftovers'
  const result = validateTeam(team)
  assert.equal(result.valid, true, JSON.stringify(result.errors))
})

test('post-Gen-3 species, moves, items and abilities fail', () => {
  reject(replacement(createTeamSet('Garchomp', 'Sand Veil', ['Tackle'])), 'ROSTER')
  const move = createTeamFixture()
  move[0].moves = ['Roost']
  reject(move, 'GEN3_LEGALITY')
  const item = createTeamFixture()
  item[0].item = 'Choice Scarf'
  reject(item, 'GEN3_LEGALITY')
  const ability = createTeamFixture()
  ability[0].ability = 'Solar Power'
  reject(ability, 'GEN3_LEGALITY')
})

test('Gen 3 EV and IV integer bounds are enforced without modern 252 clipping', () => {
  const permitted = createTeamFixture()
  permitted[0].evs = { hp: 255, atk: 255 }
  assert.equal(validateTeam(permitted).valid, true)
  for (const [kind, stat, value] of [['ivs', 'hp', 32], ['ivs', 'spe', -1], ['evs', 'atk', 256], ['evs', 'hp', 1.5], ['evs', 'unknown', 1]]) {
    const team = createTeamFixture()
    team[0][kind] = { [stat]: value }
    reject(team, 'STATS')
  }
  const excess = createTeamFixture()
  excess[0].evs = { hp: 255, atk: 255, spe: 1 }
  reject(excess, 'EV_TOTAL')
})

test('historical full-set source incompatibilities cannot pass individual learnset checks', () => {
  for (const [species, ability, a, b] of [
    ['Shedinja', 'Wonder Guard', 'Swords Dance', 'Baton Pass'],
    ['Pikachu', 'Static', 'Surf', 'Fly'],
  ]) {
    for (const move of [a, b]) {
      const result = validateTeam(replacement(createTeamSet(species, ability, [move])))
      assert.equal(result.valid, true, JSON.stringify(result.errors))
    }
    const result = reject(replacement(createTeamSet(species, ability, [a, b])), 'GEN3_LEGALITY')
    assert(result.errors.some(error => /incompatible/.test(error.message)))
  }
  assert.equal(validateTeam(replacement(createTeamSet('Smeargle', 'Own Tempo', ['Explosion']))).valid, true)
  const struggle = reject(replacement(createTeamSet('Smeargle', 'Own Tempo', ['Struggle'])), 'GEN3_LEGALITY')
  assert(struggle.errors.some(error => /Sketched/.test(error.message)))
})

test('starting-form normalization is reported and legal historical forms stay explicit', () => {
  const result = validateTeam(replacement(createTeamSet('Castform-Sunny', 'Forecast', ['Weather Ball'])))
  assert.equal(result.valid, true, JSON.stringify(result.errors))
  assert.equal(result.team[0].species, 'Castform')
  assert(result.changes.some(change => change.field === 'species' && change.before === 'Castform-Sunny' && change.after === 'Castform'))
  for (const [species, ability, move] of [['Deoxys-Attack', 'Pressure', 'Psychic'], ['Unown-B', 'Levitate', 'Hidden Power']]) {
    const form = validateTeam(replacement(createTeamSet(species, ability, [move])))
    assert.equal(form.valid, true, JSON.stringify(form.errors))
    assert.equal(form.team[0].species, species)
  }
})

test('untrusted non-JSON, unbounded, accessor and unsupported team inputs fail closed', () => {
  reject({ team: createTeamFixture() }, 'TEAM_SIZE')
  const cycle = createTeamFixture()
  cycle[0].evs = cycle
  reject(cycle, 'INVALID_JSON')
  const getter = createTeamFixture()
  let invoked = false
  Object.defineProperty(getter[0], 'species', { get() { invoked = true; return 'Charizard' }, enumerable: true })
  reject(getter, 'INVALID_JSON')
  assert.equal(invoked, false)
  for (const value of [undefined, Infinity, NaN, () => {}, new Date(), 'x'.repeat(257)]) {
    const team = createTeamFixture()
    team[0].item = value
    reject(team, 'INVALID_JSON')
  }
  const malicious = JSON.parse(JSON.stringify(createTeamFixture()).replace('"species":"Charizard"', '"__proto__":{"polluted":true},"species":"Charizard"'))
  reject(malicious, 'INVALID_JSON')
  assert.equal({}.polluted, undefined)
  const future = createTeamFixture()
  future[0].teraType = 'Fire'
  reject(future, 'UNKNOWN_FIELD')
  const sparse = createTeamFixture()
  delete sparse[3]
  reject(sparse, 'INVALID_JSON')
  const protocolText = createTeamFixture()
  protocolText[0].name = 'x\n>forcetie'
  reject(protocolText, 'INVALID_FIELD')
})

test('stable registered format survives a checkpoint in a fresh process', () => {
  const { Battle } = getVendor()
  const format = getFormat()
  const team = validateTeam(createTeamFixture()).team
  const battle = new Battle({ formatid: format.id, seed: 'gen5,0001000200030004', send: () => {} })
  battle.setPlayer('p1', { name: 'One', team: copy(team) })
  battle.setPlayer('p2', { name: 'Two', team: copy(team) })
  const serialized = JSON.stringify(battle.toJSON())
  battle.destroy()
  const profileUrl = new URL('../src/profile.js', import.meta.url).href
  const vendorUrl = new URL('../src/vendor.js', import.meta.url).href
  const code = `import {readFileSync} from 'node:fs'; import {getFormat} from ${JSON.stringify(profileUrl)}; import {getVendor} from ${JSON.stringify(vendorUrl)}; getFormat(); const b=getVendor().Battle.fromJSON(readFileSync(0,'utf8')); console.log(JSON.stringify({id:b.format.id,gen:b.gen,maxTeamSize:b.ruleTable.maxTeamSize,maxMoveCount:b.ruleTable.maxMoveCount,maxLevel:b.ruleTable.maxLevel,debug:b.debugMode,exactHp:b.reportExactHP,cancel:b.supportCancel})); b.destroy();`
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { input: serialized, encoding: 'utf8', timeout: 10000 })
  assert.equal(child.status, 0, child.stderr)
  assert.deepEqual(JSON.parse(child.stdout), { id: 'gen3opensinglesv1', gen: 3, maxTeamSize: 6, maxMoveCount: 4, maxLevel: 100, debug: false, exactHp: false, cancel: false })
})

test('conflicting global format registration is rejected instead of silently adopted', () => {
  const profileUrl = new URL('../src/profile.js', import.meta.url).href
  const vendorUrl = new URL('../src/vendor.js', import.meta.url).href
  const code = `import assert from 'node:assert/strict'; import {getFormat} from ${JSON.stringify(profileUrl)}; import {getVendor} from ${JSON.stringify(vendorUrl)}; const {Dex}=getVendor(); Dex.formats.load(); Dex.formats.rulesetCache.set('gen3opensinglesv1',new Dex.Format({name:'[Gen 3] Open Singles v1',effectType:'Format',mod:'gen9'})); assert.throws(()=>getFormat(),/collides/);`
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 10000 })
  assert.equal(child.status, 0, child.stderr)
})
