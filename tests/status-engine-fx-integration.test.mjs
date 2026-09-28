import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createEngineFactory } from '@battle/battle-engine'
import { createReviewedBattleFx } from '../apps/shared/battle/reviewedFx.js'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createSimulationPresenter } from '../apps/shared/battle/presentation.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const factory = createEngineFactory()
const set = (species, ability, moves) => ({ species, ability, moves, nature: 'Serious' })
const fillers = () => [set('Charizard', 'Blaze', ['Protect']), set('Blastoise', 'Torrent', ['Protect']),
  set('Venusaur', 'Overgrow', ['Protect']), set('Raichu', 'Static', ['Protect']), set('Machamp', 'Guts', ['Protect'])]
function engineFor(lead, opponent) {
  return factory.create({ matchId: 'status-fx', seed: [1, 2, 3, 4], teams: { p1: [lead, ...fillers()], p2: [opponent, ...fillers()] } })
}
function choose(engine, turn, p1 = 1, p2 = 1) {
  const before = Object.fromEntries(['p1', 'p2'].map(seat => [seat, engine.getPlayerView(seat)]))
  for (const seat of ['p1', 'p2']) {
    const decision = engine.getDecision(seat)
    assert.equal(engine.submitDecision(seat, { commandId: `move-${turn}-${seat}`, decisionId: decision.id,
      action: { kind: 'move', slot: seat === 'p1' ? p1 : p2 } }).accepted, true)
  }
  return Object.fromEntries(['p1', 'p2'].map(seat => [seat, { before: before[seat], after: engine.getPlayerView(seat),
    events: engine.getEvents(seat).filter(event => event.cursor > before[seat].cursor) }]))
}
async function present(batch) {
  const scene = createSceneGraph({ textures: { charizard: Texture.WHITE, venusaur: Texture.WHITE } })
  const timelines = [], requests = [], results = [], impacts = [], displays = [], messages = [], layers = []
  const impactViews = [], reactions = [], order = []
  const fx = createReviewedBattleFx({ glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE,
    timelineEngine: { timeline(options) { const tl = gsap.timeline({ ...options, paused: true }); tl.play = () => tl; timelines.push(tl); return tl } },
  })
  const presenter = createSimulationPresenter({ getScene: () => scene, ensureScene: async () => {},
    onDisplay: view => displays.push(structuredClone(view)), onMessage: message => messages.push(message),
    playImpact: feedback => { impacts.push(feedback); return { finished: Promise.resolve(), cancel() {} } },
    loadConditions: async () => ({ playConditionReaction(request) {
      reactions.push({ request, view: structuredClone(displays.at(-1)) }); order.push(`reaction:${request.kind}`)
      return { finished: Promise.resolve({ status: 'completed' }), cancel() {} }
    } }),
    loadFx: async () => ({ getPresentationDeadlineMs: fx.getPresentationDeadlineMs, play(request, options) {
      requests.push(request)
      const run = fx.play(request, { ...options, onCue(cue) {
        options.onCue(cue)
        if (cue.type === 'impact') {
          impactViews.push({ moveId: request.moveId, view: structuredClone(displays.at(-1)) })
          order.push(`impact:${request.moveId}`)
        }
      } })
      run.finished.then(result => { results.push({ moveId: request.moveId, ...result }); order.push(`complete:${request.moveId}`) })
      return run
    } }),
  })
  const saved = structuredClone(batch)
  try {
    let done = false, result
    const pending = presenter.present(batch).then(value => { result = value; done = true })
    for (let i = 0, advanced = 0; i < 150 && !done; i++) {
      await tick()
      while (advanced < timelines.length) {
        const tl = timelines[advanced++]
        tl.time(tl.duration() * .5, false)
        layers.push(...scene.effects.children.flatMap(layer => layer.children.map(child => child.label)))
        tl.progress(1, false)
      }
    }
    assert.ok(done, 'all actual FX timelines complete without a presentation timeout')
    await pending
    assert.equal(result.status, 'completed')
    assert.deepEqual(displays.at(-1), batch.after); assert.deepEqual(batch, saved)
    assert.ok(results.every(result => result.status === 'completed'), JSON.stringify(results))
    assert.equal(scene.effects.children.length, 0)
    return { requests, results, impacts, messages, layers, impactViews, reactions, order }
  } finally { presenter.destroy(); fx.dispose(); scene.dispose(); gsap.ticker.sleep() }
}

