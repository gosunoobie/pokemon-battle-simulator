import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import manifest from '@battle/game-data/manifest.json' with { type: 'json' }
import { canonicalJson, getVendor, PINNED_SOURCE } from './vendor.js'

const require = createRequire(import.meta.url)
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

export const ENGINE_PROFILE = freeze({
  schemaVersion: 1,
  id: 'gen3opensinglesv1',
  generation: 3,
  rng: { default: 'sodium', replayAlgorithms: ['sodium', 'gen5'] },
  seedPolicy: 'Fresh cryptographically random 32-byte SodiumRNG seed for each new battle; private and replayable. Explicit Gen5RNG seeds remain available for deterministic fixtures; neither claims a cartridge RNG sequence.',
  turnLimit: 500,
  choices: 'final',
  roster: { firstNationalDexNumber: 1, lastNationalDexNumber: 386, startingForms: 'Gen 3 Obtainable validation; normalized forms are reported' },
  team: { size: 6, distinctBaseSpecies: true, level: 100, minMoves: 1, maxMoves: 4, duplicateItemsAllowed: true },
  defaults: { level: 100, ev: 0, iv: 31, item: '', happiness: 255, shiny: false },
  legality: {
    evPerStatMaximum: 255, totalEvMaximum: 510, ivMinimum: 0, ivMaximum: 31,
    acceptsZeroEvs: true,
    zeroEvAdvisory: 'Suppress only the pinned validator reminder about exactly zero EVs; do not alter EVs or suppress legality errors.',
    requiredSetFields: ['species', 'ability', 'nature', 'moves'],
  },
  information: { teamPreview: false, cancel: false, debug: false, publicHp: 'Showdown default rounded 48-pixel bar; exact HP is private' },
  definition: {
    name: '[Gen 3] Open Singles v1', effectType: 'Format', mod: 'gen3',
    gameType: 'singles', rated: false, debug: false,
    ruleset: ['Obtainable', 'Species Clause', 'Min Team Size = 6', 'Max Team Size = 6',
      'Min Level = 100', 'Max Level = 100', 'Default Level = 100', 'Max Move Count = 4'],
    banlist: [],
  },
})

const EXPECTED_RULES = [
  '-nonexistent', '-tag:unobtainable', '-unreleased', 'defaultlevel', 'evlimit',
  'maxlevel', 'maxmovecount', 'maxteamsize', 'minlevel', 'minteamsize',
  'obtainable', 'obtainableabilities', 'obtainableformes', 'obtainablemisc',
  'obtainablemoves', 'speciesclause',
].sort()
const EXPECTED_VALUES = {
  defaultlevel: '100', evlimit: 'Auto', maxlevel: '100', maxmovecount: '4',
  maxteamsize: '6', minlevel: '100', minteamsize: '6',
}
let registeredFormat
let identity

function expandedRules(Dex, format) {
  const table = Dex.formats.getRuleTable(format)
  const expanded = {
    rules: [...table.keys()].sort(),
    values: Object.fromEntries(table.valueRules),
  }
  if (canonicalJson(expanded) !== canonicalJson({ rules: EXPECTED_RULES, values: EXPECTED_VALUES }) ||
      table.evLimit !== 510 || format.debug || format.battle || format.mod !== 'gen3' || format.gameType !== 'singles') {
    throw new Error('Open Singles v1 expanded rules no longer match the approved profile.')
  }
  return expanded
}

export function getFormat() {
  const { Dex } = getVendor()
  Dex.formats.load()
  if (registeredFormat) {
    if (Dex.formats.rulesetCache.get(ENGINE_PROFILE.id) !== registeredFormat) {
      throw new Error('Open Singles v1 format registration was replaced.')
    }
    expandedRules(Dex, registeredFormat)
    return registeredFormat
  }
  if (Dex.formats.rulesetCache.has(ENGINE_PROFILE.id)) {
    throw new Error('Open Singles v1 format ID collides with another registration.')
  }
  const definition = JSON.parse(JSON.stringify(ENGINE_PROFILE.definition))
  definition.baseRuleset = [...definition.ruleset]
  const format = new Dex.Format(definition)
  if (format.id !== ENGINE_PROFILE.id) throw new Error('Open Singles v1 format name produced an unexpected ID.')
  expandedRules(Dex, format)
  // Single allowlisted private mutation for this exact pin. Register before any
  // Battle/fromJSON call; no source files, built-in formats or rules are changed.
  Dex.formats.rulesetCache.set(ENGINE_PROFILE.id, format)
  registeredFormat = format
  return format
}

export function getIdentity() {
  const format = getFormat()
  if (identity) return identity
  if (manifest.dataset !== 'gen3' || manifest.schemaVersion !== 1 ||
      Object.entries(PINNED_SOURCE).some(([key, value]) => manifest.source?.[key] !== value)) {
    throw new Error('Game data source identity differs from the pinned battle engine.')
  }
  const dataSha256 = sha256(readFileSync(require.resolve('@battle/game-data/gen3.json')))
  if (dataSha256 !== manifest.artifacts?.['data/gen3.json']?.sha256) {
    throw new Error('Game data content differs from its manifest digest.')
  }
  const { Dex, provenance } = getVendor()
  const description = {
    schemaVersion: 1,
    adapter: { name: '@battle/battle-engine', version: '0.1.0', checkpointSchemaVersion: 1 },
    engine: { ...PINNED_SOURCE, rngDependency: { ...provenance.rngDependency } },
    runtime: { node: process.version, v8: process.versions.v8 },
    format: {
      id: ENGINE_PROFILE.id,
      definitionSha256: sha256(canonicalJson(ENGINE_PROFILE)),
      expandedRulesSha256: sha256(canonicalJson(expandedRules(Dex, format))),
    },
    data: { dataset: 'gen3', schemaVersion: manifest.schemaVersion, sha256: dataSha256 },
  }
  identity = freeze({ ...description, fingerprint: sha256(canonicalJson(description)) })
  return identity
}
