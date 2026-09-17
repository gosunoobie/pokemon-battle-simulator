import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildInventory, generateInventory } from '../inventory.mjs'
import { sha256, validateTree } from '../metadata.mjs'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const readJson = async path => JSON.parse(await readFile(path, 'utf8'))

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'battle-cry-inventory-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const paths = [
    'tools/cry-import',
    'tools/roster-import/source-lock.json',
    'packages/game-data/data/gen3.json',
    'packages/game-data/data/manifest.json',
  ]
  for (const path of paths) {
    const destination = join(root, path)
    await mkdir(dirname(destination), { recursive: true })
    await cp(join(repository, path), destination, { recursive: true, filter: source => !source.split('/').some(part => part === '.cache' || part === 'node_modules') })
  }
  return root
}

async function snapshot(root) {
  const records = {}
  async function walk(relative) {
    const entries = await readdir(join(root, relative), { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(relative, entry.name)
      if (entry.isDirectory()) await walk(path)
      else {
        const details = await stat(join(root, path))
        records[path] = { sha256: sha256(await readFile(join(root, path))), mtimeMs: details.mtimeMs }
      }
    }
  }
  await walk('')
  return records
}

async function changeJson(path, mutate) {
  const value = await readJson(path)
  mutate(value)
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function inputs() {
  const [data, identities, tree, source] = await Promise.all([
    'packages/game-data/data/gen3.json',
    'tools/roster-import/source-lock.json',
    'tools/cry-import/sources/tree.json',
    'tools/cry-import/source-lock.json',
  ].map(path => readJson(join(repository, path))))
  return { data, identities, tree, source }
}

test('the pinned inventory accounts for all 386 species and 33 forms without claiming audio validation', async () => {
  const { inventory, discrepancies } = buildInventory(await inputs())
  assert.equal(inventory.counts.baseSpecies, 386)
  assert.equal(inventory.counts.forms, 33)
  assert.equal(inventory.counts.identities, 419)
  assert.equal(inventory.counts.direct, 386)
  assert.equal(inventory.counts.sharedIdentity, 27)
  assert.equal(inventory.counts.unresolved, 6)
  assert.equal(inventory.counts.selectedSourceFiles, 386)
  assert.equal(new Set(inventory.mappings.map(row => row.id)).size, 419)
  assert.equal(inventory.counts.downloadedAudioFiles, 0)
  assert.equal(inventory.counts.decodedAudioFiles, 0)
  assert.equal(discrepancies.allIdentitiesAccountedFor, true)
  assert.equal(discrepancies.allMappingsResolved, false)
  assert.equal(discrepancies.readyForPlayback, false)
  assert.match(inventory.limitations.join(' '), /not verified.*Generation 3/i)
  for (const file of inventory.files) {
    assert.match(file.path, /^cries\/pokemon\/legacy\/[1-9]\d*\.ogg$/)
    assert.match(file.gitBlobSha, /^[a-f0-9]{40}$/)
    assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0)
    assert.equal(file.url, inventory.source.rawBaseUrl + file.path)
  }
})

test('Unown reuses Pokémon identity 201 rather than its colliding form IDs', async () => {
  const { inventory } = buildInventory(await inputs())
  const byId = new Map(inventory.mappings.map(row => [row.id, row]))
  const unown = byId.get('unownb'), deoxys = byId.get('deoxysattack')
  assert.equal(unown.pokeapiFormId, deoxys.pokeapiPokemonId)
  assert.equal(unown.pokeapiPokemonId, 201)
  assert.equal(unown.expectedPath, 'cries/pokemon/legacy/201.ogg')
  assert.equal(unown.selectedPath, 'cries/pokemon/legacy/201.ogg')
  assert.equal(unown.sharedWith, 'unown')
  assert.equal(unown.status, 'shared-pokemon-identity')
  assert.equal(deoxys.expectedPath, 'cries/pokemon/legacy/10001.ogg')
  assert.equal(deoxys.selectedPath, null)
  const shared = inventory.mappings.filter(row => row.status === 'shared-pokemon-identity')
  assert.equal(shared.length, 27)
  assert.ok(shared.every(row => row.pokeapiPokemonId === 201 && row.sharedWith === 'unown'))
  assert.equal(inventory.files.find(row => row.path === 'cries/pokemon/legacy/201.ogg').identities.length, 28)
})

test('missing Castform and Deoxys recordings stay unresolved despite available base and latest candidates', async () => {
  const { inventory, discrepancies } = buildInventory(await inputs())
  assert.deepEqual(discrepancies.unresolved.map(row => row.id).sort(), [
    'castformrainy', 'castformsnowy', 'castformsunny', 'deoxysattack', 'deoxysdefense', 'deoxysspeed',
  ])
  for (const discrepancy of discrepancies.unresolved) {
    assert.match(discrepancy.baseCandidate.path, /^cries\/pokemon\/legacy\/(351|386)\.ogg$/)
    assert.match(discrepancy.latestCandidate.path, /^cries\/pokemon\/latest\/100\d\d\.ogg$/)
    const mapping = inventory.mappings.find(row => row.id === discrepancy.id)
    assert.equal(mapping.status, 'unresolved')
    assert.equal(mapping.selectedPath, null)
    assert.equal(mapping.sharedWith, null)
  }
  assert.ok(inventory.files.every(file => file.path.includes('/legacy/')))
})

test('incomplete, duplicate or inconsistent roster identities are rejected', async () => {
  const original = await inputs()
  const mutations = [
    value => { value.data.species.pop() },
    value => { value.data.forms.pop() },
    value => { value.data.forms[0].id = value.data.species[0].id },
    value => { value.data.forms[0].baseSpeciesId = 'missing' },
    value => { value.data.forms[0].num = 386 },
    value => { value.identities.roster.pop() },
    value => { value.identities.roster[1] = { ...value.identities.roster[0] } },
    value => { value.identities.roster[0].num = 0 },
    value => { value.identities.roster[0].pokeapiPokemonId = -1 },
    value => { value.identities.roster[0].pokeapiIdentifier = '../1' },
    value => { value.identities.identitySource.gitCommit = '0'.repeat(40) },
    value => { value.source.source.collection = 'latest' },
    value => { value.source.source.rawBaseUrl = 'https://example.invalid/' },
  ]
  for (const mutate of mutations) {
    const value = structuredClone(original)
    mutate(value)
    assert.throws(() => buildInventory(value))
  }
})

test('the source tree rejects truncation, namespace paths, missing records and altered Git objects', async () => {
  const { tree, source } = await inputs()
  const expected = source.source.gitTree
  assert.ok(validateTree(tree, expected).size > 386)
  const mutations = [
    value => { value.truncated = true },
    value => { value.sha = '0'.repeat(40) },
    value => { value.tree.pop() },
    value => { value.tree.push({ ...value.tree[0] }) },
    value => { value.tree[0].path = '../outside' },
    value => { value.tree[0].path = '/outside' },
    value => { value.tree[0].sha = '0'.repeat(40) },
    value => { value.tree.find(row => row.type === 'blob').size = -1 },
    value => { value.tree.find(row => row.type === 'blob').mode = '120000' },
  ]
  for (const mutate of mutations) {
    const value = structuredClone(tree)
    mutate(value)
    assert.throws(() => validateTree(value, expected))
  }
})

test('inventory generation is offline, deterministic and contains no downloaded audio', async t => {
  const root = await fixture(t)
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network access') })
  const first = await generateInventory({ root })
  const firstFiles = await snapshot(root)
  const second = await generateInventory({ root })
  assert.deepEqual(second, first)
  const secondFiles = await snapshot(root)
  assert.deepEqual(Object.keys(secondFiles), Object.keys(firstFiles))
  for (const path of Object.keys(firstFiles)) {
    assert.equal(secondFiles[path].sha256, firstFiles[path].sha256, `deterministic output: ${path}`)
    assert.doesNotMatch(path, /\.(?:ogg|mp3|wav|flac|opus)$/i, `no audio download: ${path}`)
  }
})

test('check validates the generated inventory without network access or filesystem changes', async t => {
  const root = await fixture(t)
  await generateInventory({ root })
  const before = await snapshot(root)
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network access') })
  await generateInventory({ root, check: true })
  assert.deepEqual(await snapshot(root), before)
})

test('check rejects modified or missing reports without repairing them', async t => {
  for (const name of ['inventory.json', 'discrepancies.json', 'inventory.md']) {
    for (const mutation of ['modified', 'missing']) {
      await t.test(`${name}: ${mutation}`, async child => {
        const root = await fixture(child)
        await generateInventory({ root })
        const path = join(root, 'tools/cry-import/reports', name)
        if (mutation === 'missing') await rm(path)
        else await writeFile(path, 'unreviewed change\n')
        const before = await snapshot(root)
        await assert.rejects(generateInventory({ root, check: true }))
        assert.deepEqual(await snapshot(root), before)
      })
    }
  }
})

test('changed data or identity inputs fail before generated reports are replaced', async t => {
  const cases = [
    ['packages/game-data/data/gen3.json', data => { data.species[0].name = 'Changed source' }],
    ['tools/roster-import/source-lock.json', source => { source.roster[0].pokeapiPokemonId += 1 }],
  ]
  for (const [relative, mutate] of cases) {
    await t.test(relative, async child => {
      const root = await fixture(child)
      await generateInventory({ root })
      await changeJson(join(root, relative), mutate)
      const before = await snapshot(root)
      await assert.rejects(generateInventory({ root }))
      assert.deepEqual(await snapshot(root), before)
    })
  }
})

test('changed source snapshots fail before generated reports are replaced', async t => {
  for (const name of ['commit.json', 'tree.json', 'README.upstream.md', 'LICENSE.upstream.txt']) {
    await t.test(name, async child => {
      const root = await fixture(child)
      await generateInventory({ root })
      const path = join(root, 'tools/cry-import/sources', name)
      await writeFile(path, Buffer.concat([await readFile(path), Buffer.from('\nchanged\n')]))
      const before = await snapshot(root)
      await assert.rejects(generateInventory({ root }), /checksum mismatch/)
      assert.deepEqual(await snapshot(root), before)
    })
  }
})

test('strict readiness rejects unresolved alternate forms without publishing a partial result', async t => {
  const root = await fixture(t)
  await generateInventory({ root })
  const before = await snapshot(root)
  await assert.rejects(generateInventory({ root, requireResolved: true }), /unresolved|missing|blocked/i)
  assert.deepEqual(await snapshot(root), before)
})
