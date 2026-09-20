import { createAudioPlayer } from '@battle/battle-audio'
import { getEventSoundPlan } from '@battle/battle-sfx/event-runtime'
import { createSimulationAudio } from '../../apps/simulation/src/audio.js'
import { createBattleAudio, BATTLE_AUDIO_MIX } from '../../apps/shared/battle/audio.js'
import { createSimulationScene } from '../../apps/shared/battle/scene.js'
import { createSimulationPresenter } from '../../apps/shared/battle/presentation.js'

// Development-only QA: every scene, clip, decoder, buffer and voice is real.
// The player wrapper observes native starts and completion without changing them.
const status = document.querySelector('#status'), output = document.querySelector('#results')
const runButton = document.querySelector('#run'), stopButton = document.querySelector('#stop')
const hostList = document.querySelector('#hosts')
const eventIds = ['battle.release.pokeball', 'battle.faint']
const assetIds = eventIds.map(id => getEventSoundPlan(id).assetId)
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const timestamp = () => Math.round(performance.now() * 100) / 100
let active = [], stopped = false, currentResult = null
const publish = () => { output.textContent = JSON.stringify(currentResult, null, 2) }
const checkVisible = () => assert(!stopped && !document.hidden, 'Checks stopped or tab hidden')
const protocol = (cursor, opcode, ...fields) => ({ cursor, type: 'protocol', args: { opcode, fields } })
const member = (memberId, species, hp) => ({ memberId, species, name: species, active: true,
  hp: { current: hp, max: hp }, hpPrecision: memberId.startsWith('p1:') ? 'exact' : 'public',
  fainted: false, condition: null, stages: {}, volatiles: [], moves: [], item: null, ability: null })

function openingView(name) {
  return { matchId: `transition-browser-${name}`, seat: 'p1', cursor: 10, turn: 1,
    own: { active: 'p1:1', team: [member('p1:1', 'Charizard', 156)] },
    opponent: { active: 'p2:revealed:1', known: [member('p2:revealed:1', 'Venusaur', 48)] },
    weather: null, sideConditions: { p1: [], p2: [] }, fieldConditions: [], result: null, complete: true,
    decision: { id: 'transition-qa', kind: 'wait', moves: [] } }
}

