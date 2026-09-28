import './helpers/headless-pixi.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import { Texture } from 'pixi.js'
import { gsap } from 'gsap'
import { createSceneGraph } from '../apps/game/src/scene/index.js'
import { createSimulationPresenter } from '../apps/shared/battle/presentation.js'
import { createBattleSequence } from '../apps/shared/battle/sequence.js'
import { createReviewedBattleFx } from '../apps/shared/battle/reviewedFx.js'
import { createRoomSession } from '../apps/multiplayer/src/roomSession.js'
import { saveSurvivalStart, survivalAdvanceCommand } from '../apps/simulation/src/survival.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const ref = value => ({ value })
const clone = value => structuredClone(value)
const event = (cursor, opcode, ...fields) => ({ cursor, type: 'protocol', args: { opcode, fields } })

// Exercise the production host callbacks and shared BattleView bindings rather
// than copying their request forwarding into the test harness. Only browser
// mounting, clock progression and sound output are replaced.
function hostSource(path) {
  const { descriptor } = parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
  const ast = compileScript(descriptor, { id: 'multihit-host-integration' }).scriptSetupAst
  const source = node => { assert.ok(node, `Host binding exists in ${path}`); return descriptor.scriptSetup.content.slice(node.start, node.end) }
  return {
    functions: names => names.map(name => source(ast.find(node => node.type === 'FunctionDeclaration' && node.id.name === name))).join('\n'),
    initializer: name => source(ast.flatMap(node => node.declarations ?? []).find(node => node.id.name === name)?.init),
  }
}
const sharedSource = hostSource('../apps/shared/battle/BattleView.vue')
const simulationSource = hostSource('../apps/simulation/src/App.vue').functions(['acceptResponse'])
const privateSource = hostSource('../apps/multiplayer/src/App.vue').initializer('session')

function batch({ seat = 'p1', reverse = false, name = 'Bullet Seed', count = 5, cursor = 10 } = {}) {
  const other = seat === 'p1' ? 'p2' : 'p1', own = `${seat}:1`, opponent = `${other}:revealed:1`
  const pokemon = (memberId, species, hpPrecision) => ({ memberId, species, name: species,
    hp: { current: 100, max: 100 }, hpPrecision, active: true, fainted: false,
    condition: null, stages: {}, volatiles: [], moves: [], item: null, ability: null })
  const before = { matchId: 'host-hits', complete: true, seat, cursor, turn: 1, result: null,
    own: { active: own, team: [pokemon(own, 'Charizard', 'exact')] },
    opponent: { active: opponent, known: [pokemon(opponent, 'Venusaur', 'public')] },
    weather: null, fieldConditions: [], sideConditions: { p1: [], p2: [] },
    decision: { id: 'choice', kind: 'move', moves: [] } }
  const target = reverse ? own : opponent
  const events = [event(++cursor, 'move', reverse ? opponent : own, name, target)]
  for (let i = 1; i <= count; i++) events.push(event(++cursor, '-damage', target, `${100 - i * 5}/100`))
  events.push(event(++cursor, '-hitcount', target, String(count)))
  const after = clone(before)
  after.cursor = cursor; after.turn = 2
  ;(reverse ? after.own.team[0] : after.opponent.known[0]).hp.current = 100 - count * 5
  return { before, after, events }
}

