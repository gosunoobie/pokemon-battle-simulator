import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createBattleAudio } from '../apps/shared/battle/audio.js'
import { createSimulationPresenter } from '../apps/shared/battle/presentation.js'
import { getEventSoundPlan } from '@battle/battle-sfx/event-runtime'

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const event = (cursor, opcode, ...fields) => ({ cursor, type: 'protocol', args: { opcode, fields } })
const clone = value => structuredClone(value)

// Execute the actual component adapter with supplied collaborators. Parsing its
// script keeps these tests independent of a DOM, textures and Vue mount timing.
const { descriptor } = parse(await readFile(new URL('../apps/shared/battle/BattleView.vue', import.meta.url), 'utf8'))
const ast = compileScript(descriptor, { id: 'effectiveness-audio' }).scriptSetupAst
const wrapper = ast.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'playImpact')
const declaration = ast.flatMap(node => node.declarations ?? []).find(node => node.id.name === 'movePresenter')
assert.equal(declaration.init.arguments[0].properties.find(node => node.key.name === 'playImpact').value.name, 'playImpact')
const bindWrapper = new Function('props', 'audioScope', 'impactPlayer', `${descriptor.scriptSetup.content.slice(wrapper.start, wrapper.end)}; return playImpact`)

function batchFor({ seat = 'p1', actor = 'source', marker = '-supereffective', substitute = false } = {}) {
  const other = seat === 'p1' ? 'p2' : 'p1', own = `${seat}:1`, opponent = `${other}:revealed:1`
  const source = actor === 'source' ? own : opponent, target = actor === 'source' ? opponent : own
  const pokemon = (memberId, species, hpPrecision) => ({ memberId, species, name: species, active: true,
    hp: { current: 100, max: 100 }, hpPrecision, fainted: false, condition: null, stages: {}, volatiles: [], moves: [] })
  const before = { matchId: 'effectiveness-battle', seat, cursor: 10, turn: 1,
    own: { active: own, team: [pokemon(own, 'Charizard', 'exact')] },
    opponent: { active: opponent, known: [pokemon(opponent, 'Venusaur', 'public')] },
    weather: null, sideConditions: { p1: [], p2: [] }, fieldConditions: [], complete: true, result: null }
  const after = clone(before)
  if (!substitute) (actor === 'source' ? after.opponent.known[0] : after.own.team[0]).hp.current = 60
  const events = [event(11, 'move', source, 'Ice Beam', target), ...(marker ? [event(12, marker, target)] : []),
    substitute ? marker === '-supereffective' ? event(13, '-end', target, 'Substitute') : event(13, '-activate', target, 'Substitute', '[damage]')
      : event(13, '-damage', target, '60/100')]
  after.cursor = 13
  return { before, after, events }
}

