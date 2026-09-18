<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { createScene } from '../../game/src/scene/index.js'
import { previewSceneActors } from '../../game/src/scene/previewActors.js'
import { createReviewRecord, approveReviewRecord, resetReviewRecord } from '../../../packages/battle-sfx/src/review.js'
import { createAuditionAudio } from './audio.js'
import { createVisualAuditioner } from './visual.js'
import { planAudition, waveformPath } from './timing.js'
import { collectionSubjectKey as keyFor, collectionRecordKey as recordKey, collectionStorageKey, collectionContext, canPairCollectionSubject, validateCollectionRecord, importCollectionBundle, exportCollectionBundle } from './collection.js'
import './collection.css'

const clone = value => JSON.parse(JSON.stringify(value))
const host = ref(null), manifest = ref(null), subjectKey = ref(''), assetId = ref('')
const sourceId = ref('source'), selectedRegion = ref(0), clickAction = ref('sourceAnchorFrame')
const record = ref(null), saved = ref([]), reference = ref(null), native = ref(null)
const loading = ref(false), playing = ref(false), sceneReady = ref(false), error = ref(''), notice = ref('Loading the remaining collection…')
const elapsed = ref(0), trace = ref([]), diagnostics = ref(null), volume = ref(.2), recoveredText = ref('')
const trials = ref({ source: false, target: false }), fileInput = ref(null)
const analysis = ref(null), batchId = ref(''), activeBatchId = ref(''), batchLoading = ref(false), query = ref('')
const generated = ref([]), generatedKeys = ref(new Set()), loadingBatchVersion = ref(0)
const batches = computed(() => analysis.value?.batches ?? [])
const batch = computed(() => batches.value.find(item => item.id === activeBatchId.value))
const draftSubjects = computed(() => new Set(generated.value.map(item => keyFor(item.subject))))
const availableSubjects = computed(() => (manifest.value?.subjects ?? []).filter(item => draftSubjects.value.has(keyFor(item))))
const filteredSubjects = computed(() => availableSubjects.value.filter(item => `${item.name} ${item.id} ${item.phase}`.toLowerCase().includes(query.value.toLowerCase().trim()) || keyFor(item) === subjectKey.value))
const availableAssets = computed(() => (subject.value?.assetIds ?? []).filter(id => generatedKeys.value.has(`${subjectKey.value}:${id}`)))
const technicalDraft = computed(() => generated.value.find(item => recordKey(item) === `${subjectKey.value}:${assetId.value}`))
const candidate = computed(() => analysis.value?.candidates?.find(item => item.key === `${subjectKey.value}:${assetId.value}`))
const measurement = computed(() => analysis.value?.measurements?.find(item => item.assetId === assetId.value))
const unresolved = computed(() => (manifest.value?.subjects ?? []).filter(item => !item.assetIds.length))
const unpairedStudies = computed(() => (manifest.value?.subjects ?? []).filter(item => item.kind === 'move' && !item.fxId && item.assetIds.length))
const coverage = computed(() => ({ studies: manifest.value?.subjects.length ?? 0, assets: Object.keys(manifest.value?.assets ?? {}).length }))
const audio = createAuditionAudio(), visual = createVisualAuditioner()
let scene, disposed = false, selectionVersion = 0, playbackVersion = 0, referenceController
let recoveryStored = false
const storageKey = () => collectionStorageKey(activeBatchId.value, manifest.value?.collectionRevision)
const subject = computed(() => manifest.value?.subjects.find(item => keyFor(item) === subjectKey.value))
const asset = computed(() => manifest.value?.assets[assetId.value])
const canPair = computed(() => canPairCollectionSubject(subject.value, asset.value) && candidate.value?.visualComparisonAllowed !== false)
const context = computed(() => collectionContext(manifest.value, record.value))
const activeRegion = computed(() => record.value?.segments[selectedRegion.value])
const errors = computed(() => record.value ? validateCollectionRecord(record.value, manifest.value).errors : [])
const referencePath = computed(() => {
  const channels = reference.value?.waveform?.channels
  return channels ? waveformPath({ min: channels[0].map((_, i) => Math.min(...channels.map(channel => channel[i][0]))), max: channels[0].map((_, i) => Math.max(...channels.map(channel => channel[i][1]))) }) : ''
})
const nativePath = computed(() => waveformPath(native.value?.waveform))
const reviewedCount = computed(() => saved.value.filter(item => item.status === 'approved').length)
const percentage = frame => asset.value ? 100 * frame / asset.value.decoded.sampleFrames : 0
const seconds = frame => asset.value ? (frame / asset.value.decoded.sampleRate).toFixed(3) : '0.000'
const decibels = value => Number.isFinite(value) ? `${value.toFixed(1)} dB` : '—'

