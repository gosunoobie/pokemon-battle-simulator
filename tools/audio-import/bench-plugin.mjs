import { createBenchService, BENCH_ROOT } from './bench.mjs'
import { createCollectionService } from './collection-service.mjs'
import { createSyncBatchManifest, isSyncBatchId } from './sync-batch.mjs'

const reserved = path => path === '/sfx-bench' || path === '/sfx-bench/' || path === '/sfx-bench.html' || path === '/__sfx-bench' || path.startsWith('/__sfx-bench/')
const reply = (response, status, data) => {
  response.statusCode = status
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.end(JSON.stringify(data))
}

export function createBenchMiddleware(service, { preview = false, collectionService, syncBatchService } = {}) {
  return async (request, response, next) => {
    let url, pathname
    try {
      url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
      // Static middleware decodes file names; guard the same path so encoded
      // names cannot expose an accidentally retained authoring HTML artifact.
      pathname = new URL(decodeURIComponent(url.pathname).replace(/\/{2,}/g, '/'), url.origin).pathname
    }
    catch { next(); return }
    const benchSource = pathname === '/apps/sfx-bench' || pathname.startsWith('/apps/sfx-bench/')
    if (!reserved(pathname) && !(preview && benchSource)) { next(); return }
    if (preview) { reply(response, 404, { error: 'The SFX bench is development-only' }); return }
    if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); reply(response, 405, { error: 'This bench is read-only' }); return }
    if (request.headers.origin && request.headers.origin !== url.origin) { reply(response, 403, { error: 'Cross-origin bench requests are not accepted' }); return }
    if (['/sfx-bench', '/sfx-bench/', '/sfx-bench.html'].includes(pathname) && url.searchParams.has('batch') && ([...url.searchParams.keys()].length !== 1 || !isSyncBatchId(url.searchParams.get('batch')))) { reply(response, 404, { error: 'Unknown sync review batch' }); return }
    if (pathname === '/sfx-bench' || pathname === '/sfx-bench/') {
      request.url = `/sfx-bench.html${url.search}`; next(); return
    }
    if (pathname === '/sfx-bench.html') { next(); return }
    try {
      if (pathname === '/__sfx-bench/manifest' && !url.search) reply(response, 200, await service.manifest())
      else if (pathname === '/__sfx-bench/reference' && [...url.searchParams.keys()].length === 1 && url.searchParams.has('assetId')) reply(response, 200, await service.reference(url.searchParams.get('assetId')))
      else if (collectionService && pathname === '/__sfx-bench/collection' && !url.search) reply(response, 200, await collectionService.manifest())
      else if (collectionService && pathname === '/__sfx-bench/analysis' && !url.search) reply(response, 200, await collectionService.analysis())
      else if (collectionService && pathname === '/__sfx-bench/drafts' && [...url.searchParams.keys()].length === 1 && url.searchParams.has('batch')) reply(response, 200, await collectionService.drafts(url.searchParams.get('batch')))
      else if (collectionService && pathname === '/__sfx-bench/collection-reference' && [...url.searchParams.keys()].length === 1 && url.searchParams.has('assetId')) reply(response, 200, await collectionService.reference(url.searchParams.get('assetId')))
      else if (syncBatchService && pathname === '/__sfx-bench/sync-batch' && [...url.searchParams.keys()].length === 1 && isSyncBatchId(url.searchParams.get('batch'))) reply(response, 200, await syncBatchService(url.searchParams.get('batch')))
      else reply(response, 404, { error: 'Unknown bench resource' })
    } catch (error) {
      reply(response, Number.isInteger(error.status) ? error.status : 422, { error: error.message ?? 'Bench verification failed' })
    }
  }
}

export function sfxBenchPlugin({ root = BENCH_ROOT } = {}) {
  return {
    name: 'local-sfx-audition-bench',
    configureServer(server) { server.middlewares.use(createBenchMiddleware(createBenchService({ root }), { collectionService: createCollectionService({ root }), syncBatchService: batch => createSyncBatchManifest({ root, batch }) })) },
    configurePreviewServer(server) { server.middlewares.use(createBenchMiddleware(null, { preview: true })) },
    transformIndexHtml(html, context) {
      if (!context.server) return html
      const url = new URL(context.originalUrl ?? context.path, 'http://localhost')
      if (!['/sfx-bench', '/sfx-bench/', '/sfx-bench.html'].includes(url.pathname) || [...url.searchParams.keys()].length !== 1 || !isSyncBatchId(url.searchParams.get('batch'))) return html
      return html.replace('src="/apps/sfx-bench/src/main.js"', 'src="/apps/sfx-bench/src/sync-main.js"')
    },
  }
}
