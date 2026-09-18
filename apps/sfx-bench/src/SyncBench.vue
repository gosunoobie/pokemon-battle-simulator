<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { createScene } from '../../game/src/scene/index.js'
import { previewSceneActors } from '../../game/src/scene/previewActors.js'
import { createAuditionAudio } from './audio.js'
import { createSyncLayerAudio, planSyncLayers } from './syncLayerAudio.js'
import { waveformPath } from './timing.js'
import { validateSyncPlan, SYNC_LIMITS } from './sync.js'
import { createSyncVisualAuditioner } from './syncVisual.js'
import { createThunderPunchImpactFx } from './thunderPunchImpact.js'
import { createBatchFiveFx } from './batchFiveVisual.js'
import { createBatchFiveV2Fx } from './batchFiveVisualV2.js'
import { createBatchFiveV3Fx } from './batchFiveVisualV3.js'
import { createBatchFiveV4Fx } from './batchFiveVisualV4.js'
import { createBatchSixFx } from './batchSixVisual.js'
import { createBatchSixV2Fx } from './batchSixVisualV2.js'
import { createBatchSevenFx } from './batchSevenVisual.js'
import { createBatchFiveAudio } from './batchFiveAudio.js'
import { normalizeSyncFeedback, syncFeedbackIssues, SYNC_FEEDBACK_VERDICTS as verdicts } from './syncFeedback.js'

const clone = value => JSON.parse(JSON.stringify(value))
const batchId = new URLSearchParams(window.location.search).get('batch') ?? 'sync-007'
const host = ref(null), manifest = ref(null), selectedId = ref(''), records = ref([])
const sourceId = ref('source'), native = ref(null), accentNative = ref(null), volume = ref(.2), error = ref('')
const notice = ref('Preparing the batch…'), playing = ref(false), loading = ref(false), sceneReady = ref(false)
const activeVersion = ref(''), elapsed = ref(0), trace = ref([]), storageWarning = ref('')
const savedReviews = ref([])
const audio = createAuditionAudio(), visual = createSyncVisualAuditioner()
const impactVisual = createSyncVisualAuditioner({ createFx: createThunderPunchImpactFx })
const revisedVisual = createSyncVisualAuditioner({ createFx: createBatchFiveFx })
const secondRevisedVisual = createSyncVisualAuditioner({ createFx: createBatchFiveV2Fx })
const thirdRevisedVisual = createSyncVisualAuditioner({ createFx: createBatchFiveV3Fx })
const fourthRevisedVisual = createSyncVisualAuditioner({ createFx: createBatchFiveV4Fx })
const sixthBatchVisual = createSyncVisualAuditioner({ createFx: createBatchSixFx })
const sixthRevisedVisual = createSyncVisualAuditioner({ createFx: createBatchSixV2Fx })
const seventhBatchVisual = createSyncVisualAuditioner({ createFx: createBatchSevenFx })
const revisedAudio = createBatchFiveAudio()
const manifestController = new AbortController()
let layerAudio = null
const isBatchFiveReview = () => manifest.value?.reviewPlayback?.startsWith('batch-five-feedback-')
const selectedAudio = () => isBatchFiveReview() ? revisedAudio : move.value?.accent ? (layerAudio ??= createSyncLayerAudio()) : audio
const setVolume = () => { audio.setVolume(volume.value); revisedAudio.setVolume(volume.value); layerAudio?.setVolume(volume.value) }
let scene, disposed = false, selectionVersion = 0, playbackVersion = 0, deadline
const move = computed(() => manifest.value?.moves.find(item => item.id === selectedId.value))
const record = computed(() => records.value.find(item => item.moveId === selectedId.value))
const accepted = computed(() => manifest.value?.status === 'accepted')
const batchNumber = computed(() => Number(manifest.value?.id.slice(-3) ?? batchId.slice(-3)))
const nextBatch = computed(() => manifest.value?.batches.find(batch => batch.status === 'unreviewed-comparison' && batch.id > manifest.value.id)
  ?? manifest.value?.batches.find(batch => batch.status === 'unreviewed-comparison'))