function sharedBattle(t) {
  const timelines = [], frames = [], sounds = [], messages = [], plays = []
  const graph = createSceneGraph({ textures: { charizard: Texture.WHITE, venusaur: Texture.WHITE } })
  const fx = createReviewedBattleFx({ glowTexture: Texture.WHITE, assetLoader: async () => Texture.WHITE,
    timelineEngine: { timeline(options) {
      const raw = gsap.timeline({ ...options, paused: true }); raw.play = () => raw
      timelines.push(raw); return raw
    } },
  })
  const scopedAudio = { move(request) {
    const sound = { request, presentations: [], finished: null, cancelled: false,
      onPresentation(cue) { sound.presentations.push(cue) },
      finish(result) { sound.finished = result }, cancel() { sound.cancelled = true },
    }
    sounds.push(sound); return sound
  }, cancel() { for (const sound of sounds) sound.cancel() }, entry() {}, transition() {} }
  const audio = { begin: () => scopedAudio, sync: () => scopedAudio.cancel(), stop: () => scopedAudio.cancel(), setMusicContext() {} }
  const displayed = ref(null), playing = ref(false), hitStep = ref(false), effectsEnabled = ref(true)
  const scene = { get: () => graph, ensure: async () => {}, faint: async () => ({ status: 'completed' }),
    display(view, options) { frames.push({ view: clone(view), options }) }, clear() {},
    setEffectsEnabled() {}, setIdleMotion() {} }
  const bindings = { displayed, playing, hitStep, effectsEnabled, scene, createBattleSequence, nextTick: async () => {},
    props: { audio, playerLabel: 'Your team', opponentName: 'Opponent', opponentTitle: 'Battle trainer', inactive: false },
    pageVisible: ref(true), reducedMotion: ref(false), openingBattle: ref(false), message: ref(''), battleOverlay: ref(null),
    emit(type, value) { if (type === 'message') messages.push(value) },
    playImpact: () => ({ finished: Promise.resolve() }), impactPlayer: { clear() {} },
    createSimulationPresenter: options => createSimulationPresenter({ ...options, loadFx: async () => ({
      getPresentationDeadlineMs: fx.getPresentationDeadlineMs,
      play(request, options) { plays.push(request); return fx.play(request, options) },
    }) }),
  }
  const view = new Function(...Object.keys(bindings), `
    let audioScope = null, generation = 0, disposed = false;
    const current = token => !disposed && generation === token;
    const movePresenter = (${sharedSource.initializer('movePresenter')});
    const presenter = (${sharedSource.initializer('presenter')});
    ${sharedSource.functions(['present', 'sync', 'clear', 'skip', 'playback', 'publishMessage', 'readyMessage'])}
    return { present, sync, clear, skip, getDisplayed: () => displayed.value, destroy: () => presenter.destroy() };
  `)(...Object.values(bindings))
  t.after(() => { view.destroy(); fx.dispose(); graph.dispose(); gsap.ticker.sleep() })
  return { view, audio, timelines, frames, sounds, messages, plays, displayed, playing, hitStep }
}

function simulationHost(h, before) {
  const refs = Object.fromEntries(['latest', 'run', 'regionId', 'teamMode', 'customTeam', 'leadIndex', 'presetId',
    'pendingChoice', 'pendingAdvance', 'pendingStart', 'nextLeadMemberId', 'pendingQuit', 'busy', 'confirmingForfeit', 'message', 'error'].map(name => [name, ref(null)]))
  h.displayed.value = before
  const bindings = { ...refs, displayed: h.displayed, playing: h.playing, battleAudio: h.audio,
    log: ref([]), resultTitle: ref('Battle complete'), selectedTeamLabel: ref('Your team'), battleView: ref(h.view),
    isCurrent: token => token === 1, createTeamDraft: team => team, nextTick: async () => {}, readyText: () => 'Choose a move',
    showBattle() {}, addLog() {}, saveSurvivalStart, survivalAdvanceCommand,
    survival: { get value() { return refs.run.value?.kind === 'survival' } },
  }
  return new Function(...Object.keys(bindings), `${simulationSource}; return acceptResponse`)(...Object.values(bindings))
}

function privateHost(h) {
  const state = ref({ envelope: null }), error = ref('')
  const bindings = { state, error, battleAudio: h.audio, createRoomSession, nextTick: async callback => callback?.(),
    pendingOperation: ref(null), displayed: h.displayed, log: ref([]), logHost: ref(null),
    editorOpen: ref(false), generating: ref(false), notice: ref(''), selectionIssues: ref([]), selectionChanges: ref([]),
    room: { get value() { return state.value.envelope?.room } }, buildBattleLog: () => [], battle: ref(h.view),
  }
  const session = new Function(...Object.keys(bindings), `return (${privateSource})`)(...Object.values(bindings))
  return { session, error }
}
const envelope = (view, revision, events = []) => ({ protocolVersion: 1, matchId: view.matchId, revision, view, events,
  room: { id: 'private-hits', seat: view.seat, status: 'active', own: { name: 'Player' }, opponent: { name: 'Opponent' } } })

