import test from 'node:test'
import assert from 'node:assert/strict'
import { STATS, normalizeId, findCatalogRecord, createTeamDraft, selectDraftSpecies, toTeamPayload, draftIssues, readTeamDraft, saveTeamDraft } from '../apps/simulation/src/teamDraft.js'

const catalog = {
  species: [
    { id: 'charizard', name: 'Charizard', baseSpeciesId: 'charizard', abilities: ['blaze'], moveIds: ['flamethrower', 'dragonclaw', 'fly'] },
    { id: 'blastoise', name: 'Blastoise', baseSpeciesId: 'blastoise', abilities: ['torrent'], moveIds: ['surf', 'icebeam'] },
    { id: 'venusaur', name: 'Venusaur', baseSpeciesId: 'venusaur', abilities: ['overgrow'], moveIds: ['gigadrain', 'sludgebomb'] },
    { id: 'raichu', name: 'Raichu', baseSpeciesId: 'raichu', abilities: ['static'], moveIds: ['thunderbolt', 'surf'] },
    { id: 'smeargle', name: 'Smeargle', baseSpeciesId: 'smeargle', abilities: ['owntempo'], moveIds: ['sketch', 'surf', 'thunderbolt', 'icebeam'] },
    { id: 'deoxysattack', name: 'Deoxys-Attack', baseSpeciesId: 'deoxys', kind: 'form', abilities: ['pressure'], moveIds: ['psychic', 'icebeam'] },
    { id: 'deoxys', name: 'Deoxys', baseSpeciesId: 'deoxys', kind: 'base', abilities: ['pressure'], moveIds: ['psychic', 'icebeam'] },
  ],
  moves: ['Flamethrower', 'Dragon Claw', 'Fly', 'Surf', 'Ice Beam', 'Giga Drain', 'Sludge Bomb', 'Thunderbolt', 'Sketch', 'Psychic']
    .map(name => ({ id: normalizeId(name), name })),
  abilities: ['Blaze', 'Torrent', 'Overgrow', 'Static', 'Own Tempo', 'Pressure'].map(name => ({ id: normalizeId(name), name })),
  items: ['Leftovers', 'Sitrus Berry'].map(name => ({ id: normalizeId(name), name })),
  natures: [{ id: 'hardy', name: 'Hardy', plus: null, minus: null }, { id: 'adamant', name: 'Adamant', plus: 'atk', minus: 'spa' }],
  rules: { teamSize: 6, level: 100, maxMoves: 4, maxEv: 255, totalEvs: 510, maxIv: 31 },
}
function readyDraft() {
  return catalog.species.slice(0, 6).map(record => {
    const set = selectDraftSpecies(null, record, catalog)
    set.moves[0] = findCatalogRecord(catalog.moves, record.moveIds[0]).name
    return set
  })
}
function storage() {
  const values = new Map()
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}
const issueCodes = (draft, source = catalog) => draftIssues(draft, source).map(issue => issue.code)

test('empty drafts have six independent editable slots with explicit level, nature, EV and IV defaults', () => {
  const draft = createTeamDraft()
  assert.equal(draft.length, 6)
  assert.deepEqual(STATS, ['hp', 'atk', 'def', 'spa', 'spd', 'spe'])
  assert.deepEqual(draft[0], { species: '', ability: '', item: '', nature: 'Hardy', level: 100,
    moves: ['', '', '', ''], evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, happiness: 255, gender: '' })
  draft[0].evs.hp = 252; draft[0].moves[0] = 'Surf'
  assert.equal(draft[1].evs.hp, 0)
  assert.equal(draft[1].moves[0], '')
  assert.equal(createTeamDraft()[0].evs.hp, 0)
})

