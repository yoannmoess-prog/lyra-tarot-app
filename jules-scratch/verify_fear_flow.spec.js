import { test, expect } from '@playwright/test';

test('Vérification du flux de peur et de la page de chargement', async ({ page }) => {
  // 1. Navigation et saisie du nom
  await page.goto('http://localhost:5173/');
  await page.locator('input[name="name"]').fill('Testeur');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL('http://localhost:5173/question');

  // 2. Saisie de la question contenant un mot-clé de peur
  await page.locator('textarea[name="question"]').fill('Je crains de rater mon examen');
  await page.locator('button[type="submit"]').click();

  // 3. Vérification de la page de chargement
  await expect(page).toHaveURL('http://localhost:5173/loading');

  // Attendre un peu pour que l'animation soit visible et prendre une capture d'écran
  await page.waitForTimeout(2000); // Attendre 2 secondes pour voir l'animation
  await page.screenshot({ path: 'playwright-screenshots/loading-page-verification.png' });

  // 4. Vérification de la redirection vers la bonne page de tirage (spread-truth)
  await expect(page).toHaveURL('http://localhost:5173/spread-truth', { timeout: 10000 }); // Augmentation du timeout pour laisser le temps à l'animation

  // 5. Vérification du contenu de la page de tirage "spread-truth"
  await expect(page.locator('h1')).toContainText('Le Tirage de la Vérité');
});
