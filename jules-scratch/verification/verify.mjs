
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Listen for all console events and log them to the terminal
  page.on('console', msg => {
    console.log(`[Browser Console] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  try {
    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    console.log('Waiting for the start button...');
    // Wait for the button that should be on the first page.
    // Increased timeout to give the app plenty of time to load.
    await page.waitForSelector('#commencer-button', { timeout: 20000 });

    console.log('✅ Verification successful: Start button found!');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    const screenshotPath = 'debug_screenshot_with_logs.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved to ${screenshotPath}`);
    console.log('Please check the browser console output above for client-side errors.');
  } finally {
    await browser.close();
  }
})();
