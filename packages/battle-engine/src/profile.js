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

// Trainer rosters can contain fewer than six members and repeat species. This
// separate profile leaves the competitive Open Singles contract unchanged.
export const LEAGUE_PROFILE = freeze({
  ...structuredClone(ENGINE_PROFILE),
  id: 'gen3regionalleaguev1',
  npcMoveExceptions: [{
    id: 'gold-silver-karen-murkrow', species: 'murkrow', move: 'quickattack',
    exactMoves: ['quickattack', 'whirlwind', 'pursuit', 'feintattack'],
    reason: 'Original Gold/Silver trainer-only moveset; see docs/LEAGUE_ROSTERS.md. Applies only to the NPC seat.',
  }],
  team: { ...ENGINE_PROFILE.team, size: null, minSize: 1, maxSize: 6, distinctBaseSpecies: false },
  definition: {
    ...structuredClone(ENGINE_PROFILE.definition),
    name: '[Gen 3] Regional League v1',
    ruleset: ['Obtainable', 'Min Team Size = 1', 'Max Team Size = 6',
      'Min Level = 100', 'Max Level = 100', 'Default Level = 100', 'Max Move Count = 4'],
  },
})

export function getProfile(id = ENGINE_PROFILE.id) {
  if (id === ENGINE_PROFILE.id) return ENGINE_PROFILE
  if (id === LEAGUE_PROFILE.id) return LEAGUE_PROFILE
  throw new TypeError('Unknown battle profile.')
}

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
const registeredFormats = new Map()
const identities = new Map()

function expandedRules(Dex, format, profile) {
  const table = Dex.formats.getRuleTable(format)
  const expanded = {
    rules: [...table.keys()].sort(),
    values: Object.fromEntries(table.valueRules),
  }
  const rules = profile.team.distinctBaseSpecies ? EXPECTED_RULES : EXPECTED_RULES.filter(rule => rule !== 'speciesclause')
  const values = { ...EXPECTED_VALUES, minteamsize: String(profile.team.size ?? profile.team.minSize) }
  if (canonicalJson(expanded) !== canonicalJson({ rules, values }) ||
      table.evLimit !== 510 || format.debug || format.battle || format.mod !== 'gen3' || format.gameType !== 'singles') {
    throw new Error('Open Singles v1 expanded rules no longer match the approved profile.')
  }
  return expanded
}

export function getFormat(id = ENGINE_PROFILE.id) {
  const profile = getProfile(id)
  const { Dex } = getVendor()
  Dex.formats.load()
  const registeredFormat = registeredFormats.get(id)
  if (registeredFormat) {
    if (Dex.formats.rulesetCache.get(id) !== registeredFormat) {
      throw new Error('Open Singles v1 format registration was replaced.')
    }
    expandedRules(Dex, registeredFormat, profile)
    return registeredFormat
  }
  if (Dex.formats.rulesetCache.has(id)) {
    throw new Error('Open Singles v1 format ID collides with another registration.')
  }
  const definition = JSON.parse(JSON.stringify(profile.definition))
  definition.baseRuleset = [...definition.ruleset]
  const format = new Dex.Format(definition)
  if (format.id !== id) throw new Error('Battle profile name produced an unexpected ID.')
  expandedRules(Dex, format, profile)
  // Single allowlisted private mutation for this exact pin. Register before any
  // Battle/fromJSON call; no source files, built-in formats or rules are changed.
  Dex.formats.rulesetCache.set(id, format)
  registeredFormats.set(id, format)
  return format
}

export function getIdentity(id = ENGINE_PROFILE.id) {
  const profile = getProfile(id)
  const format = getFormat(id)
  if (identities.has(id)) return identities.get(id)
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
      id,
      definitionSha256: sha256(canonicalJson(profile)),
      expandedRulesSha256: sha256(canonicalJson(expandedRules(Dex, format, profile))),
    },
    data: { dataset: 'gen3', schemaVersion: manifest.schemaVersion, sha256: dataSha256 },
  }
  const identity = freeze({ ...description, fingerprint: sha256(canonicalJson(description)) })
  identities.set(id, identity)
  return identity
}
