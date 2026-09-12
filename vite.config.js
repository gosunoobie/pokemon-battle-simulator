import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({ plugins: [vue()], build: { rollupOptions: { input: { game: 'index.html', playground: 'playground.html' } } } })
