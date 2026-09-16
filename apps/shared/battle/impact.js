// Presentation of already-published server facts only. No type chart, damage
// formula, hidden HP, battle state updates or renderer dependencies belong here.
const effectiveness = new Map([
  ['-supereffective', { kind: 'super-effective', label: 'Super effective!' }],
  ['-resisted', { kind: 'resisted', label: 'Not very effective…' }],
  ['-immune', { kind: 'immune', label: 'No effect' }],
])
const healthOpcodes = new Set(['-damage', '-heal', '-sethp'])
const fieldsOf = event => Array.isArray(event?.args?.fields) ? event.args.fields : []

function knownHealth(hp) {
  return hp && Number.isSafeInteger(hp.current) && Number.isSafeInteger(hp.max) &&
    hp.max > 0 && hp.current >= 0 && hp.current <= hp.max
    ? { current: hp.current, max: hp.max } : null
}

function readHealth(value, previous) {
  if (typeof value !== 'string') return null
  // Health may carry the public bar's colour suffix and a condition. A zero
  // faint fact omits its maximum, so retain only an already-displayed maximum.
  const match = /^(\d+)(?:\/(\d+))?[gry]?(?:\s+(?:brn|par|slp|psn|tox|frz|fnt))?$/.exec(value.trim())
  if (!match) return null
  const current = Number(match[1])
  if (!match[2] && current !== 0) return null
  return knownHealth({ current, max: match[2] ? Number(match[2]) : previous?.max })
}

export function deriveMoveImpact(group, before) {
  if (!Array.isArray(group) || group[0]?.args?.opcode !== 'move' ||
      typeof before?.matchId !== 'string' || !before.matchId ||
      !Number.isSafeInteger(group[0].cursor) || group[0].cursor < 0) return null
  const [sourceId, moveName, memberId] = fieldsOf(group[0])
  if (![sourceId, moveName, memberId].every(value => typeof value === 'string' && value.length > 0) ||
      group.some(event => event?.args?.opcode === '-prepare') ||
      group.slice(1).some(event => event?.args?.opcode === 'move')) return null

  const own = before.own?.active === memberId
  const opponent = before.opponent?.active === memberId
  if (own === opponent) return null
  const team = own ? before.own?.team : before.opponent?.known
  const member = Array.isArray(team) ? team.find(candidate => candidate?.memberId === memberId) : null
  if (!member) return null
  const actorId = own ? 'source' : 'target'
  let selected = null, immunity = false, directDamageSeen = false
  let hp = knownHealth(member.hp), totalHp = 0, totalPercent = 0, incompleteDamage = false

  for (const event of group.slice(1)) {
    const opcode = event?.args?.opcode
    const fields = fieldsOf(event)
    if (fields[0] === memberId && effectiveness.has(opcode)) {
      if (opcode === '-immune') immunity = true
      else selected = effectiveness.get(opcode)
    }
    if (!healthOpcodes.has(opcode)) continue
    // Pain Split can report this member in the second pair. It changes the
    // displayed baseline but is never itself a direct move-damage message.
    const pairs = opcode === '-sethp' ? [[fields[0], fields[1]], [fields[2], fields[3]]] : [[fields[0], fields[1]]]
    for (const [id, health] of pairs) {
      if (id !== memberId) continue
      const next = readHealth(health, hp)
      const direct = opcode === '-damage' && !fields.some(field => typeof field === 'string' && /^\[from\]/.test(field.trim()))
      if (direct) {
        directDamageSeen = true
        if (!hp || !next || hp.max !== next.max || next.current > hp.current) incompleteDamage = true
        else {
          const loss = hp.current - next.current
          totalHp += loss
          totalPercent += loss / hp.max * 100
        }
      }
      // Even an attributed loss or a heal must update the next hit's baseline.
      // A malformed value invalidates it instead of reusing stale known HP.
      hp = next
    }
  }

  // Some damaging moves subsequently fail to apply a secondary effect. A later
  // immunity message must not call the entire damaging move ineffective.
  if (!selected && immunity && !directDamageSeen) selected = effectiveness.get('-immune')
  if (!selected) return null
  let damageText = null
  if (selected.kind !== 'immune' && !incompleteDamage && totalHp > 0) {
    if (member.hpPrecision === 'exact' && own) damageText = `−${totalHp} HP`
    else if (member.hpPrecision === 'public') {
      const percent = Math.round(totalPercent)
      if (percent > 0) damageText = `≈ −${percent}% HP`
    }
  }
  return {
    key: `${before.matchId}:${group[0].cursor}:impact`,
    ...selected, actorId, memberId, damageText,
  }
}
