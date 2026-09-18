import { BENCH_ROOT, BenchError, createBenchService } from './bench.mjs'
import { createCollectionManifest } from './collection.mjs'
import { readLocal, assert } from './audit-io.mjs'
import { sha256 } from './mp3.mjs'
import { importReviewBundle, validateReviewRecord } from '../../packages/battle-sfx/src/review.js'

/** Local read-only serving; draft generation is an explicit offline command. */
export function createCollectionService({ root = BENCH_ROOT } = {}) {
  const manifest = () => createCollectionManifest({ root })
  const reference = createBenchService({ root, getManifest: manifest })
  async function current() {
    const context = await manifest()
    const { readRemainingAnalysis } = await import('./analysis.mjs')
    return { context, report: await readRemainingAnalysis({ root, manifest: context }) }
  }
  return {
    manifest,
    reference: assetId => reference.reference(assetId),
    async analysis() { return (await current()).report },
    async drafts(id) {
      if (typeof id !== 'string' || !/^batch-\d{3}$/.test(id)) throw new BenchError('Invalid draft batch ID', 400)
      const { context, report } = await current()
      const batch = report.batches.find(row => row.id === id)
      if (!batch) throw new BenchError('Unknown draft batch', 404)
      const path = `tools/audio-import/review/remaining/${id}.json`
      assert(batch.path === path, 'Draft report path mismatch')
      const bytes = await readLocal(root, path)
      assert(bytes.length <= 1024 * 1024 && sha256(bytes) === batch.sha256, 'Draft batch differs from analysis report; regenerate technical drafts')
      const reviewContext = { catalog: context, visualRevisions: context.visualRevisions }
      const value = importReviewBundle(bytes.toString('utf8'), reviewContext)
      assert(value.records.length === batch.count, 'Draft batch count mismatch')
      const visualDurations = Object.fromEntries(context.subjects.filter(row => row.fxId).map(row => [`${row.kind}:${row.id}:${row.phase}`, row.durationSeconds]))
      for (const record of value.records) {
        assert(record.status === 'draft' && record.approvalFingerprint === null, 'Generated collection batches may contain drafts only')
        assert(!record.review.near && !record.review.far && !record.review.native.alignmentConfirmed, 'Technical generation cannot assert listening checks')
        assert(record.review.reviewer === '' && record.review.native.browser === '' && record.review.native.version === '' && record.review.native.sampleRate === null && record.review.native.sampleFrames === null, 'Generated drafts must leave native measurements and reviewer identity unfilled')
        if (record.subject.kind === 'move') {
          const result = validateReviewRecord(record, { ...reviewContext, visualDurations })
          assert(result.valid, result.errors.join('; '))
        }
      }
      return value
    },
  }
}
