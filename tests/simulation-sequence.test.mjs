import test from 'node:test'
import assert from 'node:assert/strict'
import { createBattleSequence, introOverlay, resultOverlay, OVERLAY_TIMINGS } from '../apps/simulation/src/sequence.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
function deferred() {
  let resolve, reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
function clock() {
  let now = 0, nextId = 0
  const pending = new Map(), scheduled = []
  return {
    scheduled,
    get size() { return pending.size },
    setTimeout(callback, duration) {
      const id = ++nextId
      pending.set(id, { callback, at: now + duration })
      scheduled.push(duration)
      return id
    },
    clearTimeout(id) { pending.delete(id) },
    advance(duration) {
      now += duration
      for (const [id, timer] of [...pending].sort(([, left], [, right]) => left.at - right.at)) {
        if (timer.at <= now && pending.delete(id)) timer.callback()
      }
    },
  }
}
function view(matchId = 'match-one', result = null) {
  return { matchId, seat: 'p1', result, cursor: result ? 50 : 1, complete: true }
}
function run(status = 'active') {
  return { id: 'league-one', regionName: 'Hoenn', stageIndex: 4, totalStages: 5, status,
    opponent: { name: 'Steven', title: 'Champion' } }
}
function batch({ before = view(), after = view('match-one', { kind: 'win', winnerSeat: 'p1', reason: 'battle' }), challenge = run('won') } = {}) {
  return { before, after, run: challenge, playerLabel: 'Hoenn expedition', events: [{ type: 'protocol', args: { opcode: 'faint', fields: ['p2:1'] } }] }
}
function harness({ playback, overlayCallback } = {}) {
  const timers = clock(), overlays = [], calls = [], resets = []
  let skipped = 0, destroyed = 0
  const presenter = {
    reset(value) { resets.push(value) },
    present(value, options) {
      calls.push({ batch: value, options })
      return playback ? playback(value, options) : Promise.resolve({ status: options.effectsEnabled ? 'completed' : 'skipped' })
    },
    skip() { skipped++ },
    destroy() { destroyed++ },
  }
  const sequence = createBattleSequence({ presenter, timers, onOverlay(value) {
    overlays.push(value)
    overlayCallback?.(value)
  } })
  return { sequence, timers, overlays, calls, resets, get skipped() { return skipped }, get destroyed() { return destroyed } }
}
const currentOverlay = harness => harness.overlays.at(-1)

test('the trainer introduction finishes before the base presenter starts the opening send-out', async () => {
  const h = harness(), input = batch({ before: null, after: view() })
  const finished = h.sequence.present(input)
  assert.equal(currentOverlay(h).kind, 'intro')
  assert.equal(currentOverlay(h).opponentName, 'Steven')
  assert.equal(currentOverlay(h).playerLabel, 'Hoenn expedition')
  assert.equal(currentOverlay(h).durationMs, OVERLAY_TIMINGS.intro)
  assert.equal(h.calls.length, 0)
  h.timers.advance(OVERLAY_TIMINGS.intro - 1)
  await tick()
  assert.equal(h.calls.length, 0)
  h.timers.advance(1)
  assert.equal((await finished).status, 'completed')
  assert.equal(h.calls.length, 1)
  assert.deepEqual(h.calls[0].batch, input)
  assert.equal(h.calls[0].options.effectsEnabled, true)
  assert.equal(currentOverlay(h), null)
  assert.equal(h.timers.size, 0)
  h.sequence.destroy()
})

test('skipping the introduction disables effects for the remaining opening batch and clears its timer', async () => {
  const h = harness(), finished = h.sequence.present(batch({ before: null, after: view() }))
  h.sequence.skip()
  assert.equal(currentOverlay(h), null)
  assert.equal((await finished).status, 'skipped')
  assert.equal(h.skipped, 1)
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].options.effectsEnabled, false)
  assert.equal(h.timers.size, 0)
  h.sequence.destroy()
})

test('the result waits for the final move and faint sequence, then remains visible after its animation', async () => {
  const faint = deferred(), h = harness({ playback: () => faint.promise })
  const finished = h.sequence.present(batch())
  assert.equal(h.calls.length, 1)
  assert.equal(currentOverlay(h), null)
  assert.equal(h.timers.size, 0)
  faint.resolve({ status: 'completed' })
  await tick()
  assert.equal(currentOverlay(h).kind, 'victory')
  assert.equal(currentOverlay(h).champion, true)
  assert.equal(currentOverlay(h).animated, true)
  assert.equal(currentOverlay(h).durationMs, OVERLAY_TIMINGS.result)
  h.timers.advance(OVERLAY_TIMINGS.result)
  assert.equal((await finished).status, 'completed')
  assert.equal(currentOverlay(h).title, 'Champion')
  assert.equal(currentOverlay(h).animated, false)
  assert.equal(currentOverlay(h).motion, 'none')
  assert.equal(currentOverlay(h).durationMs, 0)
  assert.equal(h.timers.size, 0)
  h.sequence.destroy()
})

