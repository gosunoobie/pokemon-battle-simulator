import test from 'node:test'
import assert from 'node:assert/strict'
import { createMoveAudio, nativeSoundCompatibility } from '../apps/shared/battle/moveAudio.js'
import { createBattleAudio } from '../apps/shared/battle/audio.js'
import { SFX_RUNTIME_CATALOG, getMoveSoundPlan } from '../packages/battle-sfx/src/runtime.js'

const CHROME = 'Mozilla/5.0 AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36'
const tick = () => new Promise(resolve => setImmediate(resolve))
const nativeInfos = () => Object.fromEntries(Object.values(SFX_RUNTIME_CATALOG.moves).map(plan => [plan.assetId, { sampleRate: plan.nativeCompatibility.sampleRate, sampleFrames: plan.nativeCompatibility.sampleFrames }]))

function fakePlayer() {
  const infos = nativeInfos(), loads = [], voices = [], stoppedScopes = [], categories = new Map()
  let audioTime = 10, stops = 0, unlocks = 0, disposed = 0, onState = () => {}, state = { enabled: true, volume: .6, suspended: false, status: 'ready' }
  const update = patch => { state = { ...state, ...patch }; onState(state) }
  const player = {
    readyInfo: id => infos[id] ?? null,
    contextTime: () => audioTime,
    preload(ids, options) { loads.push({ ids: [...ids], options }); return Promise.resolve() },
    playSegment(id, options) {
      if (!state.enabled || state.suspended || categories.get(options.category) === false) return null
      let resolve, settled = false
      const finished = new Promise(r => { resolve = r })
      const row = { id, options, finished, reason: null, cancelCalls: 0,
        end(reason = 'ended') { if (!settled) { settled = true; row.reason = reason; resolve({ reason }) } },
        cancel() { row.cancelCalls++; row.end('cancelled') },
      }
      voices.push(row)
      return row
    },
    stopScope(scope) { stoppedScopes.push(scope); for (const row of voices) if (row.options.scope === scope) row.end('cancelled') },
    stop() { stops++; for (const row of voices) row.end('cancelled') },
    unlock() { unlocks++; update({ status: 'ready' }); return Promise.resolve(true) },
    getState: () => state,
    setEnabled: enabled => update({ enabled }),
    setVolume: volume => update({ volume }),
    setSuspended: suspended => update({ suspended }),
    setCategoryEnabled(category, value) { categories.set(category, value); if (!value) for (const voice of voices) if (voice.options.category === category) voice.end('cancelled') },
    play() { return true },
    dispose() { disposed++; player.stop() },
  }
  return { player, infos, loads, voices, stoppedScopes, categories, advance(seconds) { audioTime += seconds },
    bindState(fn) { onState = fn }, stops: () => stops, unlocks: () => unlocks, disposed: () => disposed }
}

function moveHarness(options = {}) {
  const fake = fakePlayer()
  let wallTime = 1000
  const controller = createMoveAudio({ player: fake.player, userAgent: CHROME, now: () => wallTime, ...options })
  const start = (run, patch = {}) => run.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: wallTime, ...patch })
  return { ...fake, controller, start, late(ms) { wallTime += ms } }
}

test('move SFX schedules only ten approved normal attack plans at the reviewed rate, boundaries and gain', () => {
  const h = moveHarness()
  for (const plan of Object.values(SFX_RUNTIME_CATALOG.moves)) {
    const run = h.controller.begin({ moveId: plan.fxId })
    h.start(run)
    const voice = h.voices.at(-1)
    assert.equal(voice.id, plan.assetId)
    assert.ok(voice.options.startSeconds === 0)
    assert.equal(voice.options.endSeconds, Math.floor(plan.reference.sampleFrames / plan.reference.sampleRate * 48000 + 1e-7) / 48000)
    assert.equal(voice.options.gainDb, 0)
    assert.equal(voice.options.category, 'sfx')
    assert.equal(voice.options.when, undefined)
    assert.equal(voice.options.playbackRate, undefined, 'player keeps rate one; host does not stretch')
    run.finish({ status: 'completed' })
  }
  assert.equal(h.voices.length, 10)
  h.controller.dispose()
})