function harness(batch, { automatic = false, inactive = false, throwingAudio = false } = {}) {
  const voices = [], loads = [], impacts = [], attacks = [], displays = [], categories = new Map()
  let resolveAsset, state = { enabled: true, volume: .6, status: 'ready' }
  const player = {
    readyInfo(id) {
      const reference = resolveAsset(id)?.reference
      return reference && { sampleRate: reference.sampleRate, sampleFrames: reference.sampleFrames }
    },
    preload(ids) { loads.push([...ids]); return Promise.resolve() },
    playSegment(id, options) {
      if (!state.enabled || categories.get(options.category) === false) return null
      const done = deferred(), voice = { id, options, reason: null, finished: done.promise,
        end(reason = 'ended') { if (voice.reason) return; voice.reason = reason; done.resolve({ reason }) },
        cancel() { voice.end('cancelled') } }
      voices.push(voice); return voice
    },
    stop() { voices.forEach(voice => voice.cancel()) },
    stopScope(scope) { voices.filter(voice => voice.options.scope === scope).forEach(voice => voice.cancel()) },
    setCategoryEnabled(category, enabled) { categories.set(category, enabled); if (!enabled) voices.filter(voice => voice.options.category === category).forEach(voice => voice.cancel()) },
    getState: () => state, contextTime: () => 10,
    setEnabled(enabled) { state = { ...state, enabled } }, setVolume() {}, setSuspended() {},
    unlock: () => Promise.resolve(true), play: () => true,
    dispose() { player.stop() },
  }
  const audio = createBattleAudio({ playerFactory: options => { resolveAsset = options.resolveAsset; return player },
    storage: null, document: null, userAgent: 'Mozilla/5.0 Firefox/145.0' })
  const scope = audio.begin(batch.after, batch.events)
  const props = { inactive }
  const adapterScope = throwingAudio ? { ...scope, impact() { throw new Error('Optional sound failed') } } : scope
  const playImpact = bindWrapper(props, adapterScope, { play(feedback, options) {
    impacts.push({ feedback, options, displayed: clone(displays.at(-1)) })
    return { finished: Promise.resolve({ status: 'completed' }), cancel() {} }
  } })
  const presenter = createSimulationPresenter({ getScene: () => ({}), ensureScene: async () => {},
    onDisplay: view => displays.push(clone(view)), onMove: request => !props.inactive ? scope.move(request) : null,
    onEntryCancel: () => scope.cancel(), playImpact,
    loadFx: async () => ({ play(request, options) {
      const done = deferred(), attack = { request, options, done, cancellations: 0 }
      attacks.push(attack)
      if (automatic) { options.onCue({ type: request.phase === 'prepare' ? 'prepared' : 'impact' }); done.resolve({ status: 'completed' }) }
      return { finished: done.promise, cancel() { attack.cancellations++; done.resolve({ status: 'cancelled' }) } }
    } }),
  })
  return { presenter, audio, scope, props, playImpact, voices, loads, impacts, attacks, displays,
    dispose() { presenter.destroy(); audio.dispose() } }
}

test('both viewer seats and attack directions play the exact effectiveness recording once at result reveal', async () => {
  for (const seat of ['p1', 'p2']) for (const actor of ['source', 'target']) for (const marker of ['-supereffective', '-resisted']) {
    const batch = batchFor({ seat, actor, marker }), saved = clone(batch), h = harness(batch)
    try {
      const pending = h.presenter.present(batch)
      await tick(); assert.equal(h.voices.length, 0, 'preloading and starting a move do not play its effectiveness sound')
      const attack = h.attacks[0]
      attack.options.onCue({ type: 'impact' }); attack.options.onCue({ type: 'impact' })
      assert.equal(h.impacts.length, 1); assert.equal(h.voices.length, 1)
      const kind = marker === '-supereffective' ? 'super-effective' : 'resisted'
      const plan = getEventSoundPlan(`battle.hit.${kind}`), voice = h.voices[0]
      assert.equal(voice.id, plan.assetId); assert.equal(voice.options.gainDb, plan.gainDb)
      assert.equal(voice.options.category, 'sfx'); assert.equal(voice.options.when, undefined)
      assert.equal(voice.options.startSeconds, undefined); assert.equal(voice.options.endSeconds, undefined, 'complete native recording plays')
      assert.equal(voice.options.playbackRate, undefined)
      assert.equal(h.impacts[0].feedback.actorId, actor === 'source' ? 'target' : 'source')
      assert.equal((actor === 'source' ? h.impacts[0].displayed.opponent.known[0] : h.impacts[0].displayed.own.team[0]).hp.current, 60)
      assert.ok(h.loads.flat().includes(plan.assetId), 'the event recording was warmed before impact')
      attack.done.resolve({ status: 'completed' })
      assert.deepEqual(await pending, { status: 'completed' })
      assert.equal(h.impacts[0].options.signal.aborted, true, 'normal presenter cleanup aborts its visual signal')
      assert.equal(voice.reason, null, 'normal completion still permits the natural sound tail')
      attack.options.onCue({ type: 'impact' }); h.scope.impact(h.impacts[0].feedback)
      assert.equal(h.voices.length, 1, 'stale cues and duplicate event keys cannot replay')
      assert.deepEqual(h.displays.at(-1), batch.after); assert.deepEqual(batch, saved)
    } finally { h.dispose() }
  }
})

