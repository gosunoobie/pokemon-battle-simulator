import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration physicalMoves.js. Shapes, particle laws and choreography are move-owned.
export default function quickAttack(context) {
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

  
  const target = { x: (focus.x), y: (focus.y + 8) }
function anchorPose(name, rotation, point = target) {
    return solveContact(name, rotation, point)
  }

function followAnchor(object, name) {
    object.position.copyFrom(socket(name, true)); object.rotation=attacker.rotation
  }

function afterimage(tl, at, tint, alpha = 0.22, duration = 0.2) {
    const ghost = captureActor()
    ghost.label = 'physical-afterimage'
    ghost.anchor.copyFrom(attacker.anchor)
    ghost.tint = tint
    ghost.alpha = 0
    temporary.addChild(ghost)
    tl.call(() => {
      ghost.position.copyFrom(attacker.position)
      ghost.scale.copyFrom(attacker.scale)
      ghost.rotation = attacker.rotation
      ghost.alpha = alpha
    }, [], at)
      .to(ghost, { alpha: 0, duration, ease: 'power1.out' }, at)
  }

function speedTrail(tl, at, duration, length, tint, socketName = 'trail') {
    const trail = new Graphics()
    trail.label = 'physical-speed-trail'
    for (let i = 0; i < 5; i++) {
      const y = (i - 2) * 12
      const span = length * (1 - Math.abs(i - 2) * 0.17)
      trail.moveTo(-span, y + 5).quadraticCurveTo(-span * 0.4, y, -12, y)
        .stroke({ width: i === 2 ? 4 : 2, color: tint, alpha: i === 2 ? 0.9 : 0.55, cap: 'round' })
    }
    trail.alpha = 0
    temporary.addChild(trail)
    followAnchor(trail, socketName)
    tl.to(trail, { alpha: 1, duration: 0.035 }, at)
      .to({}, { duration, onUpdate: () => followAnchor(trail, socketName) }, at)
      .to(trail, { alpha: 0, duration: 0.12 }, at + duration - 0.12)
    return trail
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

function quickAttack(tl, move) {
    const contact = 0.3
    const pose = anchorPose('tackle', 0.025)
    tl.to(attacker, { x: home.x - 13, y: home.y + 3, duration: 0.12, ease: 'power1.in' }, 0)
      .to(attacker, { ...pose, duration: 0.18, ease: 'power2.in' }, 0.12)
      .to(attacker, { x: pose.x - 26, y: pose.y + 5, rotation: 0, duration: 0.09, ease: 'power1.out' }, 0.36)
      .to(attacker, { x: home.x, y: home.y, duration: 0.36, ease: 'power2.inOut' }, 0.51)
    speedTrail(tl, 0.12, 0.3, 112, 0xe3f3f8)
    afterimage(tl, 0.19, 0xc8e7f2, 0.2, 0.18)
    afterimage(tl, 0.25, 0xc8e7f2, 0.16, 0.18)
    dust(tl, home.x + 15, home.y - 6, 0.12)
    impact(tl, contact, move.tint, 0.8)
    addHit(tl, move, contact, { recoil: 11, shake: 1.5, duration: 0.45 })
    tl.call(() => {}, [], 1.2)
  }
  quickAttack(tl,move)
}
