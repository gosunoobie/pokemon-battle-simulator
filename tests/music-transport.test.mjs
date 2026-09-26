import test from 'node:test'
import assert from 'node:assert/strict'
import { createMusicPlayer } from '../packages/battle-audio/src/music.js'

const opening = Object.freeze({ id: 'opening', title: 'Opening', url: '/music/opening.mp3', gain: .8 })
const wild = Object.freeze({ id: 'wild', title: 'Wild battle', url: '/music/wild.mp3', gain: 1 })
const elite = Object.freeze({ id: 'elite', title: 'Elite Four', url: '/music/elite.mp3', gain: 1 })
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const flush = async () => { for (let count = 0; count < 8; count += 1) await Promise.resolve() }
class Events {
  listeners = new Map()
  addEventListener(name, handler) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(handler) }
  removeEventListener(name, handler) { this.listeners.get(name)?.delete(handler) }
  emit(name) { for (const handler of [...(this.listeners.get(name) ?? [])]) handler() }
}
const fixture = (options = {}) => {
  const timers = new Map(), states = [], nodes = [], subscribers = new Set(), calls = []
  let nextTimer = 0, now = 0, factoryCalls = 0, graphCalls = 0
  const context = new Events()
  context.state = 'suspended'; context.currentTime = 0
  context.createGain = () => {
    const node = { disconnected: false, connect() {}, disconnect() { this.disconnected = true },
      gain: { value: 0, events: [], cancelScheduledValues(time) { this.events.push(['cancel', time]) },
        setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]) },
        linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['ramp', value, time]) } } }
    nodes.push(node); return node
  }
  context.createMediaElementSource = media => { graphCalls += 1; assert.equal(media, element); const node = { connect() {}, disconnect() { this.disconnected = true } }; nodes.push(node); return node }
  const element = new Events()
  Object.assign(element, { src: '', currentTime: 0, paused: true, error: null, loads: 0, plays: 0, pauses: 0,
    playImpl: () => Promise.resolve(),
    play() { calls.push('play'); this.plays += 1; this.paused = false; return this.playImpl() },
    pause() { this.pauses += 1; this.paused = true },
    load() { this.loads += 1; this.error = null },
    removeAttribute(name) { if (name === 'src') this.src = '' },
  })
  let masterEnabled = true
  const session = {
    ensure: () => { calls.push('ensure'); return { context, output: {} } },
    unlock: () => { calls.push('resume'); context.state = 'running'; context.emit('statechange'); return Promise.resolve(true) },
    getState: () => ({ enabled: masterEnabled, volume: .6, status: context.state === 'running' ? 'ready' : 'locked' }),
    subscribe: listener => { subscribers.add(listener); listener(session.getState()); return () => subscribers.delete(listener) },
    setEnabled: value => { masterEnabled = value; for (const listener of subscribers) listener(session.getState()) },
  }
  const player = createMusicPlayer({ session, createMedia: () => { factoryCalls += 1; return element }, onState: state => states.push(state),
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id },
    clearTimeout: id => timers.delete(id), ...options })
  const advance = async milliseconds => {
    const until = now + milliseconds
    for (;;) {
      const [id, timer] = [...timers].filter(([, item]) => item.at <= until).sort((a, b) => a[1].at - b[1].at)[0] ?? []
      if (!timer) break
      now = timer.at; context.currentTime = now / 1000; timers.delete(id); timer.callback(); await flush()
    }
    now = until; context.currentTime = now / 1000; await flush()
  }
  return { player, element, context, session, timers, states, nodes, calls, advance,
    counts: () => ({ factoryCalls, graphCalls, subscribers: subscribers.size }) }
}

test('music streams through one reusable element and gain branch, with both gesture gates started synchronously', async () => {
  const f = fixture()
  f.player.setTrack(opening)
  assert.equal(f.element.plays, 0)
  assert.equal(f.counts().graphCalls, 0)
  assert.equal(f.element.preload, 'metadata')
  assert.equal(f.element.loop, true)
  const unlocking = f.player.unlock()
  assert.deepEqual(f.calls, ['ensure', 'resume', 'play'])
  assert.equal(await unlocking, true)
  assert.equal(f.player.getState().status, 'playing')
  assert.equal(f.player.getState().volume, .8)
  assert.equal(f.nodes[1].gain.value, .25 * .8 * .8)
  f.player.setVolume(.4)
  assert.equal(f.nodes[1].gain.value, .25 * .4 * .8)
  f.player.setVolume(1)
  f.player.setTrack(wild, { key: 'battle-1' })
  assert.equal(f.element.src, opening.url)
  await f.advance(160)
  assert.equal(f.element.src, wild.url)
  assert.equal(f.element.plays, 2)
  assert.deepEqual(f.counts(), { factoryCalls: 1, graphCalls: 1, subscribers: 1 })
  assert.equal(f.nodes[1].gain.value, .25)
  f.player.dispose()
})