test('cloning a preset preserves supported settings without aliasing or copying battle state', () => {
  const input = readyDraft()
  input[0].moves = ['Flamethrower', 'Dragon Claw']
  input[0].evs.hp = 252; input[0].ivs.atk = 0; input[0].happiness = 0; input[0].gender = 'F'
  Object.assign(input[0], { hp: { current: 17 }, fainted: true, cursor: 300, token: 'secret', seed: 'private', name: 'nickname' })
  const saved = structuredClone(input), copy = createTeamDraft(input)
  assert.deepEqual(input, saved)
  assert.deepEqual(copy[0].moves, ['Flamethrower', 'Dragon Claw', '', ''])
  assert.equal(copy[0].evs.hp, 252)
  assert.equal(copy[0].ivs.atk, 0)
  assert.equal(copy[0].happiness, 0)
  assert.equal(copy[0].gender, 'F')
  for (const field of ['hp', 'fainted', 'cursor', 'token', 'seed', 'name']) assert.equal(Object.hasOwn(copy[0], field), false)
  copy[0].moves[0] = 'Fly'; copy[0].evs.hp = 0
  assert.deepEqual(input, saved)
  assert.equal(createTeamDraft(input.slice(0, 1)).length, 6)
  assert.equal(createTeamDraft(input.slice(0, 1))[5].species, '')
})

test('species selection resets incompatible settings and chooses catalog canonical names', () => {
  const previous = readyDraft()[0], saved = structuredClone(previous)
  previous.item = 'Leftovers'; previous.evs.hp = 252
  const selected = selectDraftSpecies(previous, findCatalogRecord(catalog.species, 'DEOXYS-ATTACK'), catalog)
  assert.equal(selected.species, 'Deoxys-Attack')
  assert.equal(selected.ability, 'Pressure')
  assert.equal(selected.item, '')
  assert.equal(selected.nature, 'Hardy')
  assert.deepEqual(selected.moves, ['', '', '', ''])
  assert.ok(Object.values(selected.evs).every(value => value === 0))
  assert.ok(Object.values(selected.ivs).every(value => value === 31))
  assert.equal(previous.species, saved.species)
  assert.equal(previous.item, 'Leftovers')
  assert.equal(previous.evs.hp, 252)
  assert.equal(selectDraftSpecies(previous, null, catalog).species, '')
})

test('catalog matching accepts canonical names and IDs without guessing unknown species or moves', () => {
  assert.equal(findCatalogRecord(catalog.abilities, 'Own Tempo').id, 'owntempo')
  assert.equal(findCatalogRecord(catalog.abilities, 'owntempo').name, 'Own Tempo')
  assert.equal(findCatalogRecord(catalog.moves, 'ice-beam').name, 'Ice Beam')
  assert.equal(normalizeId('Mr. Mime'), 'mrmime')
  assert.equal(findCatalogRecord(catalog.moves, 'Invented Blast'), null)
  assert.equal(findCatalogRecord(catalog.species, ''), null)
  assert.equal(findCatalogRecord(null, 'charizard'), null)
  const draft = readyDraft()
  draft[0].species = 'charizard'; draft[0].ability = 'blaze'; draft[0].moves[0] = 'flamethrower'; draft[0].nature = 'hardy'; draft[0].item = 'sitrusberry'
  assert.deepEqual(draftIssues(draft, catalog), [])
})

test('draft feedback permits deliberate zero EVs and Smeargle candidates supplied by the server', () => {
  const draft = readyDraft()
  draft[4].moves = ['Surf', 'Ice Beam', 'Thunderbolt', '']
  assert.deepEqual(draftIssues(draft, catalog), [])
  draft[0].moves[1] = 'Surf'
  assert.ok(issueCodes(draft).includes('MOVE_CANDIDATE'))
  draft[4].moves[3] = 'Flamethrower'
  assert.ok(draftIssues(draft, catalog).some(issue => issue.code === 'MOVE_CANDIDATE' && issue.setIndex === 4), 'Smeargle uses the received candidate list, not a blanket allow-all exception')
})

test('six distinct base species are required even when alternate form names differ', () => {
  const draft = readyDraft()
  draft[0] = selectDraftSpecies(null, catalog.species[6], catalog); draft[0].moves[0] = 'Psychic'
  assert.deepEqual(draftIssues(draft, catalog).filter(issue => issue.code === 'SPECIES_CLAUSE').map(issue => issue.setIndex), [5])
  assert.ok(issueCodes(draft.slice(0, 5)).includes('TEAM_SIZE'))
  assert.ok(issueCodes([...draft, draft[0]]).includes('TEAM_SIZE'))
  assert.ok(issueCodes(null).includes('TEAM_SIZE'))
  assert.deepEqual(draftIssues(readyDraft(), null).map(issue => issue.code), ['CATALOG_UNAVAILABLE'])
})

