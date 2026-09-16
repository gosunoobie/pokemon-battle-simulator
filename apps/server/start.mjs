// Local simulation prototype: a single-process API and static host, not a production server.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSimulationService } from './simulation.js';
import { createMultiplayerService } from './rooms/routes.js';
import { resolveHostCapacity } from './capacity.js';

const DEFAULT_DIST = fileURLToPath(new URL('../../dist/', import.meta.url));
const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
});

function reply(res, status, message, method) {
  if (res.destroyed || res.writableEnded) return;
  if (res.headersSent) return res.destroy();
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(message),
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(method === 'HEAD' ? undefined : message);
}

function isWithin(root, target) {
  const path = relative(root, target);
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

async function findFile(root, path) {
  try {
    const actualPath = await realpath(path);
    if (!isWithin(root, actualPath)) return { forbidden: true };
    const info = await stat(actualPath);
    return info.isFile() ? { path: actualPath, size: info.size } : null;
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code)) return null;
    throw error;
  }
}

function staticFallback(distDirectory) {
  const directory = resolve(distDirectory);
  return async (req, res) => {
    let pathname;
    try {
      // Parse the original path before URL normalization can erase traversal segments.
      pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);
      if (!pathname.startsWith('/') || /[\0\\]/.test(pathname)
        || pathname.split('/').some(segment => segment === '..' || segment === '.')) {
        throw new Error('Invalid path');
      }
      pathname = pathname.replace(/\/{2,}/g, '/');
    } catch {
      return reply(res, 400, 'Invalid request path', req.method);
    }
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return reply(res, 404, 'API route not found', req.method);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return reply(res, 405, 'Method not allowed', req.method);
    }
    const root = await realpath(directory).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (!root) return reply(res, 404, 'Build output not found; run npm run build first', req.method);
    const candidate = resolve(root, `.${pathname}`);
    if (!isWithin(root, candidate)) return reply(res, 403, 'Forbidden', req.method);
    let file = await findFile(root, candidate);
    let extension = extname(pathname).toLowerCase();
    if (file?.forbidden) return reply(res, 403, 'Forbidden', req.method);
    // HTML history fallback is limited to navigation paths, never missing assets.
    if (!file && !extension && (pathname === '/' || req.headers.accept?.includes('text/html'))) {
      file = await findFile(root, resolve(root, 'index.html'));
      extension = '.html';
    }
    if (file?.forbidden) return reply(res, 403, 'Forbidden', req.method);
    if (!file || !Object.hasOwn(MIME_TYPES, extension)) {
      return reply(res, 404, 'Not found', req.method);
    }
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extension],
      'Content-Length': file.size,
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    const stream = createReadStream(file.path);
    stream.on('error', () => res.destroy());
    res.once('close', () => stream.destroy());
    stream.pipe(res);
  };
}

export function createSimulationHttpServer({ distDirectory = DEFAULT_DIST, serviceOptions, multiplayerOptions, maxActiveBattles } = {}) {
  const configured = resolveHostCapacity({ serviceOptions, multiplayerOptions, maxActiveBattles });
  const service = createSimulationService(configured.serviceOptions);
  const multiplayer = createMultiplayerService({ publicOrigin: serviceOptions?.publicOrigin, ...configured.multiplayerOptions });
  const serveStatic = staticFallback(distDirectory);
  const server = createServer((req, res) => {
    const fail = () => reply(res, 500, 'Internal server error', req.method);
    const next = () => multiplayer.middleware(req, res, () => serveStatic(req, res)).catch(fail);
    try {
      Promise.resolve(service.middleware(req, res, next)).catch(fail);
    } catch {
      fail();
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.maxHeadersCount = 64;
  server.keepAliveTimeout = 5_000;
  server.once('close', () => { service.close(); void multiplayer.close(); });
  return server;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer between 0 and 65535');
  }
  const server = createSimulationHttpServer({ serviceOptions: { publicOrigin: process.env.PUBLIC_ORIGIN } });
  server.on('error', error => {
    console.error(`Simulation server failed: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    const address = server.address();
    const displayHost = host.includes(':') ? `[${host}]` : host;
    console.log(`Local simulation: http://${displayHost}:${address.port}`);
  });
}
