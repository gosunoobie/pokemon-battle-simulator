import test from 'node:test'
import assert from 'node:assert/strict'
import { constants, writeFileSync } from 'node:fs'
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { AUDIT_LOCK, INPUT_PATHS, OUTPUT_PATHS, generateSfxAudit, repository } from '../audit.mjs'
import { assertLocal, atomicWrite, readLocal } from '../audit-io.mjs'
import { sha256 } from '../mp3.mjs'

async function temporary(t) {
  const root = await mkdtemp(join(tmpdir(), 'sfx-audit-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

async function fixture(t) {
  const root = await temporary(t)
  const names = await readdir(join(repository, 'public/sound_effects'))
  const paths = new Set([...INPUT_PATHS, AUDIT_LOCK, ...OUTPUT_PATHS, ...names.map(name => `public/sound_effects/${name}`)])
  for (const path of paths) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await copyFile(join(repository, path), join(root, path), constants.COPYFILE_FICLONE)
  }
  return root
}

test('managed paths reject traversal and symlinks before reads or writes', async t => {
  const root = await temporary(t)
  await assert.rejects(assertLocal(root, '../outside'), /escapes/)
  await symlink('/private/tmp', join(root, 'linked'))
  await assert.rejects(readLocal(root, 'linked/missing', true), /Symlink/)
  await assert.rejects(atomicWrite(root, 'linked/missing', 'no'), /Symlink/)
  await atomicWrite(root, 'nested/artifact.json', 'first\n')
  await atomicWrite(root, 'nested/artifact.json', 'second\n')
  assert.equal((await readLocal(root, 'nested/artifact.json')).toString(), 'second\n')
  assert.deepEqual(await readdir(join(root, 'tools/audio-import/.cache/staging')), [])
  await rm(join(root, 'tools/audio-import/.cache/staging'), { recursive: true })
  await symlink('/private/tmp', join(root, 'tools/audio-import/.cache/staging'))
  await assert.rejects(atomicWrite(root, 'nested/artifact.json', 'third'), /Symlink/)
  assert.equal((await readLocal(root, 'nested/artifact.json')).toString(), 'second\n')
})

test('committed catalog, decoded audit and publication receipt agree without storing PCM', async () => {
  const receipt = JSON.parse(await readFile(join(repository, OUTPUT_PATHS.at(-1))))
  assert.equal(receipt.auditLockSha256, sha256(await readFile(join(repository, AUDIT_LOCK))))
  assert.deepEqual(receipt.outputs.map(row => row.path), OUTPUT_PATHS.slice(0, -1))
  for (const row of receipt.outputs) {
    const bytes = await readFile(join(repository, row.path))
    assert.equal(bytes.length, row.bytes)
    assert.equal(sha256(bytes), row.sha256)
  }
  const catalog = JSON.parse(await readFile(join(repository, OUTPUT_PATHS[0])))
  const report = JSON.parse(await readFile(join(repository, OUTPUT_PATHS[2])))
  const assets = new Map(Object.values(catalog.assets).map(row => [row.file, row]))
  assert.equal(report.files.length, 530)
  assert.equal(report.totals.decodedBytes, report.files.reduce((sum, row) => sum + row.decoded.sampleFrames * row.decoded.channels * 4, 0))
  for (const row of report.files) {
    const asset = assets.get(row.file)
    assert.deepEqual(asset.decoded, row.decoded)
    assert.equal(asset.sha256, row.sha256)
    assert.deepEqual(asset.annotations.regions, [])
    assert.equal(asset.annotations.gainDb, null)
    assert.equal(asset.decoded.truePeakDbfs, null)
    assert.equal(asset.decoded.pcmFormat, 'interleaved-float32-le')
    assert.ok(!('channelData' in asset.decoded))
  }
  assert.equal(catalog.provenance.reviewedPlaybackMappings, 0)
  assert.equal(catalog.provenance.auditLockSha256, receipt.auditLockSha256)
})

test('a fresh checkout re-decodes reproducibly; check detects drift without repairing files or creating a cache', async t => {
  const root = await fixture(t)
  const catalogPath = join(root, OUTPUT_PATHS[0])
  const catalogBefore = await readFile(catalogPath)
  const result = await generateSfxAudit({ root, check: true })
  assert.equal(result.report.totals.files, 530)
  await assert.rejects(lstat(join(root, 'tools/audio-import/.cache')), { code: 'ENOENT' })
  assert.deepEqual(await readFile(catalogPath), catalogBefore)
  await writeFile(catalogPath, 'manually changed\n')
  await assert.rejects(generateSfxAudit({ root, check: true }), /Generated SFX output differs/)
  assert.equal(await readFile(catalogPath, 'utf8'), 'manually changed\n')
  await assert.rejects(lstat(join(root, 'tools/audio-import/.cache')), { code: 'ENOENT' })
})

test('source, policy and inventory drift fail before any decoding or publication', async t => {
  const root = await fixture(t)
  const before = await readFile(join(root, OUTPUT_PATHS[0]))
  const run = () => generateSfxAudit({ root, check: true, onProgress() { assert.fail('Drift must fail before decoding') } })
  for (const path of ['packages/game-data/data/gen3.json', 'tools/audio-import/mapping-policy.json', 'tools/audio-import/decode.mjs', AUDIT_LOCK]) {
    const original = await readFile(join(root, path))
    await writeFile(join(root, path), Buffer.concat([original, Buffer.from('\n')]))
    await assert.rejects(run(), /differ from lock/)
    await writeFile(join(root, path), original)
  }
  const audio = join(root, 'public/sound_effects/Absorb part 1.mp3')
  const original = await readFile(audio), edited = Buffer.from(original)
  edited[100] ^= 1
  await writeFile(audio, edited)
  await assert.rejects(run(), /checksum mismatch/)
  await writeFile(audio, original)
  const extra = join(root, 'public/sound_effects/Extra.mp3')
  await writeFile(extra, original)
  await assert.rejects(run(), /inventory differs/)
  await rm(extra)
  await rm(audio)
  await assert.rejects(run(), { code: 'ENOENT' })
  await writeFile(audio, original)
  await assert.rejects(generateSfxAudit({ root, initialize: true }), /lock exists/)
  assert.deepEqual(await readFile(join(root, OUTPUT_PATHS[0])), before)
})

test('an asset changed after its decode prevents publication of a stale audit', async t => {
  const root = await fixture(t)
  const before = await readFile(join(root, OUTPUT_PATHS[0]))
  const source = JSON.parse(await readFile(join(root, 'tools/audio-import/source-lock.json')))
  const path = join(root, 'public/sound_effects', source.files[0].file)
  const edited = await readFile(path); edited[100] ^= 1
  await assert.rejects(generateSfxAudit({ root, onProgress(done) { if (done === 1) writeFileSync(path, edited) } }), /checksum mismatch/)
  assert.deepEqual(await readFile(join(root, OUTPUT_PATHS[0])), before)
  await assert.rejects(lstat(join(root, 'tools/audio-import/.cache')), { code: 'ENOENT' })
})
