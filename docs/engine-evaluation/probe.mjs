import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import { dirname, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { verifySource } from '../../tools/data-import/provenance.mjs'

// This is an isolated investigation, not the game's format or engine adapter.
// Run from any directory: node docs/engine-evaluation/probe.mjs
const directory = dirname(fileURLToPath(import.meta.url))
const repository = resolve(directory, '../..')
const toolDirectory = resolve(repository, 'tools/data-import')
const source = JSON.parse(await readFile(resolve(toolDirectory, 'source-lock.json'), 'utf8'))
const packageRoot = resolve(toolDirectory, 'node_modules/pokemon-showdown')
const verificationStart = performance.now()
const verified = await verifySource({ packageRoot, source, toolDirectory })
const verificationMs = performance.now() - verificationStart
// Do not execute any installed upstream code until its source tree is verified.
const require = createRequire(resolve(toolDirectory, 'package.json'))
const requireStart = performance.now()
const { Battle, Dex, TeamValidator } = require('pokemon-showdown')
const requireMs = performance.now() - requireStart
const formatId = 'gen3ubers'
const fixedSeed = 'gen5,0001000200030004'
const maxDecisionBatches = 50
const clone = value => JSON.parse(JSON.stringify(value))
const hash = value => createHash('sha256').update(value).digest('hex')
const checks = []

function checkpoint(battle) {
  // toJSON().log aliases the live log in this pin. Stringify immediately.
  return JSON.stringify(battle.toJSON())
}

function normalized(battle) {
  const state = JSON.parse(checkpoint(battle))
  // Upstream State.normalize removes this wall-clock content, and nothing else.
  state.log = state.log.map(line => line.startsWith('|t:|') ? '|t:|' : line)
  return state
}

function expect(name, action) {
  action()
  checks.push({ name, passed: true })
}

function set(species, ability, move) {
  return {
    name: species, species, ability, moves: [move], level: 100,
    nature: 'Hardy', item: '', gender: 'M', happiness: 255,
    evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 0, spe: 4 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  }
}

const submittedTeams = [
  [
    set('Charizard', 'Blaze', 'Flamethrower'),
    set('Blastoise', 'Torrent', 'Surf'),
    set('Venusaur', 'Overgrow', 'Razor Leaf'),
    set('Raichu', 'Static', 'Thunderbolt'),
    set('Alakazam', 'Synchronize', 'Psychic'),
    set('Machamp', 'Guts', 'Cross Chop'),
  ],
  [
    set('Feraligatr', 'Torrent', 'Surf'),
    set('Typhlosion', 'Blaze', 'Flamethrower'),
    set('Meganium', 'Overgrow', 'Razor Leaf'),
    set('Ampharos', 'Static', 'Thunderbolt'),
    set('Gardevoir', 'Synchronize', 'Psychic'),
    set('Hariyama', 'Guts', 'Brick Break'),
  ],
]
const originalTeams = JSON.stringify(submittedTeams)
const validationStart = performance.now()
const validator = new TeamValidator(formatId)
const teams = submittedTeams.map((team, index) => {
  const candidate = clone(team)
  assert.equal(validator.validateTeam(candidate), null, `Diagnostic team ${index + 1} is invalid`)
  return candidate
})
const validationMs = performance.now() - validationStart
expect('Both six-member teams validate on clones; caller inputs remain unchanged', () => {
  assert.equal(JSON.stringify(submittedTeams), originalTeams)
  assert(teams.every(team => team.length === 6))
})

function createBattle(seed = fixedSeed, id = formatId) {
  const battle = new Battle({ formatid: id, seed, send: () => {} })
  battle.setPlayer('p1', { name: 'Probe One', team: clone(teams[0]) })
  battle.setPlayer('p2', { name: 'Probe Two', team: clone(teams[1]) })
  return battle
}

function advance(battle, onDecision) {
  let decisionBatches = 0
  while (!battle.ended && decisionBatches < maxDecisionBatches) {
    assert(battle.sides.some(side => side.activeRequest), 'Unfinished battle has no player request')
    const start = performance.now()
    // The pinned helper invokes each side.autoChoose(), then commitChoices().
    battle.makeChoices()
    onDecision?.(performance.now() - start)
    decisionBatches++
  }
  const capped = !battle.ended
  if (capped) battle.forceWin(null)
  assert.equal(battle.ended, true, 'Diagnostic battle did not finish or explicitly draw at the cap')
  return { decisionBatches, capped, winner: battle.winner || null, turns: battle.turn }
}

const firstBattleStart = performance.now()
const first = createBattle()
const firstBattleMs = performance.now() - firstBattleStart
expect('Built-in diagnostic format resolves to Gen 3 singles with no team preview', () => {
  assert.equal(first.gen, 3)
  assert.equal(first.gameType, 'singles')
  assert.equal(first.requestState, 'move')
})
const firstOutcome = advance(first)
const firstState = normalized(first)
const second = createBattle()
const secondOutcome = advance(second)
expect('Same validated teams, seed, and automatic decisions give identical normalized complete state', () => {
  assert.deepEqual(secondOutcome, firstOutcome)
  assert.deepEqual(normalized(second), firstState)
})
first.destroy()
second.destroy()

function roundTrip(pendingChoice) {
  const battle = createBattle()
  battle.makeChoices()
  assert.equal(battle.requestState, 'move', 'Fixture no longer reaches an ordinary move decision')
  const beforeInputLength = battle.inputLog.length
  if (pendingChoice) {
    assert.equal(battle.choose('p1', 'move 1'), true)
    assert.equal(battle.p1.isChoiceDone(), true)
    assert.equal(battle.p2.isChoiceDone(), false)
    assert.equal(battle.inputLog.length, beforeInputLength, 'Pending choice unexpectedly committed to inputLog')
  }
  const writeStart = performance.now()
  const serialized = checkpoint(battle)
  const stringifyMs = performance.now() - writeStart
  const restoreStart = performance.now()
  const restored = Battle.fromJSON(serialized)
  restored.restart(() => {})
  const restoreMs = performance.now() - restoreStart
  expect(`Checkpoint restores complete state${pendingChoice ? ' with a pending first-side choice' : ''}`, () => {
    assert.deepEqual(normalized(restored), normalized(battle))
  })
  if (pendingChoice) {
    assert.equal(restored.p1.isChoiceDone(), true)
    assert.equal(restored.p2.isChoiceDone(), false)
    assert.equal(battle.choose('p2', 'move 1'), true)
    assert.equal(restored.choose('p2', 'move 1'), true)
  }
  const originalOutcome = advance(battle)
  const restoredOutcome = advance(restored)
  expect(`Restored continuation matches uninterrupted state${pendingChoice ? ' after completing the pending decision' : ''}`, () => {
    assert.deepEqual(restoredOutcome, originalOutcome)
    assert.deepEqual(normalized(restored), normalized(battle))
  })
  const result = {
    pendingChoice, bytes: Buffer.byteLength(serialized), stringifyMs, restoreMs,
    pendingChoiceAbsentFromInputLog: pendingChoice ? true : null,
    outcome: restoredOutcome,
  }
  battle.destroy()
  restored.destroy()
  return result
}

const checkpoints = [roundTrip(false), roundTrip(true)]
const aliasBattle = createBattle()
const aliased = aliasBattle.toJSON()
const detached = JSON.parse(JSON.stringify(aliased))
const savedLength = detached.log.length
expect('Regression: toJSON log aliases live log; immediate JSON serialization detaches it', () => {
  assert.strictEqual(aliased.log, aliasBattle.log)
  aliasBattle.makeChoices()
  assert(aliased.log.length > savedLength)
  assert.equal(detached.log.length, savedLength)
})
aliasBattle.destroy()

const customCandidate = 'gen3customgame@@@Obtainable,Species Clause,!! Max Team Size = 6,Min Team Size = 6,!! Max Move Count = 4,!! Max Level = 100,Min Level = 100,! HP Percentage Mod,! Cancel Mod'
const customId = Dex.formats.validate(customCandidate)
const custom = createBattle(fixedSeed, customId)
const customSerialized = checkpoint(custom)
const bareRestore = Battle.fromJSON(customSerialized)
const envelopeRestore = Battle.fromJSON({ ...JSON.parse(customSerialized), formatid: customId })
function formatDescription(battle) {
  return {
    id: battle.format.id, gen: battle.gen, debug: battle.debugMode,
    usesMathTrunc: battle.trunc === Math.trunc,
    rules: [...battle.ruleTable.keys()].sort(),
    values: Object.fromEntries([...battle.ruleTable.valueRules.entries()].sort(([a], [b]) => a.localeCompare(b, 'en'))),
  }
}
expect('Negative probe: bare custom-rule checkpoint loses @@@ rules', () => {
  assert.equal(JSON.parse(customSerialized).formatid, 'gen3customgame')
  assert.equal(custom.ruleTable.maxTeamSize, 6)
  assert.equal(bareRestore.ruleTable.maxTeamSize, 24)
  assert.equal(custom.ruleTable.maxMoveCount, 4)
  assert.equal(bareRestore.ruleTable.maxMoveCount, 24)
  assert.equal(custom.ruleTable.maxLevel, 100)
  assert.equal(bareRestore.ruleTable.maxLevel, 9999)
  assert.equal(custom.ruleTable.has('hppercentagemod'), false)
  assert.equal(bareRestore.ruleTable.has('hppercentagemod'), true)
  assert(custom.inputLog.some(line => line.startsWith('>start ') && line.includes('@@@')))
})
expect('Preserving validated full format ID separately restores the diagnostic custom rules', () => {
  assert.deepEqual(formatDescription(envelopeRestore), formatDescription(custom))
  assert.deepEqual(normalized(envelopeRestore), normalized(custom))
})
const customFormat = {
  diagnosticOnly: true, canonicalId: customId,
  serializedId: JSON.parse(customSerialized).formatid,
  original: formatDescription(custom), bareRestore: formatDescription(bareRestore),
  envelopeRestore: formatDescription(envelopeRestore),
  warning: 'This diagnostic base inherits debug=true and Math.trunc. It is not an approved authentic production format. A custom-format checkpoint must preserve its full resolvable rules identity separately.',
}
custom.destroy()
bareRestore.destroy()
envelopeRestore.destroy()

// A sequential warm microbenchmark; no sockets, persistence, presentation, queue or concurrent rooms.
const warmupMatches = 10
for (let index = 0; index < warmupMatches; index++) {
  const battle = createBattle()
  advance(battle)
  battle.destroy()
}
const timings = []
const initializationTimings = []
const outcomes = []
const matchCount = 100
const benchmarkStart = performance.now()
for (let index = 0; index < matchCount; index++) {
  const seed = `gen5,000100020003${(index + 4).toString(16).padStart(4, '0')}`
  const start = performance.now()
  const battle = createBattle(seed)
  initializationTimings.push(performance.now() - start)
  const outcome = advance(battle, elapsed => timings.push(elapsed))
  outcomes.push({ index, seed, ...outcome })
  battle.destroy()
}
const benchmarkMs = performance.now() - benchmarkStart
function summary(values) {
  const ordered = [...values].sort((a, b) => a - b)
  const percentile = fraction => ordered[Math.ceil(ordered.length * fraction) - 1]
  return {
    samples: ordered.length, min: ordered[0], p50: percentile(.50),
    p95: percentile(.95), max: ordered.at(-1),
    mean: ordered.reduce((total, value) => total + value, 0) / ordered.length,
  }
}
expect('All benchmark matches are explicitly terminated and accounted for', () => {
  assert.equal(outcomes.length, matchCount)
  assert.equal(timings.length, outcomes.reduce((total, outcome) => total + outcome.decisionBatches, 0))
  assert(outcomes.every(outcome => outcome.decisionBatches <= maxDecisionBatches))
})

const report = {
  schemaVersion: 1,
  purpose: 'Pinned simulator diagnostic only; no production rules, engine integration or deployment adoption.',
  generatedAt: new Date().toISOString(),
  source: { ...source, verifiedFileCount: verified.files.length },
  probeSha256: hash(await readFile(fileURLToPath(import.meta.url))),
  environment: {
    node: process.version, versions: process.versions, platform: process.platform, arch: process.arch,
    osType: os.type(), osRelease: os.release(), cpuModel: os.cpus()[0]?.model ?? null,
    logicalCpuCount: os.cpus().length, totalMemoryBytes: os.totalmem(),
    processExecArgv: process.execArgv,
  },
  workload: {
    formatId, formatIsDiagnosticOnly: true, fixedSeed,
    rng: 'Explicit gen5 seed selects Showdown Gen5RNG, not a GBA cartridge RNG sequence.',
    maxDecisionBatches, submittedTeams, validatedTeams: teams,
    strategy: 'One legal offensive move per Pokémon; no items; side.autoChoose through Battle.makeChoices chooses defaults and replacement switches. No strategic opponent or realistic team diversity.',
    timestampNormalization: 'Only |t:| wall-clock payloads are removed before comparing the complete detached serialized state.',
  },
  checks: { passed: true, count: checks.length, cases: checks },
  deterministicOutcome: firstOutcome,
  deterministicStateSha256: hash(JSON.stringify(firstState)),
  checkpoints,
  customFormat,
  timingsMs: { sourceVerification: verificationMs, upstreamRequire: requireMs, formatAndTwoTeamValidation: validationMs, firstBattleInitializationAfterValidation: firstBattleMs },
  microbenchmark: {
    warmupMatches, matchCount, sequential: true, elapsedMs: benchmarkMs,
    initializationMs: summary(initializationTimings), decisionBatchMs: summary(timings),
    naturalWins: outcomes.filter(outcome => outcome.winner !== null).length,
    naturalDraws: outcomes.filter(outcome => outcome.winner === null && !outcome.capped).length,
    forcedDrawsAtCap: outcomes.filter(outcome => outcome.capped).length,
    outcomes,
  },
  caveats: [
    'gen3ubers includes its own competitive clauses and restrictions. Its selection here approves no game rules and does not implement the proposed open format.',
    'Correctness checks are self-consistency tests against one pinned provider, not independent proof of cartridge authenticity or coverage of all mechanics.',
    'Elapsed times and generatedAt vary between runs. Nearest-rank p50/p95 summarize this one warm local sequential workload, not production response times.',
    'One decision batch can include both sides and a forced replacement request; it is not a client command, animation, wall-clock turn or HTTP/WebSocket latency measurement.',
    'No simultaneous-match load, network, authentication, lobby, matchmaking, room ownership, durable journal, reconnect privacy, database, worker isolation, browser, memory-soak or deployment certification is performed.',
    'Checkpoint samples measure one shallow initial battle state and one pending choice, not maximum-size or long-running state, crash atomicity, cross-version migration or exhaustive replay recovery.',
    'No relative performance comparison with another engine was performed. Fixed test seeds are public diagnostic inputs; production rule RNG state must remain private.',
    'The observed toJSON alias and custom-rule identity loss are expected negative probes. Assertions deliberately fail if these pinned assumptions change.',
  ],
}
await writeFile(resolve(directory, 'results.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ checks: report.checks.count, passed: true, microbenchmark: {
  matches: matchCount, naturalWins: report.microbenchmark.naturalWins,
  naturalDraws: report.microbenchmark.naturalDraws, forcedDrawsAtCap: report.microbenchmark.forcedDrawsAtCap,
  decisionBatchMs: report.microbenchmark.decisionBatchMs,
}, results: 'docs/engine-evaluation/results.json' }, null, 2))
