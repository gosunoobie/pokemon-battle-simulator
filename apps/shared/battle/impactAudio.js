import { createEventAudio } from './eventAudio.js'

const eventIds = Object.freeze({ 'super-effective': 'battle.hit.super-effective', resisted: 'battle.hit.resisted' })

/** Plays confirmed host feedback only; this adapter never derives effectiveness. */
export const createImpactAudio = options => createEventAudio({ ...options, eventIds })
