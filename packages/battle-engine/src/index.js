import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getVendor } from './vendor.js';
import { getProfile, getFormat, getIdentity as profileIdentity } from './profile.js';
import { validateTeam } from './teams.js';
import { createProjection } from './projection.js';

const SEATS = ['p1', 'p2'];
const MAX_BYTES = 32 * 1024 * 1024;
const MAX_COMMANDS = 8192;
const clone = value => structuredClone(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
const canonical = value => JSON.stringify(ordered(value));
const plain = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const keysAre = (value, allowed) => plain(value) && Object.keys(value).every(key => allowed.includes(key));
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,128}$/.test(value);
const validDecisionId = value => typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(value);
function hasDataProperties(value) {
  return plain(value) && Reflect.ownKeys(value).every(key => typeof key === 'string' &&
    Object.getOwnPropertyDescriptor(value, key)?.enumerable && 'value' in Object.getOwnPropertyDescriptor(value, key));
}

export class EngineError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function seatCheck(seat) {
  if (!SEATS.includes(seat)) throw new EngineError('INVALID_SEAT', 'Seat must be p1 or p2.');
}

function seedValue(seed) {
  if (seed === undefined) {
    return `sodium,${randomBytes(32).toString('hex')}`;
  }
  if (Array.isArray(seed) && seed.length === 4 && seed.every(n => Number.isInteger(n) && n >= 0 && n <= 65535)) {
    return `gen5,${seed.map(n => n.toString(16).padStart(4, '0')).join('')}`;
  }
  if (typeof seed === 'string' && /^gen5,[a-f0-9]{16}$/.test(seed)) return seed;
  if (typeof seed === 'string' && /^sodium,[a-f0-9]{64}$/.test(seed)) return seed;
  throw new EngineError('INVALID_SEED', 'Use four unsigned 16-bit integers or an explicit gen5/sodium seed string.');
}

function decodePrivate(value, description) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_BYTES) {
    throw new EngineError('INVALID_RECORD', `${description} exceeds the size limit.`);
  }
  try {
    return JSON.parse(text, (key, item) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe key');
      return item;
    });
  } catch {
    throw new EngineError('INVALID_RECORD', `${description} is not safe JSON.`);
  }
}

const identities = new Map();
function buildIdentity(profileId) {
  if (!identities.has(profileId)) {
    const directory = fileURLToPath(new URL('.', import.meta.url));
    const files = readdirSync(directory).filter(name => name.endsWith('.js')).sort()
      .map(name => ({ name, sha256: hash(readFileSync(`${directory}/${name}`)) }));
    const base = profileIdentity(profileId);
    const value = { ...base, adapter: { name: '@battle/battle-engine', version: '0.1.0', checkpointSchemaVersion: 1, buildSha256: hash(canonical(files)) } };
    delete value.fingerprint;
    identities.set(profileId, { ...value, fingerprint: hash(canonical(value)) });
  }
  return clone(identities.get(profileId));
}

