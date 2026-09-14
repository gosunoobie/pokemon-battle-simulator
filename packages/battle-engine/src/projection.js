import { getVendor } from './vendor.js'

const SEATS = ['p1', 'p2']
const otherSeat = seat => seat === 'p1' ? 'p2' : 'p1'
const clone = value => structuredClone(value)
const own = (object, key) => Object.hasOwn(object, key)
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
const detached = value => freeze(clone(value))
const assertSeat = seat => {
  if (!SEATS.includes(seat)) throw new TypeError('Unknown player seat')
}

// Only protocol facts whose fields are defined by the simulator battle protocol
// may cross this boundary. Debug, HTML, arbitrary text and private end data do not.
const CATEGORIES = {
  player: 'protocol', teamsize: 'protocol', gametype: 'protocol', gen: 'protocol',
  tier: 'protocol', rated: 'protocol', rule: 'protocol', start: 'protocol', upkeep: 'protocol',
  turn: 'turn', win: 'result', tie: 'result',
  switch: 'switch', drag: 'switch', replace: 'switch', swap: 'switch',
  move: 'move', cant: 'failure', faint: 'faint', detailschange: 'form',
  '-formechange': 'form', '-transform': 'form',
  '-damage': 'hp', '-heal': 'hp', '-sethp': 'hp',
  '-status': 'status', '-curestatus': 'status', '-cureteam': 'status',
  '-boost': 'stat', '-unboost': 'stat', '-setboost': 'stat', '-swapboost': 'stat',
  '-invertboost': 'stat', '-clearboost': 'stat', '-clearallboost': 'stat',
  '-clearpositiveboost': 'stat', '-clearnegativeboost': 'stat', '-copyboost': 'stat',
  '-weather': 'weather', '-fieldstart': 'field', '-fieldend': 'field', '-fieldactivate': 'field',
  '-sidestart': 'side-condition', '-sideend': 'side-condition', '-swapsideconditions': 'side-condition',
  '-start': 'volatile', '-end': 'volatile', '-singlemove': 'volatile', '-singleturn': 'volatile',
  '-item': 'item', '-enditem': 'item', '-ability': 'ability', '-endability': 'ability',
  '-fail': 'failure', '-block': 'failure', '-notarget': 'failure', '-miss': 'failure',
  '-immune': 'failure', '-crit': 'hit', '-supereffective': 'hit', '-resisted': 'hit',
  '-activate': 'activation', '-prepare': 'preparation', '-mustrecharge': 'preparation',
  '-nothing': 'protocol', '-hitcount': 'hit', '-center': 'protocol', '-combine': 'protocol',
  '-waiting': 'protocol',
}
const IGNORED = new Set(['', 't:', 'debug', 'error', 'bigerror', 'message', '-message', 'hint', '-hint',
  'html', 'raw', 'uhtml', 'uhtmlchange', 'inactiveside', 'inactive', 'inactiveoff', 'request'])

function startingMember(seat, set, index) {
  const species = set.species ?? set.speciesId ?? ''
  return {
    memberId: `${seat}:${index + 1}`, name: set.name || species, species,
    active: false, hp: null, hpPrecision: 'exact', condition: null, fainted: false,
    moves: [...(set.moves ?? [])], item: set.item ?? null,
    ability: set.ability ?? null, stats: {}, stages: {}, volatiles: [],
  }
}

function freshViewer(seat, team) {
  const ownTeam = team.map((set, index) => startingMember(seat, set, index))
  return {
    seat, turn: 0, cursor: 0, own: { team: ownTeam, active: null },
    opponent: { known: [], active: null }, weather: null, result: null,
    sideConditions: { p1: [], p2: [] }, fieldConditions: [],
    complete: true, projectionWarnings: [], events: [], request: null,
    identities: Object.fromEntries(ownTeam.map(member => [
      `${seat}: ${seat}-${member.memberId.split(':')[1]}`, member.memberId,
    ])),
    baseAbilities: Object.fromEntries(ownTeam.filter(member => member.ability).map(member => [member.memberId, member.ability])),
    baseSpecies: Object.fromEntries(ownTeam.map(member => [member.memberId, member.species])),
    changedAbilities: [],
    playerNames: { p1: 'p1', p2: 'p2' },
  }
}

function parseIdent(ident) {
  if (typeof ident !== 'string') return null
  const match = /^(p[12])(?:[a-z])?: (.+)$/.exec(ident)
  return match && { seat: match[1], name: match[2], key: `${match[1]}: ${match[2]}` }
}