const nextBatchNumber = computed(() => Number(nextBatch.value?.id.slice(-3)))
const recordIssues = item => item ? syncFeedbackIssues(item, manifest.value?.moves.find(move => move.id === item.moveId)?.visual) : []
const reviewed = computed(() => accepted.value ? manifest.value.moves.length : records.value.filter(item => item.verdict !== 'unreviewed' && !recordIssues(item).length).length)
const errors = computed(() => {
  if (!record.value || !move.value) return []
  try {
    const issues = recordIssues(record.value)
    if (issues.length) return issues
    if (native.value) planSyncLayers(record.value.plan, native.value, move.value.visual, record.value.accent, accentNative.value)
    return []
  } catch (cause) { return [cause.message] }
})
const waveform = computed(() => waveformPath(native.value?.waveform))
const storageKey = () => `battle-lab.sync-review.v1.${manifest.value.id}.${manifest.value.revision}`
const verdictLabel = value => verdicts.find(([id]) => id === value)?.[1] ?? 'Not reviewed'
const feedbackLabel = item => recordIssues(item).length ? 'Needs tuning · not reviewed' : verdictLabel(item?.verdict)
const versionLabel = value => ({ current: 'Current version', proposed: 'Proposed version', final: 'Accepted final version', previous: 'Previous proposal' })[value] ?? (accepted.value ? 'Accepted final version' : 'Ready to compare')

