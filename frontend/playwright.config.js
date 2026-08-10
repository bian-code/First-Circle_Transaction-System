import { defineConfig, devices } from '@playwright/test'

const BACKEND_URL = 'http://localhost:8080'
const FRONTEND_URL = 'http://localhost:5173'

// End-to-end tests run against real, dedicated server instances — never ones a
// developer might already have open. The backend below points at an isolated
// scratch CSV file (backend/target/e2e-data/transactions.csv) so these tests can
// never touch the real seed data at backend/src/main/resources/data/transactions.csv.
// reuseExistingServer is deliberately false everywhere: reusing a server someone
// already has running on these ports could mean writing test data into the real
// CSV file instead, which is exactly what this isolation is meant to prevent.
export default defineConfig({
  testDir: './e2e',
  // Wipes the scratch CSV before the webServer(s) start — see global-setup.js for why
  // this matters (the frontend's default-first-page-of-20 limitation makes stale data
  // from a previous run silently hide freshly created rows).
  globalSetup: './e2e/global-setup.js',
  timeout: 30_000,
  // One backend instance / one CSV file (guarded by TransactionService's
  // ReentrantReadWriteLock) backs the whole suite — run specs serially so
  // concurrent tests can't see or clobber each other's rows.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command:
        'mvn spring-boot:run -Dspring-boot.run.arguments=--tms.csv.file-path=target/e2e-data/transactions.csv',
      cwd: '../backend',
      url: `${BACKEND_URL}/api/transactions`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev',
      url: FRONTEND_URL,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
})