test('missing caches, late callbacks and duplicate server events never start delayed or replayed sound', async () => {
  const h = moveHarness(), info = h.infos['source.tackle']
  delete h.infos['source.tackle']
  const missed = h.controller.begin({ moveId: 'tackle', key: 'match:1:move' })
  h.start(missed)
  assert.equal(h.controller.diagnostics().cacheMiss, 1)
  assert.equal(h.loads.length, 0, 'presentation never starts a fetch')
  h.infos['source.tackle'] = info
  h.start(missed)
  h.start(h.controller.begin({ moveId: 'tackle', key: 'match:1:move' }))
  assert.equal(h.voices.length, 0)
  const late = h.controller.begin({ moveId: 'tackle', key: 'match:2:move' })
  h.start(late, { observedAtMs: 899 })
  assert.equal(h.controller.diagnostics().droppedLate, 1)
  h.start(late)
  assert.equal(h.voices.length, 0)
  const fresh = h.controller.begin({ moveId: 'tackle', key: 'match:3:move' })
  h.start(fresh); h.start(fresh)
  assert.equal(h.voices.length, 1)
  h.voices[0].end()
  await tick()
  h.start(h.controller.begin({ moveId: 'tackle', key: 'match:3:move' }))
  assert.equal(h.voices.length, 1)
  h.controller.dispose()
})

test('native decoder family, major version, actual sample rate and actual frame count must match review evidence', () => {
  const plan = getMoveSoundPlan('tackle'), info = plan.nativeCompatibility
  assert.equal(nativeSoundCompatibility(plan, CHROME, info), true)
  assert.equal(nativeSoundCompatibility(plan, CHROME.replace('152.0.0.0', '152.5.9.1'), info), true)
  for (const ua of ['', 'Mozilla Firefox/152.0', CHROME.replace('Chrome', 'Chromium'), CHROME.replace('152.0.0.0', '153.0.0.0'), `${CHROME} Edg/152.0`, `${CHROME} OPR/152.0`]) {
    assert.equal(nativeSoundCompatibility(plan, ua, info), false, ua)
    const h = moveHarness({ userAgent: ua }); h.start(h.controller.begin({ moveId: 'tackle' })); assert.equal(h.voices.length, 0); h.controller.dispose()
  }
  for (const patch of [{ sampleRate: 44100 }, { sampleFrames: info.sampleFrames + 1 }, { sampleFrames: 0 }, { sampleFrames: NaN }]) {
    const h = moveHarness(); h.infos['source.tackle'] = { ...info, ...patch }
    h.start(h.controller.begin({ moveId: 'tackle' }))
    assert.equal(h.voices.length, 0)
    assert.equal(h.controller.diagnostics().unsupported, 1)
    h.controller.dispose()
  }
})

test('unapproved moves, phase, failure, immunity and reduced or instant presentation are silent', () => {
  const h = moveHarness()
  for (const options of [{ moveId: 'present' }, { moveId: 'mirror-move' }, { moveId: 'fly', phase: 'prepare' }, { outcome: 'miss' }, { outcome: 'fail' }, { outcome: 'immune' }, { mode: 'reduced' }, { mode: 'instant' }]) {
    const run = h.controller.begin({ moveId: 'tackle', ...options })
    h.start(run); run.finish({ status: 'completed' })
  }
  const reduced = h.controller.begin({ moveId: 'tackle' }); h.start(reduced, { reducedMotion: true })
  assert.equal(h.voices.length, 0)
  assert.equal(h.controller.diagnostics().activeRuns, 0)
  h.controller.dispose()
})

test('drift cancels only its owned run, completed clips retain natural tails, stale cancellation cannot affect replacement', async () => {
  const h = moveHarness(), old = h.controller.begin({ moveId: 'flamethrower' }), fresh = h.controller.begin({ moveId: 'tackle' })
  h.start(old); h.start(fresh)
  h.advance(.5)
  old.onPresentation({ type: 'frame', timelineSeconds: .1 })
  assert.equal(h.voices[0].reason, 'cancelled')
  assert.equal(h.voices[1].reason, null)
  old.cancel()
  assert.equal(h.voices[1].reason, null)
  fresh.onPresentation({ type: 'frame', timelineSeconds: .5 })
  fresh.finish({ status: 'completed' })
  assert.equal(h.voices[1].reason, null, 'visual completion does not cut the recording')
  h.voices[1].end()
  await tick()
  assert.equal(h.controller.diagnostics().activeRuns, 0)
  const failed = h.controller.begin({ moveId: 'tackle' }); h.start(failed); failed.finish({ status: 'failed' })
  assert.equal(h.voices.at(-1).reason, 'cancelled')
  h.controller.dispose()
})