function findMember(viewer, ident) {
  const parsed = parseIdent(ident)
  if (!parsed) return null
  const members = parsed.seat === viewer.seat ? viewer.own.team : viewer.opponent.known
  let memberId = own(viewer.identities, parsed.key) ? viewer.identities[parsed.key] : null
  if (!memberId) {
    if (parsed.seat === viewer.seat) {
      const match = new RegExp(`^${parsed.seat}-([1-6])$`).exec(parsed.name)
      if (match) {
        const index = Number(match[1]) - 1
        memberId = `${parsed.seat}:${index + 1}`
        if (!members.some(member => member.memberId === memberId)) {
          members.push(startingMember(parsed.seat, {}, index))
          members.sort((left, right) => Number(left.memberId.split(':')[1]) - Number(right.memberId.split(':')[1]))
        }
      } else {
        memberId = members.find(member => member.name === parsed.name)?.memberId
        if (!memberId) throw new Error('Unknown owned member identity in battle protocol')
      }
    } else {
      memberId = `${parsed.seat}:revealed:${members.length + 1}`
      members.push({
        memberId, name: null, species: null, active: false, hp: null,
        hpPrecision: 'public', condition: null, fainted: false, moves: [],
        item: null, ability: null, stats: {}, stages: {}, volatiles: [],
      })
    }
    viewer.identities[parsed.key] = memberId
  }
  return members.find(member => member.memberId === memberId)
}

function setDetails(member, details) {
  if (!member || !details) return
  member.species = details.split(',')[0]
  // Vendor nicknames are private stable identity tokens, never display names.
  if (member.hpPrecision === 'public' || !member.name) member.name = member.species
}

function setHealth(member, health) {
  if (!member || typeof health !== 'string') return
  const [amount, status] = health.trim().split(/\s+/)
  const match = /^(\d+)(?:\/(\d+))?([gry])?$/.exec(amount)
  if (!match) return
  const current = Number(match[1])
  const max = match[2] ? Number(match[2]) : member.hp?.max ?? (current === 0 ? null : current)
  member.hp = { current, max }
  // The current Gen 3 pin uses plain /48 bars. Later protocol variants append
  // a public color at ambiguous boundaries; this is display information only.
  if (match[3]) member.hpColor = { g: 'green', r: 'red', y: 'yellow' }[match[3]]
  else delete member.hpColor
  member.fainted = status === 'fnt' || current === 0
  member.condition = status && status !== 'fnt' ? status : null
}

function activate(viewer, member) {
  if (!member) return
  const side = member.memberId.startsWith(`${viewer.seat}:`) ? viewer.own : viewer.opponent
  const members = side.team ?? side.known
  for (const candidate of members) {
    if (candidate.active && candidate !== member) {
      resetSwitchState(viewer, candidate)
    }
    candidate.active = candidate === member
  }
  side.active = member.memberId
}

function resetSwitchState(viewer, member) {
  if (!member) return
  member.stages = {}
  member.volatiles = []
  if (member.transformedInto && viewer.baseSpecies[member.memberId]) setDetails(member, viewer.baseSpecies[member.memberId])
  delete member.transformedInto
  if (viewer.changedAbilities.includes(member.memberId)) {
    member.ability = viewer.baseAbilities[member.memberId] ?? null
    remove(viewer.changedAbilities, member.memberId)
  }
  delete member.moveOptions
  delete member.trapped
}

function revealAbility(viewer, member, ability, changed = false) {
  if (!member) return
  member.ability = ability
  if (changed) uniqueAdd(viewer.changedAbilities, member.memberId)
  else if (!viewer.changedAbilities.includes(member.memberId)) viewer.baseAbilities[member.memberId] = ability
}

function uniqueAdd(list, value) {
  if (value && !list.includes(value)) list.push(value)
}

function remove(list, value) {
  const index = list.indexOf(value)
  if (index !== -1) list.splice(index, 1)
}

function safeField(viewer, value) {
  // Actor references also occur inside [of]/[spread] attribution fields. Rewrite
  // the stable vendor token wherever it occurs; party positions stay private.
  return value.replace(/\bp([12])(?:[a-z])?: (p[12]-[1-6])\b/g, ident =>
    findMember(viewer, ident)?.memberId ?? '[unrecognized actor]')
}

function append(viewer, type, args) {
  viewer.events.push({ cursor: ++viewer.cursor, type, args })
}

