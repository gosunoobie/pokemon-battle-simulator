import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlaygroundAudio, getPlaygroundSoundInfo } from '../apps/fx-playground/src/audio.js'
import { ACCEPTED_SFX_RUNTIME_CATALOG, getAcceptedFxSoundPlan } from '@battle/battle-sfx/accepted-runtime'
import { SFX_RUNTIME_CATALOG, getFxSoundPlan } from '@battle/battle-sfx/runtime'
import { DRAFT_SFX_RUNTIME_CATALOG, getDraftFxSoundPlan } from '@battle/battle-sfx/draft-runtime'
import { EVENT_SFX_RUNTIME_CATALOG } from '@battle/battle-sfx/event-runtime'
import { getPokemonCry } from '@battle/pokemon-cries'

const FIREFOX = 'Mozilla/5.0 Firefox/145.0'
const CHROME = 'Mozilla/5.0 Chrome/152.0.0.0 Safari/537.36'
const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const start = run => run.onPresentation({ type: 'start', timelineSeconds: 0, observedAtMs: performance.now() })

function harness({ userAgent = FIREFOX } = {}) {
  const infos = {}, loads = [], voices = [], categories = new Map(), events = new Map()
  for (const plan of Object.values(DRAFT_SFX_RUNTIME_CATALOG.moves)) infos[plan.assetId] = plan.reference
  for (const plan of Object.values(SFX_RUNTIME_CATALOG.moves)) infos[plan.assetId] = plan.nativeCompatibility
  for (const plan of Object.values(ACCEPTED_SFX_RUNTIME_CATALOG.moves)) {
    infos[plan.assetId] = plan.nativeCompatibility
    if (plan.accent) infos[plan.accent.assetId] = plan.accent.nativeCompatibility
  }
  for (const asset of Object.values(EVENT_SFX_RUNTIME_CATALOG.assets)) infos[asset.id] = asset.reference
  for (const id of ['charizard', 'venusaur', 'deoxysattack']) infos[id] = getPokemonCry(id)
  let state = { enabled: true, volume: .6, status: 'locked', suspended: false, loadError: null }, onState, resolveAsset, factoryOptions
  const update = patch => { state = { ...state, ...patch }; onState(state) }
  const player = {
    getState: () => state,
    readyInfo: id => infos[id] ?? null,
    contextTime: () => 10,
    preload(ids, options) { loads.push({ ids, options }); return Promise.resolve(ids.map(id => Boolean(infos[id]))) },
    playSegment(id, options) {
      if (!state.enabled || state.suspended || categories.get(options.category) === false || !infos[id]) return null
      const done = deferred()
      const voice = { id, options, reason: null, finished: done.promise,
        end(reason = 'ended') { if (voice.reason) return; voice.reason = reason; done.resolve({ reason }) },
        cancel() { voice.end('cancelled') },
      }
      voices.push(voice); return voice
    },
    play(id) { return Boolean(player.playSegment(id, { category: 'cries' })) },
    stopScope(scope) { voices.filter(voice => voice.options.scope === scope).forEach(voice => voice.cancel()) },
    stop() { voices.forEach(voice => voice.cancel()) },
    unlock() { update({ status: 'ready' }); return Promise.resolve(true) },
    setEnabled(enabled) { update({ enabled }) },
    setVolume(volume) { if (Number.isFinite(volume)) update({ volume: Math.max(0, Math.min(1, volume)) }) },
    setSuspended(suspended) { update({ suspended }) },
    setCategoryEnabled(category, enabled) { categories.set(category, enabled) },
    dispose() { player.stop(); update({ status: 'unavailable' }) },
  }
  const doc = { hidden: false, addEventListener(name, listener) { events.set(name, listener) }, removeEventListener(name) { events.delete(name) } }
  const audio = createPlaygroundAudio({ userAgent, document: doc, playerFactory(options) {
    factoryOptions = options; onState = options.onState; resolveAsset = options.resolveAsset; return player
  } })
  return { audio, player, infos, loads, voices, categories, events, factoryOptions, resolveAsset,
    hide() { doc.hidden = true; events.get('visibilitychange')?.() },
    show() { doc.hidden = false; events.get('visibilitychange')?.() },
  }
}

