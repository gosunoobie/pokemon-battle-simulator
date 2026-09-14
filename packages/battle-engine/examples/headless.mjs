import assert from 'node:assert/strict';
import { createEngineFactory } from '../src/index.js';

// Explicit legal example teams; these are fixtures, not generated species data.
const set = (species, ability, move) => ({ species, ability, nature: 'Serious', moves: [move] });
const team = [
  set('Charizard', 'Blaze', 'Flamethrower'), set('Blastoise', 'Torrent', 'Surf'),
  set('Venusaur', 'Overgrow', 'Razor Leaf'), set('Raichu', 'Static', 'Thunderbolt'),
  set('Alakazam', 'Synchronize', 'Psychic'), set('Machamp', 'Guts', 'Cross Chop'),
];
const factory = createEngineFactory();
const canonical = factory.validateTeam(team);
assert.equal(canonical.valid, true);
let engine = factory.create({ matchId: 'headless-example', seed: [1, 2, 3, 4], teams: { p1: canonical.team, p2: canonical.team } });
let restoredPendingChoice = false;
let submissions = 0;
try {
  for (let step = 0; step < 2000 && engine.getDecision('p1').kind !== 'finished'; step++) {
    for (const seat of ['p1', 'p2']) {
      const decision = engine.getDecision(seat);
      if (decision.kind === 'wait' || decision.kind === 'finished') continue;
      const action = decision.kind === 'switch'
        ? { kind: 'switch', memberId: decision.switches[0].memberId }
        : { kind: 'move', slot: decision.moves.find(move => !move.disabled).slot };
      const response = engine.submitDecision(seat, { commandId: `example-${++submissions}`, decisionId: decision.id, action });
      assert.equal(response.accepted, true);
      if (!restoredPendingChoice && seat === 'p1') {
        const checkpoint = engine.exportCheckpoint();
        const view = engine.getPlayerView('p1');
        engine.dispose();
        engine = factory.restore(checkpoint);
        assert.deepEqual(engine.getPlayerView('p1'), view);
        assert.equal(engine.getDecision('p1').kind, 'wait');
        restoredPendingChoice = true;
      }
    }
  }
  assert.equal(engine.getDecision('p1').kind, 'finished');
  const replay = factory.replay(engine.exportReplay());
  try {
    for (const seat of ['p1', 'p2']) {
      assert.deepEqual(replay.getPlayerView(seat), engine.getPlayerView(seat));
      assert.deepEqual(replay.getEvents(seat), engine.getEvents(seat));
    }
  } finally { replay.dispose(); }
  console.log(JSON.stringify({
    profile: engine.getIdentity().format.id,
    sourceVersion: engine.getIdentity().engine.version,
    result: engine.getPlayerView('p1').result,
    turns: engine.getPlayerView('p1').turn,
    acceptedDecisions: submissions,
    restoredPendingChoice,
    deterministicReplayVerified: true,
  }, null, 2));
} finally { engine.dispose(); }
