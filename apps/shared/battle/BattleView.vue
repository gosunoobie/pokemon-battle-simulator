<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import HealthCard from './HealthCard.vue'
import BattleDetails from './BattleDetails.vue'
import BattleOverlay from './BattleOverlay.vue'
import ImpactFeedback from './ImpactFeedback.vue'
import { activeMembers, createSimulationScene, spriteUrl } from './scene.js'
import { createSimulationPresenter } from './presentation.js'
import { createBattleSequence } from './sequence.js'
import { createImpactPlayback } from './impactPlayback.js'
import { sideConditionLabels, viewerResultTitle } from './viewLabels.js'

const props = defineProps({
  playerLabel: { type: String, default: 'Your team' },
  opponentName: { type: String, default: 'Opponent' },
  opponentTitle: { type: String, default: 'Battle trainer' },
  inactive: Boolean,
  audio: { type: Object, required: true },
})
const emit = defineEmits(['display', 'playback', 'message'])
const displayed = shallowRef(null), stage = ref(null), sceneAvailable = ref(null)
const playing = ref(false), openingBattle = ref(false), message = ref('')
const reducedMotion = ref(false), pageVisible = ref(true)
const battleOverlay = shallowRef(null), impactFeedback = shallowRef(null)
let audioScope = null
let generation = 0, disposed = false
const scene = createSimulationScene({ getHost: () => stage.value, onAvailability: value => { sceneAvailable.value = value } })
const impactPlayer = createImpactPlayback({ getScene: scene.get, onFeedback: value => { impactFeedback.value = value } })
function publishMessage(text) {
  if (!disposed && text) { message.value = text; emit('message', text) }
}
function playImpact(feedback, options) {
  try { if (!props.inactive) audioScope?.impact(feedback, options) } catch { /* Sound cannot suppress the impact overlay. */ }
  return impactPlayer.play(feedback, options)
}
const movePresenter = createSimulationPresenter({
  getScene: scene.get, ensureScene: (view, options) => scene.ensure(view, options),
  faintScene: (view, options) => scene.faint(view, options), playImpact,
  onDisplay: (view, options) => { displayed.value = view; scene.display(view, options); emit('display', view) },
  onMessage: publishMessage,
  onEntry: (view, actorId) => { if (!props.inactive) audioScope?.entry(view, actorId) },
  onTransition: (view, cue) => { if (!props.inactive) audioScope?.transition(view, cue) },
  onEntryCancel: () => audioScope?.cancel(),
  onMove: request => !props.inactive ? audioScope?.move(request) : null,
  loadFx: async () => (await import('./reviewedFx.js')).createReviewedBattleFx(),
})
const presenter = createBattleSequence({ presenter: movePresenter, onOverlay: value => { battleOverlay.value = value } })
const members = computed(() => activeMembers(displayed.value))
const weather = computed(() => ({ RainDance: 'Rain', SunnyDay: 'Harsh sunlight', Sandstorm: 'Sandstorm', Hail: 'Hail' }[displayed.value?.weather] ?? displayed.value?.weather))
const sideConditions = computed(() => sideConditionLabels(displayed.value))
function playback(value) { playing.value = value; emit('playback', value) }
// Idle relinquishes its transforms synchronously before any presenter borrows them.
watch([reducedMotion, playing, pageVisible, () => props.inactive], ([reduced, active, visible, inactive]) => {
  scene.setIdleMotion({ enabled: true, reducedMotion: reduced, paused: active || !visible || inactive })
}, { immediate: true, flush: 'sync' })
watch([reducedMotion, pageVisible], ([reduced, visible], [previousReduced]) => {
  if (!visible || reduced !== previousReduced) skip()
}, { flush: 'sync' })
watch(() => props.inactive, inactive => { if (inactive) skip() }, { flush: 'sync' })
const updateVisibility = () => { pageVisible.value = !document.hidden }
const current = token => !disposed && generation === token
function readyMessage(view) {
  if (view?.result) return viewerResultTitle(view)
  if (view?.decision?.kind === 'wait') return 'Waiting for the next decision.'
  return view?.decision?.kind === 'switch' ? 'Choose a Pokémon to send out.' : 'Choose your next move, or switch to a teammate.'
}

