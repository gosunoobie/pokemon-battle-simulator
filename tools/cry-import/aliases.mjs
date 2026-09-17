import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { sha256 } from './metadata.mjs'

const expected = { castformrainy: 'castform', castformsnowy: 'castform', castformsunny: 'castform', deoxysattack: 'deoxys', deoxysdefense: 'deoxys', deoxysspeed: 'deoxys' }
const assert = (condition, message) => { if (!condition) throw new Error(message) }
export async function resolveCryMappings(root, inventory) {
  const bytes = await readFile(resolve(root, 'tools/cry-import/form-aliases.json'))
  const aliases = JSON.parse(bytes), evidenceIds = new Set(), inputPaths = ['tools/cry-import/form-aliases.json']
  assert(aliases.schemaVersion === 1 && aliases.evidence?.length > 0 && aliases.aliases?.length === 6, 'Invalid cry form alias evidence')
  for (const evidence of aliases.evidence) {
    assert(typeof evidence.id === 'string' && !evidenceIds.has(evidence.id) && /^https:\/\/github.com\/pret\/(pokeemerald|pokefirered)$/.test(evidence.repository) && /^[a-f0-9]{40}$/.test(evidence.gitCommit), 'Invalid or duplicate evidence source')
    evidenceIds.add(evidence.id)
    for (const file of evidence.files) {
      assert(/^form-evidence\/(pokeemerald|pokefirered)\/[a-zA-Z0-9_./-]+\.excerpts\.json$/.test(file.localPath) && !file.localPath.split('/').includes('..'), 'Invalid evidence path')
      const path = `tools/cry-import/${file.localPath}`, local = await readFile(resolve(root, path))
      assert(local.length === file.localBytes && sha256(local) === file.localSha256, `Form evidence differs: ${file.localPath}`)
      const record = JSON.parse(local)
      assert(record.schemaVersion === 1 && record.repository === evidence.repository && record.gitCommit === evidence.gitCommit &&
        record.sourcePath === file.path && record.sourceBytes === file.bytes && record.sourceSha256 === file.sha256 && record.sourceGitBlobSha === file.gitBlobSha &&
        file.url === `https://raw.githubusercontent.com/${evidence.repository.slice('https://github.com/'.length)}/${evidence.gitCommit}/${file.path}`, 'Source excerpt provenance disagrees with its evidence pin')
      assert(Array.isArray(record.excerpts) && record.excerpts.length > 0, 'Missing source excerpts')
      for (const excerpt of record.excerpts) assert(Number.isInteger(excerpt.startLine) && excerpt.startLine > 0 && Number.isInteger(excerpt.endLine) && excerpt.endLine >= excerpt.startLine &&
        typeof excerpt.text === 'string' && excerpt.text.endsWith('\n') && excerpt.text.split('\n').length - 1 === excerpt.endLine - excerpt.startLine + 1 && sha256(excerpt.text) === excerpt.sha256, 'Invalid source excerpt')
      inputPaths.push(path)
    }
  }
  const byId = new Map(inventory.mappings.map(row => [row.id, row])), resolved = new Map()
  for (const alias of aliases.aliases) {
    const mapping = byId.get(alias.id), base = byId.get(alias.baseId)
    assert(Object.hasOwn(expected, alias.id) && expected[alias.id] === alias.baseId && !resolved.has(alias.id) &&
      mapping?.status === 'unresolved' && base?.status === 'direct' && mapping.baseSpeciesId === alias.baseId && alias.sourcePath === base.selectedPath &&
      typeof alias.reason === 'string' && alias.reason.length > 0 && alias.evidenceIds?.length > 0 && alias.evidenceIds.every(id => evidenceIds.has(id)), `Unsupported cry alias: ${alias.id}`)
    resolved.set(alias.id, { ...mapping, status: 'verified-form-alias', selectedPath: alias.sourcePath, sharedWith: alias.baseId, evidence: alias.reason, evidenceIds: alias.evidenceIds })
  }
  const mappings = inventory.mappings.map(row => resolved.get(row.id) ?? row)
  assert(mappings.every(row => row.selectedPath && row.status !== 'unresolved'), 'Cry mappings remain unresolved')
  return { mappings, aliases, inputPaths: [...new Set(inputPaths)].sort() }
}