function applyFacts(viewer, opcode, fields) {
  const actorOpcodes = new Set(['switch', 'drag', 'replace', 'move', 'cant', 'faint',
    'detailschange', '-formechange', '-transform', '-damage', '-heal', '-sethp',
    '-status', '-curestatus', '-item', '-enditem', '-ability', '-endability',
    '-boost', '-unboost', '-setboost', '-swapboost', '-invertboost', '-clearboost',
    '-clearpositiveboost', '-clearnegativeboost', '-copyboost', '-start', '-end',
    '-singlemove', '-singleturn', '-activate'])
  const member = actorOpcodes.has(opcode) && (opcode !== '-activate' || /^p[12][a-z]?: p[12]-[1-6]$/.test(fields[0]))
    ? findMember(viewer, fields[0]) : null
  if (opcode === 'turn') viewer.turn = Number(fields[0])
  if (opcode === 'player' && SEATS.includes(fields[0])) viewer.playerNames[fields[0]] = fields[1]
  if (['switch', 'drag', 'replace'].includes(opcode)) {
    resetSwitchState(viewer, member)
    activate(viewer, member)
    setDetails(member, fields[1])
    if (member) viewer.baseSpecies[member.memberId] = member.species
    setHealth(member, fields[2])
  }
  if (['detailschange', '-formechange'].includes(opcode)) {
    setDetails(member, fields[1])
    setHealth(member, fields[2])
  }
  if (opcode === '-transform' && member) {
    const target = findMember(viewer, fields[1])
    if (target?.species) member.species = target.species
    member.transformedInto = target?.memberId ?? null
    revealAbility(viewer, member, target?.ability ?? null, true)
    if (target) member.stages = clone(target.stages)
  }
  if (opcode === 'move' && member) uniqueAdd(member.moves, fields[1])
  if (['-damage', '-heal', '-sethp'].includes(opcode)) setHealth(member, fields[1])
  if (opcode === '-sethp' && fields[2]) setHealth(findMember(viewer, fields[2]), fields[3])
  if (opcode === 'faint' && member) {
    setHealth(member, '0 fnt')
    member.active = false
    const side = member.memberId.startsWith(`${viewer.seat}:`) ? viewer.own : viewer.opponent
    if (side.active === member.memberId) side.active = null
  }
  if (opcode === '-status' && member) member.condition = fields[1]
  if (opcode === '-curestatus' && member) member.condition = null
  if (opcode === '-cureteam') {
    const seat = /^p[12](?:[a-z]?:|$)/.test(fields[0]) ? fields[0].slice(0, 2) : null
    if (seat) {
      const team = seat === viewer.seat ? viewer.own.team : viewer.opponent.known
      team.forEach(candidate => { candidate.condition = null })
    }
  }
  if (opcode === '-item' && member) member.item = fields[1]
  if (opcode === '-enditem' && member) { member.lastRevealedItem = fields[1]; member.item = null }
  if (opcode === '-ability' && member) {
    const changed = fields.some(field => field.startsWith('[from] '))
    if (changed && fields[2] && !fields[2].startsWith('[') && !viewer.changedAbilities.includes(member.memberId)) {
      viewer.baseAbilities[member.memberId] = fields[2]
    }
    revealAbility(viewer, member, fields[1], changed)
    if (fields.includes('[from] ability: Trace') || fields.includes('[from] move: Role Play')) {
      const copiedFrom = findMember(viewer, fields.find(field => field.startsWith('[of] '))?.slice(5))
      revealAbility(viewer, copiedFrom, fields[1])
    }
  }
  if (opcode === '-endability' && member) revealAbility(viewer, member, null, true)
  if (opcode === '-activate' && member && fields[1]?.startsWith('ability: ')) revealAbility(viewer, member, fields[1].slice(9))
  if (opcode === '-activate' && fields[1] === 'Skill Swap' && member) {
    const target = findMember(viewer, fields.find(field => field.startsWith('[of] '))?.slice(5))
    if (target) {
      const previous = member.ability
      revealAbility(viewer, member, fields[2] || target.ability, true)
      revealAbility(viewer, target, fields[3] || previous, true)
    }
  }
  if (['-boost', '-unboost', '-setboost'].includes(opcode) && member) {
    const amount = Number(fields[2])
    const value = opcode === '-setboost' ? amount : (member.stages[fields[1]] ?? 0) + amount * (opcode === '-unboost' ? -1 : 1)
    member.stages[fields[1]] = Math.max(-6, Math.min(6, value))
  }
  if (opcode === '-clearboost' && member) member.stages = {}
  if (opcode === '-clearallboost') [...viewer.own.team, ...viewer.opponent.known].forEach(candidate => { candidate.stages = {} })
  if (['-invertboost', '-clearpositiveboost', '-clearnegativeboost'].includes(opcode) && member) {
    for (const [stat, value] of Object.entries(member.stages)) {
      if (opcode === '-invertboost') member.stages[stat] = -value
      else if ((opcode === '-clearpositiveboost' && value > 0) || (opcode === '-clearnegativeboost' && value < 0)) member.stages[stat] = 0
    }
  }
  if (['-copyboost', '-swapboost'].includes(opcode) && member) {
    const target = findMember(viewer, fields[1])
    if (target) {
      const stats = fields[2]?.split(', ') ?? [...new Set([...Object.keys(member.stages), ...Object.keys(target.stages)])]
      for (const stat of stats) {
        const previous = member.stages[stat] ?? 0
        member.stages[stat] = target.stages[stat] ?? 0
        if (opcode === '-swapboost') target.stages[stat] = previous
      }
    }
  }
  // Single-turn and single-move effects have no matching end notification.
  // Preserve their full ordered events, not a falsely permanent live condition.
  if (opcode === '-start' && member) uniqueAdd(member.volatiles, fields[1])
  if (opcode === '-end' && member) remove(member.volatiles, fields[1])
  if (opcode === '-weather') viewer.weather = fields[0] === 'none' ? null : fields[0]
  if (opcode === '-fieldstart') uniqueAdd(viewer.fieldConditions, fields[0])
  if (opcode === '-fieldend') remove(viewer.fieldConditions, fields[0])
  if (['-sidestart', '-sideend'].includes(opcode)) {
    const seat = fields[0]?.slice(0, 2)
    if (SEATS.includes(seat)) (opcode === '-sidestart' ? uniqueAdd : remove)(viewer.sideConditions[seat], fields[1])
  }
  if (opcode === '-swapsideconditions') [viewer.sideConditions.p1, viewer.sideConditions.p2] = [viewer.sideConditions.p2, viewer.sideConditions.p1]
  // Abilities/items are often revealed by attribution instead of a dedicated
  // -ability/-item line (for example Intimidate, Drought and Leftovers).
  const from = fields.find(field => /^\[from\] (?:ability|item): /.test(field))
  if (from && opcode !== '-ability') {
    const source = fields.find(field => field.startsWith('[of] '))
    const revealed = source ? findMember(viewer, source.slice(5)) : member
    if (revealed) {
      const [, kind, value] = /^\[from\] (ability|item): (.+)$/.exec(from) ?? []
      if (kind === 'ability') revealAbility(viewer, revealed, value)
      else if (kind === 'item') revealed.item = value
    }
  }
  if (opcode === 'win') {
    const winnerSeat = SEATS.find(seat => viewer.playerNames[seat] === fields[0])
    viewer.result = { kind: 'win', winnerSeat: winnerSeat ?? null }
  }
  if (opcode === 'tie') viewer.result = { kind: 'draw', winnerSeat: null }
}