test('playground selects reviewed sounds before pilot and draft versions and reports unsupported pilot decoders', () => {
  const h = harness()
  assert.deepEqual(h.audio.describeMove('hydro-pump'), { label: 'Reviewed sound', kind: 'accepted', available: true })
  assert.deepEqual(h.audio.describeMove('aeroblast'), { label: 'Draft sound', kind: 'draft', available: true })
  assert.equal(h.audio.describeMove('tackle').kind, 'legacy')
  assert.equal(h.audio.describeMove('tackle').available, false)
  assert.equal(getPlaygroundSoundInfo('tackle', { userAgent: CHROME }).available, true)
  assert.deepEqual(h.audio.describeMove('unknown-move'), { label: 'No move recording', kind: 'none', available: false })
  assert.equal(h.resolveAsset('source.hydro-pump').url.startsWith('/audio/sfx/'), true)
  assert.equal(h.resolveAsset('charizard').url.startsWith('/audio/cries/'), true)
  assert.equal(h.resolveAsset('unknown-recording'), null)
  h.audio.dispose()
})

test('reviewed move regions and accent layers retain native rate, authored gains and accepted synchronization', async () => {
  for (const moveId of ['hydro-pump', 'psychic', 'earthquake']) {
    const h = harness(), plan = getAcceptedFxSoundPlan(moveId)
    h.audio.warmMoves([moveId])
    assert.equal(h.voices.length, 0, 'warming never plays audio')
    const run = h.audio.begin({ moveId }); await run.ready; start(run)
    const layers = [plan, ...(plan.accent ? [{ ...plan, assetId: plan.accent.assetId, segments: [plan.accent.segment], nativeCompatibility: plan.accent.nativeCompatibility }] : [])]
    const expected = layers.flatMap(layer => layer.segments.map(segment => ({ layer, segment })))
    assert.equal(h.voices.length, expected.length)
    for (const [index, { layer, segment }] of expected.entries()) {
      const voice = h.voices[index], delay = segment.cueSeconds / plan.visualRate - (segment.soundAnchorSeconds - segment.startSeconds)
      assert.equal(voice.id, layer.assetId)
      assert.equal(voice.options.startSeconds, segment.startSeconds)
      assert.equal(voice.options.endSeconds, segment.endSeconds ?? layer.nativeCompatibility.sampleFrames / layer.nativeCompatibility.sampleRate)
      assert.equal(voice.options.gainDb, segment.gainDb)
      assert.equal(voice.options.when, delay > 0 ? 10 + delay : undefined)
      assert.equal(voice.options.playbackRate, undefined)
    }
    run.finish({ status: 'completed' })
    assert.ok(h.voices.every(voice => voice.reason === null), 'natural recording tails survive visual completion')
    h.audio.stop(); assert.ok(h.voices.every(voice => voice.reason === 'cancelled'))
    h.audio.dispose()
  }
})

test('draft sounds play their whole native recording, while pilot sounds retain their decoder guard', () => {
  const draft = getDraftFxSoundPlan('aeroblast')
  for (const userAgent of [CHROME, FIREFOX]) {
    const h = harness({ userAgent })
    const sampleRate = 48000, sampleFrames = Math.round(draft.reference.sampleFrames / draft.reference.sampleRate * sampleRate)
    h.infos[draft.assetId] = { sampleRate, sampleFrames }
    start(h.audio.begin({ moveId: 'aeroblast' }))
    assert.equal(h.voices.length, 1)
    assert.equal(h.voices[0].options.startSeconds, 0)
    assert.equal(h.voices[0].options.endSeconds, sampleFrames / sampleRate)
    assert.equal(h.voices[0].options.gainDb, draft.segments[0].gainDb)
    assert.equal(h.voices[0].options.playbackRate, undefined)
    start(h.audio.begin({ moveId: 'tackle' }))
    assert.equal(h.voices.length, userAgent === CHROME ? 2 : 1)
    if (userAgent === CHROME) assert.equal(h.voices[1].id, getFxSoundPlan('tackle').assetId)
    h.audio.dispose()
  }
})

test('feedback is explicit, once per impact, absent during preparation, and never retries a late recording', () => {
  const h = harness()
  for (const effectiveness of [null, 'normal', 'immune', 'unknown', '__proto__']) {
    h.audio.begin({ moveId: 'unknown', effectiveness }).onImpact()
  }
  h.audio.begin({ moveId: 'fly', phase: 'prepare', effectiveness: 'super-effective' }).onImpact()
  assert.equal(h.voices.length, 0)
  for (const effectiveness of ['super-effective', 'resisted']) {
    const run = h.audio.begin({ effectiveness }); run.onImpact(); run.onImpact()
    assert.equal(h.voices.at(-1).options.gainDb, -6)
    assert.equal(h.voices.at(-1).options.category, 'sfx')
  }
  assert.equal(h.voices.length, 2)
  const id = EVENT_SFX_RUNTIME_CATALOG.events['battle.hit.super-effective'].assetId
  const info = h.infos[id]; delete h.infos[id]
  const run = h.audio.begin({ effectiveness: 'super-effective' }); run.onImpact()
  h.infos[id] = info; run.onImpact()
  assert.equal(h.voices.length, 2)
  h.audio.dispose()
})