test('real Swagger, Flatter and Perish Song partial successes reach their real recipes from both seats', async () => {
  for (const name of ['Swagger', 'Flatter', 'Perish Song']) {
    const opponent = name === 'Perish Song' ? set('Mr. Mime', 'Soundproof', ['Barrier']) : set('Smeargle', 'Own Tempo', ['Splash'])
    const engine = engineFor(set('Smeargle', 'Own Tempo', [name]), opponent)
    try {
      const batches = choose(engine, 1)
      for (const seat of ['p1', 'p2']) {
        const h = await present(batches[seat]), id = name.toLowerCase().replaceAll(' ', '-')
        assert.ok(batches[seat].events.some(event => event.args?.opcode === '-immune'))
        assert.equal(h.results.filter(result => result.moveId === id).length, 1)
        assert.equal(h.impacts.length, 0, 'a partial immune component is never a whole-move No effect overlay')
        assert.equal(h.requests.find(request => request.moveId === id).sourceId, seat === 'p1' ? 'source' : 'target')
      }
    } finally { engine.dispose() }
  }
})

test('real non-Ghost Curse selects self setup while Ghost Curse preserves its original opponent recipe', async () => {
  for (const ghost of [false, true]) {
    const engine = engineFor(set(ghost ? 'Gengar' : 'Snorlax', ghost ? 'Levitate' : 'Immunity', ['Curse']), set('Smeargle', 'Own Tempo', ['Splash']))
    try {
      const batches = choose(engine, 1)
      for (const seat of ['p1', 'p2']) {
        const h = await present(batches[seat]), request = h.requests.find(request => request.moveId === 'curse')
        assert.equal(request.variant, ghost ? undefined : 'self-setup')
        assert.deepEqual(request.targetIds, ghost ? [seat === 'p1' ? 'target' : 'source'] : [])
        assert.equal(h.results.find(result => result.moveId === 'curse').status, 'completed')
      }
    } finally { engine.dispose() }
  }
})

test('real Mirror Move casting completes before its separately reported copied attack', async () => {
  const engine = engineFor(set('Smeargle', 'Own Tempo', ['Splash', 'Mirror Move']), set('Snorlax', 'Immunity', ['Tackle']))
  try {
    choose(engine, 1)
    const batches = choose(engine, 2, 2)
    for (const seat of ['p1', 'p2']) {
      const h = await present(batches[seat])
      assert.deepEqual(h.requests.map(request => request.moveId), ['mirror-move', 'tackle', 'tackle'])
      assert.equal(h.requests[0].variant, 'source-cast'); assert.deepEqual(h.requests[0].targetIds, [])
      assert.equal(h.requests[1].variant, undefined)
      assert.equal(h.requests[0].sourceId, h.requests[1].sourceId)
      assert.notEqual(h.requests[1].sourceId, h.requests[1].targetIds[0])
    }
  } finally { engine.dispose() }
})

test('real Protect blocks Toxic casting and genuine Mirror Move failure never borrows a successful variant', async () => {
  for (const name of ['Toxic', 'Mirror Move']) {
    const opponent = name === 'Toxic' ? set('Smeargle', 'Own Tempo', ['Protect']) : set('Snorlax', 'Immunity', ['Amnesia'])
    const engine = engineFor(set('Smeargle', 'Own Tempo', [name]), opponent)
    try {
      const batches = choose(engine, 1)
      for (const seat of ['p1', 'p2']) {
        const h = await present(batches[seat]), id = name.toLowerCase().replaceAll(' ', '-')
        assert.equal(h.requests.filter(request => request.moveId === id).length, 0)
        assert.ok(batches[seat].events.some(event => ['-activate', '-fail'].includes(event.args?.opcode)))
      }
    } finally { engine.dispose() }
  }
})

