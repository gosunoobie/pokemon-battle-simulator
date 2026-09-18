import { createBattleAudio } from '../../shared/battle/audio.js'
import { technicalSoundPack } from '../../shared/battle/draftSoundPack.js'

/** Solo simulation opts into the user-authorized technical sound pack. */
export function createSimulationAudio({ draftSfxEnabled = import.meta.env?.VITE_SIMULATION_DRAFT_SFX_ENABLED !== 'false', ...options } = {}) {
  return createBattleAudio({ ...options, technicalSoundPack: draftSfxEnabled ? technicalSoundPack : null })
}
