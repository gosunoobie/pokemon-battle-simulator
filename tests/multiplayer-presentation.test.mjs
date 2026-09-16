import test from 'node:test'
import assert from 'node:assert/strict'
import { activeMembers, createSimulationScene, createSimulationPresenter, buildBattleLog,
  introOverlay, resultOverlay, sideConditionLabels, viewerResultTitle } from '../apps/shared/battle/index.js'
import { previewSceneActors } from '../apps/game/src/scene/previewActors.js'

const clone = value => structuredClone(value)
const event = (cursor, opcode, ...fields) => ({ cursor, type: 'protocol', args: { opcode, fields } })
const tick = () => new Promise(resolve => setImmediate(resolve))
const member = (memberId, species, maximum, own, active = true) => ({ memberId, species, name: species,
  hp: { current: maximum, max: maximum }, hpPrecision: own ? 'exact' : 'public', active,
  fainted: false, condition: null, stages: {}, volatiles: [], moves: [], item: null, ability: null })
function viewer() {
  return { matchId: 'private-room-match', seat: 'p2', cursor: 10, turn: 1, complete: true, result: null,
    own: { active: 'p2:1', team: [member('p2:1', 'Venusaur', 320, true), member('p2:2', 'Blastoise', 330, true, false)] },
    opponent: { active: 'p1:revealed:1', known: [member('p1:revealed:1', 'Charizard', 48, false)] },
    sideConditions: { p1: [], p2: [] }, fieldConditions: [], weather: null,
    decision: { id: 'private-room-match:p2:1', kind: 'move', moves: [] } }
}
function harness(overrides = {}) {
  const displays = [], requests = [], impacts = [], order = []
  const presenter = createSimulationPresenter({
    getScene: () => ({}), onDisplay: (view, options) => displays.push({ view: clone(view), options }),
    ensureScene: async (view, options) => { if (options.entryActorIds.length) order.push(`entry:${options.entryActorIds.join(',')}`) },
    faintScene: async (view, { actorIds }) => { order.push(`faint:${actorIds.join(',')}`); return { status: 'completed' } },
    playImpact: impact => { impacts.push(impact); return { finished: Promise.resolve() } },
    loadFx: async () => ({ play(request, options) {
      requests.push(request); order.push(`attack:${request.sourceId}`)
      options.onCue({ type: 'impact' })
      return { finished: Promise.resolve({ status: 'completed' }), cancel() {} }
    } }), ...overrides,
  })
  return { presenter, displays, requests, impacts, order }
}

test('a p2 viewer presents both attackers in its own near/far coordinates without exposing battle data to FX', async () => {
  const before = viewer(), after = clone(before)
  after.own.team[0].hp.current = 250; after.opponent.known[0].hp.current = 30
  after.cursor = 16; after.turn = 2
  const events = [event(11, 'move', 'p1:revealed:1', 'Flamethrower', 'p2:1'),
    event(12, '-supereffective', 'p2:1'), event(13, '-damage', 'p2:1', '250/320'),
    event(14, 'move', 'p2:1', 'Razor Leaf', 'p1:revealed:1'), event(15, '-damage', 'p1:revealed:1', '30/48'), event(16, 'turn', '2')]
  const batch = { before, after, events }, original = clone(batch), h = harness()
  assert.equal((await h.presenter.present(batch)).status, 'completed')
  assert.deepEqual(h.requests.map(({ sourceId, targetIds }) => ({ sourceId, targetIds })), [
    { sourceId: 'target', targetIds: ['source'] }, { sourceId: 'source', targetIds: ['target'] },
  ])
  assert.equal(h.impacts[0].actorId, 'source')
  assert.equal(h.impacts[0].memberId, 'p2:1')
  assert.equal(h.displays[0].view.own.team[0].hp.current, 250)
  assert.equal(h.displays[0].view.opponent.known[0].hp.current, 48, 'future opposing damage stays concealed until its cue')
  assert.deepEqual(h.displays.at(-1).view, after)
  assert(h.requests.every(request => !('state' in request) && !('hp' in request) && !('seat' in request)))
  assert.deepEqual(batch, original)
  const log = buildBattleLog(events, before, after)
  assert.equal(log[0].text, 'The opposing Charizard used Flamethrower!')
  assert(log.some(entry => entry.text === 'Venusaur used Razor Leaf!'))
  h.presenter.destroy()
})

