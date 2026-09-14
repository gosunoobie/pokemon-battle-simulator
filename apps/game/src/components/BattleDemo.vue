<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { createBattleState } from '@battle/battle-core'
import { MOVES } from '../moveCatalog.js'
import { createPresenter } from '../presentation/presenter.js'
import { createPreviewState, createPreviewTransaction } from '../previewState.js'

import PokemonInfo from './PokemonInfo.vue'
import RosterPicker from './RosterPicker.vue'
import { ROSTER } from '../roster/index.js'
import { previewSceneActors, previewBattleActors } from '../scene/previewActors.js'

const activeActorId = ref('source'), nearProfile = ref('charizard'), farProfile = ref('venusaur')
const selectedActor = computed(() => displayed.value.actors[activeActorId.value])
const previewActors = () => previewBattleActors(nearProfile.value, farProfile.value)
const fixtureOptions = () => ({ sourceId: activeActorId.value, actors: previewActors() })
const stage = ref(null), busy = ref(false), error = ref(''), hasPlayed = ref(false)
const sceneReady = ref(false), effectsEnabled = ref(true), reducedMotion = ref(false)
const selectedId = ref('flamethrower'), phase = ref('attack')
const selectedMove = computed(() => MOVES.find(move => move.id === selectedId.value))
const preparing = computed(() => Boolean(selectedMove.value.preparation) && phase.value === 'prepare')
const committed = shallowRef(createBattleState()), displayed = shallowRef(committed.value)
const weatherLabels = { rain: 'Rain', sun: 'Harsh sunlight', sandstorm: 'Sandstorm', hail: 'Hail' }
const fieldSummary = computed(() => [weatherLabels[displayed.value.weather], displayed.value.mudSport && 'Mud Sport', displayed.value.waterSport && 'Water Sport'].filter(Boolean).join(' · '))
const conditionLabels = { paralysis: 'PARALYZED', poison: 'POISONED', sleep: 'ASLEEP', 'bad-poison': 'BADLY POISONED', burn: 'BURNED' }
const statPreview = computed(() => [
  ['attackChange', 'Attack'], ['defenseChange', 'Defense'], ['specialAttackChange', 'Special Attack'],
  ['specialDefenseChange', 'Special Defense'], ['speedChange', 'Speed'], ['evasionChange', 'Evasion'],
].filter(([key]) => selectedMove.value[key]).map(([key, label]) => `${label} ${selectedMove.value[key] > 0 ? '+' : '−'}${Math.abs(selectedMove.value[key])}`).join(' and '))
const previewResult = computed(() => preparing.value ? 'preparation only, no HP damage'
  : selectedMove.value.previewCaption ? selectedMove.value.previewCaption
  : selectedMove.value.ghostCurse ? 'Ghost-style Curse · spends half maximum HP; no immediate target damage'
  : selectedMove.value.requiresTargetSleep && selectedMove.value.drain ? `${selectedMove.value.damage} demo damage to the sleeping sample target · restores half the damage dealt`
  : selectedMove.value.ohko ? 'successful one-hit knockout · removes all remaining target HP'
  : selectedMove.value.substitute ? 'spends ¼ of maximum HP to create a substitute'
  : selectedMove.value.recycle ? 'recovers the sample consumed Oran Berry'
  : selectedMove.value.copyStages ? 'copies the sample target’s stat stages and focus'
  : selectedMove.value.spikes ? 'adds one layer of Spikes; no immediate HP damage'
  : selectedMove.value.sportPreview ? `${selectedMove.value.name} field preview, no HP damage`
  : selectedMove.value.previewOnly ? 'casting preview, no HP damage'
  : selectedMove.value.selfDestruct && statPreview.value ? `${statPreview.value} · user faints; target HP unchanged`
  : selectedMove.value.sourceDefenseChange ? `${selectedMove.value.damage} demo damage · user Defense ${selectedMove.value.sourceDefenseChange > 0 ? '+' : '−'}${Math.abs(selectedMove.value.sourceDefenseChange)}`
  : selectedMove.value.knockOff ? '69 demo damage · removes the sample target’s held item'
  : selectedMove.value.statusDamageBoost ? `${selectedMove.value.damage * 2} demo damage · sample user is burned`
  : selectedMove.value.paralysisDamageBoost ? `${selectedMove.value.damage * 2} demo damage · cures the sample target’s paralysis`
  : selectedMove.value.healFraction ? 'restores half the user’s maximum HP'
  : selectedMove.value.weatherHeal ? 'restores HP; the amount depends on weather'
  : selectedMove.value.bellyDrum ? 'spends half maximum HP to maximize Attack'
  : selectedMove.value.swapItems ? 'exchanges the sample held items'
  : selectedMove.value.supportPreview === 'destinyBond' ? 'Destiny Bond badge on the user; no immediate damage'
  : selectedMove.value.supportPreview === 'nightmare' ? 'Nightmare badge on the sleeping sample target; no immediate damage'
  : selectedMove.value.supportPreview === 'grudge' ? 'Grudge badge on the user; no immediate damage'
  : selectedMove.value.supportPreview === 'seeded' ? 'seeds the target; no immediate damage or healing'
  : selectedMove.value.supportPreview === 'ingrained' ? 'roots the user; no immediate healing'
  : selectedMove.value.supportPreview ? selectedMove.value.id === 'wish' ? 'wish cast; later healing is not simulated' : `${selectedMove.value.name} preview, no HP damage`
  : selectedMove.value.perishSong ? 'marks all active Pokémon; no countdown or HP damage'
  : selectedMove.value.weather ? `${weatherLabels[selectedMove.value.weather].toLowerCase()}, no immediate HP damage`
  : selectedMove.value.rest ? 'full HP recovery and sleep'
  : selectedMove.value.cure ? 'cures the user’s status, no HP damage'
  : selectedMove.value.focusEnergy ? 'critical-hit ratio +2, no HP damage'
  : selectedMove.value.restrictionPreview ? `${selectedMove.value.name} badge, no HP damage`
  : statPreview.value ? selectedMove.value.damage > 0 ? `${selectedMove.value.damage} demo damage · ${statPreview.value}` : `${statPreview.value}${selectedMove.value.confuses ? ' and confusion' : ''}, no HP damage`
  : selectedMove.value.target === 'self'
  ? `${selectedMove.value.defenseChange ? 'Defense +2' : 'protection preview'}, no HP damage`
  : selectedMove.value.trapPreview ? 'trapping preview, no HP damage'
  : selectedMove.value.switchPreview ? 'switching preview, no HP damage'
  : selectedMove.value.condition
  ? `${conditionLabels[selectedMove.value.condition].toLowerCase()}, no immediate HP damage`
  : selectedMove.value.accuracyChange ? 'accuracy −1, no HP damage'
  : selectedMove.value.levelDamage ? `${selectedActor.value.level} level-based damage`
  : selectedMove.value.retaliates ? `sample: ${selectedMove.value.retaliates === 'physical' ? '32 physical damage received → 64 returned' : '36 special damage received → 72 returned'}`
  : selectedMove.value.splitsHp ? 'averages both current HP values, capped at each maximum'
  : selectedMove.value.endeavor ? 'lowers the target to the user’s current HP'
  : selectedMove.value.drain ? `${selectedMove.value.damage} demo damage · restores half the damage dealt`
  : selectedMove.value.selfDestruct ? `${selectedMove.value.damage} demo damage · user faints`
  : selectedMove.value.recoilDamage ? `${selectedMove.value.damage} demo damage · recoil: ${Math.round(selectedMove.value.recoilDamage * 100)}% of damage dealt`
  : selectedMove.value.recoilMaxHp ? `${selectedMove.value.damage} demo damage · recoil: ¼ of maximum HP`
  : selectedMove.value.confuses ? selectedMove.value.damage > 0 ? `${selectedMove.value.damage} demo damage · confusion preview` : 'confusion preview, no HP damage'
  : `${selectedMove.value.damage} demo damage`)
