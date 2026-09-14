import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { createEngineFactory } from '../src/index.js';
import { createTeamFixture } from '../fixtures/team-fixtures.js';

const factory = createEngineFactory();
const options = () => ({ matchId: 'recovery-test', seed: [1, 2, 3, 4], teams: { p1: createTeamFixture(), p2: createTeamFixture() } });
const command = (engine, seat, id, action) => {
  const decision = engine.getDecision(seat);
  action ??= decision.kind === 'switch' ? { kind: 'switch', memberId: decision.switches[0].memberId }
    : { kind: 'move', slot: decision.moves.find(move => !move.disabled)?.slot };
  return { commandId: id, decisionId: decision.id, action };
};
function batch(engine, prefix) {
  for (const seat of ['p1', 'p2']) {
    if (['move', 'switch'].includes(engine.getDecision(seat).kind)) {
      assert.equal(engine.submitDecision(seat, command(engine, seat, `${prefix}-${seat}`)).accepted, true);
    }
  }
}
function finish(engine) {
  for (let index = 0; index < 100 && engine.getDecision('p1').kind !== 'finished'; index++) batch(engine, `step-${index}`);
  assert.equal(engine.getDecision('p1').kind, 'finished');
}
const views = engine => ['p1', 'p2'].map(seat => engine.getPlayerView(seat));
const events = engine => ['p1', 'p2'].map(seat => engine.getEvents(seat));
const state = engine => JSON.parse(engine.exportCheckpoint()).payload;

test('one accepted choice keeps the opponent request valid; same-seat retry is idempotent', t => {
  const engine = factory.create(options()); t.after(() => engine.dispose());
  const first = command(engine, 'p1', 'shared-id');
  const second = command(engine, 'p2', 'shared-id');
  const accepted = engine.submitDecision('p1', first);
  const afterFirst = engine.exportCheckpoint();
  assert.equal(accepted.accepted, true);
  assert.equal(engine.getDecision('p1').kind, 'wait');
  assert.equal(engine.getDecision('p2').id, second.decisionId);
  assert.deepEqual(engine.submitDecision('p1', first), accepted);
  assert.equal(engine.exportCheckpoint(), afterFirst);
  assert.equal(engine.submitDecision('p2', second).accepted, true, 'retry keys are scoped to each seat');
  assert.equal(engine.getPlayerView('p1').turn, 2);
  assert.deepEqual(engine.submitDecision('p1', first), accepted);
  assert.equal(engine.submitDecision('p1', { ...first, action: { kind: 'move', slot: 4 } }).code, 'COMMAND_ID_REUSED');
});

test('invalid and stale intent cannot run raw simulator commands or consume RNG/HP/PP', t => {
  const engine = factory.create(options()); t.after(() => engine.dispose());
  const before = state(engine);
  assert.equal(engine.submitDecision('p1', { ...command(engine, 'p1', 'bad'), action: { kind: 'eval', code: 'forcewin p1' } }).code, 'INVALID_ACTION');
  assert.equal(engine.submitDecision('p1', command(engine, 'p1', 'bad-slot', { kind: 'move', slot: 99 })).code, 'ILLEGAL_ACTION');
  assert.equal(engine.submitDecision('p1', { ...command(engine, 'p1', 'old'), decisionId: 'older-request' }).code, 'STALE_DECISION');
  assert.equal(engine.submitDecision('p1', command(engine, 'p1', 'bad-switch', { kind: 'switch', memberId: 'p2:2' })).code, 'ILLEGAL_ACTION');
  assert.throws(() => engine.submitDecision('p3', command(engine, 'p1', 'cross')), { code: 'INVALID_SEAT' });
  let accessed = false;
  assert.equal(engine.submitDecision('p1', { get commandId() { accessed = true; return 'accessor'; } }).code, 'INVALID_COMMAND');
  assert.equal(accessed, false);
  assert.equal(engine.submitDecision('p1', command(engine, 'p1', 'bigint', { kind: 'move', slot: 1n })).code, 'INVALID_COMMAND');
  assert.throws(() => engine.adjudicate({ kind: 'forfeit', seat: 'p1', reason: 'infrastructure' }), { code: 'INVALID_ADJUDICATION' });
  const after = state(engine);
  assert.deepEqual(after.battle, before.battle);
  assert.deepEqual(after.projection, before.projection);
});

test('pending-choice checkpoint and replay preserve exact player views, private cursors and continuation', t => {
  const original = factory.create(options()); t.after(() => original.dispose());
  const p1 = command(original, 'p1', 'pending');
  original.submitDecision('p1', p1);
  const snapshot = original.exportCheckpoint();
  const restored = factory.restore(snapshot); t.after(() => restored.dispose());
  const replayed = factory.replay(original.exportReplay()); t.after(() => replayed.dispose());
  assert.deepEqual(views(restored), views(original));
  assert.deepEqual(events(restored), events(original));
  assert.deepEqual(views(replayed), views(original));
  assert.deepEqual(restored.submitDecision('p1', p1), original.submitDecision('p1', p1));
  for (const engine of [original, restored, replayed]) finish(engine);
  assert.deepEqual(views(restored), views(original));
  assert.deepEqual(events(restored), events(original));
  assert.deepEqual(views(replayed), views(original));
  assert.deepEqual(events(replayed), events(original));
  assert.equal(JSON.parse(snapshot).payload.result, null, 'saved bytes cannot alias the advancing battle');
});

