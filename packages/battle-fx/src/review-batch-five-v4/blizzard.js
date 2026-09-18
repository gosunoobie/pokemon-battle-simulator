import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import { bindEffectSpace } from '../effect-space.js'

// Fourth review of Blizzard: smaller upright ice fades in at its attachment, grows, then clears on the existing beat.
export const timing = Object.freeze({ contact: .82, duration: 2.85, markers: Object.freeze([
  { id: 'late-crystal-1', label: 'Cosmetic first large crystal impact', timeSeconds: 1.5165 },
  { id: 'late-crystal-2', label: 'Cosmetic large crystal crest', timeSeconds: 1.929 },
  { id: 'late-crystal-3', label: 'Cosmetic third large crystal impact', timeSeconds: 2.004 },
  { id: 'late-crystal-4', label: 'Cosmetic fourth large crystal impact', timeSeconds: 2.079 },
  { id: 'late-crystal-5', label: 'Cosmetic fifth large crystal impact', timeSeconds: 2.154 },
  { id: 'late-crystal-6', label: 'Cosmetic sixth large crystal impact', timeSeconds: 2.229 },
  { id: 'late-crystal-7', label: 'Cosmetic final large crystal impact', timeSeconds: 2.304 },
]) })

export default function blizzard(context) {
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

  

function glow(x, y, width, height, tint = 0xb6edff) {
    const sprite = new Sprite(glowTexture)
    sprite.anchor.set(0.5)
    sprite.position.set(x, y)
    sprite.width = width
    sprite.height = height
    sprite.tint = tint
    sprite.alpha = 0
    sprite.blendMode = 'add'
    temporary.addChild(sprite)
    return sprite
  }

function crystal(width, height, tint = 0xace9ff) {
    return new Graphics().poly([0, -height / 2, width / 2, 0, 0, height / 2, -width / 2, 0])
      .fill({ color: tint, alpha: 0.8 }).stroke({ color: 0xeffcff, width: 1.2, alpha: 0.9 })
  }

function shards(tl, x, y, at, count = 18, spread = 100) {
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count
      const distance = spread * (0.55 + (i % 4) * 0.15)
      const duration = 0.5 + (i % 4) * 0.06
      const shard = crystal(7 + (i % 3) * 3, 19 + (i % 4) * 5)
      const state = { progress: 0 }
      shard.position.set(x, y)
      shard.rotation = angle
      shard.alpha = 0
      temporary.addChild(shard)
      tl.to(shard, { alpha: 0.9, duration: 0.05 }, at)
        .to(state, { progress: 1, duration, ease: 'none', onUpdate: () => {
          const p = state.progress
          shard.position.set(x + Math.cos(angle) * distance * p, y + Math.sin(angle) * distance * p + 55 * p * p)
          shard.rotation = angle + (i % 2 ? -2 : 2) * p
        } }, at)
        .to(shard, { alpha: 0, duration: 0.22 }, at + duration - 0.22)
    }
  }