async function playContacts(h, { count, reverse = false, index = 0 }) {
  await tick()
  const timeline = h.timelines[index], sound = h.sounds[index]
  assert.ok(timeline, 'host starts the real reviewed FX runtime')
  assert.equal(h.plays[index].hitCount, count)
  assert.equal(sound.request.hitCount, count)
  assert.equal(h.plays[index].sourceId, reverse ? 'target' : 'source')
  assert.equal(sound.presentations[0].hitTimes.length, count, 'audio receives every actual contact time')
  for (let i = 0; i < count; i++) {
    timeline.time(timeline.data.hitTimes[i] + .00001, false)
    const recipient = reverse ? h.displayed.value.own.team[0] : h.displayed.value.opponent.known[0]
    assert.equal(recipient.hp.current, 100 - (i + 1) * 5)
    assert.equal(h.hitStep.value, true, 'BattleView enables the shorter per-hit HP transition')
    assert.equal(h.playing.value, true, 'controls stay locked between contacts')
  }
  timeline.time(timeline.duration(), false)
  await tick()
  assert.equal(sound.finished?.status, 'completed')
  assert.ok(h.messages.includes(`Hit ${count} times!`))
}

test('Regional League and Survival responses reach real counted FX and per-contact HUD updates', async t => {
  for (const kind of ['league', 'survival']) for (const reverse of [false, true]) {
    const input = batch({ reverse, name: reverse ? 'Double Kick' : 'Bullet Seed', count: reverse ? 2 : 5 }), h = sharedBattle(t)
    const acceptResponse = simulationHost(h, input.before)
    const run = kind === 'league' ? { status: 'active', regionId: 'kanto', opponent: { title: 'Elite Four' } }
      : { kind: 'survival', status: 'active', roundNumber: 1, roster: [{ id: 'slot:1', eliminated: false }] }
    const pending = acceptResponse({ matchId: input.after.matchId, view: input.after, events: input.events, run }, 1)
    await playContacts(h, { count: reverse ? 2 : 5, reverse }); await pending
    assert.deepEqual(h.displayed.value, input.after)
    assert.equal(h.playing.value, false)
  }
})

test('private-room delivery preserves every hit for both seats and rejects duplicate result delivery', async t => {
  for (const seat of ['p1', 'p2']) for (const reverse of [false, true]) {
    const input = batch({ seat, reverse, name: 'Beat Up', count: 6 }), h = sharedBattle(t), { session, error } = privateHost(h)
    t.after(() => session.dispose())
    session.enter(envelope(input.before, 1), { synchronize: true }); await tick()
    const response = envelope(input.after, 2, input.events)
    session.ingest(response); session.ingest(response)
    await playContacts(h, { count: 6, reverse })
    assert.equal(h.plays.length, 1)
    assert.equal(session.snapshot().playing, false)
    assert.deepEqual(session.snapshot().displayed, input.after)
    assert.equal(error.value, '')
  }
})

test('private reconnect cancels the remaining real contacts and immediately restores the authoritative HP', async t => {
  const input = batch({ seat: 'p2' }), h = sharedBattle(t), { session, error } = privateHost(h)
  t.after(() => session.dispose())
  session.enter(envelope(input.before, 1), { synchronize: true }); await tick()
  session.ingest(envelope(input.after, 2, input.events)); await tick()
  const timeline = h.timelines[0]
  timeline.time(timeline.data.hitTimes[0] + .00001, false)
  assert.equal(h.displayed.value.opponent.known[0].hp.current, 95)
  session.ingest(envelope(input.after, 3), { synchronize: true }); await tick()
  assert.deepEqual(h.displayed.value, input.after)
  assert.equal(h.sounds[0].cancelled, true)
  const frameCount = h.frames.length
  timeline.time(timeline.duration(), false); await tick()
  assert.equal(h.frames.length, frameCount, 'cancelled contacts cannot repaint the synchronized battle')
  assert.equal(session.snapshot().playing, false)
  assert.equal(error.value, '')
})
