import test from 'node:test'
import assert from 'node:assert/strict'
import { createBattleAudio } from '../apps/shared/battle/audio.js'
import { createPreviewAudio } from '../apps/game/src/presentation/audio.js'
import { getEventRuntimeSoundAsset, getEventSoundPlan } from '@battle/battle-sfx/event-runtime'

const ids = { pokeball: 'battle.release.pokeball', faint: 'battle.faint' }
const tick = () => new Promise(resolve => setImmediate(resolve))
function view(seat = 'p1', cursor = 1) {
  const other = seat === 'p1' ? 'p2' : 'p1'
  const member = (memberId, species) => ({ memberId, species, hp: { current: 100 }, fainted: false })
  return { matchId: 'transition-test', seat, cursor,
    own: { active: `${seat}:1`, team: [member(`${seat}:1`, 'Charizard')] },
    opponent: { active: `${other}:revealed:1`, known: [member(`${other}:revealed:1`, 'Venusaur')] } }
}
function memberOf(v, actorId) { return actorId === 'source' ? v.own.team[0] : v.opponent.known[0] }
function cue(v, type, actorId = 'source') { return { type, actorId, memberId: memberOf(v, actorId).memberId } }
function fainted(v, actorId = 'source') {
  const next = structuredClone(v), member = memberOf(next, actorId)
  member.fainted = true; member.hp.current = 0
  ;(actorId === 'source' ? next.own : next.opponent).active = null
  return next
}
function harness({ sampleRate = 48000, factory = createBattleAudio, ...options } = {}) {
  const voices = [], loads = [], cries = [], resolved = [], infos = new Map(), listeners = new Map()
  const doc = { hidden: false, addEventListener: (event, fn) => listeners.set(event, fn), removeEventListener: event => listeners.delete(event) }
  for (const eventId of Object.values(ids)) {
    const { assetId } = getEventSoundPlan(eventId), reference = getEventRuntimeSoundAsset(assetId).reference
    infos.set(assetId, { sampleRate, sampleFrames: Math.round(reference.sampleFrames / reference.sampleRate * sampleRate) })
  }
  let state = { enabled: true, status: 'ready', volume: .6 }, notify = () => {}
  const update = patch => { state = { ...state, ...patch }; notify(state) }
  const player = {
    preload(ids) { loads.push(ids); return Promise.resolve() }, readyInfo: id => infos.get(id),
    play(id) { cries.push(id); return true },
    playSegment(id, options) {
      let resolve
      const voice = { id, options, reason: null, finished: new Promise(done => { resolve = done }),
        end() { if (!voice.reason) { voice.reason = 'ended'; resolve({ reason: 'ended' }) } },
        cancel() { if (!voice.reason) { voice.reason = 'cancelled'; resolve({ reason: 'cancelled' }) } } }
      voices.push(voice); return voice
    },
    stop() { voices.forEach(voice => voice.cancel()) }, stopScope() {},
    setCategoryEnabled(category, enabled) { if (!enabled) voices.filter(voice => voice.options.category === category).forEach(voice => voice.cancel()) },
    getState: () => state, setEnabled: enabled => update({ enabled }), setVolume: volume => update({ volume }),
    setSuspended: suspended => update({ suspended }), unlock: () => Promise.resolve(true), dispose() { player.stop() },
  }
  const audio = factory({ document: doc, storage: null, userAgent: 'Version/18.6 Safari/605.1.15',
    playerFactory(config) {
      notify = config.onState
      for (const id of infos.keys()) resolved.push(config.resolveAsset(id))
      return player
    }, ...options })
  return { audio, player, doc, infos, voices, loads, cries, resolved,
    hide() { doc.hidden = true; listeners.get('visibilitychange')() } }
}

test('Poké Ball and faint cues use original whole recordings at native speed for either seat, side and sample rate', () => {
  for (const seat of ['p1', 'p2']) for (const actorId of ['source', 'target']) for (const sampleRate of [44100, 48000]) {
    const h = harness({ sampleRate }), v = view(seat), scope = h.audio.begin(v)
    assert.equal(h.voices.length, 0, 'warming never starts sound')
    assert.ok(h.loads.some(ids => ids.includes('source.in-battle-recall-switch-pokeball') && ids.includes('source.in-battle-faint-no-health')))
    assert.ok(h.resolved.every(asset => asset.url === `/audio/sfx/${asset.sha256}.mp3`))
    for (const type of ['pokeball', 'faint']) {
      const input = type === 'faint' ? fainted(v, actorId) : v
      const voice = scope.transition(input, cue(input, type, actorId))
      assert.equal(voice.id, getEventSoundPlan(ids[type]).assetId)
      assert.equal(voice.options.category, 'sfx'); assert.equal(voice.options.gainDb, 0)
      for (const field of ['when', 'startSeconds', 'endSeconds', 'playbackRate', 'signal']) assert.equal(voice.options[field], undefined)
    }
    assert.equal(h.cries.length, 0, 'ball activation is separate from the Pokémon reveal cry')
    scope.entry(v, actorId); assert.equal(h.cries.length, 1)
    h.audio.dispose()
  }
})

