import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer, preview } from 'vite'
import { createSimulationHttpServer } from '../../../apps/server/start.mjs'
import { PAGE_ENTRIES } from '../../../apps/server/pageRoutes.js'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const blocked = [
  '/sfx-bench', '/sfx-bench/', '/sfx-bench.html', '/sfx%2Dbench.html', '/sfx-bench?collection=1',
  '/__sfx-bench/manifest', '/__sfx-bench/reference?assetId=source.tackle',
  '/__sfx-bench/collection', '/__sfx-bench/analysis', '/__sfx-bench/drafts?batch=batch-001',
  '/__sfx-bench/collection-reference?assetId=source.water-gun',
  '/sfx-bench?batch=sync-001', '/__sfx-bench/sync-batch?batch=sync-001',
  '/sfx-bench?batch=sync-002', '/__sfx-bench/sync-batch?batch=sync-002',
]
const closeHttp = server => new Promise((resolve, reject) => {
  server.close(error => error ? reject(error) : resolve())
  server.closeAllConnections()
})
const originOf = server => `http://127.0.0.1:${server.address().port}`

async function distFixture(t) {
  const dist = await mkdtemp(join(tmpdir(), 'sfx-bench-routes-'))
  t.after(() => rm(dist, { recursive: true, force: true }))
  for (const [name, file] of Object.entries(PAGE_ENTRIES)) await writeFile(join(dist, file), `<!doctype html><title>Production ${name}</title><p>Existing ${name} page</p>`)
  await mkdir(join(dist, 'assets'))
  await writeFile(join(dist, 'assets/existing.js'), 'export const existing = true;')
  // Even an accidentally retained old HTML artifact must not publish the bench.
  await writeFile(join(dist, 'sfx-bench.html'), '<p>UNPUBLISHED BENCH SENTINEL</p>')
  return dist
}

async function assertExistingPages(origin) {
  for (const name of Object.keys(PAGE_ENTRIES)) {
    const path = name === 'home' ? '/' : `/${name}`
    const response = await fetch(origin + path, { headers: { Accept: 'text/html' } })
    assert.equal(response.status, 200, path)
    assert.match(await response.text(), new RegExp(`Existing ${name} page`))
  }
  const redirect = await fetch(`${origin}/simulation.html`, { redirect: 'manual' })
  assert.equal(redirect.status, 308)
  assert.equal(redirect.headers.get('location'), '/simulation')
  const asset = await fetch(`${origin}/assets/existing.js`)
  assert.equal(asset.status, 200)
  assert.match(await asset.text(), /export const existing/)
}

