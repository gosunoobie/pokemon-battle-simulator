<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import HealthCard from './HealthCard.vue'
import { createCommandId, simulationRequest } from './api.js'
import { activeMembers, createSimulationScene, spriteUrl } from './scene.js'
import { buildBattleLog, createSimulationPresenter } from './presentation.js'

const config = shallowRef(null), latest = shallowRef(null), displayed = shallowRef(null)
const presetId = ref('kanto'), leadIndex = ref(0), busy = ref(true), playing = ref(false)
const error = ref(''), effectsEnabled = ref(true), reducedMotion = ref(false)
const sceneAvailable = ref(null), stage = ref(null), arena = ref(null), logHost = ref(null)
const message = ref('Choose a team and a lead Pokémon to begin.'), log = ref([])
const confirmingForfeit = ref(false), pendingChoice = shallowRef(null)
let generation = 0, controller = null, disposed = false

const scene = createSimulationScene({ getHost: () => stage.value, onAvailability: value => { sceneAvailable.value = value } })
const presenter = createSimulationPresenter({
  getScene: scene.get, ensureScene: view => scene.ensure(view),
  onDisplay: view => { displayed.value = view; scene.display(view) },
  onMessage: text => { if (text) message.value = text },
  loadFx: async () => (await import('@battle/battle-fx')).createBattleFx(),
})

const selectedPreset = computed(() => config.value?.presets.find(preset => preset.id === presetId.value) ?? config.value?.presets[0])
const lead = computed(() => selectedPreset.value?.team[leadIndex.value])
const members = computed(() => activeMembers(displayed.value))
const decision = computed(() => latest.value?.decision)
const locked = computed(() => busy.value || playing.value || Boolean(pendingChoice.value) || !latest.value?.complete || Boolean(latest.value?.result))
const switchIds = computed(() => new Set(decision.value?.switches?.map(member => member.memberId) ?? []))
const remaining = computed(() => displayed.value?.own.team.filter(member => !member.fainted).length ?? 0)
const resultTitle = computed(() => {
  const result = latest.value?.result
  if (result?.kind === 'win') return result.winnerSeat === 'p1' ? 'You won the battle.' : 'Your opponent won.'
  return result?.kind === 'draw' ? 'The battle is a draw.' : 'Battle ended.'
})
const weather = computed(() => ({ RainDance: 'Rain', SunnyDay: 'Harsh sunlight', Sandstorm: 'Sandstorm', Hail: 'Hail' }[displayed.value?.weather] ?? displayed.value?.weather))
const sideConditions = computed(() => Object.entries(displayed.value?.sideConditions ?? {}).flatMap(([seat, values]) => values.map(value => `${seat === 'p1' ? 'Your side' : 'Opponent'}: ${value.replace(/^move: /, '')}`)))
const decisionPrompt = computed(() => {
  if (playing.value) return 'Playing the turn…'
  if (busy.value) return 'Waiting for the battle server…'
  if (pendingChoice.value) return 'Sync or retry to confirm your last action.'
  if (decision.value?.kind === 'switch') return 'Choose a Pokémon to send out.'
  if (decision.value?.kind === 'wait') return 'Waiting for the next decision.'
  return `What will ${members.value[0]?.species || 'your Pokémon'} do?`
})
const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const moveInfo = move => config.value?.moves[normalize(move.id ?? move)] ?? {}
const pretty = value => String(value ?? '').replace(/([a-z])([A-Z])/g, '$1 $2')
const readyText = () => decision.value?.kind === 'switch' ? 'Your Pokémon needs a replacement. Choose a teammate below.' : 'Choose your next move, or switch to a teammate.'
function showBattle() {
  const bounds = stage.value?.getBoundingClientRect()
  if (bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight)) arena.value?.scrollIntoView({ behavior: reducedMotion.value ? 'instant' : 'smooth', block: 'start' })
}

