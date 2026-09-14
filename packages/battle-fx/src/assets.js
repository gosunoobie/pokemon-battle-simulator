import { Assets } from 'pixi.js'
const urls = {
  leaf: new URL('../assets/leaf.svg', import.meta.url).href,
  rock: new URL('../assets/rock.svg', import.meta.url).href,
  surf: new URL('../assets/surf-tidal-wave.png', import.meta.url).href,
  waterfall: new URL('../assets/waterfall-flow.png', import.meta.url).href,
}
const needed = { 'razor-leaf': ['leaf'], earthquake: ['rock'], 'rock-slide': ['rock'], surf: ['surf'], 'muddy-water': ['surf'], waterfall: ['waterfall'] }
export async function loadMoveAssets(moveId, resolver = key => Assets.load(urls[key])) {
  return Object.fromEntries(await Promise.all((needed[moveId] ?? []).map(async key => {
    const texture = await resolver(key, urls[key])
    texture.source.scaleMode = key === 'waterfall' ? 'linear' : 'nearest'
    return [key, texture]
  })))
}
