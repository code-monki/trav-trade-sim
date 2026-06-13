import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // Base path matches the GitHub Pages repo subdirectory.
  // Change to '/' if serving from a custom domain root.
  base: '/trav-trade-sim/',
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['tests/components/**', 'happy-dom'],
    ],
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.js'],
      reporter: ['text', 'html'],
    },
  },
})
