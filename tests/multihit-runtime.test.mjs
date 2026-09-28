import test from 'node:test'
import assert from 'node:assert/strict'
import { Graphics, Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createBattleFx } from '@battle/battle-fx'
import { createClockedBattleFx } from '@battle/battle-fx/presentation-clock'
import { MULTI_HIT_LIMITS } from '../packages/battle-fx/src/multi-hit.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createSimulationPresenter } from '../apps/shared/battle/presentation.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const request = { moveId: 'bullet-seed', hitCount: 3, sourceId: 'source', targetIds: ['target'], visualSeed: 42 }
function harness({ clocked = false, effects, deadlineMs } = {}) {
  const timelines = []
  const scene = createSceneGraph({ actors: [
    { id: 'source', profile: 'wide', x: .26, y: .82, height: .28, facing: 1 },
    { id: 'target', profile: 'tall', x: .74, y: .62, height: .22, facing: -1 },
  ] })
  const create = clocked ? createClockedBattleFx : createBattleFx
  const fx = create({ glowTexture: Texture.WHITE, ...(effects ? { effects } : {}), ...(deadlineMs ? { deadlineMs } : {}), now: () => 1234,
    timelineEngine: { timeline(options) {
      const raw = gsap.timeline({ ...options, paused: true })
      raw.play = () => raw
      timelines.push(raw)
      return raw
    } },
  })
  return { scene, fx, timelines, get tl() { return timelines.at(-1) }, dispose() { fx.dispose(); scene.dispose(); gsap.ticker.sleep() } }
}
function clean(h) {
  assert.equal(h.scene.effects.children.length, 0)
  for (const actor of h.scene.actors.values()) {
    assert.equal(actor.pose.x, 0); assert.equal(actor.pose.y, 0); assert.equal(actor.pose.rotation, 0)
    assert.equal(actor.pose.alpha, 1); assert.equal(actor.pose.scale.x, 1); assert.equal(actor.pose.scale.y, 1)
    assert.equal(actor.pose.tint, 0xffffff)
  }
}

test('invalid multi-hit requests skip before borrowing actors, artwork, or another active runtime play', async () => {
  const h = harness(), cues = []
  try {
    const active = h.fx.play(request, { scene: h.scene, onCue: cue => cues.push(cue) })
    await tick(); h.tl.time(.3, false)
    const activeTimeline = h.tl, layer = h.scene.effects.children[0], source = h.scene.actor('source'), sourceX = source.pose.x
    const lookup = h.scene.actor.bind(h.scene)
    let lookups = 0
    h.scene.actor = (...args) => { lookups++; return lookup(...args) }
    const invalid = [
      { moveId: 'unknown-move' }, { moveId: 'tackle' }, { moveId: 'fly', phase: 'prepare' }, { phase: 'prepare' },
      ...[null, false, '2', 0, -1, 1.5, NaN, Infinity, 6, Number.MAX_SAFE_INTEGER + 1].map(hitCount => ({ hitCount })),
      { moveId: 'double-kick', hitCount: 3 }, { moveId: 'triple-kick', hitCount: 4 }, { moveId: 'beat-up', hitCount: 7 },
    ]
    for (const change of invalid) {
      assert.deepEqual(await h.fx.play({ ...request, ...change }, { scene: h.scene }).finished, { status: 'skipped' })
      assert.equal(h.scene.effects.children[0], layer)
      assert.equal(layer.destroyed, false)
      assert.equal(source.pose.x, sourceX)
      assert.equal(h.timelines.length, 1)
    }
    assert.equal(lookups, 0, 'invalid hit count is rejected before actor lookup')
    activeTimeline.time(activeTimeline.duration(), false)
    assert.deepEqual(await active.finished, { status: 'completed' })
    assert.deepEqual(cues.map(cue => cue.type === 'hit' ? cue.hitIndex : cue.type), [1, 2, 3, 'impact'])
    clean(h)
  } finally { h.dispose() }
})

