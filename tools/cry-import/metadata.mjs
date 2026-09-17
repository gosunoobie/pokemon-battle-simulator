import { createHash } from 'node:crypto'

export const json = value => `${JSON.stringify(value, null, 2)}\n`
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export const gitHash = (type, bytes) => createHash('sha1').update(`${type} ${bytes.length}\0`).update(bytes).digest('hex')
export const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
const isSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value)

export function normalizeCommit(raw, expectedSha) {
  if (!isSha(expectedSha) || raw.sha !== expectedSha || !isSha(raw.commit?.tree?.sha) ||
      typeof raw.commit?.committer?.date !== 'string' || !Number.isFinite(Date.parse(raw.commit.committer.date)) ||
      typeof raw.commit.message !== 'string' || !Array.isArray(raw.parents) || raw.parents.some(row => !isSha(row.sha))) {
    throw new Error('Invalid pinned cry commit metadata')
  }
  // Omit mutable GitHub profile, counters and API presentation fields.
  return { sha: raw.sha, treeSha: raw.commit.tree.sha, committedAt: raw.commit.committer.date, message: raw.commit.message, parents: raw.parents.map(row => row.sha) }
}

export function normalizeTree(raw, expectedSha) {
  if (!Array.isArray(raw.tree)) throw new Error('Missing cry source tree')
  const tree = {
    sha: raw.sha, truncated: raw.truncated,
    tree: raw.tree.map(row => ({ path: row.path, mode: row.mode, type: row.type, sha: row.sha, ...(row.type === 'blob' ? { size: row.size } : {}) })).sort((a, b) => compare(a.path, b.path)),
  }
  validateTree(tree, expectedSha)
  return tree
}

export function validateTree(tree, expectedSha) {
  if (!isSha(expectedSha) || tree.sha !== expectedSha || tree.truncated !== false || !Array.isArray(tree.tree) || !tree.tree.length) {
    throw new Error('Cry source tree is missing, truncated or differs from the pin')
  }
  const entries = new Map(), children = new Map([['', []]])
  for (const row of tree.tree) {
    if (typeof row.path !== 'string' || !row.path.length || /[\0\\]/.test(row.path) ||
        row.path.split('/').some(part => !part || part === '.' || part === '..') || entries.has(row.path) || !isSha(row.sha) ||
        !((row.type === 'tree' && row.mode === '040000') ||
          (row.type === 'blob' && ['100644', '100755'].includes(row.mode) && Number.isSafeInteger(row.size) && row.size >= 0))) {
      throw new Error(`Invalid or duplicate cry source tree entry: ${row.path}`)
    }
    entries.set(row.path, row)
    if (row.type === 'tree') children.set(row.path, [])
  }
  for (const row of tree.tree) {
    const parent = row.path.includes('/') ? row.path.slice(0, row.path.lastIndexOf('/')) : ''
    if (!children.has(parent)) throw new Error(`Missing source tree parent: ${row.path}`)
    children.get(parent).push(row)
  }
  // Reconstruct every Git tree object, proving the recursive listing is complete.
  // Blob sizes are API inventory metadata; audio bytes are verified in stage two.
  for (const [path, rows] of children) {
    const name = row => row.path.slice(row.path.lastIndexOf('/') + 1)
    rows.sort((a, b) => Buffer.compare(Buffer.from(name(a) + (a.type === 'tree' ? '/' : '')), Buffer.from(name(b) + (b.type === 'tree' ? '/' : ''))))
    const bytes = Buffer.concat(rows.flatMap(row => [Buffer.from(`${row.type === 'tree' ? '40000' : row.mode} ${name(row)}\0`), Buffer.from(row.sha, 'hex')]))
    if (gitHash('tree', bytes) !== (path ? entries.get(path).sha : expectedSha)) throw new Error(`Cry source tree hash mismatch: ${path || '/'}`)
  }
  return entries
}

export async function fetchMetadata(url, { fetcher = fetch } = {}) {
  let failure
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'pokemon-battle-cry-inventory' }, signal: AbortSignal.timeout(25000), redirect: 'error' })
      if (!response.ok) throw new Error(`Metadata HTTP ${response.status}: ${url}`)
      if (Number(response.headers.get('content-length')) > 4_000_000) throw new Error('Cry metadata exceeds size limit')
      const reader = response.body.getReader(), chunks = []
      let size = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > 4_000_000) throw new Error('Cry metadata exceeds size limit')
          chunks.push(Buffer.from(value))
        }
      } finally { await reader.cancel() }
      return Buffer.concat(chunks)
    } catch (error) { failure = error }
    if (attempt < 2) await new Promise(done => setTimeout(done, 300 * (attempt + 1)))
  }
  throw failure
}
