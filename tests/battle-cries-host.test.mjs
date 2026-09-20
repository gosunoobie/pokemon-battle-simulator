import test from 'node:test'
import assert from 'node:assert/strict'
import { createBattleAudio } from '../apps/shared/battle/audio.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const member = (memberId, species) => ({ memberId, species, name: 'A nickname', hp: { current: 100 }, fainted: false })
const view = (cursor = 1) => ({ matchId: 'match-one', cursor,
  own: { active: 'p2:1', team: [member('p2:1', 'Deoxys-Attack'), member('p2:2', 'Unown-B')] },
  opponent: { active: 'p1:1', known: [member('p1:1', 'Castform-Rainy')] } })
function harness({ saved = null, storageThrows = false } = {}) {
  const played = [], loads = [], stored = [], listeners = new Map()
  const doc = { hidden: false, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) }
  let stops = 0, disposed = 0, unlocks = 0, asset
  const audio = createBattleAudio({ document: doc,
    storage: { getItem() { if (storageThrows) throw Error('private mode'); return saved }, setItem(key, value) { stored.push([key, JSON.parse(value)]) } },
    playerFactory({ onState, resolveAsset }) {
      asset = resolveAsset
      let state = { enabled: true, volume: .6, status: 'locked', suspended: false }
      const update = patch => { state = { ...state, ...patch }; onState(state) }
      return {
        getState: () => state,
        unlock() { unlocks++; update({ status: 'ready' }); return Promise.resolve(true) },
        preload(ids) { loads.push([...ids]); return Promise.resolve() },
        play(id) { if (!state.enabled || state.suspended) return false; played.push(id); return true },
        stop() { stops++ },
        setEnabled: enabled => update({ enabled }), setVolume: volume => update({ volume }),
        setSuspended: suspended => update({ suspended }), dispose() { disposed++ },
      }
    },
  })
  return { audio, played, loads, stored, listeners, doc, asset: id => asset(id), stops: () => stops, disposed: () => disposed, unlocks: () => unlocks }
}

test('host resolves server species and explicit forms independently of nickname and viewer seat', () => {
  const h = harness(), v = view(), scope = h.audio.begin(v)
  assert.deepEqual(h.loads.filter(ids => ids.every(id => !id.startsWith('source.'))).at(-1), ['deoxysattack', 'castformrainy', 'unownb'])
  assert.equal(scope.entry(v, 'source'), true)
  assert.equal(scope.entry(v, 'target'), true)
  assert.deepEqual(h.played, ['deoxysattack', 'castformrainy'])
  assert.equal(h.asset('deoxysattack').sharedWith, 'deoxys')
  assert.equal(h.asset('unknown'), null)
  h.audio.dispose()
})

test('warm only viewer-known species; snapshot synchronization never plays or replays', () => {
  const h = harness(), v = view()
  h.audio.sync(v)
  assert.equal(h.played.length, 0)
  const first = h.audio.begin(v)
  first.entry(v, 'source'); first.entry(v, 'source')
  h.audio.sync(v)
  first.entry(view(2), 'target')
  h.audio.begin(v).entry(v, 'source')
  assert.deepEqual(h.played, ['deoxysattack'])
  h.audio.dispose()
})

test('a new batch, skip, hidden tab, mute and disposal invalidate old entry callbacks', () => {
  for (const action of ['begin', 'cancel', 'hidden', 'mute', 'dispose']) {
    const h = harness(), v = view(), scope = h.audio.begin(v)
    if (action === 'begin') h.audio.begin(view(2))
    if (action === 'cancel') scope.cancel()
    if (action === 'hidden') { h.doc.hidden = true; h.listeners.get('visibilitychange')(); h.doc.hidden = false; h.listeners.get('visibilitychange')() }
    if (action === 'mute') { h.audio.setEnabled(false); h.audio.setEnabled(true) }
    if (action === 'dispose') h.audio.dispose()
    assert.equal(scope.entry(v, 'source'), false, action)
    assert.equal(h.played.length, 0, action)
    h.audio.dispose()
    assert.equal(h.disposed(), 1)
    assert.equal(h.listeners.size, 0)
  }
})

test('old scope cancellation cannot silence a newer batch', () => {
  const h = harness(), v = view(), old = h.audio.begin(v), fresh = h.audio.begin(view(2))
  const stops = h.stops()
  old.cancel()
  assert.equal(h.stops(), stops)
  assert.equal(fresh.entry(view(2), 'source'), true)
  h.audio.dispose()
})

test('unknown, defeated, wrong match or invalid actor identities remain silent', () => {
  for (const change of [v => { v.own.team[0].species = 'Invented-mon' }, v => { v.own.team[0].fainted = true }, v => { v.own.team[0].hp.current = 0 }, v => { v.matchId = 'different' }]) {
    const h = harness(), v = view(), scope = h.audio.begin(v), incoming = structuredClone(v)
    change(incoming)
    assert.equal(scope.entry(incoming, 'source'), false)
    assert.equal(scope.entry(v, 'arbitrary'), false)
    assert.equal(h.played.length, 0)
    h.audio.dispose()
  }
})

test('preferences persist; unlock is invoked in the calling gesture and never replays a cry', async () => {
  const h = harness({ saved: JSON.stringify({ enabled: false, volume: .25 }) })
  assert.equal(h.audio.getState().enabled, false)
  assert.equal(h.audio.getState().volume, .25)
  h.audio.preload(['Unown-B'])
  h.audio.setEnabled(true)
  assert.equal(h.unlocks(), 1)
  await tick()
  assert.deepEqual(h.loads.filter(ids => ids.every(id => !id.startsWith('source.'))).at(-1), ['unownb'])
  assert.deepEqual(h.stored.at(-1), ['battle-lab:audio:v2', { schemaVersion: 2, enabled: true, volume: .25, criesEnabled: true, sfxEnabled: true }])
  assert.equal(h.played.length, 0)
  h.audio.dispose()
})

test('unavailable storage and malformed preferences do not prevent creating audio', () => {
  for (const options of [{ storageThrows: true }, { saved: 'bad JSON' }, { saved: '{"enabled":3,"volume":-1}' }]) {
    const h = harness(options)
    assert.equal(h.audio.getState().enabled, true)
    assert.equal(h.audio.getState().volume, .6)
    h.audio.dispose()
  }
})
