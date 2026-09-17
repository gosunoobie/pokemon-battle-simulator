import { mkdir, readFile, lstat, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { generateInventory } from './inventory.mjs'
import { gitHash } from './metadata.mjs'

export const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export async function assertLocalPath(root, destination) {
  const parts = relative(resolve(root), resolve(destination)).split(sep)
  if (parts.some(part => part === '..') || parts[0] === '') throw new Error('Cry path must be inside the workspace')
  let current = resolve(root)
  for (const part of parts) {
    current = resolve(current, part)
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error(`Cry path contains a symlink: ${current}`) }
    catch (error) { if (error.code === 'ENOENT') break; throw error }
  }
}
export async function readRegular(path) {
  try {
    if (!(await lstat(path)).isFile()) throw new Error(`Expected a regular file: ${path}`)
    return await readFile(path)
  } catch (error) { if (error.code === 'ENOENT') return null; throw error }
}
export function verifyCrySource(bytes, file) {
  if (!bytes || bytes.length !== file.bytes || gitHash('blob', bytes) !== file.gitBlobSha) throw new Error(`Pinned cry content mismatch: ${file.path}`)
}
export const originalPath = (root, file) => {
  if (!/^cries\/pokemon\/legacy\/[1-9][0-9]*\.ogg$/.test(file.path)) throw new Error('Unexpected cry source path')
  return resolve(root, 'tools/cry-import/.cache/originals', file.path.split('/').at(-1))
}
export async function atomicWrite(root, destination, bytes) {
  const staging = resolve(root, 'tools/cry-import/.cache/staging')
  await assertLocalPath(root, destination); await assertLocalPath(root, staging)
  await mkdir(staging, { recursive: true }); await mkdir(dirname(destination), { recursive: true })
  const temporary = resolve(staging, randomUUID())
  try { await writeFile(temporary, bytes, { flag: 'wx' }); await rename(temporary, destination) }
  finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error }) }
}

async function download(file, fetcher) {
  let failure
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(file.url, { signal: AbortSignal.timeout(25000), redirect: 'error' })
      if (!response.ok) throw new Error(`Cry download HTTP ${response.status}: ${file.path}`)
      if (Number(response.headers.get('content-length')) > file.bytes) throw new Error(`Oversized cry response: ${file.path}`)
      const reader = response.body.getReader(), chunks = []; let size = 0
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break
          size += value.byteLength
          if (size > file.bytes) throw new Error(`Oversized cry response: ${file.path}`)
          chunks.push(Buffer.from(value))
        }
      } finally { await reader.cancel() }
      const bytes = Buffer.concat(chunks); verifyCrySource(bytes, file); return bytes
    } catch (error) { failure = error }
    if (attempt < 2) await new Promise(done => setTimeout(done, 300 * (attempt + 1)))
  }
  throw failure
}

export async function fetchCrySources({ root = repository, fetcher = fetch, concurrency = 6, onProgress = () => {} } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('Cry download concurrency must be 1–8')
  const { inventory } = await generateInventory({ root, check: true })
  await assertLocalPath(root, resolve(root, 'tools/cry-import/.cache/originals'))
  await assertLocalPath(root, resolve(root, 'tools/cry-import/.cache/staging'))
  const pending = []; let reused = 0, downloaded = 0, cursor = 0
  // Detect modified local originals before starting any network request.
  for (const file of inventory.files) {
    const bytes = await readRegular(originalPath(root, file))
    if (bytes) { verifyCrySource(bytes, file); reused++ } else pending.push(file)
  }
  let failed = false
  const results = await Promise.allSettled(Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
    while (!failed && cursor < pending.length) {
      const file = pending[cursor++]
      try {
        const bytes = await download(file, fetcher)
        const existing = await readRegular(originalPath(root, file))
        if (existing) verifyCrySource(existing, file)
        else await atomicWrite(root, originalPath(root, file), bytes)
        downloaded++; onProgress({ downloaded, reused, total: inventory.files.length })
      } catch (error) { failed = true; throw error }
    }
  }))
  const failure = results.find(row => row.status === 'rejected'); if (failure) throw failure.reason
  return { downloaded, reused, total: inventory.files.length }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 2) throw new Error('Cry fetch accepts no arguments; the source revision is locked')
    console.log(await fetchCrySources({ onProgress: ({ downloaded }) => { if (downloaded % 100 === 0) console.log(`Verified ${downloaded} downloaded cries…`) } }))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