test('real Safeguard and Mist activations block status and stat-drop casts without an accompanying fail opcode', async () => {
  for (const [attack, protection] of [['Toxic', 'Safeguard'], ['Growl', 'Mist']]) {
    const engine = engineFor(set('Smeargle', 'Own Tempo', [attack]), set('Smeargle', 'Own Tempo', [protection]))
    try {
      const batches = choose(engine, 1)
      for (const seat of ['p1', 'p2']) {
        const h = await present(batches[seat])
        assert.ok(batches[seat].events.some(event => event.args?.opcode === '-activate' && event.args.fields[1] === `move: ${protection}`))
        assert.ok(!batches[seat].events.some(event => event.args?.opcode === '-fail'))
        assert.equal(h.requests.filter(request => request.moveId === attack.toLowerCase()).length, 0)
        assert.equal(h.results.find(result => result.moveId === protection.toLowerCase()).status, 'completed')
      }
    } finally { engine.dispose() }
  }
})

test('real Yawn expiry keeps its badge and delayed sleep out of the preceding move impact', async () => {
  const engine = engineFor(set('Smeargle', 'Own Tempo', ['Yawn', 'Splash']), set('Smeargle', 'Own Tempo', ['Splash']))
  const affected = view => view.seat === 'p1' ? view.opponent.known[0] : view.own.team[0]
  try {
    choose(engine, 1)
    const batches = choose(engine, 2, 2)
    for (const seat of ['p1', 'p2']) {
      const batch = batches[seat], expiry = batch.events.find(event => event.args?.opcode === '-end' && event.args.fields[1] === 'move: Yawn')
      const sleep = batch.events.find(event => event.args?.opcode === '-status')
      assert.ok(expiry && sleep && expiry.cursor < sleep.cursor)
      assert.equal(sleep.args.fields.length, 2, 'actual Gen 3 sleep has no Yawn attribution')
      const h = await present(batch), preceding = h.impactViews.at(-1), reaction = h.reactions.find(row => row.request.kind === 'sleep')
      assert.equal(affected(preceding.view).condition, null)
      assert.ok(affected(preceding.view).volatiles.includes('move: Yawn'))
      assert.equal(affected(reaction.view).condition, 'slp')
      assert.ok(!affected(reaction.view).volatiles.includes('move: Yawn'))
      assert.ok(h.order.lastIndexOf('complete:splash') < h.order.indexOf('reaction:sleep'))
    }
  } finally { engine.dispose() }
})

test('real Shed Skin activation and cure follow the preceding move recovery from both seats', async () => {
  const engine = engineFor(set('Smeargle', 'Own Tempo', ['Toxic', 'Splash']), set('Dragonair', 'Shed Skin', ['Leer']))
  const affected = view => view.seat === 'p1' ? view.opponent.known[0] : view.own.team[0]
  try {
    choose(engine, 1)
    const batches = choose(engine, 2, 2)
    for (const seat of ['p1', 'p2']) {
      const batch = batches[seat], activation = batch.events.find(event => event.args?.opcode === '-activate' && event.args.fields[1] === 'ability: Shed Skin')
      const cure = batch.events.find(event => event.args?.opcode === '-curestatus')
      assert.ok(activation && cure && activation.cursor < cure.cursor)
      assert.deepEqual(cure.args.fields.slice(1), ['tox', '[msg]'], 'actual Gen 3 cure has no ability attribution')
      const h = await present(batch), preceding = h.impactViews.findLast(row => row.moveId === 'leer')
      const reaction = h.reactions.find(row => row.request.kind === 'cure')
      assert.equal(affected(preceding.view).condition, 'tox')
      assert.equal(affected(reaction.view).condition, null)
      assert.ok(h.order.lastIndexOf('complete:leer') < h.order.indexOf('reaction:cure'))
    }
  } finally { engine.dispose() }
})
