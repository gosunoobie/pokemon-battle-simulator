import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createMusicDirector } from '../apps/shared/music/director.js'
import { createRoomSession } from '../apps/multiplayer/src/roomSession.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const ref = value => ({ value })

// Execute the real Vue host bindings with a fake renderer, without mounting the
// canvas or duplicating the callbacks whose music policy these tests protect.
function hostSource(path) {
  const { descriptor } = parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
  const ast = compileScript(descriptor, { id: 'music-host-flow' }).scriptSetupAst
  const source = node => { assert.ok(node, `Host binding exists in ${path}`); return descriptor.scriptSetup.content.slice(node.start, node.end) }
  return {
    functions: names => names.map(name => source(ast.find(node => node.type === 'FunctionDeclaration' && node.id.name === name))).join('\n'),
    initializer: name => source(ast.flatMap(node => node.declarations ?? []).find(node => node.id.name === name)?.init),
  }
}
const simulationSource = hostSource('../apps/simulation/src/App.vue').functions(['acceptResponse', 'clearBattleState'])
const multiplayerSource = hostSource('../apps/multiplayer/src/App.vue').initializer('session')

function music() {
  const tracks = [], director = createMusicDirector({ storage: null, player: { setTrack: (track, options) => tracks.push({ id: track.id, key: options.key }) } })
  director.setContext({ kind: 'menu' })
  return { tracks, director, battleAudio: { setMusicContext: director.setContext } }
}
function simulation({ present = async () => ({ status: 'completed' }) } = {}) {
  const audio = music(), refs = Object.fromEntries([
    'latest', 'displayed', 'run', 'regionId', 'teamMode', 'customTeam', 'leadIndex', 'presetId', 'pendingChoice',
    'pendingAdvance', 'pendingQuit', 'busy', 'confirmingForfeit', 'playing', 'message', 'error',
  ].map(name => [name, ref(null)]))
  let generation = 1
  const bindings = { ...refs, ...audio, log: ref([]), resultTitle: ref('Battle complete'), selectedTeamLabel: ref('Your team'),
    battleView: ref({ present, sync() {}, clear() {} }), isCurrent: token => token === generation,
    createTeamDraft: team => team, nextTick: async () => {}, readyText: () => 'Choose a move', showBattle() {}, addLog() {},
  }
  const host = new Function(...Object.keys(bindings), `${simulationSource}; return { acceptResponse, clearBattleState }`)(...Object.values(bindings))
  return { ...audio, ...refs, ...host, nextGeneration: () => ++generation }
}
function leagueResponse(matchId, status = 'active') {
  return { matchId, view: { matchId, complete: true, result: status === 'active' ? null : { kind: 'win' } },
    run: { regionId: 'kanto', status, opponent: { title: status === 'won' ? 'Champion' : 'Elite Four' } }, events: [] }
}
const noOpening = tracks => assert.ok(tracks.every(track => track.id !== 'opening-theme'), 'Battle flow never requests the opening theme')

test('league results and the next opponent retain battle music until returning to setup', async () => {
  const h = simulation()
  await h.acceptResponse(leagueResponse('round-one'), 1)
  const first = h.director.getState()
  await h.acceptResponse(leagueResponse('round-one', 'between-battles'), 1)
  assert.deepEqual(h.director.getState(), first)
  await h.acceptResponse(leagueResponse('round-two'), 1)
  assert.equal(h.director.getState().key, 'match:round-two')
  assert.equal(h.director.getState().trackId, 'elite-four')
  noOpening(h.tracks.slice(1))
  h.clearBattleState()
  assert.equal(h.director.getState().trackId, 'opening-theme')
  assert.equal(h.latest.value, null)
})

test('completed league and private views restore battle music on reload or explicit synchronization', async () => {
  for (const status of ['between-battles', 'won', 'lost', 'private']) {
    const h = simulation(), response = leagueResponse(`completed-${status}`, status)
    if (status === 'private') response.run = null
    await h.acceptResponse(response, 1, false)
    assert.equal(h.director.getState().trackId, status === 'private' ? 'wild-battle' : 'elite-four', status)
    assert.equal(h.displayed.value, response.view)
    await h.acceptResponse(response, 1)
    noOpening(h.tracks.slice(1))
  }
})

