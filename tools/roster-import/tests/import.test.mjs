import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { sha256 } from '../../data-import/provenance.mjs'
import { validateMapping, generateRoster } from '../import.mjs'

const repository = fileURLToPath(new URL('../../../', import.meta.url))
const source = JSON.parse(await readFile(new URL('../source-lock.json', import.meta.url), 'utf8'))
const data = JSON.parse(await readFile(resolve(repository, 'packages/game-data/data/gen3.json'), 'utf8'))

test('pinned mappings cover all species/forms and reject missing, duplicate or mismatched views', () => {
  validateMapping(source, data)
  const mutations = [
    s => { s.files.pop() },
    s => { s.files[1] = { ...s.files[0] } },
    s => { s.roster[1] = { ...s.roster[0] } },
    s => { s.roster[0].num = 999 },
    s => { s.files[0].path = 'sprites/pokemon/25.png' },
    s => { s.files[0].path = '../outside.png' },
    s => { s.files[0].gitBlobSha = 'unknown' },
    s => { s.rawBaseUrl = 'https://example.invalid/' },
    s => { for (const row of s.files) delete row.preservedLocalPath },
  ]
  for (const mutate of mutations) {
    const copy = structuredClone(source); mutate(copy)
    assert.throws(() => validateMapping(copy, data))
  }
})

test('offline regeneration is byte-identical and verifies all checked-in roster artifacts', async () => {
  const first = await generateRoster(), second = await generateRoster()
  assert.deepEqual([...first.keys()], [...second.keys()])
  assert.equal(first.size, 6)
  for (const [path, value] of first) {
    assert.equal(sha256(value), sha256(second.get(path)), `determinism: ${path}`)
    assert.equal(sha256(await readFile(resolve(repository, path))), sha256(value), `artifact: ${path}`)
  }
  const report = JSON.parse(first.get('tools/roster-import/reports/validation.json'))
  assert.equal(report.checks.preservedStarterFiles, 18)
  assert.equal(report.checks.pngCrcAndDecode, 838)
})
