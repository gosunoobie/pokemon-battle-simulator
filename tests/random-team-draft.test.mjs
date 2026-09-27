import test from 'node:test'
import assert from 'node:assert/strict'
import { createTeamDraft, toTeamPayload, draftIssues } from '../apps/shared/teams/teamDraft.js'
import { createRandomTeamDraftController } from '../apps/shared/teams/randomTeamDraft.js'
import { getTeamBuilderCatalog } from '../apps/server/team-builder.js'
import collection from '../apps/server/teams/starter-sets.generated.json' with { type: 'json' }

const team = (prefix = 'Original') => createTeamDraft(Array.from({ length: 6 }, (_, index) => ({
  species: `${prefix} ${index + 1}`, moves: ['Tackle'], ability: 'Pressure', item: 'Leftovers', nature: 'Adamant',
  evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
})))
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function fixture(initial = team()) {
  let value = { team: initial, context: 'seat-1:lead-0', disabled: false }
  const requests = [], commits = [], states = []
  const controller = createRandomTeamDraftController({
    read: () => value,
    generate: (body, options) => {
      const pending = deferred()
      requests.push({ body, ...options, ...pending })
      return pending.promise
    },
    commit: next => { value = { ...value, team: next }; commits.push(next) },
    onState: next => states.push(next),
  })
  return { controller, requests, commits, states, get value() { return value },
    change: patch => { value = { ...value, ...patch } },
    resolve: (index = requests.length - 1, generated = team('Generated')) => requests[index].resolve({ valid: true, team: generated, collection: { version: 'test', speciesCount: 386 } }),
  }
}

test('generation replaces one six-slot draft atomically and offers a single immutable undo', async () => {
  const f = fixture(createTeamDraft()), before = structuredClone(f.value.team)
  const work = f.controller.run()
  assert.equal(f.controller.getState().busy, true)
  assert.equal(f.commits.length, 0)
  assert.deepEqual(f.requests[0].body, { team: toTeamPayload(before), lockedSlots: [] })
  f.resolve()
  assert.equal(await work, true)
  assert.equal(f.commits.length, 1)
  assert.deepEqual(f.value.team, team('Generated'))
  assert.equal(f.controller.getState().collection.speciesCount, 386)
  assert.equal(f.controller.getState().busy, false)
  assert.equal(f.controller.getState().canUndo, true)
  f.requests[0].body.team[0].species = 'A changed transport object'
  assert.equal(f.controller.undo(), true)
  assert.deepEqual(f.value.team, before)
  assert.equal(f.controller.undo(), false)
})

test('full-set locks preserve all user settings and empty move positions through generation', async () => {
  const f = fixture(), original = structuredClone(f.value.team)
  original[2].moves = ['', 'Tackle', '', '']
  original[2].ivs.atk = 7; original[2].gender = 'F'; original[2].happiness = 42
  f.change({ team: original }); f.controller.sync()
  f.controller.toggleLock(2); f.controller.toggleLock(4)
  const work = f.controller.run()
  assert.deepEqual(f.requests[0].body.lockedSlots, [2, 4])
  assert.deepEqual(f.requests[0].body.team[2].moves, ['Tackle'])
  f.resolve(); await work
  assert.deepEqual(f.value.team[2], original[2])
  assert.deepEqual(f.value.team[4], original[4])
  assert.equal(f.value.team[0].species, 'Generated 1')
  assert.deepEqual(f.controller.getState().lockedSlots, [2, 4])
})

test('one-slot reroll retains every other populated slot, independent of visible locks', async () => {
  const f = fixture(), before = structuredClone(f.value.team)
  f.controller.toggleLock(0)
  const work = f.controller.run(3)
  assert.deepEqual(f.requests[0].body.lockedSlots, [0, 1, 2, 4, 5])
  f.resolve(); await work
  for (const index of [0, 1, 2, 4, 5]) assert.deepEqual(f.value.team[index], before[index])
  assert.equal(f.value.team[3].species, 'Generated 4')
  assert.deepEqual(f.controller.getState().lockedSlots, [0])
  assert.equal(await f.controller.run(0), false)
  assert.equal(f.requests.length, 1)
})

