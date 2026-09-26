<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { FX_CATALOG } from '@battle/battle-fx/catalog'
import { previewSpriteHeight } from '../../game/src/scene/previewActors.js'
import { createScene } from '../../game/src/scene/index.js'
import { MOVE_DETAILS } from '../../game/src/moveDetails.js'
import { ROSTER } from '../../game/src/roster/index.js'
import RosterPicker from '../../game/src/components/RosterPicker.vue'
import { createPlaygroundAudio, getPlaygroundSoundInfo } from './audio.js'
import { createPlaygroundPlayback } from './playback.js'
import './playground.css'

const details = new Map(MOVE_DETAILS.map(item => [item.id, item]))
const moves = FX_CATALOG.map(item => ({ ...item, ...details.get(item.id), sound: getPlaygroundSoundInfo(item.id) }))
  .sort((a, b) => a.name.localeCompare(b.name))
const host = ref(null), move = ref('hydro-pump'), source = ref('charizard'), target = ref('venusaur')
const search = ref(''), filter = ref('all'), activeActorId = ref('source'), phase = ref('attack')
const sourceSize = ref(1), targetSize = ref(1), layout = ref('wide'), reversed = ref(false)
const reducedMotion = ref(false), repeat = ref(false), repeatGap = ref(1000), seed = ref(42), effectiveness = ref('')
const loading = ref(true), sceneReady = ref(false), sceneError = ref(''), cryMessage = ref('')
const dimensions = { wide: [1000, 450], square: [720, 600], portrait: [560, 700] }
const selected = computed(() => moves.find(item => item.id === move.value))
const phased = computed(() => selected.value.phases?.includes('prepare'))
const normalize = value => String(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const filteredMoves = computed(() => moves.filter(item =>
  normalize(`${item.name} ${item.id} ${item.number}`).includes(normalize(search.value))
  && (filter.value !== 'sound' || item.sound.available)
  && (filter.value !== 'phased' || item.phases?.includes('prepare'))))
const sourceName = computed(() => ROSTER[source.value]?.name ?? (source.value === 'tall' ? 'Tall test shape' : 'Wide test shape'))
const targetName = computed(() => ROSTER[target.value]?.name ?? (target.value === 'tall' ? 'Tall test shape' : 'Wide test shape'))
const soundLabel = computed(() => !selected.value.sound.available ? 'No compatible move sound'
  : selected.value.sound.kind === 'accepted' ? 'Synced move sound' : 'Move sound available')
const stageStyle = computed(() => ({ aspectRatio: dimensions[layout.value].join(' / ') }))
const audio = createPlaygroundAudio()
const audioState = shallowRef(audio.getState())
const unsubscribeAudio = audio.subscribe(value => { audioState.value = value })
const playbackState = shallowRef({ status: 'idle', busy: false, cue: null, iteration: 0 })
let scene = null, disposed = false, generation = 0, cryGeneration = 0, motionPreference
const player = createPlaygroundPlayback({ getScene: () => scene, audio, onState: value => { playbackState.value = value } })
const busy = computed(() => playbackState.value.busy)
const status = computed(() => loading.value ? 'Loading scene' : sceneError.value ? 'Scene unavailable'
  : ({ idle: 'Ready', loading: 'Preparing sound', playing: 'Playing', waiting: 'Looping', error: 'Playback unavailable' }[playbackState.value.status] ?? 'Ready'))
const message = computed(() => sceneError.value || (loading.value ? 'Preparing your Pokémon…' : playbackState.value.message || 'Choose a move and press Play effect.'))
const cueLabel = computed(() => ({ prepared: 'Preparation', impact: 'Contact', recovery: 'Recovery' }[playbackState.value.cue] ?? 'Ready for contact'))
const audioNote = computed(() => !audioState.value.enabled ? 'Sound is muted.'
  : audioState.value.status === 'unavailable' ? 'Audio is unavailable in this browser.'
  : audioState.value.loadError ? 'A recording could not load. Play again to retry.'
  : !audioState.value.sfxEnabled ? 'Move sounds are off. Cry auditions are still available.'
  : reducedMotion.value ? 'Reduced motion uses a shorter visual; move sound is paused.'
  : phase.value === 'prepare' ? 'Preparation previews are silent.'
  : !selected.value.sound.available ? 'This move previews visually; no compatible recording is available.'
  : 'Sound follows the effect. Recordings play at their original speed.')

function stop() { cryGeneration++; cryMessage.value = ''; player.stop() }
async function refresh() {
  const token = ++generation
  stop(); scene?.dispose(); scene = null; sceneReady.value = false; loading.value = true; sceneError.value = ''
  await nextTick()
  if (disposed || token !== generation || !host.value) return
  const [width, height] = dimensions[layout.value]
  const left = reversed.value ? .75 : .25, right = 1 - left
  try {
    const next = await createScene(host.value, { width, height, actors: [
      { id: 'source', profile: source.value, view: 'back', x: left, y: .82, height: previewSpriteHeight(source.value, { scale: Number(sourceSize.value), width, height }), facing: reversed.value ? -1 : 1 },
      { id: 'target', profile: target.value, view: 'front', x: right, y: .63, height: previewSpriteHeight(target.value, { scale: Number(targetSize.value), far: true, width, height }), facing: reversed.value ? 1 : -1 },
    ] })
    if (disposed || token !== generation) { next.dispose(); return }
    scene = next; sceneReady.value = true; loading.value = false
    player.stop('Ready to play.')
  } catch {
    if (!disposed && token === generation) { loading.value = false; sceneError.value = 'The scene could not load. Retry to prepare the playground.' }
  }
}
function changeProfile(side) {
  if (side === 'source') sourceSize.value = 1
  else targetSize.value = 1
  void refresh()
}
function selectMove(id) {
  if (id === move.value) return
  stop(); move.value = id; phase.value = selected.value.phases?.includes('prepare') ? 'prepare' : 'attack'
  audio.warmMoves([id])
}
function changePhase(value) { if (phase.value !== value) { stop(); phase.value = value } }
function play() {
  if (!sceneReady.value || loading.value) return
  cryGeneration++; cryMessage.value = ''
  seed.value = Math.max(0, Math.min(999999, Math.trunc(Number(seed.value) || 0)))
  void player.play({ moveId: move.value, phase: phased.value ? phase.value : 'attack',
    sourceId: activeActorId.value, targetIds: [activeActorId.value === 'source' ? 'target' : 'source'],
    visualSeed: seed.value, effectiveness: effectiveness.value || null,
  }, { reducedMotion: reducedMotion.value, loop: repeat.value, loopDelayMs: Number(repeatGap.value) })
}
function newVariation() { stop(); seed.value = Math.floor(Math.random() * 1_000_000) }
function resetScene() {
  source.value = 'charizard'; target.value = 'venusaur'; sourceSize.value = 1; targetSize.value = 1
  layout.value = 'wide'; reversed.value = false; activeActorId.value = 'source'; seed.value = 42
  void refresh()
}
async function playCry(profile, name) {
  stop()
  const token = ++cryGeneration
  cryMessage.value = `Preparing ${name}’s cry…`
  const played = await audio.previewCry(profile)
  if (!disposed && token === cryGeneration) cryMessage.value = played ? `${name}’s cry` : 'This cry is unavailable.'
}
function keydown(event) {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    || event.target?.closest?.('input, select, textarea, button, summary, a, [contenteditable="true"]')) return
  if (event.code === 'Space') { event.preventDefault(); if (busy.value) stop(); else play() }
}
const syncMotion = () => { reducedMotion.value = motionPreference.matches }
watch([reducedMotion, activeActorId, repeat, repeatGap, effectiveness], stop)
onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  syncMotion(); motionPreference.addEventListener('change', syncMotion)
  document.addEventListener('keydown', keydown)
  audio.warmMoves([move.value]); void refresh()
})
onBeforeUnmount(() => {
  disposed = true; generation++; cryGeneration++
  document.removeEventListener('keydown', keydown); motionPreference?.removeEventListener('change', syncMotion)
  player.dispose(); unsubscribeAudio(); audio.dispose(); scene?.dispose()
})
</script>

