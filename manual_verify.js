// manual_verify.js
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:5173/');
    await page.screenshot({ path: 'manual_screenshot.png' });
    console.log('Screenshot taken successfully.');
  } catch (error) {
    console.error('Error taking screenshot:', error);
  } finally {
    await browser.close();
  }
})();
