import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { buildMappings } from '../sfx-mappings.mjs'

const source = file => ({ file })
const move = (id, name = id) => ({ id, name })
const basePolicy = () => ({
  schemaVersion: 1, name: 'fixture-v1', moveNameAliases: {}, fxAliases: {},
  calledMoves: {}, genericFiles: {}, deferredEvents: {},
})
const fixture = overrides => ({
  files: [source('Tackle.mp3')], moves: [move('tackle', 'Tackle')],
  fxCatalog: [{ id: 'tackle', name: 'Tackle' }], policy: basePolicy(), ...overrides,
})

test('classifies the complete pinned collection without approving any playback', async () => {
  const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
  const [lock, data, policy, { FX_CATALOG }] = await Promise.all([
    readJson('../source-lock.json'), readJson('../../../packages/game-data/data/gen3.json'),
    readJson('../mapping-policy.json'), import('../../../packages/battle-fx/src/catalog.js'),
  ])
  const output = buildMappings({ files: lock.files, moves: data.moves, fxCatalog: FX_CATALOG, policy })
  assert.equal(output.assets.length, 530)
  assert.equal(new Set(output.assets.map(asset => asset.id)).size, 530)
  assert.equal(new Set(output.assets.map(asset => asset.file)).size, 530)
  assert.equal(Object.keys(output.moves).length, 354)
  assert.equal(Object.values(output.moves).filter(record => record.status === 'candidate').length, 352)
  assert.equal(Object.values(output.moves).filter(record => record.fxId).length, 335)
  assert.deepEqual(Object.values(output.moves).filter(record => !record.assetIds.length).map(record => record.id), ['mirrormove', 'naturepower'])
  assert.equal(Object.values(output.events).filter(record => record.status === 'candidate').length, 18)
  assert.equal(Object.values(output.events).filter(record => record.status === 'deferred').length, 10)
  assert.deepEqual(output.assets.reduce((counts, asset) => {
    counts[asset.variant.type] = (counts[asset.variant.type] ?? 0) + 1
    return counts
  }, {}), { part: 134, whole: 335, 'hit-count': 32, 'turn-effect': 9, generic: 18, outcome: 2 })
  assert.equal(output.moves.visegrip.fxId, 'vice-grip')
  assert.deepEqual(output.moves.visegrip.assetIds, ['source.vice-grip'])
  assert.equal(output.moves.mirrormove.status, 'called-move')
  assert.equal(output.moves.naturepower.status, 'called-move')
  for (const record of [...Object.values(output.moves), ...Object.values(output.events)]) {
    assert.deepEqual(record.playback, { normal: 'unreviewed', reduced: 'unreviewed', instant: 'unreviewed' })
    assert.notEqual(record.status, 'approved')
  }
  for (const asset of output.assets) assert.equal(asset.reviewStatus, 'candidate')
  assert.equal(output.discrepancies.filter(entry => entry.code === 'MOVE_WITHOUT_FX').length, 19)
  assert.equal(output.discrepancies.filter(entry => entry.code === 'CALLED_MOVE_WITHOUT_RECORDING').length, 2)
  assert.equal(output.events['battle.release.pokeball'].assetIds.length, 0)
  assert.equal(output.events['battle.low-health.loop'].initialRelease, 'deferred')
})

test('records literal suffix labels without inferring launch, impact or engine hit counts', () => {
  const output = buildMappings(fixture({ files: [
    'Tackle.mp3', 'Tackle part 2.mp3', 'Tackle 2hits.mp3',
    'Tackle turn damage.mp3', 'Tackle heal.mp3',
  ].map(source) }))
  assert.deepEqual(output.assets.map(asset => asset.variant), [
    { type: 'hit-count', hitCount: 2 }, { type: 'outcome', outcome: 'heal' },
    { type: 'part', part: 2 }, { type: 'turn-effect', outcome: 'damage' }, { type: 'whole' },
  ])
  assert.ok(output.assets.every(asset => asset.kind === 'move' && asset.moveId === 'tackle'))
  assert.ok(output.assets.every(asset => !Object.hasOwn(asset, 'cue') && !Object.hasOwn(asset, 'phase')))
})

