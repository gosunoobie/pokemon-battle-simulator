import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createSimulationHttpServer } from '../apps/server/start.mjs'
import { DRAFT_SFX_RUNTIME_CATALOG } from '../packages/battle-sfx/src/draft-runtime.js'

test('every technical draft MP3 is delivered with exact source bytes, MIME and immutable hash headers', async t => {
  const root = fileURLToPath(new URL('../', import.meta.url)), assets = Object.values(DRAFT_SFX_RUNTIME_CATALOG.assets)
  const distDirectory = await mkdtemp(join(tmpdir(), 'battle-sfx-draft-delivery-'))
  t.after(() => rm(distDirectory, { recursive: true, force: true }))
  await writeFile(join(distDirectory, 'index.html'), '<!doctype html><title>Draft sound delivery fixture</title>')
  await mkdir(join(distDirectory, 'audio/sfx'), { recursive: true })
  for (const asset of assets) await cp(join(root, 'public/audio/sfx', asset.file), join(distDirectory, 'audio/sfx', asset.file))
  const server = createSimulationHttpServer({ distDirectory })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }))
  const origin = `http://127.0.0.1:${server.address().port}`
  assert.equal(assets.length, 323)
  for (const asset of assets) {
    const response = await fetch(`${origin}/audio/sfx/${asset.file}`)
    assert.equal(response.status, 200, asset.id)
    assert.equal(response.headers.get('content-type'), 'audio/mpeg', asset.id)
    assert.equal(response.headers.get('content-length'), String(asset.bytes), asset.id)
    assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable', asset.id)
    assert.equal(response.headers.get('etag'), `"${asset.sha256}"`, asset.id)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', asset.id)
    const bytes = Buffer.from(await response.arrayBuffer())
    assert.equal(bytes.length, asset.bytes, asset.id)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.id)
    const head = await fetch(`${origin}/audio/sfx/${asset.file}`, { method: 'HEAD' })
    assert.equal(head.status, 200, asset.id); assert.equal((await head.arrayBuffer()).byteLength, 0, asset.id)
    for (const header of ['content-type', 'content-length', 'cache-control', 'etag', 'x-content-type-options']) {
      assert.equal(head.headers.get(header), response.headers.get(header), `${asset.id}: ${header}`)
    }
  }
})