function browserIdentity() {
  const ua = navigator.userAgent
  const match = ua.match(/(Edg|Firefox|Chrome)\/([\d.]+)/) ?? ua.match(/Version\/([\d.]+).*Safari/)
  return match ? { browser: match[1] === 'Edg' ? 'Edge' : match[1] === 'Chrome' ? 'Chrome' : match[1] === 'Firefox' ? 'Firefox' : 'Safari', version: match[1] === 'Edg' || match[1] === 'Chrome' || match[1] === 'Firefox' ? match[2] : match[1] } : { browser: 'Unknown browser', version: '' }
}
function stop(message = 'Stopped. Ready to audition again.') {
  playbackVersion++
  visual.stop(); audio.stop()
  playing.value = false; loading.value = false
  diagnostics.value = audio.diagnostics()
  if (typeof message === 'string') notice.value = message
}
function settingsEdited() {
  stop('Draft changed. Replay both sides before signing off.')
  if (!record.value) return
  record.value = resetReviewRecord(record.value)
  trials.value = { source: false, target: false }
}
function evidenceEdited() {
  if (!record.value) return
  record.value.status = 'draft'; record.value.approvalFingerprint = null
}
function persistReviews(text) {
  if (recoveredText.value && !recoveryStored) {
    localStorage.setItem(`${storageKey()}.recovery.${Date.now()}`, recoveredText.value)
    recoveryStored = true
  }
  localStorage.setItem(storageKey(), text)
}
function saveDraft(quiet = false) {
  if (!record.value) return true
  const validation = validateCollectionRecord(record.value, manifest.value)
  if (!validation.valid) { if (!quiet) error.value = validation.errors.join(' · '); return false }
  const key = recordKey(record.value), next = saved.value.filter(item => recordKey(item) !== key)
  next.push(clone(record.value))
  try {
    const text = exportCollectionBundle(next, manifest.value, generatedKeys.value)
    persistReviews(text)
    saved.value = next
    if (!quiet) notice.value = 'Draft saved in this browser’s batch. Export this batch for a durable copy.'
  } catch (cause) { error.value = `Could not save: ${cause.message}`; return false }
  return true
}
async function selectRecording({ preserve = true } = {}) {
  if (preserve && record.value && !saveDraft(true)) {
    subjectKey.value = keyFor(record.value.subject); assetId.value = record.value.source.assetId
    error.value = 'This draft is invalid and has not been discarded. Fix its fields or reset it before changing recordings.'
    return
  }
  stop(); referenceController?.abort(); selectionVersion++
  const version = selectionVersion
  native.value = null; reference.value = null; trace.value = []; elapsed.value = 0; selectedRegion.value = 0
  trials.value = { source: false, target: false }; error.value = ''; loading.value = false
  if (!asset.value || !subject.value) { record.value = null; notice.value = 'No named recording. This case stays explicitly unresolved.'; return }
  const prior = saved.value.find(item => recordKey(item) === `${subjectKey.value}:${assetId.value}`) ?? technicalDraft.value
  record.value = prior ? clone(prior) : createReviewRecord({ asset: asset.value, subject: subject.value, visualRevision: subject.value.visualRevision, decoderReference: manifest.value.provenance })
  referenceController = new AbortController()
  notice.value = 'Inspect the reference waveform, then enable and load the browser recording.'
  try {
    const response = await fetch(`/__sfx-bench/collection-reference?assetId=${encodeURIComponent(assetId.value)}`, { signal: referenceController.signal })
    if (!response.ok) throw new Error((await response.json()).error ?? 'Reference decode unavailable')
    const value = await response.json()
    if (!disposed && version === selectionVersion) reference.value = value
  } catch (cause) { if (!disposed && version === selectionVersion && cause.name !== 'AbortError') error.value = cause.message }
}
function selectSubject() {
  assetId.value = availableAssets.value.find(id => manifest.value.assets[id].variant.type === 'whole') ?? availableAssets.value[0] ?? ''
  selectRecording()
}
async function loadNative() {
  const activation = audio.unlock() // stays inside the click gesture
  const version = selectionVersion
  if (!asset.value) return
  stop('Loading and measuring this browser’s decoder…'); loading.value = true; error.value = ''
  const runVersion = playbackVersion
  try {
    if (!await activation) throw new Error('Audio is blocked. Click Enable & load sound again.')
    if (disposed || version !== selectionVersion || runVersion !== playbackVersion) return
    native.value = null
    const value = await audio.load(asset.value)
    if (disposed || version !== selectionVersion || runVersion !== playbackVersion) return
    native.value = value
    const identity = browserIdentity(), previous = record.value.review.native
    if (previous.sampleRate !== value.sampleRate || previous.sampleFrames !== value.sampleFrames || previous.browser !== identity.browser || previous.version !== identity.version) {
      record.value = resetReviewRecord(record.value)
      trials.value = { source: false, target: false }
    }
    Object.assign(record.value.review.native, identity, { sampleRate: value.sampleRate, sampleFrames: value.sampleFrames })
    diagnostics.value = audio.diagnostics()
    notice.value = 'Ready. Compare the original recording, selected regions, and animation together.'
  } catch (cause) { if (!disposed && version === selectionVersion && runVersion === playbackVersion && cause.name !== 'AbortError') error.value = cause.message }
  finally { if (!disposed && version === selectionVersion && runVersion === playbackVersion) loading.value = false }
}
function addTrace(value) { trace.value = [...trace.value.slice(-29), value] }
async function audition(mode) {
  const activation = mode === 'visual' ? Promise.resolve(true) : audio.unlock()
  stop(); const version = playbackVersion
  error.value = ''; trace.value = []; elapsed.value = 0
  const paired = mode === 'paired', visualOnly = mode === 'visual'
  if (!subject.value?.fxId && (paired || visualOnly) || paired && !canPair.value) return
  const selectedSubject = subject.value, selectedSide = sourceId.value
  let plans
  try {
    if (!visualOnly && !native.value) throw new Error('Enable and load the recording first')
    if (paired || mode === 'regions') {
      if (errors.value.length) throw new Error(errors.value.join(' · '))
      plans = planAudition(record.value, native.value)
    }
    if (!await activation) throw new Error('Audio is blocked. Enable it and try again.')
    if (disposed || version !== playbackVersion) return
    playing.value = true
    notice.value = visualOnly ? 'Playing the original animation.' : paired ? 'Auditioning the selected regions with the animation.' : 'Auditioning this recording.'
    const voices = []
    let audioBase = null
    function schedule(baseTime) {
      audioBase = baseTime
      for (const [index, plan] of plans.entries()) {
        voices.push(audio.play({ ...plan, ...(plan.delaySeconds > 0 ? { when: baseTime + plan.delaySeconds } : {}) }).finished)
        addTrace({ label: `Region ${index + 1} scheduled`, timeSeconds: plan.delaySeconds, origin: 'audio-schedule' })
      }
    }
    let result
    if (visualOnly || paired) {
      const run = visual.play(selectedSubject, { scene, sourceId: selectedSide,
        onStart() {
          addTrace({ label: 'FX ready · timeline start', timeSeconds: 0, origin: 'observed-start' })
          if (paired) schedule(audio.contextTime())
        },
        onFrame(time) {
          if (version !== playbackVersion) return
          elapsed.value = time
          if (paired && audioBase != null && Math.abs(audio.contextTime() - audioBase - time) > .1) {
            stop('Audition interrupted.'); error.value = 'Audio and animation clocks drifted by more than 100 ms. Replay in a foreground tab.'
          }
        },
        onMarker(marker) { if (version === playbackVersion) addTrace(marker) },
      })
      result = await run.finished
      if (disposed || version !== playbackVersion) return
      if (result.status !== 'completed') { audio.stop(); throw new Error(result.reason ?? `Animation ${result.status}`) }
    } else if (mode === 'original') {
      voices.push(audio.play({ startSeconds: 0, endSeconds: native.value.durationSeconds, gainDb: 0 }).finished)
    } else schedule(audio.contextTime())
    const completions = await Promise.all(voices)
    if (completions.some(value => value.reason !== 'ended')) throw new Error('Audio was interrupted. Replay before recording a listening check.')
    if (disposed || version !== playbackVersion) return
    if (paired) trials.value = { ...trials.value, [selectedSide]: true }
    diagnostics.value = audio.diagnostics(); playing.value = false
    notice.value = paired ? 'Audition complete. Record what you heard; timing diagnostics are not a listening approval.' : 'Playback complete.'
  } catch (cause) {
    if (!disposed && version === playbackVersion) { stop('Audition stopped.'); error.value = cause.message }
  }
}
function markWave(event) {
  if (!record.value || playing.value || loading.value || batchLoading.value || !reference.value) return
  const bounds = event.currentTarget.getBoundingClientRect(), ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
  const frame = Math.round(ratio * asset.value.decoded.sampleFrames)
  activeRegion.value[clickAction.value] = clickAction.value === 'endFrame' ? frame : Math.min(frame, asset.value.decoded.sampleFrames - 1)
  settingsEdited()
}
function addRegion() {
  record.value.segments.push(clone(activeRegion.value)); selectedRegion.value = record.value.segments.length - 1; settingsEdited()
}
function removeRegion() {
  record.value.segments.splice(selectedRegion.value, 1); selectedRegion.value = 0; settingsEdited()
}
function approve() {
  error.value = ''
  if (!canPair.value) { error.value = 'This is an audio-only candidate. Keep it as a draft until a matching visual study is available.'; return }
  try { record.value = approveReviewRecord(record.value, context.value); if (saveDraft()) notice.value = 'Listening review recorded for this source, settings and browser. This does not expand production move playback.' }
  catch (cause) { error.value = cause.message }
}
function resetDraft() {
  stop(); record.value = createReviewRecord({ asset: asset.value, subject: subject.value, visualRevision: subject.value.visualRevision, decoderReference: manifest.value.provenance })
  if (native.value) Object.assign(record.value.review.native, browserIdentity(), { sampleRate: native.value.sampleRate, sampleFrames: native.value.sampleFrames })
  selectedRegion.value = 0; trials.value = { source: false, target: false }; error.value = ''
}
function downloadText(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function exportReviews() {
  if (!saveDraft(true)) { error.value = 'Fix this draft’s validation errors before export.'; return }
  try {
    downloadText(exportCollectionBundle(saved.value, manifest.value, generatedKeys.value), `battle-sfx-${activeBatchId.value}.json`)
    notice.value = 'Review bundle exported. Keep it with the source and animation revision it names.'
  } catch (cause) { error.value = cause.message }
}
async function importReviews(event) {
  const file = event.target.files?.[0]; event.target.value = ''
  if (!file) return
  try {
    if (file.size > 1024 * 1024) throw new Error('Review file exceeds 1 MiB')
    const records = importCollectionBundle(await file.text(), manifest.value, generatedKeys.value)
    const merged = new Map(saved.value.map(item => [recordKey(item), item]))
    for (const item of records) merged.set(recordKey(item), item)
    const text = exportCollectionBundle([...merged.values()], manifest.value, generatedKeys.value)
    persistReviews(text); saved.value = [...merged.values()]
    await selectRecording({ preserve: false }); notice.value = 'Reviews imported and checked against the current source and animation revisions.'
  } catch (cause) { error.value = `Import rejected: ${cause.message}` }
}
function onVisibility() { if (document.hidden) stop('Paused for the background tab. Replay when ready.') }
function onPageHide() { stop('Page closed.'); saveDraft(true) }
function onKey(event) { if (event.key === 'Escape') stop() }
async function readJson(url, options) {
  const response = await fetch(url, options)
  const value = await response.json()
  if (!response.ok) throw new Error(value.error ?? `Request failed (${response.status})`)
  return value
}
async function loadBatch() {
  if (record.value && !saveDraft(true)) {
    batchId.value = activeBatchId.value
    error.value = 'Fix this draft before leaving its batch. Your edits have been retained.'
    return
  }
  const requested = batchId.value, version = ++loadingBatchVersion.value
  stop(); referenceController?.abort(); selectionVersion++
  batchLoading.value = true; error.value = ''
  try {
    const bundle = await readJson(`/__sfx-bench/drafts?batch=${encodeURIComponent(requested)}`)
    if (disposed || version !== loadingBatchVersion.value) return
    const originals = importCollectionBundle(JSON.stringify(bundle), manifest.value)
    const keys = new Set(originals.map(recordKey))
    let local = [], recovered = '', stored, recoveryError = ''
    try {
      stored = localStorage.getItem(collectionStorageKey(requested, manifest.value.collectionRevision))
      if (stored) local = importCollectionBundle(stored, manifest.value, keys)
    } catch (cause) {
      recovered = stored ?? ''
      recoveryError = `Saved edits were not loaded: ${cause.message}. The original stored copy has been retained.`
    }
    activeBatchId.value = requested; generated.value = originals; generatedKeys.value = keys
    recoveredText.value = recovered; recoveryStored = false
    const merged = new Map(originals.map(item => [recordKey(item), clone(item)]))
    for (const item of local) merged.set(recordKey(item), item)
    saved.value = [...merged.values()]; query.value = ''; record.value = null
    const first = originals[0]
    subjectKey.value = first ? keyFor(first.subject) : ''
    assetId.value = first?.source.assetId ?? ''
    await selectRecording({ preserve: false })
    if (recoveryError) error.value = recoveryError
    if (!disposed && version === loadingBatchVersion.value) notice.value = `${originals.length} technical drafts loaded. Regions and gains are proposals; no listening approval has been added.`
  } catch (cause) {
    if (!disposed && version === loadingBatchVersion.value) { error.value = cause.message; batchId.value = activeBatchId.value }
  } finally { if (!disposed && version === loadingBatchVersion.value) batchLoading.value = false }
}
function restoreProposal() {
  if (!technicalDraft.value) return
  stop(); record.value = clone(technicalDraft.value)
  if (native.value) Object.assign(record.value.review.native, browserIdentity(), { sampleRate: native.value.sampleRate, sampleFrames: native.value.sampleFrames })
  trials.value = { source: false, target: false }; selectedRegion.value = 0
  notice.value = 'Generated proposal restored. Listening checks remain empty.'
}
function applyAlternative(alternative) {
  if (!record.value || !alternative?.segments) return
  const proposed = resetReviewRecord({ ...clone(record.value), segments: clone(alternative.segments) })
  const checked = validateCollectionRecord(proposed, manifest.value)
  if (!checked.valid) { error.value = checked.errors.join(' · '); return }
  stop(); record.value = proposed; trials.value = { source: false, target: false }; selectedRegion.value = 0
  error.value = ''; notice.value = `${alternative.label} applied for comparison. Replay both perspectives; this is a measured hypothesis, not listening approval.`
}
onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibility); window.addEventListener('keydown', onKey); window.addEventListener('pagehide', onPageHide)
  try {
    const [data, summary] = await Promise.all([readJson('/__sfx-bench/collection'), readJson('/__sfx-bench/analysis')])
    if (disposed) return
    if (!data.collectionRevision || summary.provenance?.collectionRevision !== data.collectionRevision) throw new Error('The analysis collection revision is stale. Regenerate the technical drafts before auditioning this collection.')
    manifest.value = data; analysis.value = summary
    batchId.value = batches.value[0]?.id ?? ''
    const next = await createScene(host.value, { actors: previewSceneActors() })
    if (disposed) { next.dispose(); return }
    scene = next; sceneReady.value = true
    if (batchId.value) await loadBatch()
    else notice.value = 'No generated batches yet. Run the collection analysis pipeline to prepare drafts.'
  } catch (cause) { if (!disposed) error.value = cause.message }
})
onBeforeUnmount(() => {
  disposed = true; selectionVersion++; loadingBatchVersion.value++; stop(); referenceController?.abort(); visual.dispose(); audio.dispose(); scene?.dispose()
  document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('keydown', onKey); window.removeEventListener('pagehide', onPageHide)
})
</script>

