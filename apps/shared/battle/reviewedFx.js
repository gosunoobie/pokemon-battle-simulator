import { createClockedBattleFx } from '@battle/battle-fx/presentation-clock'
import { createAcceptedBattleFx } from '@battle/battle-fx/accepted-effects'
import { getAcceptedFxSoundPlan } from '@battle/battle-sfx/accepted-runtime'

// The host chooses reviewed cosmetic pacing independently of audio settings or
// decoder availability. The FX package still knows nothing about sound plans.
export function createReviewedBattleFx({ createClockedFx = createClockedBattleFx,
  getPlan = getAcceptedFxSoundPlan, ...options } = {}) {
  const fx = createClockedFx({ createFx: createAcceptedBattleFx, ...options })
  const planFor = (request, playOptions) => !playOptions.reducedMotion ? getPlan(request.moveId, {
    phase: request.phase ?? 'attack', outcome: request.outcome ?? 'hit', mode: 'normal',
  }) : null
  const deadlineFor = (plan, playOptions) => {
    if (playOptions.deadlineMs !== undefined) return playOptions.deadlineMs
    if (options.deadlineMs !== undefined) return options.deadlineMs
    const seconds = plan?.visualDurationSeconds / plan?.visualRate
    // The recipe runs in authored seconds; its wall time also includes pacing
    // and a bounded allowance for artwork loading before the clock starts.
    return Number.isFinite(seconds) && seconds > 0 ? Math.max(6000, Math.ceil(seconds * 1000) + 1500) : 6000
  }
  return Object.freeze({
    getPresentationDeadlineMs(request = {}, playOptions = {}) {
      return deadlineFor(planFor(request, playOptions), playOptions)
    },
    play(request = {}, playOptions = {}) {
      const plan = planFor(request, playOptions)
      return fx.play(request, { ...playOptions, visualRate: plan?.visualRate ?? 1, deadlineMs: deadlineFor(plan, playOptions) })
    },
    dispose() { fx.dispose() },
  })
}