/** A synchronous server-only port. It performs no network, storage or timer work. */
export function createEngineFactory(options = {}) {
  if (!keysAre(options, ['profileId'])) throw new EngineError('INVALID_OPTIONS', 'Supply an optional allowlisted profileId.');
  const profile = getProfile(options.profileId);
  getFormat(profile.id);
  const expectedIdentity = buildIdentity(profile.id);
  const validateProfileTeam = team => validateTeam(team, profile.id);
  const validateOpponentTeam = team => validateTeam(team, profile.id, { npc: true });

  function create(options = {}) {
    if (!keysAre(options, ['teams', 'seed', 'matchId']) || !keysAre(options.teams, SEATS)) {
      throw new EngineError('INVALID_OPTIONS', 'Supply teams for p1 and p2 and optional seed/matchId.');
    }
    const matchId = options.matchId ?? 'battle';
    if (!validId(matchId)) throw new EngineError('INVALID_MATCH_ID', 'Match ID must be a bounded identifier.');
    const teams = {};
    for (const seat of SEATS) {
      const validation = seat === 'p2' ? validateOpponentTeam(options.teams[seat]) : validateProfileTeam(options.teams[seat]);
      if (!validation.valid) throw new EngineError('INVALID_TEAM', `${seat} has an invalid team.`, validation.errors);
      teams[seat] = validation.team;
    }
    return makeEngine({ initial: { matchId, teams, seed: seedValue(options.seed) }, expectedIdentity, profile });
  }

  function restore(record) {
    const envelope = decodePrivate(record, 'Checkpoint');
    if (!keysAre(envelope, ['schemaVersion', 'payload', 'sha256']) || envelope.schemaVersion !== 1 ||
      !plain(envelope.payload) || envelope.sha256 !== hash(canonical(envelope.payload))) {
      throw new EngineError('INVALID_CHECKPOINT', 'Checkpoint schema or checksum does not match.');
    }
    const saved = envelope.payload;
    if (canonical(saved.identity) !== canonical(expectedIdentity)) throw new EngineError('INCOMPATIBLE_CHECKPOINT', 'Engine, adapter, format or data identity changed.');
    if (saved.battle?.formatid !== getFormat(profile.id).id || !validId(saved.initial?.matchId) ||
      !Array.isArray(saved.journal) || saved.journal.length > MAX_COMMANDS + 1 ||
      !Array.isArray(saved.receipts) || saved.receipts.length > MAX_COMMANDS ||
      !plain(saved.decisionCounters)) {
      throw new EngineError('INVALID_CHECKPOINT', 'Checkpoint contains invalid engine metadata.');
    }
    seedValue(saved.initial.seed);
    for (const seat of SEATS) {
      if (!Number.isSafeInteger(saved.decisionCounters[seat]) || saved.decisionCounters[seat] < 0) throw new EngineError('INVALID_CHECKPOINT', 'Invalid decision counters.');
    }
    // Checkpoints are private trusted storage artifacts, never client-supplied state.
    return makeEngine({ initial: saved.initial, expectedIdentity, saved, profile });
  }

  function replay(record) {
    const saved = decodePrivate(record, 'Replay');
    if (!keysAre(saved, ['schemaVersion', 'identity', 'initial', 'journal']) || saved.schemaVersion !== 1 ||
      canonical(saved.identity) !== canonical(expectedIdentity) || !Array.isArray(saved.journal) || saved.journal.length > MAX_COMMANDS + 1) {
      throw new EngineError('INCOMPATIBLE_REPLAY', 'Replay schema or engine identity does not match.');
    }
    const engine = create(saved.initial);
    try {
      for (const entry of saved.journal) {
        if (entry.kind === 'decision') {
          const outcome = engine.submitDecision(entry.seat, entry.command);
          if (outcome.accepted !== entry.accepted || outcome.code !== entry.code) throw new EngineError('REPLAY_DIVERGED', 'A replayed choice returned a different outcome.');
        } else if (entry.kind === 'adjudication') {
          engine.adjudicate(entry.decision);
        } else {
          throw new EngineError('INVALID_REPLAY', 'Unknown journal entry.');
        }
      }
      return engine;
    } catch (error) {
      engine.dispose();
      throw error;
    }
  }

  return Object.freeze({ create, restore, replay, validateTeam: validateProfileTeam, validateOpponentTeam, getIdentity: () => clone(expectedIdentity), getProfile: () => clone(profile) });
}