<template>
  <main class="bench-shell">
    <header class="bench-header"><a href="/" class="brand">◉ <span>Battle Lab<span class="accent">.</span></span></a><nav><a href="/sfx-bench">Approved pilot ↗</a><a href="/playground">FX playground ↗</a><span class="dev-badge">LOCAL AUTHORING</span></nav></header>
    <section class="bench-heading"><div><p class="eyebrow">SOUND × MOTION / REMAINING COLLECTION</p><h1>Collection audition bench<span class="accent">.</span></h1><p>Inspect proposed cue regions and volume against each original animation.</p></div><div class="review-count"><strong>{{ reviewedCount }}</strong><span>signed off in this batch<br>{{ saved.length }} batch drafts & reviews</span></div></section>
    <section class="collection-overview" aria-label="Collection analysis summary"><div><strong>{{ coverage.studies }}</strong><span>visual & audio studies</span></div><div><strong>{{ coverage.assets }}</strong><span>pinned recordings</span></div><div><strong>{{ batches.length }}</strong><span>bounded draft batches</span></div><p>Technical proposals preserve the original source. They have no listening checks or production approval. Playback here is an audition only.</p></section>
    <section class="collection-batches"><label>Draft batch<select v-model="batchId" :disabled="batchLoading || playing || loading" @change="loadBatch"><option v-for="item in batches" :key="item.id" :value="item.id">{{ item.label ?? item.id }} · {{ item.count ?? item.records ?? item.recordCount ?? '—' }} drafts</option></select></label><label>Filter studies in this batch<input v-model="query" type="search" placeholder="Name, move ID or phase" :disabled="batchLoading"></label><p>{{ batch?.description ?? 'Each batch has separate browser storage and a separate export. Source and animation revisions are checked when loading.' }}</p></section>
    <details v-if="unresolved.length" class="collection-unresolved"><summary>{{ unresolved.length }} studies have no named recording</summary><p>{{ unresolved.map(item => `${item.name}${item.phase === 'prepare' ? ' (prepare)' : ''}`).join(', ') }}. These stay unresolved; no replacement sound is inferred.</p></details>
    <details v-if="unpairedStudies.length" class="collection-unresolved"><summary>{{ unpairedStudies.length }} moves have recordings but no registered animation</summary><p>{{ unpairedStudies.map(item => item.name).join(', ') }}. Their measurements remain in the analysis report; no animation or sound mapping is invented.</p></details>
    <div class="toolbar"><label>Study<select v-model="subjectKey" :disabled="!manifest || batchLoading || playing || loading" @change="selectSubject"><option v-for="item in filteredSubjects" :key="keyFor(item)" :value="keyFor(item)">{{ item.name }}{{ item.phase === 'prepare' ? ' · prepare' : '' }}{{ !item.fxId ? ' · sound only' : '' }}</option></select></label><label class="recording-select">Recording<select v-model="assetId" :disabled="!availableAssets.length || batchLoading || playing || loading" @change="selectRecording"><option v-if="!availableAssets.length" value="">No named recording</option><option v-for="id in availableAssets" :key="id" :value="id">{{ manifest.assets[id].file }}</option></select></label><div class="file-actions"><button @click="exportReviews" :disabled="!manifest || !activeBatchId || batchLoading || playing">Export batch ↓</button><button @click="fileInput.click()" :disabled="!manifest || !activeBatchId || batchLoading || playing || loading">Import batch JSON</button><input ref="fileInput" type="file" accept=".json,application/json" hidden @change="importReviews"></div></div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="recoveredText" class="recovery">A saved batch needs migration. Its original copy is retained. <button @click="downloadText(recoveredText, `battle-sfx-${activeBatchId}-recovery.json`)">Export previous reviews ↓</button></p>
    <p class="status" role="status">{{ notice }}</p>
    <div class="bench-grid">
      <section class="panel visual-panel"><div class="panel-heading"><h2><span>01</span> Animation</h2><span class="pill">{{ canPair ? 'Original FX comparison' : 'Audio-only recording' }}</span></div>
        <div ref="host" class="bench-stage" role="img" aria-label="Charizard and Venusaur displaying the selected move animation"><div v-if="!sceneReady" class="stage-loading">Preparing the battlefield…</div></div>
        <div class="transport"><div class="side-switch" aria-label="Move user"><button :aria-pressed="sourceId === 'source'" :disabled="playing || batchLoading" @click="sourceId = 'source'">Near side</button><button :aria-pressed="sourceId === 'target'" :disabled="playing || batchLoading" @click="sourceId = 'target'">Far side</button></div><button class="primary" :disabled="!sceneReady || !native || !reference || !canPair || playing || loading || batchLoading" @click="audition('paired')">▶ Play together</button><button :disabled="!sceneReady || !subject?.fxId || playing || loading || batchLoading" @click="audition('visual')">FX only</button><button class="stop" :disabled="!playing && !loading" @click="stop()">■ Stop</button></div>
        <div class="timeline" v-if="subject?.fxId"><div class="timeline-line"><i :style="{ left: `${Math.min(100, 100 * elapsed / (subject?.durationSeconds || 1))}%` }"></i><button v-for="marker in subject?.markers" :key="marker.id" :title="`${marker.label}: ${marker.timeSeconds}s`" :disabled="!record || playing || loading || batchLoading" :style="{ left: `${100 * marker.timeSeconds / (subject.durationSeconds || 1)}%` }" @click="activeRegion.visualAnchorSeconds = marker.timeSeconds; settingsEdited()"><span>{{ marker.label }}</span></button></div><div class="timeline-labels"><span>0.00 s</span><span>{{ elapsed.toFixed(2) }} / {{ subject?.durationSeconds?.toFixed(2) ?? '—' }} s</span></div></div>
        <p v-if="subject?.fxId" class="help">Markers are authored timing guides. Click one to set the selected region’s visual anchor. Observed result cues appear in the trace below.</p>
        <ul class="subject-notes"><li v-for="note in subject?.notes" :key="note">{{ note }}</li></ul>
      </section>
      <section class="panel waveform-panel"><div class="panel-heading"><h2><span>02</span> Recording</h2><span class="pill">{{ record?.status ?? 'unresolved' }}</span></div>
        <div class="wave-toolbar"><button class="primary" :disabled="!asset || loading || playing || batchLoading" @click="loadNative">{{ native ? 'Reload sound' : 'Enable & load sound' }}</button><label>Monitor volume · {{ Math.round(volume * 100) }}%<input v-model.number="volume" aria-label="Monitor volume" type="range" min="0" max=".6" step=".01" @input="audio.setVolume(volume)"></label></div>
        <div class="wave-label"><strong>Pinned reference</strong><span>{{ asset ? `${(asset.decoded.sampleRate / 1000).toFixed(1)} kHz · ${asset.decoded.sampleFrames.toLocaleString()} frames` : 'No asset' }}</span></div>
        <svg class="waveform reference-wave" viewBox="0 0 1000 120" preserveAspectRatio="none" role="img" aria-label="Pinned source waveform; editable with the numeric controls below" @click="markWave"><line x1="0" y1="60" x2="1000" y2="60" class="zero"/><rect v-if="activeRegion" :x="percentage(activeRegion.startFrame) * 10" y="0" :width="Math.max(0, percentage(activeRegion.endFrame - activeRegion.startFrame)) * 10" height="120" class="region"/><path :d="referencePath" class="reference-path"/><line v-if="activeRegion" :x1="percentage(activeRegion.sourceAnchorFrame) * 10" y1="0" :x2="percentage(activeRegion.sourceAnchorFrame) * 10" y2="120" class="anchor"/></svg>
        <div class="wave-label"><strong>Browser decode</strong><span>{{ native ? `${(native.sampleRate / 1000).toFixed(1)} kHz · ${native.sampleFrames.toLocaleString()} frames` : 'Load a recording to compare' }}</span></div>
        <svg class="waveform native-wave" viewBox="0 0 1000 120" preserveAspectRatio="none" role="img" aria-label="Current browser decoded waveform"><line x1="0" y1="60" x2="1000" y2="60" class="zero"/><path :d="nativePath" class="native-path"/></svg>
        <div class="wave-summary"><span>Reference {{ asset?.decoded.durationSeconds.toFixed(4) ?? '—' }} s</span><span>Browser {{ native?.durationSeconds.toFixed(4) ?? '—' }} s</span><span>Sample peak {{ native?.peak.toFixed(4) ?? '—' }}</span></div>
        <div class="audio-actions"><button :disabled="!native || playing || batchLoading" @click="audition('original')">▶ Full original</button><button :disabled="!native || playing || batchLoading" @click="audition('regions')">▶ Selected regions</button><label>Wave click sets<select v-model="clickAction"><option value="sourceAnchorFrame">Sound anchor</option><option value="startFrame">Region start</option><option value="endFrame">Region end</option></select></label></div>
        <p class="help">The amber line is your chosen sound anchor. Waveforms show amplitude, not proof of an audible attack. Similar duration does not prove browser alignment. Playback remains at 1×.</p>
      </section>
      <section v-if="record" class="panel proposal-panel"><div class="panel-heading"><h2><span>↳</span> Generated technical proposal</h2><span class="pill">Not a listening review</span></div><div v-if="measurement" class="proposal-measurements"><span>Reference peak <strong>{{ decibels(measurement.peakDbfs) }}FS</strong></span><span>Whole-file RMS <strong>{{ decibels(measurement.rmsDbfs) }}FS</strong></span><span>Proposed gain <strong>{{ decibels(measurement.suggestedGainDb) }}</strong></span><span>Current region <strong>{{ decibels(activeRegion?.gainDb) }}</strong></span></div><p>{{ technicalDraft?.review.notes || 'No generated notes for this recording.' }}</p><ul v-if="candidate?.flags?.length" class="proposal-flags"><li v-for="flag in candidate.flags" :key="flag">{{ flag }}</li></ul><p v-if="candidate?.reasoning?.length">{{ candidate.reasoning.join(' ') }}</p><div v-if="candidate?.alternatives?.length" class="proposal-alternatives"><article v-for="alternative in candidate.alternatives" :key="alternative.id"><h3>{{ alternative.label }}</h3><p>{{ alternative.description }}</p><button :disabled="playing || loading || batchLoading" @click="applyAlternative(alternative)">Apply proposal · {{ alternative.label }}</button></article></div><p v-if="!canPair" class="help">This recording has no matching visual study for its role. Later-turn effects and Present’s healing sound are audio-only: the current attack animation does not represent them. Paired playback and visual approval are unavailable.</p><button :disabled="playing || loading || batchLoading" @click="restoreProposal">Restore generated proposal</button></section>
      <section v-if="record" class="panel region-panel"><div class="panel-heading"><h2><span>03</span> Region & alignment</h2><div class="region-actions"><button :disabled="playing || batchLoading || record.segments.length >= 8" @click="addRegion">+ Region</button><button :disabled="playing || batchLoading || record.segments.length === 1" @click="removeRegion">Remove</button></div></div>
        <div class="region-tabs"><button v-for="(_, index) in record.segments" :key="index" :aria-pressed="selectedRegion === index" @click="selectedRegion = index">Region {{ index + 1 }}</button></div>
        <fieldset :disabled="playing || loading || batchLoading" class="region-fields"><label>Start frame<input v-model.number="activeRegion.startFrame" type="number" min="0" step="1" @input="settingsEdited"><small>{{ seconds(activeRegion.startFrame) }} s</small></label><label>End frame · exclusive<input v-model.number="activeRegion.endFrame" type="number" min="1" step="1" @input="settingsEdited"><small>{{ seconds(activeRegion.endFrame) }} s</small></label><label>Sound anchor frame<input v-model.number="activeRegion.sourceAnchorFrame" type="number" min="0" step="1" @input="settingsEdited"><small>{{ seconds(activeRegion.sourceAnchorFrame) }} s</small></label><label>Visual anchor · seconds<input v-model.number="activeRegion.visualAnchorSeconds" type="number" min="0" step=".01" @input="settingsEdited"><small>From the animation’s actual start</small></label><label>Region gain · dB<input v-model.number="activeRegion.gainDb" type="number" min="-60" max="6" step=".5" @input="settingsEdited"><small>0 preserves the decoded level</small></label><label>Native offset · seconds<input v-model.number="activeRegion.nativeOffsetSeconds" type="number" step=".0001" @input="settingsEdited"><small>Positive shifts later in browser audio</small></label></fieldset>
        <p class="help">A region starts early enough for its sound anchor to meet the visual anchor. Negative start times and out-of-buffer regions are rejected. Offsets need measured or listening evidence; zero is only a starting hypothesis. All regions use this same recording.</p>
        <ul v-if="errors.length" class="validation"><li v-for="message in errors" :key="message">{{ message }}</li></ul>
      </section>
      <section v-if="record" class="panel review-panel"><div class="panel-heading"><h2><span>04</span> Manual listening review</h2><span class="pill">{{ record.review.native.browser || 'No browser measurement' }} {{ record.review.native.version }}</span></div>
        <fieldset :disabled="playing || loading || batchLoading"><label>Your name<input v-model="record.review.reviewer" maxlength="120" placeholder="Reviewer" @input="evidenceEdited"></label><label>Sound identity, region & level notes<textarea v-model="record.review.notes" maxlength="4000" rows="2" placeholder="What works, what needs changing, and any embedded hit accent…" @input="evidenceEdited"></textarea></label><label>Browser alignment & output device notes<textarea v-model="record.review.native.notes" maxlength="4000" rows="2" placeholder="Compare the waveforms and listen. Record speakers/headphones, any offset and why…" @input="evidenceEdited"></textarea></label>
        <label class="check"><input v-model="record.review.near" type="checkbox" :disabled="!canPair || !trials.source && !record.review.near" @change="evidenceEdited"> I reviewed the near-side fit{{ subject.fxId && !trials.source ? ' (play together first)' : '' }}</label><label class="check"><input v-model="record.review.far" type="checkbox" :disabled="!canPair || !trials.target && !record.review.far" @change="evidenceEdited"> I reviewed the far-side fit{{ subject.fxId && !trials.target ? ' (play together first)' : '' }}</label><label class="check"><input v-model="record.review.native.alignmentConfirmed" type="checkbox" :disabled="!native" @change="evidenceEdited"> I checked source-to-browser alignment and heard the intended cue</label></fieldset>
        <div class="review-actions"><button :disabled="playing || batchLoading" @click="saveDraft()">Save draft</button><button class="primary" :disabled="playing || batchLoading || !native || !reference || !canPair" @click="approve">Record listening approval</button><button :disabled="playing || batchLoading" @click="resetDraft">Reset draft</button></div><p v-if="!canPair" class="help">Audio-only study: save listening notes and regions as a draft. Approval awaits a matching visual study.</p><p class="help">This records your review for this configuration and browser. Generated measurements never fill these listening checks. This review does not enable production SFX or approve every browser. Editing a region clears listening evidence.</p>
      </section>
    </div>
    <section class="panel trace-panel"><div class="panel-heading"><h2><span>↳</span> Timing trace</h2><span>Dispatch & scheduling observations · not measured audiovisual latency</span></div><div class="trace-grid"><ol><li v-if="!trace.length">Play together to inspect timing.</li><li v-for="(entry, index) in trace" :key="index"><time>{{ entry.timeSeconds.toFixed(3) }} s</time> {{ entry.label }} <small>{{ entry.origin }}{{ entry.observedTimelineSeconds != null ? ` · observed ${entry.observedTimelineSeconds.toFixed(3)} s` : '' }}</small></li></ol><div class="diagnostics"><p>Browser output estimates</p><dl><dt>Base latency</dt><dd>{{ diagnostics?.baseLatency != null ? `${(diagnostics.baseLatency * 1000).toFixed(1)} ms` : 'Not reported' }}</dd><dt>Output latency</dt><dd>{{ diagnostics?.outputLatency != null ? `${(diagnostics.outputLatency * 1000).toFixed(1)} ms` : 'Not reported' }}</dd><dt>Output headroom</dt><dd>{{ diagnostics?.safetyAttenuation != null ? `${diagnostics.safetyAttenuation.toFixed(3)}×` : 'Bounded audition mix' }}</dd></dl><p class="help">Use listening or audiovisual capture to judge actual sound-to-image timing. A blocked tab, Bluetooth output or stalled frame can change the result.</p></div></div></section>
    <footer><span>Battle Lab · Development-only authoring · Source audio stays unchanged</span><span>Escape to stop · {{ subject?.visualRevision?.slice(0, 12) ?? 'No visual revision' }}</span></footer>
  </main>
</template>