// Incoming network snapshots do not automatically touch presentation. The host
// serializes committed batches and explicitly requests a sync when necessary.
async function present(batch, options = {}) {
  if (disposed) return { status: 'cancelled' }
  if (!batch?.after) throw new TypeError('An authoritative after view is required.')
  // Stop the old presenter before assigning a new sound scope. Its cancellation
  // callback belongs to the previous batch, including during the intro overlay.
  presenter.skip()
  const scope = props.audio.begin(batch.after, batch.events)
  audioScope = scope
  const token = ++generation
  const enabled = (options.effectsEnabled ?? true) && pageVisible.value
  playback(true)
  openingBattle.value = !batch.before && enabled
  if (!batch.before) displayed.value = batch.after
  await nextTick()
  if (!current(token)) return { status: 'cancelled' }
  try {
    const result = await presenter.present({ playerLabel: props.playerLabel, opponentName: props.opponentName,
      opponentTitle: props.opponentTitle, ...batch }, {
      effectsEnabled: enabled, reducedMotion: options.reducedMotion ?? reducedMotion.value,
    })
    if (['failed', 'cancelled'].includes(result.status)) scope.cancel()
    return result
  } finally {
    if (current(token)) {
      playback(false); openingBattle.value = false
      publishMessage(readyMessage(batch.after))
    }
  }
}
async function sync(view, { run = null } = {}) {
  if (disposed) return
  const token = ++generation
  // Invalidate cues and transient overlays before waiting for Vue or textures.
  audioScope?.cancel(); props.audio.sync(view)
  presenter.reset(view, { run }); impactPlayer.clear()
  openingBattle.value = false; playback(false)
  if (!view) { displayed.value = null; scene.clear(); emit('display', null); return }
  publishMessage(readyMessage(view))
  await nextTick()
  // Texture availability is optional; reconnect must not wait on a slow renderer.
  if (current(token)) void scene.ensure(view).catch(() => {})
}
function clear() {
  audioScope?.cancel(); props.audio.stop()
  generation++; presenter.reset(null); impactPlayer.clear(); scene.clear()
  displayed.value = null; openingBattle.value = false; message.value = ''; playback(false)
  emit('display', null)
}
function skip() { audioScope?.cancel(); presenter.skip() }
function showBattle() {
  const bounds = stage.value?.getBoundingClientRect()
  if (bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight)) {
    stage.value.closest('.sim-arena')?.scrollIntoView({ behavior: reducedMotion.value ? 'instant' : 'smooth', block: 'start' })
  }
}
defineExpose({ present, sync, clear, showBattle, skip, getDisplayed: () => displayed.value })
onMounted(() => {
  reducedMotion.value = matchMedia('(prefers-reduced-motion: reduce)').matches
  updateVisibility(); document.addEventListener('visibilitychange', updateVisibility)
})
onBeforeUnmount(() => {
  disposed = true; generation++
  audioScope?.cancel(); props.audio.stop()
  document.removeEventListener('visibilitychange', updateVisibility)
  presenter.destroy(); impactPlayer.destroy(); scene.destroy()
})
</script>

<template>
  <div class="sim-field" :class="{ 'sim-field-intro': battleOverlay?.kind === 'intro', 'sim-field-opening': openingBattle }">
    <div class="sim-field-grid" aria-hidden="true"></div>
    <div ref="stage" class="sim-canvas" :aria-label="`${members[0]?.species || 'Your Pokémon'} versus ${members[1]?.species || 'opponent'}`" role="img"></div>
    <div v-if="sceneAvailable === false" class="sim-fallback" aria-hidden="true"><img v-if="members[0] && !members[0].fainted" class="sim-near-sprite" :src="spriteUrl(members[0].species, 'back')" alt=""><img v-if="members[1] && !members[1].fainted" class="sim-far-sprite" :src="spriteUrl(members[1].species)" alt=""></div>
    <div class="sim-impact-surface"><div class="sim-impact-fit"><ImpactFeedback :feedback="impactFeedback"/></div></div>
    <div class="sim-hud"><HealthCard :member="members[0]" :impact="impactFeedback?.actorId === 'source' ? impactFeedback : null"/><HealthCard :member="members[1]" :impact="impactFeedback?.actorId === 'target' ? impactFeedback : null" opponent/></div>
    <span v-if="weather" class="sim-weather">{{ weather }}</span>
    <BattleOverlay :overlay="battleOverlay"/>
  </div>
  <p class="sim-announcement" role="status" aria-live="polite">{{ message }}</p>
  <div v-if="sideConditions.length" class="sim-side-conditions"><span v-for="condition in sideConditions" :key="condition">{{ condition }}</span></div>
  <div class="sim-battle-details"><BattleDetails :member="members[0]"/><BattleDetails :member="members[1]" opponent/></div>
  <p v-if="sceneAvailable === false" class="sim-render-note">Effects are unavailable on this device. Battle controls still work.</p>
</template>
