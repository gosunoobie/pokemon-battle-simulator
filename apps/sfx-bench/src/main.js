import { createApp } from 'vue'
import Bench from './Bench.vue'
import './style.css'
if (import.meta.env.DEV) {
  const component = new URLSearchParams(window.location.search).get('collection') === 'remaining'
    ? (await import('./CollectionBench.vue')).default
    : Bench
  createApp(component).mount('#app')
}
// An authoring record must not keep old visual hashes across a hot-swapped FX
// module. pagehide preserves valid drafts; a reload obtains the fresh manifest.
if (import.meta.hot) import.meta.hot.on('vite:beforeUpdate', () => window.location.reload())
