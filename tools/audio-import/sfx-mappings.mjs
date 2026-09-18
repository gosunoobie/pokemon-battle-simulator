// Import-time filename classification only. This module cannot approve or play a sound.
const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0
const has = (value, key) => Object.hasOwn(value, key)
const check = (condition, message) => { if (!condition) throw new Error(message) }
const object = (value, name) => check(value && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`)
const text = (value, name) => check(typeof value === 'string' && value.trim().length > 0, `${name} must be a nonempty string`)
const eventId = value => check(typeof value === 'string' && /^battle(?:\.[a-z][a-z0-9-]*)+$/.test(value), `Invalid event ID: ${value}`)
const playback = () => ({ normal: 'unreviewed', reduced: 'unreviewed', instant: 'unreviewed' })

function indexedMoves(moves) {
  const byId = new Map(), byLabel = new Map()
  const index = (label, id) => {
    const key = normalize(label)
    const candidates = byLabel.get(key) ?? new Set()
    candidates.add(id)
    byLabel.set(key, candidates)
  }
  for (const move of moves) {
    object(move, 'Move')
    check(typeof move.id === 'string' && /^[a-z0-9]+$/.test(move.id), `Invalid canonical move ID: ${move.id}`)
    text(move.name, `Move ${move.id} name`)
    check(!byId.has(move.id), `Duplicate move ID: ${move.id}`)
    byId.set(move.id, move)
    index(move.id, move.id)
    index(move.name, move.id)
  }
  for (const [label, ids] of byLabel) check(ids.size === 1, `Ambiguous move label: ${label}`)
  return { byId, byLabel }
}

function variantFor(stem) {
  let match
  if ((match = /^(.*) part ([1-9][0-9]*)$/.exec(stem))) {
    const part = Number(match[2])
    check(Number.isSafeInteger(part), `Invalid part number: ${stem}`)
    return { label: match[1], variant: { type: 'part', part } }
  }
  if ((match = /^(.*) ([1-9][0-9]*)hits?$/.exec(stem))) {
    const hitCount = Number(match[2])
    check(Number.isSafeInteger(hitCount), `Invalid hit count: ${stem}`)
    return { label: match[1], variant: { type: 'hit-count', hitCount } }
  }
  if ((match = /^(.*) turn (damage|heal)$/.exec(stem))) {
    return { label: match[1], variant: { type: 'turn-effect', outcome: match[2] } }
  }
  if ((match = /^(.*) (damage|heal)$/.exec(stem))) {
    return { label: match[1], variant: { type: 'outcome', outcome: match[2] } }
  }
  return { label: stem, variant: { type: 'whole' } }
}

function aliasPolicy(aliases, name, moves) {
  const normalized = new Set()
  for (const [label, alias] of Object.entries(aliases)) {
    text(label, `${name} label`)
    object(alias, `${name} ${label}`)
    text(alias.reason, `${name} ${label} reason`)
    check(moves.byId.has(alias.moveId), `Unknown ${name} target: ${alias.moveId}`)
    const key = normalize(label)
    check(key && !normalized.has(key), `Ambiguous ${name} label: ${label}`)
    normalized.add(key)
    check(!moves.byLabel.has(key), `Redundant or conflicting ${name} alias: ${label}`)
  }
}

/**
 * Account for every file and move without treating filename candidates as approved cues.
 * All inputs are supplied by the audit driver: no filesystem or package dependency.
 */
export function buildMappings({ files, moves, fxCatalog, policy }) {
  check(Array.isArray(files) && Array.isArray(moves) && Array.isArray(fxCatalog), 'files, moves and fxCatalog must be arrays')
  object(policy, 'Mapping policy')
  check(policy.schemaVersion === 1, 'Unsupported mapping policy schemaVersion')
  const permitted = new Set(['schemaVersion', 'name', 'moveNameAliases', 'fxAliases', 'calledMoves', 'genericFiles', 'deferredEvents'])
  for (const key of Object.keys(policy)) check(permitted.has(key), `Unknown mapping policy field: ${key}`)
  text(policy.name, 'Mapping policy name')
  for (const key of ['moveNameAliases', 'fxAliases', 'calledMoves', 'genericFiles', 'deferredEvents']) object(policy[key], key)
  const moveIndex = indexedMoves(moves)
  aliasPolicy(policy.moveNameAliases, 'move-name', moveIndex)
  aliasPolicy(policy.fxAliases, 'FX', moveIndex)
  const usedNameAliases = new Set(), usedFxAliases = new Set(), usedGenericFiles = new Set()
  const moveRecords = {}, eventRecords = {}, discrepancies = []
  for (const move of [...moves].sort((a, b) => compare(a.id, b.id))) {
    moveRecords[move.id] = {
      id: move.id, name: move.name, fxId: null, status: 'missing', assetIds: [],
      reviewStatus: 'needs-listening', playback: playback(), notes: [],
    }
  }
  for (const [id, entry] of Object.entries(policy.calledMoves)) {
    check(moveIndex.byId.has(id), `Orphan called-move policy: ${id}`)
    object(entry, `Called move ${id}`)
    text(entry.reason, `Called move ${id} reason`)
    moveRecords[id].status = 'called-move'
    moveRecords[id].notes.push(entry.reason)
  }
  for (const [file, entry] of Object.entries(policy.genericFiles)) {
    object(entry, `Generic file ${file}`)
    eventId(entry.eventId)
    text(entry.reason, `Generic file ${file} reason`)
    check(!has(eventRecords, entry.eventId), `Duplicate generic event ID: ${entry.eventId}`)
    check(entry.initialRelease === undefined || entry.initialRelease === 'deferred', `Invalid initialRelease: ${file}`)
    eventRecords[entry.eventId] = {
      id: entry.eventId, status: 'candidate', assetIds: [], reviewStatus: 'needs-listening',
      playback: playback(), initialRelease: entry.initialRelease ?? 'unreviewed', notes: [entry.reason],
    }
  }
  for (const [id, reason] of Object.entries(policy.deferredEvents)) {
    eventId(id)
    text(reason, `Deferred event ${id} reason`)
    check(!has(eventRecords, id), `Deferred event overlaps a generic candidate: ${id}`)
    eventRecords[id] = {
      id, status: 'deferred', assetIds: [], reviewStatus: 'needs-source-review',
      playback: playback(), initialRelease: 'deferred', notes: [reason],
    }
    discrepancies.push({ code: 'DEFERRED_EVENT', severity: 'info', subject: id, message: reason })
  }

  const fxIds = new Set()
  for (const fx of fxCatalog) {
    object(fx, 'FX descriptor')
    text(fx.id, 'FX ID')
    text(fx.name, `FX ${fx.id} name`)
    check(!fxIds.has(fx.id), `Duplicate FX ID: ${fx.id}`)
    fxIds.add(fx.id)
    let id
    if (has(policy.fxAliases, fx.id)) {
      id = policy.fxAliases[fx.id].moveId
      usedFxAliases.add(fx.id)
    } else {
      const candidates = new Set([...(moveIndex.byLabel.get(normalize(fx.id)) ?? []), ...(moveIndex.byLabel.get(normalize(fx.name)) ?? [])])
      check(candidates.size === 1, `${candidates.size ? 'Ambiguous' : 'Unknown'} FX mapping: ${fx.id}`)
      id = [...candidates][0]
    }
    check(moveRecords[id].fxId === null, `Multiple FX recipes map to move: ${id}`)
    moveRecords[id].fxId = fx.id
  }

  const filenames = new Set(), assetIds = new Set(), assets = []
  for (const source of [...files].sort((a, b) => compare(a.file, b.file))) {
    object(source, 'Source file')
    const file = source.file
    check(typeof file === 'string' && /^[A-Za-z0-9][A-Za-z0-9 .'-]*\.mp3$/.test(file) && !file.includes('..'), `Invalid source filename: ${file}`)
    check(!filenames.has(file), `Duplicate source filename: ${file}`)
    filenames.add(file)
    const stem = file.slice(0, -4)
    const id = `source.${stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}`
    check(!assetIds.has(id), `Duplicate normalized asset ID: ${id}`)
    assetIds.add(id)
    if (has(policy.genericFiles, file)) {
      const event = policy.genericFiles[file].eventId
      usedGenericFiles.add(file)
      eventRecords[event].assetIds.push(id)
      assets.push({ id, file, kind: 'battle-event', moveId: null, eventId: event, variant: { type: 'generic' }, reviewStatus: 'candidate' })
      continue
    }
    const { label, variant } = variantFor(stem)
    let moveId
    if (has(policy.moveNameAliases, label)) {
      moveId = policy.moveNameAliases[label].moveId
      usedNameAliases.add(label)
    } else {
      const candidates = moveIndex.byLabel.get(normalize(label))
      check(candidates?.size === 1, `Unclassified source filename: ${file}`)
      moveId = [...candidates][0]
    }
    check(!has(policy.calledMoves, moveId), `Called-move policy is stale; named recording now exists: ${moveId}`)
    moveRecords[moveId].status = 'candidate'
    moveRecords[moveId].assetIds.push(id)
    assets.push({ id, file, kind: 'move', moveId, variant, reviewStatus: 'candidate' })
  }
  for (const [name, entries, used] of [
    ['move-name alias', policy.moveNameAliases, usedNameAliases],
    ['FX alias', policy.fxAliases, usedFxAliases],
    ['generic file', policy.genericFiles, usedGenericFiles],
  ]) for (const key of Object.keys(entries)) check(used.has(key), `Orphan ${name} policy: ${key}`)

  for (const record of Object.values(moveRecords)) {
    if (!record.fxId) discrepancies.push({ code: 'MOVE_WITHOUT_FX', severity: 'info', subject: record.id, message: 'No FX recipe is registered; sound candidates remain valid for later host-policy review.' })
    if (!record.assetIds.length) discrepancies.push({
      code: record.status === 'called-move' ? 'CALLED_MOVE_WITHOUT_RECORDING' : 'MOVE_WITHOUT_RECORDING',
      severity: 'warning', subject: record.id,
      message: record.status === 'called-move' ? record.notes[0] : 'No named recording or called-move policy exists; this move remains explicitly missing.',
    })
    if (record.assetIds.length > 1) discrepancies.push({ code: 'MULTIPLE_UNREVIEWED_CANDIDATES', severity: 'info', subject: record.id, message: 'Several whole/variant recordings exist; no file order, cue role, region or layering choice has been approved.' })
  }
  if (assets.length) discrepancies.push({ code: 'FILENAME_CANDIDATES_REQUIRE_LISTENING', severity: 'warning', subject: 'pack', message: 'Every mapping is based on source filenames. Decoding does not approve identity, cue roles, hit counts, loop points, audible fit, gain or playback in any mode.' })
  return {
    assets, moves: moveRecords,
    events: Object.fromEntries(Object.entries(eventRecords).sort(([a], [b]) => compare(a, b))),
    discrepancies: discrepancies.sort((a, b) => compare(`${a.code}:${a.subject}`, `${b.code}:${b.subject}`)),
  }
}
