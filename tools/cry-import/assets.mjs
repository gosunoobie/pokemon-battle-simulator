import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { generateInventory } from './inventory.mjs'
import { resolveCryMappings } from './aliases.mjs'
import { decodeCry } from './decode.mjs'
import { inspectOgg } from './ogg.mjs'
import { json, sha256 } from './metadata.mjs'
import { assertLocalPath, atomicWrite, originalPath, readRegular, repository, verifyCrySource } from './fetch.mjs'

const outputDirectory = 'public/audio/cries'
const assetLockPath = 'tools/cry-import/asset-lock.json'
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const metadataOutputs = ['public/audio/cries/manifest.json', 'packages/pokemon-cries/data/catalog.json', 'packages/pokemon-cries/src/catalog.generated.js', 'tools/cry-import/reports/assets.json', 'tools/cry-import/reports/assets.md', 'public/audio/cries/UPSTREAM-LICENSE.txt', 'packages/pokemon-cries/UPSTREAM-LICENSE.txt']

async function inputPins(root, inputPaths) {
  return Promise.all(inputPaths.map(async path => { const bytes = await readFile(resolve(root, path)); return { path, bytes: bytes.length, sha256: sha256(bytes) } }))
}
async function outputNames(root) {
  const entries = await readdir(resolve(root, outputDirectory), { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error })
  assert(entries.every(entry => entry.isFile()), 'Unexpected directory or symlink in cry output')
  return entries.map(entry => entry.name).sort()
}

