import { readFile, mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { compare, fetchMetadata, gitHash, json, normalizeCommit, normalizeTree, sha256, validateTree } from './metadata.mjs'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const directory = 'tools/cry-import'
const inputPaths = ['packages/game-data/data/gen3.json', 'packages/game-data/data/manifest.json', 'tools/roster-import/source-lock.json']
const metadataPaths = ['sources/commit.json', 'sources/tree.json', 'sources/README.upstream.md', 'sources/LICENSE.upstream.txt']
const reportPaths = ['reports/inventory.json', 'reports/discrepancies.json', 'reports/inventory.md']
const repositoryUrl = 'https://github.com/PokeAPI/cries'
const shaPattern = /^[a-f0-9]{40}$/
const check = (condition, message) => { if (!condition) throw new Error(message) }
const cryPath = (collection, id) => `cries/pokemon/${collection}/${id}.ogg`

function validateSource(source) {
  check(source.schemaVersion === 1 && source.stage === 'inventory-only' && source.source?.provider === 'PokeAPI/cries' &&
    source.source.repository === repositoryUrl && shaPattern.test(source.source.gitCommit) && shaPattern.test(source.source.gitTree) &&
    source.source.collection === 'legacy' && source.source.rawBaseUrl === `https://raw.githubusercontent.com/PokeAPI/cries/${source.source.gitCommit}/`, 'Invalid pinned cry source lock')
  for (const [rows, paths] of [[source.inputs, inputPaths], [source.metadata, metadataPaths]]) {
    check(Array.isArray(rows) && json(rows.map(row => row.path)) === json(paths), 'Unexpected cry source inputs')
    for (const row of rows) check(Number.isSafeInteger(row.bytes) && row.bytes > 0 && /^[a-f0-9]{64}$/.test(row.sha256), `Invalid input checksum: ${row.path}`)
  }
}

export function buildInventory({ data, identities, tree, source }) {
  validateSource(source)
  const entries = validateTree(tree, source.source.gitTree)
  check(Array.isArray(data.species) && data.species.length === 386 && Array.isArray(data.forms) && data.forms.length === 33, 'Expected exactly 386 base species and 33 declared forms')
  const actors = [...data.species, ...data.forms], byId = new Map(), baseNums = new Set()
  for (const row of actors) {
    check(typeof row.id === 'string' && /^[a-z0-9]+$/.test(row.id) && !byId.has(row.id) &&
      Number.isInteger(row.num) && row.num >= 1 && row.num <= 386 && typeof row.name === 'string', `Invalid or duplicate game identity: ${row.id}`)
    byId.set(row.id, row)
  }
  for (const row of data.species) {
    check(row.kind === 'base' && row.baseSpeciesId === row.id && !baseNums.has(row.num), `Invalid base species: ${row.id}`)
    baseNums.add(row.num)
  }
  for (const row of data.forms) check(['cosmetic', 'alternate', 'battle-only'].includes(row.kind) && byId.get(row.baseSpeciesId)?.kind === 'base' &&
    byId.get(row.baseSpeciesId).num === row.num, `Invalid form identity: ${row.id}`)
  check(json(identities.identitySource) === json(source.identitySource), 'Identity provenance differs from cry source lock')
  check(Array.isArray(identities.roster) && identities.roster.length === actors.length, 'Cry identity mapping must cover the exact roster')
  const identityById = new Map()
  for (const row of identities.roster) {
    const actor = byId.get(row.id)
    check(actor && !identityById.has(row.id) && actor.num === row.num && actor.name === row.name &&
      Number.isSafeInteger(row.pokeapiPokemonId) && row.pokeapiPokemonId > 0 &&
      typeof row.pokeapiIdentifier === 'string' && /^[a-z0-9-]+$/.test(row.pokeapiIdentifier) &&
      (row.pokeapiFormId === undefined || (Number.isSafeInteger(row.pokeapiFormId) && row.pokeapiFormId > 0)) &&
      (actor.kind !== 'base' || row.pokeapiPokemonId === actor.num), `Invalid or duplicate PokéAPI identity: ${row.id}`)
    identityById.set(row.id, row)
  }
  const fileRecord = path => {
    const row = entries.get(path)
    if (!row) return null
    check(row.type === 'blob' && row.mode === '100644' && row.size > 0, `Invalid cry file metadata: ${path}`)
    return { path, gitBlobSha: row.sha, bytes: row.size, url: source.source.rawBaseUrl + path }
  }
  const mappings = actors.sort((a, b) => a.num - b.num || Number(a.kind !== 'base') - Number(b.kind !== 'base') || compare(a.id, b.id)).map(actor => {
    const identity = identityById.get(actor.id), baseIdentity = identityById.get(actor.baseSpeciesId)
    const candidatePath = cryPath('legacy', identity.pokeapiPokemonId), file = fileRecord(candidatePath)
    const shared = actor.kind !== 'base' && identity.pokeapiPokemonId === baseIdentity.pokeapiPokemonId
    return {
      id: actor.id, name: actor.name, num: actor.num, kind: actor.kind, baseSpeciesId: actor.baseSpeciesId,
      pokeapiPokemonId: identity.pokeapiPokemonId, pokeapiFormId: identity.pokeapiFormId ?? null, pokeapiIdentifier: identity.pokeapiIdentifier,
      status: file ? (shared ? 'shared-pokemon-identity' : 'direct') : 'unresolved',
      expectedPath: candidatePath, selectedPath: file?.path ?? null,
      sharedWith: file && shared ? actor.baseSpeciesId : null,
      evidence: !file ? 'No file at the exact Pokémon-ID path in the complete pinned legacy tree. No fallback selected.' :
        shared ? 'The pinned identity source assigns this form the same Pokémon ID as its base species; cry paths use Pokémon IDs, not form IDs.' :
          'Exact Pokémon-ID path exists in the pinned legacy tree. Audio contents have not yet been downloaded or decoded.',
    }
  })
  const selectedPaths = [...new Set(mappings.map(row => row.selectedPath).filter(Boolean))].sort(compare)
  const files = selectedPaths.map(path => ({ ...fileRecord(path), identities: mappings.filter(row => row.selectedPath === path).map(row => row.id) }))
  const duplicateGroups = new Map()
  for (const file of files) {
    const group = duplicateGroups.get(file.gitBlobSha) ?? []
    if (group.length) check(group[0].bytes === file.bytes, 'Conflicting size for identical Git blobs')
    group.push(file); duplicateGroups.set(file.gitBlobSha, group)
  }
  const missing = mappings.filter(row => row.status === 'unresolved').map(row => ({
    id: row.id, expectedPath: row.expectedPath, code: 'missing-legacy-pokemon-id',
    baseCandidate: fileRecord(cryPath('legacy', identityById.get(row.baseSpeciesId).pokeapiPokemonId)),
    latestCandidate: fileRecord(cryPath('latest', row.pokeapiPokemonId)),
    resolution: 'Unresolved: candidates are evidence for review only. Neither a base-species alias nor a latest substitution is approved.',
  }))
  const counts = {
    baseSpecies: data.species.length, forms: data.forms.length, identities: mappings.length,
    direct: mappings.filter(row => row.status === 'direct').length,
    sharedIdentity: mappings.filter(row => row.status === 'shared-pokemon-identity').length,
    unresolved: missing.length, selectedSourceFiles: files.length, uniqueGitBlobs: duplicateGroups.size,
    listedSourceBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    listedUniqueBlobBytes: [...duplicateGroups.values()].reduce((sum, group) => sum + group[0].bytes, 0),
    downloadedAudioFiles: 0, decodedAudioFiles: 0,
  }
  const inventory = {
    schemaVersion: 1, stage: 'inventory-only', source: source.source, identitySource: source.identitySource, counts,
    limitations: ['Git tree availability and reported sizes only; no audio bytes, SHA-256 audio hashes, codec, duration or quality validation yet.',
      'Legacy collection is not verified as authentic Generation 3 cartridge recordings.',
      'Missing form recordings never fall back automatically to another Pokémon ID or to latest.'],
    mappings, files,
  }
  const discrepancies = {
    schemaVersion: 1, stage: 'inventory-only', sourceCommit: source.source.gitCommit, counts,
    allIdentitiesAccountedFor: true, allMappingsResolved: missing.length === 0, readyForPlayback: false,
    unresolved: missing,
    sharedIdentities: mappings.filter(row => row.status === 'shared-pokemon-identity').map(row => ({ id: row.id, sharedWith: row.sharedWith, pokeapiPokemonId: row.pokeapiPokemonId, path: row.selectedPath })),
    identicalGitBlobGroups: [...duplicateGroups.entries()].filter(([, group]) => group.length > 1).map(([gitBlobSha, group]) => ({ gitBlobSha, paths: group.map(file => file.path) })),
    pendingValidation: ['Fetch pinned audio and verify byte size and Git blob hash; then record SHA-256.', 'Inspect container/codec and decode every selected file.',
      'Review missing form mappings using additional evidence before publishing a complete catalog.', 'Review audible quality, timing and browser decoding.',
      'Recording vintage and redistribution rights remain unverified; retain upstream notices.'],
  }
  const markdown = `# Gen 1–3 cry inventory\n\nGenerated by \`npm run cries:inventory\`. Metadata only; no audio downloaded or decoded.\n\n` +
    `Source: [PokeAPI/cries ${source.source.gitCommit}](${repositoryUrl}/tree/${source.source.gitCommit}), collection \`legacy\`.\n\n` +
    `| Measure | Count |\n| --- | ---: |\n` + Object.entries(counts).map(([key, value]) => `| ${key} | ${value} |`).join('\n') +
    `\n\n## Unresolved mappings\n\n` + (missing.length ? `| Project ID | Missing legacy file | Available candidates (not selected) |\n| --- | --- | --- |\n` +
      missing.map(row => `| ${row.id} | ${row.expectedPath} | ${[row.baseCandidate?.path, row.latestCandidate?.path].filter(Boolean).join(', ') || 'None'} |`).join('\n') : 'None.') +
    `\n\n## Interpretation\n\nAll ${mappings.length} declared identities are accounted for. ${counts.direct} use exact Pokémon-ID paths; ${counts.sharedIdentity} reuse a verified Pokémon identity. ${missing.length} require further evidence.\n\n` +
    `The Unown forms share Pokémon ID 201. Their separate form IDs must never be used as cry filenames. Castform and Deoxys variant IDs remain distinct; a missing file does not establish that a base cry is correct.\n\n` +
    `Listed bytes are GitHub metadata, not measured download or optimized deployment size. Unique Git blobs indicate identical source content according to Git; no decoded-audio equivalence has been tested.\n\n` +
    `The upstream legacy label does not establish Gen 3 recording authenticity. The upstream LICENSE identifies the audio copyright as The Pokémon Company; availability does not verify redistribution rights.\n\n` +
    `## Next stage\n\n${discrepancies.pendingValidation.map(item => `- ${item}`).join('\n')}\n\n` +
    `This stage-one report describes upstream path availability before stage-two alias evidence. \`npm run cries:inventory:check -- --require-resolved\` fails while these provider paths are missing. \`npm run cries:check\` validates the stage-two assets and evidenced aliases.\n`
  return { inventory, discrepancies, markdown }
}

async function verifiedRead(root, row, prefix = '') {
  const bytes = await readFile(resolve(root, prefix, row.path))
  check(bytes.length === row.bytes && sha256(bytes) === row.sha256, `Cry input checksum mismatch: ${row.path}`)
  return bytes
}

export async function generateInventory({ root = repository, check: checkOnly = false, requireResolved = false } = {}) {
  const source = JSON.parse(await readFile(resolve(root, directory, 'source-lock.json'), 'utf8'))
  validateSource(source)
  const inputs = await Promise.all(source.inputs.map(row => verifiedRead(root, row)))
  const metadata = await Promise.all(source.metadata.map(row => verifiedRead(root, row, directory)))
  const [data, manifest, identities] = inputs.map(bytes => JSON.parse(bytes)), [commit, tree] = metadata.slice(0, 2).map(bytes => JSON.parse(bytes))
  check(manifest.artifacts?.['data/gen3.json']?.sha256 === sha256(inputs[0]), 'Gen 3 data differs from its validated manifest')
  check(commit.sha === source.source.gitCommit && commit.treeSha === source.source.gitTree, 'Cry commit and tree pin disagree')
  const entries = validateTree(tree, source.source.gitTree)
  for (const [index, path] of [[2, 'README.md'], [3, 'LICENSE']]) {
    const entry = entries.get(path)
    check(entry?.type === 'blob' && metadata[index].length === entry.size && gitHash('blob', metadata[index]) === entry.sha, `Upstream document differs from pinned tree: ${path}`)
  }
  const artifacts = buildInventory({ data, identities, tree, source })
  if (requireResolved) check(artifacts.discrepancies.allMappingsResolved, `${artifacts.inventory.counts.unresolved} cry mappings remain unresolved; no fallback is authorized`)
  const values = [json(artifacts.inventory), json(artifacts.discrepancies), artifacts.markdown]
  for (let i = 0; i < reportPaths.length; i++) {
    const path = resolve(root, directory, reportPaths[i])
    if (checkOnly) check(await readFile(path, 'utf8') === values[i], `Cry report differs: ${reportPaths[i]}`)
    else await atomicWrite(path, values[i])
  }
  return artifacts
}

async function atomicWrite(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  try { await writeFile(temporary, value, { flag: 'wx' }); await rename(temporary, path) }
  finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error }) }
}

