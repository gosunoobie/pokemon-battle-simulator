import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateArtifacts, parseArguments } from '../import.mjs'
import { inventory, sha256, verifySource } from '../provenance.mjs'
import { stableJson, parseSource } from '../extract.mjs'

const repository = fileURLToPath(new URL('../../../', import.meta.url))

test('repeated generation is byte-identical and matches every checked-in artifact', async () => {
  const first = await generateArtifacts()
  const second = await generateArtifacts()
  assert.deepEqual([...first.keys()], [...second.keys()])
  assert.equal(first.size, 6)
  for (const [path, bytes] of first) {
    assert.equal(sha256(bytes), sha256(second.get(path)), `repeat: ${path}`)
    assert.equal(sha256(await readFile(resolve(repository, path))), sha256(bytes), `checked-in: ${path}`)
  }
  const manifest = JSON.parse(first.get('packages/game-data/data/manifest.json'))
  assert.equal(manifest.artifacts['data/gen3.json'].sha256, sha256(first.get('packages/game-data/data/gen3.json')))
  const report = JSON.parse(first.get('tools/data-import/reports/discrepancies.json'))
  assert.equal(report.diagnostics.candidateLearnsets.failed, 0)
  assert.ok(report.diagnostics.legalityFixtures.every(row => row.expectationMet))
})

test('source verification rejects altered installed bytes and inconsistent dependency pins before loading code', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'gen3-provenance-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const packageRoot = resolve(root, 'provider')
  const toolDirectory = resolve(root, 'tool')
  await mkdir(packageRoot)
  await mkdir(toolDirectory)
  const source = { provider: 'pokemon-showdown', version: '0.11.11', gitCommit: 'a'.repeat(40), dexMod: 'gen3', integrity: 'sha512-fixture', tarball: 'https://example.invalid/pinned.tgz' }
  await writeFile(resolve(packageRoot, 'package.json'), stableJson({ name: source.provider, version: source.version }))
  await writeFile(resolve(packageRoot, 'data.json'), '{"power":95}\n')
  await writeFile(resolve(toolDirectory, 'package.json'), stableJson({ devDependencies: { 'pokemon-showdown': source.version } }))
  await writeFile(resolve(toolDirectory, 'package-lock.json'), stableJson({ packages: { 'node_modules/pokemon-showdown': { version: source.version, integrity: source.integrity, resolved: source.tarball } } }))
  source.treeSha256 = sha256(stableJson(await inventory(packageRoot)))
  await verifySource({ packageRoot, toolDirectory, source })
  await writeFile(resolve(packageRoot, 'data.json'), '{"power":90}\n')
  await assert.rejects(verifySource({ packageRoot, toolDirectory, source }), /differs from the pinned file tree/)
  await assert.rejects(verifySource({ packageRoot, toolDirectory, source: { ...source, version: '0.11.12' } }), /disagree/)
  await assert.rejects(verifySource({ packageRoot, toolDirectory, source: { ...source, integrity: 'changed' } }), /disagree/)
})

test('source tokens preserve original event indices and reject unknown or malformed acquisition paths', () => {
  assert.deepEqual(parseSource('3S10'), { method: 'S', index: 10 })
  assert.deepEqual(parseSource('3R'), { method: 'R', index: null })
  for (const token of ['2M', '4M', '3M2', '3E12', '3L', '3S', '3Z', '3L2.5', '3S-1']) {
    assert.throws(() => parseSource(token), /Unrecognized Gen 3 learnset source/)
  }
})

test('CLI rejects unrecognized and incomplete options', () => {
  assert.equal(parseArguments(['--check']).check, true)
  assert.equal(parseArguments(['--output-dir', '/private/tmp/gen3-output']).outputDirectory, '/private/tmp/gen3-output')
  for (const args of [['--accept'], ['--output-dir'], ['--output-dir', '--check'], ['--check', '--check']]) {
    assert.throws(() => parseArguments(args), /Unknown or incomplete argument/)
  }
})
