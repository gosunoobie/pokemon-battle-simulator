import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration waterMoves.js. Shapes, particle laws and choreography are move-owned.
export default function bubbleBeam(context) {
  const { tl, assets, glowTexture, random, onCue, onFrame } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, emission, socket, targetSocket, solveContact, captureActor, world, unit } = bindEffectSpace(context)
  const sourceBaseScale=1, targetBaseScale=1, move={tint:context.tint}
  const impactGlow=new Sprite(glowTexture);impactGlow.anchor.set(.5);impactGlow.position.set(focus.x-10,focus.y);impactGlow.tint=move.tint;impactGlow.blendMode='add';impactGlow.width=330;impactGlow.height=240;impactGlow.alpha=0;temporary.addChild(impactGlow)
  const mouthGlow=new Sprite(glowTexture);mouthGlow.anchor.set(.5);mouthGlow.position.copyFrom(emission);mouthGlow.tint=0xff6c1d;mouthGlow.blendMode='add';mouthGlow.width=mouthGlow.height=150;mouthGlow.alpha=0;temporary.addChild(mouthGlow)
  onFrame(() => mouthGlow.position.copyFrom(socket('emission', true)))
  const emitter={strength:0};let spawnCarry=0

  function addHit(tl, move, at, { shake = 3, recoil = 13 } = {}) {
    tl.to(defender,{x:defenderHome.x+recoil,duration:.06,repeat:7,yoyo:true,ease:'none'},at)
      .to(world,{x:shake,y:-shake/2,duration:.06,repeat:7,yoyo:true,ease:'none'},at)
      .call(()=>{onCue({type:'impact'});defender.tint=move.tint},[],at)
      .call(()=>{defender.tint=0xffffff},[],at+.24)
      .set(defender,{x:defenderHome.x},at+.5).set(world,{x:0,y:0},at+.5)
  }

  
  const mouth = lean => ({ x: home.x + lean + emission.x, y: home.y + emission.y })
function charge(tl, size, alpha, fadeAt) {
    const light = new Sprite(glowTexture)
    light.anchor.set(0.5)
    light.width = size
    light.height = size * 0.9
    light.tint = 0x9ceaff
    light.alpha = 0
    light.blendMode = 'add'
    temporary.addChild(light)
    const follow = () => light.position.set(attacker.x + emission.x, attacker.y + emission.y)
    follow()
    tl.to(light, { alpha, duration: 0.3 }, 0.1)
      .to(light, { alpha: 0, duration: 0.3 }, fadeAt)
    return follow
  }

function splash(tl, x, y, at, count, spread) {
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count
      const distance = spread * (0.6 + (i % 3) * 0.2)
      const duration = 0.36 + (i % 3) * 0.06
      const drop = new Graphics().ellipse(0, 0, 2.5 + i % 2, 5 + i % 3)
        .fill({ color: i % 2 ? 0xc0f4ff : 0x74cdf1, alpha: 0.85 })
      drop.position.set(x, y)
      drop.rotation = angle + Math.PI / 2
      drop.alpha = 0
      temporary.addChild(drop)
      const state = { progress: 0 }
      tl.to(drop, { alpha: 0.8, duration: 0.04 }, at)
        .to(state, { progress: 1, duration, ease: 'none', onUpdate: () => {
          const p = state.progress
          drop.position.set(x + Math.cos(angle) * distance * p, y + Math.sin(angle) * distance * p + 45 * p * p)
        } }, at)
        .to(drop, { alpha: 0, duration: 0.18 }, at + duration - 0.18)
    }
  }

function pop(tl, x, y, radius, at, drops) {
    const ring = new Graphics().circle(0, 0, radius).stroke({ color: 0xd6faff, width: 1.8, alpha: 0.85 })
    ring.position.set(x, y)
    ring.alpha = 0
    temporary.addChild(ring)
    tl.to(ring, { alpha: 0.7, duration: 0.04 }, at)
      .to(ring.scale, { x: 1.55, y: 1.55, duration: 0.28, ease: 'power2.out' }, at)
      .to(ring, { alpha: 0, duration: 0.3 }, at + 0.04)
    if (drops) splash(tl, x, y, at, drops, radius * 2.4)
  }

function flyingBubble(tl, { source, target, radius, at, duration, arc = 0, sway = 0, cycles = 3, phase = 0, ease = 'none', drops = 4 }) {
    const ball = new Graphics().circle(0, 0, radius)
      .fill({ color: 0x73d8ff, alpha: 0.1 })
      .stroke({ color: 0xb8f2ff, width: 1.8, alpha: 0.8 })
      .circle(-radius * 0.3, -radius * 0.35, radius * 0.16).fill({ color: 0xf0fdff, alpha: 0.85 })
    ball.position.set(source.x, source.y)
    ball.scale.set(0.45)
    ball.alpha = 0
    temporary.addChild(ball)
    const state = { progress: 0 }
    tl.to(ball, { alpha: 0.85, duration: 0.08 }, at)
      .to(ball.scale, { x: 1, y: 1, duration: 0.18 }, at)
      .to(state, { progress: 1, duration, ease, onUpdate: () => {
        const p = state.progress
        const offset = Math.sin(Math.PI * p) * (arc + sway * Math.sin(p * Math.PI * cycles + phase))
        ball.position.set(source.x + (target.x - source.x) * p, source.y + (target.y - source.y) * p + offset)
      } }, at)
      .set(ball, { alpha: 0 }, at + duration)
    pop(tl, target.x, target.y, radius, at + duration, drops)
  }
function bubbleBeam(tl, move) {
    const follow = charge(tl, 82, 0.35, 1.3)
    tl.to(attacker, { x: home.x - 10, duration: 0.2, onUpdate: follow }, 0)
      .to(attacker, { x: home.x + 8, duration: 0.16, onUpdate: follow }, 0.2)
      .to(attacker, { x: home.x, duration: 0.3, onUpdate: follow }, 1.75)
    const source = mouth(8)
    const thread = new Graphics()
    thread.alpha = 0
    temporary.addChild(thread)
    const state = { reach: 0 }
    tl.to(thread, { alpha: 0.6, duration: 0.12 }, 0.4)
      .to(state, { reach: 1, duration: 0.38, ease: 'none', onUpdate: () => {
        thread.clear()
        for (const [width, alpha] of [[12, 0.1], [3, 0.22]]) {
          thread.moveTo(source.x, source.y)
            .lineTo(source.x + (focus.x - source.x) * state.reach, source.y + (focus.y - source.y) * state.reach)
            .stroke({ width, color: 0x58c2ed, alpha, cap: 'round' })
        }
      } }, 0.4)
      .to(thread, { alpha: 0, duration: 0.25 }, 1.4)
    for (let i = 0; i < 24; i++) {
      const lane = i % 2 ? 1 : -1
      flyingBubble(tl, {
        source, target: { x: (focus.x), y: (focus.y) + lane * 8 }, radius: 6 + (i % 3) * 2,
        at: 0.4 + i * 0.035, duration: 0.38, sway: lane * 11, cycles: 4, drops: i % 3 === 0 ? 4 : 0,
      })
    }
    tl.to(impactGlow, { alpha: 0.26, duration: 0.12 }, 0.78)
      .to(impactGlow, { alpha: 0, duration: 0.4 }, 1.4)
    addHit(tl, move, 0.78, { recoil: 11, shake: 2, duration: 0.7 })
    tl.call(() => {}, [], 2.3)
  }
  bubbleBeam(tl,move)
}
