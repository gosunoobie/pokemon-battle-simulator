// Cosmetic requests derived only from published protocol facts. No condition
// eligibility, residual damage, stat multipliers or turn counters live here.
const fieldsOf = event => event.args?.fields ?? []
const statusKinds = { psn: 'poison', tox: 'poison', brn: 'burn', slp: 'sleep', par: 'paralysis', frz: 'freeze' }
const attributed = event => fieldsOf(event).find(field => field.startsWith('[from] '))?.slice(7).replace(/^move: /, '')

export function conditionReactions(group, view) {
  const requests = [], seen = new Set()
  const add = (event, memberId, kind) => {
    const actorId = memberId === view?.own?.active ? 'source' : memberId === view?.opponent?.active ? 'target' : null
    if (!kind || !actorId || seen.has(`${actorId}:${kind}`)) return
    seen.add(`${actorId}:${kind}`)
    requests.push({ kind, actorId, visualSeed: event.cursor })
  }
  for (const event of group) {
    const [memberId, value, amount] = fieldsOf(event), opcode = event.args?.opcode
    if (opcode === '-status') add(event, memberId, statusKinds[value])
    if (opcode === '-curestatus') add(event, memberId, 'cure')
    if (opcode === '-cureteam') {
      const seat = memberId?.slice(0, 2)
      const side = seat === view?.seat ? view?.own : view?.opponent
      const member = (side?.team ?? side?.known ?? []).find(member => member.memberId === side.active)
      if (member?.condition) add(event, member.memberId, 'cure')
    }
    if (['-boost', '-unboost'].includes(opcode) && Number(amount) > 0) add(event, memberId, opcode === '-boost' ? 'boost' : 'unboost')
    if (opcode === '-setboost' && Number.isFinite(Number(amount))) add(event, memberId, Number(amount) < 0 ? 'unboost' : 'boost')
    if (opcode === '-start' && value?.replace(/^move: /, '') === 'confusion') add(event, memberId, 'confusion')
    if (opcode === '-end' && value?.replace(/^move: /, '') === 'confusion') add(event, memberId, 'cure')
    if (opcode === 'cant') add(event, memberId, statusKinds[value])
    if (opcode === '-activate') {
      const activation = value?.replace(/^move: /, '')
      if (activation === 'confusion') add(event, memberId, 'confusion')
      if (['Protect', 'Detect', 'Safeguard', 'Substitute', 'Mist'].includes(activation)) add(event, memberId, 'blocked')
    }
    if (opcode === '-damage') {
      const cause = attributed(event)
      add(event, memberId, ({ psn: 'poison', tox: 'poison', brn: 'burn', Spikes: 'spikes', 'Leech Seed': 'leech-seed' })[cause])
    }
    if (opcode === '-heal') {
      const cause = attributed(event)
      if (cause === 'Leech Seed') add(event, memberId, 'leech-seed')
      else if (['Ingrain', 'Wish'].includes(cause)) add(event, memberId, 'cure')
    }
  }
  return requests
}

export function isConditionResidual(event) {
  const opcode = event.args?.opcode
  const value = fieldsOf(event)[1]
  // Delayed effects must not become part of the preceding move's impact.
  // Gen 3 reports Yawn's expiry before an unattributed sleep fact, and Shed
  // Skin's activation before an unattributed cure. Their explicit public
  // introductions establish the boundary without guessing from hidden state.
  return (opcode === '-end' && value?.replace(/^move: /, '') === 'Yawn') ||
    (opcode === '-activate' && value === 'ability: Shed Skin') ||
    (opcode === '-status' && attributed(event) === 'Yawn') ||
    (['-damage', '-heal'].includes(opcode) && ['psn', 'tox', 'brn', 'Spikes', 'Leech Seed', 'Ingrain', 'Wish'].includes(attributed(event)))
}
