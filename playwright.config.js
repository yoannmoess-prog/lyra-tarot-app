// playwright.config.js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Look for test files in the "jules-scratch" directory.
  testDir: './jules-scratch',
  // Use the existing development server.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:5173',
  },
});