test('repeat result snapshots and reconnect resets never replay a celebration or introduction', async () => {
  const h = harness(), input = batch()
  const finished = h.sequence.present(input)
  await tick(); h.timers.advance(OVERLAY_TIMINGS.result); await finished
  const animations = h.overlays.filter(value => value?.animated).length
  await h.sequence.present(input)
  assert.equal(h.overlays.filter(value => value?.animated).length, animations)
  assert.equal(currentOverlay(h).animated, false)
  assert.equal(h.timers.size, 0)

  h.sequence.reset(input.after, { run: input.run })
  await h.sequence.present({ ...input, before: null })
  assert.equal(h.overlays.filter(value => value?.animated).length, animations)
  assert.equal(currentOverlay(h).title, 'Champion')

  h.sequence.reset(view('match-reconnected'))
  await h.sequence.present(batch({ before: null, after: view('match-reconnected') }))
  assert.equal(currentOverlay(h), null)
  assert.equal(h.overlays.filter(value => value?.animated).length, animations)
  assert.equal(h.timers.size, 0)
  h.sequence.destroy()
})

test('effects off bypasses the introduction and shows a static authoritative result without timers', async () => {
  const h = harness()
  await h.sequence.present(batch({ before: null, after: view() }), { effectsEnabled: false })
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].options.effectsEnabled, false)
  assert.ok(h.overlays.every(value => value === null))
  await h.sequence.present(batch(), { effectsEnabled: false })
  assert.equal(currentOverlay(h).title, 'Champion')
  assert.equal(currentOverlay(h).animated, false)
  assert.deepEqual(h.timers.scheduled, [])
  h.sequence.destroy()
})

test('reduced motion uses the shorter introduction and result durations', async () => {
  const h = harness(), opening = h.sequence.present(batch({ before: null, after: view() }), { reducedMotion: true })
  assert.equal(currentOverlay(h).motion, 'reduced')
  assert.equal(currentOverlay(h).durationMs, OVERLAY_TIMINGS.reducedIntro)
  h.timers.advance(OVERLAY_TIMINGS.reducedIntro)
  await opening
  assert.equal(h.calls[0].options.reducedMotion, true)
  const finished = h.sequence.present(batch(), { reducedMotion: true })
  await tick()
  assert.equal(currentOverlay(h).motion, 'reduced')
  assert.equal(currentOverlay(h).durationMs, OVERLAY_TIMINGS.reducedResult)
  h.timers.advance(OVERLAY_TIMINGS.reducedResult)
  await finished
  assert.deepEqual(h.timers.scheduled, [OVERLAY_TIMINGS.reducedIntro, OVERLAY_TIMINGS.reducedResult])
  assert.ok(OVERLAY_TIMINGS.reducedIntro < OVERLAY_TIMINGS.intro)
  assert.ok(OVERLAY_TIMINGS.reducedResult < OVERLAY_TIMINGS.result)
  h.sequence.destroy()
})

test('overlay copy distinguishes draws, no contests, ordinary wins, defeats, championships and forfeits', () => {
  assert.equal(resultOverlay(view(), run()), null)
  assert.equal(resultOverlay(view('draw', { kind: 'draw' }), run('lost')).kind, 'draw')
  assert.equal(resultOverlay(view('void', { kind: 'no-contest' }), run('lost')).kind, 'no-contest')
  const defeat = resultOverlay(view('lost', { kind: 'win', winnerSeat: 'p2', reason: 'battle' }), run('won'))
  assert.equal(defeat.kind, 'defeat')
  assert.equal(defeat.champion, false, 'a won run marker cannot override the authoritative losing result')
  const normal = resultOverlay(view('won', { kind: 'win', winnerSeat: 'p1' }), run('between-battles'))
  assert.equal(normal.kind, 'victory')
  assert.equal(normal.champion, false)
  assert.equal(normal.title, 'Victory')
  const champion = resultOverlay(view('champion', { kind: 'win', winnerSeat: 'p1' }), run('won'))
  assert.equal(champion.champion, true)
  assert.equal(champion.title, 'Champion')
  const forfeited = resultOverlay(view('quit', { kind: 'win', winnerSeat: 'p2', reason: 'forfeit' }), run('lost'))
  assert.equal(forfeited.kind, 'defeat')
  assert.equal(forfeited.detail, 'You forfeited the battle.')
  const plainIntro = introOverlay(view(), null)
  assert.equal(plainIntro.champion, false)
  assert.equal(plainIntro.playerLabel, 'Your team')
  assert.equal(plainIntro.opponentName, 'Opponent')
})

test('skip during the final move suppresses later celebration and preserves the static result', async () => {
  const pending = deferred(), h = harness({ playback: () => pending.promise })
  const finished = h.sequence.present(batch())
  h.sequence.skip()
  pending.resolve({ status: 'completed' })
  assert.equal((await finished).status, 'skipped')
  assert.equal(h.skipped, 1)
  assert.equal(currentOverlay(h).title, 'Champion')
  assert.equal(currentOverlay(h).animated, false)
  assert.deepEqual(h.timers.scheduled, [])
  h.sequence.destroy()
})

