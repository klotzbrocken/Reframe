import { defineConfig } from 'vitest/config'

// Unit tests cover the pure helpers (URL normalization, wayback, theme
// sanitizing). They have no DOM/Electron deps, so a plain node environment.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