function beginRequest() {
  controller?.abort()
  controller = new AbortController()
  busy.value = true; error.value = ''
  return { token: ++generation, signal: controller.signal }
}
function isCurrent(token) { return !disposed && token === generation }
function addLog(events, before, after) {
  const additions = buildBattleLog(events ?? [], before, after)
  const seen = new Set(log.value.map(entry => entry.cursor))
  log.value = [...log.value, ...additions.filter(entry => !seen.has(entry.cursor))].slice(-150)
  nextTick(() => { if (logHost.value) logHost.value.scrollTop = logHost.value.scrollHeight })
}
async function acceptResponse(response, token, animate = true) {
  if (!isCurrent(token)) return
  if (!response.view?.complete) throw new Error('The server could not provide a complete battle view. Sync before continuing.')
  const changedMatch = displayed.value?.matchId !== response.matchId
  const before = changedMatch ? null : displayed.value
  if (changedMatch) log.value = []
  latest.value = response.view
  pendingChoice.value = null
  busy.value = false
  confirmingForfeit.value = false
  if (!animate || !before || before.matchId !== response.matchId) {
    presenter.reset(response.view)
    displayed.value = response.view
    await nextTick()
    // Base rendering can load separately while all battle controls remain usable.
    void scene.ensure(response.view)
    message.value = response.view.result ? resultTitle.value : readyText()
  } else {
    playing.value = true
    if (effectsEnabled.value) showBattle()
    try {
      const presentation = await presenter.present({ before, after: response.view, events: response.events ?? [] }, { effectsEnabled: effectsEnabled.value, reducedMotion: reducedMotion.value })
      if (isCurrent(token) && presentation.status !== 'completed') message.value = readyText()
    } finally { if (isCurrent(token)) playing.value = false }
  }
  if (!isCurrent(token)) return
  addLog(response.events, before, response.view)
  if (response.ack?.accepted === false) error.value = `That choice was rejected (${response.ack.code}). The controls now show the latest legal options.`
  if (response.view.result) message.value = resultTitle.value
}
async function initialize() {
  const { token, signal } = beginRequest()
  try {
    const [settings, battle] = await Promise.all([
      simulationRequest('config', { signal }),
      simulationRequest('match', { signal }).catch(cause => { if (cause.code === 'NO_MATCH') return null; throw cause }),
    ])
    if (!isCurrent(token)) return
    config.value = settings
    if (battle) await acceptResponse(battle, token, false)
  } catch (cause) { if (isCurrent(token)) error.value = cause.message }
  finally { if (isCurrent(token)) busy.value = false }
}
async function startBattle() {
  if (busy.value || !selectedPreset.value) return
  const { token, signal } = beginRequest()
  try {
    const response = await simulationRequest('match', { method: 'POST', body: { presetId: selectedPreset.value.id, leadIndex: leadIndex.value, expectedMatchId: latest.value?.matchId ?? null }, signal })
    if (!isCurrent(token)) return
    log.value = []; presenter.reset(null); scene.clear()
    await acceptResponse(response, token, false)
    if (isCurrent(token)) showBattle()
  } catch (cause) { if (isCurrent(token)) error.value = cause.message }
  finally { if (isCurrent(token)) busy.value = false }
}
async function sendChoice(action, retry = false) {
  if (busy.value || playing.value || (!retry && locked.value)) return
  const command = retry ? pendingChoice.value : {
    commandId: createCommandId(), matchId: latest.value.matchId, decisionId: decision.value.id, action, afterCursor: latest.value.cursor,
  }
  if (!command) return
  pendingChoice.value = command
  const { token, signal } = beginRequest()
  try { await acceptResponse(await simulationRequest('choice', { method: 'POST', body: command, signal }), token) }
  catch (cause) { if (isCurrent(token)) error.value = cause.message }
  finally { if (isCurrent(token)) busy.value = false }
}
async function syncBattle() {
  if (busy.value) return
  presenter.skip()
  const { token, signal } = beginRequest()
  playing.value = false
  // Full snapshots recover even if another tab replaced the browser's match.
  try { await acceptResponse(await simulationRequest('match', { signal }), token, false) }
  catch (cause) {
    if (!isCurrent(token)) return
    error.value = cause.message
    if (cause.code === 'NO_MATCH' || cause.code === 'PROJECTION_UNAVAILABLE') {
      presenter.reset(null); scene.clear(); latest.value = null; displayed.value = null; pendingChoice.value = null; log.value = []
    }
  } finally { if (isCurrent(token)) busy.value = false }
}
async function forfeit() {
  if (locked.value) return
  const { token, signal } = beginRequest()
  try { await acceptResponse(await simulationRequest('forfeit', { method: 'POST', body: { matchId: latest.value.matchId, afterCursor: latest.value.cursor }, signal }), token, false) }
  catch (cause) { if (isCurrent(token)) error.value = cause.message }
  finally { if (isCurrent(token)) busy.value = false }
}
async function newBattle() {
  const { token, signal } = beginRequest()
  try {
    await simulationRequest('match', { method: 'DELETE', body: { matchId: latest.value.matchId }, signal })
    if (!isCurrent(token)) return
    presenter.reset(null); scene.clear(); latest.value = null; displayed.value = null; pendingChoice.value = null; log.value = []
    message.value = 'Choose a team and a lead Pokémon to begin.'
  } catch (cause) { if (isCurrent(token)) error.value = cause.message }
  finally { if (isCurrent(token)) busy.value = false }
}

