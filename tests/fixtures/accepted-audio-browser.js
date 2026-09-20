import { createAudioPlayer } from '@battle/battle-audio'
import { ACCEPTED_SFX_RUNTIME_CATALOG } from '@battle/battle-sfx/accepted-runtime'
import { EVENT_SFX_RUNTIME_CATALOG } from '@battle/battle-sfx/event-runtime'
import { createPreviewAudio } from '../../apps/game/src/presentation/audio.js'
import { createSimulationAudio } from '../../apps/simulation/src/audio.js'
import { createBattleAudio } from '../../apps/shared/battle/audio.js'

// This development-only fixture is not a production page entry. Instrumentation
// observes the real player; it never supplies decoded buffers or fake voices.
const status = document.querySelector('#status'), output = document.querySelector('#results')
const runButton = document.querySelector('#run'), stopButton = document.querySelector('#stop')
const plans = Object.values(ACCEPTED_SFX_RUNTIME_CATALOG.moves)
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
let active = [], stopped = false
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const checkVisible = () => assert(!stopped && !document.hidden, 'Checks stopped or tab hidden')
const viewFor = host => ({ matchId: `native-audio-${host}`, cursor: 0,
  own: { active: null, team: [] }, opponent: { active: null, known: [] }, decision: { moves: [] } })

function makeHost(name, factory) {
  const observations = [], ready = new Map()
  let player
  const audio = factory({ storage: null, sfxEnabled: true, draftSfxEnabled: false,
    playerFactory(options) {
      player = createAudioPlayer(options)
      return Object.freeze({ ...player,
        readyInfo(id) {
          const info = player.readyInfo(id)
          if (info) ready.set(id, info)
          return info
        },
        playSegment(id, options) {
          const info = player.readyInfo(id), voice = player.playSegment(id, options)
          if (info) ready.set(id, info)
          observations.push({ assetId: id, started: Boolean(voice), native: info,
            startSeconds: options?.startSeconds ?? 0, endSeconds: options?.endSeconds ?? info?.durationSeconds ?? null,
            scheduledAt: options?.when ?? null, gainDb: options?.gainDb ?? 0 })
          return voice
        },
      })
    },
  })
  audio.setCriesEnabled(false)
  audio.setVolume(.6)
  return { name, audio, player, observations, ready }
}

