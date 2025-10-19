
import { test, expect } from '@playwright/test';

test('take screenshot of question page', async ({ page }) => {
  await page.goto('http://localhost:5173/question');
  // Corrected the selector to use 'textarea' and the full, correct placeholder text.
  await page.waitForSelector('textarea[placeholder="Écris ta question ici..."]', { timeout: 10000 });
  await page.screenshot({ path: 'jules-scratch/verification/question_page_background.png', fullPage: true });
});
