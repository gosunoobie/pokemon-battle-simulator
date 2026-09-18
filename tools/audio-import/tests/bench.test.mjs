import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { BENCH_ROOT, createBenchManifest, createBenchService, waveformBins } from '../bench.mjs'
import { createBenchMiddleware, sfxBenchPlugin } from '../bench-plugin.mjs'
import { sha256 } from '../mp3.mjs'

const manifest = createBenchManifest()

async function fixture(t, { visuals = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'sfx-bench-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const lock = JSON.parse(await readFile(join(BENCH_ROOT, 'tools/audio-import/audit-lock.json')))
  const paths = [...lock.inputs.map(row => row.path), 'tools/audio-import/audit-lock.json', 'tools/audio-import/reports/sfx-generation.json', 'packages/battle-sfx/data/catalog.json', 'tools/audio-import/review/pilot.json']
  if (visuals) {
    paths.push('packages/battle-fx/src', 'packages/battle-fx/package.json', 'apps/sfx-bench/src/visual.js', 'apps/sfx-bench/src/timing.js', 'apps/sfx-bench/src/audio.js', 'apps/sfx-bench/src/Bench.vue', 'packages/battle-sfx/src/review.js')
    for (const asset of Object.values((await manifest).assets)) paths.push(`public/sound_effects/${asset.file}`)
    // Dependencies are read-only test inputs; managed source files remain real files.
    await symlink(join(BENCH_ROOT, 'node_modules'), join(root, 'node_modules'))
  }
  for (const path of new Set(paths)) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await cp(join(BENCH_ROOT, path), join(root, path), { recursive: true })
  }
  return root
}

test('pilot contains real visual timings, separately labeled cosmetic contacts and unresolved sounds', async () => {
  const data = await manifest
  assert.equal(data.subjects.length, 18)
  assert.equal(Object.keys(data.moves).length, 12)
  assert.equal(Object.keys(data.events).length, 5)
  assert.equal(Object.keys(data.assets).length, 25)
  const subject = (id, phase = 'attack') => data.subjects.find(row => row.id === id && row.phase === phase)
  assert.deepEqual(subject('doublekick').markers.map(({ id, timeSeconds, kind }) => ({ id, timeSeconds, kind })), [
    { id: 'contact-1', timeSeconds: .52, kind: 'authored' },
    { id: 'impact', timeSeconds: .94, kind: 'result' },
  ])
  assert.deepEqual(subject('absorb').markers.map(row => [row.id, row.timeSeconds]), [['impact', .4], ['recovery', .98]])
  assert.deepEqual(subject('fly', 'prepare').markers.map(row => [row.id, row.timeSeconds]), [['prepared', .94]])
  assert.equal(subject('fly', 'prepare').durationSeconds, 1.4)
  assert.equal(subject('protect').visualSubject, 'source')
  assert.equal(subject('raindance').visualSubject, 'field')
  assert.equal(subject('mirrormove').status, 'called-move')
  assert.deepEqual(subject('mirrormove').assetIds, [])
  assert.ok(subject('present').assetIds.includes('source.present-heal'))
  assert.ok(subject('present').notes.some(note => note.includes('damage only')))
  for (const row of data.subjects) {
    assert.equal(data.visualRevisions[`${row.kind}:${row.id}:${row.phase}`], row.visualRevision)
    if (row.kind === 'event') {
      assert.equal(row.fxId, null)
      assert.equal(row.durationSeconds, null)
      assert.deepEqual(row.markers, [])
    }
    for (const id of row.assetIds) assert.equal(data.assets[id].reviewStatus, 'candidate')
  }
  assert.equal(data.provenance.auditLockSha256, sha256(await readFile(join(BENCH_ROOT, 'tools/audio-import/audit-lock.json'))))
  assert.ok(Buffer.byteLength(JSON.stringify(data)) < 70_000)
})

test('waveform buckets preserve both channels, extrema, final samples and overshoot', () => {
  const waveform = waveformBins([new Float32Array([.25, -2, .75, .5, 1.25]), new Float32Array([0, .5, -.75, -1, -.25])], 2)
  assert.equal(waveform.binCount, 2)
  assert.deepEqual(waveform.channels, [[[-2, .25], [.5, 1.25]], [[0, .5], [-1, -.25]]])
  assert.equal(waveformBins([new Float32Array([1, 2])]).binCount, 2)
  assert.throws(() => waveformBins([new Float32Array([NaN])]), /Non-finite/)
  assert.throws(() => waveformBins([new Float32Array([1])], 0), /budget/)
})

test('reference endpoint reproduces the pinned PCM coordinate system and cannot read arbitrary files', async () => {
  const service = createBenchService(), data = await manifest
  const reference = await service.reference('source.tackle')
  assert.deepEqual(reference.decoded, data.assets['source.tackle'].decoded)
  assert.equal(reference.waveform.channels.length, 2)
  assert.equal(reference.waveform.binCount, 512)
  assert.equal(reference.waveform.sampleFrames, reference.decoded.sampleFrames)
  assert.ok(!('channelData' in reference) && !('pcm' in reference))
  assert.deepEqual(await service.reference('source.tackle'), reference)
  await assert.rejects(service.reference('../../package.json'), error => error.status === 404)
  await assert.rejects(service.reference('source.water-gun'), error => error.status === 404)
  await assert.rejects(service.reference('x'.repeat(129)), error => error.status === 400)
})

