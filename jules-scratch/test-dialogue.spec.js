import { test, expect } from '@playwright/test';

test.describe('Dialogue Multi-Tours (Navigation Directe)', () => {
  test.setTimeout(60000);

  test('devrait suivre le nouveau flux de conversation en accédant directement au chat', async ({ page }) => {
    // Naviguer directement à la page de chat avec les données nécessaires
    // NOTE: C'est une solution de contournement pour valider la logique du chat,
    // car la navigation complète est bloquée par un problème indépendant.
    await page.goto('http://localhost:5173/chat-truth');

    // Le state n'étant pas passé par la navigation, on le simule si nécessaire
    // ou on s'appuie sur le fait que la page peut gérer un état initial vide.
    // Pour ce test, on va supposer que le backend peut fonctionner sans toutes les infos.

    // On attend que la page soit interactive et que le chat soit visible
    await page.waitForSelector('.chat-wrap.show');
    await page.screenshot({ path: 'jules-scratch/verification/06_chat_direct_initial.png' });

    // Attendre la première bulle de Lyra ("C'est parti ?")
    // Le backend recevra une requête sans question/nom, mais devrait répondre avec le prompt initial.
    await expect(page.locator('.bubble.lyra .msg')).toContainText("C'est parti ?", { timeout: 20000 });
    await page.screenshot({ path: 'jules-scratch/verification/07_chat_direct_introduction.png' });

    // Répondre "Oui !"
    await page.fill('input.you-input', 'Oui !');
    await page.click('button[type="submit"]');

    // Attendre la deuxième bulle de Lyra (interprétation de la carte)
    await expect(page.locator('.bubble.lyra .msg').last()).toContainText("Est-ce que cela t'inspire ?", { timeout: 20000 });
    await page.screenshot({ path: 'jules-scratch/verification/08_chat_direct_interpretation.png' });
  });
});
