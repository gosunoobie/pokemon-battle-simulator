import { FX_CATALOG } from '@battle/battle-fx/catalog'
import { deriveMoveImpact } from './impact.js'

// This is a display ledger of server facts, not a rules engine. Neither the
// intermediate snapshots nor an animation cue can change a submitted decision.
const clone = value => value == null ? value : structuredClone(value)
const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const effects = new Map(FX_CATALOG.flatMap(effect => [[normalize(effect.name), effect], [normalize(effect.id), effect]]))
effects.set('visegrip', effects.get('vicegrip'))
const structural = new Set(['switch', 'drag', 'replace', 'swap', 'detailschange', '-formechange', '-transform', 'faint'])
const boundaries = new Set([...structural, 'move', 'cant', 'turn', 'upkeep', 'win', 'tie'])
const failures = new Set(['-fail', '-block', '-notarget', '-miss', '-immune'])
const statNames = { atk: 'Attack', def: 'Defense', spa: 'Special Attack', spd: 'Special Defense', spe: 'Speed', accuracy: 'accuracy', evasion: 'evasion' }
const conditions = { brn: 'burned', par: 'paralyzed', slp: 'asleep', psn: 'poisoned', tox: 'badly poisoned', frz: 'frozen' }
const weatherNames = { RainDance: 'Rain', SunnyDay: 'Harsh sunlight', Sandstorm: 'A sandstorm', Hail: 'Hail' }
const members = view => [...(view?.own?.team ?? []), ...(view?.opponent?.known ?? [])]
const memberFor = (view, id) => members(view).find(member => member.memberId === id)
// The server already decided the knockout. These IDs only retain the outgoing
// artwork long enough to present it, including a faint that clears active first.
function newlyFaintedActors(before, after) {
  return [['source', before?.own?.active], ['target', before?.opponent?.active]]
    .filter(([, id]) => id && !memberFor(before, id)?.fainted && memberFor(after, id)?.fainted)
    .map(([actorId]) => actorId)
}
const opcodeOf = event => event.args?.opcode
const fieldsOf = event => event.args?.fields ?? []
const append = (list, value) => { if (value && !list.includes(value)) list.push(value) }
const remove = (list, value) => { const index = list.indexOf(value); if (index >= 0) list.splice(index, 1) }

function eventList(events, before) {
  const seen = new Set()
  return (events ?? []).filter(event => {
    if (!Number.isSafeInteger(event.cursor) || event.cursor <= (before?.cursor ?? 0) || seen.has(event.cursor)) return false
    seen.add(event.cursor)
    return true
  })
}

function setHealth(member, health) {
  if (!member || typeof health !== 'string') return
  const [amount, status] = health.trim().split(/\s+/)
  const match = /^(\d+)(?:\/(\d+))?([gry])?$/.exec(amount)
  if (!match) return
  const current = Number(match[1])
  member.hp = { current, max: match[2] ? Number(match[2]) : member.hp?.max ?? null }
  member.fainted = current === 0 || status === 'fnt'
  member.condition = status && status !== 'fnt' ? status : null
  if (match[3]) member.hpColor = { g: 'green', y: 'yellow', r: 'red' }[match[3]]
  else delete member.hpColor
}

function setSpecies(member, details) {
  if (!member || !details) return
  member.species = details.split(',')[0]
  if (member.hpPrecision === 'public' || !member.name) member.name = member.species
}

function blankMember(id, ownSeat) {
  return { memberId: id, name: null, species: null, active: false, hp: null,
    hpPrecision: id.startsWith(`${ownSeat}:`) ? 'exact' : 'public', condition: null,
    fainted: false, moves: [], item: null, ability: null, stats: {}, stages: {}, volatiles: [] }
}

