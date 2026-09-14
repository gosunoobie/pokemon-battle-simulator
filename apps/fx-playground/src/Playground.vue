<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { createBattleFx, FX_CATALOG } from '@battle/battle-fx'
import { previewSpriteHeight } from '../../game/src/scene/previewActors.js'
import { createScene } from '../../game/src/scene/index.js'
import RosterPicker from '../../game/src/components/RosterPicker.vue'

const host = ref(null), move = ref('hydro-pump'), source = ref('charizard'), target = ref('venusaur')
const activeActorId = ref('source')
const phase = ref('attack'), phased = computed(() => FX_CATALOG.find(item => item.id === move.value)?.phases)
const sourceSize = ref(1), targetSize = ref(1), layout = ref('wide'), reversed = ref(false), reducedMotion = ref(false)
const busy = ref(false), loading = ref(true), message = ref('Preparing the playground…')
const dimensions = { wide: [1000, 450], square: [720, 600], portrait: [560, 700] }
let scene, playback, disposed = false, generation = 0
const fx = createBattleFx()
function changeProfile(side) {
  const size = side === 'source' ? sourceSize : targetSize
  size.value = 1
  refresh()
}
async function refresh() {
  const token = ++generation
  playback?.cancel(); scene?.dispose(); scene = null; busy.value = false; loading.value = true
  const [width, height] = dimensions[layout.value]
  const left = reversed.value ? .75 : .25, right = 1 - left
  try {
    const next = await createScene(host.value, { width, height, actors: [
      { id: 'source', profile: source.value, view: 'back', x: left, y: .82, height: previewSpriteHeight(source.value, { scale: Number(sourceSize.value), width, height }), facing: reversed.value ? -1 : 1 },
      { id: 'target', profile: target.value, view: 'front', x: right, y: .63, height: previewSpriteHeight(target.value, { scale: Number(targetSize.value), far: true, width, height }), facing: reversed.value ? 1 : -1 },
    ] })
    if (disposed || generation !== token) { next.dispose(); return }
    scene = next; loading.value = false; message.value = 'Ready. This page plays effects without a battle engine.'
  } catch { if (!disposed && generation === token) { loading.value = false; message.value = 'The preview could not load.' } }
}
async function play() {
  if (!scene || busy.value) return
  const token = generation; busy.value = true; message.value = `Playing ${FX_CATALOG.find(m => m.id === move.value).name}…`
  playback = fx.play({ moveId: move.value, phase: phased.value ? phase.value : 'attack', sourceId: activeActorId.value, targetIds: [activeActorId.value === 'source' ? 'target' : 'source'], visualSeed: 42 }, {
    scene, reducedMotion: reducedMotion.value,
    onCue: cue => { if (!disposed && generation === token) message.value = cue.type === 'prepared' ? 'Preparation complete. Round 2 can be previewed separately.' : 'Visual contact — no damage or battle state is being calculated.' },
  })
  const result = await playback.finished
  if (!disposed && token === generation) { busy.value = false; message.value = `Playback ${result.status}. Ready to replay.` }
}
onMounted(refresh)
onBeforeUnmount(() => { disposed = true; generation++; fx.dispose(); scene?.dispose() })
</script>

<template>
  <main class="app-shell">
    <header class="playground-heading"><h1>Battle FX playground</h1><a href="/">Back to battle ↗</a></header>
    <section class="battle-panel">
      <div ref="host" class="playground-stage" role="img" aria-label="Independent battle effect preview"></div>
      <p class="playground-status" role="status">{{ message }}</p>
      <div class="playground-actions">
        <div v-if="phased" class="phase-switch" role="group" aria-label="Move round">
          <button :aria-pressed="phase === 'prepare'" :disabled="busy" @click="phase = 'prepare'">Round 1 · Prepare</button>
          <button :aria-pressed="phase === 'attack'" :disabled="busy" @click="phase = 'attack'">Round 2 · Attack</button>
        </div>
        <label class="playground-attacker">Move user<select v-model="activeActorId" :disabled="busy"><option value="source">Your Pokémon</option><option value="target">Opponent Pokémon</option></select></label>
        <button class="playground-button" :disabled="loading || busy || !scene" @click="play">Play effect</button>
        <button class="reset-button" :disabled="!busy" @click="playback?.cancel()">Stop</button>
        <label class="effects-toggle"><input v-model="reducedMotion" type="checkbox"> Reduced motion</label>
      </div>
      <div class="playground-controls">
        <label>Move<select v-model="move" :disabled="busy" @change="phase = phased ? 'prepare' : 'attack'"><option v-for="item in FX_CATALOG" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
        <RosterPicker v-model="source" label="Your Pokémon" include-shapes @change="changeProfile('source')" />
        <RosterPicker v-model="target" label="Opponent Pokémon" include-shapes @change="changeProfile('target')" />
        <label>Your scale · {{ Number(sourceSize).toFixed(1) }}×<input v-model="sourceSize" type="range" min="0.8" max="1.2" step="0.1" @change="refresh"></label>
        <label>Opponent scale · {{ Number(targetSize).toFixed(1) }}×<input v-model="targetSize" type="range" min="0.8" max="1.2" step="0.1" @change="refresh"></label>
        <label>Battlefield<select v-model="layout" @change="refresh"><option value="wide">Wide</option><option value="square">Square</option><option value="portrait">Portrait</option></select></label>
        <label class="effects-toggle"><input v-model="reversed" type="checkbox" @change="refresh"> Mirror battlefield layout</label>
      </div>
      <p class="playground-help">Choose the move user without moving either Pokémon. Change artwork, size and facing to check attachment points. Resize the window during playback to check camera scaling. The nine calibrated starters keep their measured profiles. Other Pokémon and the tall/wide shapes use generic attachment points; these are not measured anatomy.</p>
    </section>
  </main>
</template>
