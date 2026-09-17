import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchCrySources, originalPath, readRegular, verifyCrySource } from '../fetch.mjs'
import { gitHash, sha256 } from '../metadata.mjs'
import { generateCryAssets } from '../assets.mjs'
import { resolveCryMappings } from '../aliases.mjs'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const readJson = async path => JSON.parse(await readFile(path, 'utf8'))
const inventory = await readJson(join(repository, 'tools/cry-import/reports/inventory.json'))
let deployedSources

async function sourceBytes(file) {
  const original = await readRegular(originalPath(repository, file))
  if (original) return original
  // The deployed files preserve upstream bytes, so fresh-checkout tests can
  // exercise fetching from fixtures without retaining an ignored source cache.
  deployedSources ??= (async () => {
    const directory = join(repository, 'public/audio/cries')
    const sources = new Map()
    for (const name of await readdir(directory)) {
      if (!name.endsWith('.ogg')) continue
      const bytes = await readFile(join(directory, name))
      sources.set(gitHash('blob', bytes), bytes)
    }
    return sources
  })()
  const bytes = (await deployedSources).get(file.gitBlobSha)
  assert.ok(bytes, `Missing verified fixture for ${file.path}`)
  verifyCrySource(bytes, file)
  return bytes
}

async function fixture(t, { originals = true, generated = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'battle-cry-assets-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const paths = [
    'tools/cry-import',
    'tools/roster-import/source-lock.json',
    'packages/game-data/data/gen3.json',
    'packages/game-data/data/manifest.json',
  ]
  if (generated) paths.push('public/audio/cries', 'packages/pokemon-cries')
  for (const path of paths) {
    const destination = join(root, path)
    await mkdir(dirname(destination), { recursive: true })
    await cp(join(repository, path), destination, {
      recursive: true,
      filter: source => !source.split('/').includes('node_modules') &&
        (originals || !source.split('/').includes('.cache')),
    })
  }
  if (originals) {
    for (const file of inventory.files) {
      const destination = originalPath(root, file)
      if (!await readRegular(destination)) {
        await mkdir(dirname(destination), { recursive: true })
        await writeFile(destination, await sourceBytes(file))
      }
    }
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
      else if (entry.isSymbolicLink()) {
        records[path] = { target: await readlink(join(root, path)), mtimeMs: (await lstat(join(root, path))).mtimeMs }
      }
      else {
        const details = await stat(join(root, path))
        records[path] = { sha256: sha256(await readFile(join(root, path))), mtimeMs: details.mtimeMs }
      }
    }
  }
  await walk('')
  return records
}

test('cry sources require the pinned byte length and Git blob identity', async () => {
  const file = inventory.files[0]
  const bytes = await sourceBytes(file)
  assert.doesNotThrow(() => verifyCrySource(bytes, file))
  const changed = Buffer.from(bytes)
  changed[changed.length - 1] ^= 1
  for (const corrupt of [null, Buffer.from('<html>not audio</html>'), bytes.subarray(1), changed]) {
    assert.throws(() => verifyCrySource(corrupt, file), /Pinned cry content mismatch/)
  }
  assert.throws(() => verifyCrySource(bytes, { ...file, gitBlobSha: '0'.repeat(40) }), /mismatch/)
})

test('the cry cache rejects traversal and other recording collections', () => {
  for (const path of ['../1.ogg', 'cries/pokemon/latest/1.ogg', 'cries/pokemon/legacy/../1.ogg',
    'cries/pokemon/legacy/0.ogg', 'cries/pokemon/legacy/1.mp3']) {
    assert.throws(() => originalPath(repository, { path }), /Unexpected cry source path/)
  }
})

test('an already verified source cache is reused without network or file writes', async t => {
  const root = await fixture(t)
  const before = await snapshot(root)
  const result = await fetchCrySources({ root, fetcher: () => assert.fail('Unexpected network request') })
  assert.deepEqual(result, { downloaded: 0, reused: 386, total: 386 })
  assert.deepEqual(await snapshot(root), before)
})

test('fetch resumes only missing pinned recordings and validates before storing', async t => {
  const root = await fixture(t)
  const file = inventory.files[4]
  const bytes = await readFile(originalPath(root, file))
  await rm(originalPath(root, file))
  const calls = [], progress = []
  const result = await fetchCrySources({
    root,
    fetcher: async (url, options) => {
      calls.push(url)
      assert.equal(options.redirect, 'error')
      assert.ok(options.signal instanceof AbortSignal)
      return new Response(bytes, { headers: { 'content-length': String(bytes.length) } })
    },
    onProgress: value => progress.push(value),
  })
  assert.deepEqual(calls, [file.url])
  assert.deepEqual(result, { downloaded: 1, reused: 385, total: 386 })
  assert.deepEqual(progress, [{ downloaded: 1, reused: 385, total: 386 }])
  assert.deepEqual(await readFile(originalPath(root, file)), bytes)
})