async function checkHost(host, result, audible) {
  const { audio, player, observations } = host, view = viewFor(host.name)
  let scope = host.name === 'preview' ? null : audio.begin(view)
  const report = { host: host.name, unlocked: true, moves: [], events: [], nativeAssets: [], passed: false }
  result.hosts.push(report)
  for (const [index, plan] of plans.entries()) {
    checkVisible()
    status.textContent = `${host.name}: decoding and starting ${plan.fxId} (${index + 1}/${plans.length})`
    const assets = [plan.assetId, ...(plan.accent ? [plan.accent.assetId] : [])]
    const warmed = await player.preload(assets, { priority: 1 })
    assert(warmed.length === assets.length && warmed.every(Boolean), `${host.name}/${plan.fxId}: real asset load/decode failed`)
    checkVisible()
    const request = { moveId: plan.fxId, cursor: index + 1, phase: 'attack', outcome: 'hit', mode: 'normal' }
    const run = host.name === 'preview' ? audio.previewMove(request) : scope.move(request)
    assert(run, `${host.name}/${plan.fxId}: no audio run`)
    if (run.ready) await run.ready
    const before = observations.length
    run.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: performance.now(), reducedMotion: false })
    const voices = observations.slice(before), expected = plan.segments.length + (plan.accent ? 1 : 0)
    const row = { moveId: plan.fxId, expectedSegments: expected, started: voices.filter(voice => voice.started).length,
      rejected: voices.filter(voice => !voice.started).length, voices }
    report.moves.push(row)
    run.cancel()
    assert(row.started === expected && row.rejected === 0,
      `${host.name}/${plan.fxId}: started ${row.started}/${expected} segments; ${JSON.stringify(audio.diagnostics().sfx)}`)
    // Let the real player's short cancellation fade finish before the next run.
    await pause(30)
  }

  scope?.cancel()
  scope = audio.begin(view)
  for (const [id, event] of Object.entries(EVENT_SFX_RUNTIME_CATALOG.events).filter(([id]) => id.startsWith('battle.hit.'))) {
    checkVisible()
    assert((await player.preload([event.assetId], { priority: 2 }))[0], `${host.name}/${id}: event decode failed`)
    const before = observations.length, kind = id.replace('battle.hit.', '')
    const voice = scope.impact({ kind, key: `${view.matchId}:event:${kind}` })
    const row = { eventId: id, started: Boolean(voice), voices: observations.slice(before) }
    report.events.push(row)
    voice?.cancel()
    assert(row.started && row.voices.length === 1 && row.voices[0].started, `${host.name}/${id}: no event voice`)
    await pause(30)
  }
  scope.cancel()

  if (audible) {
    const sample = plans.find(plan => plan.fxId === 'body-slam') ?? plans[0]
    status.textContent = `${host.name}: playing complete ${sample.fxId} sample`
    await player.preload([sample.assetId], { priority: 1 })
    checkVisible()
    const sampleScope = audio.begin(view), request = { moveId: sample.fxId, cursor: 1000 }
    const run = host.name === 'preview' ? audio.previewMove(request) : sampleScope.move(request)
    if (run.ready) await run.ready
    const before = observations.length
    run.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: performance.now() })
    assert(observations.slice(before).some(voice => voice.started), `${host.name}: representative sample did not start`)
    run.finish({ status: 'completed' })
    const duration = player.readyInfo(sample.assetId)?.durationSeconds ?? 0
    await pause((duration + 1) * 1000)
    checkVisible()
    report.completeSample = { moveId: sample.fxId, playedToTail: true, listeningVerdict: null }
    sampleScope.cancel()
  }
  report.nativeAssets = [...host.ready].map(([assetId, native]) => ({ assetId, ...native }))
  report.diagnostics = audio.diagnostics()
  report.passed = report.moves.length === plans.length && report.events.length === 2
  output.textContent = JSON.stringify(result, null, 2)
}

stopButton.addEventListener('click', () => {
  stopped = true
  for (const host of active) host.audio.stop()
})

runButton.addEventListener('click', async () => {
  runButton.disabled = true; stopButton.disabled = false; stopped = false
  const result = { userAgent: navigator.userAgent, startedAt: new Date().toISOString(), passed: false,
    acceptedMoveCount: plans.length, hosts: [], error: null, listeningVerdict: null }
  output.textContent = JSON.stringify(result, null, 2)
  try {
    active = [makeHost('preview', createPreviewAudio), makeHost('simulation', createSimulationAudio), makeHost('private-multiplayer', createBattleAudio)]
    // Invoke all three unlocks in the original button gesture before any await.
    const unlocks = active.map(host => host.audio.unlock())
    const unlocked = await Promise.all(unlocks)
    assert(unlocked.every(Boolean), `Native audio contexts did not unlock: ${JSON.stringify(unlocked)}`)
    for (const host of active) await checkHost(host, result, document.querySelector('#audible').checked)
    result.passed = result.hosts.length === 3 && result.hosts.every(host => host.passed)
    result.totals = { moveRuns: result.hosts.reduce((sum, host) => sum + host.moves.length, 0),
      startedSegments: result.hosts.reduce((sum, host) => sum + host.moves.reduce((count, move) => count + move.started, 0), 0),
      effectivenessVoices: result.hosts.reduce((sum, host) => sum + host.events.filter(event => event.started).length, 0) }
    status.textContent = `Passed: ${result.totals.moveRuns} real move runs and ${result.totals.effectivenessVoices} effectiveness sounds across three hosts.`
  } catch (error) {
    result.error = error?.message ?? String(error)
    status.textContent = `Failed: ${result.error}`
  } finally {
    for (const host of active) host.audio.dispose()
    active = []; runButton.disabled = false; stopButton.disabled = true
    result.finishedAt = new Date().toISOString()
    output.textContent = JSON.stringify(result, null, 2)
  }
})