test('skip during the result animation cancels its timer but leaves the result readable', async () => {
  const h = harness(), finished = h.sequence.present(batch())
  await tick()
  assert.equal(currentOverlay(h).animated, true)
  h.sequence.skip()
  assert.equal((await finished).status, 'skipped')
  assert.equal(currentOverlay(h).kind, 'victory')
  assert.equal(currentOverlay(h).animated, false)
  assert.equal(h.timers.size, 0)
  h.sequence.destroy()
})

test('reset and destroy cancel pending intro/result timers without stale overlay callbacks', async () => {
  for (const phase of ['intro', 'result']) for (const operation of ['reset', 'destroy']) {
    const h = harness()
    const input = phase === 'intro' ? batch({ before: null, after: view() }) : batch()
    const finished = h.sequence.present(input)
    await tick()
    assert.equal(h.timers.size, 1)
    if (operation === 'reset') h.sequence.reset(view('replacement'))
    else h.sequence.destroy()
    const overlayCount = h.overlays.length
    assert.equal((await finished).status, 'cancelled')
    h.timers.advance(10000)
    await tick()
    assert.equal(h.timers.size, 0)
    assert.equal(h.overlays.length, overlayCount)
    assert.equal(currentOverlay(h), null)
    if (phase === 'intro') assert.equal(h.calls.length, 0)
    h.sequence.destroy()
    assert.equal(h.destroyed, 1)
  }
})

test('late base-presenter completion cannot revive overlays after reset or destroy', async () => {
  for (const operation of ['reset', 'destroy']) {
    const pending = deferred(), h = harness({ playback: () => pending.promise })
    const finished = h.sequence.present(batch())
    if (operation === 'reset') h.sequence.reset(view('replacement'))
    else h.sequence.destroy()
    const overlayCount = h.overlays.length
    pending.resolve({ status: 'completed' })
    assert.equal((await finished).status, 'cancelled')
    assert.equal(h.overlays.length, overlayCount)
    assert.equal(currentOverlay(h), null)
    assert.equal(h.timers.size, 0)
    h.sequence.destroy()
  }
})

test('new presentations supersede an older intro without starting its stale opening animation', async () => {
  const h = harness(), stale = h.sequence.present(batch({ before: null, after: view('old') }))
  const current = h.sequence.present(batch({ before: null, after: view('new') }))
  assert.equal((await stale).status, 'cancelled')
  assert.equal(h.timers.size, 1)
  assert.equal(currentOverlay(h).key, 'new:intro')
  h.timers.advance(OVERLAY_TIMINGS.intro)
  await current
  assert.deepEqual(h.calls.map(call => call.batch.after.matchId), ['new'])
  h.sequence.destroy()
})

test('a new match discards the old battle snapshot before opening but never changes the caller input', async () => {
  const input = batch({ before: view('old-match', { kind: 'win', winnerSeat: 'p1' }), after: view('new-match') })
  const saved = structuredClone(input), h = harness()
  const finished = h.sequence.present(input)
  assert.equal(currentOverlay(h).key, 'new-match:intro')
  assert.equal(h.resets.at(-1).matchId, 'new-match')
  h.timers.advance(OVERLAY_TIMINGS.intro)
  await finished
  assert.equal(h.calls[0].batch.before, null, 'the previous league opponent cannot enter the new battle animation')
  assert.equal(h.calls[0].batch.after.matchId, 'new-match')
  assert.deepEqual(input, saved)
  h.sequence.destroy()
})

test('presentation failures reconcile the server result statically and optional overlay callback failures cannot block play', async () => {
  const input = batch(), h = harness({ playback: () => Promise.reject(new Error('renderer failed')) })
  assert.equal((await h.sequence.present(input)).status, 'failed')
  assert.equal(h.resets.at(-1), input.after)
  assert.equal(currentOverlay(h).title, 'Champion')
  assert.equal(currentOverlay(h).animated, false)
  assert.equal(h.timers.size, 0)
  h.sequence.destroy()

  const failed = harness({ playback: () => Promise.resolve({ status: 'failed' }) })
  assert.equal((await failed.sequence.present(input)).status, 'failed')
  assert.equal(currentOverlay(failed).title, 'Champion')
  assert.equal(currentOverlay(failed).animated, false)
  assert.equal(failed.timers.size, 0)
  failed.sequence.destroy()

  const safe = harness({ overlayCallback: () => { throw new Error('optional overlay unavailable') } })
  const finished = safe.sequence.present(batch({ before: null, after: view() }))
  safe.timers.advance(OVERLAY_TIMINGS.intro)
  assert.equal((await finished).status, 'completed')
  safe.sequence.destroy()
})

test('presentation leaves authoritative input and league progress untouched', async () => {
  const input = batch(), saved = structuredClone(input)
  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
    return value
  }
  freeze(input)
  const h = harness(), finished = h.sequence.present(input)
  await tick(); h.timers.advance(OVERLAY_TIMINGS.result); await finished
  assert.deepEqual(input, saved)
  assert.deepEqual(h.calls[0].batch, input)
  h.sequence.destroy()
  assert.equal((await h.sequence.present(input)).status, 'cancelled')
  assert.deepEqual(input, saved)
})
