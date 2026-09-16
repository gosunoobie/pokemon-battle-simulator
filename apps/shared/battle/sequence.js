// Host presentation only. Server results choose the copy; these timed overlays
// never change battle state, decisions, actor poses or league progression.
export const OVERLAY_TIMINGS = Object.freeze({ intro: 2000, result: 1800, reducedIntro: 900, reducedResult: 220 })

export function introOverlay(view, run, playerLabel = 'Your team', { opponentName, opponentTitle } = {}) {
  return {
    key: `${view.matchId}:intro`, kind: 'intro', champion: run?.opponent?.title === 'Champion',
    eyebrow: run ? `${run.regionName} Pokémon League` : 'Generation 3 singles',
    title: 'Battle start', detail: 'Let the battle begin!', playerLabel,
    opponentName: run?.opponent?.name ?? opponentName ?? 'Opponent', opponentTitle: run?.opponent?.title ?? opponentTitle ?? 'Battle trainer',
    roundLabel: run ? `Battle ${run.stageIndex + 1} / ${run.totalStages}` : 'Level 100',
  }
}

export function resultOverlay(view, run) {
  const result = view?.result
  if (!result) return null
  const win = result.kind === 'win' && result.winnerSeat === (view.seat ?? 'p1')
  const champion = win && run?.status === 'won'
  const kind = result.kind === 'win' ? win ? 'victory' : 'defeat' : result.kind === 'draw' ? 'draw' : 'no-contest'
  const opponent = run?.opponent?.name ?? 'your opponent'
  return {
    key: `${view.matchId}:result`, kind, champion,
    title: champion ? 'Champion' : { victory: 'Victory', defeat: 'Defeat', draw: 'Draw', 'no-contest': 'No contest' }[kind],
    eyebrow: champion ? `${run.regionName} League conquered` : run ? `${run.regionName} League · Battle ${run.stageIndex + 1}` : 'Battle complete',
    detail: champion ? `All ${run.totalStages} trainers defeated. The title is yours!`
      : kind === 'victory' ? `${opponent === 'your opponent' ? 'Your opponent' : opponent} defeated. Well battled!`
        : kind === 'defeat' ? result.reason === 'forfeit' ? 'You forfeited the battle.' : 'Your team gave it everything.'
          : kind === 'draw' ? 'An even finish. Neither side takes the win.' : 'This battle ended without a winner.',
  }
}

/** Order intro → existing moves/entries/faints → result. Timers are bounded and
 * cancellable independently of CSS animation events or renderer availability.
 */
export function createBattleSequence({ presenter, onOverlay, timers = globalThis }) {
  if (!presenter || typeof onOverlay !== 'function') throw new TypeError('A presenter and overlay callback are required.')
  let active = null, generation = 0, destroyed = false, overlay = null
  let history = { matchId: null, introduced: false, resultShown: false }
  function publish(value) {
    overlay = value
    try { onOverlay(value) } catch { /* Optional presentation cannot block play. */ }
  }
  const still = value => value && { ...value, animated: false, motion: 'none', durationMs: 0 }
  function remember(view) {
    if (history.matchId !== view?.matchId) history = { matchId: view?.matchId ?? null, introduced: false, resultShown: false }
  }
  function stop() {
    const previous = active
    active = null
    previous?.cancelWait?.()
  }
  async function present(batch, { effectsEnabled = true, reducedMotion = false } = {}) {
    if (destroyed) return { status: 'cancelled' }
    const { before, after, run = null, playerLabel, opponentName, opponentTitle } = batch
    if (!after) throw new TypeError('An authoritative after view is required.')
    const previousView = before?.matchId === after.matchId ? before : null
    stop()
    const token = ++generation
    const current = { skipped: false, cancelWait: null }
    active = current
    const valid = () => !destroyed && active === current && generation === token
    // Invalidate any older presenter callbacks before an intro can occupy time.
    presenter.reset(previousView ?? after)
    remember(after)
    const fresh = !before || before.matchId !== after.matchId
    const introduce = fresh && !after.result && !history.introduced
    const celebrate = Boolean(after.result) && !history.resultShown && !(before?.matchId === after.matchId && before.result)
    history.introduced = true
    if (!after.result || celebrate) publish(null)
    const wait = ms => new Promise(resolve => {
      let timer
      const finish = () => {
        if (timer !== undefined) timers.clearTimeout(timer)
        current.cancelWait = null
        resolve()
      }
      current.cancelWait = finish
      timer = timers.setTimeout(finish, ms)
    })
    try {
      if (introduce && effectsEnabled) {
        const durationMs = reducedMotion ? OVERLAY_TIMINGS.reducedIntro : OVERLAY_TIMINGS.intro
        publish({ ...introOverlay(after, run, playerLabel, { opponentName, opponentTitle }), animated: true, motion: reducedMotion ? 'reduced' : 'full', durationMs })
        await wait(durationMs)
        if (!valid()) return { status: 'cancelled' }
        publish(null)
      }
      if (!valid()) return { status: 'cancelled' }
      const playback = await presenter.present({ ...batch, before: previousView }, { effectsEnabled: effectsEnabled && !current.skipped, reducedMotion })
      if (!valid()) return { status: 'cancelled' }
      const result = resultOverlay(after, run)
      if (result) {
        history.resultShown = true
        const animate = celebrate && effectsEnabled && !current.skipped && playback.status === 'completed'
        const durationMs = reducedMotion ? OVERLAY_TIMINGS.reducedResult : OVERLAY_TIMINGS.result
        publish(animate ? { ...result, animated: true, motion: reducedMotion ? 'reduced' : 'full', durationMs } : still(result))
        if (animate) {
          await wait(durationMs)
          if (!valid()) return { status: 'cancelled' }
          publish(still(result))
        }
      }
      return { status: current.skipped ? 'skipped' : playback.status }
    } catch {
      if (!valid()) return { status: 'cancelled' }
      // Cosmetic failures recover the same server view and static result copy.
      presenter.reset(after)
      history.resultShown = Boolean(after.result)
      publish(still(resultOverlay(after, run)))
      return { status: 'failed' }
    } finally {
      if (active === current) active = null
      current.cancelWait?.()
    }
  }
  return Object.freeze({
    present,
    skip() {
      if (destroyed) return
      if (active) { active.skipped = true; active.cancelWait?.() }
      presenter.skip()
      if (overlay) publish(overlay.kind === 'intro' ? null : still(overlay))
    },
    reset(view, { run = null } = {}) {
      if (destroyed) return
      generation++; stop()
      presenter.reset(view)
      remember(view)
      history.introduced = Boolean(view)
      history.resultShown = Boolean(view?.result)
      publish(still(resultOverlay(view, run)))
    },
    destroy() {
      if (destroyed) return
      destroyed = true; generation++; stop(); presenter.destroy(); publish(null)
    },
  })
}
