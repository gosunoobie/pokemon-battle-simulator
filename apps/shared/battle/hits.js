import { MULTI_HIT_LIMITS } from '@battle/battle-fx/multi-hit'

const opcode = event => event?.args?.opcode
const fields = event => event?.args?.fields ?? []
const beforeHit = new Set(['-crit', '-supereffective', '-resisted'])
const beatUp = event => opcode(event) === '-activate' && fields(event)[1] === 'move: Beat Up'

// These are published contact facts, not damage calculations. A Substitute hit
// and a hit that rounds to the same public HP value are still real contacts.
function contact(event, targetId) {
  const values = fields(event)
  if (values[0] !== targetId) return false
  if (opcode(event) === '-damage') return !values.some(value => typeof value === 'string' && /^\[from\]/.test(value))
  return values[1] === 'Substitute' && (opcode(event) === '-end' ||
    (opcode(event) === '-activate' && values.includes('[damage]')))
}

/** Partition one move's viewer-safe facts for cosmetic contact reveals.
 * Counts come from the protocol, including early stops. Never divide aggregate
 * damage, infer hidden HP, or invent missing per-hit effects.
 */
export function deriveHitSequence(group, moveId) {
  if (!Object.hasOwn(MULTI_HIT_LIMITS, moveId) || opcode(group?.[0]) !== 'move') return null
  const targetId = fields(group[0])[2]
  if (!targetId || targetId === '[notarget]' || group.some(event => opcode(event) === '-prepare')) return null
  const contacts = []
  for (let index = 1; index < group.length; index++) if (contact(group[index], targetId)) contacts.push(index)
  const counts = group.filter(event => opcode(event) === '-hitcount' && fields(event)[0] === targetId)
  const count = counts.length === 1 ? Number(fields(counts[0])[1]) : contacts.length
  if (counts.length > 1 || !Number.isSafeInteger(count) || count < 1 || count > MULTI_HIT_LIMITS[moveId]) return null
  // A valid reported count can still drive artwork when an unfamiliar protocol
  // shape prevents trustworthy intermediate snapshots. Reveal the whole result
  // at final impact in that case rather than guessing where facts belong.
  if (contacts.length !== count) return { count, steps: null }
  const starts = contacts.map((position, index) => {
    if (!index) return 0
    let start = position
    while (start > contacts[index - 1] + 1 &&
      (beforeHit.has(opcode(group[start - 1])) || beatUp(group[start - 1]))) start--
    return start
  })
  return { count, steps: starts.map((start, index) => group.slice(start, starts[index + 1] ?? group.length)) }
}