test('same track/key is idempotent and a new battle key restarts even the same selected song', async () => {
  const f = fixture()
  f.player.setTrack(wild, { key: 'one' }); await f.player.unlock()
  f.element.currentTime = 38
  assert.equal(f.player.setTrack(wild, { key: 'one' }), false)
  assert.equal(f.element.currentTime, 38)
  assert.equal(f.element.plays, 1)
  f.player.setTrack(wild, { key: 'two' }); await f.advance(160)
  assert.equal(f.element.currentTime, 0)
  assert.equal(f.element.plays, 2)
  f.player.dispose()
})

test('music off, master mute and background suspension preserve position and cancel pending fades', async () => {
  const f = fixture()
  f.player.setTrack(opening); await f.player.unlock()
  f.element.currentTime = 43
  f.player.setEnabled(false)
  assert.equal(f.element.paused, true)
  assert.equal(f.nodes[1].gain.value, 0)
  f.player.setEnabled(true); await flush()
  assert.equal(f.element.currentTime, 43)
  assert.equal(f.player.getState().status, 'playing')
  f.session.setEnabled(false)
  assert.equal(f.element.paused, true)
  assert.equal(f.player.getState().enabled, true)
  f.session.setEnabled(true); await flush()
  assert.equal(f.element.currentTime, 43)
  f.player.setTrack(wild)
  f.player.setSuspended(true)
  assert.equal(f.timers.size, 0)
  assert.equal(f.element.paused, true)
  await f.advance(1000)
  assert.equal(f.element.paused, true)
  f.player.setSuspended(false); await flush()
  assert.equal(f.element.src, wild.url)
  assert.equal(f.player.getState().status, 'playing')
  f.player.dispose()
})

test('rapid soundtrack replacement and context interruptions cannot revive a superseded track', async () => {
  const f = fixture()
  f.player.setTrack(opening); await f.player.unlock()
  f.player.setTrack(wild); f.player.setTrack(elite)
  f.context.state = 'interrupted'; f.context.emit('statechange')
  assert.equal(f.element.paused, true)
  await f.advance(1000)
  assert.equal(f.element.src, opening.url)
  f.context.state = 'running'; f.context.emit('statechange'); await flush()
  assert.equal(f.element.src, elite.url)
  assert.equal(f.element.plays, 2)
  assert.equal(f.player.getState().status, 'playing')
  f.player.dispose()
})

test('a delayed old play settles on cancellation and cannot pause or replace a newer soundtrack', async () => {
  const f = fixture(), old = deferred()
  f.player.setTrack(opening); f.element.playImpl = () => old.promise
  const pending = f.player.unlock()
  f.element.playImpl = () => Promise.resolve()
  f.player.setTrack(wild)
  assert.equal(await pending, false)
  await flush()
  assert.equal(f.player.getState().status, 'playing')
  old.resolve(); await flush()
  assert.equal(f.element.src, wild.url)
  assert.equal(f.element.paused, false)
  f.player.dispose()
})

test('autoplay and resume rejections are contained and require explicit retry for the same soundtrack', async () => {
  const f = fixture()
  f.player.setTrack(opening)
  f.element.playImpl = () => Promise.reject(Object.assign(new Error('gesture required'), { name: 'NotAllowedError' }))
  assert.equal(await f.player.unlock(), false)
  assert.equal(f.player.getState().status, 'locked')
  for (let update = 0; update < 10; update += 1) f.player.setTrack(opening)
  assert.equal(f.element.plays, 1)
  f.player.setSuspended(true); f.player.setSuspended(false)
  assert.equal(f.element.plays, 1)
  f.element.playImpl = () => Promise.resolve()
  assert.equal(await f.player.unlock(), true)
  f.context.state = 'suspended'; f.context.emit('statechange')
  f.session.unlock = () => Promise.reject(new Error('resume rejected'))
  assert.equal(await f.player.unlock(), false)
  assert.equal(f.player.getState().error, 'context')
  f.player.dispose()
})

