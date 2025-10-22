// tests/verify_frontend.spec.js
const { test, expect } = require('@playwright/test');

test('homepage screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.screenshot({ path: 'homepage.png' });
});
