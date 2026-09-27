import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { GEN3, GEN3_MANIFEST } from '@battle/game-data'
import { validateTeam } from '../../packages/battle-engine/src/teams.js'
import { createStarterSetAdapter } from '../../packages/battle-engine/src/generation.js'
import { canonicalJson } from '../../packages/battle-engine/src/vendor.js'
import { getIdentity } from '../../packages/battle-engine/src/profile.js'
import { VERSION, POLICY_VERSION, STATS, OVERRIDES, LOW_MOVE_EXCEPTIONS, id, stats,
  applyRoleSettings, qualityIssues, rankCandidates } from './policy.mjs'

const OUTPUT = new URL('../../apps/server/teams/starter-sets.generated.json', import.meta.url)
const REPORT = new URL('./report.json', import.meta.url)
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const clone = value => structuredClone(value)
const PROFILE = 'gen3opensinglesv1'

// Neutral legal fixtures exercise the actual six-member profile, not a looser
// single-set validator. Fixtures never provide the generated set's settings.
const FIXTURES = [
  ['Bulbasaur', 'Overgrow', 'Tackle'], ['Charmander', 'Blaze', 'Scratch'],
  ['Squirtle', 'Torrent', 'Tackle'], ['Pikachu', 'Static', 'Thunderbolt'],
  ['Eevee', 'Run Away', 'Tackle'], ['Rattata', 'Run Away', 'Tackle'],
].map(([species, ability, move]) => ({ species, ability, moves: [move], nature: 'Hardy', evs: { hp: 4 } }))

export function fixtureTeam(set) {
  return [clone(set), ...FIXTURES.filter(fixture => id(fixture.species) !== id(set.species)).slice(0, 5).map(clone)]
}

/** Convert private vendor/canonical output into the existing editable DTO. */
export function editableSet(input, adapter) {
  const result = {
    species: input.species, ability: input.ability, item: input.item ?? 'Leftovers',
    moves: input.moves.map(move => adapter.move(move, input.ivs ?? stats(31)).name),
    nature: input.nature ?? 'Hardy', level: 100,
    evs: Object.fromEntries(STATS.map(stat => [stat, input.evs?.[stat] ?? 0])),
    ivs: Object.fromEntries(STATS.map(stat => [stat, input.ivs?.[stat] ?? 31])),
    happiness: input.happiness ?? 255, gender: input.gender ?? '',
  }
  return result
}

function validateCandidate(set, adapter) {
  const first = validateTeam(fixtureTeam(set), PROFILE)
  if (!first.valid) return first
  const editable = editableSet(first.team[0], adapter)
  const roundTrip = validateTeam(fixtureTeam(editable), PROFILE)
  if (!roundTrip.valid) return roundTrip
  const final = editableSet(roundTrip.team[0], adapter)
  if (canonicalJson(editable) !== canonicalJson(final)) throw new Error(`${set.species}: editable normalization did not stabilize.`)
  return { valid: true, set: final }
}

function baseSet(species) {
  const abilityId = Object.values(species.abilities)[0]
  return { species: species.name,
    ability: GEN3.abilities.find(ability => ability.id === abilityId).name,
    item: 'Leftovers', moves: [], nature: 'Hardy', level: 100,
    evs: stats(0), ivs: stats(31), happiness: 255, gender: species.gender ?? '' }
}

function applyOverride(species, adapter) {
  const override = OVERRIDES[species.id]
  const set = { ...baseSet(species), ...clone(override) }
  delete set.role
  applyRoleSettings(set, species, adapter, override.role)
  if (override.nature) set.nature = override.nature
  if (override.evs) set.evs = { ...stats(0), ...override.evs }
  const outcome = validateCandidate(set, adapter)
  if (!outcome.valid) throw new Error(`${species.id} override: ${JSON.stringify(outcome.errors)}`)
  const issues = qualityIssues(outcome.set, species, adapter)
  if (issues.length) throw new Error(`${species.id} override quality: ${issues.join(' ')}`)
  return { set: outcome.set, origin: 'project-generated', role: override.role,
    notes: ['Explicit species-mechanics override.', ...(LOW_MOVE_EXCEPTIONS[species.id] ? [LOW_MOVE_EXCEPTIONS[species.id]] : [])] }
}