function applyFact(view, event) {
  const opcode = opcodeOf(event)
  const fields = fieldsOf(event)
  let member = memberFor(view, fields[0])
  view.cursor = event.cursor
  if (!opcode) {
    if (event.type === 'result' && event.args?.kind) view.result = clone(event.args)
    return
  }
  if (['switch', 'drag', 'replace'].includes(opcode)) {
    const ownSide = fields[0]?.startsWith(`${view.seat}:`)
    const side = ownSide ? view.own : view.opponent
    const team = ownSide ? side.team : side.known
    if (!member) { member = blankMember(fields[0], view.seat); team.push(member) }
    for (const candidate of team) {
      if (candidate.active) { candidate.stages = {}; candidate.volatiles = [] }
      candidate.active = candidate === member
    }
    member.stages = {}; member.volatiles = []
    side.active = member.memberId
    setSpecies(member, fields[1]); setHealth(member, fields[2])
  }
  if (['detailschange', '-formechange'].includes(opcode)) { setSpecies(member, fields[1]); setHealth(member, fields[2]) }
  if (opcode === '-transform' && member) {
    const target = memberFor(view, fields[1])
    if (target) { setSpecies(member, target.species); member.transformedInto = target.memberId; member.stages = clone(target.stages); member.ability = target.ability }
  }
  if (opcode === 'move' && member) append(member.moves, fields[1])
  if (['-damage', '-heal', '-sethp'].includes(opcode)) setHealth(member, fields[1])
  if (opcode === '-sethp' && fields[2]) setHealth(memberFor(view, fields[2]), fields[3])
  if (opcode === 'faint' && member) {
    setHealth(member, '0 fnt'); member.active = false
    const side = member.memberId.startsWith(`${view.seat}:`) ? view.own : view.opponent
    if (side.active === member.memberId) side.active = null
  }
  if (opcode === '-status' && member) member.condition = fields[1]
  if (opcode === '-curestatus' && member) member.condition = null
  if (opcode === '-cureteam') {
    const side = fields[0]?.slice(0, 2) === view.seat ? view.own.team : view.opponent.known
    side.forEach(candidate => { candidate.condition = null })
  }
  if (opcode === '-item' && member) member.item = fields[1]
  if (opcode === '-enditem' && member) member.item = null
  if (opcode === '-ability' && member) member.ability = fields[1]
  if (opcode === '-endability' && member) member.ability = null
  if (['-boost', '-unboost', '-setboost'].includes(opcode) && member) {
    // The protocol supplies the amount actually changed; no eligibility rolls.
    const amount = Number(fields[2])
    if (Number.isFinite(amount)) member.stages[fields[1]] = opcode === '-setboost' ? amount : (member.stages[fields[1]] ?? 0) + amount * (opcode === '-unboost' ? -1 : 1)
  }
  if (opcode === '-clearboost' && member) member.stages = {}
  if (opcode === '-clearallboost') members(view).forEach(candidate => { candidate.stages = {} })
  if (['-invertboost', '-clearpositiveboost', '-clearnegativeboost'].includes(opcode) && member) {
    for (const [stat, value] of Object.entries(member.stages)) {
      if (opcode === '-invertboost') member.stages[stat] = -value
      else if ((opcode === '-clearpositiveboost' && value > 0) || (opcode === '-clearnegativeboost' && value < 0)) member.stages[stat] = 0
    }
  }
  if (['-copyboost', '-swapboost'].includes(opcode) && member) {
    const target = memberFor(view, fields[1])
    if (target) for (const stat of fields[2]?.split(', ') ?? [...new Set([...Object.keys(member.stages), ...Object.keys(target.stages)])]) {
      const previous = member.stages[stat] ?? 0
      member.stages[stat] = target.stages[stat] ?? 0
      if (opcode === '-swapboost') target.stages[stat] = previous
    }
  }
  if (opcode === '-start' && member) append(member.volatiles, fields[1])
  if (opcode === '-end' && member) remove(member.volatiles, fields[1])
  if (opcode === '-weather') view.weather = fields[0] === 'none' ? null : fields[0]
  if (opcode === '-fieldstart') append(view.fieldConditions, fields[0])
  if (opcode === '-fieldend') remove(view.fieldConditions, fields[0])
  if (['-sidestart', '-sideend'].includes(opcode)) {
    const side = view.sideConditions[fields[0]?.slice(0, 2)]
    if (side) (opcode === '-sidestart' ? append : remove)(side, fields[1])
  }
  if (opcode === '-swapsideconditions') [view.sideConditions.p1, view.sideConditions.p2] = [view.sideConditions.p2, view.sideConditions.p1]
  if (opcode === 'turn') view.turn = Number(fields[0])
}

