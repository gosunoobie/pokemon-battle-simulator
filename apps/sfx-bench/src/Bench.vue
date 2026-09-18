<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { createScene } from '../../game/src/scene/index.js'
import { previewSceneActors } from '../../game/src/scene/previewActors.js'
import { createReviewRecord, validateReviewRecord, approveReviewRecord, resetReviewRecord, exportReviewBundle, importReviewBundle } from '../../../packages/battle-sfx/src/review.js'
import { createAuditionAudio } from './audio.js'
import { createVisualAuditioner } from './visual.js'
import { planAudition, waveformPath } from './timing.js'

const STORAGE_KEY = 'battle-lab.sfx-bench.reviews.v1'
const keyFor = subject => `${subject.kind}:${subject.id}:${subject.phase}`
const recordKey = value => `${keyFor(value.subject)}:${value.source.assetId}`
const clone = value => JSON.parse(JSON.stringify(value))
const host = ref(null), manifest = ref(null), subjectKey = ref(''), assetId = ref('')
const sourceId = ref('source'), selectedRegion = ref(0), clickAction = ref('sourceAnchorFrame')
const record = ref(null), saved = ref([]), reference = ref(null), native = ref(null)
const loading = ref(false), playing = ref(false), sceneReady = ref(false), error = ref(''), notice = ref('Loading the pilot worklist…')
const elapsed = ref(0), trace = ref([]), diagnostics = ref(null), volume = ref(.2), recoveredText = ref('')
const trials = ref({ source: false, target: false }), fileInput = ref(null)
const audio = createAuditionAudio(), visual = createVisualAuditioner()
let scene, disposed = false, selectionVersion = 0, playbackVersion = 0, referenceController
let recoveryStored = false
const subject = computed(() => manifest.value?.subjects.find(item => keyFor(item) === subjectKey.value))
const asset = computed(() => manifest.value?.assets[assetId.value])
const canPair = computed(() => Boolean(subject.value?.fxId && asset.value && !(subject.value.id === 'present' && asset.value.variant?.outcome === 'heal')))
const context = computed(() => ({ catalog: manifest.value, visualRevisions: manifest.value?.visualRevisions,
  visualDurations: Object.fromEntries((manifest.value?.subjects ?? []).filter(item => item.kind === 'move').map(item => [keyFor(item), item.durationSeconds])) }))
