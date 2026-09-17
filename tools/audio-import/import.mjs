import { copyFile, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { inspectMp3, sha256, stripId3v2 } from './mp3.mjs'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const json = value => `${JSON.stringify(value, null, 2)}\n`
const source = Object.freeze({
  kind: 'user-provided-local-files',
  reportedCollectionUrl: 'https://downloads.khinsider.com/game-soundtracks/album/pokemon-sfx-gen-3-attack-moves-rse-fr-lg',
  rightsStatus: 'unverified',
  note: 'Embedded credits are retained as supplied, not independently verified. Download availability is not a game redistribution license.',
})
const pathsFor = root => ({
  output: resolve(root, 'public/sound_effects'),
  backup: resolve(root, 'tools/audio-import/.cache/originals'),
  staging: resolve(root, 'tools/audio-import/.cache/staging'),
  lock: resolve(root, 'tools/audio-import/source-lock.json'),
  report: resolve(root, 'tools/audio-import/reports/optimization.json'),
})
async function optional(path) {
  try { return await readFile(path) } catch (error) { if (error.code === 'ENOENT') return null; throw error }
}
async function names(directory, allowManifest = false) {
  const entries = await readdir(directory, { withFileTypes: true })
  if (entries.some(entry => !entry.isFile() || (!entry.name.endsWith('.mp3') && !(allowManifest && entry.name === 'manifest.json')))) {
    throw new Error(`Unexpected file, directory or symlink in ${directory}`)
  }
  return entries.filter(entry => entry.name.endsWith('.mp3')).map(entry => entry.name).sort()
}
function validateLock(lock) {
  if (lock.schemaVersion !== 1 || lock.transform !== 'remove-leading-id3v2.3-only' || !Array.isArray(lock.files) || !lock.files.length) throw new Error('Invalid audio source lock')
  const seen = new Set()
  for (const row of lock.files) {
    if (!/^[A-Za-z0-9][A-Za-z0-9 ()'-]*\.mp3$/.test(row.file) || seen.has(row.file)) throw new Error('Invalid or duplicate locked filename')
    seen.add(row.file)
    for (const data of [row.original, row.output]) {
      if (!data || !/^[a-f0-9]{64}$/.test(data.sha256) || !Number.isSafeInteger(data.bytes) || data.bytes < 1) throw new Error(`Invalid lock entry: ${row.file}`)
    }
    if (!Number.isSafeInteger(row.metadata?.headerBytes) || row.metadata.headerBytes < 10 || row.original.bytes - row.output.bytes !== row.metadata.headerBytes) throw new Error(`Invalid removed-byte count: ${row.file}`)
  }
  if (json(lock.files.map(row => row.file)) !== json([...seen].sort())) throw new Error('Audio lock filenames must be sorted')
}
function artifacts(lock) {
  const credits = [...new Set(lock.files.map(row => json(Object.fromEntries(['TALB', 'TPE1', 'TPE2', 'TYER'].map(key => [key, row.metadata.text[key] ?? null])))))].map(value => JSON.parse(value))
  const manifest = {
    schemaVersion: 1,
    source: lock.source,
    embeddedCredits: credits,
    files: lock.files.map(row => ({ file: row.file, url: `/sound_effects/${encodeURIComponent(row.file)}`, ...row.output, format: row.mpeg })),
  }
  const originalBytes = lock.files.reduce((sum, row) => sum + row.original.bytes, 0)
  const outputBytes = lock.files.reduce((sum, row) => sum + row.output.bytes, 0)
  const report = {
    schemaVersion: 1, transform: lock.transform, fileCount: lock.files.length,
    originalBytes, outputBytes, removedBytes: originalBytes - outputBytes,
    reductionPercent: Number(((originalBytes - outputBytes) / originalBytes * 100).toFixed(2)),
    removedPicturePayloadBytes: lock.files.reduce((sum, row) => sum + row.metadata.pictures.reduce((subtotal, picture) => subtotal + picture.bytes, 0), 0),
    invariant: 'Every byte after the leading ID3v2 tag is preserved, including all MPEG frames, Xing/LAME data and trailing ID3v1 tags. No re-encoding, trimming, resampling or gain changes.',
  }
  return { manifest, report }
}
async function atomicWrite(path, bytes, staging) {
  await mkdir(dirname(path), { recursive: true })
  await mkdir(staging, { recursive: true })
  // A crash can leave only an ignored staging file, never an extra public asset.
  const temp = resolve(staging, randomUUID())
  try { await writeFile(temp, bytes, { flag: 'wx' }); await rename(temp, path) }
  finally { await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error }) }
}
function assertBytes(bytes, expected, label) {
  if (!bytes || bytes.length !== expected.bytes || sha256(bytes) !== expected.sha256) throw new Error(`Audio checksum mismatch: ${label}`)
}

export async function checkAudio({ root = repository } = {}) {
  const paths = pathsFor(root), lock = JSON.parse(await readFile(paths.lock, 'utf8'))
  validateLock(lock)
  if (json(await names(paths.output, true)) !== json(lock.files.map(row => row.file))) throw new Error('Audio output inventory differs from source lock')
  for (const row of lock.files) {
    const bytes = await readFile(resolve(paths.output, row.file))
    assertBytes(bytes, row.output, row.file)
    if (json(inspectMp3(bytes)) !== json(row.mpeg)) throw new Error(`MPEG format differs: ${row.file}`)
  }
  const generated = artifacts(lock)
  for (const [path, value] of [[resolve(paths.output, 'manifest.json'), generated.manifest], [paths.report, generated.report]]) {
    if ((await optional(path))?.toString() !== json(value)) throw new Error(`Audio metadata differs: ${path}`)
  }
  return generated.report
}

export async function optimizeAudio({ root = repository, initialize = false, sourceDirectory } = {}) {
  const paths = pathsFor(root), existing = await optional(paths.lock)
  if (initialize && existing) throw new Error('Audio source lock already exists; initialization will not overwrite it')
  if (!initialize && !existing) throw new Error('Missing source lock. Enroll supplied originals with --init first.')
  const from = resolve(sourceDirectory ?? (initialize ? paths.output : paths.backup))
  // A clean checkout may check already-generated output without the local originals.
  if (!initialize && !sourceDirectory) {
    try { await readdir(from) } catch (error) {
      if (error.code !== 'ENOENT') throw error
      return checkAudio({ root })
    }
  }
  const files = await names(from, initialize && from === paths.output)
  if (!files.length) throw new Error('No original MP3 files found')
  const lock = existing ? JSON.parse(existing) : { schemaVersion: 1, transform: 'remove-leading-id3v2.3-only', source, files: [] }
  if (existing) {
    validateLock(lock)
    if (json(files) !== json(lock.files.map(row => row.file))) throw new Error('Original audio inventory differs from source lock')
  }
  const prepared = []
  // Complete all validation before backing up or modifying any public asset.
  for (const [index, file] of files.entries()) {
    const original = await readFile(resolve(from, file))
    if (existing) assertBytes(original, lock.files[index].original, `original ${file}`)
    const result = stripId3v2(original)
    const row = { file, original: { bytes: original.length, sha256: sha256(original) }, output: { bytes: result.bytes.length, sha256: sha256(result.bytes) }, metadata: result.metadata, mpeg: result.mpeg }
    if (existing && json(row) !== json(lock.files[index])) throw new Error(`Transformation differs from lock: ${file}`)
    if (!existing) lock.files.push(row)
    const backup = await optional(resolve(paths.backup, file))
    if (backup) assertBytes(backup, row.original, `backup ${file}`)
    const current = await optional(resolve(paths.output, file))
    if (current && sha256(current) !== row.original.sha256 && sha256(current) !== row.output.sha256) throw new Error(`Refusing to overwrite changed output: ${file}`)
    prepared.push({ row, bytes: result.bytes, backupExists: Boolean(backup) })
  }
  validateLock(lock)
  const outputFiles = await readdir(paths.output, { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error })
  if (outputFiles.some(entry => !entry.isFile() || (entry.name !== 'manifest.json' && !files.includes(entry.name)))) throw new Error('Unexpected audio output; nothing has been changed')
  await mkdir(paths.backup, { recursive: true })
  for (const { row, backupExists } of prepared) {
    const path = resolve(paths.backup, row.file)
    if (!backupExists) await copyFile(resolve(from, row.file), path, constants.COPYFILE_EXCL)
    assertBytes(await readFile(path), row.original, `backup ${row.file}`)
  }
  // Keep the pin before replacing outputs: an interrupted run can be resumed.
  if (!existing) await atomicWrite(paths.lock, json(lock), paths.staging)
  for (const { row, bytes } of prepared) {
    const path = resolve(paths.output, row.file)
    if (sha256(await optional(path) ?? Buffer.alloc(0)) !== row.output.sha256) await atomicWrite(path, bytes, paths.staging)
  }
  const generated = artifacts(lock)
  await atomicWrite(resolve(paths.output, 'manifest.json'), json(generated.manifest), paths.staging)
  await atomicWrite(paths.report, json(generated.report), paths.staging)
  return checkAudio({ root })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), options = {}
    let check = false
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--check') check = true
      else if (args[i] === '--init') options.initialize = true
      else if (args[i] === '--source' && args[i + 1] && !args[i + 1].startsWith('--')) options.sourceDirectory = args[++i]
      else throw new Error(`Unknown or incomplete argument: ${args[i]}`)
    }
    if (check && (options.initialize || options.sourceDirectory)) throw new Error('--check cannot be combined with writing options')
    const report = await (check ? checkAudio() : optimizeAudio(options))
    console.log(`Audio ${check ? 'verified' : 'ready'}: ${report.fileCount} files; ${report.originalBytes.toLocaleString('en-US')} → ${report.outputBytes.toLocaleString('en-US')} bytes (${report.reductionPercent}% smaller).`)
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