function vendorSet(species, adapter, report) {
  if (!adapter.speciesIds.includes(species.id)) return null
  // Each species/attempt has its own seed. Adding a species never perturbs the
  // choices for another species. This seed belongs only to the offline corpus.
  for (let attempt = 0; attempt < 24; attempt++) {
    const raw = adapter.candidate(species.id, [species.num, attempt + 1, 1337, 2026])
    const set = editableSet(raw, adapter)
    // Random form aliases must not weight or replace the default base form.
    set.species = species.name
    const role = applyRoleSettings(set, species, adapter, raw.role)
    const outcome = validateCandidate(set, adapter)
    if (!outcome.valid) { report.rejectedVendorCandidates++; continue }
    const issues = qualityIssues(outcome.set, species, adapter)
    if (issues.length) { report.rejectedVendorQuality++; continue }
    return { set: outcome.set, origin: 'vendor-derived', role,
      notes: ['Pinned vendor moves, item and ability; level 100 and project role-aware nature/EVs.',
        ...(set.moves.includes('Hidden Power') ? [`Hidden Power ${adapter.hiddenPower(set.ivs).type}, ${adapter.hiddenPower(set.ivs).power} power; IVs retained.`] : [])],
      sourceSet: { speciesId: species.id, attempt, seed: [species.num, attempt + 1, 1337, 2026] } }
  }
  report.vendorFallbackSpecies.push(species.id)
  return null
}

function generatedSet(species, adapter) {
  let set = baseSet(species)
  const rejected = new Set()
  while (set.moves.length < 4) {
    const candidates = rankCandidates(species, set, adapter).filter(candidate => !rejected.has(candidate.id))
    let added = false
    for (const move of candidates) {
      const next = { ...clone(set), moves: [...set.moves, move.name] }
      if (move.ivs) next.ivs = { ...move.ivs }
      applyRoleSettings(next, species, adapter)
      if (next.moves.some(move => id(move) === 'rest')) next.item = 'Chesto Berry'
      const outcome = validateCandidate(next, adapter)
      if (!outcome.valid) { rejected.add(move.id); continue }
      set = outcome.set; added = true; break
    }
    if (!added) break
  }
  const role = applyRoleSettings(set, species, adapter)
  const final = validateCandidate(set, adapter)
  const issues = final.valid ? qualityIssues(final.set, species, adapter) : final.errors.map(error => error.message)
  if (issues.length) throw new Error(`${species.id} fallback failed: ${issues.join(' ')}; ${JSON.stringify(set)}`)
  return { set: final.set, origin: 'project-generated', role,
    notes: ['Deterministic source-aware Gen 3 attack/utility selection, checked after each addition.',
      'Role-aware stats; simple casual baseline, without team synergy or competitive-balance guarantees.'] }
}

export function buildCollection() {
  const adapter = createStarterSetAdapter()
  const identity = getIdentity(PROFILE)
  const report = { rejectedVendorCandidates: 0, rejectedVendorQuality: 0, vendorFallbackSpecies: [] }
  const entries = GEN3.species.map(species => ({ speciesId: species.id,
    ...(OVERRIDES[species.id] ? applyOverride(species, adapter) : vendorSet(species, adapter, report) ?? generatedSet(species, adapter)),
    reviewStatus: 'baseline-checked',
  }))
  const collection = {
    schemaVersion: 1, version: VERSION, profileId: PROFILE,
    source: {
      vendor: adapter.source, dataSha256: GEN3_MANIFEST.artifacts['data/gen3.json'].sha256,
      profileSha256: identity.format.definitionSha256,
      policyVersion: POLICY_VERSION,
      policySha256: sha256(readFileSync(new URL('./policy.mjs', import.meta.url))),
      builderSha256: sha256(readFileSync(new URL('./build.mjs', import.meta.url))),
      adapterSha256: sha256(readFileSync(new URL('../../packages/battle-engine/src/generation.js', import.meta.url))),
      attribution: 'Pokémon Showdown contributors, MIT license; see tools/team-generation/NOTICE.',
    },
    quality: { meaning: 'Whole-team legality and explicit role/dependency baseline checks; no claim of competitive optimization or equal strength.',
      reviewStatus: 'baseline-checked', advertisedSpecies: 386, templatesPerSpecies: 1 },
    entries,
  }
  return { collection, report: { schemaVersion: 1, version: VERSION,
    speciesCount: entries.length, vendorDerived: entries.filter(entry => entry.origin === 'vendor-derived').length,
    projectGenerated: entries.filter(entry => entry.origin === 'project-generated').length,
    fullTeamLegality: 'All 386 sets pass the six-member Open Singles validator and editable DTO round trip.',
    lowMoveExceptions: LOW_MOVE_EXCEPTIONS, ...report } }
}

function main() {
  const { collection, report } = buildCollection()
  const outputs = [[OUTPUT, collection], [REPORT, report]]
  if (process.argv.includes('--check')) {
    for (const [path, data] of outputs) if (readFileSync(path, 'utf8') !== canonicalJson(data)) {
      throw new Error(`${fileURLToPath(path)} is stale; rerun node tools/team-generation/build.mjs.`)
    }
  } else {
    mkdirSync(new URL('../../apps/server/teams/', import.meta.url), { recursive: true })
    for (const [path, data] of outputs) writeFileSync(path, canonicalJson(data))
  }
  console.log(JSON.stringify(report, null, 2))
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
