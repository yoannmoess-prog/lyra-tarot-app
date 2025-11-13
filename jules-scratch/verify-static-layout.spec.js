import { test, expect } from '@playwright/test';

test('vérifie la disposition du footer sur une page statique', async ({ page }) => {
  // L'URL pointe vers le fichier HTML local
  await page.goto('file://' + process.cwd() + '/jules-scratch/verify-layout.html');

  // Attendre que la page soit chargée
  await page.waitForLoadState('domcontentloaded');

  // Prendre une capture d'écran de la page complète pour la vérification visuelle
  await page.screenshot({ path: 'final-verification.png', fullPage: true });
});
