import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset paths so the build works at any GitHub Pages subpath
  // (https://<user>.github.io/<repo>/) without hardcoding the repo name.
  base: './',
  plugins: [react()],
  build: {
    // Three pages, three entries: a landing dispatcher at the site root, and
    // two real services each at their own URL (`/Recipes/`, `/p3-loot-prio/`)
    // that GitHub Pages can serve as files — no router and no SPA fallback
    // needed. Each ships only its own data chunk.
    // Paths are relative to Vite's `root`, not absolute: the usual
    // `resolve(__dirname, …)` spelling would need `@types/node`, which this
    // project deliberately does not carry.
    rollupOptions: {
      input: {
        main: 'index.html',
        recipes: 'Recipes/index.html',
        lootPrio: 'p3-loot-prio/index.html',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/shared/test/setup.ts'],
  },
})
