import { getDraftFxSoundPlan, getDraftMoveSoundPlan, getDraftRuntimeSoundAsset } from '@battle/battle-sfx/draft-runtime'

// Opt-in host composition: the default shared audio host never imports drafts.
export const technicalSoundPack = Object.freeze({
  getFxSoundPlan: getDraftFxSoundPlan,
  getMoveSoundPlan: getDraftMoveSoundPlan,
  getSoundAsset: getDraftRuntimeSoundAsset,
})
