// jules-scratch/chat-layout-test.spec.js
import { test, expect } from "@playwright/test";

test.describe("Validation de la mise en page de la page de chat pour spread-truth", () => {
  test("Le rail de cartes et le chat ne se superposent pas et le scroll fonctionne", async ({ page }) => {
    // Injecter les données de état pour simuler la navigation
    await page.goto("/");
    await page.evaluate(() => {
      const state = {
        name: "Testeur",
        question: "Cette mise en page est-elle correcte ?",
        cards: [
          { id: "01", name: "Le Bateleur", src: "/assets/cards/01.webp" },
          { id: "02", name: "La Papesse", src: "/assets/cards/02.webp" },
          { id: "03", name: "L'Impératrice", src: "/assets/cards/03.webp" },
        ],
        isNew: true,
      };
      // Simule le passage de l'état de navigation
      window.history.pushState(state, "", "/chat-truth");
    });

    // Naviguer vers la page de chat
    await page.goto("/chat-truth");

    // Attendre que le rail de cartes soit visible et que les animations se terminent
    const finalRail = page.locator(".final-rail.rail-truth");
    await expect(finalRail).toBeVisible({ timeout: 10000 });

    // Attendre la fin de l'animation de retournement des cartes (délai généreux)
    await page.waitForTimeout(5000);

    // Vérifier la disposition en triangle
    const cardOuters = finalRail.locator(".final-card-outer");
    const firstCardBox = await cardOuters.nth(0).boundingBox();
    const secondCardBox = await cardOuters.nth(1).boundingBox();
    const thirdCardBox = await cardOuters.nth(2).boundingBox();

    expect(firstCardBox.y).toBeCloseTo(thirdCardBox.y, 2); // Les cartes A et C sont alignées horizontalement
    expect(secondCardBox.y).toBeGreaterThan(firstCardBox.y); // La carte B est plus basse

    // Attendre que l'interface de chat apparaisse
    const chatWrap = page.locator(".chat-wrap.show");
    await expect(chatWrap).toBeVisible({ timeout: 5000 });

    // Vérifier l'absence de superposition
    const railBox = await finalRail.boundingBox();
    const chatBox = await chatWrap.boundingBox();

    // S'assurer que le bas du rail est au-dessus du haut du chat
    const railBottom = railBox.y + railBox.height;
    expect(railBottom).toBeLessThanOrEqual(chatBox.y);

    // Vérifier que le défilement s'est produit en vérifiant la position de défilement du conteneur de chat
    const chatScrollTop = await chatWrap.evaluate(node => node.scrollTop);
    expect(chatScrollTop).toBeGreaterThan(0);

    // Prendre une capture d'écran pour vérification visuelle
    await page.screenshot({ path: "jules-scratch/chat-layout-test.png", fullPage: true });
  });
});