test('blank slots cannot be locked and six locks make generation a no-op until unlocked', async () => {
  const blank = fixture(createTeamDraft())
  blank.controller.toggleLock(0)
  assert.deepEqual(blank.controller.getState().lockedSlots, [])
  const f = fixture()
  for (let index = 0; index < 6; index++) f.controller.toggleLock(index)
  assert.equal(await f.controller.run(), false)
  assert.equal(f.requests.length, 0)
  f.controller.unlockAll()
  const work = f.controller.run(); f.resolve(); await work
  assert.equal(f.requests.length, 1)
})

test('editing during generation aborts it and a late success cannot replace the edit', async () => {
  const f = fixture(), work = f.controller.run()
  const edited = structuredClone(f.value.team)
  edited[0].nature = 'Jolly'; edited[0].evs.atk = 240
  f.controller.edit(edited)
  assert.equal(f.requests[0].signal.aborted, true)
  assert.equal(f.controller.getState().busy, false)
  f.resolve()
  assert.equal(await work, false)
  assert.deepEqual(f.value.team, edited)
  assert.equal(f.controller.getState().canUndo, false)
})

test('locks changed during generation invalidate the result and retain the current draft', async () => {
  const f = fixture(), before = structuredClone(f.value.team), work = f.controller.run()
  f.controller.toggleLock(5)
  assert.equal(f.requests[0].signal.aborted, true)
  f.resolve(); await work
  assert.equal(f.commits.length, 0)
  assert.deepEqual(f.value.team, before)
  assert.deepEqual(f.controller.getState().lockedSlots, [5])
})

test('lead or seat changes reject a result even before an external-state watcher runs', async () => {
  for (const context of ['seat-1:lead-2', 'seat-2:lead-0']) {
    const f = fixture(), work = f.controller.run()
    f.change({ context })
    f.resolve(); await work
    assert.equal(f.commits.length, 0)
    assert.equal(f.controller.getState().busy, false)
  }
})

test('host replacement, disable and disposal reject both late successes and failures', async () => {
  for (const operation of ['replace', 'disable', 'dispose']) {
    const f = fixture(), work = f.controller.run()
    if (operation === 'replace') f.change({ team: team('New external') })
    if (operation === 'disable') f.change({ disabled: true })
    if (operation === 'dispose') f.controller.dispose()
    else f.controller.sync()
    assert.equal(f.requests[0].signal.aborted, true)
    f.requests[0].reject(new Error('Late failure'))
    await work
    assert.equal(f.commits.length, 0)
    assert.deepEqual(f.controller.getState().errors, [])
  }
})

test('only the newest request can commit even when an aborted request completes afterward', async () => {
  const f = fixture(), first = f.controller.run(), second = f.controller.run()
  assert.equal(f.requests[0].signal.aborted, true)
  f.resolve(1, team('Newest')); await second
  f.resolve(0, team('Old')); await first
  assert.equal(f.commits.length, 1)
  assert.deepEqual(f.value.team, team('Newest'))
  assert.equal(f.controller.getState().busy, false)
})

test('validation, transport and malformed-result failures leave the prior draft intact', async () => {
  const failure = [{ code: 'INVALID_LOCK', message: 'Choose compatible moves.', setIndex: 1 }]
  for (const kind of ['validation', 'transport', 'incomplete']) {
    const f = fixture(), before = structuredClone(f.value.team), work = f.controller.run()
    if (kind === 'validation') f.requests[0].resolve({ valid: false, errors: failure })
    if (kind === 'transport') f.requests[0].reject(Object.assign(new Error('Offline'), { issues: failure }))
    if (kind === 'incomplete') f.requests[0].resolve({ valid: true, team: team().slice(0, 4) })
    assert.equal(await work, false)
    assert.equal(f.commits.length, 0)
    assert.deepEqual(f.value.team, before)
    assert.equal(f.controller.getState().busy, false)
    assert.equal(f.controller.getState().canUndo, false)
    assert.equal(f.controller.getState().errors.length, 1)
    if (kind !== 'incomplete') assert.deepEqual(f.controller.getState().errors, failure)
  }
})

