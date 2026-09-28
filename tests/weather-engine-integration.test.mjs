import test from 'node:test'
import assert from 'node:assert/strict'
import { createEngineFactory } from '@battle/battle-engine'
import { createSimulationPresenter } from '../apps/shared/battle/presentation.js'

const factory = createEngineFactory()
const set = (species, ability, moves = ['Protect']) => ({ species, ability, moves, nature: 'Serious' })
const fillers = () => [set('Charizard', 'Blaze'), set('Blastoise', 'Torrent'), set('Venusaur', 'Overgrow'), set('Raichu', 'Static'), set('Machamp', 'Guts')]
const weatherMoves = [['Rain Dance', 'RainDance', 'rain'], ['Sunny Day', 'SunnyDay', 'sun'], ['Sandstorm', 'Sandstorm', 'sandstorm'], ['Hail', 'Hail', 'hail']]
function harness() {
  const clips = [], displays = [], moves = []
  const presenter = createSimulationPresenter({ getScene: () => ({}), ensureScene: async () => {},
    onDisplay: view => displays.push(structuredClone(view)),
    loadFx: async () => ({ play(request, options) {
      moves.push(request); options.onCue({ type: 'impact' })
      return { finished: Promise.resolve({ status: 'completed' }), cancel() {} }
    } }),
    loadWeather: async () => ({ playWeatherContinuation(request) {
      clips.push(request); return { finished: Promise.resolve({ status: 'completed' }), cancel() {} }
    } }),
  })
  return { presenter, clips, displays, moves }
}
function chooseTurn(engine, turn, slots) {
  for (const seat of ['p1', 'p2']) {
    const decision = engine.getDecision(seat)
    assert.equal(decision.kind, 'move')
    assert.equal(engine.submitDecision(seat, { commandId: `weather-${turn}-${seat}`, decisionId: decision.id,
      action: { kind: 'move', slot: slots[seat] } }).accepted, true)
  }
}
async function presentLatest(engine, seat, before, h) {
  const after = engine.getPlayerView(seat), events = engine.getEvents(seat).filter(event => event.cursor > (before?.cursor ?? 0))
  const batch = { before, after, events }, saved = structuredClone(batch)
  assert.equal((await h.presenter.present(batch)).status, 'completed')
  assert.deepEqual(h.displays.at(-1), after); assert.deepEqual(batch, saved)
  return { after, events }
}

test('real Gen 3 weather moves supply four upkeep cues and expiry on turn five from both private projections', async () => {
  for (const [move, protocol, weatherId] of weatherMoves) {
    const team = [set('Smeargle', 'Own Tempo', [move, 'Splash']), ...fillers()]
    const engine = factory.create({ matchId: `weather-${weatherId}`, seed: [1, 2, 3, 4], teams: { p1: team, p2: team } })
    const hosts = { p1: harness(), p2: harness() }
    try {
      for (let turn = 1; turn <= 6; turn++) {
        const before = Object.fromEntries(['p1', 'p2'].map(seat => [seat, engine.getPlayerView(seat)]))
        chooseTurn(engine, turn, { p1: turn === 1 ? 1 : 2, p2: 2 })
        for (const seat of ['p1', 'p2']) {
          const { after, events } = await presentLatest(engine, seat, before[seat], hosts[seat])
          const facts = events.filter(event => event.args?.opcode === '-weather').map(event => event.args.fields)
          assert.equal(after.weather, turn < 5 ? protocol : null)
          assert.deepEqual(facts, turn === 1 ? [[protocol], [protocol, '[upkeep]']] : turn < 5 ? [[protocol, '[upkeep]']] : turn === 5 ? [['none']] : [])
          assert.equal(hosts[seat].clips.length, Math.min(turn, 4), 'only actual upkeep cues repeat; expiry never casts weather')
          assert.ok(hosts[seat].clips.every(clip => clip.weatherId === weatherId))
          assert.equal(hosts[seat].moves.filter(request => request.moveId === weatherId || request.moveId === ({ rain: 'rain-dance', sun: 'sunny-day' })[weatherId]).length, 1)
          if (['Sandstorm', 'Hail'].includes(protocol) && turn < 5) {
            const upkeep = events.findIndex(event => event.args?.opcode === '-weather' && event.args.fields.includes('[upkeep]'))
            const residual = events.findIndex(event => event.args?.opcode === '-damage' && event.args.fields.includes(`[from] ${protocol}`))
            assert.ok(upkeep >= 0 && residual > upkeep, 'the engine places weather continuation before weather damage')
          }
        }
      }
    } finally { engine.dispose(); hosts.p1.presenter.destroy(); hosts.p2.presenter.destroy() }
  }
})

test('real Drizzle, Drought and Sand Stream openings animate once then follow their permanent Gen 3 upkeep facts', async () => {
  for (const [species, ability, protocol, weatherId] of [
    ['Kyogre', 'Drizzle', 'RainDance', 'rain'], ['Groudon', 'Drought', 'SunnyDay', 'sun'], ['Tyranitar', 'Sand Stream', 'Sandstorm', 'sandstorm'],
  ]) {
    const engine = factory.create({ matchId: `ability-${weatherId}`, seed: [1, 2, 3, 4], teams: {
      p1: [set(species, ability), ...fillers()], p2: [set('Smeargle', 'Own Tempo', ['Splash']), ...fillers()],
    } }), h = harness()
    try {
      const opening = await presentLatest(engine, 'p1', null, h)
      assert.equal(opening.after.turn, 1); assert.equal(opening.after.weather, protocol)
      assert.equal(h.clips.length, 1); assert.equal(h.clips[0].weatherId, weatherId)
      assert.ok(opening.events.some(event => event.args?.opcode === '-weather' && event.args.fields.includes(`[from] ability: ${ability}`)))
      for (let turn = 1; turn <= 6; turn++) {
        const before = engine.getPlayerView('p1')
        chooseTurn(engine, turn, { p1: 1, p2: 1 })
        const { after } = await presentLatest(engine, 'p1', before, h)
        assert.equal(after.weather, protocol, 'ability weather does not expire after five turns in Gen 3')
        assert.equal(h.clips.length, turn + 1)
      }
    } finally { engine.dispose(); h.presenter.destroy() }
  }
})

test('Air Lock and Cloud Nine preserve weather upkeep presentation without inventing suppressed residual damage', async () => {
  for (const [species, ability] of [['Rayquaza', 'Air Lock'], ['Golduck', 'Cloud Nine']]) {
    const engine = factory.create({ matchId: 'suppressed-weather', seed: [1, 2, 3, 4], teams: {
      p1: [set('Smeargle', 'Own Tempo', ['Sandstorm', 'Splash']), ...fillers()], p2: [set(species, ability), ...fillers()],
    } }), h = harness()
    try {
      for (let turn = 1; turn <= 2; turn++) {
        const before = engine.getPlayerView('p1')
        chooseTurn(engine, turn, { p1: turn === 1 ? 1 : 2, p2: 1 })
        const { after, events } = await presentLatest(engine, 'p1', before, h)
        assert.equal(after.weather, 'Sandstorm'); assert.equal(h.clips.length, turn)
        assert.equal(after.own.team[0].hp.current, before.own.team[0].hp.current)
        assert.ok(!events.some(event => event.args?.opcode === '-damage'), 'suppression remains entirely engine-owned')
      }
    } finally { engine.dispose(); h.presenter.destroy() }
  }
})