test('move editing retains four draft fields while payloads remove blanks and keep order', () => {
  const draft = readyDraft()
  draft[0].moves = ['', ' Dragon Claw ', '', 'Fly']
  draft[0].uiExpanded = true
  const saved = structuredClone(draft), payload = toTeamPayload(draft)
  assert.deepEqual(payload[0].moves, ['Dragon Claw', 'Fly'])
  assert.equal(Object.hasOwn(payload[0], 'uiExpanded'), false)
  assert.deepEqual(draft, saved)
  payload[0].ivs.hp = 1
  assert.equal(draft[0].ivs.hp, 31)
  assert.equal(issueCodes(draft).includes('MOVES'), false)
  draft[0].moves = ['', '', '', '']
  assert.ok(issueCodes(draft).includes('MOVES'))
  draft[0].moves = ['Dragon Claw', 'dragonclaw', '', '']
  assert.ok(issueCodes(draft).includes('DUPLICATE_MOVE'))
  draft[0].moves = ['Fly', '', '', '', 'Dragon Claw']
  assert.ok(issueCodes(draft).includes('MOVES'))
})

test('candidate feedback checks ability, held item and nature references independently', () => {
  const draft = readyDraft()
  draft[0].ability = 'Torrent'; draft[0].item = 'Invented Item'; draft[0].nature = 'Invented Nature'
  const issues = draftIssues(draft, catalog)
  for (const code of ['ABILITY', 'ITEM', 'NATURE']) assert.ok(issues.some(issue => issue.code === code && issue.setIndex === 0))
  draft[0].species = 'MissingMon'
  assert.ok(issueCodes(draft).includes('SPECIES'))
})

test('EV/IV bounds, total EVs, integer values, level, gender and happiness receive structural feedback', () => {
  const draft = readyDraft()
  draft[0].evs = { hp: 255, atk: 255, def: 0, spa: 0, spd: 0, spe: 0 }
  assert.deepEqual(draftIssues(draft, catalog), [])
  draft[0].evs.spe = 1
  assert.ok(issueCodes(draft).includes('EV_TOTAL'))
  draft[0].evs.hp = 256; draft[0].ivs.atk = 32
  assert.ok(issueCodes(draft).includes('EVS'))
  assert.ok(issueCodes(draft).includes('IVS'))
  draft[0].evs.hp = -1; draft[0].ivs.atk = 0.5
  assert.ok(issueCodes(draft).includes('EVS'))
  assert.ok(issueCodes(draft).includes('IVS'))
  draft[0].evs.hp = '252'; draft[0].ivs.atk = undefined
  assert.ok(issueCodes(draft).includes('EVS'))
  assert.ok(issueCodes(draft).includes('IVS'))
  draft[0].level = 50; draft[0].happiness = 256; draft[0].gender = 'invalid'
  for (const code of ['LEVEL', 'HAPPINESS', 'GENDER']) assert.ok(issueCodes(draft).includes(code))
})

test('saved drafts round-trip blanks and defaults in one versioned key without storing live battle state', () => {
  const store = storage(), draft = readyDraft()
  draft[2].moves = ['', 'Sludge Bomb', '', '']
  draft[2].hp = { current: 0, max: 300 }; draft[2].status = 'fnt'; draft[2].serverSeed = 'private'
  assert.equal(saveTeamDraft(store, draft), true)
  assert.equal(store.values.size, 1)
  const [key, raw] = [...store.values][0], saved = JSON.parse(raw)
  assert.equal(saved.version, 1)
  assert.equal(saved.team.length, 6)
  assert.ok(key.includes('draft'))
  assert.equal(raw.includes('serverSeed'), false)
  assert.equal(raw.includes('current'), false)
  const restored = readTeamDraft(store)
  assert.deepEqual(restored, createTeamDraft(draft))
  assert.deepEqual(restored[2].moves, ['', 'Sludge Bomb', '', ''])
  restored[2].evs.hp = 252
  assert.equal(readTeamDraft(store)[2].evs.hp, 0)
  assert.equal(saveTeamDraft(store, createTeamDraft()), true)
  assert.equal(store.values.size, 1)
  assert.deepEqual(readTeamDraft(store), createTeamDraft())
})