function actorName(id, view, fallback) {
  const member = memberFor(view, id) ?? memberFor(fallback, id)
  if (!member) return id?.startsWith(`${view?.seat ?? 'p1'}:`) ? 'Your Pokémon' : 'The opposing Pokémon'
  const name = member.name || member.species || 'Pokémon'
  return id?.startsWith(`${view?.seat ?? 'p1'}:`) ? name : `The opposing ${name}`
}

export function describeEvent(event, view, fallback = view) {
  const [actor, value, amount] = fieldsOf(event)
  const name = actorName(actor, view, fallback)
  switch (opcodeOf(event)) {
    case 'move': return `${name} used ${value}!`
    case 'switch': case 'drag': case 'replace': return `${actor?.startsWith(`${view?.seat ?? 'p1'}:`) ? 'Go, ' : 'The opponent sent out '}${value?.split(',')[0] ?? 'a Pokémon'}!`
    case 'faint': return `${name} fainted.`
    case 'cant': return `${name} could not move${conditions[value] ? ` (${conditions[value]})` : value === 'recharge' ? ' (recharging)' : ''}.`
    case '-damage': return `${name} lost HP.`
    case '-heal': return `${name} recovered HP.`
    case '-status': return `${name} is ${conditions[value] ?? 'affected by a status condition'}.`
    case '-curestatus': return `${name} recovered from its status condition.`
    case '-cureteam': return 'The team recovered from its status conditions.'
    case '-boost': return `${name}’s ${statNames[value] ?? 'stat'} rose${Number(amount) > 1 ? ' sharply' : ''}.`
    case '-unboost': return `${name}’s ${statNames[value] ?? 'stat'} fell${Number(amount) > 1 ? ' sharply' : ''}.`
    case '-clearboost': return `${name}’s stat changes were removed.`
    case '-miss': return 'The attack missed!'
    case '-fail': case '-block': case '-notarget': return 'The move did not succeed.'
    case '-immune': return `${name} was unaffected.`
    case '-crit': return 'A critical hit!'
    case '-supereffective': return 'It’s super effective!'
    case '-resisted': return 'It’s not very effective.'
    case '-hitcount': return `Hit ${value} times!`
    case '-prepare': return `${name} is preparing ${value}.`
    case '-mustrecharge': return `${name} must recharge.`
    case '-weather': return actor === 'none' ? 'The weather returned to normal.' : `${weatherNames[actor] ?? 'The weather effect'} ${fieldsOf(event).includes('[upkeep]') ? 'continues' : 'began'}.`
    case '-item': return `${name} obtained ${value}.`
    case '-enditem': return `${name}’s ${value} was used or removed.`
    case '-ability': return `${name}’s ability is ${value}.`
    case '-start': return `${name} is affected by ${value?.replace(/^move: /, '')}.`
    case '-end': return `${name}’s ${value?.replace(/^move: /, '')} ended.`
    case 'detailschange': case '-formechange': return `${name} changed form.`
    case '-transform': return `${name} transformed!`
    case 'turn': return `Turn ${actor}`
    case 'win': case 'tie': return fallback?.result?.kind === 'win' ? (fallback.result.winnerSeat === (view?.seat ?? 'p1') ? 'You won the battle!' : 'The opponent won the battle.') : 'The battle ended in a draw.'
    default: return event.type === 'result' && event.args?.kind === 'no-contest' ? 'The battle ended without a result.' : null
  }
}

