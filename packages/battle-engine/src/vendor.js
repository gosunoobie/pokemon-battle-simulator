import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, sep } from 'node:path'

export const PINNED_SOURCE = Object.freeze({
  provider: 'pokemon-showdown',
  version: '0.11.11',
  gitCommit: '739a5e1fee432ad80ff7136d70cca993be358b59',
  treeSha256: 'c7b63998d8fe9e6dcd646e616efad1727415be741d468ec982ba9c376a1e034d',
})
export const PINNED_RNG = Object.freeze({
  provider: 'ts-chacha20',
  version: '1.2.0',
  treeSha256: 'e3d334d1573a5331cfa39767a5760d87fedd1d6a677993e8f876dafa6ac01f46',
})

const require = createRequire(import.meta.url)
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
let vendor

export function canonicalJson(value) {
  const sort = item => Array.isArray(item) ? item.map(sort)
    : item && typeof item === 'object'
      ? Object.fromEntries(Object.keys(item).sort(compare).map(key => [key, sort(item[key])]))
      : item
  return `${JSON.stringify(sort(value), null, 2)}\n`
}

// The same inventory algorithm as the data importer. Verify before executing
// upstream code; this is a one-time process startup cost, never a move cost.
export function verifyPinnedPackage(root, pin) {
  const metadata = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  if (metadata.name !== pin.provider || metadata.version !== pin.version) {
    throw new Error(`Battle engine requires exactly ${pin.provider} ${pin.version}.`)
  }
  const files = []
  const visit = directory => {
    for (const name of readdirSync(directory).sort(compare)) {
      if (name === 'node_modules') continue
      const path = join(directory, name)
      const stat = lstatSync(path)
      if (stat.isSymbolicLink()) throw new Error(`Unexpected symlink in battle engine source: ${path}`)
      if (stat.isDirectory()) visit(path)
      else if (stat.isFile()) {
        const bytes = readFileSync(path)
        files.push({ path: relative(root, path).split(sep).join('/'), bytes: bytes.length, sha256: sha256(bytes) })
      } else throw new Error(`Unsupported file in battle engine source: ${path}`)
    }
  }
  visit(root)
  files.sort((a, b) => compare(a.path, b.path))
  if (sha256(canonicalJson(files)) !== pin.treeSha256) {
    throw new Error(`Battle engine dependency ${pin.provider} does not match the approved pinned file tree; restore the locked dependency.`)
  }
  return files.length
}

export function getVendor() {
  if (vendor) return vendor
  const root = dirname(require.resolve('pokemon-showdown/package.json'))
  const verifiedFileCount = verifyPinnedPackage(root, PINNED_SOURCE)
  // Match the dependency resolution used by Showdown itself, including nested
  // installs. Verifying only a root-level dependency could check the wrong code.
  const upstreamRequire = createRequire(join(root, 'package.json'))
  const rngRoot = dirname(upstreamRequire.resolve('ts-chacha20/package.json'))
  const rngFileCount = verifyPinnedPackage(rngRoot, PINNED_RNG)
  const upstream = require('pokemon-showdown')
  // This internal import is deliberately isolated and guarded by the file-tree pin.
  const { extractChannelMessages } = require(join(root, 'dist/sim/battle.js'))
  if (typeof extractChannelMessages !== 'function' || !(upstream.Dex?.formats?.rulesetCache instanceof Map)) {
    throw new Error('Pinned battle engine adapter API assumptions no longer hold.')
  }
  vendor = Object.freeze({
    ...upstream, extractChannelMessages,
    provenance: Object.freeze({
      ...PINNED_SOURCE, verifiedFileCount,
      rngDependency: Object.freeze({ ...PINNED_RNG, verifiedFileCount: rngFileCount }),
    }),
  })
  return vendor
}
