import { STARTER_SPRITES } from './spriteViews.js'

// Visible-art sockets and optional registration pivot belong to the host's artwork profiles.
export const SPRITE_PROFILES = {
  ...Object.fromEntries(Object.entries(STARTER_SPRITES).map(([id, views]) => [id, views.front])),
  charizard: { url: '/assets/charizard-back.png', nativeFacing: 1, bounds: { x: 4, y: 4, width: 84, height: 83 },
    anchors: { vine: [(44+84*96/265)/84,(92-91*96/265)/83], aura: [44/84,(92-110*96/265)/83], smoke: [(44+15*96/265)/84,(92-120*96/265)/83], vent: [(44+35*96/265)/84,(92-115*96/265)/83], leaf: [(44+85*96/265)/84,(92-120*96/265)/83], fissure: [(44+74*96/265)/84,(92-34*96/265)/83], emission: [79/84,45/83], hand: [70/84,63/83], foot: [70/84,80/83], body: [68/84,65/83], tackle: [68/84,65/83], slam: [52/84,57/83], trail: [52/84,63/83], center: [.55,.6], origin: [44/84,92/83], floor: [44/84,92/83] } },
  venusaur: { url: '/assets/venusaur-front.png', nativeFacing: -1, bounds: { x: 8, y: 12, width: 79, height: 69 },
    anchors: { vine: [.2,.72], tackle: [.35,.78], slam: [.35,.65], trail: [.65,.72], emission: [.13,.72], hand: [.2,.86], foot: [.25,.96], body: [.35,.78], center: [(40-17*96/235)/79,(84-74*96/235)/69], origin: [40/79,84/69], floor: [40/79,84/69] } },
  squirtle: { url: '/assets/squirtle-front.png', nativeFacing: -1, bounds: { x: 29, y: 29, width: 38, height: 39 },
    anchors: { emission: [.289,.410], hand: [.079,.462], body: [.368,.692], tackle: [.368,.692], eyes: [.342,.231] } },
  tall: { bounds: { x: 0, y: 0, width: 55, height: 130 } },
  wide: { bounds: { x: 0, y: 0, width: 150, height: 70 }, shape: 'wide' },
}

/** Select artwork by field view, never by which actor is currently using a move. */
export function resolveSpriteProfile({ profile, view } = {}) {
  const original = SPRITE_PROFILES[profile] ?? SPRITE_PROFILES.tall
  const selected = STARTER_SPRITES[profile]?.[view]
  if (!selected) return original
  // Retain the approved sockets for artwork already used in the original animations.
  if (selected.url === original.url) return { ...selected, anchors: { ...selected.anchors, ...original.anchors } }
  return selected
}
