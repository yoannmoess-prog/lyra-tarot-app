
import { defineConfig } from '@playwright/test';

const baseURL = 'http://localhost:5173';

export default defineConfig({
  testDir: './jules-scratch',
  webServer: {
    command: 'npx concurrently "npm run dev:server" "npm run dev:client"',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  use: {
    baseURL: baseURL,
  },
});