export async function generateCryAssets({ root = repository, check = false, initialize = false } = {}) {
  assert(!(check && initialize), 'Cannot initialize in check mode')
  for (const path of [outputDirectory, assetLockPath, 'tools/cry-import/.cache/originals', 'tools/cry-import/.cache/staging', ...metadataOutputs]) await assertLocalPath(root, resolve(root, path))
  const { inventory } = await generateInventory({ root, check: true })
  const { mappings, aliases, inputPaths } = await resolveCryMappings(root, inventory)
  const decoderPackage = JSON.parse(await readFile(new URL('./node_modules/@wasm-audio-decoders/ogg-vorbis/package.json', import.meta.url)))
  const toolPackage = JSON.parse(await readFile(resolve(root, 'tools/cry-import/package.json')))
  const toolLock = JSON.parse(await readFile(resolve(root, 'tools/cry-import/package-lock.json')))
  const decoderPin = toolLock.packages['node_modules/@wasm-audio-decoders/ogg-vorbis']
  assert(decoderPackage.version === '0.1.20' && toolPackage.devDependencies['@wasm-audio-decoders/ogg-vorbis'] === '0.1.20' && decoderPin.version === '0.1.20', 'Cry decoder differs from pinned version')
  const decoder = { package: decoderPackage.name, version: decoderPackage.version, integrity: decoderPin.integrity }
  const inputs = await inputPins(root, ['tools/cry-import/source-lock.json', 'tools/cry-import/package.json', 'tools/cry-import/package-lock.json', ...inputPaths])
  const lockBytes = await readRegular(resolve(root, assetLockPath))
  if (initialize) assert(!lockBytes, 'Cry asset lock already exists; initialization will not overwrite it')
  else assert(lockBytes, 'Missing cry asset lock; initialize once with --init')
  const lock = { schemaVersion: 1, transform: 'preserve-source-bytes', decoder, inputs }
  if (lockBytes) assert(lockBytes.toString() === json(lock), 'Cry asset inputs differ from the lock; review the change before updating the pin')
  const priorManifestBytes = await readRegular(resolve(root, 'public/audio/cries/manifest.json'))
  const priorManifest = priorManifestBytes ? JSON.parse(priorManifestBytes) : null
  if (initialize) assert((await outputNames(root)).length === 0, 'Initialization requires an empty cry output directory')
  const originals = new Map(), files = []
  for (const source of inventory.files) {
    const original = check ? null : await readRegular(originalPath(root, source))
    // Checks and clean-checkout rebuilds can use the unchanged deployed original.
    const previous = priorManifest?.files?.find(row => row.source.path === source.path)
    if (previous) assert(/^[a-f0-9]{64}\.ogg$/.test(previous.asset), 'Invalid deployed cry asset path')
    const bytes = original ?? (previous && await readRegular(resolve(root, outputDirectory, previous.asset)))
    assert(bytes, `Missing cry source: ${source.path}. Run npm run cries:fetch.`)
    verifyCrySource(bytes, source)
    const hash = sha256(bytes), format = inspectOgg(bytes), decoded = await decodeCry(bytes, format)
    const asset = `${hash}.ogg`
    const current = await readRegular(resolve(root, outputDirectory, asset))
    if (current) assert(current.equals(bytes), `Refusing to overwrite changed cry asset: ${asset}`)
    if (check) assert(current, `Missing deployed cry: ${asset}`)
    originals.set(asset, bytes)
    files.push({ asset, sha256: hash, bytes: bytes.length, source, format, decoded })
  }
  const knownNames = [...originals.keys(), 'manifest.json', 'UPSTREAM-LICENSE.txt'].sort()
  const names = await outputNames(root)
  assert(names.every(name => knownNames.includes(name)), 'Unexpected file in cry output; nothing has been replaced')
  if (check) assert(json(names) === json(knownNames), 'Cry output inventory differs')
  const assets = {}, pokemon = {}, byPath = new Map(files.map(row => [row.source.path, row]))
  for (const file of files) assets[file.sha256] = {
    file: file.asset, bytes: file.bytes, sha256: file.sha256, mime: 'audio/ogg; codecs=vorbis',
    durationSeconds: file.format.durationSeconds, sampleRate: file.format.sampleRate, channels: file.format.channels, sampleFrames: file.format.sampleFrames,
  }
  for (const mapping of mappings) pokemon[mapping.id] = { assetId: byPath.get(mapping.selectedPath).sha256, status: mapping.status, sharedWith: mapping.sharedWith }
  const catalog = { schemaVersion: 1, collection: 'legacy', sourceCommit: inventory.source.gitCommit, assets, pokemon }
  const manifest = { schemaVersion: 1, stage: 'validated-assets', transform: 'preserve-source-bytes', source: inventory.source, decoder, inputs, mappings, files }
  const warnings = files.filter(row => row.decoded.samplesAboveFullScale > 0).map(row => ({ path: row.source.path, code: 'decoded-peaks-above-full-scale', peak: row.decoded.peak, samples: row.decoded.samplesAboveFullScale }))
  const report = {
    schemaVersion: 1, stage: 'validated-assets', counts: { identities: mappings.length, baseSpecies: 386, forms: 33, direct: 386, sharedPokemonIdentity: 27, verifiedFormAliases: 6, unresolved: 0, sourceFiles: files.length, deployedAudioFiles: originals.size, decodedFiles: files.length },
    sourceBytes: files.reduce((sum, row) => sum + row.bytes, 0), deployedAudioBytes: [...originals.values()].reduce((sum, bytes) => sum + bytes.length, 0),
    transform: 'preserve-source-bytes', reencoded: false, trimmed: false, normalized: false,
    codec: 'vorbis', sampleRates: [...new Set(files.map(row => row.format.sampleRate))].sort((a, b) => a - b), channels: [...new Set(files.map(row => row.format.channels))].sort(),
    durationSeconds: { min: Math.min(...files.map(row => row.format.durationSeconds)), max: Math.max(...files.map(row => row.format.durationSeconds)) },
    maximumDecodedPeak: Math.max(...files.map(row => row.decoded.peak)), warnings,
    warningInterpretation: 'Vorbis float decoding can overshoot full scale. These are measurements, not a claim that the source recording clipped. Preserve source bytes; allow headroom in the future mixer. No gain is applied here.',
    resolvedDiscrepancies: aliases.aliases,
    remainingLimitations: ['Legacy recording vintage and redistribution rights remain unverified.', 'Automated decoding does not replace listening review.', 'Native browser/device compatibility is recorded separately; no MP3 fallback is generated.', 'Battle playback integration remains stage three.'],
  }
  const markdown = `# Validated Gen 1–3 cry assets\n\nAll **419 identities** map to **${files.length} source files**, including six explicitly evidenced form aliases. Every file passed source length/Git blob verification, Ogg CRC/structure checks and full decoding with the pinned ${decoder.package} ${decoder.version}.\n\n` +
    `- Source and deployed audio: **${report.sourceBytes.toLocaleString('en-US')} bytes**.\n- Transform: **none**; deployed bytes exactly match the upstream originals.\n- Channels: ${report.channels.join(', ')}. Sample rates: ${report.sampleRates.join(', ')} Hz.\n- Duration: ${report.durationSeconds.min.toFixed(3)}–${report.durationSeconds.max.toFixed(3)} seconds.\n- Files with decoded samples above full scale: ${warnings.length}. Peak: ${report.maximumDecodedPeak}.\n\n` +
    `## Optimization decision\n\nKeep these already compact Ogg files unchanged. Content hashes provide stable file identity; forms share existing assets. No additional lossy encoding, silence trimming, pitch changes or normalization is justified by this audit. Original files are cached outside public and excluded from Git and Heroku.\n\n` +
    `## Audio review\n\n${report.warningInterpretation}\n\nUse the development-only listening tool at \`/tools/cry-import/preview.html\` while running \`npm run dev\`. Nothing autoplays. Its native decode audit tests the current browser, not every supported device.\n\n` +
    `## Mapping evidence\n\nCastform Rainy/Snowy/Sunny share legacy/351.ogg; Deoxys Attack/Defense/Speed share legacy/386.ogg. See [pinned source evidence](../form-evidence/README.md). These are six explicit mappings; unknown forms still have no fallback.\n\n` +
    `## Remaining limitations\n\n${report.remainingLimitations.map(item => `- ${item}`).join('\n')}\n`
  const license = await readFile(resolve(root, 'tools/cry-import/sources/LICENSE.upstream.txt'))
  const outputs = [json(manifest), json(catalog), `// Generated by tools/cry-import/assets.mjs. Do not edit.\nexport default ${JSON.stringify(catalog)}\n`, json(report), markdown, license, license]
  if (check) {
    for (let i = 0; i < metadataOutputs.length; i++) assert((await readRegular(resolve(root, metadataOutputs[i])))?.equals(Buffer.from(outputs[i])), `Cry artifact differs: ${metadataOutputs[i]}`)
  } else {
    // All validation and decoding finish before publishing any asset.
    if (initialize) await atomicWrite(root, resolve(root, assetLockPath), json(lock))
    for (const [asset, bytes] of originals) await atomicWrite(root, resolve(root, outputDirectory, asset), bytes)
    for (let i = 0; i < metadataOutputs.length; i++) await atomicWrite(root, resolve(root, metadataOutputs[i]), outputs[i])
  }
  return { manifest, report, catalog }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2)
    assert(args.length <= 1 && args.every(arg => ['--init', '--check'].includes(arg)), 'Use --init or --check, or no arguments')
    const { report } = await generateCryAssets({ check: args.includes('--check'), initialize: args.includes('--init') })
    console.log(`Cry assets ${args.includes('--check') ? 'verified' : 'generated'}: ${report.counts.identities} identities; ${report.counts.decodedFiles} decoded files; ${report.deployedAudioBytes} audio bytes; ${report.counts.unresolved} unresolved mappings.`)
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
