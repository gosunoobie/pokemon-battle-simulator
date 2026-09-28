// Classify only published protocol facts. This module does not decide whether a
// move hits, inspect abilities/types, or reconstruct the simulator's rules.
const opcodeOf = event => event?.args?.opcode
const fieldsOf = event => Array.isArray(event?.args?.fields) ? event.args.fields : []
const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const failures = new Set(['-fail', '-block', '-notarget', '-miss', '-immune'])
const changes = new Set(['-setboost', '-clearboost', '-clearallboost', '-clearpositiveboost', '-clearnegativeboost',
  '-invertboost', '-copyboost', '-swapboost', '-status', '-curestatus', '-cureteam', '-start', '-end',
  '-sidestart', '-sideend', '-fieldstart', '-fieldend', '-weather', '-item', '-enditem', '-ability', '-endability',
  '-transform', '-sethp'])

function protection(event) {
  if (opcodeOf(event) !== '-activate') return false
  const fields = fieldsOf(event), effect = normalize(fields[1]?.replace(/^move:\s*/i, ''))
  return ['protect', 'detect', 'safeguard', 'mist'].includes(effect) || fields.includes('[block]')
}

function attributableToMove(event, moveName) {
  const from = fieldsOf(event).find(field => typeof field === 'string' && /^\[from\]/.test(field.trim()))
  if (!from) return true
  // An ability/item response (for example an absorption heal) does not prove
  // that the move's own effect succeeded. Explicit move attribution may.
  return normalize(from.replace(/^\[from\]\s*move:\s*/i, '')) === normalize(moveName)
}

export function classifyMoveOutcome(group) {
  if (!Array.isArray(group) || opcodeOf(group[0]) !== 'move') {
    return { failed: false, partial: false, succeeded: false, landedDamage: false, blocked: false, failureEvents: [] }
  }
  const [sourceId, moveName] = fieldsOf(group[0])
  const facts = group.slice(1)
  const failureEvents = facts.filter(event => failures.has(opcodeOf(event)) || protection(event))
  const landedDamage = facts.some(event => opcodeOf(event) === '-damage' && fieldsOf(event)[0] !== sourceId &&
    !fieldsOf(event).some(field => typeof field === 'string' && /^\[from\]/.test(field.trim())))
  const succeeded = landedDamage || facts.some(event => {
    const opcode = opcodeOf(event), fields = fieldsOf(event)
    if (!attributableToMove(event, moveName)) return false
    if (opcode === '-boost' || opcode === '-unboost') return Number(fields[2]) > 0
    if (opcode === '-hitcount') return Number(fields[1]) > 0
    if (opcode === '-activate') return fields.includes('[damage]')
    if (opcode === '-heal') return true
    return changes.has(opcode)
  })
  return { failed: failureEvents.length > 0 && !succeeded, partial: failureEvents.length > 0 && succeeded,
    succeeded, landedDamage, blocked: failureEvents.some(event => opcodeOf(event) === '-block' || protection(event)), failureEvents }
}

/** Cosmetic actor routing and explicit variants derived from public facts. */
export function cosmeticMoveRequest(group, effect, seat = 'p1') {
  const [memberId, , targetMemberId] = fieldsOf(group?.[0])
  const actor = id => id?.startsWith(`${seat}:`) ? 'source' : 'target'
  const sourceId = actor(memberId)
  const targetIds = targetMemberId && targetMemberId !== '[notarget]' ? [actor(targetMemberId)] : []
  if (effect?.id === 'curse' && !classifyMoveOutcome(group).failed && group.some(event =>
    ['-boost', '-unboost'].includes(opcodeOf(event)) && fieldsOf(event)[0] === memberId &&
    ['atk', 'def', 'spe'].includes(fieldsOf(event)[1]) && Number(fieldsOf(event)[2]) > 0)) {
    return { sourceId, targetIds: [], variant: 'self-setup' }
  }
  if (effect?.id === 'mirror-move' && (!targetIds.length || targetMemberId === memberId) && !classifyMoveOutcome(group).failed) {
    return { sourceId, targetIds: [], variant: 'source-cast' }
  }
  return { sourceId, targetIds }
}
