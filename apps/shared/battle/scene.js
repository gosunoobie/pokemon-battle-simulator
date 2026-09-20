import { ROSTER_LIST } from '../../game/src/roster/index.js'
import { SPRITE_URLS } from '@battle/pokemon-sprites'

const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const speciesByName = new Map(ROSTER_LIST.flatMap(record => [[normalize(record.name), record.id], [normalize(record.id), record.id]]))
export const speciesId = species => speciesByName.get(normalize(species)) ?? null
export const spriteUrl = (species, view = 'front') => SPRITE_URLS[`${speciesId(species)}-${view}.png`] ?? ''
export function activeMembers(view) {
  return [view?.own?.team.find(member => member.memberId === view.own.active) ?? null,
    view?.opponent?.known.find(member => member.memberId === view.opponent.active) ?? null]
}

const actorIds = ['source', 'target']
function identity(view) {
  const members = activeMembers(view)
  const profiles = members.map(member => speciesId(member?.species) ?? 'tall')
  const ids = members.map(member => member?.memberId ?? null)
  return { matchId: view?.matchId, members, profiles, ids,
    key: JSON.stringify([view?.matchId, ...ids.map((id, index) => [id, profiles[index]])]) }
}
const loadSceneModules = async () => {
  const [renderer, profiles] = await Promise.all([
    import('../../game/src/scene/index.js'), import('../../game/src/scene/previewActors.js'),
  ])
  return { createScene: renderer.createScene, previewSceneActors: profiles.previewSceneActors }
}