test('real Vite development serves the bench and verified read-only endpoints beside existing pages', async t => {
  const server = await createViteServer({
    root, logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  t.after(() => server.close())
  // Vite treats configured port 0 as its default; use the owned HTTP listener
  // directly so this test always receives an ephemeral loopback port.
  server.httpServer.listen(0, '127.0.0.1')
  await once(server.httpServer, 'listening')
  const origin = originOf(server.httpServer)
  const page = await fetch(`${origin}/sfx-bench`, { headers: { Accept: 'text/html' } })
  assert.equal(page.status, 200)
  assert.match(await page.text(), /\/apps\/sfx-bench\/src\/main\.js/)
  const syncPage = await fetch(`${origin}/sfx-bench?batch=sync-001`, { headers: { Accept: 'text/html' } })
  assert.equal(syncPage.status, 200)
  const syncHtml = await syncPage.text()
  assert.match(syncHtml, /\/apps\/sfx-bench\/src\/sync-main\.js/)
  assert.doesNotMatch(syncHtml, /\/apps\/sfx-bench\/src\/main\.js/)
  const syncResponse = await fetch(`${origin}/__sfx-bench/sync-batch?batch=sync-001`)
  assert.equal(syncResponse.status, 200)
  assert.equal(syncResponse.headers.get('cache-control'), 'no-store')
  const syncBatch = await syncResponse.json()
  assert.deepEqual(syncBatch.moves.map(row => row.id), ['bodyslam', 'aerialace', 'hydropump', 'thunderbolt', 'triplekick', 'absorb'])
  assert.equal(syncBatch.status, 'accepted')
  assert.ok(syncBatch.moves.every(move => move.plan && !move.baseline && !move.candidate && !move.previousReview))
  const nextPage = await fetch(`${origin}/sfx-bench?batch=sync-002`, { headers: { Accept: 'text/html' } })
  assert.equal(nextPage.status, 200)
  assert.match(await nextPage.text(), /\/apps\/sfx-bench\/src\/sync-main\.js/)
  const nextResponse = await fetch(`${origin}/__sfx-bench/sync-batch?batch=sync-002`)
  assert.equal(nextResponse.status, 200)
  const nextBatch = await nextResponse.json()
  assert.equal(nextBatch.status, 'accepted')
  assert.deepEqual(nextBatch.moves.map(move => move.id), ['icebeam', 'psychic', 'flamethrower', 'shadowball', 'rockslide', 'gigadrain'])
  assert.ok(nextBatch.moves.every(move => move.plan && !move.baseline && !move.candidate && !move.previousReview))
  assert.equal(nextBatch.moves.find(move => move.id === 'psychic').accent.asset.id, 'source.hit-normal-damage')
  const thirdPage = await fetch(`${origin}/sfx-bench?batch=sync-003`, { headers: { Accept: 'text/html' } })
  assert.equal(thirdPage.status, 200)
  assert.match(await thirdPage.text(), /\/apps\/sfx-bench\/src\/sync-main\.js/)
  const thirdResponse = await fetch(`${origin}/__sfx-bench/sync-batch?batch=sync-003`)
  assert.equal(thirdResponse.status, 200)
  const thirdBatch = await thirdResponse.json()
  assert.equal(thirdBatch.status, 'accepted')
  assert.deepEqual(thirdBatch.moves.map(move => move.id), ['surf', 'watergun', 'crunch', 'thunderpunch', 'swift', 'calmmind'])
  assert.ok(thirdBatch.moves.every(move => !move.baseline && !move.candidate && move.plan && !move.previousReview))

  assert.equal(thirdBatch.moves.find(move => move.id === 'thunderpunch').visualAccent.id, 'thunder-punch-impact-v1')
  const fourthPage = await fetch(`${origin}/sfx-bench?batch=sync-004`, { headers: { Accept: 'text/html' } })
  assert.equal(fourthPage.status, 200)
  assert.match(await fourthPage.text(), /\/apps\/sfx-bench\/src\/sync-main\.js/)
  const fourthResponse = await fetch(`${origin}/__sfx-bench/sync-batch?batch=sync-004`)
  assert.equal(fourthResponse.status, 200)
  const fourthBatch = await fourthResponse.json()
  assert.equal(fourthBatch.status, 'unreviewed-comparison')
  assert.deepEqual(fourthBatch.moves.map(move => move.id), ['ember', 'waterfall', 'dragonclaw', 'ancientpower', 'shadowpunch', 'swordsdance'])
  assert.ok(fourthBatch.moves.every(move => move.baseline && move.candidate && !move.plan && move.previousReview.verdict === 'keep' && !move.previousReview.changed))

  const fifthPage = await fetch(`${origin}/sfx-bench?batch=sync-005`, { headers: { Accept: 'text/html' } })
  assert.equal(fifthPage.status, 200)
  assert.match(await fifthPage.text(), /\/apps\/sfx-bench\/src\/sync-main\.js/)
  const fifthResponse = await fetch(`${origin}/__sfx-bench/sync-batch?batch=sync-005`)
  assert.equal(fifthResponse.status, 200)
  const fifthBatch = await fifthResponse.json()
  assert.deepEqual(fifthBatch.moves.map(move => move.id), ['fireblast', 'solarbeam', 'razorleaf', 'sludgebomb', 'overheat', 'eruption', 'earthquake', 'thunder', 'blizzard', 'bubblebeam'])
  assert.equal(fifthBatch.reviewPlayback, 'batch-five-feedback-v4')
  assert.equal(fifthBatch.feedbackRecords.length, 10)
  const changedFifthMoves = ['eruption', 'blizzard']
  assert.ok(fifthBatch.feedbackRecords.every(record => record.verdict === (changedFifthMoves.includes(record.moveId) ? 'unreviewed' : 'keep')))
  assert.ok(fifthBatch.moves.every(move => move.previousReview.changed === changedFifthMoves.includes(move.id) && move.originalVisual && move.previousVisual))

  const sixthPage = await fetch(`${origin}/sfx-bench?batch=sync-006`, { headers: { Accept: 'text/html' } })
  assert.equal(sixthPage.status, 200)
  assert.match(await sixthPage.text(), /\/apps\/sfx-bench\/src\/sync-main\.js/)
  const sixthResponse = await fetch(`${origin}/__sfx-bench/sync-batch?batch=sync-006`)
  assert.equal(sixthResponse.status, 200)
  const sixthBatch = await sixthResponse.json()
  assert.deepEqual(sixthBatch.moves.map(move => move.id), ['leafblade','triattack','meteormash','ancientpower','sacredfire'])
  assert.equal(sixthBatch.status, 'accepted')
  assert.ok(sixthBatch.moves.every(move => move.plan && move.native && move.visualAccent.id.startsWith('batch-six-')
    && !move.candidate && !move.baseline && !move.previousReview && !move.previousVisual))
  assert.equal(sixthBatch.approval.text, 'The final Outputs looks perfect for batch 6')

  const seventhPage = await fetch(`${origin}/sfx-bench?batch=sync-007`, { headers: { Accept: 'text/html' } })
  assert.equal(seventhPage.status, 200)
  assert.match(await seventhPage.text(), /\/apps\/sfx-bench\/src\/sync-main\.js/)
  const seventhResponse = await fetch(`${origin}/__sfx-bench/sync-batch?batch=sync-007`)
  assert.equal(seventhResponse.status, 200)
  const seventhBatch = await seventhResponse.json()
  assert.equal(seventhBatch.status, 'unreviewed-comparison')
  assert.equal(seventhBatch.reviewPlayback, 'batch-seven-v1')
  assert.deepEqual(seventhBatch.moves.map(move => move.id), ['sing','grasswhistle','attract','morningsun','moonlight','confuseray'])
  assert.ok(seventhBatch.moves.every(move => move.originalVisual && move.candidate && move.baseline && move.visualAccent.id.startsWith('batch-seven-')))
  assert.equal(seventhBatch.feedbackRecords, undefined)

  for (const path of ['/__sfx-bench/sync-batch?batch=sync-008', '/__sfx-bench/sync-batch?batch=sync-001&extra=1', '/sfx-bench?batch=sync-001&collection=remaining']) {
    const rejected = await fetch(origin + path, { headers: { Accept: 'text/html' } })
    assert.equal(rejected.status, 404, path)
    await rejected.text()
  }
  const response = await fetch(`${origin}/__sfx-bench/manifest`)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const manifest = await response.json()
  assert.equal(manifest.subjects.length, 18)
  const reference = await fetch(`${origin}/__sfx-bench/reference?assetId=source.tackle`)
  assert.equal(reference.status, 200)
  const data = await reference.json()
  assert.equal(data.decoded.pcmSha256, manifest.assets['source.tackle'].decoded.pcmSha256)
  assert.equal(data.waveform.binCount, 512)
  const collectionResponse = await fetch(`${origin}/__sfx-bench/collection`)
  assert.equal(collectionResponse.status, 200)
  const collection = await collectionResponse.json()
  assert.equal(collection.summary.assetCount, 530)
  assert.equal(collection.summary.animatedMoveCount, 335)
  assert.equal(collection.visualRevisions['move:tackle:attack'], manifest.visualRevisions['move:tackle:attack'])
  const collectionReference = await fetch(`${origin}/__sfx-bench/collection-reference?assetId=source.water-gun`)
  assert.equal(collectionReference.status, 200)
  assert.equal((await collectionReference.json()).decoded.pcmSha256, collection.assets['source.water-gun'].decoded.pcmSha256)
  const legacyOutsidePilot = await fetch(`${origin}/__sfx-bench/reference?assetId=source.water-gun`)
  assert.equal(legacyOutsidePilot.status, 404)
  await legacyOutsidePilot.text()
  for (const path of ['/__sfx-bench/manifest', '/__sfx-bench/reference?assetId=source.tackle', '/__sfx-bench/sync-batch?batch=sync-001', '/sfx-bench']) {
    const mutation = await fetch(origin + path, { method: 'POST', body: '{}' })
    assert.equal(mutation.status, 405, path)
    await mutation.text()
  }
  const foreign = await fetch(`${origin}/__sfx-bench/manifest`, { headers: { Origin: 'https://foreign.example' } })
  assert.equal(foreign.status, 403)
  await foreign.text()
  for (const path of ['/', '/preview', '/playground', '/simulation', '/multiplayer']) {
    const normal = await fetch(origin + path, { headers: { Accept: 'text/html' } })
    assert.equal(normal.status, 200, path)
    assert.match(await normal.text(), /id="app"/)
  }
})

test('real Vite preview blocks bench resources without affecting existing pages or assets', async t => {
  const dist = await distFixture(t)
  const server = await preview({ root, logLevel: 'silent', build: { outDir: dist }, preview: { host: '127.0.0.1', port: 0, strictPort: true } })
  t.after(() => closeHttp(server.httpServer))
  const origin = originOf(server.httpServer)
  for (const path of blocked) {
    const response = await fetch(origin + path, { headers: { Accept: 'text/html' } })
    assert.equal(response.status, 404, path)
    assert.doesNotMatch(await response.text(), /UNPUBLISHED BENCH SENTINEL/)
  }
  await assertExistingPages(origin)
  const source = await fetch(`${origin}/apps/sfx-bench/src/main.js`)
  assert.equal(source.status, 404)
  await source.text()
  const syncSource = await fetch(`${origin}/apps/sfx-bench/src/sync-main.js`)
  assert.equal(syncSource.status, 404)
  await syncSource.text()
})

test('production server never serves the bench, source modules or reference API', async t => {
  const distDirectory = await distFixture(t)
  const server = createSimulationHttpServer({ distDirectory })
  t.after(() => closeHttp(server))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const origin = originOf(server)
  for (const path of [...blocked, '/apps/sfx-bench/src/main.js', '/apps/sfx-bench/src/sync-main.js', '/apps/sfx-bench/src/syncVisual.js', '/apps/sfx-bench/src/audio.js', '/tools/audio-import/bench.mjs']) {
    const response = await fetch(origin + path, { headers: { Accept: 'text/html' } })
    assert.equal(response.status, 404, path)
    assert.doesNotMatch(await response.text(), /UNPUBLISHED BENCH SENTINEL|createBenchService/)
  }
  await assertExistingPages(origin)
  const api = await fetch(`${origin}/api/simulation/config`)
  assert.equal(api.status, 200)
  assert.equal((await api.json()).presets.length, 3)
})