test('unavailable storage, quota failures, corrupt/unsupported versions and oversized data fail safely', () => {
  assert.equal(readTeamDraft(null), null)
  assert.equal(saveTeamDraft(null, readyDraft()), false)
  assert.equal(readTeamDraft({ getItem() { throw new Error('blocked') } }), null)
  assert.equal(saveTeamDraft({ setItem() { throw new Error('quota') } }, readyDraft()), false)
  const cases = [null, '{', '{}', 'x'.repeat(16385), JSON.stringify({ version: 2, team: readyDraft() }),
    JSON.stringify({ version: 1, team: readyDraft().slice(0, 5) }), JSON.stringify({ version: 1, team: [null, null, null, null, null, null] })]
  for (const raw of cases) assert.equal(readTeamDraft({ getItem: () => raw }), null)
  assert.equal(saveTeamDraft(storage(), []), false)
  const oversizedName = readyDraft(); oversizedName[0].species = 'x'.repeat(65)
  assert.equal(saveTeamDraft(storage(), oversizedName), false)
  assert.equal(readTeamDraft({ getItem: () => JSON.stringify({ version: 1, team: oversizedName }) }), null)
})

test('cloning and persistence cannot invoke imported accessors or copy inherited fields', () => {
  let accessed = 0
  const draft = readyDraft()
  Object.defineProperty(draft[0], 'species', { enumerable: true, get() { accessed++; throw new Error('must not run') } })
  assert.equal(createTeamDraft(draft)[0].species, '')
  assert.equal(saveTeamDraft(storage(), draft), false)
  assert.equal(accessed, 0)
  const inherited = Object.create({ species: 'Charizard', ability: 'Blaze' })
  assert.equal(createTeamDraft([inherited])[0].species, '')
  const withArrayGetter = readyDraft()
  Object.defineProperty(withArrayGetter, 0, { get() { accessed++; throw new Error('must not run') } })
  assert.equal(createTeamDraft(withArrayGetter)[0].species, '')
  assert.equal(saveTeamDraft(storage(), withArrayGetter), false)
  assert.equal(accessed, 0)
})

test('prototype-pollution keys in persisted JSON are rejected and unsupported fields are sanitized', () => {
  const safe = JSON.stringify({ version: 1, team: readyDraft() })
  const polluted = safe.replace('"species":"Charizard"', '"species":"Charizard","__proto__":{"polluted":true}')
  assert.equal(readTeamDraft({ getItem: () => polluted }), null)
  assert.equal({}.polluted, undefined)
  const constructor = safe.replace('"species":"Charizard"', '"species":"Charizard","constructor":{"prototype":{"polluted":true}}')
  assert.equal(readTeamDraft({ getItem: () => constructor }), null)
  const rawTeam = readyDraft(); rawTeam[0].hiddenBattle = { seed: 'private' }; rawTeam[0].evs.unknown = 999
  const restored = readTeamDraft({ getItem: () => JSON.stringify({ version: 1, team: rawTeam }) })
  assert.equal(Object.hasOwn(restored[0], 'hiddenBattle'), false)
  assert.equal(Object.hasOwn(restored[0].evs, 'unknown'), false)
})

test('draft checks and payload construction leave frozen inputs and the catalog untouched', () => {
  const draft = readyDraft(), saved = structuredClone(draft), source = structuredClone(catalog)
  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
    return value
  }
  freeze(draft); freeze(source)
  assert.deepEqual(draftIssues(draft, source), [])
  assert.equal(toTeamPayload(draft).length, 6)
  assert.equal(saveTeamDraft(storage(), draft), true)
  assert.deepEqual(draft, saved)
  assert.deepEqual(source, catalog)
})
