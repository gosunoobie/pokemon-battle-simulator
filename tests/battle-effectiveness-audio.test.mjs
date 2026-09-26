import test from 'node:test'
import assert from 'node:assert/strict'
import { createImpactAudio } from '../apps/shared/battle/impactAudio.js'
import { createBattleAudio, BATTLE_IMPACT_VOLUME } from '../apps/shared/battle/audio.js'
import { createSimulationAudio } from '../apps/simulation/src/audio.js'
import { EVENT_SFX_RUNTIME_CATALOG } from '@battle/battle-sfx/event-runtime'

const tick = () => new Promise(resolve => setImmediate(resolve))
const strong = 'source.hit-super-effective', weak = 'source.hit-weak-not-very-effective'
function harness({ sampleRate = 48000, createAudio = createBattleAudio, ...options } = {}) {
  const loads = [], voices = [], listeners = new Map(), resolved = []
  const infos = Object.fromEntries(Object.values(EVENT_SFX_RUNTIME_CATALOG.assets).map(asset => [asset.id,
    { sampleRate, sampleFrames: Math.round(asset.reference.sampleFrames / asset.reference.sampleRate * sampleRate) }]))
  let state = { enabled: true, volume: .6, suspended: false, status: 'ready' }, notify = () => {}
  const doc = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) }
  const update = patch => { state = { ...state, ...patch }; notify(state) }
  const player = {
    preload(ids) { loads.push(ids); return Promise.resolve() }, readyInfo: id => infos[id],
    getState: () => state, setEnabled: enabled => update({ enabled }), setVolume: volume => update({ volume }),
    setSuspended: suspended => update({ suspended }), unlock: () => Promise.resolve(true),
    setCategoryEnabled(category, enabled) { if (!enabled) voices.filter(v => v.options.category === category).forEach(v => v.cancel()) },
    playSegment(id, options) {
      if (!state.enabled || state.suspended) return null
      let resolve
      const voice = { id, options, reason: null, finished: new Promise(done => { resolve = done }),
        end() { if (!voice.reason) { voice.reason = 'ended'; resolve({ reason: 'ended' }) } },
        cancel() { if (!voice.reason) { voice.reason = 'cancelled'; resolve({ reason: 'cancelled' }) } } }
      voices.push(voice); return voice
    },
    stopScope(scope) { voices.filter(v => v.options.scope === scope).forEach(v => v.cancel()) },
    stop() { voices.forEach(v => v.cancel()) }, dispose() { player.stop() },
  }
  const audio = createAudio({ storage: null, document: doc, userAgent: 'Firefox/153.0',
    playerFactory(configuration) { notify = configuration.onState; for (const id of [strong, weak]) resolved.push(configuration.resolveAsset(id)); return player }, ...options })
  return { audio, player, doc, loads, voices, infos, resolved, hide() { doc.hidden = true; listeners.get('visibilitychange')() } }
}
const view = { matchId: 'effectiveness', cursor: 20, own: { team: [] }, opponent: { known: [] } }
const feedback = (kind, n = 1) => ({ key: `effectiveness:${n}:impact`, kind, actorId: 'target', memberId: 'p2:revealed:1' })

test('both effectiveness recordings preload independently and play whole native buffers at the event cue on either sample rate', () => {
  for (const sampleRate of [44100, 48000]) {
    const h = harness({ sampleRate }), scope = h.audio.begin(view)
    assert.ok(h.loads.some(ids => ids.includes(strong) && ids.includes(weak)))
    assert.equal(h.voices.length, 0)
    assert.ok(h.resolved.every(asset => asset.url === `/audio/sfx/${asset.sha256}.mp3`))
    assert.equal(h.audio.getState().sfxAvailable, true, 'whole event recordings are available independently of reviewed move decoders')
    for (const [index, kind] of ['super-effective', 'resisted'].entries()) {
      const voice = scope.impact(feedback(kind, index + 1))
      assert.equal(voice, h.voices[index]); assert.equal(voice.id, index ? weak : strong)
      assert.equal(voice.options.gainDb, -6); assert.equal(voice.options.category, 'sfx')
      for (const field of ['when', 'startSeconds', 'endSeconds', 'playbackRate', 'signal']) assert.equal(voice.options[field], undefined)
    }
    h.audio.dispose()
  }
})

test('both battle effectiveness cues gain 25% total including the 10% SFX bus increase', () => {
  for (const options of [{ createAudio: createSimulationAudio }, { impactVolume: BATTLE_IMPACT_VOLUME }]) {
    const h = harness(options), scope = h.audio.begin(view)
    for (const [index, kind] of ['super-effective', 'resisted'].entries()) {
      const voice = scope.impact(feedback(kind, index + 1))
      const voiceRatio = 10 ** ((voice.options.gainDb - (-6)) / 20)
      assert.ok(Math.abs(voiceRatio * 1.1 - 1.25) < 1e-12)
    }
    h.audio.dispose()
  }
})

