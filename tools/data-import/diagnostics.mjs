import { compare } from './extract.mjs'

const byId = (a, b) => compare(a.id, b.id)
const byField = (a, b) => compare(a.id, b.id) || compare(a.field, b.field)

// This probe tests upstream obtainability only. It is not a game format, tier,
// clauses decision, or a claim that our JSON projection can validate teams.
const PROBE_FORMAT = Object.freeze({
  name: 'Gen3 Data Probe',
  effectType: 'Format',
  mod: 'gen3',
  ruleset: ['Obtainable'],
  banlist: [],
})

const FIXTURES = [
  { id: 'shedinja-swords-dance', speciesId: 'shedinja', moveIds: ['swordsdance'], expectedValid: true },
  { id: 'shedinja-baton-pass', speciesId: 'shedinja', moveIds: ['batonpass'], expectedValid: true },
  { id: 'shedinja-incompatible-evolution-moves', speciesId: 'shedinja', moveIds: ['swordsdance', 'batonpass'], expectedValid: false, expectedProblem: "Shedinja's moves Swords Dance, Baton Pass are incompatible." },
  { id: 'pikachu-surf', speciesId: 'pikachu', moveIds: ['surf'], expectedValid: true },
  { id: 'pikachu-fly', speciesId: 'pikachu', moveIds: ['fly'], expectedValid: true },
  { id: 'pikachu-incompatible-events', speciesId: 'pikachu', moveIds: ['surf', 'fly'], expectedValid: false, expectedProblem: "Pikachu's moves Surf, Fly are incompatible." },
  { id: 'smeargle-explosion', speciesId: 'smeargle', moveIds: ['explosion'], expectedValid: true },
  { id: 'smeargle-cannot-sketch-struggle', speciesId: 'smeargle', moveIds: ['struggle'], expectedValid: false, expectedProblem: "Smeargle's move Struggle can't be Sketched." },
]

function checkCandidateLearnsets(validator, dex, data) {
  const catalogMoveIds = new Set(data.moves.map(row => row.id))
  const bySpecies = [...data.learnsets].sort(byId).map(row => {
    const species = dex.species.get(row.id)
    if (!species.exists) throw new Error(`Missing probe species: ${row.id}`)
    const directMoveIds = new Set(row.sources.map(source => source.moveId))
    const sketchMoveIds = new Set(row.sketchMoveIds)
    const candidates = [...new Set([...directMoveIds, ...sketchMoveIds])].sort(compare)
    const passedMoveIds = [], rejected = []
    for (const moveId of candidates) {
      const move = dex.moves.get(moveId)
      if (!move.exists || !catalogMoveIds.has(move.id)) throw new Error(`Missing probe move: ${row.id}.${moveId}`)
      // Omit setSources so every candidate receives its own fresh source state.
      // Sharing that state would accidentally test compatibility across moves.
      const reason = validator.checkCanLearn(move, species)
      if (reason === null) passedMoveIds.push(moveId)
      else rejected.push({ moveId, reason })
    }
    return {
      speciesId: row.id,
      directCandidateCount: directMoveIds.size,
      sketchCandidateCount: sketchMoveIds.size,
      total: candidates.length,
      passedMoveIds,
      rejected,
    }
  })
  return {
    scope: 'Every unique species/move pair in the exported direct-source union plus sketchMoveIds; each checked independently at the upstream default level 100.',
    limitation: 'An individually learnable move does not prove a complete set or team is obtainable. Event, breeding and evolution sources can be mutually incompatible.',
    total: bySpecies.reduce((sum, row) => sum + row.total, 0),
    passed: bySpecies.reduce((sum, row) => sum + row.passedMoveIds.length, 0),
    failed: bySpecies.reduce((sum, row) => sum + row.rejected.length, 0),
    bySpecies,
  }
}