test('faint cues identify the retained outgoing member after active clears and never target a replacement or living member', () => {
  const h = harness(), v = view(), scope = h.audio.begin(v), out = fainted(v)
  for (const [input, event] of [
    [v, cue(v, 'faint')], [out, { type: 'faint', actorId: 'source' }],
    [out, { ...cue(out, 'faint'), memberId: 'missing' }], [out, cue(out, 'pokeball')],
    [{ ...v, matchId: 'different' }, cue(v, 'pokeball')], [v, { ...cue(v, 'pokeball'), actorId: 'invalid' }],
    [v, { ...cue(v, 'pokeball'), type: '__proto__' }],
    [{ ...out, own: { ...out.own, active: 'p1:2' } }, cue(out, 'faint')],
  ]) assert.equal(scope.transition(input, event), null)
  assert.equal(h.voices.length, 0)
  assert.ok(scope.transition(out, cue(out, 'faint')))
  assert.equal(h.voices.length, 1); h.audio.dispose()
})

test('transition events deduplicate reconnects and cache misses but allow a later genuine send-out', () => {
  const h = harness(), v = view(), scope = h.audio.begin(v), event = cue(v, 'pokeball')
  scope.transition(v, event); scope.transition(v, event)
  assert.equal(h.voices.length, 1)
  h.audio.sync(v)
  const replay = h.audio.begin(v); replay.transition(v, event)
  assert.equal(h.voices.length, 1)
  const next = { ...v, cursor: 2 }, assetId = getEventSoundPlan(ids.pokeball).assetId, info = h.infos.get(assetId)
  h.infos.delete(assetId); replay.transition(next, event)
  h.infos.set(assetId, info); replay.transition(next, event)
  assert.equal(h.voices.length, 1, 'late decoding does not replay a missed opening')
  replay.transition({ ...v, cursor: 3 }, event)
  assert.equal(h.voices.length, 2); h.audio.dispose()
})

test('mute, effects mute, skip, background, reset and disposal cancel transition tails without letting old scopes restart', async () => {
  for (const action of ['mute', 'effects', 'skip', 'hide', 'sync', 'new-batch', 'dispose']) {
    const h = harness(), v = view(), scope = h.audio.begin(v)
    h.audio.setCriesEnabled(false)
    const voice = scope.transition(v, cue(v, 'pokeball'))
    assert.ok(voice, 'the cries toggle does not mute battle effects')
    const actions = { mute: () => h.audio.setEnabled(false), effects: () => h.audio.setSfxEnabled(false), skip: () => scope.cancel(),
      hide: h.hide, sync: () => h.audio.sync(v), 'new-batch': () => h.audio.begin({ ...v, cursor: 2 }), dispose: () => h.audio.dispose() }
    actions[action](); assert.equal(voice.reason, 'cancelled', action)
    scope.transition(fainted(v), cue(v, 'faint'))
    assert.equal(h.voices.length, 1)
    h.audio.dispose()
  }
  const h = harness(), v = view(), old = h.audio.begin(v)
  const completed = old.transition(v, cue(v, 'pokeball')); completed.end(); await tick()
  const fresh = h.audio.begin({ ...v, cursor: 2 }), voice = fresh.transition({ ...v, cursor: 2 }, cue(v, 'pokeball'))
  old.cancel(); assert.equal(voice.reason, null)
  assert.equal(completed.reason, 'ended'); h.audio.dispose()
})

test('transition recordings stay silent for invalid decode data, disabled SFX and the move preview', async () => {
  for (const options of [{ sfxEnabled: false }, { factory: createPreviewAudio }, { transitionSounds: false }]) {
    const h = harness(options), v = view(), scope = h.audio.begin(v)
    assert.equal(scope.transition(v, cue(v, 'pokeball')), null)
    assert.equal(h.voices.length, 0); h.audio.dispose()
  }
  for (const info of [{ sampleRate: 0, sampleFrames: 1 }, { sampleRate: 48000, sampleFrames: 96000 }, { sampleRate: 48000, sampleFrames: 1.5 }]) {
    const h = harness(), v = view()
    h.infos.set(getEventSoundPlan(ids.pokeball).assetId, info)
    h.player.preload = () => Promise.reject(new Error('offline'))
    assert.equal(h.audio.begin(v).transition(v, cue(v, 'pokeball')), null)
    await tick(); h.audio.dispose()
  }
})
