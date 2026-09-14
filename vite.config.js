import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({ plugins: [vue()], build: {
  // Sprite URLs stay small; selecting two actors loads only their two PNGs.
  assetsInlineLimit: file => file.includes('/packages/pokemon-sprites/assets/') ? false : undefined,
  rollupOptions: { input: { game: 'index.html', playground: 'playground.html' } },
} })