test('missing files and stalled playback fail without retry loops or unbounded promises', async () => {
  const f = fixture({ loadTimeoutMs: 50 })
  f.player.setTrack(opening); await f.player.unlock()
  const oldErrorHandler = [...f.element.listeners.get('error')][0]
  f.element.error = { code: 4 }; f.element.emit('error')
  assert.equal(f.player.getState().status, 'error')
  f.player.setTrack(opening)
  assert.equal(f.element.plays, 1)
  assert.equal(await f.player.unlock(), true)
  assert.equal(f.element.loads, 2)
  f.player.setTrack(wild); await f.advance(160)
  oldErrorHandler()
  assert.equal(f.player.getState().status, 'playing')
  f.element.playImpl = () => new Promise(() => {})
  f.player.setTrack(elite); await f.advance(160)
  const pending = f.player.unlock()
  await f.advance(50)
  assert.equal(await pending, false)
  assert.equal(f.player.getState().error, 'timeout')
  assert.equal(f.element.paused, true)
  const plays = f.element.plays
  f.player.setTrack(elite); await f.advance(1000)
  assert.equal(f.element.plays, plays)
  f.player.dispose()
})

test('disposal cancels late playback, releases owned graph/media and leaves the shared context alive', async () => {
  const f = fixture(), late = deferred()
  f.element.playImpl = () => late.promise
  f.player.setTrack(opening)
  const pending = f.player.unlock()
  f.player.dispose(); f.player.dispose()
  assert.equal(await pending, false)
  late.resolve(); await flush()
  assert.equal(f.element.paused, true)
  assert.equal(f.element.src, '')
  assert.equal(f.timers.size, 0)
  assert.ok(f.nodes.every(node => node.disconnected))
  assert.equal(f.context.state, 'running')
  assert.equal(f.counts().subscribers, 0)
  assert.equal(f.context.listeners.get('statechange').size, 0)
  assert.equal(f.player.getState().status, 'unavailable')
})

test('quiet-tail endpoints seek the active playing song without new playback, timers or players', async () => {
  const f = fixture(), trimmed = { ...opening, loopEnd: 155.7 }
  f.element.duration = 156.76
  f.player.setTrack(trimmed); await f.player.unlock()
  f.element.currentTime = 155.69; f.element.emit('timeupdate')
  assert.equal(f.element.currentTime, 155.69)
  f.element.currentTime = 155.7; f.element.emit('timeupdate')
  assert.equal(f.element.currentTime, 0)
  assert.equal(f.element.plays, 1)
  assert.equal(f.timers.size, 0)
  assert.equal(f.counts().factoryCalls, 1)
  f.element.duration = 150
  f.element.currentTime = 156; f.element.emit('timeupdate')
  assert.equal(f.element.currentTime, 156, 'an endpoint outside the actual asset cannot crop it')
  f.player.dispose()
})

test('tail-loop listeners cannot seek a faded, paused, failed, replaced or disposed song', async () => {
  const f = fixture(), trimmed = { ...opening, loopEnd: 12 }
  f.player.setTrack(trimmed); await f.player.unlock()
  const oldLoop = [...f.element.listeners.get('timeupdate')][0]
  f.player.setSuspended(true)
  f.element.currentTime = 13; oldLoop()
  assert.equal(f.element.currentTime, 13)
  f.player.setSuspended(false); await flush()
  f.player.setTrack(wild)
  oldLoop()
  assert.equal(f.element.currentTime, 13, 'a fading-out song does not loop')
  await f.advance(160)
  f.element.currentTime = 22; oldLoop()
  assert.equal(f.element.currentTime, 22, 'a stale listener cannot seek the replacement')
  f.player.setTrack(trimmed); await f.advance(160)
  f.element.error = { code: 4 }; f.element.emit('error')
  f.element.currentTime = 13; f.element.emit('timeupdate')
  assert.equal(f.element.currentTime, 13)
  f.player.dispose(); oldLoop()
  assert.equal(f.element.currentTime, 13)
  assert.equal(f.element.listeners.get('timeupdate').size, 0)
  const invalid = fixture()
  for (const loopEnd of [0, -1, Infinity, '12']) assert.throws(() => invalid.player.setTrack({ ...opening, loopEnd }), /Invalid music track/)
  invalid.player.dispose()
})
