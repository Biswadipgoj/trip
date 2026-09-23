// Mobile unit tests, run with the repo-root vitest:
//   npx vitest run --config mobile/vitest.config.mts
// Pure logic only (money maths, invite links, store/sync rules) — native
// modules are mocked inside the tests.
import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: here,
  resolve: {
    // The web sources compared in parity tests use '@/…' for the repo's src/.
    alias: { '@': path.resolve(here, '../src') },
  },
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