function battleHarness({ saved = {}, sfxEnabled = true } = {}) {
  const fake = fakePlayer(), listeners = new Map(), stored = new Map(), doc = { hidden: false,
    addEventListener(key, fn) { listeners.set(key, fn) }, removeEventListener(key) { listeners.delete(key) } }
  let resolveAsset
  const audio = createBattleAudio({ document: doc, userAgent: CHROME, sfxEnabled,
    storage: { getItem: key => saved[key] ?? null, setItem(key, value) { stored.set(key, JSON.parse(value)) } },
    playerFactory({ onState, resolveAsset: resolve }) { fake.bindState(onState); resolveAsset = resolve; return fake.player },
  })
  const start = run => run?.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: performance.now() })
  return { ...fake, audio, doc, listeners, stored, start, resolve: id => resolveAsset(id) }
}
const member = (memberId, species, moves = []) => ({ memberId, species, moves, hp: { current: 100 }, fainted: false })
const view = (cursor = 1) => ({ matchId: 'battle-one', cursor,
  decision: { moves: [{ id: 'tackle' }, { id: 'protect' }] },
  own: { active: 'p1:1', team: [member('p1:1', 'Charizard', ['hyperbeam'])] },
  opponent: { active: 'p2:1', known: [member('p2:1', 'Venusaur', ['willowisp'])] },
})

test('V1 settings migrate without losing mute; V3 persists independent sound categories', async () => {
  const h = battleHarness({ saved: { 'battle-lab:audio:v1': JSON.stringify({ enabled: false, volume: .25 }) } })
  assert.equal(h.audio.getState().enabled, false)
  assert.equal(h.audio.getState().volume, .25)
  h.audio.setCriesEnabled(false)
  assert.equal(h.categories.get('cries'), false)
  assert.equal(h.categories.get('sfx'), true)
  assert.deepEqual(h.stored.get('battle-lab:audio:v3'), { schemaVersion: 3, enabled: false, volume: .25, criesEnabled: false, sfxEnabled: true,
    musicEnabled: true, musicVolume: .8, battleMusicMode: 'themed' })
  h.audio.setSfxEnabled(false)
  assert.equal(h.categories.get('sfx'), false)
  h.audio.setCriesEnabled(true)
  assert.equal(h.categories.get('cries'), true)
  assert.equal(h.categories.get('sfx'), false)
  h.audio.dispose()
  const restored = battleHarness({ saved: {
    'battle-lab:audio:v1': JSON.stringify({ enabled: true, volume: .8 }),
    'battle-lab:audio:v2': JSON.stringify({ schemaVersion: 2, enabled: false, volume: .25, criesEnabled: true, sfxEnabled: false }),
  } })
  assert.equal(restored.audio.getState().enabled, false)
  assert.equal(restored.audio.getState().volume, .25)
  assert.equal(restored.audio.getState().sfxEnabled, false)
  assert.equal(restored.categories.get('sfx'), false)
  restored.audio.dispose()
  await tick()
})

test('cry mute leaves active move sound intact; move mute stops only the move category without changing master mute', () => {
  const h = battleHarness(), batch = h.audio.begin(view()), run = batch.move({ moveId: 'flamethrower', cursor: 1 })
  h.start(run)
  assert.equal(h.voices.length, 1)
  const stopCount = h.stops()
  h.audio.setCriesEnabled(false)
  assert.equal(h.voices[0].reason, null)
  assert.equal(h.audio.getState().sfxEnabled, true)
  assert.equal(h.audio.getState().enabled, true)
  h.audio.setCriesEnabled(true)
  h.audio.setSfxEnabled(false)
  assert.equal(h.voices[0].reason, 'cancelled')
  assert.equal(h.stops(), stopCount, 'category control never stops all player audio')
  assert.equal(h.audio.getState().criesEnabled, true)
  assert.equal(h.audio.getState().enabled, true)
  h.audio.dispose()
})