const status = ref('Charizard is ready. Choose a move.'), animateHealth = ref(false)
let scene, disposed = false, media, sceneGeneration = 0, playGeneration = 0
const presenter = createPresenter({
  loadFx: async () => (await import('@battle/battle-fx')).createBattleFx(),
  getScene: () => scene,
  onDisplay: value => { displayed.value = value.state; status.value = value.message; animateHealth.value = value.animate },
  onBusy: value => { busy.value = value },
  onError: error => console.warn('Effect skipped:', error),
})
const changeMotion = () => { reducedMotion.value = media.matches }
async function refreshScene() {
  const token = ++sceneGeneration
  playGeneration++; presenter.reset(); scene?.dispose(); scene = null; sceneReady.value = false; error.value = ''
  reset()
  try {
    const { createScene } = await import('../scene/index.js')
    if (disposed || token !== sceneGeneration) return
    const next = await createScene(stage.value, { actors: previewSceneActors(nearProfile.value, farProfile.value) })
    if (disposed || token !== sceneGeneration) { next.dispose(); return }
    scene = next; sceneReady.value = true
  } catch {
    if (!disposed && token === sceneGeneration) error.value = 'Battlefield unavailable. Moves still work with effects off.'
  }
}
onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)'); changeMotion(); media.addEventListener('change', changeMotion)
  void refreshScene()
})