function makeHost(name, factory) {
  const section = document.createElement('section'), heading = document.createElement('h2')
  const stage = document.createElement('div'), health = document.createElement('div'), message = document.createElement('p')
  section.className = 'host'; heading.textContent = name; stage.className = 'stage'; health.className = 'health'
  stage.setAttribute('role', 'img'); stage.setAttribute('aria-label', `${name}: Charizard and Venusaur transition canvas`)
  section.append(heading, health, stage, message); hostList.append(section)
  const report = { host: name, categoryVolumes: BATTLE_AUDIO_MIX, unlocked: false, sceneAvailable: null,
    presentations: [], displays: [], transitionCues: [], entryCues: [], voices: [], passed: false }
  let player, context, observingVoice = null, currentCue = null, scope = null
  const pendingVoices = []
  const audio = factory({ storage: null, sfxEnabled: true, draftSfxEnabled: false, categoryVolumes: BATTLE_AUDIO_MIX,
    playerFactory(options) {
      player = createAudioPlayer({ ...options, createContext() {
        const NativeContext = globalThis.AudioContext ?? globalThis.webkitAudioContext
        assert(NativeContext, 'Web Audio is unavailable')
        context = new NativeContext()
        const nativeCreateSource = context.createBufferSource.bind(context)
        context.createBufferSource = () => {
          const source = nativeCreateSource(), nativeStart = source.start.bind(source)
          source.start = (...args) => {
            const observation = observingVoice
            if (observation) {
              observation.nativeStart = { atMs: timestamp(), contextTime: context.currentTime,
                playbackRate: source.playbackRate.value, sampleRate: source.buffer?.sampleRate,
                sampleFrames: source.buffer?.length, durationSeconds: source.buffer?.duration,
                arguments: args }
              source.addEventListener('ended', () => { observation.nativeEndedAtMs = timestamp(); publish() }, { once: true })
            }
            return nativeStart(...args)
          }
          return source
        }
        return context
      } })
      return Object.freeze({ ...player, playSegment(assetId, options) {
        const row = { assetId, cue: currentCue ? { ...currentCue } : null, requestedAtMs: timestamp(),
          native: player.readyInfo(assetId), category: options.category, gainDb: options.gainDb,
          explicitStart: options.startSeconds ?? null, explicitEnd: options.endSeconds ?? null,
          started: false, finishReason: null }
        report.voices.push(row); observingVoice = row
        let voice
        try { voice = player.playSegment(assetId, options) } finally { observingVoice = null }
        row.started = Boolean(voice)
        if (voice) pendingVoices.push(Promise.resolve(voice.finished).then(result => {
          row.finishReason = result.reason; row.finishedAtMs = timestamp(); publish()
        }))
        publish()
        return voice
      } })
    },
  })
  audio.setCriesEnabled(false); audio.setVolume(.6)
  const scene = createSimulationScene({ getHost: () => stage,
    onAvailability(value) { report.sceneAvailable = value; publish() } })
  const presenter = createSimulationPresenter({
    getScene: scene.get, ensureScene: (view, options) => scene.ensure(view, options),
    faintScene: (view, options) => scene.faint(view, options),
    onDisplay(view, options) {
      scene.display(view, options)
      const source = view.own.team[0], target = view.opponent.known[0]
      health.textContent = `${source.species}: ${source.hp.current}/${source.hp.max} HP — ${target.species}: ${target.hp.current}/${target.hp.max} HP${target.fainted ? ' (fainted)' : ''}`
      report.displays.push({ cursor: view.cursor, targetHp: target.hp.current, targetFainted: target.fainted,
        retainFaintedActorIds: options?.retainFaintedActorIds ?? [], atMs: timestamp() })
      publish()
    },
    onMessage(text) { message.textContent = text },
    onEntry(view, actorId) {
      report.entryCues.push({ actorId, cursor: view.cursor, atMs: timestamp() })
      scope?.entry(view, actorId); publish()
    },
    onTransition(view, cue) {
      currentCue = { ...cue, cursor: view.cursor, atMs: timestamp() }
      report.transitionCues.push(currentCue)
      try { scope?.transition(view, cue) } finally { currentCue = null }
      publish()
    },
    onEntryCancel: () => scope?.cancel(),
    // This fixture presents only an opening and authoritative damage/faint facts.
    // No attack recording or synthetic attack renderer participates in this run.
    loadFx: async () => { throw new Error('Transition-only fixture unexpectedly requested attack FX') },
  })
  return { name, report, audio, player, scene, presenter, pendingVoices,
    begin(view, events = []) { scope = audio.begin(view, events) } }
}

