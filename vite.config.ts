import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset paths so the build works at any GitHub Pages subpath
  // (https://<user>.github.io/<repo>/) without hardcoding the repo name.
  base: './',
  plugins: [react()],
  build: {
    // Two pages, two entries. Each ships only its own data chunk, and the loot
    // page gets a real URL (`/p3-loot-prio/`) that GitHub Pages can serve as a
    // file — no router and no SPA fallback needed.
    // Paths are relative to Vite's `root`, not absolute: the usual
    // `resolve(__dirname, …)` spelling would need `@types/node`, which this
    // project deliberately does not carry.
    rollupOptions: {
      input: {
        main: 'index.html',
        lootPrio: 'p3-loot-prio/index.html',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
