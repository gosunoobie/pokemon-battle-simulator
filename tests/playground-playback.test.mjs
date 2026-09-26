import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlaygroundPlayback } from '../apps/fx-playground/src/playback.js'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }
const request = () => ({ moveId: 'tackle', phase: 'attack', sourceId: 'source', targetIds: ['target'], visualSeed: 42, effectiveness: 'super-effective' })

function harness({ ready, throwPlay = false } = {}) {
  let scene = {}, timerId = 0
  const timers = new Map(), listeners = new Map(), calls = { unlock: 0, stops: 0, disposed: 0, plays: [], sounds: [], states: [] }
  const doc = { hidden: false, addEventListener(type, callback) { listeners.set(type, callback) },
    removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type) } }
  const audio = { unlock() { calls.unlock++; return Promise.resolve(true) }, stop() { calls.stops++ },
    begin(input) {
      const sound = { input, ready: typeof ready === 'function' ? ready() : ready, cancelled: 0, presentations: [], impacts: [], results: [],
        onPresentation(cue) { this.presentations.push(cue) }, onImpact(cue) { this.impacts.push(cue) },
        finish(result) { this.results.push(result) }, cancel() { this.cancelled++ } }
      calls.sounds.push(sound)
      return sound
    } }
  const fx = { play(input, options) {
    if (throwPlay) throw new Error('Renderer unavailable')
    const end = deferred(), run = { input, options, end, cancelled: 0 }
    calls.plays.push(run)
    return { finished: end.promise, cancel() { run.cancelled++ } }
  }, dispose() { calls.disposed++ } }
  const playback = createPlaygroundPlayback({ getScene: () => scene, audio, document: doc, createFx: () => fx,
    onState: state => calls.states.push(state), setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id },
    clearTimeout: id => timers.delete(id) })
  return { playback, calls, timers, doc, listeners,
    changeScene() { scene = {} }, hide() { doc.hidden = true; listeners.get('visibilitychange')?.() },
    fire(delay) {
      const entry = [...timers].find(([, timer]) => timer.delay === delay)
      assert.ok(entry, `Expected ${delay} ms timer`)
      timers.delete(entry[0]); entry[1].callback()
    } }
}

test('play unlocks in the gesture, snapshots its request and routes presentation and confirmed cues once', async () => {
  const loaded = deferred(), h = harness({ ready: loaded.promise }), selected = request()
  const first = h.playback.play(selected)
  assert.equal(h.calls.unlock, 1)
  assert.equal(h.playback.getState().status, 'loading')
  assert.equal(h.calls.plays.length, 0)
  selected.moveId = 'surf'; selected.targetIds[0] = 'source'
  loaded.resolve(); await flush()
  const run = h.calls.plays[0], sound = h.calls.sounds[0]
  assert.deepEqual(run.input, { moveId: 'tackle', phase: 'attack', sourceId: 'source', targetIds: ['target'], visualSeed: 42 })
  assert.ok(Object.isFrozen(run.input)); assert.ok(Object.isFrozen(run.input.targetIds))
  assert.deepEqual(sound.input, { moveId: 'tackle', phase: 'attack', mode: 'normal', effectiveness: 'super-effective' })
  const start = { type: 'start', timelineSeconds: 0 }, frame = { type: 'frame', timelineSeconds: .5 }
  run.options.onPresentation(start); run.options.onPresentation(frame)
  run.options.onCue({ type: 'impact' }); run.options.onCue({ type: 'impact' }); run.options.onCue({ type: 'recovery' })
  assert.deepEqual(sound.presentations, [start, frame]); assert.equal(sound.impacts.length, 1)
  assert.equal(h.playback.getState().cue, 'recovery')
  run.end.resolve({ status: 'completed' })
  assert.deepEqual(await first, { status: 'completed' })
  await flush()
  assert.equal(sound.cancelled, 0, 'completed recording keeps its natural tail')
  assert.equal(sound.results.length, 1)
  assert.equal(h.playback.getState().busy, false)
  const completedState = h.playback.getState()
  run.options.onCue({ type: 'prepared' }); run.options.onPresentation({ type: 'frame', timelineSeconds: 7 })
  assert.equal(h.playback.getState(), completedState, 'late callbacks cannot change completed state')
  assert.equal(sound.presentations.length, 2)
  h.playback.stop()
  assert.equal(sound.cancelled, 1, 'explicit Stop still owns the completed recording tail')
  h.playback.dispose()
})

test('first-use sound loading is bounded and a late load never schedules a second visual run', async () => {
  const loaded = deferred(), h = harness({ ready: loaded.promise })
  const first = h.playback.play(request())
  h.fire(350); await flush()
  assert.equal(h.calls.plays.length, 1)
  loaded.resolve(); await flush()
  assert.equal(h.calls.plays.length, 1)
  h.calls.plays[0].end.resolve({ status: 'completed' }); await first
  h.playback.dispose()
  assert.equal(h.timers.size, 0)
})

