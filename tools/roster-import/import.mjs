import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stableJson, compare } from '../data-import/extract.mjs'
import { sha256 } from '../data-import/provenance.mjs'
import { validateGen3 } from '../data-import/validate.mjs'
import { inspectPng } from './png.mjs'

const directory = dirname(fileURLToPath(import.meta.url))
const repository = resolve(directory, '../..')
const spriteDirectory = resolve(repository, 'packages/pokemon-sprites')
const gitBlobHash = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
const inputs = ['source-lock.json', 'package.json', 'package-lock.json', 'import.mjs', 'png.mjs']
const assetName = file => `${file.id}-${file.view}.png`
const existsBytes = async path => {
  try { return await readFile(path) } catch (error) { if (error.code !== 'ENOENT') throw error; return null }
}

export function validateMapping(source, data) {
  if (source.schemaVersion !== 1 || source.provider !== 'PokeAPI/sprites' || !/^[a-f0-9]{40}$/.test(source.gitCommit) ||
      source.rawBaseUrl !== `https://raw.githubusercontent.com/PokeAPI/sprites/${source.gitCommit}/`) throw new Error('Invalid pinned sprite source.')
  const actors = new Map([...data.species, ...data.forms].map(row => [row.id, row]))
  if (source.roster.length !== actors.size || source.files.length !== actors.size * 2) throw new Error('Sprite mapping does not cover the whole roster.')
  const seen = new Set(), identities = new Map()
  for (const row of source.roster) {
    if (!actors.has(row.id) || actors.get(row.id).num !== row.num || seen.has(row.id)) throw new Error(`Invalid sprite identity mapping: ${row.id}`)
    if (!Number.isSafeInteger(row.pokeapiPokemonId) || row.pokeapiPokemonId < 1 ||
        typeof row.pokeapiIdentifier !== 'string' || !/^[a-z0-9-]+$/.test(row.pokeapiIdentifier) ||
        (actors.get(row.id).kind === 'base' && row.pokeapiPokemonId !== row.num)) throw new Error(`Invalid PokeAPI identity: ${row.id}`)
    seen.add(row.id)
    identities.set(row.id, row)
  }
  const files = new Set()
  for (const row of source.files) {
    const key = `${row.id}/${row.view}`
    if (!actors.has(row.id) || !/^[a-z0-9]+$/.test(row.id) || !['front', 'back'].includes(row.view) || files.has(key) ||
        !/^sprites\/pokemon\/(back\/)?[a-z0-9-]+\.png$/.test(row.path) ||
        row.path.includes('/back/') !== (row.view === 'back') ||
        !/^[a-f0-9]{40}$/.test(row.gitBlobSha) || !Number.isSafeInteger(row.bytes) || row.bytes < 1) throw new Error(`Invalid sprite file mapping: ${key}`)
    const original = actors.get(row.id).kind === 'base' && actors.get(row.id).num <= 9 ? `public/assets/${assetName(row)}` : undefined
    if (row.preservedLocalPath !== original) throw new Error(`Invalid or missing preserved sprite path: ${key}`)
    const identity = identities.get(row.id)
    const stem = identity.num === 201 && row.id !== 'unown' ? identity.pokeapiIdentifier.replace(/^unown-/, '201-') : String(identity.pokeapiPokemonId)
    const expected = `sprites/pokemon/${row.view === 'back' ? 'back/' : ''}${stem}.png`
    if (row.path !== expected) throw new Error(`Sprite path disagrees with its pinned identity: ${key}`)
    files.add(key)
  }
  if (source.license.path !== 'LICENCE.txt' || !/^[a-f0-9]{40}$/.test(source.license.gitBlobSha)) throw new Error('Missing pinned sprite license.')
}