test('a modified cached original fails before any missing cry is fetched or overwritten', async t => {
  const root = await fixture(t)
  await rm(originalPath(root, inventory.files[0]))
  await writeFile(originalPath(root, inventory.files[1]), 'unreviewed original')
  const before = await snapshot(root)
  await assert.rejects(fetchCrySources({ root, fetcher: () => assert.fail('Unexpected network request') }), /Pinned cry content mismatch/)
  assert.deepEqual(await snapshot(root), before)
})

test('source fetching validates its concurrency bound', async () => {
  for (const concurrency of [0, -1, 9, 1.5, NaN, '2']) {
    await assert.rejects(fetchCrySources({ concurrency, fetcher: () => assert.fail('Unexpected network request') }), /concurrency/)
  }
})

test('fetching never exceeds the configured parallel request budget', async t => {
  const root = await fixture(t)
  const expected = new Map()
  for (const file of inventory.files.slice(0, 7)) {
    expected.set(file.url, await readFile(originalPath(root, file)))
    await rm(originalPath(root, file))
  }
  let active = 0, maximum = 0, calls = 0
  const result = await fetchCrySources({ root, concurrency: 3, fetcher: async url => {
    active++; calls++; maximum = Math.max(active, maximum)
    try {
      assert.ok(expected.has(url), `Only missing pinned URLs may be requested: ${url}`)
      await new Promise(done => setTimeout(done, 5))
      return new Response(expected.get(url))
    } finally { active-- }
  } })
  assert.equal(calls, 7)
  assert.equal(maximum, 3)
  assert.deepEqual(result, { downloaded: 7, reused: 379, total: 386 })
})

test('failed integrity and oversized responses are retried finitely and never published', async t => {
  for (const kind of ['wrong-content', 'oversized-header', 'oversized-stream']) {
    await t.test(kind, async child => {
      const root = await fixture(child)
      const file = inventory.files[0]
      const bytes = await readFile(originalPath(root, file))
      await rm(originalPath(root, file))
      const before = await snapshot(root)
      let calls = 0
      await assert.rejects(fetchCrySources({ root, concurrency: 1, fetcher: async () => {
        calls++
        if (kind === 'wrong-content') return new Response(Buffer.alloc(bytes.length))
        if (kind === 'oversized-header') return new Response(bytes, { headers: { 'content-length': String(bytes.length + 1) } })
        return new Response(Buffer.concat([bytes, Buffer.from([0])]))
      } }), /mismatch|Oversized cry response/)
      assert.equal(calls, 3)
      assert.deepEqual(await snapshot(root), before)
    })
  }
})

test('source reads reject directories and symlinks', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cry-regular-file-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const target = join(root, 'source.ogg'), link = join(root, 'link.ogg')
  await writeFile(target, 'test')
  await symlink(target, link)
  await assert.rejects(readRegular(root), /regular file/)
  await assert.rejects(readRegular(link), /regular file/)
  assert.equal(await readRegular(join(root, 'missing.ogg')), null)
})

test('published assets account for every roster identity and preserve all pinned source bytes', async t => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Asset validation must be offline'))
  const { manifest, report, catalog } = await generateCryAssets({ check: true })
  assert.deepEqual(report.counts, {
    identities: 419, baseSpecies: 386, forms: 33, direct: 386,
    sharedPokemonIdentity: 27, verifiedFormAliases: 6, unresolved: 0,
    sourceFiles: 386, deployedAudioFiles: 386, decodedFiles: 386,
  })
  assert.equal(report.sourceBytes, 2245221)
  assert.equal(report.deployedAudioBytes, report.sourceBytes)
  assert.equal(report.reencoded, false)
  assert.equal(report.trimmed, false)
  assert.equal(report.normalized, false)
  assert.equal(Object.keys(catalog.pokemon).length, 419)
  assert.equal(Object.keys(catalog.assets).length, 386)
  const paths = new Map(manifest.files.map(file => [file.source.path, file]))
  assert.equal(paths.size, 386)
  for (const expected of inventory.files) {
    const file = paths.get(expected.path)
    assert.ok(file, expected.path)
    const deployed = await readFile(join(repository, 'public/audio/cries', file.asset))
    verifyCrySource(deployed, expected)
    assert.equal(sha256(deployed), file.sha256)
    assert.equal(file.asset, `${file.sha256}.ogg`)
    assert.deepEqual(deployed, await sourceBytes(expected))
    assert.equal(file.format.codec, 'vorbis')
    assert.ok(file.format.sampleFrames > 0)
    assert.ok(file.format.durationSeconds > 0 && file.format.durationSeconds < 30)
  }
  assert.deepEqual((await readdir(join(repository, 'public/audio/cries'))).sort(), [
    ...manifest.files.map(file => file.asset), 'manifest.json', 'UPSTREAM-LICENSE.txt',
  ].sort())
  const upstream = await readFile(join(repository, 'tools/cry-import/sources/LICENSE.upstream.txt'))
  assert.deepEqual(await readFile(join(repository, 'public/audio/cries/UPSTREAM-LICENSE.txt')), upstream)
  assert.deepEqual(await readFile(join(repository, 'packages/pokemon-cries/UPSTREAM-LICENSE.txt')), upstream)
})

