import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { survivalStartCommand, survivalAdvanceCommand, readSurvivalStart, saveSurvivalStart, displayedSurvivors, survivalEndingText } from '../apps/simulation/src/survival.js'
import { introOverlay, resultOverlay, createBattleSequence } from '../apps/shared/battle/sequence.js'
import { resolvePageRoute } from '../apps/server/pageRoutes.js'

function challenge(status = 'between-rounds') {
  return { kind: 'survival', id: 'run', revision: 7, roundNumber: 3, wins: 3, status, roster: [
    { id: 'slot:1', memberId: 'p1:2', species: 'Pikachu', hp: 120, maxHp: 200, eliminated: false },
    { id: 'slot:2', memberId: 'p1:1', species: 'Raichu', hp: 160, maxHp: 320, eliminated: false },
  ] }
}

test('start intent is detached, ownership-bound and exactly restored after a lost response', () => {
  const team = [{ species: 'Pikachu', moves: ['Thunderbolt'] }]
  const body = survivalStartCommand({ selection: { team }, leadIndex: 0, ownerId: 'owner', ownerRevision: 4, operationId: 'start-one' })
  team[0].moves[0] = 'Surf'
  assert.equal(body.team[0].moves[0], 'Thunderbolt')
  assert.equal(body.expectedOwnerId, 'owner')
  assert.equal(body.expectedOwnerRevision, 4)
  assert.equal(body.expectedRunRevision, null)
  assert.equal(body.expectedMatchId, null)
  assert.equal('regionId' in body, false)
  const stored = new Map(), storage = { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) }
  saveSurvivalStart(storage, body)
  assert.deepEqual(readSurvivalStart(storage), body)
  saveSurvivalStart(storage, null)
  assert.equal(readSurvivalStart(storage), null)
})

test('unavailable or malformed session storage does not prevent in-memory recovery', () => {
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.equal(readSurvivalStart(blocked), null)
  assert.doesNotThrow(() => saveSurvivalStart(blocked, { mode: 'survival' }))
  assert.equal(readSurvivalStart({ getItem: () => '{broken' }), null)
  assert.equal(readSurvivalStart({ getItem: () => 'x'.repeat(25001) }), null)
  assert.equal(readSurvivalStart({ getItem: () => JSON.stringify({ mode: 'survival', operationId: 'x', leadIndex: 8 }) }), null)
})

test('continue accepts a revived lead by stable run identity without sending HP', () => {
  const run = challenge()
  assert.deepEqual(survivalAdvanceCommand(run, 'match-three', 'slot:1', 'advance-one'), {
    runId: 'run', matchId: 'match-three', revision: 7, operationId: 'advance-one', leadMemberId: 'slot:1',
  })
  assert.deepEqual(survivalAdvanceCommand(run, 'match-three', 'slot:2', 'revived-lead'), {
    runId: 'run', matchId: 'match-three', revision: 7, operationId: 'revived-lead', leadMemberId: 'slot:2',
  })
  run.roster[1].hp = 0
  run.roster[1].eliminated = true
  assert.throws(() => survivalAdvanceCommand(run, 'match-three', 'slot:2', 'advance-one'), /available/)
  assert.throws(() => survivalAdvanceCommand(challenge('active'), 'match-three', 'slot:1', 'advance-one'), /available/)
})

test('reconnecting during next-round construction restores the original operation and revision', () => {
  const run = challenge('starting-next')
  run.revision = 8
  run.pending = { operationId: 'prepared-once', leadMemberId: 'slot:1', expectedRevision: 7, matchId: 'match-three' }
  assert.deepEqual(survivalAdvanceCommand(run, 'wrong-current', 'slot:2', 'new-operation'), {
    runId: 'run', matchId: 'match-three', revision: 7, operationId: 'prepared-once', leadMemberId: 'slot:1',
  })
})

test('six-slot roster follows stable member IDs and waits for final faint/recovery presentation', () => {
  const run = challenge()
  const before = { own: { team: [
    { memberId: 'p1:1', hp: { current: 40, max: 320 }, fainted: false },
    { memberId: 'p1:2', hp: { current: 70, max: 200 }, fainted: false },
  ] } }
  assert.deepEqual(displayedSurvivors(run, before, true).map(member => [member.id, member.hp, member.eliminated]), [['slot:1', 70, false], ['slot:2', 40, false]])
  const atFaint = { own: { team: before.own.team.map(member => member.memberId === 'p1:1' ? { ...member, hp: { current: 0, max: 320 }, fainted: true } : member) } }
  assert.deepEqual(displayedSurvivors(run, atFaint, true).map(member => [member.id, member.hp, member.eliminated]), [['slot:1', 70, false], ['slot:2', 0, true]])
  assert.deepEqual(displayedSurvivors(run, atFaint, false).map(member => [member.id, member.hp, member.eliminated]), [['slot:1', 120, false], ['slot:2', 160, false]])
  assert.equal(run.roster[1].hp, 160, 'faint playback never overwrites committed revival')
  run.status = 'active'
  assert.equal(displayedSurvivors(run, before)[0].hp, 70)
  assert.equal(run.roster[0].hp, 120, 'presentation never mutates the authoritative roster')
})

test('Survival overlays show round identity without league labels and reconnect does not replay results', async () => {
  const run = challenge(), view = { matchId: 'm', seat: 'p1', result: { kind: 'win', winnerSeat: 'p1' } }
  const intro = introOverlay({ ...view, result: null }, run)
  assert.equal(intro.roundLabel, 'Round 3')
  assert.equal(intro.opponentName, 'Random team')
  assert.equal(intro.champion, false)
  assert.equal(resultOverlay(view, run).eyebrow, 'Survival · Round 3')
  const overlays = []
  const sequence = createBattleSequence({ presenter: { reset() {}, present: async () => ({ status: 'completed' }), skip() {}, destroy() {} }, onOverlay: value => overlays.push(value), timers: { setTimeout() { assert.fail('Reconnect must not schedule an overlay animation') }, clearTimeout() {} } })
  sequence.reset(view, { run })
  assert.equal(overlays.at(-1).animated, false)
  await sequence.present({ before: view, after: view, run, events: [] }, { effectsEnabled: false })
  assert.equal(overlays.at(-1).animated, false)
  sequence.destroy()
  assert.match(survivalEndingText('forfeit'), /forfeited/)
  assert.match(survivalEndingText('no-survivors'), /No Pokémon/)
})

test('Survival uses the same client entry and canonical public URL', async () => {
  assert.deepEqual(resolvePageRoute('/survival'), { path: '/survival', file: 'survival.html', redirect: false })
  assert.equal(resolvePageRoute('/survival.html').redirect, true)
  const html = await readFile(new URL('../survival.html', import.meta.url), 'utf8')
  assert.match(html, /\/apps\/simulation\/src\/main.js/)
})

test('Survival and entry Vue components compile with the existing shared battle host', async () => {
  for (const path of ['apps/simulation/src/App.vue', 'apps/multiplayer/src/App.vue', 'apps/home/src/Home.vue']) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8')
    const parsed = parse(source, { filename: path })
    assert.deepEqual(parsed.errors, [])
    const script = compileScript(parsed.descriptor, { id: path })
    const template = compileTemplate({ source: parsed.descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [])
  }
})
