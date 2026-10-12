import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) throw new Error('Set E2E_BASE_URL to a preview/staging URL (see e2e/.env.example).');
// These tests create, edit, report and delete listings. Never point them at the live site by accident.
if (/(^|\/\/)campus-market-v2\.vercel\.app/.test(baseURL) && process.env.E2E_ALLOW_PRODUCTION !== 'yes') {
  throw new Error('Refusing to run browser tests against production. Use a preview URL backed by a staging Supabase project.');
}

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // the tests share four accounts, so they run one at a time
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 5'] }, testMatch: /mobile\.spec/ },
  ],
});