test('uses explicit renamed-move and FX aliases and does not alter canonical IDs', () => {
  const policy = basePolicy()
  policy.moveNameAliases['Vice Grip'] = { moveId: 'visegrip', reason: 'Previous spelling.' }
  policy.fxAliases['vice-grip'] = { moveId: 'visegrip', reason: 'Existing FX ID.' }
  const output = buildMappings(fixture({
    files: [source('Vice Grip.mp3')], moves: [move('visegrip', 'Vise Grip')],
    fxCatalog: [{ id: 'vice-grip', name: 'Vice Grip' }], policy,
  }))
  assert.equal(output.assets[0].moveId, 'visegrip')
  assert.equal(output.moves.visegrip.fxId, 'vice-grip')
})

test('keeps missing and called moves explicit and never substitutes a sound', () => {
  const policy = basePolicy()
  policy.calledMoves.mirrormove = { reason: 'Only use a later server-revealed executed move after review.' }
  const output = buildMappings(fixture({ moves: [move('tackle'), move('mirrormove'), move('missing')], policy }))
  assert.equal(output.moves.mirrormove.status, 'called-move')
  assert.equal(output.moves.missing.status, 'missing')
  assert.deepEqual(output.moves.mirrormove.assetIds, [])
  assert.deepEqual(output.moves.missing.assetIds, [])
  assert.equal(output.moves.missing.fxId, null)
  assert.ok(output.discrepancies.some(entry => entry.code === 'MOVE_WITHOUT_RECORDING' && entry.subject === 'missing'))
})

test('classifies filename-exact generic events and explicit unavailable sounds separately', () => {
  const policy = basePolicy()
  policy.genericFiles['Recall.mp3'] = { eventId: 'battle.recall', reason: 'Recall filename candidate.' }
  policy.deferredEvents['battle.release'] = 'No known release asset.'
  const output = buildMappings(fixture({ files: [source('Recall.mp3'), source('Tackle.mp3')], policy }))
  const recall = output.assets.find(asset => asset.file === 'Recall.mp3')
  assert.equal(recall.kind, 'battle-event')
  assert.equal(recall.moveId, null)
  assert.equal(recall.eventId, 'battle.recall')
  assert.equal(output.events['battle.recall'].status, 'candidate')
  assert.equal(output.events['battle.release'].status, 'deferred')
  assert.deepEqual(output.events['battle.release'].assetIds, [])
})

test('output is deterministic under input reorder and does not mutate inputs', () => {
  const input = fixture({
    files: [source('Tackle.mp3'), source('Cut.mp3')], moves: [move('tackle'), move('cut')],
    fxCatalog: [{ id: 'tackle', name: 'Tackle' }, { id: 'cut', name: 'Cut' }],
  })
  const before = structuredClone(input)
  const first = buildMappings(input)
  const second = buildMappings({ ...input, files: [...input.files].reverse(), moves: [...input.moves].reverse(), fxCatalog: [...input.fxCatalog].reverse() })
  assert.deepEqual(first, second)
  assert.deepEqual(input, before)
})

test('unknown, malformed and duplicate filenames fail closed', () => {
  for (const file of ['Unknown.mp3', 'Tackle part 0.mp3', 'Tackle part 01.mp3', 'Tackle part 9007199254740992.mp3', '../Tackle.mp3', 'Tackle.wav', 'Tackle.mp3/extra']) {
    assert.throws(() => buildMappings(fixture({ files: [source(file)] })), /Unclassified|Invalid/)
  }
  assert.throws(() => buildMappings(fixture({ files: [source('Tackle.mp3'), source('Tackle.mp3')] })), /Duplicate source filename/)
  assert.throws(() => buildMappings(fixture({ files: [source('Tackle.mp3'), source('TACKLE.mp3')] })), /Duplicate normalized asset ID/)
})