function consumeLine(viewer, line) {
  if (!line.startsWith('|')) return
  const [, opcode, ...fields] = line.split('|')
  if (IGNORED.has(opcode)) return
  if (!own(CATEGORIES, opcode)) {
    viewer.complete = false
    // Never retain arbitrary unknown fields, even after vendor redaction.
    uniqueAdd(viewer.projectionWarnings, /^[a-z-]{1,40}$/.test(opcode) ? opcode : 'unsupported-protocol')
    return
  }
  applyFacts(viewer, opcode, fields)
  append(viewer, CATEGORIES[opcode], { opcode, fields: fields.map(field => safeField(viewer, field)) })
}

function consumeRequest(viewer, request) {
  if (request?.side && request.side.id !== viewer.seat) throw new Error('Private request seat mismatch')
  viewer.request = clone(request)
  if (request?.side) {
    for (const pokemon of request.side.pokemon ?? []) {
      const member = findMember(viewer, pokemon.ident)
      if (!member) throw new Error('Missing private request member identity')
      if (pokemon.baseAbility !== undefined && !own(viewer.baseAbilities, member.memberId)) {
        viewer.baseAbilities[member.memberId] = pokemon.baseAbility
        if (!viewer.changedAbilities.includes(member.memberId)) member.ability = pokemon.baseAbility
      }
      // Gen 3 request.details and baseAbility describe the original set, even
      // while Transform/form changes/Skill Swap are active. Status and HP are
      // authoritative; observed current appearance and ability must survive.
      if (!pokemon.active) resetSwitchState(viewer, member)
      if (!pokemon.active || !member.active || !member.species) setDetails(member, pokemon.details)
      setHealth(member, pokemon.condition)
      member.active = Boolean(pokemon.active)
      member.moves = [...(pokemon.moves ?? [])]
      member.item = pokemon.item ?? null
      if (pokemon.ability !== undefined) member.ability = pokemon.ability
      member.stats = clone(pokemon.stats ?? {})
      if (member.active) viewer.own.active = member.memberId
    }
    if (!viewer.own.team.some(member => member.active)) viewer.own.active = null
  }
  const active = viewer.own.team.find(member => member.memberId === viewer.own.active)
  if (active && request?.active?.[0]) {
    active.moveOptions = (request.active[0].moves ?? []).map(move => ({
      id: move.id, name: move.move, pp: move.pp, maxpp: move.maxpp,
      target: move.target, disabled: Boolean(move.disabled),
    }))
    active.trapped = Boolean(request.active[0].trapped)
  }
  append(viewer, 'request', {
    wait: Boolean(request?.wait), forceSwitch: Boolean(request?.forceSwitch?.some(Boolean)),
  })
}

