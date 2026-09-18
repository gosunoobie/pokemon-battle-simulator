import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { simulationPlugin } from './apps/server/simulation.js'
import { multiplayerPlugin } from './apps/server/rooms/routes.js'
import { resolveHostCapacity } from './apps/server/capacity.js'
import { cleanPageUrlsPlugin, PAGE_ENTRIES } from './apps/server/pageRoutes.js'
import { sfxBenchPlugin } from './tools/audio-import/bench-plugin.mjs'
const capacity = resolveHostCapacity()
export default defineConfig({ plugins: [vue(), sfxBenchPlugin(), cleanPageUrlsPlugin(), simulationPlugin(capacity.serviceOptions), multiplayerPlugin(capacity.multiplayerOptions)], build: {
  // Sprite URLs stay small; selecting two actors loads only their two PNGs.
  assetsInlineLimit: file => file.includes('/packages/pokemon-sprites/assets/') ? false : undefined,
  rollupOptions: { input: PAGE_ENTRIES },
} })