// This command verifies only the already-pinned metadata. It cannot fetch a cry
// or change the source revision, outputs or lock.
export async function verifyRemoteMetadata({ root = repository, fetcher = fetch } = {}) {
  await generateInventory({ root, check: true })
  const source = JSON.parse(await readFile(resolve(root, directory, 'source-lock.json'), 'utf8'))
  const rawCommit = JSON.parse(await fetchMetadata(`https://api.github.com/repos/PokeAPI/cries/commits/${source.source.gitCommit}`, { fetcher }))
  const commit = normalizeCommit(rawCommit, source.source.gitCommit)
  const rawTree = JSON.parse(await fetchMetadata(`https://api.github.com/repos/PokeAPI/cries/git/trees/${source.source.gitTree}?recursive=1`, { fetcher }))
  const values = [Buffer.from(json(commit)), Buffer.from(json(normalizeTree(rawTree, source.source.gitTree))),
    ...await Promise.all(['README.md', 'LICENSE'].map(path => fetchMetadata(source.source.rawBaseUrl + path, { fetcher })))]
  for (let i = 0; i < values.length; i++) check(values[i].length === source.metadata[i].bytes && sha256(values[i]) === source.metadata[i].sha256, `Remote metadata differs from pinned snapshot: ${source.metadata[i].path}`)
  return source.source.gitCommit
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2)
    check(new Set(args).size === args.length && args.every(arg => ['--check', '--require-resolved', '--verify-remote'].includes(arg)), 'Unknown or duplicate cry inventory argument')
    check(!args.includes('--verify-remote') || args.length === 1, '--verify-remote cannot be combined with other options')
    if (args.includes('--verify-remote')) console.log(`Pinned cry metadata verified remotely: ${await verifyRemoteMetadata()}`)
    else {
      const result = await generateInventory({ check: args.includes('--check'), requireResolved: args.includes('--require-resolved') })
      const c = result.inventory.counts
      console.log(`Cry inventory ${args.includes('--check') ? 'verified' : 'generated'}: ${c.identities} identities; ${c.direct} direct, ${c.sharedIdentity} shared, ${c.unresolved} unresolved; ${c.selectedSourceFiles} listed files. No audio downloaded or decoded.`)
    }
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