/** Friendly, plain-text messages; caller renders text, never simulator HTML. */
export function buildBattleLog(events, before, after) {
  const view = clone(before ?? after)
  if (!view) return []
  const log = []
  for (const event of eventList(events, before)) {
    applyFact(view, event)
    const text = describeEvent(event, view, after)
    if (text) log.push({ cursor: event.cursor, text })
  }
  return log
}

function isBoundary(event) {
  const opcode = opcodeOf(event)
  if (boundaries.has(opcode) || (!opcode && ['request', 'result'].includes(event.type))) return true
  if (opcode === '-weather' && fieldsOf(event).includes('[upkeep]')) return true
  // Residual damage/healing happens after an attack, not at its visual contact.
  return ['-damage', '-heal'].includes(opcode) && fieldsOf(event).some(field => /^\[from\] (?:psn|brn|Sandstorm|Hail|Leech Seed|Curse|item: Leftovers|item: Black Sludge|move: (?:Bind|Clamp|Fire Spin|Sand Tomb|Whirlpool|Wrap|Wish))$/.test(field))
}

function groupsFor(events) {
  const groups = []
  for (let index = 0; index < events.length;) {
    const event = events[index++]
    const group = [event]
    if (opcodeOf(event) === 'move') while (index < events.length && !isBoundary(events[index])) group.push(events[index++])
    groups.push(group)
  }
  return groups
}