test('runtime permits monotonic contacts only, deduplicates them, and holds aggregate impact until the last hit', async () => {
  let retainedCue
  const h = harness({ effects: { 'bullet-seed': { duration: 1, build({ tl, onCue }) {
    retainedCue = onCue
    const at = (time, ...values) => tl.call(() => values.forEach(value => onCue(value)), [], time)
    at(.1, { type: 'impact' }, { type: 'hit', hitIndex: 2 }, { type: 'hit', hitIndex: 0 }, { type: 'hit', hitIndex: 1.5 })
    at(.2, { type: 'hit', hitIndex: 1, hp: 1 }, { type: 'hit', hitIndex: 1 })
    at(.3, { type: 'impact' }, { type: 'hit', hitIndex: 3 }, { type: 'recovery' })
    at(.4, { type: 'hit', hitIndex: 2 }, { type: 'hit', hitIndex: 2 }, { type: 'hit', hitIndex: Infinity })
    at(.6, { type: 'hit', hitIndex: 3 }, { type: 'impact' }, { type: 'impact' }, { type: 'hit', hitIndex: 4 }, { type: 'hit', hitIndex: 3 })
    return { duration: 1, hitTimes: [.2, .4, .6] }
  } } } }), cues = []
  try {
    const run = h.fx.play(request, { scene: h.scene, onCue: cue => cues.push(cue) })
    await tick(); h.tl.time(.15, false); assert.deepEqual(cues, [])
    h.tl.time(.55, false)
    assert.deepEqual(cues, [{ type: 'hit', hitIndex: 1 }, { type: 'hit', hitIndex: 2 }])
    h.tl.time(.65, false)
    assert.deepEqual(cues, [{ type: 'hit', hitIndex: 1 }, { type: 'hit', hitIndex: 2 }, { type: 'hit', hitIndex: 3 }, { type: 'impact' }])
    h.tl.time(1, false); assert.deepEqual(await run.finished, { status: 'completed' })
    retainedCue({ type: 'hit', hitIndex: 4 }); retainedCue({ type: 'impact' }); assert.equal(cues.length, 4)
    clean(h)
  } finally { h.dispose() }
})

test('real multi-hit clocks expose immutable count-specific contact times in elapsed presentation seconds', async () => {
  const fixtures = [
    ['bullet-seed', 1, [.61], 1.28], ['bullet-seed', 5, [.61, .715, .82, .925, 1.03], 1.7],
    ['double-kick', 1, [.52], 1.48], ['double-kick', 2, [.52, .94], 1.9],
    ['beat-up', 6, [.62, .84, 1.06, 1.26, 1.48, 1.7], 2.79],
  ]
  const h = harness({ clocked: true })
  try {
    for (const [moveId, hitCount, hitTimes, duration] of fixtures) for (const visualRate of [.75, 1, 1.25]) {
      const events = [], cues = []
      const run = h.fx.play({ ...request, moveId, hitCount }, { scene: h.scene, visualRate,
        onPresentation: event => events.push(event), onCue: cue => cues.push(cue) })
      await tick()
      const start = events[0]
      assert.equal(start.type, 'start'); assert.equal(start.timelineSeconds, 0); assert.equal(start.observedAtMs, 1234)
      assert.ok(Object.isFrozen(start)); assert.ok(Object.isFrozen(start.hitTimes)); assert.ok(Object.isFrozen(h.tl.data.hitTimes))
      assert.equal(start.hitTimes.length, hitCount)
      for (let i = 0; i < hitCount; i++) assert.ok(Math.abs(start.hitTimes[i] - hitTimes[i] / visualRate) < .000001)
      assert.ok(Math.abs(start.durationSeconds - duration / visualRate) < .000001)
      assert.equal(h.tl.timeScale(), visualRate)
      h.tl.time(hitTimes[0], false)
      assert.ok(Math.abs(events.at(-1).timelineSeconds - hitTimes[0] / visualRate) < .000001)
      assert.deepEqual(cues[0], { type: 'hit', hitIndex: 1 }, 'cue remains at authored geometry time')
      h.tl.time(h.tl.duration(), false); assert.deepEqual(await run.finished, { status: 'completed' }); clean(h)
    }
    const events = []
    const reduced = h.fx.play(request, { scene: h.scene, visualRate: 1.25, reducedMotion: true, onPresentation: event => events.push(event) })
    await tick(); assert.equal(events[0].hitTimes, undefined); assert.equal(events[0].durationSeconds, .8 / 1.25)
    h.tl.time(.8, false); await reduced.finished; clean(h)
  } finally { h.dispose() }
})

test('malformed multi-hit timing fails and cleans borrowed state before a presentation clock can start', async () => {
  const invalid = [undefined, null, {}, { duration: 0, hitTimes: [.2, .4, .6] }, { duration: NaN, hitTimes: [.2, .4, .6] },
    { duration: 11, hitTimes: [.2, .4, .6] }, { duration: 1, hitTimes: [.2, .4] }, { duration: 1, hitTimes: [.2, .6, .4] },
    { duration: 1, hitTimes: [.2, .2, .6] }, { duration: 1, hitTimes: [0, .4, .6] }, { duration: 1, hitTimes: [.2, .4, 1] },
    { duration: 1, hitTimes: [.2, .4, NaN] }, { duration: 1, hitTimes: ['.2', .4, .6] }, { duration: 1, hitTimes: null }]
  for (const timing of invalid) {
    let retainedCue
    const h = harness({ clocked: true, effects: { 'bullet-seed': { duration: 1, build({ layer, source, tl, onCue }) {
      source.pose.x = 19; layer.addChild(new Graphics().circle(0, 0, 10).fill(0xffffff)); retainedCue = onCue
      tl.call(() => onCue({ type: 'hit', hitIndex: 1 }), [], .2)
      return timing
    } } } }), events = [], cues = []
    try {
      const run = h.fx.play(request, { scene: h.scene, onPresentation: event => events.push(event), onCue: cue => cues.push(cue) })
      assert.deepEqual(await run.finished, { status: 'failed', reason: 'Invalid multi-hit presentation timing' })
      await tick(); retainedCue({ type: 'hit', hitIndex: 1 })
      assert.deepEqual(events, []); assert.deepEqual(cues, []); clean(h)
    } finally { h.dispose() }
  }
})

