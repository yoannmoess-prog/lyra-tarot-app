import { test, expect } from '@playwright/test';

test('Verify card ratio', async ({ page }) => {
  await page.goto('http://localhost:5173/spreads-demo');

  // Remplir la question et soumettre
  await page.fill('input[id="q"]', 'Comment puis-je améliorer ma concentration ?');
  await page.click('button[type="submit"]');

  // Attendre que les cartes apparaissent
  await page.waitForSelector('.sd-card');

  // Prendre la capture d'écran
  await page.screenshot({ path: 'jules-scratch/verification/verification.png' });
});