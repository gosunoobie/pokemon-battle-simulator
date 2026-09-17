// HTML remains the build entry format; public page URLs are extensionless.
export const PAGE_ENTRIES = Object.freeze({
  home: 'index.html', preview: 'preview.html', playground: 'playground.html',
  simulation: 'simulation.html', multiplayer: 'multiplayer.html',
})

export function resolvePageRoute(pathname) {
  for (const [name, file] of Object.entries(PAGE_ENTRIES)) {
    const path = name === 'home' ? '/' : `/${name}`
    if (pathname === path || pathname === `/${file}` || path !== '/' && pathname === `${path}/`) {
      return { path, file, redirect: pathname !== path }
    }
  }
  return null
}

export function redirectPage(req, res, path) {
  const queryIndex = req.url.indexOf('?')
  const query = queryIndex < 0 ? '' : req.url.slice(queryIndex)
  // No fragment is supplied: browsers retain an old invitation's #join fragment.
  res.writeHead(308, { Location: path + query })
  res.end()
}

function cleanPageUrls(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()
  const queryIndex = (req.url ?? '').indexOf('?')
  const pathname = queryIndex < 0 ? req.url : req.url.slice(0, queryIndex)
  const page = resolvePageRoute(pathname)
  if (!page) return next()
  if (page.redirect) return redirectPage(req, res, page.path)
  const query = queryIndex < 0 ? '' : req.url.slice(queryIndex)
  // Rewrite internally before Vite's HTML middleware; never redirect this file.
  req.url = `/${page.file}${query}`
  next()
}

export function cleanPageUrlsPlugin() {
  return {
    name: 'battle-clean-page-urls',
    configureServer(server) { server.middlewares.use(cleanPageUrls) },
    configurePreviewServer(server) { server.middlewares.use(cleanPageUrls) },
  }
}
