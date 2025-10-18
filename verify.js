import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/spreads-demo');
  await page.waitForTimeout(3000); // Wait for animations
  await page.screenshot({ path: 'user_input/screenshot.png' });
  await browser.close();
})();