async function attack() {
  if (busy.value) return
  // Replay intentionally starts a new preview; presentation never applies this result again.
  const token = ++playGeneration
  const transaction = createPreviewTransaction(selectedMove.value, { ...fixtureOptions(), targetId: activeActorId.value === 'source' ? 'target' : 'source', phase: phase.value })
  committed.value = transaction.after
  await presenter.enqueue(transaction, { effectsEnabled: effectsEnabled.value, reducedMotion: reducedMotion.value, visualSeed: 42 })
  if (!disposed && token === playGeneration) hasPlayed.value = true
}
function reset() {
  playGeneration++
  committed.value = createPreviewState(selectedMove.value, fixtureOptions()); presenter.reset(committed.value, `${committed.value.actors[activeActorId.value].name} is ready. Choose a move.`); hasPlayed.value = false
}
function selectMove(id) {
  if (busy.value || id === selectedId.value) return
  selectedId.value = id; phase.value = selectedMove.value.preparation ? 'prepare' : 'attack'; reset()
}
function selectPhase(value) { if (busy.value || phase.value === value) return; phase.value = value; reset() }
function selectAttacker(id) {
  if (id === activeActorId.value) return
  activeActorId.value = id; reset()
}
function toggleEffects() { if (!effectsEnabled.value) presenter.skip(); else presenter.retryEffects() }
onBeforeUnmount(() => { disposed = true; sceneGeneration++; playGeneration++; presenter.destroy(); scene?.dispose(); media?.removeEventListener('change', changeMotion) })
</script>