test('all form aliases resolve explicitly without conflating Pokémon IDs and form IDs', async () => {
  const catalog = await readJson(join(repository, 'packages/pokemon-cries/data/catalog.json'))
  assert.equal(catalog.pokemon.unownb.assetId, catalog.pokemon.unown.assetId)
  assert.notEqual(catalog.pokemon.unownb.assetId, catalog.pokemon.deoxysattack.assetId)
  assert.equal(catalog.pokemon.unownb.status, 'shared-pokemon-identity')
  for (const id of ['castformrainy', 'castformsnowy', 'castformsunny']) {
    assert.deepEqual(catalog.pokemon[id], {
      assetId: catalog.pokemon.castform.assetId, status: 'verified-form-alias', sharedWith: 'castform',
    })
  }
  for (const id of ['deoxysattack', 'deoxysdefense', 'deoxysspeed']) {
    assert.deepEqual(catalog.pokemon[id], {
      assetId: catalog.pokemon.deoxys.assetId, status: 'verified-form-alias', sharedWith: 'deoxys',
    })
  }
})

test('a fresh checkout passes offline validation without the ignored original cache or writes', async t => {
  const root = await fixture(t, { originals: false, generated: true })
  assert.equal(await readRegular(join(root, 'tools/cry-import/.cache/originals/1.ogg')), null)
  const before = await snapshot(root)
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Asset validation must be offline'))
  await generateCryAssets({ root, check: true })
  assert.deepEqual(await snapshot(root), before)
})

test('rebuilding from deployed source bytes is deterministic and requires no network', async t => {
  const root = await fixture(t, { originals: false, generated: true })
  const before = await snapshot(root)
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Asset generation must be offline'))
  const generated = await generateCryAssets({ root })
  const checked = await generateCryAssets({ root, check: true })
  assert.deepEqual(generated, checked)
  const after = await snapshot(root)
  assert.deepEqual(Object.keys(after), Object.keys(before))
  for (const path of Object.keys(before)) assert.equal(after[path].sha256, before[path].sha256, path)
})

test('offline validation rejects altered or missing metadata without repairing it', async t => {
  const paths = [
    'public/audio/cries/manifest.json',
    'packages/pokemon-cries/data/catalog.json',
    'packages/pokemon-cries/src/catalog.generated.js',
    'tools/cry-import/reports/assets.json',
    'public/audio/cries/UPSTREAM-LICENSE.txt',
  ]
  for (const path of paths) {
    await t.test(path, async child => {
      const root = await fixture(child, { originals: false, generated: true })
      await writeFile(join(root, path), 'unreviewed change\n')
      const before = await snapshot(root)
      await assert.rejects(generateCryAssets({ root, check: true }))
      assert.deepEqual(await snapshot(root), before)
    })
  }
  await t.test('missing report', async child => {
    const root = await fixture(child, { originals: false, generated: true })
    await rm(join(root, 'tools/cry-import/reports/assets.md'))
    const before = await snapshot(root)
    await assert.rejects(generateCryAssets({ root, check: true }), /artifact differs/)
    assert.deepEqual(await snapshot(root), before)
  })
})

test('modified media is rejected in both offline checks and rebuilds without being overwritten', async t => {
  for (const check of [false, true]) {
    await t.test(check ? 'check' : 'rebuild', async child => {
      const root = await fixture(child, { originals: true, generated: true })
      const manifest = await readJson(join(root, 'public/audio/cries/manifest.json'))
      const path = join(root, 'public/audio/cries', manifest.files[0].asset)
      const changed = await readFile(path)
      changed[changed.length - 1] ^= 1
      await writeFile(path, changed)
      const before = await snapshot(root)
      await assert.rejects(generateCryAssets({ root, check }), /mismatch|Refusing to overwrite/)
      assert.deepEqual(await snapshot(root), before)
    })
  }
})

