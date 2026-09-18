import { createBattleAudio } from '../../../shared/battle/audio.js'
import { technicalSoundPack } from '../../../shared/battle/draftSoundPack.js'

/** Move preview opts into the same user-authorized drafts as solo simulation. */
export function createPreviewAudio({ draftSfxEnabled = import.meta.env?.VITE_PREVIEW_DRAFT_SFX_ENABLED !== 'false', ...options } = {}) {
  return createBattleAudio({ ...options, technicalSoundPack: draftSfxEnabled ? technicalSoundPack : null })
}