test('duplicate canonical names and conflicting FX identity fail closed', () => {
  assert.throws(() => buildMappings(fixture({ moves: [move('tackle'), move('tackle')] })), /Duplicate move ID/)
  assert.throws(() => buildMappings(fixture({ moves: [move('tackle'), move('other', 'Tackle')] })), /Ambiguous move label/)
  assert.throws(() => buildMappings(fixture({ fxCatalog: [{ id: 'unknown', name: 'Unknown' }] })), /Unknown FX mapping/)
  assert.throws(() => buildMappings(fixture({ moves: [move('tackle'), move('cut')], fxCatalog: [{ id: 'tackle', name: 'Cut' }] })), /Ambiguous FX mapping/)
  assert.throws(() => buildMappings(fixture({ fxCatalog: [{ id: 'tackle', name: 'Tackle' }, { id: 'tackle', name: 'Tackle' }] })), /Duplicate FX ID/)
  assert.throws(() => buildMappings(fixture({ fxCatalog: [{ id: 'tackle', name: 'Tackle' }, { id: 'tack-le', name: 'Tackle' }] })), /Multiple FX recipes/)
})

test('stale, conflicting, unknown-target and orphan aliases fail closed', () => {
  for (const field of ['moveNameAliases', 'fxAliases']) {
    const policy = basePolicy()
    policy[field].Old = { moveId: 'tackle', reason: 'Old label.' }
    assert.throws(() => buildMappings(fixture({ policy })), /Orphan/)
    policy[field] = { Tackle: { moveId: 'tackle', reason: 'Redundant.' } }
    assert.throws(() => buildMappings(fixture({ policy })), /Redundant or conflicting/)
    policy[field] = { Old: { moveId: 'unknown', reason: 'Invalid target.' } }
    assert.throws(() => buildMappings(fixture({ policy })), /Unknown .* target/)
    policy[field] = { Old: { moveId: 'tackle', reason: 'Old.' }, 'O-ld': { moveId: 'tackle', reason: 'Ambiguous.' } }
    assert.throws(() => buildMappings(fixture({ policy })), /Ambiguous/)
  }
})

test('orphan generic policies and conflicting deferred event IDs fail closed', () => {
  const policy = basePolicy()
  policy.genericFiles['Recall.mp3'] = { eventId: 'battle.recall', reason: 'Candidate.' }
  assert.throws(() => buildMappings(fixture({ policy })), /Orphan generic file/)
  policy.deferredEvents['battle.recall'] = 'Conflict.'
  assert.throws(() => buildMappings(fixture({ policy })), /Deferred event overlaps/)
  delete policy.deferredEvents['battle.recall']
  policy.genericFiles['Other.mp3'] = { eventId: 'battle.recall', reason: 'Duplicate.' }
  assert.throws(() => buildMappings(fixture({ policy })), /Duplicate generic event ID/)
})

test('called-move policies fail if unknown or no longer missing a named file', () => {
  const policy = basePolicy()
  policy.calledMoves.unknown = { reason: 'Not a real move.' }
  assert.throws(() => buildMappings(fixture({ policy })), /Orphan called-move policy/)
  delete policy.calledMoves.unknown
  policy.calledMoves.tackle = { reason: 'Stale assumption.' }
  assert.throws(() => buildMappings(fixture({ policy })), /Called-move policy is stale/)
})

test('policy schema and semantic event IDs are validated', () => {
  const policy = basePolicy()
  policy.schemaVersion = 2
  assert.throws(() => buildMappings(fixture({ policy })), /Unsupported/)
  policy.schemaVersion = 1
  policy.typo = {}
  assert.throws(() => buildMappings(fixture({ policy })), /Unknown mapping policy field/)
  delete policy.typo
  policy.deferredEvents['__proto__.release'] = 'Invalid.'
  assert.throws(() => buildMappings(fixture({ policy })), /Invalid event ID/)
})