<template>
  <main class="app-shell">
    <header class="page-header preview-page-header">
      <div class="brand"><span class="ball-mark" aria-hidden="true"></span> Battle Demo</div>
      <nav class="preview-project-nav" aria-label="Main navigation"><a href="/">Home</a><a href="/simulation.html">Simulation</a><a href="/preview.html" aria-current="page">Move preview</a><a href="/playground.html">FX playground</a></nav>
    </header>

    <section class="battle-panel" aria-labelledby="battle-title">
      <div class="battle-heading">
        <div><p class="eyebrow">ANIMATION PREVIEW</p><h1 id="battle-title">Choose a side. Preview a move.</h1></div>
        <span class="battle-format">01 <span>/</span> SINGLE MOVE</span>
      </div>

      <div class="battlefield">
        <div class="field-lines" aria-hidden="true"></div>
        <div ref="stage" class="canvas-mount" role="img" :aria-label="`${displayed.actors.source.name} on your side faces ${displayed.actors.target.name} on the opponent side. ${selectedActor.name} is selected to use the move.`"></div>

        <PokemonInfo class="attacker-info" :actor="displayed.actors.source" :types="ROSTER[nearProfile].types" :active="activeActorId === 'source'" :animate="animateHealth" :reduced-motion="reducedMotion" />
        <PokemonInfo class="defender-info" :actor="displayed.actors.target" :types="ROSTER[farProfile].types" :active="activeActorId === 'target'" :animate="animateHealth" :reduced-motion="reducedMotion" />

        <div v-if="!sceneReady" class="load-message" role="status">{{ error || 'Preparing the battlefield…' }}</div>
        <div v-if="fieldSummary" class="weather-badge">{{ fieldSummary }}</div>
        <div class="field-caption"><span class="small-ball" aria-hidden="true">✦</span> {{ displayed.actors.source.name.toUpperCase() }} <span class="versus">VS</span> {{ displayed.actors.target.name.toUpperCase() }}</div>
      </div>

      <div class="battle-message" role="status" aria-live="polite"><span class="message-caret" aria-hidden="true">›</span>{{ status }}</div>

      <div class="preview-controls">
        <div class="attacker-switch" role="group" aria-label="Pokémon using the move">
          <button :aria-pressed="activeActorId === 'source'" :class="{ selected: activeActorId === 'source' }" @click="selectAttacker('source')">Your side</button>
          <button :aria-pressed="activeActorId === 'target'" :class="{ selected: activeActorId === 'target' }" @click="selectAttacker('target')">Opponent side</button>
        </div>
        <RosterPicker v-model="nearProfile" label="Your Pokémon" @change="refreshScene" />
        <RosterPicker v-model="farProfile" label="Opponent Pokémon" @change="refreshScene" />
      </div>

      <div class="move-panel" :style="{ '--move-accent': selectedMove.color }">
        <div class="move-details">
          <div class="move-topline"><span class="move-number">MOVE {{ selectedMove.number }}</span><span class="move-type">{{ selectedMove.type.toUpperCase() }}</span></div>
          <h2>{{ selectedMove.name }}</h2>
          <p>{{ preparing ? selectedMove.preparation.description : selectedMove.description }}</p>
          <div class="move-stats"><span>{{ selectedMove.powerLabel || 'POWER' }} <strong>{{ selectedMove.power ?? '—' }}</strong></span><span>ACCURACY <strong>{{ selectedMove.accuracyText || (selectedMove.accuracy == null ? '—' : `${selectedMove.accuracy}%`) }}</strong></span></div>
          <p class="demo-note">Animation preview · {{ preparing ? 'Round 1' : selectedMove.preparation ? 'Round 2 · guaranteed hit' : selectedMove.target === 'field' ? 'affects the battlefield' : selectedMove.target === 'self' ? 'affects the user’s side' : 'guaranteed hit' }} · {{ previewResult }}</p>
          <p v-if="selectedMove.mechanicNote" class="demo-note">{{ selectedMove.mechanicNote }}</p>
          <p class="demo-note">All-moves showcase · learnsets are not filtered.</p>
        </div>
        <div class="move-actions">
          <p class="active-user">{{ selectedActor.name }} · {{ activeActorId === 'source' ? 'Your side' : 'Opponent side' }}</p>
          <div v-if="selectedMove.preparation" class="phase-switch" role="group" aria-label="Move round">
            <button :aria-pressed="phase === 'prepare'" :disabled="busy" @click="selectPhase('prepare')">Round 1 · Prepare</button>
            <button :aria-pressed="phase === 'attack'" :disabled="busy" @click="selectPhase('attack')">Round 2 · Attack</button>
          </div>
          <label class="effects-toggle"><input v-model="effectsEnabled" type="checkbox" @change="toggleEffects"> Battle effects</label>
          <button class="attack-button" :disabled="busy || (!sceneReady && !error && effectsEnabled)" @click="attack">
            <span v-if="!busy" aria-hidden="true">▶</span>
            <span v-else class="button-spinner" aria-hidden="true"></span>
            {{ busy ? preparing ? 'Preparing…' : 'Attacking…' : preparing ? `${hasPlayed ? 'Replay' : 'Play'} preparation` : `${hasPlayed ? 'Replay' : 'Use'} ${selectedMove.name}` }}
          </button>
          <button v-if="busy" class="reset-button" @click="presenter.skip()">Skip animation</button>
          <button class="reset-button" :disabled="busy || !hasPlayed" @click="reset">↺ <span>Reset preview</span></button>
        </div>
      </div>

      <div class="move-selector" role="group" aria-label="Choose a move">
        <button v-for="move in MOVES" :key="move.id" type="button" class="move-choice"
          :class="{ selected: selectedId === move.id }" :style="{ '--move-accent': move.color }"
          :aria-pressed="selectedId === move.id" :disabled="busy" @click="selectMove(move.id)">
          <span class="choice-top"><span>{{ move.type }}</span><span aria-hidden="true">{{ selectedId === move.id ? '●' : '○' }}</span></span>
          <strong>{{ move.name }}</strong>
        </button>
      </div>
    </section>
    <footer class="page-footer"><span>Pokémon © Nintendo / Game Freak</span><span>Fan animation · Sprites from <a href="https://pokemondb.net/sprites" target="_blank" rel="noopener noreferrer">Pokémon Database ↗</a> / <a href="https://github.com/PokeAPI/sprites" target="_blank" rel="noopener noreferrer">PokéAPI ↗</a></span><span>Rock art: <a href="https://game-icons.net/1x1/lorc/rock.html" target="_blank" rel="noopener noreferrer">Lorc</a> · <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a></span></footer>
  </main>
</template>

<style scoped>
.preview-project-nav{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.preview-project-nav a{padding:10px 12px;border-radius:6px;color:#a7b3a6;font-size:12px;font-weight:500;text-decoration:none;white-space:nowrap}.preview-project-nav a:hover{color:#edf0e4;background:#ffffff05}.preview-project-nav a[aria-current]{background:#27342c;color:#e0eacb}
@media(max-width:700px){.preview-page-header{height:auto;min-height:112px;justify-content:center;flex-wrap:wrap;gap:12px;padding:20px 0 17px}.preview-project-nav{width:100%;justify-content:center;gap:0}.preview-project-nav a{padding:9px 8px;font-size:11px}}
</style>