test('invalid event multipliers preserve the authored gain', () => {
  for (const gainMultiplier of [NaN, Infinity, -1, 0, 3, '1.25']) {
    const h = harness(), controller = createImpactAudio({ player: h.player, gainMultiplier })
    assert.equal(controller.play(feedback('resisted')).options.gainDb, -6)
    controller.dispose(); h.audio.dispose()
  }
})

test('neutral, immune, wrong-match, aborted and duplicate feedback stays silent with no delayed cache retry', () => {
  const h = harness(), scope = h.audio.begin(view), controller = new AbortController()
  controller.abort()
  for (const kind of ['normal', 'immune', 'miss', 'failed', undefined, '__proto__']) scope.impact(feedback(kind))
  scope.impact({ ...feedback('resisted'), key: 'other:1:impact' })
  scope.impact(feedback('resisted'), { signal: controller.signal })
  assert.equal(h.voices.length, 0)
  const saved = h.infos[strong]; delete h.infos[strong]
  scope.impact(feedback('super-effective'))
  h.infos[strong] = saved; scope.impact(feedback('super-effective'))
  assert.equal(h.voices.length, 0)
  scope.impact(feedback('super-effective', 2)); scope.impact(feedback('super-effective', 2))
  assert.equal(h.voices.length, 1)
  h.audio.sync(view); const replay = h.audio.begin(view); replay.impact(feedback('super-effective', 2))
  assert.equal(h.voices.length, 1); h.audio.dispose()
})

test('normal rendering completion retains event tails, while mute, skip, hide, reset and supersession stop them', () => {
  for (const action of ['scope', 'mute', 'sfx', 'hide', 'sync', 'supersede', 'dispose']) {
    const h = harness(), scope = h.audio.begin(view), signal = new AbortController()
    scope.impact(feedback('super-effective'), { signal: signal.signal }); signal.abort()
    assert.equal(h.voices[0].reason, null, 'normal presenter abort does not cut a natural audio tail')
    const actions = { scope: () => scope.cancel(), mute: () => h.audio.setEnabled(false), sfx: () => h.audio.setSfxEnabled(false),
      hide: h.hide, sync: () => h.audio.sync(view), supersede: () => h.audio.begin(view), dispose: () => h.audio.dispose() }
    actions[action](); assert.equal(h.voices[0].reason, 'cancelled', action)
    scope.impact(feedback('resisted', 2)); assert.equal(h.voices.length, 1, 'stale or muted callbacks cannot restart')
    h.audio.dispose()
  }
})

test('preview feedback is once per successful logical impact and older runs cannot affect a new preview', () => {
  const h = harness(), first = h.audio.previewMove({ moveId: 'flamethrower', effectiveness: 'super-effective' })
  first.onImpact(); first.onImpact(); assert.equal(h.voices.length, 1)
  first.finish({ status: 'completed' }); assert.equal(h.voices[0].reason, null)
  const next = h.audio.previewMove({ moveId: 'fire-blast', effectiveness: 'super-effective' })
  first.onImpact(); next.onImpact(); first.cancel()
  assert.equal(h.voices.length, 2); assert.equal(h.voices[1].reason, null)
  next.cancel(); assert.equal(h.voices[1].reason, 'cancelled')
  for (const request of [{ effectiveness: null }, { phase: 'prepare', effectiveness: 'super-effective' }, { outcome: 'failed', effectiveness: 'super-effective' }]) {
    const run = h.audio.previewMove({ moveId: 'tackle', ...request }); run.onImpact(); run.finish({ status: 'completed' })
  }
  assert.equal(h.voices.length, 2)
  const stale = h.audio.previewMove({ effectiveness: 'super-effective' })
  h.audio.previewMove({}); stale.onImpact(); assert.equal(h.voices.length, 2)
  h.audio.dispose()
})

test('event audio fails quietly for missing, malformed or incompatible decoded buffers and preload errors', async () => {
  for (const patch of [undefined, { sampleRate: 0, sampleFrames: 20 }, { sampleRate: 48000, sampleFrames: 1 }, { sampleRate: 48000, sampleFrames: 1.5 }]) {
    const h = harness(); h.infos[strong] = patch
    h.player.preload = () => Promise.reject(new Error('offline'))
    const scope = h.audio.begin(view); assert.equal(scope.impact(feedback('super-effective')), null)
    assert.equal(h.voices.length, 0); await tick(); h.audio.dispose()
  }
  const h = harness({ sfxEnabled: false }); h.audio.begin(view).impact(feedback('resisted'))
  assert.equal(h.voices.length, 0); assert.equal(h.audio.getState().sfxAvailable, false); h.audio.dispose()
})

test('completed event voices are released and subsequent stop cannot cancel a different category', async () => {
  const h = harness(), controller = createImpactAudio({ player: h.player })
  const voice = controller.play(feedback('resisted')); voice.end(); await tick()
  const cry = h.player.playSegment('cry', { category: 'cries' })
  controller.stop(); assert.equal(voice.reason, 'ended'); assert.equal(cry.reason, null)
  controller.dispose(); h.audio.dispose()
})
