// Authored showcase samples, not a hit-count roll or battle rules. Live games
// supply their authoritative count and damage events through the shared host.
export const PREVIEW_HIT_COUNTS = Object.freeze({
  'double-slap': 2, 'comet-punch': 3, 'fury-attack': 4, 'fury-swipes': 3,
  'arm-thrust': 3, 'bullet-seed': 5, 'pin-missile': 4, 'spike-cannon': 3,
  'icicle-spear': 3, barrage: 5, 'bone-rush': 3, 'rock-blast': 3,
  'double-kick': 2, twineedle: 2, bonemerang: 2, 'triple-kick': 3, 'beat-up': 4,
})

// Presentation snapshots only: the complete core result is already committed.
// Divide the fixed demo total across the sample contacts, stopping at its final
// HP. These illustrative steps never enter core or the FX request.
export function withPreviewHits(transaction, move) {
  const count = PREVIEW_HIT_COUNTS[move.id]
  const { before, after, event } = transaction
  if (!count || event.outcome !== 'hit') return transaction
  const targetId = event.targetIds[0]
  const target = before.actors[targetId], finalTarget = after.actors[targetId]
  const damage = target.hp - finalTarget.hp
  if (damage <= 0) return transaction
  const total = Math.max(damage, move.damage ?? damage)
  const states = []
  for (let index = 1; index <= count; index++) {
    const hp = Math.max(finalTarget.hp, target.hp - Math.round(total * index / count))
    const state = hp === finalTarget.hp ? after : Object.freeze({ ...before,
      actors: Object.freeze({ ...before.actors, [targetId]: Object.freeze({ ...target, hp }) }),
    })
    states.push(state)
    if (hp === finalTarget.hp) break
  }
  const hitCount = states.length
  const hits = Object.freeze(states.map((state, index) => Object.freeze({ state,
    message: `${target.name} took ${(index ? states[index - 1] : before).actors[targetId].hp - state.actors[targetId].hp} damage. Hit ${index + 1} of ${hitCount}.`,
  })))
  const resultMessage = `${event.resultMessage} Hit ${hitCount} ${hitCount === 1 ? 'time' : 'times'}!`
  return Object.freeze({ ...transaction, presentation: Object.freeze({ hitCount, hits, resultMessage }) })
}