function makeEngine({ initial, expectedIdentity, saved, profile }) {
  const { Battle } = getVendor();
  let disposed = false;
  let faulted = false;
  let result = saved?.result ?? null;
  let projection = createProjection({ matchId: initial.matchId, teams: initial.teams, state: saved?.projection });
  const journal = clone(saved?.journal ?? []);
  const receipts = new Map(saved?.receipts ?? []);
  const counters = clone(saved?.decisionCounters ?? { p1: 0, p2: 0 });
  let battle;
  let requestRefs = { p1: null, p2: null };

  function ensureAlive() {
    if (disposed) throw new EngineError('DISPOSED', 'This engine has been disposed.');
    if (faulted) throw new EngineError('FAULTED', 'Restore the last durable checkpoint before continuing this match.');
  }

  // One synchronous callback owns the complete upstream channel. No competing readers.
  function receive(type, data) {
    if (type === 'update' || type === 'sideupdate') {
      let message = Array.isArray(data) ? data.join('\n') : data;
      // The vendor requests turn 501 after resolving turn 500. The policy below
      // ends there; do not announce an unplayable extra turn to either viewer.
      if (type === 'update') message = message.split('\n').filter(line =>
        !line.startsWith('|turn|') || Number(line.slice(6)) <= profile.turnLimit).join('\n');
      projection.consume(type, message);
    }
    // Upstream end contains full teams and seeds. Results are constructed below.
  }

  function syncDecisions() {
    for (const seat of SEATS) {
      const next = battle.getSide(seat).activeRequest;
      if (next !== requestRefs[seat]) {
        requestRefs[seat] = next;
        counters[seat]++;
      }
    }
  }

  function finishPublicResult() {
    if (!result && battle.ended) {
      if (battle.winner && !SEATS.includes(battle.winner)) throw new EngineError('UNEXPECTED_RESULT', 'Unknown winner identity.');
      result = battle.winner ? { kind: 'win', winnerSeat: battle.winner, reason: 'battle' } : { kind: 'draw', reason: 'battle' };
      projection.consume('result', result);
    }
  }

  try {
    if (saved) {
      battle = Battle.fromJSON(saved.battle);
      battle.restart(receive);
      for (const seat of SEATS) requestRefs[seat] = battle.getSide(seat).activeRequest;
    } else {
      battle = new Battle({ formatid: getFormat(profile.id).id, seed: initial.seed, send: receive });
      for (const seat of SEATS) {
        const team = initial.teams[seat].map((set, index) => ({ ...clone(set), name: `${seat}-${index + 1}` }));
        battle.setPlayer(seat, { name: seat, team });
      }
      battle.sendUpdates();
      syncDecisions();
      finishPublicResult();
    }
  } catch (error) {
    battle?.destroy();
    throw error;
  }

  function getDecision(seat) {
    ensureAlive();
    seatCheck(seat);
    const id = `${initial.matchId}:${seat}:${counters[seat]}`;
    if (result) return { id, kind: 'finished', moves: [], switches: [], canSwitch: false };
    const side = battle.getSide(seat);
    const request = projection.getRequest(seat);
    if (!request || request.wait || side.isChoiceDone()) return { id, kind: 'wait', moves: [], switches: [], canSwitch: false };
    const active = request.active?.[0];
    const forced = request.forceSwitch?.[0] === true;
    const switches = (request.side?.pokemon ?? []).flatMap((member, index) => {
      if (member.active || /\bfnt\b/.test(member.condition)) return [];
      const token = member.ident.match(/: (p[12])-([1-6])$/);
      if (!token || token[1] !== seat) throw new EngineError('INVALID_REQUEST', 'Unrecognized team-member identity.');
      return [{ memberId: `${seat}:${token[2]}`, slot: index + 1, species: initial.teams[seat][Number(token[2]) - 1].species }];
    });
    const canSwitch = switches.length > 0 && (forced || !active?.trapped);
    return {
      id, kind: forced ? 'switch' : 'move',
      moves: forced ? [] : (active?.moves ?? []).map((move, index) => ({ slot: index + 1, id: move.id, name: move.move, pp: move.pp ?? null, maxpp: move.maxpp ?? null, disabled: !!move.disabled, target: move.target })),
      switches: canSwitch ? switches : [], canSwitch,
    };
  }

  function getPlayerView(seat) {
    ensureAlive();
    seatCheck(seat);
    return { ...projection.getView(seat), decision: getDecision(seat), result: clone(result) };
  }

  function submitDecision(seat, command) {
    ensureAlive();
    seatCheck(seat);
    if (!hasDataProperties(command) || !keysAre(command, ['commandId', 'decisionId', 'action']) || !validId(command.commandId) ||
      !validDecisionId(command.decisionId) || !hasDataProperties(command.action) ||
      Object.values(command.action).some(value => !['string', 'number', 'boolean'].includes(typeof value) ||
        typeof value === 'number' && !Number.isFinite(value) || typeof value === 'string' && value.length > 160)) {
      return { accepted: false, code: 'INVALID_COMMAND' };
    }
    if (Buffer.byteLength(JSON.stringify(command)) > 2048) return { accepted: false, code: 'INVALID_COMMAND' };
    command = clone(command);
    const key = `${seat}:${command.commandId}`;
    const digest = hash(canonical(command));
    const previous = receipts.get(key);
    if (previous) return previous.digest === digest ? clone(previous.response) : { accepted: false, code: 'COMMAND_ID_REUSED' };
    const decision = getDecision(seat);
    let code;
    let input;
    if (result) code = 'MATCH_FINISHED';
    else if (command.decisionId !== decision.id) code = 'STALE_DECISION';
    else if (decision.kind === 'wait') code = 'ALREADY_SUBMITTED';
    else if (command.action.kind === 'move' && keysAre(command.action, ['kind', 'slot'])) {
      const move = decision.moves.find(move => move.slot === command.action.slot);
      if (!move || move.disabled) code = 'ILLEGAL_ACTION';
      else input = `move ${move.slot}`;
    } else if (command.action.kind === 'switch' && keysAre(command.action, ['kind', 'memberId'])) {
      const member = decision.switches.find(member => member.memberId === command.action.memberId);
      if (!member) code = 'ILLEGAL_ACTION';
      else input = `switch ${member.slot}`;
    } else code = 'INVALID_ACTION';

    // Rejections before simulator admission have no state or receipt allocation.
    // Otherwise arbitrary stale IDs could exhaust the match's recovery journal.
    if (code) return { accepted: false, code, commandId: command.commandId, decisionId: command.decisionId, decision };
    if (receipts.size >= MAX_COMMANDS || journal.length >= MAX_COMMANDS) return { accepted: false, code: 'COMMAND_LIMIT' };
    let accepted = false;
    if (!code) {
      try {
        accepted = battle.choose(seat, input);
        if (!accepted) code = 'ILLEGAL_ACTION';
        battle.sendUpdates();
        syncDecisions();
        // The cap is an explicit adapter policy, independent of animation and timers.
        if (!battle.ended && battle.turn > profile.turnLimit) {
          result = { kind: 'draw', reason: 'turn-limit' };
          battle.forceWin(null);
          battle.sendUpdates();
          projection.consume('result', result);
        }
        finishPublicResult();
      } catch (error) {
        faulted = true;
        throw new EngineError('ENGINE_FAILURE', 'Simulator failed; restore the last durable checkpoint.', { cause: error.message });
      }
    }
    const response = { accepted, ...(code ? { code } : {}), commandId: command.commandId, decisionId: command.decisionId, decision: getDecision(seat) };
    receipts.set(key, { digest, response: clone(response) });
    journal.push({ kind: 'decision', seat, command, accepted, ...(code ? { code } : {}) });
    return response;
  }

  function adjudicate(decision) {
    ensureAlive();
    if (!keysAre(decision, ['kind', 'seat', 'reason'])) throw new EngineError('INVALID_ADJUDICATION', 'Supply a structured system decision.');
    const reason = decision.reason ?? (decision.kind === 'forfeit' ? 'forfeit' : decision.kind === 'draw' ? 'agreement' : 'infrastructure');
    const reasons = { forfeit: ['forfeit', 'timeout'], draw: ['agreement', 'turn-limit'], 'no-contest': ['infrastructure'] };
    if (!Object.hasOwn(reasons, decision.kind) || !reasons[decision.kind].includes(reason)) throw new EngineError('INVALID_ADJUDICATION', 'Unsupported result or reason.');
    if (decision.kind === 'forfeit') seatCheck(decision.seat);
    else if (decision.seat !== undefined) throw new EngineError('INVALID_ADJUDICATION', 'Only forfeits have a losing seat.');
    if (result) return clone(result);
    // One terminal system record is always reserved, even at the command limit.
    try {
      result = decision.kind === 'forfeit'
        ? { kind: 'win', winnerSeat: decision.seat === 'p1' ? 'p2' : 'p1', reason }
        : { kind: decision.kind, reason };
      if (decision.kind === 'forfeit') battle.forceWin(result.winnerSeat);
      else if (decision.kind === 'draw') battle.forceWin(null);
      battle.sendUpdates();
      projection.consume('result', result);
      journal.push({ kind: 'adjudication', decision: clone(decision) });
      return clone(result);
    } catch (error) {
      faulted = true;
      throw new EngineError('ENGINE_FAILURE', 'Adjudication failed; restore the last durable checkpoint.', { cause: error.message });
    }
  }

  function exportCheckpoint() {
    ensureAlive();
    // Stringification detaches the aliased upstream log before any subsequent choice.
    const snapshot = JSON.parse(JSON.stringify(battle.toJSON()));
    const payload = { identity: expectedIdentity, initial: clone(initial), battle: snapshot, projection: projection.exportState(), decisionCounters: clone(counters), journal: clone(journal), receipts: [...receipts].map(clone), result: clone(result) };
    const text = JSON.stringify({ schemaVersion: 1, payload, sha256: hash(canonical(payload)) });
    if (Buffer.byteLength(text) > MAX_BYTES) throw new EngineError('CHECKPOINT_LIMIT', 'Checkpoint exceeds the supported size.');
    return text;
  }

  return Object.freeze({
    getIdentity: () => clone(expectedIdentity), getPlayerView, getDecision, submitDecision, adjudicate, exportCheckpoint,
    getEvents(seat, afterCursor = 0) { ensureAlive(); seatCheck(seat); return projection.getEvents(seat, afterCursor); },
    exportReplay() { ensureAlive(); return { schemaVersion: 1, identity: clone(expectedIdentity), initial: clone(initial), journal: clone(journal) }; },
    dispose() { if (!disposed) { disposed = true; battle.destroy(); projection = null; receipts.clear(); journal.length = 0; } },
  });
}