/** Host-owned field identities stay stable when either side attacks or switches. */
export function createSimulationScene({ getHost, onAvailability = () => {},
  loadScene = loadSceneModules, loadRelease = () => import('@battle/battle-fx/transitions'),
  loadFaint = () => import('@battle/battle-fx/transitions'),
  loadIdle = () => import('./idle.js'),
  createHost = () => document.createElement('div'),
}) {
  let scene = null, rendered = null, generation = 0, pending = null, disposed = false, currentView = null, fainting = null
  const entering = new Set()
  const retainedFainted = new Map()
  let idle = null, idleScene = null, idleRequest = null, idleActive = false, idleActorKey = '', idleBlocked = 0
  const idleSettings = { enabled: false, reducedMotion: false, paused: false }
  function pauseIdle() {
    // An optional import cannot claim actors after a transition, skip or reset.
    idleRequest = null
    if (!idleActive) return
    idleActive = false; idleActorKey = ''
    try { idle?.pause() } catch {}
  }
  function disposeIdle() {
    pauseIdle()
    try { idle?.dispose() } catch {}
    idle = null; idleScene = null
  }
  function idleActors() {
    if (disposed || idleBlocked || pending || fainting || !scene || currentView?.result ||
      !idleSettings.enabled || idleSettings.reducedMotion || idleSettings.paused) return []
    const next = identity(currentView)
    return actorIds.filter((id, index) => {
      const member = next.members[index]
      return member && !member.fainted && member.hp?.current !== 0 && sameActor(rendered, next, index) &&
        !retainedFainted.has(id) && !entering.has(id) && scene.actor(id)?.root.visible
    })
  }
  function syncIdle() {
    const ids = idleActors()
    if (!ids.length) { pauseIdle(); return }
    if (idle && idleScene === scene) {
      const key = ids.join(',')
      if (idleActive && key === idleActorKey) return
      try { idle.setActors(ids); idleActive = true; idleActorKey = key }
      catch { disposeIdle() }
      return
    }
    if (idleRequest?.scene === scene) return
    const request = { scene }
    idleRequest = request
    void Promise.resolve().then(() => idleRequest === request ? loadIdle() : null).then(module => {
      if (idleRequest !== request || scene !== request.scene || !idleActors().length) return
      idleRequest = null
      idle = module.createIdleMotion({ scene: request.scene })
      idleScene = request.scene
      syncIdle()
    }).catch(() => { if (idleRequest === request) idleRequest = null })
  }
  function setIdleMotion(settings = {}) {
    for (const key of Object.keys(idleSettings)) if (key in settings) idleSettings[key] = Boolean(settings[key])
    syncIdle()
  }
  const sameActor = (left, right, index) => left?.matchId === right?.matchId &&
    left?.ids[index] === right?.ids[index] && left?.profiles[index] === right?.profiles[index]
  function matchingHold(hold, view, next = identity(view)) {
    if (!hold || scene !== hold.scene || !sameActor(rendered, hold.identity, hold.index) || next.matchId !== hold.identity.matchId) return false
    const memberId = hold.identity.ids[hold.index]
    if (next.ids[hold.index] !== memberId && next.ids[hold.index] !== null) return false
    const members = hold.index ? view?.opponent?.known : view?.own?.team
    const member = members?.find(candidate => candidate.memberId === memberId)
    return Boolean(member?.fainted && speciesId(member.species) === hold.identity.profiles[hold.index])
  }
  function paintVisibility(view) {
    const next = identity(view)
    next.members.forEach((member, index) => {
      const id = actorIds[index], actor = scene?.actor(id)
      if (!actor) return
      if (matchingHold(retainedFainted.get(id), view, next)) actor.root.visible = true
      else if (!sameActor(rendered, next, index) || !member || member.fainted) actor.root.visible = false
      else if (!entering.has(id)) actor.root.visible = true
    })
  }
  function display(view, { retainFaintedActorIds = [] } = {}) {
    const previous = identity(currentView), next = identity(view)
    for (const [index, id] of actorIds.entries()) {
      const held = retainedFainted.get(id)
      const candidate = held ?? { scene, identity: rendered, index }
      const canStart = scene?.actor(id)?.root.visible && !entering.has(id) &&
        sameActor(previous, rendered, index) && previous.members[index] && !previous.members[index].fainted
      if (retainFaintedActorIds.includes(id) && (held || canStart) && matchingHold(candidate, view, next)) retainedFainted.set(id, candidate)
      else retainedFainted.delete(id)
    }
    currentView = view
    if (fainting?.holds.some(([id, hold]) => retainedFainted.get(id) !== hold)) finishFaint(fainting, 'cancelled')
    paintVisibility(view)
    syncIdle()
  }
  function finishFaint(operation, status) {
    if (operation.settled) return
    operation.settled = true
    operation.signal?.removeEventListener('abort', operation.onAbort)
    if (status !== 'completed') {
      operation.controller.abort()
      try { operation.playback?.cancel?.() } catch {}
    }
    for (const [id, hold] of operation.holds) {
      if (retainedFainted.get(id) === hold) retainedFainted.delete(id)
      // The transition owns transient poses; the host owns final visibility.
      if (scene === operation.scene) {
        try { scene.actor(id)?.resetPose() } catch { status = 'failed' }
      }
    }
    if (fainting === operation) fainting = null
    if (scene === operation.scene) paintVisibility(currentView)
    syncIdle()
    operation.resolve({ status })
  }
  async function faint(view, { actorIds: requestedIds = [], reducedMotion = false, signal, onFaintStart } = {}) {
    if (fainting) finishFaint(fainting, 'cancelled')
    const holds = [...new Set(requestedIds)].flatMap(id => {
      const hold = retainedFainted.get(id)
      return hold && matchingHold(hold, view) && matchingHold(hold, currentView) ? [[id, hold]] : []
    })
    if (disposed || !scene || !holds.length) return { status: signal?.aborted ? 'cancelled' : 'skipped' }
    const operation = { scene, holds, signal, controller: new AbortController(), playback: null, settled: false }
    const finished = new Promise(resolve => { operation.resolve = resolve })
    operation.onAbort = () => finishFaint(operation, 'cancelled')
    fainting = operation
    syncIdle()
    if (signal?.aborted) operation.onAbort()
    else {
      signal?.addEventListener('abort', operation.onAbort, { once: true })
      // Loading and playback settle independently of cancellation. Late optional
      // modules cannot animate a replacement member or revive a completed faint.
      void Promise.resolve().then(loadFaint).then(async module => {
        if (operation.settled || fainting !== operation || scene !== operation.scene) return
        const started = new Set()
        operation.playback = module.playPokemonFaint({ scene: operation.scene, actorIds: holds.map(([id]) => id),
          reducedMotion, signal: operation.controller.signal, onCue(cue) {
            const id = cue?.actorId, hold = holds.find(([actorId]) => actorId === id)?.[1]
            if (cue?.type !== 'faint' || !hold || started.has(id) || disposed || operation.settled ||
              fainting !== operation || scene !== operation.scene || operation.controller.signal.aborted || signal?.aborted ||
              retainedFainted.get(id) !== hold || !matchingHold(hold, currentView) || !scene.actor(id)?.root.visible) return
            started.add(id)
            try { onFaintStart?.(id, hold.identity.ids[hold.index]) } catch {}
          } })
        if (operation.settled) {
          try { operation.playback?.cancel?.() } catch {}
          return
        }
        const result = await operation.playback.finished
        finishFaint(operation, result?.status ?? 'completed')
      }).catch(() => finishFaint(operation, 'failed'))
    }
    return finished
  }
  const valid = operation => !disposed && operation.token === generation
  function finishEntry(operation) {
    if (scene !== operation.scene) return
    for (const id of operation.entries) {
      entering.delete(id)
      scene?.actor(id)?.resetPose()
    }
    display(currentView)
  }
  function stopEntry(operation) {
    operation.skipEntry = true
    operation.controller.abort()
    if (operation.playback && !operation.playbackCancelled) {
      operation.playbackCancelled = true
      try { operation.playback.cancel?.() } catch {}
    }
    operation.releaseStopped()
    operation.resolveStopped()
    finishEntry(operation)
    if (valid(operation) && !scene) onAvailability(false)
  }
  function supersede() {
    generation++
    if (fainting) finishFaint(fainting, 'cancelled')
    retainedFainted.clear()
    if (pending) { stopEntry(pending); pending.resolveStopped(); pending = null }
  }
  // A skipped presentation need not wait for a slow texture/module request.
  // The still-current renderer can finish in the background, with entry disabled.
  async function waitFor(operation, signal) {
    if (signal?.aborted) { stopEntry(operation); return }
    let onAbort
    const aborted = new Promise(resolve => {
      onAbort = () => { stopEntry(operation); resolve() }
      signal?.addEventListener('abort', onAbort, { once: true })
    })
    try { await Promise.race([operation.promise, operation.stopped, aborted]) }
    finally { signal?.removeEventListener('abort', onAbort) }
  }
  async function ensure(view, options = {}) {
    if (disposed) return
    idleBlocked++
    pauseIdle()
    try { await ensureScene(view, options) }
    finally { idleBlocked--; syncIdle() }
  }
  async function ensureScene(view, { entryActorIds = [], reducedMotion = false, signal, onEntryReveal, onEntrySound } = {}) {
    display(view)
    const next = identity(view)
    if (pending?.key === next.key) { await waitFor(pending, signal); return }
    if (rendered?.key === next.key && scene) { if (pending) supersede(); return }
    const previous = rendered
    supersede()
    const operation = { token: generation, key: next.key, scene: null, controller: new AbortController(),
      entries: actorIds.filter((id, index) => entryActorIds.includes(id) && next.members[index] && !next.members[index].fainted &&
        (previous?.matchId !== next.matchId || previous?.ids[index] !== next.ids[index])),
      skipEntry: Boolean(signal?.aborted), playback: null, playbackCancelled: false,
    }
    operation.stopped = new Promise(resolve => { operation.resolveStopped = resolve })
    operation.entryStopped = new Promise(resolve => { operation.releaseStopped = resolve })
    pending = operation
    operation.promise = (async () => {
      let nextScene
      try {
        const { createScene, previewSceneActors } = await loadScene()
        if (!valid(operation) || !getHost()) return
        // Create against a detached host first so cancelled loads never append stale canvases.
        const staging = createHost()
        staging.className = 'sim-canvas-layer'
        // Lower the near slot and its platform together, keeping the preview layout intact.
        const actors = previewSceneActors(...next.profiles).map(actor => actor.id === 'source' ? { ...actor, y: .82 } : actor)
        try { nextScene = await createScene(staging, { actors }) }
        catch (error) { staging.remove(); throw error }
        const originalDispose = nextScene.dispose
        let released = false
        nextScene.dispose = () => { if (released) return; released = true; try { originalDispose() } finally { staging.remove() } }
        const host = getHost()
        if (!valid(operation) || !host) { nextScene.dispose(); return }
        // Restore only owned idle poses before copying any presentation pose.
        disposeIdle()
        // Keep the unchanged side's presentation pose when replacing the canvas.
        actorIds.forEach((id, index) => {
          const old = scene?.actor(id), actor = nextScene.actor(id)
          if (!old || !actor || rendered?.matchId !== next.matchId || rendered?.ids[index] !== next.ids[index] || rendered?.profiles[index] !== next.profiles[index]) return
          actor.pose.position.copyFrom(old.pose.position); actor.pose.scale.copyFrom(old.pose.scale)
          actor.pose.rotation = old.pose.rotation; actor.pose.alpha = old.pose.alpha; actor.pose.tint = old.pose.tint
          actor.root.visible = old.root.visible
        })
        const previousScene = scene
        scene = nextScene; rendered = next; operation.scene = nextScene
        entering.clear()
        if (!operation.skipEntry) for (const id of operation.entries) {
          entering.add(id)
          nextScene.actor(id).root.visible = false
        }
        display(currentView)
        // Hide incoming actors before the first attached frame and before the
        // fallback is removed, including while the optional transition loads.
        host.appendChild(staging)
        previousScene?.dispose()
        onAvailability(true)
        if (operation.entries.length && !operation.skipEntry) {
          try {
            const release = await Promise.race([loadRelease(), operation.entryStopped])
            if (release && valid(operation) && !operation.skipEntry) {
              const revealed = new Set(), opened = new Set()
              operation.startingPlayback = true
              try { operation.playback = release.playPokeballRelease({ scene: nextScene, actorIds: operation.entries,
                reducedMotion, signal: operation.controller.signal, onCue(cue) {
                  const id = cue?.actorId, index = actorIds.indexOf(id)
                  const seen = cue?.type === 'open' ? opened : cue?.type === 'reveal' ? revealed : null
                  if (!seen || !operation.entries.includes(id) || seen.has(id) ||
                    !valid(operation) || pending !== operation || operation.skipEntry || operation.controller.signal.aborted ||
                    signal?.aborted || scene !== nextScene || !entering.has(id)) return
                  const displayed = identity(currentView)
                  if (!sameActor(next, displayed, index) || displayed.members[index]?.fainted ||
                    displayed.members[index]?.hp?.current === 0 || !nextScene.actor(id) ||
                    (!nextScene.actor(id).root.visible && (cue.type !== 'open' || !operation.startingPlayback))) return
                  // An opening cue can arrive synchronously before the clip has
                  // returned and the host exposes its safely hidden actor root.
                  seen.add(id)
                  try { (cue.type === 'open' ? onEntrySound : onEntryReveal)?.(id) } catch {}
                } }) } finally { operation.startingPlayback = false }
              if (!valid(operation) || pending !== operation || operation.skipEntry || operation.controller.signal.aborted || signal?.aborted || scene !== nextScene) {
                stopEntry(operation)
                return
              }
              // The clip synchronously hides its actor pose before returning.
              // Expose the root only now, so its expanding pose can be seen.
              const displayed = identity(currentView)
              operation.entries.forEach(id => {
                const index = actorIds.indexOf(id)
                if (displayed.matchId === next.matchId && displayed.ids[index] === next.ids[index] && displayed.profiles[index] === next.profiles[index] && !displayed.members[index]?.fainted) nextScene.actor(id).root.visible = true
              })
              await Promise.race([operation.playback.finished, operation.entryStopped])
            }
          } catch { stopEntry(operation) }
          finally { finishEntry(operation) }
        }
      } catch {
        if (valid(operation)) {
          if (scene === nextScene && nextScene) finishEntry(operation)
          else { disposeIdle(); scene?.dispose(); scene = null; rendered = null; entering.clear(); onAvailability(false) }
        }
      } finally { if (pending === operation) pending = null; syncIdle() }
    })()
    await waitFor(operation, signal)
  }
  function clear() {
    idleBlocked++
    try {
      pauseIdle(); supersede(); disposeIdle(); scene?.dispose(); scene = null; rendered = null; entering.clear(); currentView = null; onAvailability(null)
    } finally { idleBlocked-- }
  }
  return {
    get: () => scene, ensure, display, faint, setIdleMotion,
    clear,
    destroy() { disposed = true; clear() },
  }
}