test('reduced presentation and preparation remain silent for move recordings', () => {
  const h = harness()
  for (const options of [{ phase: 'prepare' }, { mode: 'reduced' }]) start(h.audio.begin({ moveId: 'hydro-pump', ...options }))
  assert.equal(h.voices.length, 0)
  const reduced = h.audio.begin({ moveId: 'hydro-pump', mode: 'reduced', effectiveness: 'resisted' })
  reduced.onImpact(); assert.equal(h.voices.length, 1, 'optional feedback does not require full motion')
  h.audio.dispose()
})

test('mute, stop, hide, replacement, failure and disposal cancel owned voices and stale callbacks', async () => {
  for (const action of ['mute', 'sfx', 'stop', 'hide', 'replace', 'failure', 'dispose']) {
    const h = harness(), first = h.audio.begin({ moveId: 'hydro-pump', effectiveness: 'super-effective' })
    start(first); first.onImpact(); assert.equal(h.voices.length, 2)
    const actions = { mute: () => h.audio.setEnabled(false), sfx: () => h.audio.setSfxEnabled(false), stop: h.audio.stop,
      hide: h.hide, replace: () => h.audio.begin({ moveId: 'aeroblast' }), failure: () => first.finish({ status: 'failed' }), dispose: h.audio.dispose }
    actions[action]()
    assert.ok(h.voices.every(voice => voice.reason === 'cancelled'), action)
    h.audio.setEnabled(true); h.audio.setSfxEnabled(true); h.show(); await tick()
    start(first); first.onImpact()
    assert.equal(h.voices.length, 2, `${action} cannot resume a stale callback`)
    h.audio.dispose(); assert.equal(h.events.size, 0)
  }
})

test('cry auditions stay local, support form identities, and cannot play after pending work is cancelled', async () => {
  const h = harness()
  assert.equal(await h.audio.previewCry('charizard'), true)
  assert.equal(h.voices[0].options.category, 'cries')
  assert.equal(await h.audio.previewCry('unknown-shape'), false)
  h.audio.setSfxEnabled(false)
  assert.equal(await h.audio.previewCry('venusaur'), true, 'cry audition is independent of move sound toggle')
  assert.equal(h.voices[0].reason, 'cancelled')
  assert.equal(await h.audio.previewCry('deoxysattack'), true)
  assert.equal(h.voices.at(-1).id, 'deoxysattack', 'form IDs resolve without fallback guessing')
  h.audio.dispose()
  for (const action of ['stop', 'mute', 'hide', 'new-move', 'dispose']) {
    const pending = harness(), gate = deferred()
    pending.player.preload = () => gate.promise
    const audition = pending.audio.previewCry('charizard'); await tick()
    const actions = { stop: pending.audio.stop, mute: () => pending.audio.setEnabled(false), hide: pending.hide,
      'new-move': () => pending.audio.begin({ moveId: 'hydro-pump' }), dispose: pending.audio.dispose }
    actions[action](); gate.resolve([true])
    assert.equal(await audition, false, action); assert.equal(pending.voices.length, 0)
    pending.audio.dispose()
  }
})

test('playground controls and subscriptions do not share another audio instance or player preferences', async () => {
  const first = harness(), second = harness(), changes = []
  const unsubscribe = first.audio.subscribe(state => changes.push(state))
  assert.equal(first.audio.getState().enabled, true); assert.equal(first.audio.getState().volume, .6)
  first.audio.setVolume(.2); first.audio.setEnabled(false); first.audio.setSfxEnabled(false)
  assert.equal(first.audio.getState().volume, .2); assert.equal(first.audio.getState().sfxEnabled, false)
  assert.equal(second.audio.getState().volume, .6); assert.equal(second.audio.getState().enabled, true)
  assert.equal(second.audio.getState().sfxEnabled, true); assert.equal(first.factoryOptions.session, undefined)
  assert.equal(await first.audio.unlock(), false)
  unsubscribe(); const count = changes.length; first.audio.setVolume(.8)
  assert.equal(changes.length, count)
  first.audio.dispose(); second.audio.dispose()
})
