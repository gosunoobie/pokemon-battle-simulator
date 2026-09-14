import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { simulationPlugin } from './apps/server/simulation.js'
export default defineConfig({ plugins: [vue(), simulationPlugin()], build: {
  // Sprite URLs stay small; selecting two actors loads only their two PNGs.
  assetsInlineLimit: file => file.includes('/packages/pokemon-sprites/assets/') ? false : undefined,
  rollupOptions: { input: { home: 'index.html', preview: 'preview.html', playground: 'playground.html', simulation: 'simulation.html' } },
} })