function checkLegalityFixtures(validator, dex) {
  return [...FIXTURES].sort(byId).map(fixture => {
    const species = dex.species.get(fixture.speciesId)
    if (!species.exists) throw new Error(`Missing fixture species: ${fixture.speciesId}`)
    const individualChecks = fixture.moveIds.map(moveId => {
      const move = dex.moves.get(moveId)
      if (!move.exists) throw new Error(`Missing fixture move: ${moveId}`)
      const reason = validator.checkCanLearn(move, species)
      const expectedValid = fixture.id !== 'smeargle-cannot-sketch-struggle'
      return { moveId, expectedValid, actualValid: reason === null, expectationMet: (reason === null) === expectedValid, reason }
    })
    // validateSet mutates its argument. Always construct an owned complete set;
    // hp:1 avoids Showdown's warning about an accidentally untrained 0-EV set.
    const set = {
      name: species.name,
      species: species.name,
      ability: species.abilities['0'],
      item: '',
      nature: 'Hardy',
      level: 100,
      moves: fixture.moveIds.map(moveId => dex.moves.get(moveId).name),
      evs: { hp: 1, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    }
    const problems = validator.validateSet(set, {}) ?? []
    const actualValid = problems.length === 0
    const rejectionReasonMatches = fixture.expectedValid || (problems.length === 1 && problems[0] === fixture.expectedProblem)
    return {
      ...fixture,
      moveIds: [...fixture.moveIds],
      actualValid,
      expectationMet: actualValid === fixture.expectedValid && rejectionReasonMatches && individualChecks.every(check => check.expectationMet),
      individualChecks,
      problems,
    }
  })
}

function comparePreviewRules(dex, data, previewRules) {
  const mappings = [], unmappedPreviewMoves = [], discrepancies = [], notes = []
  const catalogMoveIds = new Set(data.moves.map(row => row.id))
  const seenPreviewIds = new Set(), coveredMoveIds = new Set()

  for (const rule of [...previewRules].sort(byId)) {
    if (seenPreviewIds.has(rule.id)) throw new Error(`Duplicate preview move: ${rule.id}`)
    seenPreviewIds.add(rule.id)
    const byRuleId = dex.moves.get(rule.id)
    const byName = dex.moves.get(rule.name)
    if (byRuleId.exists && byName.exists && byRuleId.id !== byName.id) {
      throw new Error(`Conflicting upstream ID/name mapping for preview move ${rule.id}: ${byRuleId.id} / ${byName.id}`)
    }
    // Canonicalization and known aliases belong to upstream. Never fuzzy-match
    // or invent an alias to make a preview rule look covered by the catalogue.
    const move = byRuleId.exists ? byRuleId : byName
    if (!move.exists || !catalogMoveIds.has(move.id)) {
      unmappedPreviewMoves.push({ id: rule.id, name: rule.name, reason: !move.exists ? 'no-upstream-id-or-name-match' : 'outside-exported-gen3-catalog' })
      continue
    }
    coveredMoveIds.add(move.id)
    mappings.push({ id: rule.id, name: rule.name, canonicalId: move.id, canonicalName: move.name, resolvedBy: byRuleId.exists ? 'id' : 'name' })

    const upstream = { name: move.name, type: move.type, power: move.basePower, accuracy: move.accuracy }
    for (const field of ['name', 'type', 'power', 'accuracy']) {
      const current = rule[field] ?? null
      if (current === upstream[field]) continue
      const row = { id: rule.id, canonicalId: move.id, field, current, upstream: upstream[field] }
      if (field === 'power' && (current === null || current === 0 || upstream.power === 0)) {
        let reason
        if (move.category === 'Status' && upstream.power === 0) reason = 'non-damaging-power-sentinel: preview null/zero and upstream zero are not competing base-power values'
        else if (move.damage !== undefined || move.damageCallback || move.ohko) reason = 'special-damage-power-sentinel: fixed, level-based, callback or OHKO damage is not ordinary base power'
        else reason = 'variable-or-showcase-power: null/zero does not specify a fixed base power; a preview sample is not a Gen 3 rule value'
        notes.push({ ...row, reason })
      } else if (field === 'accuracy' && current === null && upstream.accuracy === true) {
        notes.push({ ...row, reason: 'accuracy-sentinel: preview null and upstream true both omit a numeric accuracy value' })
      } else if (field === 'name') {
        notes.push({ ...row, reason: 'upstream-canonical-display-name: both preview ID/name resolve to this move; not a mechanics discrepancy' })
      } else {
        discrepancies.push({ ...row, reason: field === 'accuracy' && current === null
          ? 'preview-omits-numeric-accuracy: the resolved Gen 3 record specifies numeric accuracy'
          : `preview-metadata-differs-from-resolved-gen3-${field}` })
      }
    }
  }
  const missingPreviewMoves = data.moves.filter(move => !coveredMoveIds.has(move.id))
    .map(move => ({ id: move.id, num: move.num, name: move.name })).sort(byId)
  discrepancies.sort(byField)
  notes.sort(byField)
  return {
    scope: 'Read-only comparison of preview name/type/power/accuracy metadata to the resolved upstream Gen 3 Dex. It does not compare fixed preview damage or execute battle mechanics.',
    interpretation: 'Discrepancies identify metadata differences for review, not automatic corrections to a deliberate showcase. Zero/null power, sentinel accuracy and canonical display-name differences are recorded separately as notes.',
    counts: {
      previewMoves: previewRules.length,
      catalogMoves: data.moves.length,
      mappedPreviewMoves: mappings.length,
      uniqueOverlappingMoves: coveredMoveIds.size,
      unmappedPreviewMoves: unmappedPreviewMoves.length,
      missingPreviewMoves: missingPreviewMoves.length,
      discrepancyFields: discrepancies.length,
      movesWithDiscrepancies: new Set(discrepancies.map(row => row.id)).size,
      noteFields: notes.length,
    },
    mappings,
    unmappedPreviewMoves,
    missingPreviewMoves,
    discrepancies,
    notes,
  }
}

/** Generate reproducible diagnostics; no timestamps or edits to exported data. */
export function buildDiagnostics({ Dex, TeamValidator, dex, data, audit, previewRules }) {
  if (dex.gen !== 3 || data.generation !== 3) throw new Error('Diagnostics require a resolved Gen 3 Dex and Gen 3 data.')
  const probeFormat = { ...PROBE_FORMAT, ruleset: [...PROBE_FORMAT.ruleset], banlist: [...PROBE_FORMAT.banlist] }
  const validator = new TeamValidator(new Dex.Format(probeFormat), Dex)
  if (validator.gen !== 3) throw new Error('The data-probe validator did not resolve to Generation 3.')
  const candidateLearnsets = checkCandidateLearnsets(validator, dex, data)
  const legalityFixtures = checkLegalityFixtures(validator, dex)
  const previewComparison = comparePreviewRules(dex, data, previewRules)
  const failures = [
    ...candidateLearnsets.bySpecies.flatMap(row => row.rejected.map(move => ({ kind: 'candidate-rejected', speciesId: row.speciesId, ...move }))),
    ...legalityFixtures.filter(row => !row.expectationMet).map(row => ({ kind: 'fixture-expectation-mismatch', id: row.id, problems: row.problems })),
    ...previewComparison.unmappedPreviewMoves.map(row => ({ kind: 'unmapped-preview-move', ...row })),
  ]
  return {
    schemaVersion: 1,
    probeFormat,
    probeDisclaimer: 'Diagnostics-only Obtainable probe. This does not adopt a competitive ruleset, clauses or banlist for the game, and does not add executable validation to the exported metadata.',
    checks: { passed: failures.length === 0, failures },
    candidateLearnsets,
    legalityFixtures,
    previewComparison,
    extractionAudit: {
      exclusions: Object.fromEntries(Object.entries(audit.exclusions).sort(([a], [b]) => compare(a, b)).map(([table, rows]) => [table, rows.length])),
      omittedRelationships: audit.omittedRelationships.length,
      aliases: audit.aliases.length,
      recordsWithBehaviorCallbacks: audit.behaviorCallbacks.length,
    },
  }
}
