// jules-scratch/verify-rail-truth-layout.spec.js
import { test, expect } from '@playwright/test';

test.describe('Vérification de la mise en page du rail pour Spread-Truth', () => {
  test('Le rail doit avoir une forme de triangle inversé sur /chat-truth', async ({ page }) => {
    // Naviguer directement à la page de chat pour spread-truth
    await page.goto('http://localhost:5173/chat-truth');

    // Attendre que le rail et les cartes soient visibles
    await page.waitForSelector('.final-rail.rail-truth', { state: 'visible' });
    await page.waitForSelector('.final-card-outer', { state: 'visible' });

    // Attendre un court instant pour s'assurer que les animations CSS sont terminées
    await page.waitForTimeout(1000);

    // Évaluer les positions des cartes
    const cardPositions = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.final-rail.rail-truth .final-card-outer'));
      return cards.map(card => {
        const rect = card.getBoundingClientRect();
        return {
          top: rect.top,
          left: rect.left,
        };
      });
    });

    // S'assurer qu'il y a 3 cartes
    expect(cardPositions.length).toBe(3);

    const [cardA, cardB, cardC] = cardPositions;

    // Vérifier que la carte B (au milieu) est plus basse que les cartes A et C
    expect(cardB.top).toBeGreaterThan(cardA.top);
    expect(cardB.top).toBeGreaterThan(cardC.top);

    // Vérifier que les cartes A et C sont à peu près alignées horizontalement
    expect(cardA.top).toBeCloseTo(cardC.top, 5); // Tolérance de 5px

    // Prendre une capture d'écran pour la vérification visuelle
    await page.screenshot({ path: '/home/swebot/jules-scratch/verification/rail-truth-chat-correction.png', fullPage: true });

    console.log('Vérification terminée. La mise en page triangulaire est correcte.');
  });
});
