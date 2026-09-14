import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { extractGen3, stableJson } from './extract.mjs'
import { sha256, verifySource } from './provenance.mjs'
import { validateGen3 } from './validate.mjs'
import { buildDiagnostics } from './diagnostics.mjs'

const toolDirectory = dirname(fileURLToPath(import.meta.url))
const repository = resolve(toolDirectory, '../..')
const require = createRequire(new URL('./package.json', import.meta.url))
const inputPaths = [
  'tools/data-import/package.json', 'tools/data-import/package-lock.json',
  'tools/data-import/source-lock.json', 'tools/data-import/extract.mjs',
  'tools/data-import/provenance.mjs', 'tools/data-import/validate.mjs',
  'tools/data-import/diagnostics.mjs', 'tools/data-import/import.mjs',
]

const limitations = [
  'This is a metadata projection of a pinned community simulator, not independent proof of cartridge correctness.',
  'No battle engine, executable callbacks, full team validator, format bans, or competitive clauses are exported. The diagnostic Obtainable format is not the game format.',
  'Learnsets contain generation-3 acquisition candidates. Event, breeding, version, evolution, and move-combination restrictions require a compatible team validator.',
  'Hidden Power retains upstream Normal/Physical/basePower 0 placeholders. Its actual type, category, and power need the Gen 3 engine and IVs. Zero base power does not imply zero damage.',
  'Curse preserves the upstream ??? type sentinel. It is not an eighteenth regular type.',
  'Cosmetic aliases may inherit their base species generation. upstreamGeneration is not a verified form introduction date; this package targets the resolved Gen 3 mod, not one cartridge/version.',
  'Descriptions are upstream prose, not executable rules. Item/ability metadata and type multipliers do not encode every mechanic, immunity, condition, or interaction.',
  'captureBalls is a reference catalog of 20 ball identities introduced by Gen 3, not a Gen 3 capture-availability list. Eight retain upstream Unobtainable flags; Friend Ball retains upstream null. No availability is inferred from these flags. Safari Ball is retained so encounter references resolve even though it is excluded from the standard item table.',
  'Sprites, cries, sound effects, and animation recipes are outside this import. No existing preview rule or presentation is modified.',
]

function reportMarkdown(report) {
  const d = report.diagnostics
  const preview = d.previewComparison
  const exclusions = Object.entries(report.extractionAudit.exclusions).map(([table, entries]) => `| ${table} | ${entries.length} |`).join('\n')
  const cell = value => String(value === null ? 'null' : value).replaceAll('|', '\\|')
  const differences = preview.discrepancies.map(row => `| ${row.id} | ${row.field} | ${cell(row.current)} | ${cell(row.upstream)} |`).join('\n')
  return `# Gen 3 data import report\n\n` +
    `Generated deterministically by \`npm run data:import\`. Detailed records and reference paths are in [discrepancies.json](./discrepancies.json).\n\n` +
    `## Pinned source\n\nPokémon Showdown **${report.source.version}**, commit [${report.source.gitCommit}](https://github.com/smogon/pokemon-showdown/tree/${report.source.gitCommit}), resolved through \`Dex.mod('gen3')\`. The npm tarball integrity and installed file-tree checksum are in \`source-lock.json\`; the shipped manifest identifies all importer inputs and generated data.\n\n` +
    `## Exported coverage\n\n| Collection | Records |\n| --- | ---: |\n` +
    Object.entries(report.counts).map(([key, value]) => `| ${key} | ${value} |`).join('\n') + '\n\n' +
    `## Validation\n\nStructural, historical regression, and provenance checks passed before writing any artifacts. **${d.candidateLearnsets.passed.toLocaleString('en-US')} candidate species/move pairs passed**, with **${d.candidateLearnsets.failed} failures**; all **${d.legalityFixtures.length} complete-set fixtures** met expectations. Learnset diagnostics use a separate Gen 3 Obtainable probe; see the JSON for every candidate and complete-set fixture result. These checks compare against the same pinned provider and do not constitute independent cartridge validation.\n\n` +
    `## Explicit transformations and exclusions\n\n` +
    `- Deduplicated ${report.extractionAudit.aliases.length} typed Hidden Power placeholders into one canonical move.\n` +
    `- Omitted ${report.extractionAudit.omittedRelationships.length} species relationships outside the Gen 3 roster; every original relationship is recorded in JSON.\n` +
    `- Inventoried executable callbacks on ${report.extractionAudit.behaviorCallbacks.length} move/item/ability records. Only allowlisted metadata is exported.\n` +
    `- Expanded cosmetic Unown aliases explicitly, preserving base and form identities.\n` +
    `- Retained only generation-3 acquisition tokens and event/encounter records, preserving original event indices and ancestry.\n\n` +
    `| Resolved source table | Excluded records |\n| --- | ---: |\n${exclusions}\n\n` +
    `## Existing preview comparison\n\nThe preview is a fixed-outcome effects showcase. Its reference fields are compared read-only; differences are migration evidence, not automatic corrections. Fixed preview damage is never treated as a Gen 3 power value.\n\n` +
    '```json\n' + stableJson(preview.counts).trimEnd() + '\n```\n\n' +
    `The detailed JSON contains ID mappings and notes on variable/sample values. No preview or FX file is written by this importer.\n\n` +
    `| Preview move | Field | Preview value | Resolved Gen 3 value |\n| --- | --- | --- | --- |\n${differences}\n\n` +
    `The following catalog moves have no preview rule: ${preview.missingPreviewMoves.map(row => `\`${row.id}\``).join(', ')}. Catalog coverage does not register or create an animation.\n\n` +
    `## Limits and follow-up\n\n` + limitations.map(note => `- ${note}`).join('\n') + '\n'
}

