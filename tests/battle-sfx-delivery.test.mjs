import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createSimulationHttpServer } from '../apps/server/start.mjs'
import { SFX_RUNTIME_CATALOG } from '../packages/battle-sfx/src/runtime.js'

import { ACCEPTED_SFX_RUNTIME_CATALOG } from '../packages/battle-sfx/src/accepted-runtime.js'

import { EVENT_SFX_RUNTIME_CATALOG } from '../packages/battle-sfx/src/event-runtime.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const assets = Object.values({ ...SFX_RUNTIME_CATALOG.assets, ...ACCEPTED_SFX_RUNTIME_CATALOG.assets, ...EVENT_SFX_RUNTIME_CATALOG.assets })
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

async function fixture(t) {
  const distDirectory = await mkdtemp(join(tmpdir(), 'battle-sfx-delivery-'))
  t.after(() => rm(distDirectory, { recursive: true, force: true }))
  await writeFile(join(distDirectory, 'index.html'), '<!doctype html><title>Battle Lab test fixture</title>')
  for (const asset of assets) {
    const relativePath = `audio/sfx/${asset.file}`
    await mkdir(dirname(join(distDirectory, relativePath)), { recursive: true })
    await cp(join(root, 'public', relativePath), join(distDirectory, relativePath))
  }
  await mkdir(join(distDirectory, 'sound_effects'))
  await cp(join(root, 'public/sound_effects/Tackle.mp3'), join(distDirectory, 'sound_effects/Tackle.mp3'))
  await cp(join(root, 'public/audio/sfx', assets[0].file), join(distDirectory, 'sound_effects', assets[0].file))
  await cp(join(root, 'public/audio/sfx', assets[0].file), join(distDirectory, 'audio/sfx/plain.mp3'))
  const server = createSimulationHttpServer({ distDirectory })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }))
  return `http://127.0.0.1:${server.address().port}`
}

test('production GET and HEAD deliver every approved MP3 with matching bytes, MIME, immutable cache and content ETag', async t => {
  const origin = await fixture(t)
  assert.equal(Object.keys(ACCEPTED_SFX_RUNTIME_CATALOG.assets).length, 45)
  assert.equal(Object.keys(EVENT_SFX_RUNTIME_CATALOG.assets).length, 4)
  for (const asset of assets) {
    const response = await fetch(`${origin}/audio/sfx/${asset.file}`)
    assert.equal(response.status, 200, asset.id)
    assert.equal(response.headers.get('content-type'), 'audio/mpeg')
    assert.equal(response.headers.get('content-length'), String(asset.bytes))
    assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable')
    assert.equal(response.headers.get('etag'), `"${asset.sha256}"`)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    const bytes = Buffer.from(await response.arrayBuffer())
    assert.equal(bytes.length, asset.bytes)
    assert.equal(hash(bytes), asset.sha256)
    const head = await fetch(`${origin}/audio/sfx/${asset.file}`, { method: 'HEAD' })
    assert.equal(head.status, 200)
    assert.equal((await head.arrayBuffer()).byteLength, 0)
    for (const name of ['content-type', 'content-length', 'cache-control', 'etag', 'x-content-type-options']) assert.equal(head.headers.get(name), response.headers.get(name))
  }
})

test('missing hashed sounds remain 404 assets with HTML Accept; legacy and unhashed URLs never receive immutable cache', async t => {
  const origin = await fixture(t)
  for (const method of ['GET', 'HEAD']) {
    const missing = await fetch(`${origin}/audio/sfx/${'0'.repeat(64)}.mp3`, { method, headers: { Accept: 'text/html' } })
    assert.equal(missing.status, 404)
    assert.match(missing.headers.get('content-type'), /^text\/plain/)
    assert.equal(missing.headers.get('cache-control'), null)
    assert.equal(missing.headers.get('etag'), null)
    assert.equal(await missing.text(), method === 'HEAD' ? '' : 'Not found')
  }
  for (const path of ['/sound_effects/Tackle.mp3', `/sound_effects/${assets[0].file}`, '/audio/sfx/plain.mp3']) {
    const response = await fetch(`${origin}${path}`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'audio/mpeg')
    assert.equal(response.headers.get('cache-control'), null)
    assert.equal(response.headers.get('etag'), null)
    await response.arrayBuffer()
  }
})

test('static audio cache policy does not affect API no-store responses or public page routes', async t => {
  const origin = await fixture(t)
  const config = await fetch(`${origin}/api/simulation/config`)
  assert.equal(config.status, 200)
  assert.match(config.headers.get('content-type'), /^application\/json/)
  assert.equal(config.headers.get('cache-control'), 'no-store')
  assert.equal(config.headers.get('etag'), null)
  const data = await config.json()
  assert.ok(Array.isArray(data.presets) && data.presets.length > 0)
  const match = await fetch(`${origin}/api/simulation/match`)
  assert.equal(match.status, 401)
  assert.equal(match.headers.get('cache-control'), 'no-store')
  assert.equal(match.headers.get('etag'), null)
  assert.ok((await match.json()).error)
  const page = await fetch(`${origin}/`)
  assert.equal(page.status, 200)
  assert.match(page.headers.get('content-type'), /^text\/html/)
  assert.equal(page.headers.get('cache-control'), null)
  assert.match(await page.text(), /Battle Lab test fixture/)
})