const activeRegion = computed(() => record.value?.segments[selectedRegion.value])
const errors = computed(() => record.value ? validateReviewRecord(record.value, context.value).errors : [])
const referencePath = computed(() => {
  const channels = reference.value?.waveform?.channels
  return channels ? waveformPath({ min: channels[0].map((_, i) => Math.min(...channels.map(channel => channel[i][0]))), max: channels[0].map((_, i) => Math.max(...channels.map(channel => channel[i][1]))) }) : ''
})
const nativePath = computed(() => waveformPath(native.value?.waveform))
const reviewedCount = computed(() => saved.value.filter(item => item.status === 'approved').length)
const percentage = frame => asset.value ? 100 * frame / asset.value.decoded.sampleFrames : 0
const seconds = frame => asset.value ? (frame / asset.value.decoded.sampleRate).toFixed(3) : '0.000'

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
  record.value.status = 'draft'; record.value.approvalFingerprint = null
}
function persistReviews(text) {
  if (recoveredText.value && !recoveryStored) {
    localStorage.setItem(`${STORAGE_KEY}.recovery.${Date.now()}`, recoveredText.value)
    recoveryStored = true
  }
  localStorage.setItem(STORAGE_KEY, text)
}
function saveDraft(quiet = false) {
  if (!record.value) return true
  const validation = validateReviewRecord(record.value, context.value)
  if (!validation.valid) { if (!quiet) error.value = validation.errors.join(' · '); return false }
  const key = recordKey(record.value), next = saved.value.filter(item => recordKey(item) !== key)
  next.push(clone(record.value))
  try {
    const text = exportReviewBundle(next, context.value)
    persistReviews(text)
    saved.value = next
    if (!quiet) notice.value = 'Review saved in this browser. Export JSON for a durable copy.'
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
  const prior = saved.value.find(item => recordKey(item) === `${subjectKey.value}:${assetId.value}`)
  record.value = prior ? clone(prior) : createReviewRecord({ asset: asset.value, subject: subject.value, visualRevision: subject.value.visualRevision, decoderReference: manifest.value.provenance })
  referenceController = new AbortController()
  notice.value = 'Inspect the reference waveform, then enable and load the browser recording.'
  try {
    const response = await fetch(`/__sfx-bench/reference?assetId=${encodeURIComponent(assetId.value)}`, { signal: referenceController.signal })
    if (!response.ok) throw new Error((await response.json()).error ?? 'Reference decode unavailable')
    const value = await response.json()
    if (!disposed && version === selectionVersion) reference.value = value
  } catch (cause) { if (!disposed && version === selectionVersion && cause.name !== 'AbortError') error.value = cause.message }
}
function selectSubject() {
  assetId.value = subject.value?.assetIds.find(id => manifest.value.assets[id].variant.type === 'whole') ?? subject.value?.assetIds[0] ?? ''
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
  if (!record.value || playing.value || !reference.value) return
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
  try { record.value = approveReviewRecord(record.value, context.value); if (saveDraft()) notice.value = 'Listening review recorded for this source, settings and browser. Production playback remains disabled.' }
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
    downloadText(exportReviewBundle(saved.value, context.value), 'battle-sfx-reviews.json')
    notice.value = 'Review bundle exported. Keep it with the source and animation revision it names.'
  } catch (cause) { error.value = cause.message }
}
async function importReviews(event) {
  const file = event.target.files?.[0]; event.target.value = ''
  if (!file) return
  try {
    if (file.size > 1024 * 1024) throw new Error('Review file exceeds 1 MiB')
    const bundle = importReviewBundle(await file.text(), context.value)
    const records = Array.isArray(bundle) ? bundle : bundle.records
    const merged = new Map(saved.value.map(item => [recordKey(item), item]))
    for (const item of records) merged.set(recordKey(item), item)
    const text = exportReviewBundle([...merged.values()], context.value)
    persistReviews(text); saved.value = [...merged.values()]
    await selectRecording({ preserve: false }); notice.value = 'Reviews imported and checked against the current source and animation revisions.'
  } catch (cause) { error.value = `Import rejected: ${cause.message}` }
}
function onVisibility() { if (document.hidden) stop('Paused for the background tab. Replay when ready.') }
function onPageHide() { stop('Page closed.'); saveDraft(true) }
function onKey(event) { if (event.key === 'Escape') stop() }
onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibility); window.addEventListener('keydown', onKey); window.addEventListener('pagehide', onPageHide)
  try {
    const response = await fetch('/__sfx-bench/manifest')
    if (!response.ok) throw new Error((await response.json()).error ?? 'Bench manifest unavailable')
    const data = await response.json()
    if (disposed) return
    manifest.value = data
    let text
    try {
      text = localStorage.getItem(STORAGE_KEY)
      if (text) { const imported = importReviewBundle(text, context.value); saved.value = Array.isArray(imported) ? imported : imported.records }
    } catch (cause) { if (text) recoveredText.value = text; error.value = `Saved reviews were not loaded: ${cause.message}. Their stored copy has been retained.` }
    subjectKey.value = keyFor(data.subjects[0]); selectSubject()
    const next = await createScene(host.value, { actors: previewSceneActors() })
    if (disposed) next.dispose(); else { scene = next; sceneReady.value = true }
  } catch (cause) { if (!disposed) error.value = cause.message }
})
onBeforeUnmount(() => {
  disposed = true; selectionVersion++; stop(); referenceController?.abort(); visual.dispose(); audio.dispose(); scene?.dispose()
  document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('keydown', onKey); window.removeEventListener('pagehide', onPageHide)
})
</script>