<template>
  <main class="fx-shell">
    <header class="fx-header">
      <a class="fx-brand" href="/"><span class="ball-mark" aria-hidden="true"></span>Battle Lab<span class="fx-brand-section">/ Playground</span></a>
      <nav aria-label="Main navigation"><a href="/">Home</a><a href="/simulation">Simulation</a><a href="/preview">Move preview</a><a href="/playground" aria-current="page">FX playground</a></nav>
    </header>
    <div class="fx-page-heading">
      <div><p class="fx-eyebrow">THE EFFECTS STUDIO</p><h1>Every move. Every detail<span>.</span></h1><p>Explore the motion, hear the impact, and make it your own.</p></div>
      <span class="fx-catalog-count"><strong>{{ moves.length }}</strong> move effects</span>
    </div>

    <div class="fx-workspace">
      <aside class="fx-library" aria-labelledby="fx-library-title">
        <div class="fx-library-heading"><h2 id="fx-library-title">Move library</h2><span>{{ filteredMoves.length }} / {{ moves.length }}</span></div>
        <label class="fx-search"><span class="fx-sr-only">Search moves</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input v-model="search" type="search" placeholder="Search name or move number" autocomplete="off" aria-controls="fx-moves"></label>
        <div class="fx-filter-row" role="group" aria-label="Filter moves"><button :aria-pressed="filter === 'all'" @click="filter = 'all'">All</button><button :aria-pressed="filter === 'sound'" @click="filter = 'sound'">With sound</button><button :aria-pressed="filter === 'phased'" @click="filter = 'phased'">Two-step</button></div>
        <div id="fx-moves" class="fx-move-list" aria-label="Moves">
          <button v-for="item in filteredMoves" :key="item.id" class="fx-move-option" :class="{ selected: move === item.id }" :aria-pressed="move === item.id" @click="selectMove(item.id)">
            <span class="fx-move-dot" :style="{ background: item.color }" aria-hidden="true"></span><span class="fx-move-name">{{ item.name }}<small>{{ item.phases?.includes('prepare') ? 'Two-step effect' : item.sound.available ? 'Sound available' : 'Visual effect' }}</small></span><span class="fx-move-number">{{ item.number }}</span>
          </button>
          <div v-if="!filteredMoves.length" class="fx-empty"><strong>No matching moves</strong><p>Try a different name or number.</p><button @click="search = ''; filter = 'all'">Clear search</button></div>
        </div>
        <p class="fx-library-note">All moves, either side. Your selected move stays ready while you search.</p>
      </aside>

      <div class="fx-main">
        <section class="fx-preview" aria-labelledby="fx-selected-title" :style="{ '--move-color': selected.color }">
          <div class="fx-preview-heading"><div><p class="fx-eyebrow">MOVE {{ selected.number }} <span> / {{ phased && phase === 'prepare' ? 'PREPARATION' : 'EFFECT PREVIEW' }}</span></p><h2 id="fx-selected-title">{{ selected.name }}</h2><p>{{ selected.description }}</p></div><span class="fx-status" :class="{ active: busy }"><i></i>{{ status }}</span></div>
          <div class="fx-playback-bar"><button class="fx-primary" :disabled="!sceneReady || loading" @click="play"><span aria-hidden="true">▶</span>{{ busy ? 'Replay effect' : 'Play effect' }}</button><button class="fx-secondary" :disabled="!sceneReady && !cryMessage" @click="stop">Stop</button><label class="fx-check"><input v-model="repeat" type="checkbox">Loop</label><label v-if="repeat" class="fx-gap"><span class="fx-sr-only">Loop gap</span><select v-model.number="repeatGap" aria-label="Loop gap"><option :value="500">0.5s gap</option><option :value="1000">1s gap</option><option :value="2000">2s gap</option></select></label><span class="fx-key-hint"><kbd>space</kbd> play / stop</span></div>
          <div class="fx-stage-frame"><div ref="host" class="fx-stage" :class="`fx-stage-${layout}`" :style="stageStyle" role="img" :aria-label="`${sourceName} and ${targetName}: ${selected.name} effect preview`"></div><div v-if="loading || sceneError" class="fx-scene-message" role="status"><p>{{ message }}</p><button v-if="sceneError" class="fx-secondary" @click="refresh">Retry scene</button></div><div class="fx-stage-caption" :class="{ 'is-reversed': reversed }" aria-hidden="true"><span>{{ sourceName }} <b v-if="activeActorId === 'source'">MOVE USER</b></span><span>{{ targetName }} <b v-if="activeActorId === 'target'">MOVE USER</b></span></div></div>
          <div class="fx-feedback"><p role="status" aria-live="polite">{{ message }}</p><span class="fx-cue" :class="{ reached: playbackState.cue }">{{ cueLabel }}</span><span v-if="repeat && playbackState.iteration > 0" class="fx-loop-count">Run {{ playbackState.iteration }}</span></div>
        </section>

        <div class="fx-settings-grid">
          <section class="fx-control-card" aria-labelledby="fx-playback-title">
            <div class="fx-card-heading"><span class="fx-card-index">01</span><h2 id="fx-playback-title">Playback</h2></div>
            <label class="fx-field">Move user<select v-model="activeActorId"><option value="source">Your Pokémon · {{ sourceName }}</option><option value="target">Opponent · {{ targetName }}</option></select></label>
            <div v-if="phased" class="fx-phase" role="group" aria-label="Move round"><button :aria-pressed="phase === 'prepare'" @click="changePhase('prepare')">01 · Prepare</button><button :aria-pressed="phase === 'attack'" @click="changePhase('attack')">02 · Attack</button></div>
            <label class="fx-check fx-motion"><input v-model="reducedMotion" type="checkbox">Reduced motion<span>Short, softer effects</span></label>
            <div class="fx-variation"><label class="fx-field">Visual seed<input v-model.number="seed" type="number" min="0" max="999999" step="1" @change="stop"></label><button class="fx-secondary" @click="newVariation">New variation</button></div>
            <p class="fx-help">Keep the same seed to compare repeats. Change it for a fresh particle pattern.</p>
          </section>

          <section class="fx-control-card" aria-labelledby="fx-sound-title">
            <div class="fx-card-heading"><span class="fx-card-index">02</span><h2 id="fx-sound-title">Sound</h2><label class="fx-check fx-sound-toggle"><input type="checkbox" aria-label="Sound" :checked="audioState.enabled" @change="audio.setEnabled($event.target.checked)">{{ audioState.enabled ? 'On' : 'Off' }}</label></div>
            <div class="fx-sound-summary"><span class="fx-sound-indicator" :class="{ available: selected.sound.available }"></span>{{ soundLabel }}</div>
            <label class="fx-volume">Volume <output>{{ Math.round(audioState.volume * 100) }}%</output><input type="range" aria-label="Sound volume" min="0" max="100" step="5" :value="Math.round(audioState.volume * 100)" :disabled="!audioState.enabled" @input="audio.setVolume(Number($event.target.value) / 100)"></label>
            <div class="fx-sound-options"><label class="fx-check"><input type="checkbox" :checked="audioState.sfxEnabled" :disabled="!audioState.enabled" @change="audio.setSfxEnabled($event.target.checked)">Move sounds</label><label class="fx-field">Impact feedback<select v-model="effectiveness" :disabled="!audioState.enabled || !audioState.sfxEnabled"><option value="">None</option><option value="super-effective">Super effective</option><option value="resisted">Not very effective</option></select></label></div>
            <p class="fx-help" role="status">{{ audioNote }}</p>
          </section>
        </div>

        <details class="fx-actors" open>
          <summary><span class="fx-card-index">03</span><span>Pokémon &amp; stage<small>Change the cast. Test the framing.</small></span><span class="fx-disclosure" aria-hidden="true">⌄</span></summary>
          <div class="fx-actor-grid">
            <div class="fx-actor"><RosterPicker v-model="source" label="Your Pokémon" include-shapes @change="changeProfile('source')"/><label class="fx-scale">Sprite scale <output>{{ Number(sourceSize).toFixed(1) }}×</output><input v-model.number="sourceSize" type="range" aria-label="Your Pokémon scale" min="0.8" max="1.2" step="0.1" @change="refresh"></label><button class="fx-secondary fx-cry" :disabled="!audioState.enabled || !ROSTER[source]" @click="playCry(source, sourceName)">Listen to {{ sourceName }}’s cry</button></div>
            <div class="fx-actor"><RosterPicker v-model="target" label="Opponent Pokémon" include-shapes @change="changeProfile('target')"/><label class="fx-scale">Sprite scale <output>{{ Number(targetSize).toFixed(1) }}×</output><input v-model.number="targetSize" type="range" aria-label="Opponent Pokémon scale" min="0.8" max="1.2" step="0.1" @change="refresh"></label><button class="fx-secondary fx-cry" :disabled="!audioState.enabled || !ROSTER[target]" @click="playCry(target, targetName)">Listen to {{ targetName }}’s cry</button></div>
          </div>
          <div class="fx-stage-controls"><label class="fx-field">Battlefield<select v-model="layout" @change="refresh"><option value="wide">Wide · 1000 × 450</option><option value="square">Square · 720 × 600</option><option value="portrait">Portrait · 560 × 700</option></select></label><label class="fx-check"><input v-model="reversed" type="checkbox" @change="refresh">Mirror layout</label><button class="fx-secondary" @click="resetScene">Reset stage</button></div>
          <p v-if="cryMessage" class="fx-cry-feedback" role="status">{{ cryMessage }}</p>
        </details>
        <p class="fx-footer-note">A space for motion and sound. Previews do not change battle results.</p>
      </div>
    </div>
  </main>
</template>