test('direct edits clear old undo and clearing a slot removes its lock', async () => {
  const f = fixture()
  f.controller.toggleLock(2)
  const work = f.controller.run(); f.resolve(); await work
  const edited = structuredClone(f.value.team)
  edited[2] = createTeamDraft()[0]
  f.controller.edit(edited)
  assert.deepEqual(f.controller.getState().lockedSlots, [])
  assert.equal(f.controller.getState().canUndo, false)
  assert.equal(f.controller.undo(), false)
})

test('temporarily disabling for validation preserves completed generation undo for an unchanged draft', async () => {
  const f = fixture(), before = structuredClone(f.value.team)
  const work = f.controller.run(); f.resolve(); await work
  f.change({ disabled: true }); f.controller.sync()
  assert.equal(f.controller.getState().canUndo, true)
  assert.equal(f.controller.undo(), false, 'disabled editor cannot be changed')
  // The validation callback replaces the array and can return canonical metadata;
  // these values normalize back to the same six editable sets.
  const canonical = toTeamPayload(f.value.team)
  canonical[0].hpType = 'Dark'
  canonical[0].name = canonical[0].species
  f.change({ team: createTeamDraft(canonical), disabled: false }); f.controller.sync()
  assert.equal(f.controller.getState().canUndo, true)
  assert.equal(f.controller.undo(), true)
  assert.deepEqual(f.value.team, before)
})

test('disabled-only transitions cancel a pending reroll without discarding the earlier undo', async () => {
  const f = fixture(), before = structuredClone(f.value.team)
  const first = f.controller.run(); f.resolve(); await first
  const second = f.controller.run()
  f.change({ disabled: true }); f.controller.sync()
  assert.equal(f.requests[1].signal.aborted, true)
  f.change({ disabled: false }); f.controller.sync()
  f.resolve(1, team('Too late')); await second
  assert.deepEqual(f.value.team, team('Generated'))
  assert.equal(f.controller.getState().canUndo, true)
  assert.equal(f.controller.undo(), true)
  assert.deepEqual(f.value.team, before)
})

test('a meaningful validated edit or selection-context change still clears generation undo', async () => {
  for (const change of ['team', 'context']) {
    const f = fixture(), work = f.controller.run(); f.resolve(); await work
    f.change({ disabled: true }); f.controller.sync()
    const next = structuredClone(f.value.team)
    next[0].ivs.atk = 0
    f.change({ ...(change === 'team' ? { team: next } : { context: 'seat-1:lead-2' }), disabled: false })
    f.controller.sync()
    assert.equal(f.controller.getState().canUndo, false)
    assert.equal(f.controller.undo(), false)
  }
})

test('every generated starter set remains editable and passes the shared candidate checks', () => {
  const catalog = getTeamBuilderCatalog()
  for (const entry of collection.entries) {
    const teammates = collection.entries.filter(other => other.speciesId !== entry.speciesId).slice(0, 5)
    const draft = createTeamDraft([entry.set, ...teammates.map(other => other.set)])
    assert.deepEqual(draftIssues(draft, catalog), [], `${entry.speciesId} cannot be selected by the client`)
    assert.deepEqual(draft[0].moves.filter(Boolean), entry.set.moves)
    assert.deepEqual(draft[0].evs, entry.set.evs)
    assert.deepEqual(draft[0].ivs, entry.set.ivs)
  }
})
