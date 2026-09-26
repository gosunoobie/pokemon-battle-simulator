import test from 'node:test'
import assert from 'node:assert/strict'
import { createMusicCatalog, BATTLE_MUSIC_IDS } from '../apps/shared/music/catalog.js'
import { createMusicDirector } from '../apps/shared/music/director.js'

const fixture = mode => {
  const calls = []
  const director = createMusicDirector({ player: { setTrack: (...args) => calls.push(args) }, getMode: () => mode.value, baseUrl: '/demo/' })
  return { director, calls }
}

test('music catalog uses stable IDs and the actual filename beneath the deployment base', () => {
  const catalog = createMusicCatalog('/preview')
  assert.equal(catalog['wild-battle'].url, '/preview/music/wild_batle.mp3')
  assert.equal(catalog['opening-theme'].url, '/preview/music/opening_theme.mp3')
  assert.equal(createMusicCatalog('./')['elite-four'].url, './music/elite_four.mp3')
  assert.equal(createMusicCatalog('https://example.org/demo/')['gym-leader'].url, 'https://example.org/demo/music/gym_leader.mp3')
  assert.equal(catalog['wild-battle'].loopEnd, 137.35)
  assert.equal(catalog['gym-leader'].loopEnd, undefined)
  assert.ok(Object.isFrozen(catalog['wild-battle']))
})

test('themed policy covers menus, lobbies, private matches, Elite Four, Champion and tournaments', () => {
  const { director, calls } = fixture({ value: 'themed' })
  assert.equal(director.setContext({ kind: 'menu' }).trackId, 'opening-theme')
  assert.equal(director.setContext({ kind: 'private' }).trackId, 'opening-theme')
  assert.equal(director.setContext({ kind: 'private', matchId: 'room-match' }).trackId, 'wild-battle')
  assert.equal(director.setContext({ kind: 'league', matchId: 'round-1', opponentTitle: 'Elite Four' }).trackId, 'elite-four')
  assert.equal(director.setContext({ kind: 'league', matchId: 'round-5', opponentTitle: 'Champion' }).trackId, 'elite-four')
  assert.equal(director.setContext({ kind: 'tournament', matchId: 'quarterfinal' }).trackId, 'gym-leader')
  assert.equal(calls.at(-1)[0].url, '/demo/music/gym_leader.mp3')
  assert.deepEqual(calls.at(-1)[1], { key: 'match:quarterfinal' })
  assert.equal(director.setContext({ kind: 'menu' }).key, 'menu')
})

test('random selections are deterministic across reloads, cover the battle catalog and exclude opening music', () => {
  const first = fixture({ value: 'random' }), reloaded = fixture({ value: 'random' })
  const selected = new Set()
  for (let index = 0; index < 60; index += 1) {
    const request = { kind: 'league', matchId: `match-${index}` }
    const a = first.director.setContext(request), b = reloaded.director.setContext(request)
    assert.equal(a.trackId, b.trackId)
    assert.ok(BATTLE_MUSIC_IDS.includes(a.trackId))
    selected.add(a.trackId)
  }
  assert.equal(selected.size, 3)
})

test('soundtrack preferences apply on the next match and returning to an active match preserves its choice', () => {
  const mode = { value: 'themed' }, { director, calls } = fixture(mode)
  const original = director.setContext({ kind: 'private', matchId: 'same-match' })
  mode.value = 'random'
  for (let update = 0; update < 5; update += 1) assert.equal(director.setContext({ kind: 'private', matchId: 'same-match' }).trackId, original.trackId)
  director.setContext({ kind: 'menu' })
  assert.deepEqual(director.setContext({ kind: 'private', matchId: 'same-match' }), original)
  const next = director.setContext({ kind: 'private', matchId: 'new-match' })
  assert.notEqual(next.key, original.key)
  assert.ok(BATTLE_MUSIC_IDS.includes(next.trackId))
  assert.equal(calls.at(-1)[1].key, 'match:new-match')
})

test('saved match selections survive refresh after a preference change without trusting invalid stored IDs', () => {
  const saved = new Map(), storage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) }
  const player = { setTrack() {} }
  const first = createMusicDirector({ player, storage, getMode: () => 'themed' })
  const original = first.setContext({ kind: 'league', matchId: 'persisted' })
  const refreshed = createMusicDirector({ player, storage, getMode: () => 'random' })
  assert.equal(refreshed.setContext({ kind: 'league', matchId: 'persisted' }).trackId, original.trackId)
  const [key] = saved.keys()
  const data = JSON.parse(saved.get(key))
  data.choices.push(['bad', 'opening-theme'], ['injected', 'https://example.org/untrusted.mp3'])
  saved.set(key, JSON.stringify(data))
  const validated = createMusicDirector({ player, storage })
  assert.equal(validated.setContext({ kind: 'private', matchId: 'bad' }).trackId, 'wild-battle')
  assert.equal(validated.setContext({ kind: 'private', matchId: 'injected' }).trackId, 'wild-battle')
})

test('unavailable storage and malformed cached choices do not block soundtrack policy', () => {
  for (const raw of ['{', JSON.stringify({ version: -1, choices: [['match', 'elite-four']] }), JSON.stringify({ version: 1, choices: [null, ['match'], [42, 'elite-four']] })]) {
    const director = createMusicDirector({ player: { setTrack() {} }, storage: { getItem: () => raw, setItem: () => { throw new Error('disabled storage') } } })
    assert.equal(director.setContext({ kind: 'private', matchId: 'match' }).trackId, 'wild-battle')
  }
})
