import { test, expect } from '@playwright/test';

test('Vérification complète du flux et de la page de chat', async ({ page }) => {
  // 1. Navigation et remplissage des formulaires
  await page.goto('http://localhost:5173');
  await expect(page.locator('main[role="button"]')).toBeVisible({ timeout: 15000 });
  await page.locator('main[role="button"]').click();

  await expect(page).toHaveURL(/name/, { timeout: 10000 });
  await page.getByPlaceholder('Ton prénom').fill('Jules');
  await page.getByRole('button', { name: 'Envoyer' }).click();

  await expect(page).toHaveURL(/question/, { timeout: 10000 });
  await page.getByPlaceholder('Écris ta question ici...').fill('Est-ce que les corrections sont bonnes ?');
  await page.getByRole('button', { name: 'Envoyer la question' }).click();

  // 2. Attente du tirage et navigation vers le chat
  await expect(page).toHaveURL(/loading/, { timeout: 10000 });
  await expect(page).toHaveURL(/spread-advice|spread-truth/, { timeout: 20000 });

  // 3. Piocher 3 cartes
  const deck = page.locator('.draggable-handle');
  await expect(deck).toBeVisible({ timeout: 10000 });
  await deck.click();
  await page.waitForTimeout(1000);
  await deck.click();
  await page.waitForTimeout(1000);
  await deck.click();

  // 4. Attente de la navigation vers la page de chat
  await expect(page).toHaveURL(/chat-advice|chat-truth/, { timeout: 30000 });

  // 5. Validation finale sur la page de chat
  const chatInput = page.locator('.you-input');
  await expect(chatInput).toBeVisible({ timeout: 20000 });
  await expect(chatInput).toBeEnabled();

  // Entrer un long texte pour tester le redimensionnement
  const longText = 'Ce long texte va agrandir le footer. Je vérifie que la dernière bulle reste visible et que l\'icône "mic" a bien disparu.';
  await chatInput.fill(longText);
  await page.waitForTimeout(500); // Laisse le temps au ResizeObserver de faire son travail

  // Prendre la capture d'écran finale
  await page.screenshot({ path: 'final-verification.png', fullPage: true });
});
