// CommonJS format required — Node 20.3 lacks module.register() (added in 20.12)
// which Playwright uses to load ESM configs. .cjs bypasses that path.
const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir:       './e2e',
  fullyParallel: false,
  retries:       0,
  workers:       1,
  reporter:      'html',

  use: {
    // Dev server at this base URL (run `make dev` before `make test-e2e`)
    baseURL: 'http://localhost:5173/trav-trade-sim/',
    trace:   'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use:  { ...devices['Desktop Chrome'] },
    },
  ],

  // Auto-start the dev server when running e2e tests.
  // Set reuseExistingServer: false in CI to always start fresh.
  webServer: {
    command:             'npm run dev',
    url:                 'http://localhost:5173/trav-trade-sim/',
    reuseExistingServer: !process.env.CI,
    timeout:             30_000,
  },
})
