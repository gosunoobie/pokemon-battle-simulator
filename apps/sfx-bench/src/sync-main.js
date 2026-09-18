import { createApp } from 'vue'
import SyncBench from './SyncBench.vue'
import './style.css'
import './sync.css'

if (import.meta.env.DEV) {
  document.title = 'Sound + animation review · Battle Lab'
  createApp(SyncBench).mount('#app')
}
if (import.meta.hot) import.meta.hot.on('vite:beforeUpdate', () => window.location.reload())
