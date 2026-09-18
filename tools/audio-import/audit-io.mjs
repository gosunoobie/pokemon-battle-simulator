import { lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'

export const json = value => `${JSON.stringify(value, null, 2)}\n`
export function assert(condition, message) { if (!condition) throw new Error(message) }

// Managed inputs/outputs must stay inside the checkout and must not follow links.
export async function assertLocal(root, path) {
  root = resolve(root); path = resolve(root, path)
  const rel = relative(root, path)
  assert(!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`), 'Audit path escapes repository')
  let cursor = root
  for (const part of ['.', ...rel.split(sep).filter(Boolean)]) {
    cursor = resolve(cursor, part)
    const info = await lstat(cursor).catch(error => { if (error.code === 'ENOENT') return null; throw error })
    assert(!info?.isSymbolicLink(), `Symlink in managed audit path: ${path}`)
  }
  return path
}

export async function readLocal(root, path, optional = false) {
  const absolute = await assertLocal(root, path)
  const info = await lstat(absolute).catch(error => { if (optional && error.code === 'ENOENT') return null; throw error })
  if (!info) return null
  assert(info.isFile() && info.size <= 64 * 1024 * 1024, `Invalid audit input: ${path}`)
  return readFile(absolute)
}

export async function atomicWrite(root, path, bytes) {
  const absolute = await assertLocal(root, path)
  const staging = await assertLocal(root, 'tools/audio-import/.cache/staging')
  await mkdir(dirname(absolute), { recursive: true }); await mkdir(staging, { recursive: true })
  const temp = resolve(staging, randomUUID())
  try { await writeFile(temp, bytes, { flag: 'wx' }); await rename(temp, absolute) }
  finally { await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error }) }
}