async function download(source, file) {
  let failure
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(source.rawBaseUrl + file.path, { signal: AbortSignal.timeout(30000) })
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${file.path}`)
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length !== file.bytes || gitBlobHash(bytes) !== file.gitBlobSha) throw new Error(`Downloaded source checksum mismatch: ${file.path}`)
      return bytes
    } catch (error) { failure = error; if (attempt < 2) await new Promise(done => setTimeout(done, 500 * (attempt + 1))) }
  }
  throw failure
}

async function fetchAssets(source) {
  await mkdir(resolve(spriteDirectory, 'assets'), { recursive: true })
  const pending = [...source.files, { ...source.license, license: true }]
  let cursor = 0, downloaded = 0, reused = 0
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (cursor < pending.length) {
      const row = pending[cursor++]
      const destination = resolve(spriteDirectory, row.license ? 'UPSTREAM-LICENCE.txt' : `assets/${assetName(row)}`)
      const current = await existsBytes(destination)
      if (current && current.length === row.bytes && gitBlobHash(current) === row.gitBlobSha) { reused++; continue }
      let bytes
      if (row.preservedLocalPath) {
        bytes = await readFile(resolve(repository, row.preservedLocalPath))
        if (gitBlobHash(bytes) !== row.gitBlobSha) throw new Error(`Original starter artwork differs from pin: ${row.preservedLocalPath}`)
      } else { bytes = await download(source, row); downloaded++ }
      if (!row.license) inspectPng(bytes)
      await writeFile(destination, bytes)
      if (downloaded && downloaded % 100 === 0) console.log(`Fetched ${downloaded} pinned files…`)
    }
  }))
  console.log(`Sprite sources ready: ${downloaded} downloaded, ${reused} already verified.`)
}

export async function generateRoster({ fetchSources = false } = {}) {
  const source = JSON.parse(await readFile(resolve(directory, 'source-lock.json'), 'utf8'))
  const dataBytes = await readFile(resolve(repository, 'packages/game-data/data/gen3.json'))
  const data = JSON.parse(dataBytes)
  const dataManifest = JSON.parse(await readFile(resolve(repository, 'packages/game-data/data/manifest.json'), 'utf8'))
  if (sha256(dataBytes) !== dataManifest.artifacts['data/gen3.json'].sha256) throw new Error('Gen 3 data differs from its verified manifest. Run data:check.')
  validateGen3(data)
  validateMapping(source, data)
  if (fetchSources) await fetchAssets(source)

  const files = [], views = {}, sameViewBytes = []
  for (const file of source.files) {
    const bytes = await existsBytes(resolve(spriteDirectory, 'assets', assetName(file)))
    if (!bytes) throw new Error(`Missing sprite ${assetName(file)}. Run npm run roster:fetch.`)
    if (bytes.length !== file.bytes || gitBlobHash(bytes) !== file.gitBlobSha) throw new Error(`Sprite differs from pinned bytes: ${assetName(file)}`)
    const image = inspectPng(bytes)
    if (file.preservedLocalPath) {
      const original = await readFile(resolve(repository, file.preservedLocalPath))
      if (!original.equals(bytes)) throw new Error(`Preserved starter artwork changed: ${file.preservedLocalPath}`)
    }
    files.push({ ...file, asset: assetName(file), sha256: sha256(bytes), ...image })
    views[file.id] ??= {}
    views[file.id][file.view] = {
      file: assetName(file), width: image.width, height: image.height, bounds: image.bounds,
      nativeFacing: file.view === 'front' ? -1 : 1,
      anatomy: 'host-defaults-unmeasured',
    }
  }
  for (const id of Object.keys(views)) {
    const pair = files.filter(row => row.id === id)
    if (pair[0].sha256 === pair[1].sha256) sameViewBytes.push(id)
  }
  const license = await readFile(resolve(spriteDirectory, 'UPSTREAM-LICENCE.txt'))
  if (gitBlobHash(license) !== source.license.gitBlobSha) throw new Error('Sprite license differs from its pin.')
  const types = new Map(data.types.map(row => [row.id, row.name]))
  const abilities = new Map(data.abilities.map(row => [row.id, row.name]))
  const species = [...data.species, ...data.forms].sort((a, b) => a.num - b.num || Number(a.kind !== 'base') - Number(b.kind !== 'base') || compare(a.id, b.id)).map(row => ({
    id: row.id, num: row.num, name: row.name, types: row.types.map(id => types.get(id)),
    baseStats: row.baseStats, abilities: [...new Set(Object.values(row.abilities))].map(id => abilities.get(id)),
    kind: row.kind, baseSpeciesId: row.baseSpeciesId, forme: row.forme, speciesGeneration: row.speciesGeneration,
  }))
  const dataSource = { ...data.source, dataSha256: sha256(dataBytes) }
  const roster = { source: dataSource, species }
  const urls = '// Generated by tools/roster-import/import.mjs; static URLs allow bundlers to emit separate PNG files.\n' +
    'export const SPRITE_URLS = Object.freeze({\n' + source.files.map(row => `  '${assetName(row)}': new URL('../assets/${assetName(row)}', import.meta.url).href,`).join('\n') + '\n})\n'
  const viewJson = stableJson(views), rosterJson = stableJson(roster)
  const manifest = {
    schemaVersion: 1,
    source: { provider: source.provider, repository: source.repository, gitCommit: source.gitCommit, rawBaseUrl: source.rawBaseUrl, spriteCollection: source.spriteCollection },
    identitySource: source.identitySource, dataSource,
    counts: { baseSpecies: data.species.length, forms: data.forms.length, views: files.length, bytes: files.reduce((sum, row) => sum + row.bytes, 0) },
    inputs: await Promise.all(inputs.map(async path => ({ path: `tools/roster-import/${path}`, sha256: sha256(await readFile(resolve(directory, path))) }))),
    outputs: { 'data/views.json': sha256(viewJson), 'src/urls.generated.js': sha256(urls), 'apps/game/src/roster/roster.generated.json': sha256(rosterJson) },
    files,
  }
  const report = {
    valid: true, counts: manifest.counts, source: manifest.source, dataSource,
    checks: { completeFrontBackCoverage: true, gitBlobChecksums: files.length, pngCrcAndDecode: files.length, measuredAlphaBounds: files.length, preservedStarterFiles: files.filter(row => row.preservedLocalPath).length },
    identicalFrontBackBytes: sameViewBytes,
    limitations: [
      'Artwork uses the existing default PokeAPI static Gen 5 style collection. Battle reference data remains the resolved Gen 3 snapshot.',
      'Alpha bounds are measured from actual PNG bytes. New species use generic host attachment sockets; species-specific mouths, hands, eyes and feet have not been manually calibrated.',
      'The existing 18 starter images and their host-calibrated sockets are preserved. Every other identity has explicit front/back mappings; no base-form substitution is invented.',
      'All forms are selectable for visual preview, including Castform battle-only forms. Selection does not establish competitive team legality or implement form-change mechanics.',
      'Stats, types and ability names are display/reference data. Fixed preview HP and outcomes, the unfiltered move showcase, battle-core and FX recipes are not changed by this import.',
    ],
  }
  const reportText = `# Roster and sprite validation\n\n` +
    `**${data.species.length} species + ${data.forms.length} forms**, each with front and back artwork: **${files.length} PNGs**, ${manifest.counts.bytes} bytes.\n\n` +
    `Source: [${source.provider} at ${source.gitCommit}](https://github.com/PokeAPI/sprites/tree/${source.gitCommit}). Data: Pokémon Showdown ${data.source.version}, resolved Gen 3. The locked PokeAPI identity CSVs map forms to filenames; they do not supply battle values.\n\n` +
    `Every file passed its pinned Git blob checksum, PNG CRC/decode and nonempty alpha-bound checks. All 18 original starter files match exactly. Missing sprites: **0**.\n\n` +
    `See [validation.json](./validation.json), [source-lock.json](../source-lock.json), and the sprite package manifest for per-file provenance, dimensions and hashes.\n\n` +
    `## Explicit limits\n\n${report.limitations.map(value => `- ${value}`).join('\n')}\n\n` +
    `Identical front/back file bytes, if present in the provider: ${sameViewBytes.length ? sameViewBytes.join(', ') : 'none'}.\n`
  return new Map([
    ['packages/pokemon-sprites/data/views.json', viewJson],
    ['packages/pokemon-sprites/data/manifest.json', stableJson(manifest)],
    ['packages/pokemon-sprites/src/urls.generated.js', urls],
    ['apps/game/src/roster/roster.generated.json', rosterJson],
    ['tools/roster-import/reports/validation.json', stableJson(report)],
    ['tools/roster-import/reports/REPORT.md', reportText],
  ])
}

export async function run(args = process.argv.slice(2)) {
  if (args.some(value => !['--check', '--fetch'].includes(value)) || new Set(args).size !== args.length || args.length > 1) throw new Error('Use --fetch, --check, or no arguments.')
  const check = args.includes('--check')
  const outputs = await generateRoster({ fetchSources: args.includes('--fetch') })
  const drift = []
  for (const [path, content] of outputs) {
    const fullPath = resolve(repository, path)
    if (check) {
      const current = await existsBytes(fullPath)
      if (!current || current.toString('utf8') !== content) drift.push(path)
    } else { await mkdir(dirname(fullPath), { recursive: true }); await writeFile(fullPath, content) }
  }
  if (drift.length) throw new Error(`Roster artifact drift; regenerate and review:\n${drift.join('\n')}`)
  console.log(`${check ? 'Verified' : 'Generated'} ${outputs.size} roster artifacts and 838 sprite files.`)
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run().catch(error => { console.error(error.message); process.exitCode = 1 })
