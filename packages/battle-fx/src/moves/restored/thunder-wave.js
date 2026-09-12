import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// Restored from the pre-migration electricMoves.js. Shapes, particle laws and choreography are move-owned.
export default function thunderWave(context) {
  const { tl, assets, glowTexture, random, onCue, onFrame } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, emission, socket, targetSocket, solveContact, captureActor, world, unit } = bindEffectSpace(context)
  const sourceBaseScale=1, targetBaseScale=1, move={tint:context.tint}
  const impactGlow=new Sprite(glowTexture);impactGlow.anchor.set(.5);impactGlow.position.set(focus.x-10,focus.y);impactGlow.tint=move.tint;impactGlow.blendMode='add';impactGlow.width=330;impactGlow.height=240;impactGlow.alpha=0;temporary.addChild(impactGlow)
  const mouthGlow=new Sprite(glowTexture);mouthGlow.anchor.set(.5);mouthGlow.position.copyFrom(emission);mouthGlow.tint=0xff6c1d;mouthGlow.blendMode='add';mouthGlow.width=mouthGlow.height=150;mouthGlow.alpha=0;temporary.addChild(mouthGlow)
  onFrame(() => mouthGlow.position.copyFrom(socket('emission', true)))
  const emitter={strength:0};let spawnCarry=0

  
  function addCondition(tl, move, at) {
    tl.call(()=>{onCue({type:'impact'});defender.tint=move.tint},[],at)
      .call(()=>{defender.tint=0xffffff},[],at+.24)
  }

  

function strike(tl, points, { at, travel = 0.1, hold = 0.1, fade = 0.25, width = 3 }) {
    const line = new Graphics()
    line.alpha = 0
    temporary.addChild(line)
    const state = { progress: 0 }
    const draw = () => {
      line.clear()
      const limit = state.progress * (points.length - 1)
      if (limit <= 0) return
      const whole = Math.floor(limit)
      for (const [thickness, color, alpha] of [[width * 5, 0xffc533, 0.15], [width * 2, 0xffdb67, 0.8], [width, 0xffffdc, 1]]) {
        line.moveTo(...points[0])
        for (let i = 1; i <= whole; i++) line.lineTo(...points[i])
        if (whole < points.length - 1) {
          const a = points[whole]
          const b = points[whole + 1]
          const p = limit - whole
          line.lineTo(a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p)
        }
        line.stroke({ width: thickness, color, alpha, cap: 'round', join: 'round' })
      }
    }
    tl.set(line, { alpha: 0.9 }, at)
      .to(state, { progress: 1, duration: travel, ease: 'none', onUpdate: draw }, at)
      .to(line, { alpha: 0, duration: fade }, at + travel + hold)
    return line
  }

function targetArcs(tl, at, width = 2.5, hold = 0.12) {
    const paths = [
      [[focus.x - 67, focus.y - 36], [focus.x - 81, focus.y - 19], [focus.x - 56, focus.y - 13], [focus.x - 71, focus.y + 9]],
      [[focus.x + 56, focus.y - 48], [focus.x + 72, focus.y - 29], [focus.x + 50, focus.y - 13], [focus.x + 65, focus.y + 2]],
      [[focus.x - 48, focus.y + 37], [focus.x - 29, floor.y - 22], [focus.x - 10, focus.y + 37], [focus.x + 9, floor.y - 21]],
    ]
    paths.forEach((points, i) => strike(tl, points, { at: at + i * 0.04, travel: 0.06, hold, fade: 0.32, width }))
  }
function thunderWave(tl, move) {
    const source = { x: home.x + emission.x, y: home.y + emission.y }
    tl.to(attacker, { x: home.x - 6, duration: 0.18 }, 0)
      .to(attacker, { x: home.x, duration: 0.14 }, 0.18)
    for (let i = 0; i < 3; i++) {
      const ring = new Graphics().ellipse(0, 0, 16, 56)
        .stroke({ color: 0xffdc75, width: 3, alpha: 0.85 })
      ring.position.set(source.x, source.y)
      ring.scale.set(0.35)
      ring.alpha = 0
      temporary.addChild(ring)
      const at = 0.24 + i * 0.1
      tl.to(ring, { alpha: 0.75, duration: 0.08 }, at)
        .to(ring, { x: (focus.x - 2), y: (focus.y - 2), duration: 0.52, ease: 'power1.inOut' }, at)
        .to(ring.scale, { x: 1.2, y: 1.2, duration: 0.52 }, at)
        .to(ring, { alpha: 0, duration: 0.2 }, at + 0.52)
    }
    targetArcs(tl, 0.76, 2, 0.38)
    tl.to(impactGlow, { alpha: 0.22, duration: 0.16 }, 0.76)
      .to(impactGlow, { alpha: 0, duration: 0.4 }, 1.18)
    addCondition(tl, move, 0.76)
    tl.call(() => {}, [], 1.85)
  }
  thunderWave(tl,move)
}
