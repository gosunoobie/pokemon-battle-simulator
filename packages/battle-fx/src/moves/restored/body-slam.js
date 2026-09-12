import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration physicalMoves.js. Shapes, particle laws and choreography are move-owned.
export default function bodySlam(context) {
  const { tl, assets, glowTexture, random, onCue, onFrame } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, emission, socket, targetSocket, solveContact, captureActor, world, unit } = bindEffectSpace(context)
  const hopSocket=socket('slam')
  const hopY=(offset, angle)=>focus.y+offset+(22.083333333333)*Math.sin(angle)+(-96.614583333333)*Math.cos(angle)-hopSocket.x*Math.sin(angle)-hopSocket.y*Math.cos(angle)
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

  
  const target = { x: (focus.x), y: (focus.y + 8) }
function anchorPose(name, rotation, point = target) {
    return solveContact(name, rotation, point)
  }

function impact(tl, at, tint, size = 1) {
    const flash = new Graphics()
    flash.label = 'physical-impact'
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4
      const r = (i % 2 ? 27 : 43) * size
      const dx = Math.cos(angle), dy = Math.sin(angle)
      flash.poly([dx * 8 - dy * 5, dy * 8 + dx * 5, dx * r, dy * r, dx * 8 + dy * 5, dy * 8 - dx * 5])
        .fill(i % 2 ? tint : 0xfffbea)
    }
    flash.circle(0, 0, 9 * size).fill(0xfffbea)
    flash.position.set(target.x, target.y)
    flash.alpha = 0
    flash.scale.set(0.5)
    temporary.addChild(flash)
    tl.to(flash, { alpha: 1, duration: 0.025 }, at)
      .to(flash.scale, { x: 1.15, y: 1.15, duration: 0.16, ease: 'power3.out' }, at)
      .to(flash, { alpha: 0, rotation: 0.12, duration: 0.18 }, at + 0.07)
    impactGlow.width = 155 * size
    impactGlow.height = 120 * size
    tl.to(impactGlow, { alpha: 0.34, duration: 0.035 }, at)
      .to(impactGlow, { alpha: 0, duration: 0.23 }, at + 0.06)
  }

function dust(tl, x, y, at, count = 8, spread = 50) {
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1
      const distance = side * spread * (0.5 + (i % 4) * 0.16)
      const mote = new Graphics().ellipse(0, 0, 4 + i % 3, 2.5 + i % 2).fill({ color: 0xe1dac3, alpha: 0.7 })
      mote.position.set(x, y)
      mote.alpha = 0
      temporary.addChild(mote)
      const state = { progress: 0 }
      const duration = 0.34 + (i % 3) * 0.045
      tl.to(mote, { alpha: 0.65, duration: 0.045 }, at)
        .to(state, { progress: 1, duration, ease: 'none', onUpdate: () => {
          const p = state.progress
          mote.position.set(x + distance * p, y - (20 + i % 4 * 5) * Math.sin(p * Math.PI) + 5 * p)
          mote.scale.set(1 + p * 0.5)
        } }, at)
        .to(mote, { alpha: 0, duration: 0.18 }, at + duration - 0.18)
    }
  }

function groundRing(tl, at, radius, tint) {
    const ring = new Graphics().ellipse(0, 0, radius, 15).stroke({ color: tint, width: 3, alpha: 0.8 })
    ring.label = 'physical-ground-ring'
    ring.position.set(target.x, (floor.y - 2))
    ring.scale.set(0.35)
    ring.alpha = 0
    temporary.addChild(ring)
    tl.to(ring, { alpha: 0.8, duration: 0.04 }, at)
      .to(ring.scale, { x: 1.35, y: 1.35, duration: 0.38, ease: 'power2.out' }, at)
      .to(ring, { alpha: 0, duration: 0.3 }, at + 0.08)
  }
function bodySlam(tl, move) {
    const contact = 0.82
    const pose = anchorPose('slam', 0.36)
    tl.to(attacker.scale, { x: sourceBaseScale * 1.04, y: sourceBaseScale * 0.91, duration: 0.22 }, 0)
      .to(attacker, { x: home.x - 9, y: home.y + 3, duration: 0.22 }, 0)
      .to(attacker.scale, { x: sourceBaseScale, y: sourceBaseScale, duration: 0.12 }, 0.22)
      .to(attacker, { x: (home.x + (focus.x - home.x) * 0.652719665272), y: hopY(47, -0.1), rotation: -0.1, duration: 0.36, ease: 'power2.out' }, 0.22)
      .to(attacker, { ...pose, duration: 0.24, ease: 'power2.in' }, 0.58)
      .to(attacker.scale, { x: sourceBaseScale * 1.05, y: sourceBaseScale * 0.93, duration: 0.065 }, contact)
      .to(defender.scale, { x: targetBaseScale * 1.06, y: targetBaseScale * 0.88, duration: 0.065 }, contact)
      .to(defender.scale, { x: targetBaseScale, y: targetBaseScale, duration: 0.2, ease: 'power2.out' }, 0.98)
      .to(attacker.scale, { x: sourceBaseScale, y: sourceBaseScale, duration: 0.16 }, 0.9)
      .to(attacker, { x: (home.x + (focus.x - home.x) * 0.602510460251), y: (floor.y - 24), rotation: -0.08, duration: 0.23, ease: 'power2.out' }, 0.91)
      .to(attacker, { x: home.x, y: home.y, rotation: 0, duration: 0.43, ease: 'power1.inOut' }, 1.14)
    dust(tl, home.x, home.y - 6, 0.22, 6, 40)
    impact(tl, contact, move.tint, 1.08)
    groundRing(tl, contact, 68, 0xf3dfb5)
    groundRing(tl, contact + 0.1, 53, 0xd7c9ad)
    dust(tl, target.x, (floor.y - 3), contact, 14, 100)
    addHit(tl, move, contact, { recoil: 13, shake: 4, duration: 0.65 })
    tl.call(() => {}, [], 1.85)
  }
  bodySlam(tl,move)
}