/** Optional FX for a batch already committed by the authoritative server. */
export function createSimulationPresenter({ getScene, ensureScene = async () => {}, onDisplay,
  onMessage = () => {}, onEntry = () => {}, onEntryCancel = () => {}, faintScene = async () => {}, playImpact = () => null, loadFx, timeoutMs = 7500 }) {
  if (![getScene, ensureScene, onDisplay, onMessage, onEntry, onEntryCancel, faintScene, playImpact, loadFx].every(value => typeof value === 'function')) throw new TypeError('Presenter callbacks are required')
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError('A positive presentation timeout is required')
  let generation = 0, active = null, destroyed = false, fxPromise = null
  const safe = (callback, ...args) => { try { callback(...args) } catch {} }
  const disposeFx = pending => pending?.then(fx => { try { fx?.dispose?.() } catch {} }).catch(() => {})

  async function present({ before, after, events = [] }, { effectsEnabled = true, reducedMotion = false } = {}) {
    if (destroyed) return { status: 'cancelled' }
    if (!after) throw new TypeError('An authoritative after view is required')
    active?.stop('cancelled')
    const token = ++generation
    const controller = new AbortController()
    let playback = null, impactPlayback = null, impactFinished = null, playbackCancelled = false, stopResolve, stoppedStatus = null, finalSceneReady = false, sceneFailed = false
    const stopped = new Promise(resolve => { stopResolve = resolve })
    const cancelPlayback = () => {
      if (!playback || playbackCancelled) return
      playbackCancelled = true
      try { playback.cancel?.() } catch {}
    }
    const clearImpact = () => {
      const previous = impactPlayback
      impactPlayback = null; impactFinished = null
      try { previous?.cancel?.() } catch {}
    }
    const current = { stop(status) {
      if (stoppedStatus) return
      stoppedStatus = status
      controller.abort()
      safe(onEntryCancel)
      cancelPlayback()
      clearImpact()
      stopResolve({ stopped: status })
    } }
    active = current
    const valid = () => !destroyed && generation === token && active === current
    const publish = (view, options) => { if (valid()) safe(onDisplay, view, options) }
    const message = text => { if (valid() && text) safe(onMessage, text) }
    const entry = (view, actorId) => {
      const side = actorId === 'source' ? view?.own : actorId === 'target' ? view?.opponent : null
      const member = memberFor(view, side?.active)
      if (valid() && !stoppedStatus && member && !member.fainted && member.hp?.current !== 0) safe(onEntry, view, actorId)
    }
    const bounded = async (work, cancellable = true) => {
      let timer
      const deadline = new Promise(resolve => { timer = setTimeout(() => resolve({ stopped: 'failed' }), timeoutMs) })
      try {
        const result = await Promise.race([Promise.resolve().then(work).then(value => ({ value })), deadline, ...(cancellable ? [stopped] : [])])
        if (result.stopped) { if (result.stopped === 'failed') current.stop('failed'); throw Object.assign(new Error('Presentation stopped'), { presentationStatus: result.stopped }) }
        return result.value
      } finally { clearTimeout(timer) }
    }
    const prepareScene = async (view, cancellable = true, entryActorIds = []) => {
      const revealed = new Set()
      try { await bounded(() => valid() ? ensureScene(view, {
        entryActorIds, reducedMotion, signal: cancellable ? controller.signal : undefined,
        onEntryReveal(actorId) {
          if (!entryActorIds.includes(actorId) || revealed.has(actorId) || controller.signal.aborted) return
          revealed.add(actorId); entry(view, actorId)
        },
      }) : undefined, cancellable) }
      catch (error) {
        if (!['skipped', 'cancelled'].includes(error.presentationStatus)) sceneFailed = true
        throw error
      }
    }
    let status = effectsEnabled ? 'completed' : 'skipped'
    try {
      if (!effectsEnabled || !before) {
        publish(after)
        const entries = effectsEnabled && !before ? ['source', 'target'] : []
        if (entries.length) message('The trainers are sending out their Pokémon!')
        await prepareScene(after, true, entries)
        if (!effectsEnabled) {
          // Instant presentation reveals only the final visible lineup. A form
          // correction or reconnect snapshot is not a new send-out.
          for (const actorId of ['source', 'target']) {
            const side = actorId === 'source' ? after.own : after.opponent
            const previous = actorId === 'source' ? before?.own : before?.opponent
            const switched = side?.active !== previous?.active && eventList(events, before).some(event =>
              ['switch', 'drag'].includes(opcodeOf(event)) && fieldsOf(event)[0] === side?.active)
            if (!before || switched) entry(after, actorId)
          }
        }
        finalSceneReady = true
      } else {
        let displayed = clone(before)
        for (const group of groupsFor(eventList(events, before))) {
          if (!valid() || stoppedStatus) break
          const first = group[0]
          const next = clone(displayed)
          for (const event of group) applyFact(next, event)
          const faintActorIds = newlyFaintedActors(displayed, next)
          const effect = opcodeOf(first) === 'move' ? effects.get(normalize(fieldsOf(first)[1])) : null
          const prepare = group.some(event => opcodeOf(event) === '-prepare')
          // A later kick can miss after an earlier hit. Only skip successful-hit
          // art when no opposing HP loss was reported for this move.
          const landedDamage = group.some(event => opcodeOf(event) === '-damage' && fieldsOf(event)[0] !== fieldsOf(first)[0])
          const failed = !landedDamage && group.some(event => failures.has(opcodeOf(event)))
          const impact = deriveMoveImpact(group, displayed)
          message(describeEvent(first, displayed, after))
          let revealed = false
          const reveal = () => { if (!revealed && valid() && !stoppedStatus) {
            revealed = true
            publish(next, { retainFaintedActorIds: faintActorIds })
            if (impact) {
              // Only server-reported effectiveness and visible HP deltas enter
              // this host overlay. Attack recipes still receive no battle data.
              try {
                impactPlayback = playImpact(impact, { reducedMotion, signal: controller.signal })
                // Attach rejection handling immediately: a label can finish
                // while the move is still recovering from its contact pose.
                impactFinished = Promise.resolve(impactPlayback?.finished).catch(() => { clearImpact() })
              } catch { clearImpact() }
            }
          } }
          if (effect && !failed && (!prepare || effect.phases?.includes('prepare'))) {
            await prepareScene(displayed)
            if (valid() && !stoppedStatus && getScene()) {
              if (!fxPromise) {
                const pending = Promise.resolve().then(loadFx).catch(error => { if (fxPromise === pending) fxPromise = null; throw error })
                fxPromise = pending
              }
              const fx = await bounded(() => fxPromise)
              if (!valid() || stoppedStatus) break
              const sourceId = fieldsOf(first)[0]?.startsWith(`${after.seat ?? 'p1'}:`) ? 'source' : 'target'
              const targetId = fieldsOf(first)[2]?.startsWith(`${after.seat ?? 'p1'}:`) ? 'source' : 'target'
              playback = fx.play({ moveId: effect.id, sourceId,
                targetIds: fieldsOf(first)[2] && fieldsOf(first)[2] !== '[notarget]' ? [targetId] : [],
                outcome: 'hit', phase: prepare ? 'prepare' : 'attack', visualSeed: first.cursor }, {
                scene: getScene(), signal: controller.signal, reducedMotion,
                onCue(cue) { if (cue?.type === (prepare ? 'prepared' : 'impact')) reveal() },
              })
              playbackCancelled = false
              const result = await bounded(() => playback.finished)
              if (result?.status === 'failed' || result?.status === 'cancelled') throw Object.assign(new Error('Effect unavailable'), { presentationStatus: 'failed' })
              playback = null
            }
          }
          reveal()
          // Usually this has already finished during attack recovery. A move
          // with no hit animation (immunity, for example) still gets readable
          // feedback before the next action, faint, switch or result.
          if (impactFinished && valid() && !stoppedStatus) await bounded(() => impactFinished)
          clearImpact()
          if (faintActorIds.length && valid() && !stoppedStatus) {
            // Let the attack recover first. Only then retire its defeated actor,
            // before any switch, forced replacement, or result that follows.
            const result = await bounded(() => faintScene(next, {
              actorIds: faintActorIds, reducedMotion, signal: controller.signal,
            }))
            if (result?.status === 'failed' || result?.status === 'cancelled') {
              throw Object.assign(new Error('Faint animation unavailable'), { presentationStatus: 'failed' })
            }
          }
          displayed = next
          if (group.some(event => structural.has(opcodeOf(event)))) {
            // Switches are server facts; wait for the new sprite's cosmetic entry
            // before presenting the next action. Form/identity corrections aren't throws.
            const entries = ['switch', 'drag'].includes(opcodeOf(first))
              ? [fieldsOf(first)[0]?.startsWith(`${after.seat ?? 'p1'}:`) ? 'source' : 'target'] : []
            await prepareScene(next, true, entries)
          }
        }
        if (stoppedStatus) status = stoppedStatus
      }
    } catch (error) {
      status = stoppedStatus ?? error.presentationStatus ?? 'failed'
      if (!stoppedStatus) safe(onEntryCancel)
    } finally {
      controller.abort()
      cancelPlayback()
      clearImpact()
      if (valid()) {
        publish(after)
        // A skipped attack may have been followed by a replacement. Reconcile
        // artwork too, while preserving the same deadline and reset guards.
        if (!finalSceneReady) {
          if (sceneFailed) {
            // A timed-out intermediate lineup must not mount after the final view.
            // An aborted signal disables entry/waiting while the coordinator
            // invalidates that old load and restores the final artwork in the background.
            try { Promise.resolve(ensureScene(after, { entryActorIds: [], reducedMotion, signal: controller.signal })).catch(() => {}) } catch {}
          } else {
            try { await prepareScene(after, false) } catch { if (status === 'completed') status = 'failed' }
          }
        }
        if (valid()) active = null
      }
    }
    return { status: valid() || generation === token ? status : 'cancelled' }
  }

  return {
    present,
    skip() { active?.stop('skipped') },
    reset(view) {
      generation++
      active?.stop('cancelled'); active = null
      if (!destroyed && view) safe(onDisplay, view)
    },
    destroy() {
      generation++; destroyed = true
      active?.stop('cancelled'); active = null
      disposeFx(fxPromise); fxPromise = null
    },
  }
}