async function awaitVoices(host) {
  let timer
  try {
    await Promise.race([Promise.all(host.pendingVoices), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${host.name}: native audio tail did not finish`)), 5000)
    })])
  } finally { clearTimeout(timer) }
}

async function checkHost(host) {
  checkVisible()
  const { report, player, presenter } = host
  status.textContent = `${host.name}: loading native transition sounds`
  assert((await player.preload(assetIds, { priority: 2 })).every(Boolean), `${host.name}: transition decode failed`)
  checkVisible()
  const before = openingView(host.name)
  host.begin(before)
  status.textContent = `${host.name}: playing two Poké Ball send-outs`
  const opening = await presenter.present({ before: null, after: before, events: [] })
  report.presentations.push({ kind: 'opening', ...opening, completedAtMs: timestamp() })
  assert(opening.status === 'completed' && report.sceneAvailable, `${host.name}: opening presentation failed`)
  await awaitVoices(host)
  checkVisible()
  const after = structuredClone(before)
  after.cursor = 12; after.opponent.active = null
  Object.assign(after.opponent.known[0], { active: false, fainted: true, hp: { current: 0, max: 48 } })
  const events = [protocol(11, '-damage', 'p2:revealed:1', '0 fnt'), protocol(12, 'faint', 'p2:revealed:1')]
  host.begin(after, events)
  status.textContent = `${host.name}: revealing zero HP, then playing the faint animation`
  const faint = await presenter.present({ before, after, events })
  report.presentations.push({ kind: 'faint', ...faint, completedAtMs: timestamp() })
  assert(faint.status === 'completed', `${host.name}: faint presentation failed`)
  await awaitVoices(host)
  checkVisible()
  const balls = report.transitionCues.filter(cue => cue.type === 'pokeball')
  const faints = report.transitionCues.filter(cue => cue.type === 'faint')
  const reveal = report.displays.find(view => view.targetHp === 0 && view.retainFaintedActorIds.includes('target'))
  assert(balls.length === 2 && new Set(balls.map(cue => cue.actorId)).size === 2 && faints.length === 1,
    `${host.name}: expected exactly two ball cues and one faint cue`)
  assert(reveal && faints[0].atMs >= reveal.atMs, `${host.name}: faint started before the committed HP reveal`)
  assert(report.voices.length === 3 && report.voices.every(voice => voice.started && voice.nativeStart?.playbackRate === 1 &&
    voice.finishReason === 'ended' && voice.explicitStart === null && voice.explicitEnd === null),
  `${host.name}: expected three complete native sound voices without cancellation or rate changes`)
  assert(report.voices.filter(voice => voice.assetId === assetIds[0]).length === 2 &&
    report.voices.filter(voice => voice.assetId === assetIds[1]).length === 1, `${host.name}: wrong sound assignment`)
  report.totals = { pokeball: balls.length, faint: faints.length, started: report.voices.filter(row => row.started).length,
    naturalEnded: report.voices.filter(row => row.finishReason === 'ended').length,
    cancelled: report.voices.filter(row => row.finishReason === 'cancelled').length }
  report.diagnostics = host.audio.diagnostics(); report.passed = true
  publish()
}

function stop() {
  stopped = true
  for (const host of active) { host.presenter.skip(); host.audio.stop() }
}
function cleanup() {
  for (const host of active) { host.presenter.destroy(); host.scene.destroy(); host.audio.dispose() }
  active = []
}
stopButton.addEventListener('click', stop)
window.addEventListener('pagehide', cleanup)
runButton.addEventListener('click', async () => {
  cleanup(); hostList.replaceChildren(); stopped = false
  runButton.disabled = true; stopButton.disabled = false
  currentResult = { userAgent: navigator.userAgent, startedAt: new Date().toISOString(), hosts: [],
    passed: false, error: null, listeningVerdict: null }
  publish()
  try {
    active = [makeHost('solo-simulation', createSimulationAudio), makeHost('private-multiplayer', createBattleAudio)]
    currentResult.hosts = active.map(host => host.report)
    // Both native contexts are created/resumed synchronously in this button gesture.
    const unlocks = active.map(host => host.audio.unlock())
    const unlocked = await Promise.all(unlocks)
    unlocked.forEach((value, index) => { active[index].report.unlocked = value })
    assert(unlocked.every(Boolean), 'Both native audio contexts must unlock')
    for (const host of active) await checkHost(host)
    currentResult.passed = active.every(host => host.report.passed)
    status.textContent = 'Passed: each battle host played two Poké Ball sounds and one faint sound, all at native speed through their natural ends.'
  } catch (error) {
    currentResult.error = error?.message ?? String(error)
    status.textContent = `Failed: ${currentResult.error}`
    stop()
  } finally {
    for (const host of active) host.audio.dispose()
    currentResult.finishedAt = new Date().toISOString()
    publish(); runButton.disabled = false; stopButton.disabled = true
  }
})