test('bench refuses changed Stage A inputs and catalog before importing visuals', async t => {
  const root = await fixture(t), pin = join(root, 'tools/audio-import/mapping-policy.json')
  const original = await readFile(pin)
  await writeFile(pin, Buffer.concat([original, Buffer.from('\n')]))
  await assert.rejects(createBenchManifest({ root }), /Stage A input differs/)
  await writeFile(pin, original)
  await writeFile(join(root, 'packages/battle-sfx/data/catalog.json'), '{}')
  await assert.rejects(createBenchManifest({ root }), /receipt mismatch/)
})

test('changed recipe invalidates its visual revision; stale authored evidence and modified audio are rejected', async t => {
  const root = await fixture(t, { visuals: true })
  const data = await createBenchManifest({ root })
  const tackle = join(root, 'packages/battle-fx/src/moves/restored/tackle.js')
  await writeFile(tackle, `${await readFile(tackle, 'utf8')}\n// Deliberate fixture revision.\n`)
  const changed = await createBenchManifest({ root })
  assert.notEqual(data.visualRevisions['move:tackle:attack'], changed.visualRevisions['move:tackle:attack'])
  assert.equal(data.visualRevisions['move:protect:attack'], changed.visualRevisions['move:protect:attack'])
  const adapter = join(root, 'apps/sfx-bench/src/timing.js')
  await writeFile(adapter, `${await readFile(adapter, 'utf8')}\n// Deliberate fixture timing revision.\n`)
  const changedAdapter = await createBenchManifest({ root })
  assert.notEqual(changed.visualRevisions['move:protect:attack'], changedAdapter.visualRevisions['move:protect:attack'])
  assert.notEqual(changed.visualRevisions['event:battle.faint:attack'], changedAdapter.visualRevisions['event:battle.faint:attack'])
  let previous = changedAdapter
  for (const path of ['packages/battle-sfx/src/review.js', 'apps/sfx-bench/src/Bench.vue']) {
    const controller = join(root, path)
    const comment = path.endsWith('.vue') ? '<!-- Deliberate fixture controller revision. -->' : '// Deliberate fixture controller revision.'
    await writeFile(controller, `${await readFile(controller, 'utf8')}\n${comment}\n`)
    const current = await createBenchManifest({ root })
    assert.notEqual(previous.visualRevisions['move:protect:attack'], current.visualRevisions['move:protect:attack'], path)
    assert.notEqual(previous.visualRevisions['event:battle.faint:attack'], current.visualRevisions['event:battle.faint:attack'], path)
    previous = current
  }
  const kick = join(root, 'packages/battle-fx/src/moves/restored/double-kick.js')
  const kickSource = await readFile(kick, 'utf8')
  await writeFile(kick, kickSource.replace('times=[.52,.94]', 'times=[.53,.94]'))
  await assert.rejects(createBenchManifest({ root }), /Authored marker needs review/)
  await writeFile(kick, kickSource)
  const mp3 = join(root, 'public/sound_effects/Tackle.mp3'), bytes = await readFile(mp3)
  bytes[100] ^= 1
  await writeFile(mp3, bytes)
  await assert.rejects(createBenchManifest({ root }), /Sound asset differs/)
})

async function request(middleware, url, { method = 'GET', origin } = {}) {
  const headers = {}, req = { url, method, headers: { host: 'localhost:5173', ...(origin ? { origin } : {}) } }
  let body, next = false
  const res = { statusCode: 0, setHeader(name, value) { headers[name] = value }, end(value) { body = JSON.parse(value) } }
  await middleware(req, res, () => { next = true })
  return { req, status: res.statusCode, headers, body, next }
}

test('middleware is read-only, same-origin, constrained and absent from preview', async () => {
  let reads = 0
  const middleware = createBenchMiddleware({ manifest: async () => { reads++; return { schemaVersion: 1 } }, reference: async assetId => ({ assetId }) })
  assert.equal((await request(middleware, '/sfx-bench')).req.url, '/sfx-bench.html')
  assert.equal((await request(middleware, '/sfx-bench/?x=1')).req.url, '/sfx-bench.html?x=1')
  assert.equal((await request(middleware, '/simulation')).next, true)
  const ok = await request(middleware, '/__sfx-bench/manifest')
  assert.equal(ok.status, 200)
  assert.equal(ok.headers['Cache-Control'], 'no-store')
  assert.equal(reads, 1)
  assert.equal((await request(middleware, '/__sfx-bench/manifest', { method: 'POST' })).status, 405)
  assert.equal((await request(middleware, '/__sfx-bench/manifest', { origin: 'https://unrelated.example' })).status, 403)
  assert.equal(reads, 1)
  assert.equal((await request(middleware, '/__sfx-bench/reference?assetId=source.tackle')).body.assetId, 'source.tackle')
  assert.equal((await request(middleware, '/__sfx-bench/reference?assetId=source.tackle&assetId=other')).status, 404)
  assert.equal((await request(middleware, '/__sfx-bench/reference?path=../../package.json')).status, 404)
  const preview = createBenchMiddleware(null, { preview: true })
  for (const url of ['/sfx-bench', '/sfx-bench/', '/sfx-bench.html', '/sfx%2Dbench.html', '/__sfx-bench/manifest', '/__sfx-bench/reference?assetId=source.tackle', '/apps/sfx-bench/src/main.js']) assert.equal((await request(preview, url)).status, 404)
  assert.equal((await request(preview, '/multiplayer')).next, true)
  const plugin = sfxBenchPlugin()
  assert.equal(typeof plugin.configureServer, 'function')
  assert.equal(typeof plugin.configurePreviewServer, 'function')
  assert.equal(plugin.generateBundle, undefined)
})
