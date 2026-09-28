<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import BattleView from '../../shared/battle/BattleView.vue'
import { createSimulationAudio } from './audio.js'
import { createExperienceAudio } from '../../shared/music/audio.js'
import RandomTeamBuilder from '../../shared/teams/RandomTeamBuilder.vue'
import { createCommandId, simulationRequest } from './api.js'
import { activeMembers, spriteUrl, buildBattleLog, viewerResultTitle } from '../../shared/battle/index.js'
import { createTeamDraft, toTeamPayload, draftIssues, readTeamDraft, saveTeamDraft } from './teamDraft.js'
import { survivalStartCommand, survivalAdvanceCommand, readSurvivalStart, saveSurvivalStart, displayedSurvivors, survivalEndingText } from './survival.js'

const config = shallowRef(null), latest = shallowRef(null), displayed = shallowRef(null)
const battleAudio = createExperienceAudio({ createBattle: createSimulationAudio })
const run = shallowRef(null), regionId = ref('kanto'), pendingAdvance = shallowRef(null)
const survivalPage = /^\/survival(?:\/|\.html)?$/.test(globalThis.location?.pathname ?? '')
const pendingStart = shallowRef(null), nextLeadMemberId = ref('')
const survival = computed(() => latest.value ? run.value?.kind === 'survival' : survivalPage)
const preparationLocked = computed(() => busy.value || Boolean(pendingStart.value))
const runRoster = computed(() => displayedSurvivors(run.value, displayed.value, playing.value))
const canContinue = computed(() => ['between-battles', 'between-rounds', 'starting-next'].includes(run.value?.status))
const survivalInactivityMinutes = computed(() => Math.max(1, Math.floor((config.value?.survivalProfile?.inactivityMs ?? 30 * 60_000) / 60_000)))
const presetId = ref('kanto'), leadIndex = ref(0), busy = ref(true), playing = ref(false)
const teamMode = ref('preset'), customTeam = shallowRef(createTeamDraft()), teamCatalog = shallowRef(null)
const catalogLoading = ref(false), catalogError = ref(''), teamErrors = shallowRef([]), teamValidation = shallowRef(null)
const draftSaved = ref(false), generatingTeam = ref(false)
const error = ref(''), reducedMotion = ref(false)
const battleView = ref(null), arena = ref(null), logHost = ref(null), setupTitle = ref(null)
const setupMessage = () => survivalPage ? 'Choose six Pokémon and a lead to begin your Survival run.' : 'Choose a region, your team and a lead Pokémon to begin.'
const message = ref(setupMessage()), log = ref([])
const confirmingForfeit = ref(false), pendingChoice = shallowRef(null), pendingQuit = shallowRef(null)
let generation = 0, controller = null, catalogController = null, disposed = false