test('confirmed Substitute effectiveness sounds without requiring or inventing target HP loss', async () => {
  for (const marker of ['-supereffective', '-resisted']) {
    const batch = batchFor({ marker, substitute: true }), h = harness(batch, { automatic: true })
    try {
      assert.deepEqual(await h.presenter.present(batch), { status: 'completed' })
      assert.equal(h.voices.length, 1)
      assert.equal(h.impacts[0].feedback.damageText, null)
      assert.deepEqual(h.displays.at(-1).opponent.known[0].hp, batch.before.opponent.known[0].hp)
    } finally { h.dispose() }
  }
})

test('neutral, missed, immune, failed, preparation, residual, effects-off and reconnect paths stay silent', async () => {
  for (const mode of ['neutral', 'miss', 'immune', 'fail', 'prepare', 'residual', 'off', 'reconnect']) {
    const batch = batchFor()
    if (mode === 'neutral') batch.events = batch.events.filter(row => row.args.opcode !== '-supereffective')
    if (['miss', 'immune', 'fail'].includes(mode)) {
      batch.events = [batch.events[0], event(12, `-${mode}`, batch.events[0].args.fields[2])]
      batch.after = clone(batch.before); batch.after.cursor = 12
    }
    if (mode === 'prepare') batch.events = [event(11, 'move', 'p1:1', 'Fly', 'p2:revealed:1'), event(12, '-prepare', 'p1:1', 'Fly')]
    if (mode === 'residual') batch.events = [event(13, '-damage', 'p2:revealed:1', '60/100', '[from] psn')]
    if (mode === 'reconnect') batch.before = null
    const h = harness(batch, { automatic: true })
    try {
      await h.presenter.present(batch, { effectsEnabled: mode !== 'off' })
      assert.equal(h.voices.length, 0, mode)
      assert.deepEqual(h.displays.at(-1), batch.after)
    } finally { h.dispose() }
  }
})

test('reduced motion keeps the event sound while inactive rooms, mute and optional audio failure preserve the visual result', async () => {
  for (const mode of ['reduced', 'inactive', 'muted', 'throw']) {
    const batch = batchFor(), h = harness(batch, { automatic: true, inactive: mode === 'inactive', throwingAudio: mode === 'throw' })
    try {
      if (mode === 'muted') h.audio.setSfxEnabled(false)
      assert.deepEqual(await h.presenter.present(batch, { reducedMotion: mode === 'reduced' }), { status: 'completed' })
      assert.equal(h.voices.length, mode === 'reduced' ? 1 : 0, mode)
      assert.equal(h.impacts.length, 1, 'sound availability cannot suppress the existing overlay')
      assert.deepEqual(h.displays.at(-1), batch.after)
    } finally { h.dispose() }
  }
})

test('skip, failure, reset and destroy cancel the impact voice and stale callbacks cannot revive it', async () => {
  for (const mode of ['skip', 'failure', 'reset', 'destroy']) {
    const batch = batchFor(), h = harness(batch)
    try {
      const pending = h.presenter.present(batch); await tick()
      const attack = h.attacks[0]
      attack.options.onCue({ type: 'impact' }); assert.equal(h.voices.length, 1)
      if (mode === 'failure') attack.done.resolve({ status: 'failed' })
      else if (mode === 'reset') h.presenter.reset(batch.after)
      else h.presenter[mode]()
      const result = await pending
      assert.equal(result.status, mode === 'skip' ? 'skipped' : mode === 'failure' ? 'failed' : 'cancelled')
      assert.equal(h.voices[0].reason, 'cancelled')
      attack.options.onCue({ type: 'impact' }); h.scope.impact(h.impacts[0].feedback)
      assert.equal(h.voices.length, 1)
    } finally { h.dispose() }
  }
})

test('already-aborted impact requests and a previous match scope cannot schedule event audio', () => {
  const batch = batchFor(), h = harness(batch)
  try {
    const feedback = { key: `${batch.after.matchId}:11:impact`, kind: 'super-effective', actorId: 'target', memberId: 'p2:revealed:1' }
    const controller = new AbortController(); controller.abort()
    h.playImpact(feedback, { signal: controller.signal })
    assert.equal(h.voices.length, 0)
    h.audio.sync({ ...batch.after, matchId: 'replacement-battle' })
    h.playImpact(feedback, {})
    assert.equal(h.voices.length, 0)
  } finally { h.dispose() }
})