function stop(message = 'Stopped. Ready to compare again.') {
  playbackVersion++; clearTimeout(deadline)
  visual.stop(); impactVisual.stop(); revisedVisual.stop(); secondRevisedVisual.stop(); thirdRevisedVisual.stop(); fourthRevisedVisual.stop(); sixthBatchVisual.stop(); sixthRevisedVisual.stop(); seventhBatchVisual.stop(); audio.stop(); revisedAudio.stop(); layerAudio?.stop(); playing.value = false; loading.value = false
  if (message) notice.value = message
}
function selectMove(id) {
  if (!manifest.value?.moves.some(item => item.id === id) || selectedId.value === id) return
  if (selectedId.value) saveFeedback(true)
  stop(); selectionVersion++; selectedId.value = id; native.value = null; accentNative.value = null
  trace.value = []; elapsed.value = 0; error.value = ''; activeVersion.value = ''
  notice.value = accepted.value ? 'Load this sound to play the accepted final version.' : 'Load this sound, then compare the current and proposed versions.'
}
function selectSide(id) { if (id !== sourceId.value) { stop(); sourceId.value = id } }
function edited() {
  if (accepted.value) return
  stop('Proposal changed. Compare it again before choosing a verdict.')
  if (record.value) record.value.verdict = 'unreviewed'
  saveFeedback(true)
}
function resetProposal() {
  if (accepted.value || !move.value || !record.value) return
  record.value.plan = clone(move.value.candidate)
  if (move.value.accent) record.value.accent.segment = clone(move.value.accent.segment)
  edited()
}
function feedbackBundle() {
  return normalizeSyncFeedback({ schemaVersion: 1, kind: 'battle-sfx-sync-feedback', batchId: manifest.value.id,
    revision: manifest.value.revision, records: clone(records.value) }, manifest.value)
}
function saveFeedback(quiet = false) {
  if (!manifest.value || accepted.value) return false
  try {
    const value = feedbackBundle()
    // Preserve unreadable prior storage instead of silently replacing user notes.
    if (storageWarning.value) throw new Error('Previous saved feedback was unreadable. Export this session before closing it.')
    localStorage.setItem(storageKey(), JSON.stringify(value))
    if (!quiet) notice.value = records.value.some(item => recordIssues(item).length)
      ? 'Notes and unfinished tuning saved. Moves with invalid tuning remain unreviewed until their fields are fixed.'
      : 'Feedback saved in this browser. Export it or send me your notes to choose the next changes.'
    return true
  } catch (cause) { if (!quiet) error.value = cause.message; return false }
}
function exportFeedback() {
  if (accepted.value) return
  try {
    const value = feedbackBundle()
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `${manifest.value.id}-feedback.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    notice.value = 'Feedback exported. This records your choices; it does not publish or approve the sound pack.'
  } catch (cause) { error.value = cause.message }
}
function readSavedReviews() {
  try {
    const prefix = `battle-lab.sync-review.v1.${manifest.value.id}.`
    savedReviews.value = Object.keys(localStorage).filter(key => key.startsWith(prefix) && key !== storageKey()).slice(-12).map(key => ({ revision: key.slice(prefix.length), text: localStorage.getItem(key) })).filter(item => typeof item.text === 'string' && item.text.length <= 100_000)
  } catch (cause) { error.value = cause.message }
}
function nativeIdentity(value) {
  return { sampleRate: value.sampleRate, sampleFrames: value.sampleFrames,
    durationSeconds: value.durationSeconds, userAgent: navigator.userAgent }
}
async function loadSound() {
  const transport = selectedAudio()
  transport.setVolume(volume.value)
  const activation = transport.unlock()
  stop('Loading the selected sound…'); loading.value = true; error.value = ''; native.value = null; accentNative.value = null
  const version = selectionVersion, runVersion = playbackVersion, selected = move.value
  try {
    if (!await activation) throw new Error('Audio is blocked. Click Enable & load sound again.')
    if (disposed || version !== selectionVersion || runVersion !== playbackVersion) return
    const loaded = selected.accent ? await transport.load(selected.asset, selected.accent.asset) : await transport.load(selected.asset)
    const value = selected.accent ? loaded.base : loaded
    if (disposed || version !== selectionVersion || runVersion !== playbackVersion) return
    native.value = value; accentNative.value = selected.accent ? loaded.accent : null
    if (!accepted.value) {
      record.value.native = nativeIdentity(value)
      if (record.value.accent) record.value.accent.native = nativeIdentity(accentNative.value)
      if (recordIssues(record.value).length) record.value.verdict = 'unreviewed'
      saveFeedback(true)
    }
    notice.value = accepted.value ? 'Ready. Play the accepted final version from either side.' : 'Ready. Play Current first, then Proposed, and compare both sides.'
  } catch (cause) {
    if (!disposed && version === selectionVersion && runVersion === playbackVersion && cause.name !== 'AbortError') error.value = cause.message
  } finally {
    if (!disposed && version === selectionVersion && runVersion === playbackVersion) loading.value = false
  }
}
function addTrace(item) { trace.value = [...trace.value.slice(-23), item] }
async function play(version, mode = 'paired') {
  const withSound = mode !== 'visual', withVisual = mode !== 'audio'
  const transport = selectedAudio()
  const activation = withSound ? transport.unlock() : Promise.resolve(true)
  stop(); const token = playbackVersion
  error.value = ''; elapsed.value = 0; trace.value = []; activeVersion.value = version
  const selected = move.value, side = sourceId.value
  const proposed = version === 'proposed' || version === 'final'
  const playbackVisual = version === 'previous' && selected.previousVisual ? selected.previousVisual
    : !proposed && selected.originalVisual ? selected.originalVisual : selected.visual
  const playbackAccent = proposed ? selected.visualAccent : version === 'previous' ? selected.previousVisualAccent : null
  const taperEdits = proposed || version === 'previous' && selected.previousPlayback?.startsWith('batch-five-feedback-')
  const plan = clone(accepted.value ? selected.plan : version === 'current' ? selected.baseline : version === 'previous' ? selected.previousReview.plan : record.value.plan)
  const accent = version === 'proposed' || version === 'final' ? clone(record.value.accent ?? null) : null
  try {
    const validation = validateSyncPlan(plan, playbackVisual)
    if (validation?.errors?.length) throw new Error(validation.errors.join('; '))
    if (accent) validateSyncPlan({ visualRate: plan.visualRate, segments: [accent.segment] }, selected.visual)
    const regions = withSound ? planSyncLayers(plan, native.value, playbackVisual, accent, accentNative.value) : []
    if (!await activation) throw new Error('Audio is blocked. Enable and load the sound first.')
    if (disposed || token !== playbackVersion) return
    if (withVisual && (!scene || !sceneReady.value)) throw new Error('The battlefield is still loading')
    playing.value = true
    notice.value = `Playing ${versionLabel(version).toLowerCase()} of ${selected.name}${mode === 'audio' ? ' sound' : mode === 'visual' ? ' animation' : ' animation and sound'}.`
    const voices = [], span = Math.max(playbackVisual.durationSeconds / plan.visualRate,
      ...regions.map(region => region.delaySeconds + region.endSeconds - region.startSeconds))
    deadline = setTimeout(() => { if (token === playbackVersion) { stop('Playback timed out.'); error.value = 'The comparison exceeded its playback deadline. Try again.' } }, (span + 5) * 1000)
    let audioBase = null
    const schedule = () => {
      if (selected.accent) {
        const run = transport.play(regions)
        audioBase = run.contextTime; voices.push(run.finished)
      } else {
        audioBase = transport.contextTime()
        for (const { delaySeconds, layer, ...region } of regions) voices.push(transport.play({ ...region, ...(isBatchFiveReview() ? { taperEdits } : {}), ...(delaySeconds > 0 ? { when: audioBase + delaySeconds } : {}) }).finished)
      }
      for (const [index, region] of regions.entries()) {
        const label = region.layer === 'accent' ? 'Impact accent' : `Sound ${index + 1}`
        addTrace({ label, timeSeconds: region.delaySeconds, origin: 'scheduled start' })
        addTrace({ label: `${label} ends`, timeSeconds: region.delaySeconds + region.endSeconds - region.startSeconds, origin: 'scheduled end' })
      }
    }
    if (withVisual) {
      const visualPlayer = playbackAccent?.id.startsWith('batch-seven-') ? seventhBatchVisual : playbackAccent?.id.startsWith('batch-six-') ? playbackAccent.id.endsWith('-v2') ? sixthRevisedVisual : sixthBatchVisual : playbackAccent?.id.startsWith('batch-five-')
        ? playbackAccent.id.endsWith('-v4') ? fourthRevisedVisual : playbackAccent.id.endsWith('-v3') ? thirdRevisedVisual : playbackAccent.id.endsWith('-v2') ? secondRevisedVisual : revisedVisual
        : playbackAccent?.id === 'thunder-punch-impact-v1' ? impactVisual : visual
      const run = visualPlayer.play({ ...selected, visual: playbackVisual, phase: 'attack' }, { scene, sourceId: side, visualRate: plan.visualRate,
        onStart() { if (token === playbackVersion && withSound) schedule() },
        onFrame(time) {
          if (token !== playbackVersion) return
          elapsed.value = time
          if (withSound && audioBase != null && Math.abs(transport.contextTime() - audioBase - time) > .1) {
            stop('Comparison interrupted.'); error.value = 'The sound and animation clocks drifted. Replay with this tab in the foreground.'
          }
        },
        onMarker(marker) { if (token === playbackVersion) addTrace(marker) },
      })
      const result = await run.finished
      if (disposed || token !== playbackVersion) return
      if (result.status !== 'completed') throw new Error(result.reason ?? `Animation ${result.status}`)
    } else schedule()
    const results = (await Promise.all(voices)).flat()
    if (disposed || token !== playbackVersion) return
    if (results.some(result => result.reason !== 'ended')) throw new Error('Sound playback was interrupted')
    clearTimeout(deadline); playing.value = false
    notice.value = accepted.value ? 'Accepted final playback finished.' : 'Comparison finished. Choose what to keep or adjust below.'
  } catch (cause) {
    if (!disposed && token === playbackVersion) { stop('Comparison stopped.'); error.value = cause.message }
  }
}
const background = () => { if (document.hidden) stop('Paused while this tab is in the background.') }
const leaving = () => { stop(); saveFeedback(true) }
onMounted(async () => {
  document.addEventListener('visibilitychange', background); window.addEventListener('pagehide', leaving)
  try {
    const response = await fetch(`/__sfx-bench/sync-batch?batch=${encodeURIComponent(batchId)}`, { signal: manifestController.signal })
    if (!response.ok) throw new Error((await response.json()).error ?? 'Batch unavailable')
    const value = await response.json(); if (disposed) return
    manifest.value = value
    document.title = `Sound + animation · Batch ${batchNumber.value}${accepted.value ? ' accepted' : ''} · Battle Lab`
    records.value = value.moves.map(item => ({ moveId: item.id, plan: clone(accepted.value ? item.plan : item.candidate), verdict: accepted.value ? 'keep' : 'unreviewed', notes: '', native: accepted.value ? item.native : null, ...(item.accent ? { accent: { assetId: item.accent.asset.id, sha256: item.accent.asset.sha256, segment: clone(item.accent.segment), native: accepted.value ? item.accent.native : null } } : {}), ...(item.visualAccent ? { visualAccent: { id: item.visualAccent.id, revision: item.visualAccent.revision } } : {}) }))
    if (!accepted.value && value.feedbackRecords) records.value = normalizeSyncFeedback({ schemaVersion: 1, kind: 'battle-sfx-sync-feedback', batchId: value.id, revision: value.revision, records: value.feedbackRecords }, value).records
    if (!accepted.value) {
      try {
        const text = localStorage.getItem(storageKey())
        if (text) records.value = normalizeSyncFeedback(JSON.parse(text), manifest.value).records
      } catch (cause) { storageWarning.value = `Saved notes could not be loaded: ${cause.message}` }
    }
    selectMove(value.defaultMoveId ?? value.moves[0].id)
    const next = await createScene(host.value, { actors: previewSceneActors('charizard', 'venusaur') })
    if (disposed) { next.dispose(); return }
    scene = next; sceneReady.value = true
  } catch (cause) { if (!disposed && cause.name !== 'AbortError') error.value = cause.message }
})
onBeforeUnmount(() => {
  saveFeedback(true); disposed = true; selectionVersion++; manifestController.abort(); stop(null)
  document.removeEventListener('visibilitychange', background); window.removeEventListener('pagehide', leaving)
  visual.dispose(); impactVisual.dispose(); revisedVisual.dispose(); secondRevisedVisual.dispose(); thirdRevisedVisual.dispose(); fourthRevisedVisual.dispose(); sixthBatchVisual.dispose(); sixthRevisedVisual.dispose(); seventhBatchVisual.dispose(); audio.dispose(); revisedAudio.dispose(); layerAudio?.dispose(); scene?.dispose()
})
</script>

<template>
  <main class="bench-shell sync-shell">
    <header class="bench-header"><a class="brand" href="/">Battle Lab<span class="accent">.</span></a><nav aria-label="Review navigation"><a href="/sfx-bench?collection=remaining">All sound studies</a><a href="/preview">Move preview</a><a href="/simulation">Simulation</a></nav><span class="dev-badge">LOCAL REVIEW</span></header>
    <section class="bench-heading"><div><p class="eyebrow">ANIMATION + SOUND / BATCH {{ String(batchNumber).padStart(2, '0') }}</p><h1>{{ accepted ? 'The final rhythm.' : 'Find the right rhythm.' }}</h1><p>{{ accepted ? `Your ${manifest?.moves.length ?? ''} accepted versions are saved. Play the finals here or continue reviewing the next batch.` : `${manifest?.moves.length ?? 'Loading'} moves. Compare what plays now with a proposed timing pass, then tell me what to adjust.` }}</p></div><div class="review-count"><strong>{{ reviewed }}<small> / {{ manifest?.moves.length ?? '…' }}</small></strong><span>{{ accepted ? 'versions' : 'feedback' }}<br>{{ accepted ? 'accepted' : 'recorded' }}</span></div></section>
    <nav v-if="manifest" class="sync-batches" aria-label="Sound review batches"><a v-for="batch in manifest.batches" :key="batch.id" :href="`/sfx-bench?batch=${batch.id}`" :aria-current="batch.id === manifest.id ? 'page' : undefined">{{ batch.label }}</a></nav>
    <p v-if="error" class="sync-error" role="alert">{{ error }}</p><p v-if="storageWarning" class="sync-error">{{ storageWarning }}</p>
    <nav v-if="manifest" class="sync-moves" :class="{'sync-moves-ten': manifest.moves.length === 10}" aria-label="Batch moves"><button v-for="(item, index) in manifest.moves" :key="item.id" :aria-pressed="item.id === selectedId" :class="{selected:item.id === selectedId}" @click="selectMove(item.id)"><span>{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ item.name }}</strong><small>{{ accepted ? 'Accepted final' : feedbackLabel(records.find(row => row.moveId === item.id)) }}</small></button></nav>
    <div class="sync-workspace">
      <section class="panel sync-stage-panel">
        <div class="panel-heading"><h2>{{ move?.name ?? 'Loading batch…' }}</h2><span class="pill">{{ versionLabel(activeVersion) }}</span></div>
        <div class="sync-field"><div ref="host" class="sync-canvas" role="img" :aria-label="`${move?.name ?? 'Move'} animation, ${sourceId === 'source' ? 'near' : 'far'} Pokémon acting`"></div><span class="sync-field-label">{{ sourceId === 'source' ? 'CHARIZARD' : 'VENUSAUR' }} · {{ sourceId === 'source' ? 'YOUR SIDE' : 'OPPONENT SIDE' }}</span><span v-if="!sceneReady" class="sync-loading">Preparing the battlefield…</span></div>
        <div class="sync-controls"><div role="group" aria-label="Attacking side"><button :aria-pressed="sourceId === 'source'" @click="selectSide('source')">Your side</button><button :aria-pressed="sourceId === 'target'" @click="selectSide('target')">Opponent side</button></div><span>{{ elapsed.toFixed(2) }} s</span></div>
        <div class="sync-play"><button v-if="!accepted" :disabled="!native || !sceneReady || playing || loading" @click="play('current')">▶ Play current</button><button v-if="!accepted && move?.previousReview?.changed" :disabled="!native || !sceneReady || playing || loading" @click="play('previous')">▶ Play previous proposal</button><button class="primary" :disabled="!native || !sceneReady || playing || loading || errors.length > 0" @click="play(accepted ? 'final' : 'proposed')">▶ {{ accepted ? 'Play final version' : 'Play proposed' }}</button><button class="stop" :disabled="!playing && !loading" @click="stop()">Stop</button></div>
        <p class="sync-notice" role="status">{{ notice }}</p><p v-if="errors.length" class="sync-error">{{ accepted ? 'Final playback could not be validated.' : 'This proposed version needs tuning and remains unreviewed. Your notes and unfinished fields can still be saved or exported.' }} {{ errors.join(' · ') }}</p>
        <div v-if="move" class="sync-proposal"><h3>{{ accepted ? 'Accepted version' : 'What to compare' }}</h3><p v-if="accepted" class="help">The final animation pace, sound regions and volume are locked to your approval on {{ manifest.approval.date }}. Earlier comparisons have been removed from playback.</p><template v-else><p v-if="move.previousReview" class="help"><strong>Your previous review: {{ verdictLabel(move.previousReview.verdict) }}.</strong> {{ move.previousReview.notes }} {{ move.previousReview.changed ? "This revised proposal needs a fresh review." : "Your choice is preserved because this proposal is unchanged." }}</p><ul><li v-for="note in move.notes" :key="note">{{ note }}</li></ul><p class="help">This timing proposal awaits your review. Playback completion never chooses a verdict.</p></template></div>
      </section>
      <aside class="sync-sidebar">
        <section class="panel"><div class="panel-heading"><h2>Sound</h2><span class="pill">{{ native ? 'Loaded' : 'Not loaded' }}</span></div><button class="primary sync-load" :disabled="!move || loading || playing" @click="loadSound">{{ loading ? 'Loading…' : native ? 'Reload sound' : 'Enable & load sound' }}</button><label class="sync-volume">Listening volume · {{ Math.round(volume * 100) }}%<input v-model.number="volume" aria-label="Listening volume" type="range" min="0" max=".6" step=".01" @input="setVolume"></label><svg class="waveform" viewBox="0 0 1000 120" preserveAspectRatio="none" role="img" aria-label="Loaded sound waveform"><line x1="0" y1="60" x2="1000" y2="60" class="zero"/><path :d="waveform" class="native-path"/></svg><p class="help">{{ native ? `${native.durationSeconds.toFixed(3)} s · ${native.sampleRate / 1000} kHz` : move?.accent ? 'The base recording and impact accent load together.' : 'One recording loads at a time.' }}</p><p v-if="accentNative" class="help">Impact accent · {{ accentNative.durationSeconds.toFixed(3) }} s · {{ accentNative.sampleRate / 1000 }} kHz · shares the animation’s audio clock.</p><div class="sync-isolate"><button :disabled="!native || playing || loading || errors.length > 0" @click="play(accepted ? 'final' : 'proposed','audio')">{{ accepted ? 'Final' : 'Proposed' }} sound only</button><button :disabled="!sceneReady || playing || loading || errors.length > 0" @click="play(accepted ? 'final' : 'proposed','visual')">{{ accepted ? 'Final' : 'Proposed' }} animation only</button></div></section>
        <section v-if="record && !accepted" class="panel sync-feedback"><div class="panel-heading"><h2>Your feedback</h2></div><label>For the proposed version<select v-model="record.verdict" aria-label="Review verdict" :disabled="errors.length > 0 || Boolean(record.accent && (!record.native || !record.accent.native))" @change="saveFeedback(true)"><option v-for="[id,label] in verdicts" :key="id" :value="id">{{ label }}</option></select></label><p v-if="record.accent && (!record.native || !record.accent.native)" class="help">Load both recordings before recording a verdict for this revised sound.</p><label>What should change?<textarea v-model="record.notes" aria-label="Review notes" @input="saveFeedback(true)" maxlength="4000" rows="4" placeholder="For example: keep the sound, but make the strike faster. Or: the impact sound arrives too early."></textarea></label><button @click="saveFeedback()">Save feedback</button><p class="help">Saved in this browser. You can also send feedback directly in chat, using the move name.</p></section>
        <section v-else-if="accepted" class="panel"><div class="panel-heading"><h2>Ready for the next batch</h2></div><p class="help">All {{ manifest.moves.length }} versions in this batch are accepted. New comparisons have their own feedback and never overwrite these finals.</p><a v-if="nextBatch" class="sync-next" :href="`/sfx-bench?batch=${nextBatch.id}`">Review batch {{ nextBatchNumber }} →</a></section>
      </aside>
    </div>
    <details v-if="record && !accepted" class="panel sync-tuning"><summary>Tune the proposed version</summary><p class="help">Change pacing or sound placement for this study. Original artwork and audio files stay intact. Editing clears this move’s verdict.</p><fieldset :disabled="playing || loading"><div class="sync-timing-top"><label>Animation pace · {{ Math.round(record.plan.visualRate * 100) }}%<input v-model.number="record.plan.visualRate" aria-label="Animation pace" type="range" :min="SYNC_LIMITS.minVisualRate" :max="SYNC_LIMITS.maxVisualRate" step=".01" @input="edited"></label><span>100% = current pacing. Lower is slower.</span><button @click="resetProposal">Restore proposal</button></div><div v-for="(segment,index) in record.plan.segments" :key="index" class="sync-region"><strong>Sound {{ index + 1 }}</strong><label>Match animation at (s)<input v-model.number="segment.cueSeconds" :aria-label="`Sound ${index + 1} animation anchor`" type="number" min="0" :max="move.visual.durationSeconds" step=".01" @input="edited"></label><label>Accent in recording (s)<input v-model.number="segment.soundAnchorSeconds" :aria-label="`Sound ${index + 1} recording anchor`" type="number" min="0" step=".01" @input="edited"></label><label>Volume adjustment (dB)<input v-model.number="segment.gainDb" :aria-label="`Sound ${index + 1} gain`" type="number" min="-60" max="0" step=".1" @input="edited"></label></div><div v-if="record.accent" class="sync-region"><strong>Impact accent</strong><label>Match animation at (s)<input v-model.number="record.accent.segment.cueSeconds" aria-label="Impact accent animation anchor" type="number" min="0" :max="move.visual.durationSeconds" step=".01" @input="edited"></label><label>Accent in recording (s)<input v-model.number="record.accent.segment.soundAnchorSeconds" aria-label="Impact accent recording anchor" type="number" min="0" step=".01" @input="edited"></label><label>Volume adjustment (dB)<input v-model.number="record.accent.segment.gainDb" aria-label="Impact accent gain" type="number" min="-60" max="0" step=".1" @input="edited"></label></div></fieldset><ul v-if="errors.length" class="sync-errors"><li v-for="message in errors" :key="message">{{ message }}</li></ul></details>
    <details class="panel sync-trace"><summary>Timing observations</summary><p class="help">Elapsed scheduled and rendered times help diagnose alignment. They do not measure when sound reaches your ears.</p><ol><li v-if="!trace.length">Play a version to see its sound and visual markers.</li><li v-for="(item,index) in trace" :key="index"><time>{{ (item.elapsedSeconds ?? item.timeSeconds)?.toFixed(3) ?? '—' }} s</time> {{ item.label }} <small>{{ item.origin }}<template v-if="item.authoredTimelineSeconds != null"> · authored {{ item.authoredTimelineSeconds.toFixed(3) }} s</template></small></li></ol></details>
    <footer class="sync-footer"><p>{{ accepted ? `Batch ${batchNumber} contains your accepted final versions. The original recordings and review evidence remain archived for reproducibility.` : `Batch ${batchNumber} is a local comparison. Your choices guide the next edit; they do not change the live game automatically.` }}</p><button v-if="!accepted" :disabled="!manifest" @click="exportFeedback">Export batch feedback</button><a v-else-if="nextBatch" class="sync-next" :href="`/sfx-bench?batch=${nextBatch.id}`">Continue to batch {{ nextBatchNumber }} →</a></footer>
    <details v-if="manifest && !accepted" class="panel sync-trace"><summary>View feedback JSON</summary><p class="help">Copy this review if your browser does not save the exported file.</p><textarea aria-label="Batch feedback JSON" readonly rows="12" :value="JSON.stringify(feedbackBundle(), null, 2)"></textarea></details>
    <details v-if="manifest && !accepted" class="panel sync-trace"><summary>Earlier saved feedback</summary><p class="help">Previous reviews are read-only records. They do not approve a changed proposal.</p><button @click="readSavedReviews">Read earlier reviews</button><div v-for="saved in savedReviews" :key="saved.revision"><p>{{ saved.revision }}</p><textarea :aria-label="`Saved feedback ${saved.revision}`" readonly rows="12" :value="saved.text"></textarea></div></details>
  </main>
</template>