test('late league presentation completion cannot change music after clearing or advancing the battle', async () => {
  for (const action of ['clear', 'advance']) {
    const gate = deferred(), h = simulation({ present: () => gate.promise })
    const pending = h.acceptResponse(leagueResponse('old-round', 'between-battles'), 1)
    await tick()
    const token = h.nextGeneration()
    if (action === 'clear') h.clearBattleState()
    else await h.acceptResponse(leagueResponse('new-round'), token, false)
    const selected = h.director.getState(), calls = h.tracks.length
    gate.resolve({ status: 'completed' }); await pending
    assert.deepEqual(h.director.getState(), selected)
    assert.equal(h.tracks.length, calls, 'Obsolete presentation makes no music request')
  }
})

function multiplayer({ present = async () => {} } = {}) {
  const audio = music(), state = ref({ envelope: null }), error = ref('')
  const bindings = { ...audio, state, error, createRoomSession, nextTick: async () => {},
    pendingOperation: ref(null), displayed: ref(null), log: ref([]), logHost: ref(null),
    room: { get value() { return state.value.envelope?.room } }, buildBattleLog: () => [],
    battle: ref({ present, sync() {}, clear() {} }),
  }
  const session = new Function(...Object.keys(bindings), `return (${multiplayerSource})`)(...Object.values(bindings))
  return { ...audio, session, error }
}
function roomResponse(revision, { result = false, status = result ? 'ended' : 'active', roomId = 'room', matchId = 'private-match' } = {}) {
  return { protocolVersion: 1, room: { id: roomId, seat: 'p1', status, own: { name: 'Player' }, opponent: { name: 'Opponent' } }, matchId, revision,
    view: { complete: true, seat: 'p1', matchId, cursor: revision, result: result ? { kind: 'win', winnerSeat: 'p1' } : null },
    events: Array.from({ length: revision }, (_, index) => ({ cursor: index + 1 })),
  }
}

test('private result presentation and completed-room heartbeats keep the current battle track', async () => {
  const h = multiplayer()
  h.session.enter(roomResponse(1)); await tick()
  const playing = h.director.getState(), completed = roomResponse(2, { result: true })
  assert.equal(playing.trackId, 'wild-battle')
  h.session.ingest(completed); await tick()
  h.session.ingest({ protocolVersion: 1, room: completed.room, matchId: completed.matchId, revision: 2, mode: 'unchanged', serverNow: 1000 })
  h.session.setPending({ operationId: 'leave-room' }); h.session.clearPending()
  assert.deepEqual(h.director.getState(), playing)
  assert.equal(h.session.snapshot().displayed.result.kind, 'win')
  noOpening(h.tracks.slice(1))
  assert.equal(h.error.value, '')
  h.session.reset()
  assert.equal(h.director.getState().trackId, 'opening-theme')
  h.session.dispose()
})

test('private completed and interrupted snapshots keep battle music during synchronization', async () => {
  for (const status of ['ended', 'interrupted', 'closed', 'expired']) {
    const h = multiplayer(), response = roomResponse(1, { result: status !== 'interrupted', status })
    h.session.enter(response, { synchronize: true }); await tick()
    assert.equal(h.director.getState().trackId, 'wild-battle', status)
    assert.equal(h.session.snapshot().displayed, response.view)
    noOpening(h.tracks.slice(1))
    assert.equal(h.error.value, '')
    h.session.reset()
    assert.equal(h.director.getState().trackId, 'opening-theme')
    h.session.dispose()
  }
})

test('stale private result completion cannot replace the music of a reset or replacement room', async () => {
  for (const action of ['reset', 'replacement']) {
    const gate = deferred(), h = multiplayer({ present: () => gate.promise })
    h.session.enter(roomResponse(1, { result: true })); await tick()
    if (action === 'reset') h.session.reset()
    else h.session.enter(roomResponse(1, { roomId: 'next-room', matchId: 'next-match' }), { synchronize: true })
    await tick()
    const selected = h.director.getState(), calls = h.tracks.length
    gate.resolve(); await tick()
    assert.deepEqual(h.director.getState(), selected)
    assert.equal(h.tracks.length, calls)
    assert.equal(h.error.value, '')
    h.session.dispose()
  }
})
