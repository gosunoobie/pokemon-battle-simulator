import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer as createViteServer, preview as previewVite } from 'vite'
import { createSimulationHttpServer } from '../apps/server/start.mjs'
import { cleanPageUrlsPlugin } from '../apps/server/pageRoutes.js'

const pages = ['preview', 'playground', 'simulation', 'multiplayer']
const document = name => `<!doctype html><html><head><title>${name}</title></head><body>Page: ${name}</body></html>`

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'battle-clean-urls-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const dist = join(root, 'dist')
  await mkdir(dist)
  for (const directory of [root, dist]) {
    await Promise.all(['index', ...pages].map(name => writeFile(join(directory, `${name}.html`), document(name))))
    await writeFile(join(directory, 'entry.js'), 'export const ready = true')
  }
  return { root, dist }
}

async function productionHost(t, dist) {
  const server = createSimulationHttpServer({ distDirectory: dist, multiplayerOptions: { autoCleanup: false } })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }))
  return `http://127.0.0.1:${server.address().port}`
}

async function assertCanonicalPages(origin) {
  const home = await fetch(`${origin}/`, { redirect: 'manual' })
  assert.equal(home.status, 200)
  assert.match(await home.text(), /<title>index<\/title>/)

  for (const page of pages) {
    const response = await fetch(`${origin}/${page}?source=direct`, { redirect: 'manual' })
    assert.equal(response.status, 200, `/${page} must serve its own entry without a redirect`)
    assert.equal(response.headers.get('location'), null)
    assert.match(response.headers.get('content-type'), /text\/html/)
    assert.match(await response.text(), new RegExp(`<title>${page}</title>`))

    const head = await fetch(`${origin}/${page}`, { method: 'HEAD', redirect: 'manual' })
    assert.equal(head.status, 200, `HEAD /${page}`)
    assert.equal(await head.text(), '')
  }
}

async function assertCanonicalRedirects(origin) {
  const query = '?source=old%20link&value=a%2Fb&repeat=1&repeat=2'
  for (const page of pages) {
    for (const suffix of ['.html', '/']) {
      const path = `/${page}${suffix}${query}`
      const response = await fetch(`${origin}${path}`, { redirect: 'manual' })
      assert.equal(response.status, 308, path)
      assert.equal(response.headers.get('location'), `/${page}${query}`, 'Canonical redirects preserve the original query')
      await response.arrayBuffer()

      const followed = await fetch(`${origin}${path}`)
      assert.equal(followed.status, 200, `${path} must not enter a redirect loop`)
      assert.equal(followed.url, `${origin}/${page}${query}`)
      assert.match(await followed.text(), new RegExp(`<title>${page}</title>`))
    }
  }
}

test('production host serves all clean page URLs and redirects legacy or trailing-slash links', async t => {
  const { dist } = await fixture(t)
  const origin = await productionHost(t, dist)
  await assertCanonicalPages(origin)
  await assertCanonicalRedirects(origin)
})

test('production clean routes preserve API handling, static assets, 404s and unsupported-method responses', async t => {
  const { dist } = await fixture(t)
  const origin = await productionHost(t, dist)
  for (const namespace of ['simulation', 'multiplayer']) {
    const config = await fetch(`${origin}/api/${namespace}/config`, { headers: { Accept: 'text/html' }, redirect: 'manual' })
    assert.equal(config.status, 200)
    assert.match(config.headers.get('content-type'), /application\/json/)
    assert.equal(config.headers.get('location'), null)
    assert(Array.isArray((await config.json()).presets))
  }
  for (const path of ['/api/unknown', '/api/simulation.html', '/api/multiplayer/unknown', '/missing.js']) {
    const response = await fetch(`${origin}${path}`, { headers: { Accept: 'text/html' }, redirect: 'manual' })
    assert.equal(response.status, 404, path)
    assert.equal(response.headers.get('location'), null)
    assert.doesNotMatch(await response.text(), /<title>/)
  }
  const script = await fetch(`${origin}/entry.js`)
  assert.equal(script.status, 200)
  assert.match(script.headers.get('content-type'), /javascript/)
  assert.equal(await script.text(), 'export const ready = true')

  for (const path of ['/multiplayer', '/multiplayer.html', '/simulation/']) {
    const response = await fetch(`${origin}${path}`, { method: 'POST', redirect: 'manual' })
    assert.equal(response.status, 405, path)
    assert.equal(response.headers.get('allow'), 'GET, HEAD')
    assert.equal(response.headers.get('location'), null)
    await response.arrayBuffer()
  }
})

for (const mode of ['development', 'preview']) {
  test(`Vite ${mode} serves canonical multi-page URLs without a rewrite/redirect loop`, async t => {
    const { root } = await fixture(t)
    const options = {
      root, configFile: false, appType: 'mpa', logLevel: 'silent',
      plugins: [cleanPageUrlsPlugin()],
      server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
      preview: { host: '127.0.0.1', port: 0 },
      build: { outDir: 'dist' },
    }
    const server = mode === 'development' ? await createViteServer(options) : await previewVite(options)
    if (mode === 'development') await server.listen()
    t.after(() => mode === 'development' ? server.close() : new Promise(resolve => {
      server.httpServer.close(resolve)
      server.httpServer.closeAllConnections()
    }))
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`
    await assertCanonicalPages(origin)
    await assertCanonicalRedirects(origin)
    for (const path of ['/api/simulation/config', '/api/multiplayer/session', '/missing.js']) {
      const response = await fetch(`${origin}${path}`, { headers: { Accept: 'text/html' }, redirect: 'manual' })
      assert.equal(response.status, 404, `${path} must fall through instead of serving a page`)
      assert.equal(response.headers.get('location'), null)
      await response.arrayBuffer()
    }
  })
}
