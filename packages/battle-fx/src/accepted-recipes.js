import fireBlast, { timing as fireTiming } from './review-batch-five-v3/fire-blast.js'
import solarBeam, { timing as solarTiming } from './review-batch-five/solar-beam.js'
import sludgeBomb, { timing as sludgeTiming } from './review-batch-five-v2/sludge-bomb.js'
import overheat, { timing as overheatTiming } from './review-batch-five-v2/overheat.js'
import eruption, { timing as eruptionTiming } from './review-batch-five-v4/eruption.js'
import earthquake, { timing as earthquakeTiming } from './review-batch-five-v3/earthquake.js'
import thunder, { timing as thunderTiming } from './review-batch-five-v3/thunder.js'
import blizzard, { timing as blizzardTiming } from './review-batch-five-v4/blizzard.js'
import bubbleBeam, { timing as bubbleTiming } from './review-batch-five-v2/bubble-beam.js'
import leafBlade, { timing as leafTiming } from './review-batch-six-v2/leaf-blade.js'
import triAttack, { timing as triTiming } from './review-batch-six/tri-attack.js'
import meteorMash, { timing as meteorTiming } from './review-batch-six/meteor-mash.js'
import ancientPower, { timing as ancientTiming } from './review-batch-six-v2/ancient-power.js'
import sacredFire, { timing as sacredTiming } from './review-batch-six-v2/sacred-fire.js'
import sing, { timing as singTiming } from './review-batch-seven/sing.js'
import grassWhistle, { timing as grassTiming } from './review-batch-seven/grass-whistle.js'
import attract, { timing as attractTiming } from './review-batch-seven/attract.js'
import morningSun, { timing as sunTiming } from './review-batch-seven/morning-sun.js'
import moonlight, { timing as moonTiming } from './review-batch-seven/moonlight.js'
import confuseRay, { timing as confuseTiming } from './review-batch-seven/confuse-ray.js'

// Production imports the exact frozen, independently authored recipes. Review
// factories, sound plans and authoring history stay outside this package layer.
const recipes = {
  'fire-blast': [fireBlast, fireTiming], 'solar-beam': [solarBeam, solarTiming],
  'sludge-bomb': [sludgeBomb, sludgeTiming], overheat: [overheat, overheatTiming],
  eruption: [eruption, eruptionTiming], earthquake: [earthquake, earthquakeTiming],
  thunder: [thunder, thunderTiming], blizzard: [blizzard, blizzardTiming], 'bubble-beam': [bubbleBeam, bubbleTiming],
  'leaf-blade': [leafBlade, leafTiming], 'tri-attack': [triAttack, triTiming], 'meteor-mash': [meteorMash, meteorTiming],
  'ancient-power': [ancientPower, ancientTiming], 'sacred-fire': [sacredFire, sacredTiming],
  sing: [sing, singTiming], 'grass-whistle': [grassWhistle, grassTiming], attract: [attract, attractTiming],
  'morning-sun': [morningSun, sunTiming], moonlight: [moonlight, moonTiming], 'confuse-ray': [confuseRay, confuseTiming],
}

export function withAcceptedRecipes(effects) {
  return Object.fromEntries(Object.entries(effects).map(([id, original]) => {
    const recipe = recipes[id]
    return [id, recipe ? Object.freeze({ ...original, build: recipe[0], contact: recipe[1].contact, duration: recipe[1].duration }) : original]
  }))
}

// Only this accepted builder requires the extra rendered-rock preload. A custom
// descriptor with its own builder keeps complete control of its asset needs.
export const usesAcceptedRockArtwork = effect => effect?.build === ancientPower