<template>
  <main class="bench-shell">
    <header class="bench-header"><a href="/" class="brand">◉ <span>Battle Lab<span class="accent">.</span></span></a><nav><a href="/playground">FX playground ↗</a><span class="dev-badge">LOCAL AUTHORING</span></nav></header>
    <section class="bench-heading"><div><p class="eyebrow">SOUND × MOTION / STAGE B</p><h1>SFX audition bench<span class="accent">.</span></h1><p>Keep the character. Find the moment.</p></div><div class="review-count"><strong>{{ reviewedCount }}</strong><span>reviews signed off<br>{{ saved.length }} saved drafts & reviews</span></div></section>
    <div class="toolbar"><label>Study<select v-model="subjectKey" :disabled="!manifest || playing || loading" @change="selectSubject"><option v-for="item in manifest?.subjects" :key="keyFor(item)" :value="keyFor(item)">{{ item.name }}{{ item.phase === 'prepare' ? ' · prepare' : '' }}{{ item.kind === 'event' ? ' · sound only' : '' }}</option></select></label><label class="recording-select">Recording<select v-model="assetId" :disabled="!subject?.assetIds.length || playing || loading" @change="selectRecording"><option v-if="!subject?.assetIds.length" value="">No named recording</option><option v-for="id in subject?.assetIds" :key="id" :value="id">{{ manifest.assets[id].file }}</option></select></label><div class="file-actions"><button @click="exportReviews" :disabled="!manifest || playing">Export reviews ↓</button><button @click="fileInput.click()" :disabled="!manifest || playing || loading">Import JSON</button><input ref="fileInput" type="file" accept=".json,application/json" hidden @change="importReviews"></div></div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="recoveredText" class="recovery">A previous review bundle needs migration. Its original copy is retained. <button @click="downloadText(recoveredText, 'battle-sfx-reviews-recovery.json')">Export previous reviews ↓</button></p>
    <p class="status" role="status">{{ notice }}</p>
    <div class="bench-grid">
      <section class="panel visual-panel"><div class="panel-heading"><h2><span>01</span> Animation</h2><span class="pill">{{ subject?.fxId ? 'Original FX' : 'Audio-only study' }}</span></div>
        <div ref="host" class="bench-stage" role="img" aria-label="Charizard and Venusaur displaying the selected move animation"><div v-if="!sceneReady" class="stage-loading">Preparing the battlefield…</div></div>
        <div class="transport"><div class="side-switch" aria-label="Move user"><button :aria-pressed="sourceId === 'source'" :disabled="playing" @click="sourceId = 'source'">Near side</button><button :aria-pressed="sourceId === 'target'" :disabled="playing" @click="sourceId = 'target'">Far side</button></div><button class="primary" :disabled="!sceneReady || !native || !reference || !canPair || playing || loading" @click="audition('paired')">▶ Play together</button><button :disabled="!sceneReady || !subject?.fxId || playing || loading" @click="audition('visual')">FX only</button><button class="stop" :disabled="!playing && !loading" @click="stop()">■ Stop</button></div>
        <div class="timeline"><div class="timeline-line"><i :style="{ left: `${Math.min(100, 100 * elapsed / (subject?.durationSeconds || 1))}%` }"></i><button v-for="marker in subject?.markers" :key="marker.id" :title="`${marker.label}: ${marker.timeSeconds}s`" :disabled="!record || playing" :style="{ left: `${100 * marker.timeSeconds / (subject.durationSeconds || 1)}%` }" @click="activeRegion.visualAnchorSeconds = marker.timeSeconds; settingsEdited()"><span>{{ marker.label }}</span></button></div><div class="timeline-labels"><span>0.00 s</span><span>{{ elapsed.toFixed(2) }} / {{ subject?.durationSeconds?.toFixed(2) ?? '—' }} s</span></div></div>
        <p class="help">Markers are authored timing guides. Click one to set the selected region’s visual anchor. Observed result cues appear in the trace below.</p>
        <ul class="subject-notes"><li v-for="note in subject?.notes" :key="note">{{ note }}</li></ul>
      </section>
      <section class="panel waveform-panel"><div class="panel-heading"><h2><span>02</span> Recording</h2><span class="pill">{{ record?.status ?? 'unresolved' }}</span></div>
        <div class="wave-toolbar"><button class="primary" :disabled="!asset || loading || playing" @click="loadNative">{{ native ? 'Reload sound' : 'Enable & load sound' }}</button><label>Monitor volume · {{ Math.round(volume * 100) }}%<input v-model.number="volume" aria-label="Monitor volume" type="range" min="0" max=".6" step=".01" @input="audio.setVolume(volume)"></label></div>
        <div class="wave-label"><strong>Pinned reference</strong><span>{{ asset ? `${(asset.decoded.sampleRate / 1000).toFixed(1)} kHz · ${asset.decoded.sampleFrames.toLocaleString()} frames` : 'No asset' }}</span></div>
        <svg class="waveform reference-wave" viewBox="0 0 1000 120" preserveAspectRatio="none" role="img" aria-label="Pinned source waveform; editable with the numeric controls below" @click="markWave"><line x1="0" y1="60" x2="1000" y2="60" class="zero"/><rect v-if="activeRegion" :x="percentage(activeRegion.startFrame) * 10" y="0" :width="Math.max(0, percentage(activeRegion.endFrame - activeRegion.startFrame)) * 10" height="120" class="region"/><path :d="referencePath" class="reference-path"/><line v-if="activeRegion" :x1="percentage(activeRegion.sourceAnchorFrame) * 10" y1="0" :x2="percentage(activeRegion.sourceAnchorFrame) * 10" y2="120" class="anchor"/></svg>
        <div class="wave-label"><strong>Browser decode</strong><span>{{ native ? `${(native.sampleRate / 1000).toFixed(1)} kHz · ${native.sampleFrames.toLocaleString()} frames` : 'Load a recording to compare' }}</span></div>
        <svg class="waveform native-wave" viewBox="0 0 1000 120" preserveAspectRatio="none" role="img" aria-label="Current browser decoded waveform"><line x1="0" y1="60" x2="1000" y2="60" class="zero"/><path :d="nativePath" class="native-path"/></svg>
        <div class="wave-summary"><span>Reference {{ asset?.decoded.durationSeconds.toFixed(4) ?? '—' }} s</span><span>Browser {{ native?.durationSeconds.toFixed(4) ?? '—' }} s</span><span>Sample peak {{ native?.peak.toFixed(4) ?? '—' }}</span></div>
        <div class="audio-actions"><button :disabled="!native || playing" @click="audition('original')">▶ Full original</button><button :disabled="!native || playing" @click="audition('regions')">▶ Selected regions</button><label>Wave click sets<select v-model="clickAction"><option value="sourceAnchorFrame">Sound anchor</option><option value="startFrame">Region start</option><option value="endFrame">Region end</option></select></label></div>
        <p class="help">The amber line is your chosen sound anchor. Waveforms show amplitude, not proof of an audible attack. Similar duration does not prove browser alignment. Playback remains at 1×.</p>
      </section>
      <section v-if="record" class="panel region-panel"><div class="panel-heading"><h2><span>03</span> Region & alignment</h2><div class="region-actions"><button :disabled="playing || record.segments.length >= 8" @click="addRegion">+ Region</button><button :disabled="playing || record.segments.length === 1" @click="removeRegion">Remove</button></div></div>
        <div class="region-tabs"><button v-for="(_, index) in record.segments" :key="index" :aria-pressed="selectedRegion === index" @click="selectedRegion = index">Region {{ index + 1 }}</button></div>
        <fieldset :disabled="playing || loading" class="region-fields"><label>Start frame<input v-model.number="activeRegion.startFrame" type="number" min="0" step="1" @input="settingsEdited"><small>{{ seconds(activeRegion.startFrame) }} s</small></label><label>End frame · exclusive<input v-model.number="activeRegion.endFrame" type="number" min="1" step="1" @input="settingsEdited"><small>{{ seconds(activeRegion.endFrame) }} s</small></label><label>Sound anchor frame<input v-model.number="activeRegion.sourceAnchorFrame" type="number" min="0" step="1" @input="settingsEdited"><small>{{ seconds(activeRegion.sourceAnchorFrame) }} s</small></label><label>Visual anchor · seconds<input v-model.number="activeRegion.visualAnchorSeconds" type="number" min="0" step=".01" @input="settingsEdited"><small>From the animation’s actual start</small></label><label>Region gain · dB<input v-model.number="activeRegion.gainDb" type="number" min="-60" max="6" step=".5" @input="settingsEdited"><small>0 preserves the decoded level</small></label><label>Native offset · seconds<input v-model.number="activeRegion.nativeOffsetSeconds" type="number" step=".0001" @input="settingsEdited"><small>Positive shifts later in browser audio</small></label></fieldset>
        <p class="help">A region starts early enough for its sound anchor to meet the visual anchor. Negative start times and out-of-buffer regions are rejected. Offsets need measured or listening evidence; zero is only a starting hypothesis. All regions use this same recording.</p>
        <ul v-if="errors.length" class="validation"><li v-for="message in errors" :key="message">{{ message }}</li></ul>
      </section>
      <section v-if="record" class="panel review-panel"><div class="panel-heading"><h2><span>04</span> Listening review</h2><span class="pill">{{ record.review.native.browser || 'No browser measurement' }} {{ record.review.native.version }}</span></div>
        <fieldset :disabled="playing || loading"><label>Your name<input v-model="record.review.reviewer" maxlength="120" placeholder="Reviewer" @input="evidenceEdited"></label><label>Sound identity, region & level notes<textarea v-model="record.review.notes" maxlength="4000" rows="2" placeholder="What works, what needs changing, and any embedded hit accent…" @input="evidenceEdited"></textarea></label><label>Browser alignment & output device notes<textarea v-model="record.review.native.notes" maxlength="4000" rows="2" placeholder="Compare the waveforms and listen. Record speakers/headphones, any offset and why…" @input="evidenceEdited"></textarea></label>
        <label class="check"><input v-model="record.review.near" type="checkbox" :disabled="!canPair || !trials.source && !record.review.near" @change="evidenceEdited"> I reviewed the near-side fit{{ subject.fxId && !trials.source ? ' (play together first)' : '' }}</label><label class="check"><input v-model="record.review.far" type="checkbox" :disabled="!canPair || !trials.target && !record.review.far" @change="evidenceEdited"> I reviewed the far-side fit{{ subject.fxId && !trials.target ? ' (play together first)' : '' }}</label><label class="check"><input v-model="record.review.native.alignmentConfirmed" type="checkbox" :disabled="!native" @change="evidenceEdited"> I checked source-to-browser alignment and heard the intended cue</label></fieldset>
        <div class="review-actions"><button :disabled="playing" @click="saveDraft()">Save draft</button><button class="primary" :disabled="playing || !native || !reference || !canPair" @click="approve">Record listening approval</button><button :disabled="playing" @click="resetDraft">Reset draft</button></div><p v-if="!canPair" class="help">Audio-only study: save listening notes and regions as a draft. Approval awaits a matching visual study.</p><p class="help">This records your review for this configuration and browser. It does not approve every browser, enable production SFX or grant asset rights. Editing a region clears listening evidence.</p>
      </section>
    </div>
    <section class="panel trace-panel"><div class="panel-heading"><h2><span>↳</span> Timing trace</h2><span>Dispatch & scheduling observations · not measured audiovisual latency</span></div><div class="trace-grid"><ol><li v-if="!trace.length">Play together to inspect timing.</li><li v-for="(entry, index) in trace" :key="index"><time>{{ entry.timeSeconds.toFixed(3) }} s</time> {{ entry.label }} <small>{{ entry.origin }}{{ entry.observedTimelineSeconds != null ? ` · observed ${entry.observedTimelineSeconds.toFixed(3)} s` : '' }}</small></li></ol><div class="diagnostics"><p>Browser output estimates</p><dl><dt>Base latency</dt><dd>{{ diagnostics?.baseLatency != null ? `${(diagnostics.baseLatency * 1000).toFixed(1)} ms` : 'Not reported' }}</dd><dt>Output latency</dt><dd>{{ diagnostics?.outputLatency != null ? `${(diagnostics.outputLatency * 1000).toFixed(1)} ms` : 'Not reported' }}</dd><dt>Output headroom</dt><dd>{{ diagnostics?.safetyAttenuation != null ? `${diagnostics.safetyAttenuation.toFixed(3)}×` : 'Bounded audition mix' }}</dd></dl><p class="help">Use listening or audiovisual capture to judge actual sound-to-image timing. A blocked tab, Bluetooth output or stalled frame can change the result.</p></div></div></section>
    <footer><span>Battle Lab · Development-only authoring · Source audio stays unchanged</span><span>Escape to stop · {{ subject?.visualRevision?.slice(0, 12) ?? 'No visual revision' }}</span></footer>
  </main>
</template>