test('warm-up is limited to current own choices and newly published moves, with no opponent move speculation', () => {
  const h = battleHarness(), v = view()
  h.audio.begin(v, [{ args: { opcode: 'move', fields: ['p2a: Venusaur', 'Fly', 'p1a: Charizard'] } }])
  const sfxLoads = h.loads.filter(row => row.options?.priority === 1)
  assert.deepEqual(sfxLoads.at(-1).ids, ['source.tackle', 'source.protect', 'source.fly'])
  assert.ok(!sfxLoads.some(row => row.ids.includes('source.hyper-beam') || row.ids.includes('source.will-o-wisp')))
  assert.equal(h.resolve('source.tackle').url.endsWith(`${SFX_RUNTIME_CATALOG.assets['source.tackle'].sha256}.mp3`), true)
  assert.equal(h.resolve('charizard').id, 'charizard')
  assert.equal(h.voices.length, 0)
  h.audio.dispose()
})

test('host kill switch, mute, background, supersession and reconnect prevent old playback and stop active tails', async () => {
  for (const action of ['kill-switch', 'mute', 'sfx-mute', 'hidden', 'supersede', 'sync', 'dispose']) {
    const h = battleHarness({ sfxEnabled: action !== 'kill-switch' }), first = h.audio.begin(view()), run = first.move({ moveId: 'tackle', cursor: 1 })
    h.start(run)
    if (action === 'kill-switch') assert.equal(h.voices.length, 0)
    else {
      assert.equal(h.voices.length, 1, action)
      run.finish({ status: 'completed' })
      if (action === 'mute') { h.audio.setEnabled(false); h.audio.setEnabled(true) }
      if (action === 'sfx-mute') { h.audio.setSfxEnabled(false); h.audio.setSfxEnabled(true) }
      if (action === 'hidden') { h.doc.hidden = true; h.listeners.get('visibilitychange')(); h.doc.hidden = false; h.listeners.get('visibilitychange')() }
      if (action === 'supersede') h.audio.begin(view(2))
      if (action === 'sync') h.audio.sync(view(2))
      if (action === 'dispose') h.audio.dispose()
      assert.equal(h.voices[0].reason, 'cancelled', action)
      h.start(run)
      assert.equal(h.voices.length, 1, action)
    }
    await tick()
    h.audio.dispose()
  }
})

test('host deduplicates published cursor events and old batch cancellation cannot stop a new batch', async () => {
  const h = battleHarness(), old = h.audio.begin(view()), oldRun = old.move({ moveId: 'tackle', cursor: 1 })
  h.start(oldRun); h.voices[0].end(); await tick()
  h.audio.sync(view(1))
  const repeat = h.audio.begin(view(1)); h.start(repeat.move({ moveId: 'tackle', cursor: 1 }))
  assert.equal(h.voices.length, 1)
  const fresh = h.audio.begin(view(2)); h.start(fresh.move({ moveId: 'tackle', cursor: 2 }))
  assert.equal(h.voices.length, 2)
  const stops = h.stops()
  old.cancel(); oldRun.cancel(); repeat.cancel()
  assert.equal(h.stops(), stops)
  assert.equal(h.voices[1].reason, null)
  h.audio.dispose()
})

test('preview replay supersedes the prior natural tail and ignores later cancellation from the old preview', () => {
  const h = battleHarness()
  const old = h.audio.previewMove({ moveId: 'will-o-wisp' })
  h.start(old)
  old.finish({ status: 'completed' })
  assert.equal(h.voices[0].reason, null, 'completed visual leaves the whole recording tail intact')
  const fresh = h.audio.previewMove({ moveId: 'will-o-wisp' })
  assert.equal(h.voices[0].reason, 'cancelled', 'new preview supersedes before its visual starts')
  h.start(fresh)
  assert.equal(h.voices.length, 2)
  old.cancel(); h.start(old)
  assert.equal(h.voices.length, 2)
  assert.equal(h.voices[1].reason, null, 'old cleanup cannot stop the replacement sound')
  h.audio.dispose()
})