test('p2 self-targeting and weather facts remain source-relative without remapping engine side conditions', async () => {
  const before = viewer(), after = clone(before)
  after.cursor = 14; after.sideConditions.p2 = ['move: Reflect']; after.weather = 'RainDance'
  const events = [event(11, 'move', 'p2:1', 'Reflect', 'p2:1'), event(12, '-sidestart', 'p2: p2', 'move: Reflect'),
    event(13, 'move', 'p1:revealed:1', 'Rain Dance', 'p1:revealed:1'), event(14, '-weather', 'RainDance')]
  const h = harness()
  await h.presenter.present({ before, after, events })
  assert.deepEqual(h.requests[0].targetIds, ['source'])
  assert.equal(h.requests[0].sourceId, 'source')
  assert.equal(h.requests[1].sourceId, 'target')
  assert.deepEqual(h.displays[0].view.sideConditions, { p1: [], p2: ['move: Reflect'] })
  assert.deepEqual(sideConditionLabels(h.displays[0].view), ['Your side: Reflect'])
  assert.equal(h.displays.at(-1).view.weather, 'RainDance')
  h.presenter.destroy()
})

test('p2 knockout retires the near actor before its replacement enters', async () => {
  const before = viewer(), after = clone(before)
  Object.assign(after.own.team[0], { hp: { current: 0, max: 320 }, fainted: true, active: false })
  after.own.team[1].active = true; after.own.active = 'p2:2'; after.cursor = 14
  const events = [event(11, 'move', 'p1:revealed:1', 'Flamethrower', 'p2:1'), event(12, '-damage', 'p2:1', '0 fnt'),
    event(13, 'faint', 'p2:1'), event(14, 'switch', 'p2:2', 'Blastoise, L100', '330/330')]
  const h = harness()
  await h.presenter.present({ before, after, events })
  assert.deepEqual(h.order, ['attack:target', 'faint:source', 'entry:source'])
  assert.deepEqual(h.displays[0].options.retainFaintedActorIds, ['source'])
  assert.equal(activeMembers(h.displays.at(-1).view)[0].species, 'Blastoise')
  h.presenter.destroy()
})

test('the real shared layout gives a p2 viewer back artwork near, front artwork far and unchanged platform slots', async () => {
  const view = viewer(), mounted = []
  const host = { appendChild: node => mounted.push(node) }
  const scene = createSimulationScene({ getHost: () => host, createHost: () => ({ remove() {} }),
    loadScene: async () => ({ previewSceneActors, createScene: async (staging, { actors }) => {
      const rendered = actors.map(spec => ({ ...spec, root: { visible: true } }))
      return { specs: actors, actor: id => rendered.find(actor => actor.id === id), dispose() {} }
    } }),
  })
  await scene.ensure(view)
  const specs = scene.get().specs
  assert.equal(specs[0].id, 'source'); assert.equal(specs[0].profile, 'venusaur'); assert.equal(specs[0].view, 'back')
  assert.equal(specs[1].id, 'target'); assert.equal(specs[1].profile, 'charizard'); assert.equal(specs[1].view, 'front')
  assert.equal(specs[0].y, .82); assert.equal(specs[1].y, previewSceneActors('venusaur', 'charizard')[1].y)
  assert.equal(mounted.length, 1)
  scene.destroy()
})

test('results, side labels and human introduction agree with the authenticated p2 perspective', () => {
  const view = viewer()
  view.sideConditions = { p1: ['move: Spikes'], p2: ['move: Reflect'] }
  view.result = { kind: 'win', winnerSeat: 'p2', reason: 'battle' }
  assert.equal(viewerResultTitle(view), 'You won the battle.')
  assert.equal(resultOverlay(view, null).kind, 'victory')
  assert.deepEqual(sideConditionLabels(view), ['Opponent: Spikes', 'Your side: Reflect'])
  view.result.winnerSeat = 'p1'
  assert.equal(viewerResultTitle(view), 'Your opponent won.')
  assert.equal(resultOverlay(view, null).kind, 'defeat')
  const intro = introOverlay(view, null, 'Johto explorers', { opponentName: 'Guest Oak', opponentTitle: 'Guest trainer' })
  assert.equal(intro.opponentName, 'Guest Oak'); assert.equal(intro.opponentTitle, 'Guest trainer')
  assert.equal(intro.playerLabel, 'Johto explorers'); assert.equal(intro.champion, false)
})

test('synchronizing a new room invalidates late p2 move cues and prevents an old result from repainting', async () => {
  let resolve, cue, cancelled = 0
  const finished = new Promise(done => { resolve = done })
  const before = viewer(), after = clone(before)
  after.cursor = 12; after.own.team[0].hp.current = 100
  const h = harness({ loadFx: async () => ({ play(request, options) {
    cue = options.onCue
    return { finished, cancel() { cancelled++ } }
  } }) })
  const pending = h.presenter.present({ before, after, events: [event(11, 'move', 'p1:revealed:1', 'Flamethrower', 'p2:1'), event(12, '-damage', 'p2:1', '100/320')] })
  await tick()
  const replacement = { ...viewer(), matchId: 'different-room-match' }
  h.presenter.reset(replacement)
  cue({ type: 'impact' }); resolve({ status: 'completed' })
  assert.equal((await pending).status, 'cancelled')
  assert.equal(cancelled, 1)
  assert.deepEqual(h.displays.at(-1).view, replacement)
  assert.equal(h.impacts.length, 0)
  h.presenter.destroy()
})
