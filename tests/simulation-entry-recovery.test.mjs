import test from 'node:test'
import assert from 'node:assert/strict'
import { createSimulationScene } from '../apps/simulation/src/scene.js'
import { createSimulationPresenter } from '../apps/simulation/src/presentation.js'

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const tick = () => new Promise(resolve => setImmediate(resolve))
const point = (x, y) => ({ x, y, copyFrom(value) { this.x = value.x; this.y = value.y } })
function actor(id) {
  return { id, root: { visible: true }, pose: { position: point(0, 0), scale: point(1, 1), rotation: 0, alpha: 1, tint: 0xffffff },
    resetPose() { this.pose.position.copyFrom({ x: 0, y: 0 }); this.pose.scale.copyFrom({ x: 1, y: 1 }); this.pose.rotation = 0; this.pose.alpha = 1; this.pose.tint = 0xffffff },
  }
}
function fixture() {
  const member = (id, species) => ({ memberId: id, species, name: species, active: id.endsWith(':1'),
    fainted: false, hp: { current: 100, max: 100 }, stages: {}, volatiles: [] })
  const before = { matchId: 'entry-recovery', seat: 'p1', cursor: 1, turn: 1,
    own: { active: 'p1:1', team: [member('p1:1', 'Charizard'), member('p1:2', 'Blastoise'), member('p1:3', 'Venusaur')] },
    opponent: { active: 'p2:1', known: [member('p2:1', 'Gengar')] }, sideConditions: { p1: [], p2: [] }, fieldConditions: [] }
  const after = structuredClone(before)
  after.own.active = 'p1:3'; after.cursor = 4
  after.own.team.forEach(candidate => { candidate.active = candidate.memberId === 'p1:3' })
  after.own.team[1].hp.current = 0; after.own.team[1].fainted = true
  const event = (cursor, opcode, ...fields) => ({ cursor, type: 'protocol', args: { opcode, fields } })
  return { before, after, events: [event(2, 'switch', 'p1:2', 'Blastoise, L100', '100/100'),
    event(3, 'faint', 'p1:2'), event(4, 'switch', 'p1:3', 'Venusaur, L100', '100/100')] }
}

test('a timed-out intermediate entry reconciles the final lineup without waiting, and late renderers cannot replace it', async () => {
  for (const lateFirst of [true, false]) {
    const intermediate = deferred(), final = deferred(), scenes = [], attached = [], displayed = [], requests = []
    let releaseCalls = 0
    const coordinator = createSimulationScene({
      getHost: () => ({ appendChild(staging) { attached.push(staging.scene) } }),
      createHost: () => ({ remove() {} }),
      loadScene: async () => ({
        previewSceneActors: (...profiles) => profiles.map((profile, index) => ({ id: index ? 'target' : 'source', profile })),
        async createScene(staging, { actors }) {
          const actorsById = new Map(actors.map(spec => [spec.id, actor(spec.id)]))
          const scene = { profile: actors[0].profile, disposed: 0, actor: id => actorsById.get(id), dispose() { scene.disposed++ } }
          scenes.push(scene); staging.scene = scene
          if (scene.profile === 'blastoise') await intermediate.promise
          if (scene.profile === 'venusaur') await final.promise
          return scene
        },
      }),
      loadRelease: async () => { releaseCalls++; throw new Error('Timed-out entries must not play later') },
    })
    const presenter = createSimulationPresenter({
      getScene: coordinator.get,
      ensureScene: (view, options) => { requests.push(options); return coordinator.ensure(view, options) },
      onDisplay: view => { displayed.push(view); coordinator.display(view) },
      loadFx: () => { throw new Error('No move animation belongs to this batch') }, timeoutMs: 15,
    })
    const batch = fixture(), saved = structuredClone(batch)
    try {
      await coordinator.ensure(batch.before)
      const original = coordinator.get()
      original.actor('target').pose.alpha = .8
      const result = await presenter.present(batch)
      assert.equal(result.status, 'failed', 'the presentation deadline still releases controls')
      assert.deepEqual(displayed.at(-1), batch.after)
      assert.deepEqual(batch, saved, 'cosmetic timeout does not modify server facts')
      await tick()
      assert.equal(requests.at(-1).signal.aborted, true)
      assert.deepEqual(requests.at(-1).entryActorIds, [])
      assert.ok(scenes.some(scene => scene.profile === 'venusaur'), 'final renderer starts in background before its assets are ready')
      const stale = scenes.find(scene => scene.profile === 'blastoise')
      if (lateFirst) {
        intermediate.resolve(); await tick()
        assert.equal(stale.disposed, 1)
        assert.equal(attached.length, 1, 'intermediate renderer never attaches after timeout')
      }
      final.resolve(); await tick()
      const current = coordinator.get()
      assert.equal(current.profile, 'venusaur')
      assert.equal(current.actor('source').root.visible, true)
      assert.equal(current.actor('target').root.visible, true)
      assert.equal(current.actor('target').pose.alpha, .8, 'unchanged opponent presentation survives reconciliation')
      intermediate.resolve(); await tick()
      assert.equal(coordinator.get(), current, 'late intermediate completion cannot replace final artwork')
      assert.equal(stale.disposed, 1)
      assert.deepEqual(attached.map(scene => scene.profile), ['charizard', 'venusaur'])
      assert.equal(releaseCalls, 0)
    } finally {
      intermediate.resolve(); final.resolve(); presenter.destroy(); coordinator.destroy(); await tick()
    }
  }
})
