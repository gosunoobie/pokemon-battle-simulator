import { resolveSpriteProfile } from './profiles.js'
import { ROSTER } from '../roster/index.js'

// Original 96px artwork was drawn at 265px near / 235px far on a 1000×450 field.
// Preserve that pixel-art scale, raising only sprites below a readable visible height.
export const ORIGINAL_SPRITE_SCALE = Object.freeze({ near: 265 / 96, far: 235 / 96 })
export const MIN_SPRITE_HEIGHT = Object.freeze({ near: 150, far: 125 })
export const PREVIEW_POKEMON = ROSTER

// Native artwork proportions, transparent padding excluded, and no species multipliers.
// Optional scale is a playground control; the minimum still keeps small actors readable.
export function previewSpriteHeight(profile, { scale = 1, far = false, view = far ? 'front' : 'back', width = 1000, height = 450 } = {}) {
  const { bounds } = resolveSpriteProfile({ profile, view })
  const side = far ? 'far' : 'near'
  const artHeight = Math.max(MIN_SPRITE_HEIGHT[side], bounds.height * ORIGINAL_SPRITE_SCALE[side] * scale)
  return artHeight * Math.min(width / 1000, height / 450) / height
}

export function previewSceneActors(near = 'charizard', far = 'venusaur') {
  return [
    { id: 'source', profile: near, view: 'back', x: .246479166666667, y: .769236111111111, height: previewSpriteHeight(near), facing: 1 },
    { id: 'target', profile: far, view: 'front', x: .745776041666667, y: .593958333333333, height: previewSpriteHeight(far, { far: true }), facing: -1 },
  ]
}
export function previewBattleActors(near = 'charizard', far = 'venusaur') {
  return [{ id: 'source', name: PREVIEW_POKEMON[near].name, level: 50, hp: 156, maxHp: 156 },
    { id: 'target', name: PREVIEW_POKEMON[far].name, level: 50, hp: 160, maxHp: 160 }]
}
