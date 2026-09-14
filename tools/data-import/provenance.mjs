import { createHash } from 'node:crypto'
import { readFile, readdir, lstat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { compare, stableJson } from './extract.mjs'

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

// Hash the complete installed upstream package, including source and compiled code.
// Nested dependencies have their own npm lockfile integrity, not this tree identity.
export async function inventory(root) {
  const files = []
  async function visit(directory) {
    for (const name of (await readdir(directory)).sort(compare)) {
      if (name === 'node_modules') continue
      const path = join(directory, name)
      const stat = await lstat(path)
      if (stat.isSymbolicLink()) throw new Error(`Unexpected symlink in pinned source: ${path}`)
      if (stat.isDirectory()) await visit(path)
      else if (stat.isFile()) {
        const bytes = await readFile(path)
        files.push({ path: relative(root, path).split(sep).join('/'), bytes: bytes.length, sha256: sha256(bytes) })
      } else throw new Error(`Unsupported source file: ${path}`)
    }
  }
  await visit(root)
  return files.sort((a, b) => compare(a.path, b.path))
}

export async function verifySource({ packageRoot, source, toolDirectory }) {
  const metadata = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  const packageLock = JSON.parse(await readFile(join(toolDirectory, 'package-lock.json'), 'utf8'))
  const toolPackage = JSON.parse(await readFile(join(toolDirectory, 'package.json'), 'utf8'))
  const pinned = packageLock.packages['node_modules/pokemon-showdown']
  if (metadata.name !== source.provider || metadata.version !== source.version ||
      toolPackage.devDependencies['pokemon-showdown'] !== source.version ||
      pinned?.version !== source.version || pinned.integrity !== source.integrity || pinned.resolved !== source.tarball) {
    throw new Error('Pinned Showdown package, importer dependency, source lock, and npm integrity disagree.')
  }
  if (!/^[a-f0-9]{40}$/.test(source.gitCommit) || source.dexMod !== 'gen3') throw new Error('Invalid source revision or Dex mod.')
  const files = await inventory(packageRoot)
  const treeSha256 = sha256(stableJson(files))
  if (treeSha256 !== source.treeSha256) throw new Error('Installed Showdown source differs from the pinned file tree. Run data:setup; do not bless unexplained changes.')
  return { files, treeSha256 }
}