const selectedPreset = computed(() => config.value?.presets.find(preset => preset.id === presetId.value) ?? config.value?.presets[0])
const selectedTeam = computed(() => teamMode.value === 'custom' ? customTeam.value : selectedPreset.value?.team ?? [])
const selectedTeamLabel = computed(() => teamMode.value === 'custom' ? 'Custom team' : selectedPreset.value?.name ?? 'Your team')
const customIssues = computed(() => teamCatalog.value ? draftIssues(customTeam.value, teamCatalog.value) : [])
const customReady = computed(() => Boolean(teamCatalog.value) && !customIssues.value.length)
const selectedLeague = computed(() => config.value?.leagues?.find(league => league.id === regionId.value) ?? config.value?.leagues?.[0])
const lead = computed(() => selectedTeam.value[leadIndex.value])
const members = computed(() => activeMembers(displayed.value))
const decision = computed(() => latest.value?.decision)
const locked = computed(() => busy.value || playing.value || Boolean(pendingChoice.value) || Boolean(pendingQuit.value) || !latest.value?.complete || Boolean(latest.value?.result))
const switchIds = computed(() => new Set(decision.value?.switches?.map(member => member.memberId) ?? []))
const remaining = computed(() => displayed.value?.own.team.filter(member => !member.fainted).length ?? 0)
const resultTitle = computed(() => {
  if (survival.value) return canContinue.value ? `Round ${run.value.roundNumber} cleared.` : 'Your Survival run has ended.'
  if (run.value?.status === 'won') return `You are the ${run.value.regionName} Champion!`
  if (run.value?.status === 'between-battles') return `${run.value.opponent.name} defeated.`
  if (run.value?.status === 'lost') return 'Your league challenge has ended.'
  return viewerResultTitle(latest.value)
})
const resultEyebrow = computed(() => survival.value ? canContinue.value ? 'RECOVER. REGROUP. GO AGAIN.' : 'SURVIVAL RESULTS' : ({ won: 'REGIONAL CHAMPION', 'between-battles': 'ONE STEP CLOSER', lost: 'CHALLENGE ENDED' }[run.value?.status] ?? 'BATTLE COMPLETE'))
const resultDetail = computed(() => {
  const challenge = run.value
  if (challenge?.kind === 'survival') return canContinue.value
    ? 'Survivors recovered up to 25% of their maximum HP. Fainted Pokémon revived at 50% max HP. Status and stat changes cleared. PP and starting items restored.'
    : `${challenge.wins} ${challenge.wins === 1 ? 'round' : 'rounds'} beaten. ${survivalEndingText(challenge.endingReason)}`
  if (challenge?.status === 'between-battles') return `Next: ${challenge.nextOpponent?.title} ${challenge.nextOpponent?.name}. Your team starts the next battle at full HP and PP, with status cleared and held items restored.`
  if (challenge?.status === 'won') return `All ${challenge.totalStages} trainers defeated, including Champion ${challenge.opponent.name}. You completed the ${challenge.regionName} league at Level 100.`
  if (challenge?.status === 'lost') return `${challenge.wins} of ${challenge.totalStages} trainers defeated. ${latest.value?.result?.reason === 'forfeit' ? 'You forfeited this battle.' : 'Choose a region and team to try again from the first Elite Four member.'}`
  return latest.value?.result?.reason === 'forfeit' ? 'The battle ended by forfeit.' : `Finished on turn ${latest.value?.turn}. Your battle log is available alongside the field.`
})
function trainerState(index) {
  if (index < (run.value?.wins ?? 0)) return 'cleared'
  if (index !== run.value?.stageIndex) return 'upcoming'
  return run.value.status === 'lost' ? 'lost' : 'current'
}
const trainerStateLabel = index => ({ cleared: 'Defeated', current: 'In battle', lost: 'Challenge ended', upcoming: 'Up next' }[trainerState(index)])
const decisionPrompt = computed(() => {
  if (pendingQuit.value) return busy.value ? 'Quitting the battle…' : 'Retry quit or sync to confirm the battle was cleared.'
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
watch(teamMode, mode => { if (mode === 'custom') void loadTeamCatalog() })
watch(customTeam, () => {
  teamErrors.value = []; teamValidation.value = null
  if (!latest.value) error.value = ''
  try { draftSaved.value = saveTeamDraft(globalThis.localStorage, customTeam.value) }
  catch { draftSaved.value = false }
}, { flush: 'sync' })

async function loadTeamCatalog() {
  if (teamCatalog.value || catalogLoading.value) return
  catalogLoading.value = true; catalogError.value = ''
  const request = new AbortController()
  catalogController = request
  try {
    const catalog = await simulationRequest('team-builder', { signal: request.signal })
    if (!disposed && catalogController === request) teamCatalog.value = catalog
  } catch (cause) {
    if (!disposed && catalogController === request) catalogError.value = cause.message
  } finally { if (!disposed && catalogController === request) catalogLoading.value = false }
}
async function validateCustomTeam() {
  if (busy.value || generatingTeam.value || latest.value || !teamCatalog.value || teamMode.value !== 'custom') return
  teamValidation.value = null
  teamErrors.value = customIssues.value
  if (teamErrors.value.length) return
  const { token, signal } = beginRequest()
  try {
    const checked = await simulationRequest('team/validate', { method: 'POST', body: { team: toTeamPayload(customTeam.value) }, signal })
    if (!isCurrent(token)) return
    if (checked.valid) {
      customTeam.value = createTeamDraft(checked.team)
      teamValidation.value = { valid: true, changes: checked.changes.filter(change => change.kind !== 'added') }
    } else teamErrors.value = checked.errors
  } catch (cause) { if (isCurrent(token)) error.value = cause.message }
  finally { if (isCurrent(token)) busy.value = false }
}
function generateTeam(body, { signal } = {}) {
  return simulationRequest('team/random', { method: 'POST', body, signal })
}
function holdStart(command) {
  if (!command) return
  pendingStart.value = command
  leadIndex.value = command.leadIndex
  if (Array.isArray(command.team)) { customTeam.value = createTeamDraft(command.team); teamMode.value = 'custom' }
  else { presetId.value = command.presetId; teamMode.value = 'preset' }
  saveSurvivalStart(globalThis.sessionStorage, command)
}
function showBattle() {
  battleView.value?.showBattle()
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
  if (changedMatch) { log.value = []; message.value = 'The battle is about to begin.' }
  latest.value = response.view
  run.value = response.run ?? null
  if (run.value?.regionId) regionId.value = run.value.regionId
  const selection = response.teamSelection
  if (selection?.kind === 'custom') {
    teamMode.value = 'custom'
    if (changedMatch) { customTeam.value = createTeamDraft(selection.team); leadIndex.value = selection.leadIndex }
  } else if (selection?.kind === 'preset' || run.value?.presetId && run.value.presetId !== 'custom') {
    teamMode.value = 'preset'; presetId.value = selection?.presetId ?? run.value.presetId
    if (selection) leadIndex.value = selection.leadIndex
  }
  pendingChoice.value = null
  pendingAdvance.value = run.value?.kind === 'survival' && run.value.pending ? survivalAdvanceCommand(run.value, response.matchId) : null
  pendingStart.value = null
  saveSurvivalStart(globalThis.sessionStorage, null)
  if (run.value?.kind === 'survival') {
    if (run.value.pending) nextLeadMemberId.value = run.value.pending.leadMemberId
    else if (!run.value.roster.some(member => member.id === nextLeadMemberId.value && !member.eliminated)) nextLeadMemberId.value = run.value.roster.find(member => !member.eliminated)?.id ?? ''
  }
  pendingQuit.value = null
  busy.value = false
  confirmingForfeit.value = false
  // Results and the interval before the next trainer still belong to this match.
  battleAudio.setMusicContext({ kind: run.value && !survival.value ? 'league' : 'private', matchId: response.matchId, opponentTitle: run.value?.opponent?.title })
  if (!animate) {
    displayed.value = response.view
    await nextTick()
    if (!isCurrent(token)) return
    // Base rendering can load separately while all battle controls remain usable.
    void battleView.value?.sync(response.view, { run: response.run })
    message.value = response.view.result ? resultTitle.value : readyText()
  } else {
    playing.value = true
    if (!before) displayed.value = response.view
    await nextTick()
    if (!isCurrent(token)) return
    showBattle()
    try {
      const presentation = await battleView.value.present({ before, after: response.view, events: response.events ?? [], run: response.run, playerLabel: selectedTeamLabel.value })
      if (isCurrent(token) && (!before || presentation.status !== 'completed')) message.value = readyText()
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
    const [settings, battle, owner] = await Promise.all([
      simulationRequest('config', { signal }),
      simulationRequest('match', { signal }).catch(cause => { if (cause.code === 'NO_MATCH') return null; throw cause }),
      survivalPage ? simulationRequest('owner', { signal }) : Promise.resolve(null),
    ])
    if (!isCurrent(token)) return
    config.value = settings
    if (battle) await acceptResponse(battle, token, false)
    else if (owner?.pendingStart) holdStart(owner.pendingStart)
  } catch (cause) { if (isCurrent(token)) error.value = cause.message }
  finally { if (isCurrent(token)) busy.value = false }
}
async function startBattle() {
  if (busy.value || generatingTeam.value || latest.value || (!pendingStart.value && !lead.value?.species)) return
  if (!pendingStart.value && teamMode.value === 'custom' && !customReady.value) { teamErrors.value = customIssues.value; return }
  void battleAudio.unlock()
  battleAudio.preload(selectedTeam.value.map(member => member.species))
  const selection = teamMode.value === 'custom' ? { team: toTeamPayload(customTeam.value) } : { presetId: selectedPreset.value.id }
  const { token, signal } = beginRequest()
  try {
    let command = pendingStart.value
    if (survival.value && !command) {
      const owner = await simulationRequest('owner', { signal })
      if (!isCurrent(token)) return
      if (!owner.ready) throw new Error('Your Survival session could not be prepared. Reconnect before starting.')
      command = survivalStartCommand({ selection, leadIndex: leadIndex.value, ownerId: owner.id, ownerRevision: owner.revision, operationId: createCommandId() })
      pendingStart.value = command
      saveSurvivalStart(globalThis.sessionStorage, command)
    }
    command ??= { ...selection, leadIndex: leadIndex.value, expectedMatchId: latest.value?.matchId ?? null, ...(selectedLeague.value ? { regionId: selectedLeague.value.id } : {}) }
    const response = await simulationRequest('match', { method: 'POST', body: command, signal })
    if (!isCurrent(token)) return
    log.value = []; battleView.value?.clear()
    await acceptResponse(response, token)
    if (isCurrent(token)) showBattle()
  } catch (cause) { if (isCurrent(token)) {
    error.value = cause.message
    if (['INVALID_TEAM', 'INVALID_SURVIVAL', 'INVALID_LEAD'].includes(cause.code)) { pendingStart.value = null; saveSurvivalStart(globalThis.sessionStorage, null) }
    if (cause.code === 'INVALID_TEAM') { teamErrors.value = cause.issues; teamValidation.value = null }
  } }
  finally { if (isCurrent(token)) busy.value = false }
}
async function advanceBattle() {
  if (busy.value || playing.value || pendingQuit.value || !canContinue.value) return
  void battleAudio.unlock()
  // Preserve the original IDs after a lost response so retries cannot skip a trainer.
  const command = pendingAdvance.value ?? (survival.value
    ? survivalAdvanceCommand(run.value, latest.value.matchId, nextLeadMemberId.value, createCommandId())
    : { matchId: latest.value.matchId, runId: run.value.id })
  pendingAdvance.value = command
  const { token, signal } = beginRequest()
  try {
    const response = await simulationRequest('advance', { method: 'POST', body: command, signal })
    if (!isCurrent(token)) return
    if (!response.view?.complete) throw new Error('The next battle is not ready. Sync or retry to recover your challenge.')
    battleView.value?.clear()
    await acceptResponse(response, token)
    if (isCurrent(token)) showBattle()
  } catch (cause) { if (isCurrent(token)) error.value = cause.message }
  finally { if (isCurrent(token)) busy.value = false }
}
async function cancelPendingStart() {
  if (busy.value || !pendingStart.value || latest.value) return
  const { token, signal } = beginRequest()
  try {
    const battle = await simulationRequest('match', { signal }).catch(cause => { if (cause.code === 'NO_MATCH') return null; throw cause })
    if (!isCurrent(token)) return
    if (battle) { await acceptResponse(battle, token, false); return }
    const owner = await simulationRequest('owner', { signal })
    if (!isCurrent(token)) return
    if (owner.pendingStart && owner.pendingStart.operationId !== pendingStart.value.operationId) throw new Error('Another tab changed the pending run. Reconnect to review it.')
    const response = await simulationRequest('owner', { method: 'DELETE', body: { revision: owner.revision }, signal })
    if (!isCurrent(token)) return
    if (!response.cleared) throw new Error('The server could not clear your pending run. Reconnect to check it.')
    pendingStart.value = null; saveSurvivalStart(globalThis.sessionStorage, null)
  } catch (cause) { if (isCurrent(token)) error.value = cause.message }
  finally { if (isCurrent(token)) busy.value = false }
}
async function sendChoice(action, retry = false) {
  if (busy.value || playing.value || pendingQuit.value || (!retry && locked.value)) return
  void battleAudio.unlock()
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
  battleView.value?.skip()
  const { token, signal } = beginRequest()
  playing.value = false
  // Full snapshots recover even if another tab replaced the browser's match.
  try { await acceptResponse(await simulationRequest('match', { signal }), token, false) }
  catch (cause) {
    if (!isCurrent(token)) return
    error.value = cause.message
    if (cause.code === 'NO_MATCH' || cause.code === 'PROJECTION_UNAVAILABLE' && !survival.value) {
      clearBattleState()
    }
  } finally { if (isCurrent(token)) busy.value = false }
}
async function forfeit() {
  if (locked.value) return
  const { token, signal } = beginRequest()
  try { await acceptResponse(await simulationRequest('forfeit', { method: 'POST', body: { matchId: latest.value.matchId, afterCursor: latest.value.cursor }, signal }), token) }
  catch (cause) { if (isCurrent(token)) error.value = cause.message }
  finally { if (isCurrent(token)) busy.value = false }
}
function clearBattleState() {
  // Invalidate presentation before removing its actors. Late imports, impact
  // cues and result timers cannot repopulate a battle that has been cleared.
  battleView.value?.clear()
  battleAudio.setMusicContext({ kind: 'menu' })
  latest.value = null; displayed.value = null; run.value = null; log.value = []
  pendingChoice.value = null; pendingAdvance.value = null; pendingQuit.value = null; pendingStart.value = null
  saveSurvivalStart(globalThis.sessionStorage, null)
  confirmingForfeit.value = false; playing.value = false
  message.value = setupMessage()
}
async function quitBattle() {
  if (busy.value || !latest.value) return
  // Keep the original identity after an uncertain response. Retrying must not
  // delete a different match created or advanced in another browser tab.
  const command = pendingQuit.value ?? { matchId: latest.value.matchId, ...(survival.value ? { runId: run.value.id, revision: run.value.revision } : {}) }
  pendingQuit.value = command
  const { token, signal } = beginRequest()
  void battleView.value?.sync(latest.value, { run: run.value })
  displayed.value = latest.value
  playing.value = false
  try {
    let response
    try { response = await simulationRequest('match', { method: 'DELETE', body: command, signal }) }
    catch (cause) {
      // An expired session or a previously successful DELETE is already clear.
      if (cause.code !== 'NO_MATCH') throw cause
      response = { cleared: true }
    }
    if (response?.cleared !== true) throw new Error('The server did not confirm that the battle was cleared. Retry quit or sync the battle.')
    if (!isCurrent(token)) return
    clearBattleState()
    await nextTick()
    if (!isCurrent(token)) return
    setupTitle.value?.focus({ preventScroll: true })
    setupTitle.value?.scrollIntoView({ behavior: reducedMotion.value ? 'instant' : 'smooth', block: 'start' })
  } catch (cause) { if (isCurrent(token)) error.value = cause.message }
  finally { if (isCurrent(token)) busy.value = false }
}

onMounted(() => {
  try {
    const saved = readTeamDraft(globalThis.localStorage)
    if (saved) { customTeam.value = saved; teamMode.value = 'custom' }
    if (survivalPage) holdStart(readSurvivalStart(globalThis.sessionStorage))
  } catch {}
  reducedMotion.value = matchMedia('(prefers-reduced-motion: reduce)').matches
  void initialize()
})
onBeforeUnmount(() => {
  battleAudio.dispose()
  disposed = true; generation++; controller?.abort(); catalogController?.abort()
})
</script>

<template>
  <div class="sim-shell">
    <a class="sim-skip-link" href="#simulation">Skip to battle</a>
    <header class="sim-header">
      <a class="sim-brand" href="/"><span class="ball-mark" aria-hidden="true"></span>Battle Lab<span class="sim-brand-dot">.</span></a>
      <nav class="sim-nav" aria-label="Main navigation"><a href="/">Home</a><a href="/multiplayer">Private battles</a><a href="/simulation" aria-current="page">Simulation</a><a href="/preview">Move preview</a><a href="/playground">FX playground</a></nav>
    </header>
    <main id="simulation">
      <div class="sim-heading">
        <div><p class="sim-eyebrow">{{ survival ? 'SIX POKÉMON. HOW FAR CAN YOU GO?' : 'MAKE YOUR NEXT MOVE' }}</p><h1>Battle simulation<span>.</span></h1><p class="sim-intro">{{ survival ? 'Fresh rivals. Recover after every win. Keep your team in the fight.' : 'Generation 3 mechanics. Four Elite Four members. One Champion.' }}</p></div>
        <div class="sim-format"><span class="sim-dot"></span> {{ survival ? 'ENDLESS SOLO CHALLENGE' : 'REGIONAL LEAGUE CHALLENGE' }} <small>Level 100 · Singles · Automated opponents</small></div>
      </div>
      <nav v-if="!latest" class="sim-mode-links" aria-label="Battle simulation mode">
        <a href="/simulation" :aria-current="!survival ? 'page' : undefined"><strong>Regional League</strong><span>Four Elite Four members. One Champion. Full recovery between battles.</span></a>
        <a href="/survival" :aria-current="survival ? 'page' : undefined"><strong>Survival</strong><span>Endless random rivals. Survivors recover 25% HP; fainted teammates revive at 50% after each win.</span></a>
      </nav>

      <div v-if="error" class="sim-error" role="alert">
        <p>{{ error }}</p><div class="sim-error-actions">
          <button v-if="latest" :disabled="busy" @click="syncBattle">Sync battle</button>
          <button v-if="pendingQuit" :disabled="busy" @click="quitBattle">Retry quit</button>
          <button v-if="pendingChoice && !pendingQuit" :disabled="busy" @click="sendChoice(null, true)">Retry action</button>
          <button v-if="pendingAdvance && !pendingQuit" :disabled="busy || playing" @click="advanceBattle">Retry next battle</button>
          <button v-if="pendingStart && !latest" :disabled="busy" @click="startBattle">Retry starting run</button>
          <button v-if="!latest" :disabled="busy" @click="initialize">Reconnect</button>
        </div>
      </div>
      <div v-if="!config && busy" class="sim-loading" role="status">Connecting to the battle server…</div>
      <div v-if="pendingStart && !latest && !busy" class="sim-survival-notice" role="status">Your start request is awaiting confirmation. Reconnect to recover the run, or retry the same request. Your team choice is held until it is confirmed.<div><button @click="startBattle">Retry starting run</button><button @click="cancelPendingStart">Cancel pending start</button></div></div>
      <p v-if="run?.interruption" class="sim-error" role="alert">{{ run.interruption.message }} Your completed rounds are preserved. Sync or retry the interrupted action.</p>

      <section v-if="config && !latest" class="sim-setup" aria-labelledby="setup-title">
        <div class="sim-setup-heading"><div><p class="sim-eyebrow">{{ survival ? 'BUILD A TEAM THAT LASTS' : 'YOUR ROAD TO CHAMPION' }}</p><h2 id="setup-title" ref="setupTitle" tabindex="-1">{{ survival ? 'Prepare your Survival team.' : 'Choose your league challenge.' }}</h2></div><span class="sim-soft-badge">Level 100 · {{ survival ? 'No final round' : 'Five battles' }}</span></div>
        <section v-if="survival" class="sim-survival-rules" aria-label="Survival rules">
          <div><strong>25% recovery</strong><span>Each win restores 25% max HP to survivors, capped at full health.</span></div><div><strong>Revive at 50% HP</strong><span>Fainted teammates return at half their max HP after a win. They stay unavailable during the current battle.</span></div><div><strong>A fresh start between rounds</strong><span>Status and stat changes clear. PP and original held items restore.</span></div><div><strong>Random rivals</strong><span>Face a fresh team of six from all 386 Gen 1–3 species.</span></div>
          <p>Your team stays fixed. Choose any teammate as your next lead, including a revived Pokémon. A loss, draw or forfeit ends the run without recovery. This is a casual challenge with varied opponent strength.</p>
          <p class="sim-survival-retention">Temporary run: reconnect in this browser within {{ survivalInactivityMinutes }} inactive minutes. A server restart clears progress. There is no permanent save.</p>
        </section>
        <template v-else-if="config.leagues?.length">
          <div class="sim-league-heading"><p class="sim-eyebrow">01 / CHOOSE A REGION</p><span>Your team choice is independent of the region.</span></div>
          <div class="sim-regions" role="group" aria-label="Regional league">
            <button v-for="league in config.leagues" :key="league.id" class="sim-region" :class="{ selected: selectedLeague?.id === league.id }" :aria-pressed="selectedLeague?.id === league.id" :disabled="busy" @click="regionId = league.id">
              <span class="sim-region-top"><strong>{{ league.name }}</strong><span aria-hidden="true">{{ selectedLeague?.id === league.id ? '●' : '○' }}</span></span>
              <span class="sim-region-edition">{{ league.edition }}</span>
              <span class="sim-region-trainers">{{ league.trainers.map(trainer => trainer.name).join(' → ') }}</span>
              <span class="sim-region-note">{{ league.description }}</span>
            </button>
          </div>
          <p class="sim-league-rules">All Pokémon battle at Level 100 using Gen 3 mechanics. Your original team is fully restored before every trainer: HP, PP, status and held items reset.</p>
        </template>
        <div class="sim-lead-heading"><p class="sim-eyebrow">{{ !survival && config.leagues?.length ? '02' : '01' }} / CHOOSE YOUR TEAM</p><span>{{ survival ? 'Start with a preset or build and randomize your own six.' : 'Bring a preset or your own team to any league.' }}</span></div>
        <div class="sim-team-mode" role="group" aria-label="Team source">
          <button :aria-pressed="teamMode === 'preset'" :disabled="preparationLocked" @click="teamMode = 'preset'; leadIndex = 0">Use a preset</button>
          <button :aria-pressed="teamMode === 'custom'" :disabled="preparationLocked" @click="teamMode = 'custom'; leadIndex = 0">Build my team</button>
        </div>
        <div v-if="teamMode === 'preset'" class="sim-presets">
          <button v-for="preset in config.presets" :key="preset.id" class="sim-preset" :class="{ selected: selectedPreset?.id === preset.id }" :aria-pressed="selectedPreset?.id === preset.id" :disabled="preparationLocked" @click="presetId = preset.id; leadIndex = 0">
            <div class="sim-preset-top"><span>{{ preset.id.toUpperCase() }}</span><span aria-hidden="true">{{ selectedPreset?.id === preset.id ? '●' : '○' }}</span></div>
            <h3>{{ preset.name }}</h3><p>{{ preset.description }}</p>
            <div class="sim-preset-sprites"><img v-for="member in preset.team" :key="member.species" :src="spriteUrl(member.species)" :alt="member.species" width="56" height="56" decoding="async"></div>
          </button>
        </div>
        <div v-else class="sim-custom-team">
          <p v-if="catalogLoading" class="sim-builder-note" role="status">Loading the Gen 3 team catalog…</p>
          <div v-else-if="catalogError" class="sim-error" role="alert"><p>{{ catalogError }}</p><div class="sim-error-actions"><button @click="loadTeamCatalog">Retry team catalog</button></div></div>
          <template v-if="teamCatalog">
            <RandomTeamBuilder :team="customTeam" :catalog="teamCatalog" :presets="config.presets" :disabled="preparationLocked" :generate-team="generateTeam" :reset-key="`${teamMode}:${leadIndex}`" @update:team="customTeam = $event" @busy-change="generatingTeam = $event"/>
            <div class="sim-team-validation">
              <div class="sim-team-validation-actions"><button :disabled="preparationLocked || generatingTeam" @click="validateCustomTeam">{{ busy || generatingTeam ? 'Please wait…' : 'Check team' }}</button><span>{{ draftSaved ? 'Draft saved in this browser.' : 'Draft is available for this visit.' }}</span></div>
              <p class="sim-builder-note">Six distinct Pokémon, level 100, with one to four moves each. The server checks move combinations and event restrictions before starting a battle.</p>
              <p v-if="teamValidation?.valid" class="sim-team-valid" role="status">Your team passed Gen 3 validation.</p>
              <details v-if="teamValidation?.changes.length" class="sim-team-adjustments"><summary>Adjustments from validation</summary><ul><li v-for="(change, index) in teamValidation.changes" :key="index">Slot {{ change.setIndex + 1 }} · {{ change.field }}: {{ change.before }} → {{ change.after ?? 'removed' }}</li></ul></details>
              <div v-if="teamErrors.length" class="sim-team-errors" role="alert"><strong>Review your team</strong><ul><li v-for="(issue, index) in teamErrors" :key="index"><span v-if="Number.isInteger(issue.setIndex)">Slot {{ issue.setIndex + 1 }}: </span>{{ issue.message }}</li></ul></div>
              <p v-else-if="customIssues.length" class="sim-builder-note">{{ customIssues[0].message }}</p>
            </div>
          </template>
        </div>
        <div class="sim-lead-heading"><p class="sim-eyebrow">{{ !survival && config.leagues?.length ? '03' : '02' }} / PICK YOUR LEAD</p><span>{{ survival ? 'Your first lead. Choose again between rounds.' : 'Your lead opens each battle. No team preview.' }}</span></div>
        <div class="sim-lead-grid">
          <button v-for="(member, index) in selectedTeam" :key="index" class="sim-lead" :class="{ selected: leadIndex === index }" :aria-pressed="leadIndex === index" :disabled="preparationLocked || !member.species" @click="leadIndex = index">
            <span class="sim-lead-number">0{{ index + 1 }}</span><img v-if="member.species" :src="spriteUrl(member.species)" alt="" width="84" height="84"><span v-else class="sim-empty-lead" aria-hidden="true">?</span><strong>{{ member.species || 'Empty slot' }}</strong><span>{{ !member.species ? 'Add a Pokémon above' : leadIndex === index ? 'Selected lead' : 'Choose as lead' }}</span>
          </button>
        </div>
        <div v-if="lead?.species" class="sim-team-summary">
          <div><h3>{{ lead.species }} <span>Lv. {{ lead.level }}</span></h3><p>{{ pretty(lead.ability) }} <span aria-hidden="true">·</span> {{ pretty(lead.item) || 'No held item' }}</p><div class="sim-lead-moves"><span v-for="move in lead.moves.filter(Boolean)" :key="move">{{ moveInfo(move).name || pretty(move) }}</span></div></div>
          <button class="sim-primary" :disabled="busy || generatingTeam || (!pendingStart && teamMode === 'custom' && !customReady)" @click="startBattle">{{ busy || generatingTeam ? 'Please wait…' : pendingStart ? 'Retry starting run' : survival ? 'Start Survival' : selectedLeague ? `Challenge ${selectedLeague.name}` : 'Start battle' }} <span aria-hidden="true">↗</span></button>
        </div>
        <p class="sim-setup-note">{{ survival ? 'Rounds beaten counts completed wins. Entering round 8 means seven rounds beaten. There is no public ranking.' : 'Cartridge-inspired trainer rosters, adapted to Level 100 and Gen 3 mechanics. Play against a simple automated opponent with a preset or your own team.' }}</p>
      </section>

      <section v-if="latest && run && !survival" class="sim-league-progress" aria-labelledby="league-title">
        <div class="sim-league-progress-heading"><div><p class="sim-eyebrow">{{ run.edition }} · LEVEL 100</p><h2 id="league-title">{{ run.regionName }} league</h2></div><span>{{ run.wins }} / {{ run.totalStages }} defeated</span></div>
        <ol class="sim-trainer-path" aria-label="League progress">
          <li v-for="(trainer, index) in run.trainers" :key="trainer.id" :class="`sim-trainer-${trainerState(index)}`" :aria-current="trainerState(index) === 'current' ? 'step' : undefined">
            <span class="sim-trainer-number" aria-hidden="true">{{ trainerState(index) === 'cleared' ? '✓' : String(index + 1).padStart(2, '0') }}</span>
            <div><span class="sim-trainer-title">{{ trainer.title }}</span><strong>{{ trainer.name }}</strong><span class="sim-trainer-specialty">{{ trainer.specialty }}</span><span class="sim-trainer-state">{{ trainerStateLabel(index) }}</span></div>
          </li>
        </ol>
        <p class="sim-league-progress-note">{{ run.status === 'active' ? `Facing ${run.opponent.title} ${run.opponent.name}.` : run.status === 'won' ? 'League complete.' : run.status === 'lost' ? 'A new challenge starts with the first trainer.' : `Next opponent: ${run.nextOpponent?.name}.` }} Your team receives a full reset between battles.</p>
      </section>

      <section v-if="latest && survival" class="sim-survival-progress" aria-labelledby="survival-title">
        <div class="sim-league-progress-heading"><div><p class="sim-eyebrow">YOUR ORIGINAL SIX · LEVEL 100</p><h2 id="survival-title">Round {{ run.roundNumber }}</h2></div><div class="sim-survival-score"><strong>{{ playing ? Math.max(0, run.roundNumber - 1) : run.wins }} rounds beaten</strong><span>{{ runRoster.filter(member => !member.eliminated).length }} able to battle</span></div></div>
        <ol class="sim-survivors" aria-label="Survival team">
          <li v-for="member in runRoster" :key="member.id" :class="{ 'sim-survivor-out': member.eliminated }">
            <img :src="spriteUrl(member.species)" alt="" width="68" height="68"><strong>{{ member.species }}</strong><span>{{ member.eliminated ? 'Fainted' : `${member.hp} / ${member.maxHp} HP` }}</span><meter v-if="!member.eliminated" :value="member.hp" min="0" :max="member.maxHp" :aria-label="`${member.species} health`"></meter><small v-else>{{ run.status === 'ended' ? 'Run ended' : 'Revives after a win' }}</small>
          </li>
        </ol>
        <p class="sim-league-progress-note">{{ run.status === 'active' || playing ? 'Win this round to recover 25% max HP for survivors and revive fainted teammates at 50% max HP.' : canContinue ? 'Recovered and revived HP is shown here. The battlefield below keeps the actual finishing result.' : 'Your final roster. Start a new run to restore your team.' }}</p>
      </section>

      <div v-if="latest" class="sim-layout">
        <section ref="arena" class="sim-arena" aria-label="Battle and controls">
          <div class="sim-arena-bar"><span class="sim-round">TURN {{ displayed?.turn || 1 }}</span><span>{{ displayed?.result ? 'BATTLE COMPLETE' : `${remaining} OF ${displayed?.own.team.length ?? 6} TEAMMATES REMAIN` }}</span><button :disabled="busy || playing" @click="syncBattle" title="Reload the current battle state">Sync battle ↻</button></div>
          <BattleView ref="battleView" :audio="battleAudio" :player-label="selectedTeamLabel" @display="displayed = $event" @playback="playing = $event" @message="message = $event"/>

          <section v-if="latest.result && !playing" class="sim-result" :class="{ 'sim-result-champion': run?.status === 'won' }" aria-labelledby="result-title">
            <p class="sim-eyebrow">{{ resultEyebrow }}</p><h2 id="result-title">{{ resultTitle }}</h2><p>{{ resultDetail }}</p>
            <template v-if="survival && canContinue">
              <ul class="sim-recovery-list" aria-label="Round recovery"><li v-for="recovery in run.recovery" :key="recovery.id"><strong>{{ run.roster.find(member => member.id === recovery.id)?.species }}</strong><span>{{ recovery.eliminated ? 'Fainted' : recovery.revived ? `Revived · ${recovery.before} → ${recovery.after} HP` : `${recovery.before} → ${recovery.after} HP (+${recovery.healed})` }}</span></li></ul>
              <fieldset class="sim-next-lead" :disabled="busy || !!pendingAdvance || !!pendingQuit || run.status === 'starting-next'"><legend>Choose your next lead</legend><div><label v-for="member in run.roster" :key="member.id" :class="{ selected: nextLeadMemberId === member.id, eliminated: member.eliminated }"><input v-model="nextLeadMemberId" type="radio" name="next-survival-lead" :value="member.id" :disabled="member.eliminated"><img :src="spriteUrl(member.species)" alt="" width="54" height="54"><strong>{{ member.species }}</strong><span>{{ member.eliminated ? 'Fainted' : `${member.hp} / ${member.maxHp} HP` }}</span></label></div></fieldset>
            </template>
            <div class="sim-result-actions">
              <button v-if="canContinue" class="sim-primary" :disabled="busy || !!pendingQuit || (survival && !nextLeadMemberId)" @click="advanceBattle">{{ busy && !pendingQuit ? 'Preparing next battle…' : pendingAdvance ? 'Retry next battle' : survival ? `Continue to round ${run.roundNumber + 1}` : `Face ${run.nextOpponent?.name}` }} <span aria-hidden="true">↗</span></button>
              <button :class="canContinue ? 'sim-result-restart' : 'sim-primary'" :disabled="busy" @click="quitBattle">{{ busy && pendingQuit ? 'Quitting…' : survival ? 'Choose a new run' : run ? 'Choose a new challenge' : 'Choose a new team' }} <span v-if="!canContinue" aria-hidden="true">↗</span></button>
            </div>
          </section>
          <div v-else class="sim-decisions">
            <div class="sim-decision-heading"><h2>{{ decisionPrompt }}</h2><span v-if="!locked && decision?.kind === 'move'">Choose one action</span></div>
            <div v-if="decision?.kind !== 'switch'" class="sim-move-grid">
              <button v-for="move in decision?.moves" :key="move.slot" class="sim-move" :class="`sim-type-${moveInfo(move).type?.toLowerCase()}`" :disabled="locked || decision?.kind !== 'move' || move.disabled" :title="moveInfo(move).shortDesc || move.name" @click="sendChoice({ kind: 'move', slot: move.slot })">
                <div><span class="sim-move-type">{{ moveInfo(move).type || 'Move' }}</span><span>{{ move.pp === null ? '—' : move.pp }} / {{ move.maxpp === null ? '—' : move.maxpp }} PP</span></div><strong>{{ moveInfo(move).name || move.name }}</strong><small v-if="move.disabled">Unavailable this turn</small>
              </button>
            </div>
            <div class="sim-party-heading"><h3>{{ decision?.kind === 'switch' ? 'Send out a teammate' : 'Or switch Pokémon' }}</h3><span v-if="!decision?.canSwitch && decision?.kind === 'move'">Switching unavailable this turn</span></div>
            <div class="sim-party">
              <button v-for="member in displayed?.own.team" :key="member.memberId" :class="{ active: member.active, fainted: member.fainted }" :disabled="locked || !switchIds.has(member.memberId)" :aria-label="`${member.species}, ${member.fainted ? 'fainted' : member.active ? 'active' : `${member.hp?.current} of ${member.hp?.max} HP`}${member.condition ? `, ${member.condition}` : ''}`" @click="sendChoice({ kind: 'switch', memberId: member.memberId })">
                <img :src="spriteUrl(member.species)" alt="" width="62" height="62"><strong>{{ member.species }}</strong><span>{{ member.fainted ? 'Fainted' : member.active ? 'On the field' : `${member.hp?.current ?? '—'} / ${member.hp?.max ?? '—'}` }}</span><small v-if="member.condition">{{ member.condition.toUpperCase() }}</small>
              </button>
            </div>
            <div class="sim-battle-actions">
              <span>{{ survival ? `Quit clears this run. Reconnect within ${survivalInactivityMinutes} inactive minutes; a server restart clears progress.` : 'Quit clears this battle and league progress. Leaving the page keeps it for 30 minutes.' }}</span>
              <template v-if="confirmingForfeit"><span>{{ survival ? 'End this Survival run?' : 'End this battle?' }}</span><button :disabled="locked" @click="forfeit">Yes, forfeit</button><button @click="confirmingForfeit = false">Cancel</button></template>
              <button v-else :disabled="locked" @click="confirmingForfeit = true">{{ survival ? 'Forfeit run' : 'Forfeit battle' }}</button>
              <button class="sim-quit-battle" :disabled="busy" @click="quitBattle">{{ busy && pendingQuit ? 'Quitting…' : survival ? 'Quit run' : 'Quit battle' }}</button>
            </div>
          </div>
        </section>
        <aside class="sim-log-panel" aria-labelledby="log-title"><div class="sim-log-heading"><div><p class="sim-eyebrow">THE STORY SO FAR</p><h2 id="log-title">Battle log</h2></div><span class="sim-dot" aria-hidden="true"></span></div><ol ref="logHost" class="sim-log" aria-label="Battle history"><li v-for="entry in log" :key="entry.cursor" :class="{ 'sim-log-turn': /^Turn \d/.test(entry.text) }">{{ entry.text }}</li><li v-if="!log.length">Your battle begins here.</li></ol><div class="sim-log-note">Your HP is exact. Opponent HP uses the public battle bar. Only revealed opponent details appear here.</div></aside>
      </div>
    </main>
    <footer class="sim-footer"><span>Battle Lab · Generation 3</span><p>Battle simulation · {{ survival ? 'Survival' : 'Regional League' }} · Same-browser reconnect</p><a href="/">Back to home ↗</a></footer>
  </div>
</template>