function blizzard(tl, move) {
    const mist = glow((focus.x - 55), (focus.y - 25), 400, 210, 0xb6e6ff)
    mist.blendMode = 'normal'
    tl.to(attacker, { x: home.x - 12, duration: 0.24 }, 0)
      .to(attacker, { x: home.x + 8, duration: 0.2 }, 0.24)
      .to(mist, { alpha: 0.18, duration: 0.3 }, 0.44)
      .to(mist, { alpha: 0, duration: 0.5 }, 2.27)
      .to(attacker, { x: home.x, duration: 0.3 }, 2.35)
    for (let i = 0; i < 3; i++) {
      const wind = new Graphics()
      for (const [width, alpha] of [[15, 0.08], [3, 0.45]]) {
        wind.moveTo(0, 0).bezierCurveTo(180, -70, 380, 75, 560, -20)
          .stroke({ width, color: 0xc8f2ff, alpha, cap: 'round' })
      }
      wind.position.set((home.x + 48), (focus.y - 82) + i * 55)
      wind.alpha = 0
      wind.scale.x = 0.1
      temporary.addChild(wind)
      const at = 0.3 + i * 0.14
      tl.to(wind, { alpha: 0.7, duration: 0.16 }, at)
        .to(wind.scale, { x: 1, duration: 0.46, ease: 'power1.out' }, at)
        .to(wind, { alpha: 0, x: (home.x + (focus.x - home.x) * 0.23640167364), duration: 0.5 }, at + 0.55)
    }
    for (let i = 0; i < 72; i++) {
      const at = 0.36 + i * 0.014
      const duration = 0.62 + (i % 4) * 0.045
      const x = home.x + 78 - (i % 4) * 44
      const y = focus.y - 145 + (i * 43) % 175
      const snow = i % 3 === 0 ? crystal(6, 15, 0xc7f2ff)
        : new Graphics().circle(0, 0, 2 + (i % 3)).fill(0xf0fbff)
      const state = { progress: 0 }
      snow.position.set(x, y)
      snow.alpha = 0
      temporary.addChild(snow)
      tl.to(snow, { alpha: 0.75, duration: 0.06 }, at)
        .to(state, { progress: 1, duration, ease: 'none', onUpdate: () => {
          const p = state.progress
          snow.position.set(x + (focus.x - home.x + 132) * p, y + 36 * p + 26 * Math.sin(p * Math.PI * 2 + i) * Math.sin(p * Math.PI))
          snow.rotation = -0.7 + p * 2
        } }, at)
        .to(snow, { alpha: 0, duration: 0.18 }, at + duration - 0.18)
    }
    shards(tl, (focus.x), (focus.y + 5), 0.82, 22, 110)
    tl.to(impactGlow, { alpha: 0.4, duration: 0.2 }, 0.82)
      .to(impactGlow, { alpha: 0, duration: 0.6 }, 1.4)
    addHit(tl, move, 0.82, { recoil: 16, shake: 4, duration: 0.85 })
    tl.call(() => {}, [], 2.85)
  }
  blizzard(tl,move)

  const late = new Container(); late.label = 'blizzard-late-storm'; temporary.addChild(late)
  const continuingSnow = new Graphics(); continuingSnow.label = 'blizzard-continuing-snow'; late.addChild(continuingSnow)
  const continuingWind = new Graphics(); continuingWind.label = 'blizzard-continuing-wind'; late.addChild(continuingWind)
  const localX = x => (x - temporary.x) / temporary.scale.x
  const bounds = { left: Math.min(localX(0), localX(context.scene.width)) + 5,
    right: Math.max(localX(0), localX(context.scene.width)) - 5,
    top: -temporary.y / unit + 5, bottom: (context.scene.height - temporary.y) / unit - 5 }
  const clamp = (x, low, high) => Math.max(low, Math.min(high, x))
  const pointInField = (point, margin = 3) => ({ x: clamp(point.x, bounds.left + margin, bounds.right - margin), y: clamp(point.y, bounds.top + margin, bounds.bottom - margin) })
  const pulses = [1.5165, 1.929, 2.004, 2.079, 2.154, 2.229, 2.304]
  // Positions stay inside the visible body instead of repeating one center lane.
  const bodyAttachments = [[-.23, -.18], [.22, .18], [-.04, -.29], [-.25, .23], [.27, -.04], [.025, .28], [.135, -.19]]
  const crystals = pulses.map((impact, i) => {
    const approach = new Graphics(); approach.label = `blizzard-small-crystal-${i}`; late.addChild(approach)
    const crystal = new Graphics(); crystal.label = `blizzard-large-crystal-${i}`; late.addChild(crystal)
    const flash = new Graphics(); flash.label = `blizzard-late-impact-${i}`; late.addChild(flash)
    const fragments = new Container(); fragments.label = `blizzard-large-shards-${i}`; late.addChild(fragments)
    const shards = Array.from({ length: 8 }, (_, j) => {
      const shard = new Graphics().poly([0, -5, 3.5, 1, -2, 5]).fill({ color: j % 2 ? 0xc2f1ff : 0x89cbe9, alpha: .72 })
        .stroke({ width: 1, color: 0xffffff, alpha: .72 })
      shard.label = `blizzard-large-shard-${i}-${j}`; shard.alpha = 0; fragments.addChild(shard); return shard
    })
    return { approach, crystal, flash, shards, impact, start: Number((impact - .58).toFixed(6)), lodge: Number((impact - .32).toFixed(6)), origin: null, collision: null }
  })
  const fitPolygon = (tip, rotation, polygon) => {
    const c = Math.cos(rotation), s = Math.sin(rotation)
    let scale = 1
    for (let i = 0; i < polygon.length; i += 2) {
      const x = polygon[i] * c - polygon[i + 1] * s, y = polygon[i] * s + polygon[i + 1] * c
      if (x < 0) scale = Math.min(scale, (tip.x - bounds.left - 2) / -x)
      if (x > 0) scale = Math.min(scale, (bounds.right - 2 - tip.x) / x)
      if (y < 0) scale = Math.min(scale, (tip.y - bounds.top - 2) / -y)
      if (y > 0) scale = Math.min(scale, (bounds.bottom - 2 - tip.y) / y)
    }
    return Math.max(0, scale)
  }
  onFrame(time => {
    continuingSnow.clear(); continuingWind.clear()
    const fade = clamp((2.79 - time) / .34, 0, 1), strength = clamp((time - 1.08) / .18, 0, 1) * fade
    if (strength > 0) {
      const origin = pointInField(socket('emission', true), 8), end = pointInField(targetSocket('center', true), 8)
      const verticalRoom = Math.min(115, end.y - bounds.top - 8, bounds.bottom - end.y - 8)
      for (let i = 0; i < 54; i++) {
        const phase = ((time - 1.08) * (1.45 + (i % 3) * .14) + i * .137) % 1
        const point = pointInField({ x: origin.x + (end.x - origin.x + 48) * phase,
          y: end.y + Math.sin(i * 2.4) * verticalRoom * .83 + 14 * Math.sin(phase * Math.PI * 2 + i) + phase * 20 }, 5)
        continuingSnow.circle(point.x, point.y, i % 4 ? 1.7 : 2.6).fill({ color: 0xe5f8ff, alpha: strength * Math.sin(phase * Math.PI) * .72 })
      }
      for (let i = 0; i < 3; i++) {
        const y = end.y + (i - 1) * verticalRoom * .65 + Math.sin(time * 8 + i) * 8
        const a = pointInField({ x: origin.x + 25, y }, 8), b = pointInField({ x: end.x + 40, y: y + Math.sin(time * 9 + i) * 18 }, 8)
        continuingWind.moveTo(a.x, a.y).bezierCurveTo(a.x + (b.x - a.x) * .33, a.y - 8, a.x + (b.x - a.x) * .68, b.y + 8, b.x, b.y)
          .stroke({ width: 2, color: 0xc8f2ff, alpha: strength * .22, cap: 'round' })
      }
    }
    crystals.forEach((entry, i) => {
      const { approach, crystal, flash, shards, start, lodge, impact } = entry
      approach.clear(); crystal.clear(); flash.clear(); approach.alpha = 0; crystal.alpha = 0; flash.alpha = 0
      if (time >= start && !entry.origin) entry.origin = pointInField(socket('emission', true), 8)
      const live = targetSocket('visualCenter', true), [horizontal, vertical] = bodyAttachments[i]
      const destination = pointInField({ x: live.x + horizontal * context.target.metrics.width / unit,
        y: live.y + vertical * context.target.metrics.height / unit }, 8)
      if (time >= start && time < impact) {
        const p = clamp((time - start) / (lodge - start), 0, 1), origin = entry.origin
        const tip = pointInField({ x: origin.x + (destination.x - origin.x) * p,
          y: origin.y + (destination.y - origin.y) * p + Math.sin(p * Math.PI) * (i % 2 ? 18 : -18) }, 8)
        const flightRotation = Math.atan2(destination.y - origin.y, destination.x - origin.x)
        // The incoming snow crystal remains the same small flying artwork.
        // It hands off at its tip while the upright lodged ice fades in.
        const small = [0, 0, -10.8, -5.5, -20, 0, -10.8, 5.5]
        approach.position.copyFrom(tip); approach.rotation = flightRotation
        approach.scale.set(fitPolygon(tip, flightRotation, small))
        approach.poly(small).fill({ color: i % 2 ? 0xb4eaff : 0x99d6ee, alpha: .66 })
          .stroke({ width: 1.7, color: 0xf3fdff, alpha: .94, join: 'round' })
          .moveTo(0, 0).lineTo(-20, 0).moveTo(-10.8, -5.5).lineTo(-10.8, 5.5)
          .stroke({ width: 1.1, color: 0xffffff, alpha: .65 })
        approach.alpha = Math.min(1, (time - start) / .035) * clamp((lodge + .045 - time) / .045, 0, 1)
        if (time >= lodge) {
          const growthTime = clamp((time - lodge) / .24, 0, 1)
          const growth = growthTime * growthTime * (3 - 2 * growthTime)
          const growthScale = .2 + .8 * growth
          const length = (i === 0 ? 64 : 78 + (i % 3) * 8) * .5, width = (i === 0 ? 17 : 23) * .5
          const polygon = [0, 0, -length * .54, -width, -length, 0, -length * .54, width]
          // Half of the preceding final artwork, including its strokes. Scale
          // the complete shape from 20% so its very first visible pose is upright.
          const rotation = Math.PI / 2, size = fitPolygon(destination, rotation, polygon)
          crystal.position.copyFrom(destination); crystal.rotation = rotation; crystal.scale.set(size * growthScale)
          crystal.poly(polygon).fill({ color: i % 2 ? 0xb4eaff : 0x99d6ee, alpha: .66 - growth * .18 })
            .stroke({ width: .85, color: 0xf3fdff, alpha: .94, join: 'round' })
            .moveTo(0, 0).lineTo(-length, 0).moveTo(-length * .54, -width).lineTo(-length * .54, width)
            .stroke({ width: .55, color: 0xffffff, alpha: .65 })
          crystal.alpha = clamp((time - lodge) / .045, 0, 1) * clamp((impact - time) / .08, 0, 1)
        }
      }
      if (time >= impact && !entry.collision) entry.collision = destination
      const age = time - impact, life = .43
      if (age >= 0 && age < life) {
        const center = entry.collision, room = Math.max(1, Math.min(54, center.x - bounds.left - 3, bounds.right - center.x - 3, center.y - bounds.top - 3, bounds.bottom - center.y - 3))
        flash.position.copyFrom(center); flash.alpha = 1
        flash.circle(0, 0, room * (.15 + .8 * Math.min(1, age / .2))).stroke({ width: 2, color: 0xcaf3ff, alpha: Math.pow(1 - age / life, 2) * .78 })
          .circle(0, 0, Math.max(1, room * .14)).fill({ color: 0xf6feff, alpha: Math.exp(-age * 20) * .66 })
      }
      shards.forEach((shard, j) => {
        shard.alpha = 0
        if (age < 0 || age >= life) return
        const center = entry.collision, angle = j * Math.PI * 2 / shards.length, speed = 80 + (j % 3) * 25
        const point = pointInField({ x: center.x + Math.cos(angle) * speed * age,
          y: center.y + Math.sin(angle) * speed * age * .65 + 135 * age * age }, 7)
        shard.position.copyFrom(point); shard.rotation = angle + age * (j % 2 ? 3 : -3)
        shard.alpha = .82 * Math.min(1, age / .025) * Math.pow(1 - age / life, .8)
      })
    })
  })

}