test('validation rejects missing or unexpected media files without publishing repairs', async t => {
  for (const mutation of ['missing', 'extra']) {
    await t.test(mutation, async child => {
      const root = await fixture(child, { originals: false, generated: true })
      const manifest = await readJson(join(root, 'public/audio/cries/manifest.json'))
      if (mutation === 'missing') await rm(join(root, 'public/audio/cries', manifest.files[0].asset))
      else await writeFile(join(root, 'public/audio/cries/unreviewed.ogg'), 'unknown media')
      const before = await snapshot(root)
      await assert.rejects(generateCryAssets({ root, check: true }), /Missing|Unexpected|differs/)
      assert.deepEqual(await snapshot(root), before)
    })
  }
})

test('only the six evidenced form aliases are accepted', async t => {
  const mutations = [
    value => { value.aliases.pop() },
    value => { value.aliases[0].id = 'unownb' },
    value => { value.aliases[0].baseId = 'deoxys' },
    value => { value.aliases[0].sourcePath = 'cries/pokemon/latest/351.ogg' },
    value => { value.aliases[0].evidenceIds = ['invented-evidence'] },
    value => { value.aliases[0].reason = '' },
    value => { value.aliases[1] = structuredClone(value.aliases[0]) },
  ]
  const root = await fixture(t, { originals: false })
  const path = join(root, 'tools/cry-import/form-aliases.json')
  const original = await readJson(path)
  for (const mutate of mutations) {
    const changed = structuredClone(original)
    mutate(changed)
    await writeFile(path, JSON.stringify(changed))
    await assert.rejects(resolveCryMappings(root, inventory), /Invalid|Unsupported/)
  }
})

test('changed alias evidence or reviewed input pins fail before generated files are touched', async t => {
  for (const kind of ['evidence', 'alias-lock', 'decoder-lock']) {
    await t.test(kind, async child => {
      const root = await fixture(child, { originals: false, generated: true })
      if (kind === 'evidence') {
        const aliases = await readJson(join(root, 'tools/cry-import/form-aliases.json'))
        await writeFile(join(root, 'tools/cry-import', aliases.evidence[0].files[0].localPath), 'changed evidence')
      } else {
        const path = join(root, 'tools/cry-import', kind === 'alias-lock' ? 'form-aliases.json' : 'package-lock.json')
        const value = await readJson(path)
        if (kind === 'alias-lock') value.aliases[0].reason += ' unreviewed edit'
        else value.packages['node_modules/@wasm-audio-decoders/ogg-vorbis'].version = '0.0.0'
        await writeFile(path, JSON.stringify(value))
      }
      const before = await snapshot(root)
      await assert.rejects(generateCryAssets({ root }), /differs|differ|pinned version/)
      assert.deepEqual(await snapshot(root), before)
    })
  }
})

test('initialization cannot replace an existing source lock or run in check mode', async t => {
  const root = await fixture(t, { originals: false, generated: true })
  const before = await snapshot(root)
  await assert.rejects(generateCryAssets({ root, initialize: true }), /already exists/)
  await assert.rejects(generateCryAssets({ root, initialize: true, check: true }), /Cannot initialize/)
  assert.deepEqual(await snapshot(root), before)
})

test('output directory symlinks are rejected before either tree is changed', async t => {
  for (const relative of ['public/audio/cries', 'packages/pokemon-cries/data']) {
    await t.test(relative, async child => {
      const root = await fixture(child, { originals: false, generated: true })
      const outside = await mkdtemp(join(tmpdir(), 'cry-outside-output-'))
      child.after(() => rm(outside, { recursive: true, force: true }))
      const destination = join(root, relative)
      await cp(destination, outside, { recursive: true })
      await rm(destination, { recursive: true })
      await symlink(outside, destination)
      const before = await snapshot(root), outsideBefore = await snapshot(outside)
      for (const check of [false, true]) {
        await assert.rejects(generateCryAssets({ root, check }), /Cry path contains a symlink/)
      }
      assert.deepEqual(await snapshot(root), before)
      assert.deepEqual(await snapshot(outside), outsideBefore)
    })
  }
})

test('a symlinked source cache parent is rejected before fetching or writing outside the fixture', async t => {
  const root = await fixture(t, { originals: false })
  const outside = await mkdtemp(join(tmpdir(), 'cry-outside-cache-'))
  t.after(() => rm(outside, { recursive: true, force: true }))
  await writeFile(join(outside, 'keep.txt'), 'untouched external directory')
  await symlink(outside, join(root, 'tools/cry-import/.cache'))
  const before = await snapshot(root), outsideBefore = await snapshot(outside)
  await assert.rejects(fetchCrySources({ root, fetcher: () => assert.fail('Unexpected network request') }), /Cry path contains a symlink/)
  assert.deepEqual(await snapshot(root), before)
  assert.deepEqual(await snapshot(outside), outsideBefore)
})
