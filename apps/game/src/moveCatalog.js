import { MOVE_RULES } from '@battle/battle-core'
import { MOVE_DETAILS } from './moveDetails.js'
export const MOVES = MOVE_RULES.map(rule => ({ ...rule, ...MOVE_DETAILS.find(detail => detail.id === rule.id) }))