test('counted playback deadlines, aborts and cancellation suppress retained cues and clocks', async () => {
  for (const mode of ['deadline', 'abort', 'cancel']) {
    const h = harness({ clocked: true, ...(mode === 'deadline' ? { deadlineMs: 20 } : {}) }), events = [], cues = [], controller = new AbortController()
    try {
      const run = h.fx.play({ ...request, hitCount: 5 }, { scene: h.scene, signal: controller.signal,
        onPresentation: event => events.push(event), onCue: cue => cues.push(cue) })
      await tick(); h.tl.time(.62, false)
      assert.deepEqual(cues, [{ type: 'hit', hitIndex: 1 }])
      if (mode === 'abort') controller.abort()
      if (mode === 'cancel') run.cancel()
      const result = await run.finished
      assert.equal(result.status, mode === 'deadline' ? 'failed' : 'cancelled')
      if (mode === 'deadline') assert.match(result.reason, /deadline/)
      const eventCount = events.length; h.tl.time(h.tl.duration(), false)
      assert.equal(events.length, eventCount); assert.equal(cues.length, 1); clean(h)
    } finally { h.dispose() }
  }
})

test('a throwing first-hit observer stops the recipe before later pose mutations and restores every actor field', async () => {
  const h = harness(), cues = []
  try {
    const run = h.fx.play({ ...request, moveId: 'double-slap', hitCount: 5 }, { scene: h.scene, onCue: cue => {
      cues.push(cue)
      throw new Error('hit observer failed')
    } })
    await tick(); h.tl.time(.52, false)
    assert.deepEqual(await run.finished, { status: 'failed', reason: 'hit observer failed' })
    assert.deepEqual(cues, [{ type: 'hit', hitIndex: 1 }]); clean(h)
    h.tl.time(h.tl.duration(), false)
    assert.equal(cues.length, 1); clean(h)
  } finally { h.dispose() }
})

test('cancellation or replacement from the first-hit observer prevents stale recipe mutations after ownership changes', async () => {
  for (const mode of ['cancel', 'replace']) {
    const h = harness(), cues = [], replacementCues = [], ownedTint = 0x123456
    let original, replacement
    try {
      original = h.fx.play({ ...request, moveId: 'double-slap', hitCount: 5 }, { scene: h.scene, onCue: cue => {
        cues.push(cue)
        if (mode === 'cancel') original.cancel()
        else {
          replacement = h.fx.play({ ...request, hitCount: 2 }, { scene: h.scene, onCue: value => replacementCues.push(value) })
          // The new scene owner may change its own pose immediately. The old
          // contact callback must unwind before its remaining tint assignment.
          h.scene.actor('target').pose.tint = ownedTint
        }
      } })
      await tick(); const oldTimeline = h.tl; oldTimeline.time(.52, false)
      assert.deepEqual(await original.finished, { status: 'cancelled' })
      assert.deepEqual(cues, [{ type: 'hit', hitIndex: 1 }])
      if (mode === 'cancel') {
        clean(h); oldTimeline.time(oldTimeline.duration(), false); clean(h)
      } else {
        assert.equal(h.scene.actor('target').pose.tint, ownedTint, 'old recipe cannot tint the newly owned actor')
        await tick()
        assert.notEqual(h.tl, oldTimeline); assert.equal(h.scene.effects.children.length, 1)
        assert.equal(h.scene.actor('target').pose.tint, ownedTint)
        h.tl.time(h.tl.duration(), false)
        assert.deepEqual(await replacement.finished, { status: 'completed' })
        assert.deepEqual(replacementCues, [{ type: 'hit', hitIndex: 1 }, { type: 'hit', hitIndex: 2 }, { type: 'impact' }])
        clean(h)
      }
      assert.equal(cues.length, 1, 'the stopped attack cannot emit remaining hit cues')
    } finally { h.dispose() }
  }
})