export async function generateArtifacts() {
  const source = JSON.parse(await readFile(resolve(toolDirectory, 'source-lock.json'), 'utf8'))
  let packageRoot
  try { packageRoot = dirname(require.resolve('pokemon-showdown/package.json')) }
  catch { throw new Error('Pinned Showdown dependency is missing. Run npm run data:setup first.') }
  // Verify bytes before executing any code from the installed provider.
  const sourceTree = await verifySource({ packageRoot, source, toolDirectory })
  const { Dex, TeamValidator } = require('pokemon-showdown')
  const dex = Dex.mod(source.dexMod)
  const { data, audit } = extractGen3(dex, source)
  const validation = validateGen3(data)
  const { MOVE_RULES: previewRules } = await import(pathToFileURL(resolve(repository, 'packages/battle-core/src/moves.js')))
  const diagnostics = buildDiagnostics({ Dex, TeamValidator, dex, data, audit, previewRules })
  if (!diagnostics.checks.passed) {
    throw new Error('Pinned-provider learnset diagnostics failed; artifacts were not written.')
  }
  const json = stableJson(data)
  const sourceFiles = stableJson(sourceTree.files)
  const license = await readFile(resolve(packageRoot, 'LICENSE'), 'utf8')
  const inputs = await Promise.all(inputPaths.map(async path => ({ path, sha256: sha256(await readFile(resolve(repository, path))) })))
  const counts = Object.fromEntries(Object.entries(data).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length]))
  const manifest = {
    schemaVersion: 1,
    dataset: 'gen3', source,
    projection: 'allowlisted-static-metadata',
    counts,
    importer: { minimumNodeMajor: 24, inputs },
    artifacts: {
      'data/gen3.json': { sha256: sha256(json), bytes: Buffer.byteLength(json) },
      'data/source-files.json': { sha256: sha256(sourceFiles), files: sourceTree.files.length },
      LICENSE: { sha256: sha256(license) },
    },
    capabilities: data.capabilities,
  }
  const report = {
    schemaVersion: 1, source, counts, validation, diagnostics,
    extractionAudit: audit, limitations,
    previewInput: {
      path: 'packages/battle-core/src/moves.js',
      sha256: sha256(await readFile(resolve(repository, 'packages/battle-core/src/moves.js'))),
    },
    dataSha256: sha256(json),
  }
  return new Map([
    ['packages/game-data/data/gen3.json', json],
    ['packages/game-data/data/manifest.json', stableJson(manifest)],
    ['packages/game-data/data/source-files.json', sourceFiles],
    ['packages/game-data/LICENSE', license],
    ['tools/data-import/reports/discrepancies.json', stableJson(report)],
    ['tools/data-import/reports/REPORT.md', reportMarkdown(report)],
  ])
}

export function parseArguments(args) {
  let check = false, outputDirectory = repository
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--check' && !check) check = true
    else if (args[index] === '--output-dir' && args[index + 1] && !args[index + 1].startsWith('--')) outputDirectory = resolve(args[++index])
    else throw new Error(`Unknown or incomplete argument: ${args[index]}`)
  }
  return { check, outputDirectory }
}

export async function run(args = process.argv.slice(2)) {
  const { check, outputDirectory } = parseArguments(args)
  const artifacts = await generateArtifacts()
  const drift = []
  for (const [path, bytes] of artifacts) {
    const destination = resolve(outputDirectory, path)
    if (check) {
      let current
      try { current = await readFile(destination, 'utf8') }
      catch (error) { if (error.code !== 'ENOENT') throw error }
      if (current !== bytes) drift.push(path)
    } else {
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, bytes)
    }
  }
  if (drift.length) throw new Error(`Generated data drift (run data:import and review):\n${drift.join('\n')}`)
  console.log(`${check ? 'Verified' : 'Generated'} ${artifacts.size} deterministic Gen 3 artifacts in ${relative(process.cwd(), outputDirectory) || 'the repository root'}.`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch(error => { console.error(error.message); process.exitCode = 1 })
}
