import { ColorMatrixFilter, Container, Graphics, NoiseFilter, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../../effect-space.js'

// The user requested Surf’s exact choreography with muddy water colors and texture.
// Keep this move-owned copy in step with the approved Surf motion.
export default function muddyWater(context) {
  const { tl, assets, glowTexture, random, onCue, onFrame } = context
  const { temporary, attacker, defender, home, defenderHome, focus, floor, emission, socket, targetSocket, solveContact, captureActor, world, gridOrigin } = bindEffectSpace(context)
  const sourceBaseScale=1, targetBaseScale=1, move={tint:context.tint}
  const impactGlow=new Sprite(glowTexture);impactGlow.label='muddy-water-impact-glow';impactGlow.anchor.set(.5);impactGlow.position.set(focus.x-10,focus.y);impactGlow.tint=move.tint;impactGlow.blendMode='add';impactGlow.width=330;impactGlow.height=240;impactGlow.alpha=0;temporary.addChild(impactGlow)
  const mouthGlow=new Sprite(glowTexture);mouthGlow.anchor.set(.5);mouthGlow.position.copyFrom(emission);mouthGlow.tint=0xff6c1d;mouthGlow.blendMode='add';mouthGlow.width=mouthGlow.height=150;mouthGlow.alpha=0;temporary.addChild(mouthGlow)
  onFrame(() => mouthGlow.position.copyFrom(socket('emission', true)))
  const emitter={strength:0};let spawnCarry=0

  function addHit(tl, move, at, { shake = 3, recoil = 13, beforeCue = () => {} } = {}) {
    tl.to(defender,{x:defenderHome.x+recoil,duration:.06,repeat:7,yoyo:true,ease:'none'},at)
      .to(world,{x:shake,y:-shake/2,duration:.06,repeat:7,yoyo:true,ease:'none'},at)
      .call(()=>{beforeCue();onCue({type:'impact'});defender.tint=move.tint},[],at)
      .call(()=>{defender.tint=0xffffff},[],at+.24)
      .set(defender,{x:defenderHome.x},at+.5).set(world,{x:0,y:0},at+.5)
  }

  
  const mouth = lean => ({ x: home.x + lean + emission.x, y: home.y + emission.y })

function muddyWater(tl, move) {
    // Load the artwork once with the scene; both crests share it through cleanup/replay.
    assets.surf.source.scaleMode = 'nearest'
    const waveScale = 0.6
    // Keep the approved wash/spray size; only the two crests are 12% smaller.
    const crestScale = waveScale * 0.88
    const target = { x: (focus.x), y: (focus.y) }
    const crestY = y => target.y + (y - target.y) * crestScale
    const scaleY = y => target.y + (y - target.y) * waveScale
    const washTop = target.y + (floor.y + .4 - target.y) / waveScale
    const wash = new Graphics()
    wash.alpha = 0
    // Scale the wash around contact so it remains beneath the smaller crests.
    wash.scale.set(waveScale)
    wash.position.set(target.x * (1 - waveScale), target.y * (1 - waveScale))
    temporary.addChild(wash)
    const sourceFloor=socket('floor'),descent=Math.max(0,floor.y-sourceFloor.y)
    const routeY=x=>-descent*(1-Math.max(0,Math.min(1,(x-sourceFloor.x)/Math.max(1,focus.x-sourceFloor.x))))
    const washSlope=x=>routeY(wash.x+x*waveScale)/waveScale
    const flow = { reach: 0, phase: 0 }
    const snap = value => Math.round((value + gridOrigin.x) / 3) * 3 - gridOrigin.x
    const snapY = value => Math.round((value + gridOrigin.y) / 3) * 3 - gridOrigin.y
    const drawWash = () => {
      wash.clear()
      const end = snap(home.x - 102 + (focus.x - home.x + 372) * flow.reach)
      for (let row = 0; row < 5; row++) {
        const start = home.x - 132 + row * 18
        wash.poly([start,washTop+row*9+washSlope(start),Math.max(start,end),washTop+row*9+washSlope(Math.max(start,end)),Math.max(start,end),washTop+row*9+9+washSlope(Math.max(start,end)),start,washTop+row*9+9+washSlope(start)])
          .fill({ color: [0xbc9d64, 0x9f7d48, 0x826139, 0x654727, 0x49331e][row], alpha: 0.75 })
      }
      for (let i = 0; i < 30; i++) {
        const x = snap(home.x - 117 + (i * 43 + flow.phase) % (focus.x - home.x + 372))
        if (x + 24 > end) continue
        const y = washTop + i % 4 * 9 + washSlope(x)
        wash.rect(x, y, 12 + i % 3 * 6, 3).fill({ color: i % 3 ? 0xd4bb88 : 0xeee0b4, alpha: 0.8 })
      }
    }
    const makeWave = (width, height, x, y, tint) => {
      const wave = new Sprite(assets.surf)
      wave.anchor.set(1, 1)
      wave.width = width * crestScale
      wave.height = height * crestScale
      wave.position.set(x, crestY(y))
      wave.tint = tint
      const mud = new ColorMatrixFilter()
      // Luminance preserves the original ridges/foam, mapped to silt and warm brown.
      mud.matrix = [
        .166, .558, .056, 0, .10,
        .149, .500, .051, 0, .06,
        .108, .365, .037, 0, .02,
        0, 0, 0, 1, 0,
      ]
      const silt = new NoiseFilter({ noise: .10, seed: .42 })
      wave.filters = [mud, silt]
      // Filters are run-owned; the cached Surf texture and shader programs are shared.
      wave.once('destroyed', () => { mud.destroy(); silt.destroy() })
      wave.alpha = 0
      wave.roundPixels = true
      temporary.addChild(wave)
      return wave
    }
    const following = makeWave(560, 180, home.x - 162, target.y + 170, 0x83c7ef)
    const leading = makeWave(720, 240, home.x - 12, target.y + 158, 0xffffff)

    leading.label='muddy-water-leading';following.label='muddy-water-following';wash.label='muddy-water-wash'
    const followGround=()=>{
      leading.y=crestY(target.y+158)+routeY(leading.x-.045*leading.width)
      following.y=crestY(target.y+170)+routeY(following.x-.045*following.width)
    }
    onFrame(followGround);followGround()

    function foamSpray(at, count, x, y, spread) {
      x = target.x + (x - target.x) * waveScale
      y = scaleY(y)
      spread *= waveScale
      for (let i = 0; i < count; i++) {
        const size = 3 + i % 3 * 3
        const foam = new Graphics().rect(0, 0, size * 2, size)
          .fill({ color: [0xebdcb3, 0xcab37d, 0xa0824f][i % 3] })
        if (i % 2 === 0) foam.rect(size, -size, size, size).fill({ color: 0xebdcb3 })
        foam.label = `muddy-water-foam-${at.toFixed(2)}-${i}`
        foam.alpha = 0
        foam.scale.set(waveScale)
        foam.position.set(x, y)
        temporary.addChild(foam)
        const progress = { p: 0 }
        const launch = at + (i % 5) * 0.012
        const duration = 0.52 + (i % 4) * 0.07
        const dx = spread * (0.25 + (i % 7) * 0.13)
        const lift = (48 + (i % 6) * 17) * waveScale
        tl.set(foam, { alpha: 0.95 }, launch)
          .to(progress, { p: 1, duration, ease: 'none', onUpdate: () => {
            const p = progress.p
            foam.position.set(snap(x + dx * p), snapY(y - 4 * lift * p * (1 - p) + 110 * waveScale * p * p))
          } }, launch)
          .to(foam, { alpha: 0, duration: 0.2 }, launch + duration - 0.2)
      }
    }

    tl.to(attacker, { x: home.x - 12, duration: 0.22 }, 0)
      .to(attacker, { x: home.x + 5, duration: 0.2 }, 0.22)
      .to(attacker, { x: home.x, duration: 0.35 }, 2)
      .to(wash, { alpha: 0.8, duration: 0.25 }, 0.16)
      .to(flow, { reach: 1, duration: 1.3, ease: 'power1.out', onUpdate: drawWash }, 0.16)
      .to(flow, { phase: 540, duration: 2.4, ease: 'none', onUpdate: drawWash }, 0.16)
      .to(wash, { alpha: 0, duration: 0.5 }, 2.35)
      .to(leading, { alpha: 1, duration: 0.2 }, 0.20)
      .to(leading, { height: 360 * crestScale, duration: 0.48, ease: 'power2.out' }, 0.20)
      // The sprite's forward foam lip is at normalized (0.955, 0.56).
      // The authored lip meets the dynamic target before the cosmetic impact cue.
      .to(leading, { x: target.x + 0.045 * 720 * crestScale, duration: 0.80, ease: 'power1.in' }, 0.20)
      .to(leading, { x: (focus.x + 500), duration: 0.88, ease: 'none' }, 1.00)
      .to(leading, { height: 110 * crestScale, duration: 0.74, ease: 'power1.in' }, 1.32)
      .to(leading, { alpha: 0, duration: 0.4 }, 1.96)
      .to(following, { alpha: 0.88, duration: 0.25 }, 0.32)
      .to(following, { height: 280 * crestScale, duration: 0.55, ease: 'power2.out' }, 0.32)
      .to(following, { x: (focus.x + 40), duration: 1.00, ease: 'power1.in' }, 0.32)
      .to(following, { x: (focus.x + 460), duration: 0.72, ease: 'none' }, 1.32)
      .to(following, { height: 70 * crestScale, duration: 0.65, ease: 'power1.in' }, 1.48)
      .to(following, { alpha: 0, duration: 0.35 }, 2.08)
      .to(impactGlow, { alpha: 0.22, duration: 0.12 }, 1.00)
      .to(impactGlow, { alpha: 0, duration: 0.4 }, 1.46)
    foamSpray(1.00, 28, target.x, target.y, 150)
    foamSpray(1.28, 22, target.x + 55, target.y + 46, 120)
    foamSpray(1.60, 18, target.x + 30, target.y + 77, 130)
    addHit(tl, move, 1.00, { recoil: 18, shake: 4, beforeCue: followGround })
    tl.call(() => {}, [], 3.2)
  }
  muddyWater(tl,move)
}