/** A persisted reference ledger of filtered protocol facts, not a complete UI reducer. */
export function createProjection({ matchId, teams = {}, state } = {}) {
  let ledger
  if (state) {
    if (state.schemaVersion !== 1 || !state.viewers?.p1 || !state.viewers?.p2) throw new TypeError('Unsupported projection checkpoint')
    if (matchId !== undefined && state.matchId !== matchId) throw new TypeError('Projection match identity mismatch')
    ledger = clone(state)
  } else {
    if (typeof matchId !== 'string' || !matchId) throw new TypeError('A match ID is required')
    ledger = { schemaVersion: 1, matchId, viewers: Object.fromEntries(SEATS.map((seat, index) => [
      seat, freshViewer(seat, teams[seat] ?? (Array.isArray(teams) ? teams[index] : []) ?? []),
    ])) }
  }

  return Object.freeze({
    consume(type, data) {
      if (type === 'end') return
      if (type === 'result') {
        if (!data || !['win', 'draw', 'no-contest'].includes(data.kind)) throw new TypeError('Invalid project result')
        if (data.kind === 'win' && !SEATS.includes(data.winnerSeat)) throw new TypeError('Invalid winning seat')
        const result = { kind: data.kind, winnerSeat: data.kind === 'win' ? data.winnerSeat : null }
        if (typeof data.reason === 'string' && /^[a-z0-9-]{1,80}$/.test(data.reason)) result.reason = data.reason
        for (const viewer of Object.values(ledger.viewers)) {
          if (JSON.stringify(viewer.result) === JSON.stringify(result)) continue
          viewer.result = clone(result)
          append(viewer, 'result', clone(result))
        }
        return
      }
      const message = Array.isArray(data) ? data.join('\n') : data
      if (typeof message !== 'string') throw new TypeError('Battle protocol message must be text')
      if (type === 'update') {
        const channels = getVendor().extractChannelMessages(message, [1, 2])
        SEATS.forEach((seat, index) => channels[index + 1].forEach(line => consumeLine(ledger.viewers[seat], line)))
      } else if (type === 'sideupdate') {
        const newline = message.indexOf('\n')
        const seat = message.slice(0, newline)
        assertSeat(seat)
        const viewer = ledger.viewers[seat]
        for (const line of message.slice(newline + 1).split('\n')) {
          if (line.startsWith('|request|')) consumeRequest(viewer, JSON.parse(line.slice(9)))
          // Private choice errors are reported by the engine's structured decision
          // result. Never forward vendor prose containing internal team tokens.
          else consumeLine(viewer, line)
        }
      }
    },
    getView(seat) {
      assertSeat(seat)
      const { request, events, identities, playerNames, baseAbilities, baseSpecies, changedAbilities, ...view } = ledger.viewers[seat]
      return detached({ matchId: ledger.matchId, projection: 'protocol-reference-v1', ...view })
    },
    getEvents(seat, afterCursor = 0) {
      assertSeat(seat)
      if (!Number.isSafeInteger(afterCursor) || afterCursor < 0) throw new TypeError('Invalid viewer cursor')
      return detached(ledger.viewers[seat].events.filter(event => event.cursor > afterCursor))
    },
    // Internal adapter API only. This contains the owning seat's private request;
    // callers must build project-owned legal choices instead of publishing it.
    getRequest(seat) { assertSeat(seat); return detached(ledger.viewers[seat].request) },
    // This envelope contains both players' secrets. It is private persistence.
    exportState() { return clone(ledger) },
  })
}