test('all supported multi-hit counts complete within the normal runtime budget even at the slowest visual rate', async () => {
  const h = harness({ clocked: true })
  try {
    for (const [moveId, max] of Object.entries(MULTI_HIT_LIMITS)) for (let hitCount = 1; hitCount <= max; hitCount++) {
      const events = []
      const run = h.fx.play({ ...request, moveId, hitCount }, { scene: h.scene, visualRate: .75, onPresentation: event => events.push(event) })
      await tick()
      assert.equal(events[0]?.hitTimes?.length, hitCount, `${moveId} ${hitCount} publishes every contact`)
      assert.ok(events[0].durationSeconds < 6, `${moveId} ${hitCount} fits the default runtime deadline`)
      h.tl.time(h.tl.duration(), false); assert.deepEqual(await run.finished, { status: 'completed' }); clean(h)
    }
  } finally { h.dispose() }
})

test('real counted FX drives shared-presenter HP steps and completes recovery before the next move or faint', async () => {
  const event = (cursor, opcode, ...fields) => ({ cursor, type: 'protocol', args: { opcode, fields } })
  const own = 'p1:1', opponent = 'p2:revealed:1'
  const member = (memberId, exact) => ({ memberId, species: 'Venusaur', name: 'Venusaur', hp: { current: 48, max: 48 },
    hpPrecision: exact ? 'exact' : 'public', active: true, fainted: false, condition: null, stages: {}, volatiles: [], moves: [] })
  for (const count of [2, 5]) for (const knockout of [false, true]) {
    const h = harness({ clocked: true }), displays = [], moves = [], clocks = [], faints = []
    let finishFaint, settled = false
    const faintFinished = new Promise(resolve => { finishFaint = resolve })
    const before = { matchId: 'actual-fx-hits', seat: 'p1', cursor: 10, own: { active: own, team: [member(own, true)] },
      opponent: { active: opponent, known: [member(opponent, false)] }, weather: null, sideConditions: { p1: [], p2: [] }, fieldConditions: [], result: null }
    const events = [event(11, 'move', own, 'Bullet Seed', opponent)]
    for (let i = 1; i <= count; i++) events.push(event(11 + i, '-damage', opponent, knockout && i === count ? '0 fnt' : `${48 - i * 8}/48`))
    events.push(event(12 + count, '-hitcount', opponent, String(count)))
    if (knockout) events.push(event(13 + count, 'faint', opponent))
    else events.push(event(13 + count, 'move', opponent, 'Tackle', own), event(14 + count, '-damage', own, '40/48'))
    const after = structuredClone(before)
    after.opponent.known[0].hp.current = knockout ? 0 : 48 - count * 8
    after.opponent.known[0].fainted = knockout
    if (knockout) { after.opponent.known[0].active = false; after.opponent.active = null }
    else after.own.team[0].hp.current = 40
    after.cursor = events.at(-1).cursor
    const batch = { before, after, events }, saved = structuredClone(batch)
    const presenter = createSimulationPresenter({ getScene: () => h.scene, ensureScene: async () => {}, loadFx: async () => h.fx,
      onDisplay: (view, options) => displays.push({ view: structuredClone(view), options }),
      onMove: move => { moves.push(move); return { onPresentation: cue => clocks.push({ moveId: move.moveId, cue }) } },
      faintScene: (view, options) => { faints.push({ view, options }); return faintFinished },
    })
    try {
      const pending = presenter.present(batch).then(result => { settled = true; return result })
      await tick()
      assert.equal(moves.length, 1); assert.equal(moves[0].hitCount, count)
      assert.equal(clocks[0].cue.hitTimes.length, count)
      const first = h.tl, times = [...first.data.hitTimes]
      for (let i = 0; i < count; i++) {
        first.time(times[i], false)
        const latest = displays.at(-1)
        assert.equal(latest.view.opponent.known[0].hp.current, knockout && i === count - 1 ? 0 : 48 - (i + 1) * 8)
        assert.equal(latest.view.own.team[0].hp.current, 48, 'later move remains unrevealed')
        assert.equal(moves.length, 1); assert.equal(faints.length, 0)
      }
      await tick(); assert.equal(settled, false); assert.equal(moves.length, 1); assert.equal(faints.length, 0)
      first.time(first.duration(), false); await tick()
      if (knockout) {
        assert.equal(faints.length, 1); assert.deepEqual(faints[0].options.actorIds, ['target'])
        assert.equal(settled, false, 'presenter awaits the faint after attack recovery')
        finishFaint({ status: 'completed' })
      } else {
        assert.equal(moves.length, 2); assert.equal(moves[1].moveId, 'tackle')
        assert.notEqual(h.tl, first, 'next move gets its own timeline after recovery')
        h.tl.time(h.tl.duration(), false)
      }
      assert.equal((await pending).status, 'completed')
      assert.deepEqual(displays.at(-1).view, after); assert.deepEqual(batch, saved); clean(h)
    } finally { finishFaint({ status: 'completed' }); presenter.destroy(); h.dispose() }
  }
})
