import views from '../data/views.json' with { type: 'json' }
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}
export const SPRITE_VIEWS = freeze(views)
export { SPRITE_URLS } from './urls.generated.js'