test('checkpoints resolve the exact custom format in a fresh Node process', t => {
  const engine = factory.create(options()); t.after(() => engine.dispose());
  engine.submitDecision('p1', command(engine, 'p1', 'pending-fresh-process'));
  const url = new URL('../src/index.js', import.meta.url).href;
  const script = `import fs from 'node:fs'; import {createEngineFactory} from ${JSON.stringify(url)}; const e=createEngineFactory().restore(fs.readFileSync(0,'utf8')); process.stdout.write(JSON.stringify([e.getIdentity(),e.getPlayerView('p1'),e.getPlayerView('p2')])); e.dispose();`;
  const restored = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { input: engine.exportCheckpoint(), encoding: 'utf8' }));
  assert.deepEqual(restored, [engine.getIdentity(), ...views(engine)]);
});

test('checkpoint corruption, wrong engine identity and unsafe JSON are rejected', t => {
  const engine = factory.create(options()); t.after(() => engine.dispose());
  const snapshot = engine.exportCheckpoint();
  assert.throws(() => factory.restore(snapshot.replace('recovery-test', 'corrupted-id')), { code: 'INVALID_CHECKPOINT' });
  const invalid = JSON.parse(snapshot);
  invalid.payload.identity.engine.version = '0.0.0';
  const sort = value => Array.isArray(value) ? value.map(sort) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])])) : value;
  invalid.sha256 = createHash('sha256').update(JSON.stringify(sort(invalid.payload))).digest('hex');
  assert.throws(() => factory.restore(invalid), { code: 'INCOMPATIBLE_CHECKPOINT' });
  assert.throws(() => factory.restore('{"__proto__":{"polluted":true}}'), { code: 'INVALID_RECORD' });
  assert.equal({}.polluted, undefined);
});

test('forfeit, draw and no-contest are terminal, durable and replayable system decisions', t => {
  for (const decision of [{ kind: 'forfeit', seat: 'p1', reason: 'timeout' }, { kind: 'draw', reason: 'agreement' }, { kind: 'no-contest', reason: 'infrastructure' }]) {
    const engine = factory.create(options()); t.after(() => engine.dispose());
    engine.submitDecision('p1', command(engine, 'p1', 'pending-system'));
    const result = engine.adjudicate(decision);
    const settled = engine.exportCheckpoint();
    assert.deepEqual(engine.adjudicate(decision), result);
    assert.equal(engine.exportCheckpoint(), settled, 'terminal adjudication is idempotent');
    const restored = factory.restore(settled); t.after(() => restored.dispose());
    const replayed = factory.replay(engine.exportReplay()); t.after(() => replayed.dispose());
    assert.deepEqual(views(restored), views(engine));
    assert.deepEqual(views(replayed), views(engine));
    assert.equal(restored.getDecision('p2').kind, 'finished');
    assert.equal(restored.submitDecision('p2', { commandId: 'late', decisionId: restored.getDecision('p2').id, action: { kind: 'move', slot: 1 } }).code, 'MATCH_FINISHED');
  }
});

test('fresh Sodium seeds remain private and replay with identical outcomes', t => {
  const input = options(); delete input.seed;
  const first = factory.create(input); const second = factory.create(input);
  t.after(() => { first.dispose(); second.dispose(); });
  assert.match(state(first).initial.seed, /^sodium,[a-f0-9]{64}$/);
  assert.notEqual(state(first).initial.seed, state(second).initial.seed);
  const rawView = JSON.stringify([views(first), events(first)]);
  assert(!rawView.includes(state(first).initial.seed));
  assert(!rawView.includes('p2-6'));
  assert.equal(first.getPlayerView('p1').opponent.known.length, 1);
  assert.equal(first.getPlayerView('p1').opponent.known[0].hp.max, 48);
  batch(first, 'sodium');
  const replayed = factory.replay(first.exportReplay()); t.after(() => replayed.dispose());
  assert.deepEqual(views(replayed), views(first));
  assert.deepEqual(events(replayed), events(first));
});

test('public DTO mutation cannot affect engine state and disposing releases the instance', () => {
  const engine = factory.create(options());
  const before = views(engine);
  const decision = engine.getDecision('p1'); decision.moves[0].pp = 999;
  const identity = engine.getIdentity(); identity.format.id = 'gen9customgame';
  assert.deepEqual(views(engine), before);
  engine.dispose(); engine.dispose();
  assert.throws(() => engine.getPlayerView('p1'), { code: 'DISPOSED' });
  assert.throws(() => engine.exportCheckpoint(), { code: 'DISPOSED' });
});

test('the 500-turn limit ends a valid switching loop without offering turn 501', t => {
  const engine = factory.create(options()); t.after(() => engine.dispose());
  for (let round = 1; round <= 500; round++) {
    for (const seat of ['p1', 'p2']) {
      const decision = engine.getDecision(seat);
      assert.equal(decision.kind, 'move');
      const target = decision.switches[0].memberId;
      assert.equal(engine.submitDecision(seat, command(engine, seat, `cap-${round}-${seat}`, { kind: 'switch', memberId: target })).accepted, true);
    }
  }
  assert.equal(engine.getDecision('p1').kind, 'finished');
  assert.deepEqual(engine.getPlayerView('p1').result, { kind: 'draw', reason: 'turn-limit' });
  assert.equal(engine.getPlayerView('p1').turn, 500);
  assert.equal(engine.getPlayerView('p1').complete, true);
  assert(!engine.getEvents('p1').some(event => event.args?.opcode === 'turn' && Number(event.args.fields[0]) > 500));
  const restored = factory.restore(engine.exportCheckpoint()); t.after(() => restored.dispose());
  assert.deepEqual(views(restored), views(engine));
});
