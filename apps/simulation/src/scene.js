import { ROSTER_LIST } from '../../game/src/roster/index.js'
import { SPRITE_URLS } from '@battle/pokemon-sprites'

const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const speciesByName = new Map(ROSTER_LIST.flatMap(record => [[normalize(record.name), record.id], [normalize(record.id), record.id]]))
export const speciesId = species => speciesByName.get(normalize(species)) ?? null
export const spriteUrl = (species, view = 'front') => SPRITE_URLS[`${speciesId(species)}-${view}.png`] ?? ''
export function activeMembers(view) {
  return [view?.own.team.find(member => member.memberId === view.own.active) ?? null,
    view?.opponent.known.find(member => member.memberId === view.opponent.active) ?? null]
}

/** Host-owned field identities stay stable when either side attacks or switches. */
export function createSimulationScene({ getHost, onAvailability = () => {} }) {
  let scene = null, key = '', generation = 0, pending = null, disposed = false, currentView = null
  function display(view) {
    currentView = view
    activeMembers(view).forEach((member, index) => {
      const actor = scene?.actor(index ? 'target' : 'source')
      if (actor) actor.root.visible = Boolean(member && !member.fainted)
    })
  }
  async function ensure(view) {
    if (disposed) return
    currentView = view
    const members = activeMembers(view)
    const profiles = members.map(member => speciesId(member?.species) ?? 'tall')
    const nextKey = members.map((member, index) => `${member?.memberId ?? '-'}:${profiles[index]}`).join('|')
    if (key === nextKey && scene) { display(view); return }
    if (pending?.key === nextKey) { await pending.promise; return }
    const token = ++generation
    const promise = (async () => {
      let nextScene
      try {
        const [{ createScene }, { previewSceneActors }] = await Promise.all([
          import('../../game/src/scene/index.js'), import('../../game/src/scene/previewActors.js'),
        ])
        if (disposed || token !== generation || !getHost()) return
        scene?.dispose(); scene = null; key = ''; onAvailability(null)
        // Create against a detached host first so cancelled loads never append stale canvases.
        const host = getHost()
        const staging = document.createElement('div')
        staging.className = 'sim-canvas-layer'
        try { nextScene = await createScene(staging, { actors: previewSceneActors(...profiles) }) }
        catch (error) { staging.remove(); throw error }
        const originalDispose = nextScene.dispose
        nextScene.dispose = () => { originalDispose(); staging.remove() }
        if (disposed || token !== generation) { nextScene.dispose(); return }
        host.appendChild(staging)
        scene = nextScene; key = nextKey
        display(currentView)
        onAvailability(true)
      } catch {
        if (!disposed && token === generation) onAvailability(false)
      } finally { if (pending?.token === token) pending = null }
    })()
    pending = { key: nextKey, promise, token }
    await promise
  }
  return {
    get: () => scene, ensure, display,
    clear() { generation++; pending = null; scene?.dispose(); scene = null; key = ''; currentView = null; onAvailability(null) },
    destroy() { disposed = true; this.clear() },
  }
}