test('Stop settles immediately during a never-resolving sound load and ignores its eventual completion', async () => {
  const loaded = deferred(), h = harness({ ready: loaded.promise })
  const first = h.playback.play(request(), { loop: true })
  h.playback.stop()
  assert.deepEqual(await first, { status: 'cancelled' })
  assert.equal(h.timers.size, 0); assert.equal(h.calls.sounds[0].cancelled, 1)
  loaded.resolve(); await flush()
  assert.equal(h.calls.plays.length, 0); assert.equal(h.playback.getState().busy, false)
  h.playback.dispose()
})

test('replay supersedes unresolved FX and its stale cues cannot touch the new run', async () => {
  const h = harness(), old = h.playback.play(request()), firstRun = h.calls.plays[0]
  const next = h.playback.play({ ...request(), moveId: 'fly', phase: 'prepare' }, { reducedMotion: true })
  assert.deepEqual(await old, { status: 'cancelled' })
  assert.equal(firstRun.cancelled, 1)
  const nextRun = h.calls.plays[1], state = h.playback.getState()
  firstRun.options.onCue({ type: 'impact' }); firstRun.options.onPresentation({ type: 'start' })
  firstRun.end.resolve({ status: 'completed' }); await flush()
  assert.equal(h.playback.getState(), state)
  assert.equal(h.calls.sounds[0].impacts.length, 0); assert.equal(h.calls.sounds[0].presentations.length, 0)
  assert.equal(nextRun.options.reducedMotion, true); assert.equal(h.calls.sounds[1].input.mode, 'reduced')
  nextRun.options.onCue({ type: 'prepared' })
  assert.equal(h.playback.getState().cue, 'prepared'); assert.equal(h.calls.sounds[1].impacts.length, 0)
  nextRun.end.resolve({ status: 'completed' }); await next
  h.playback.dispose()
})

test('repeat reuses a stable selection, waits at least500ms and stops on hidden tabs without automatic restart', async () => {
  const h = harness(), selected = request(), first = h.playback.play(selected, { loop: true, loopDelayMs: 0 })
  selected.sourceId = 'target'
  h.calls.plays[0].end.resolve({ status: 'completed' })
  await first; await flush()
  assert.equal(h.playback.getState().status, 'waiting'); assert.equal(h.playback.getState().busy, true)
  assert.equal(h.calls.plays.length, 1)
  const stops = h.calls.stops
  h.fire(500); await flush()
  assert.equal(h.calls.plays.length, 2); assert.ok(h.calls.stops > stops)
  assert.equal(h.calls.plays[1].input.sourceId, 'source'); assert.equal(h.playback.getState().iteration, 2)
  h.hide()
  assert.equal(h.calls.plays[1].cancelled, 1); assert.equal(h.calls.sounds[1].cancelled, 1)
  assert.equal(h.playback.getState().status, 'idle'); assert.equal(h.timers.size, 0)
  h.doc.hidden = false; h.listeners.get('visibilitychange')?.(); await flush()
  assert.equal(h.calls.plays.length, 2)
  h.playback.dispose()
})

test('Stop cancels a waiting repeat timer and disposal removes observers and the owned FX runtime', async () => {
  const h = harness(), first = h.playback.play(request(), { loop: true })
  h.calls.plays[0].end.resolve({ status: 'completed' }); await first; await flush()
  assert.equal(h.timers.size, 1)
  h.playback.dispose(); h.playback.dispose()
  assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0); assert.equal(h.calls.disposed, 1)
  assert.deepEqual(await h.playback.play(request()), { status: 'cancelled' })
  assert.equal(h.calls.unlock, 1)
})

test('a changed scene cancels old playback and rejects its callbacks and completion', async () => {
  const h = harness(), first = h.playback.play(request()), run = h.calls.plays[0]
  h.changeScene(); run.options.onCue({ type: 'impact' })
  assert.deepEqual(await first, { status: 'cancelled' })
  assert.equal(run.cancelled, 1); assert.equal(h.calls.sounds[0].impacts.length, 0)
  const state = h.playback.getState()
  run.end.resolve({ status: 'completed' }); await flush()
  assert.equal(h.playback.getState(), state)
  h.playback.dispose()
})

test('renderer failures are visible, silence the run and never repeat', async () => {
  for (const throwPlay of [true, false]) {
    const h = harness({ throwPlay }), first = h.playback.play(request(), { loop: true })
    if (!throwPlay) h.calls.plays[0].end.reject(new Error('Artwork failed'))
    assert.equal((await first).status, 'failed'); await flush()
    assert.equal(h.playback.getState().status, 'error'); assert.equal(h.playback.getState().busy, false)
    assert.equal(h.calls.sounds[0].cancelled, 1); assert.equal(h.timers.size, 0)
    h.playback.dispose()
  }
})