onMounted(() => { reducedMotion.value = matchMedia('(prefers-reduced-motion: reduce)').matches; void initialize() })
onBeforeUnmount(() => { disposed = true; generation++; controller?.abort(); presenter.destroy(); scene.destroy() })
</script>

<template>
  <div class="sim-shell">
    <a class="sim-skip-link" href="#simulation">Skip to battle</a>
    <header class="sim-header">
      <a class="sim-brand" href="/"><span class="ball-mark" aria-hidden="true"></span>Battle Lab<span class="sim-brand-dot">.</span></a>
      <nav class="sim-nav" aria-label="Main navigation"><a href="/">Home</a><a href="/simulation.html" aria-current="page">Simulation</a><a href="/preview.html">Move preview</a><a href="/playground.html">FX playground</a></nav>
    </header>
    <main id="simulation">
      <div class="sim-heading">
        <div><p class="sim-eyebrow">MAKE YOUR NEXT MOVE</p><h1>Battle simulation<span>.</span></h1><p class="sim-intro">Authentic Generation 3. Six on six. Every turn is yours to choose.</p></div>
        <div class="sim-format"><span class="sim-dot"></span> GEN 3 OPEN SINGLES <small>Level 100 · Automated opponent</small></div>
      </div>

      <div v-if="error" class="sim-error" role="alert">
        <p>{{ error }}</p><div class="sim-error-actions">
          <button v-if="latest" :disabled="busy" @click="syncBattle">Sync battle</button>
          <button v-if="pendingChoice" :disabled="busy" @click="sendChoice(null, true)">Retry action</button>
          <button v-if="!latest" :disabled="busy" @click="initialize">Reconnect</button>
        </div>
      </div>
      <div v-if="!config && busy" class="sim-loading" role="status">Connecting to the battle server…</div>

      <section v-if="config && !latest" class="sim-setup" aria-labelledby="setup-title">
        <div class="sim-setup-heading"><div><p class="sim-eyebrow">01 / CHOOSE YOUR TEAM</p><h2 id="setup-title">Six teammates. One game plan.</h2></div><span class="sim-soft-badge">Validated Gen 3 presets</span></div>
        <div class="sim-presets">
          <button v-for="preset in config.presets" :key="preset.id" class="sim-preset" :class="{ selected: selectedPreset?.id === preset.id }" :aria-pressed="selectedPreset?.id === preset.id" :disabled="busy" @click="presetId = preset.id; leadIndex = 0">
            <div class="sim-preset-top"><span>{{ preset.id.toUpperCase() }}</span><span aria-hidden="true">{{ selectedPreset?.id === preset.id ? '●' : '○' }}</span></div>
            <h3>{{ preset.name }}</h3><p>{{ preset.description }}</p>
            <div class="sim-preset-sprites"><img v-for="member in preset.team" :key="member.species" :src="spriteUrl(member.species)" :alt="member.species" width="56" height="56" decoding="async"></div>
          </button>
        </div>
        <div class="sim-lead-heading"><p class="sim-eyebrow">02 / PICK YOUR LEAD</p><span>Your first Pokémon enters immediately. No team preview.</span></div>
        <div class="sim-lead-grid">
          <button v-for="(member, index) in selectedPreset?.team" :key="member.species" class="sim-lead" :class="{ selected: leadIndex === index }" :aria-pressed="leadIndex === index" :disabled="busy" @click="leadIndex = index">
            <span class="sim-lead-number">0{{ index + 1 }}</span><img :src="spriteUrl(member.species)" alt="" width="84" height="84"><strong>{{ member.species }}</strong><span>{{ leadIndex === index ? 'Selected lead' : 'Choose as lead' }}</span>
          </button>
        </div>
        <div v-if="lead" class="sim-team-summary">
          <div><h3>{{ lead.species }} <span>Lv. {{ lead.level }}</span></h3><p>{{ pretty(lead.ability) }} <span aria-hidden="true">·</span> {{ pretty(lead.item) }}</p><div class="sim-lead-moves"><span v-for="move in lead.moves" :key="move">{{ moveInfo(move).name || pretty(move) }}</span></div></div>
          <button class="sim-primary" :disabled="busy" @click="startBattle">{{ busy ? 'Starting battle…' : 'Start battle' }} <span aria-hidden="true">↗</span></button>
        </div>
        <p class="sim-setup-note">Play against a simple automated opponent. All 386 species are supported by the engine; this page starts with three ready-made teams.</p>
      </section>

      <div v-if="latest" class="sim-layout">
        <section ref="arena" class="sim-arena" aria-label="Battle and controls">
          <div class="sim-arena-bar"><span class="sim-round">TURN {{ displayed?.turn || 1 }}</span><span>{{ displayed?.result ? 'BATTLE COMPLETE' : `${remaining} OF 6 TEAMMATES REMAIN` }}</span><button :disabled="busy || playing" @click="syncBattle" title="Reload the current battle state">Sync battle ↻</button></div>
          <div class="sim-hud"><HealthCard :member="members[0]"/><div class="sim-versus" aria-hidden="true">VS</div><HealthCard :member="members[1]" opponent/></div>
          <div v-if="sideConditions.length" class="sim-side-conditions"><span v-for="condition in sideConditions" :key="condition">{{ condition }}</span></div>
          <div class="sim-field" :aria-label="`${members[0]?.species || 'Your Pokémon'} versus ${members[1]?.species || 'opponent'}`" role="img">
            <div class="sim-field-grid" aria-hidden="true"></div>
            <div ref="stage" class="sim-canvas"></div>
            <div v-if="sceneAvailable !== true" class="sim-fallback" aria-hidden="true"><img v-if="members[0] && !members[0].fainted" class="sim-near-sprite" :src="spriteUrl(members[0].species, 'back')" alt=""><img v-if="members[1] && !members[1].fainted" class="sim-far-sprite" :src="spriteUrl(members[1].species)" alt=""></div>
            <span v-if="weather" class="sim-weather">{{ weather }}</span>
            <span class="sim-field-label">GENERATION III <span>·</span> SINGLE BATTLE</span>
          </div>
          <div class="sim-message" role="status" aria-live="polite"><span aria-hidden="true">›</span><p>{{ message }}</p><button v-if="playing" @click="presenter.skip()">Skip animations</button></div>
          <p v-if="sceneAvailable === false" class="sim-render-note">Effects are unavailable on this device. Battle controls still work.</p>
          <div class="sim-playback"><label><input v-model="effectsEnabled" type="checkbox" @change="!effectsEnabled && presenter.skip()">Move effects</label><label><input v-model="reducedMotion" type="checkbox">Reduced motion</label><span>Visuals never change a battle result.</span></div>

          <section v-if="latest.result && !playing" class="sim-result" aria-labelledby="result-title"><p class="sim-eyebrow">BATTLE COMPLETE</p><h2 id="result-title">{{ resultTitle }}</h2><p>{{ latest.result.reason === 'forfeit' ? 'The battle ended by forfeit.' : `Finished on turn ${latest.turn}. Your battle log is available alongside the field.` }}</p><button class="sim-primary" :disabled="busy" @click="newBattle">Choose a new team <span aria-hidden="true">↗</span></button></section>
          <div v-else class="sim-decisions">
            <div class="sim-decision-heading"><h2>{{ decisionPrompt }}</h2><span v-if="!locked && decision?.kind === 'move'">Choose one action</span></div>
            <div v-if="decision?.kind !== 'switch'" class="sim-move-grid">
              <button v-for="move in decision?.moves" :key="move.slot" class="sim-move" :class="`sim-type-${moveInfo(move).type?.toLowerCase()}`" :disabled="locked || decision?.kind !== 'move' || move.disabled" :title="moveInfo(move).shortDesc || move.name" @click="sendChoice({ kind: 'move', slot: move.slot })">
                <div><span class="sim-move-type">{{ moveInfo(move).type || 'Move' }}</span><span>{{ move.pp === null ? '—' : move.pp }} / {{ move.maxpp === null ? '—' : move.maxpp }} PP</span></div><strong>{{ moveInfo(move).name || move.name }}</strong><small>{{ move.disabled ? 'Unavailable this turn' : moveInfo(move).category === 'Status' ? 'Status move' : `Power ${moveInfo(move).basePower || 'variable'}` }}</small>
              </button>
            </div>
            <div class="sim-party-heading"><h3>{{ decision?.kind === 'switch' ? 'Send out a teammate' : 'Or switch Pokémon' }}</h3><span v-if="!decision?.canSwitch && decision?.kind === 'move'">Switching unavailable this turn</span></div>
            <div class="sim-party">
              <button v-for="member in displayed?.own.team" :key="member.memberId" :class="{ active: member.active, fainted: member.fainted }" :disabled="locked || !switchIds.has(member.memberId)" :aria-label="`${member.species}, ${member.fainted ? 'fainted' : member.active ? 'active' : `${member.hp?.current} of ${member.hp?.max} HP`}${member.condition ? `, ${member.condition}` : ''}`" @click="sendChoice({ kind: 'switch', memberId: member.memberId })">
                <img :src="spriteUrl(member.species)" alt="" width="62" height="62"><strong>{{ member.species }}</strong><span>{{ member.fainted ? 'Fainted' : member.active ? 'On the field' : `${member.hp?.current ?? '—'} / ${member.hp?.max ?? '—'}` }}</span><small v-if="member.condition">{{ member.condition.toUpperCase() }}</small>
              </button>
            </div>
            <div class="sim-battle-actions"><span>Leaving this page keeps your battle available for 30 minutes.</span><template v-if="confirmingForfeit"><span>End this battle?</span><button :disabled="locked" @click="forfeit">Yes, forfeit</button><button @click="confirmingForfeit = false">Cancel</button></template><button v-else :disabled="locked" @click="confirmingForfeit = true">Forfeit battle</button></div>
          </div>
        </section>
        <aside class="sim-log-panel" aria-labelledby="log-title"><div class="sim-log-heading"><div><p class="sim-eyebrow">THE STORY SO FAR</p><h2 id="log-title">Battle log</h2></div><span class="sim-dot" aria-hidden="true"></span></div><ol ref="logHost" class="sim-log" aria-label="Battle history"><li v-for="entry in log" :key="entry.cursor" :class="{ 'sim-log-turn': /^Turn \d/.test(entry.text) }">{{ entry.text }}</li><li v-if="!log.length">Your battle begins here.</li></ol><div class="sim-log-note">Your HP is exact. Opponent HP uses the public battle bar. Only revealed opponent details appear here.</div></aside>
      </div>
    </main>
    <footer class="sim-footer"><span>Battle Lab · Generation 3</span><p>Preset battles · Same-browser reconnect · Optional effects</p><a href="/">Back to home ↗</a></footer>
  </div>
</template>
