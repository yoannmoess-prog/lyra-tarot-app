import { test, expect } from '@playwright/test';

import path from 'node:path';

test.describe('Vérification du glassmorphism', () => {

  test('Le header et le footer doivent avoir un effet de flou et être collants', async ({ page }) => {
    // 1. Accéder à la page de vérification locale
    const filePath = path.join(process.cwd(), 'jules-scratch/verify.html');
    await page.goto(`file://${filePath}`);
    await page.waitForLoadState('networkidle');

    // 2. Capture d'écran initiale (vue du haut)
    await page.screenshot({ path: 'jules-scratch/01-glass-top.png' });

    // 3. Faire défiler jusqu'en bas de la page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500); // Attendre que le défilement se stabilise

    // 4. Capture d'écran en bas de page
    await page.screenshot({ path: 'jules-scratch/02-glass-bottom.png' });

    // 5. Faire défiler jusqu'au milieu pour voir les deux effets en même temps
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);

    // 6. Capture d'écran au milieu
    await page.screenshot({ path: 'jules-scratch/03-glass-middle.png' });

    // Assertion simple pour valider que le script a bien fonctionné
    const header = await page.locator('.chat-header');
    await expect(header).toBeVisible();
  });

});
