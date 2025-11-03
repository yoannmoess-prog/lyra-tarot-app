// jules-scratch/chat-layout-test.spec.js
import { test, expect } from "@playwright/test";

test.describe("Validation de la mise en page de la page de chat pour spread-truth", () => {
  test("Le rail de cartes et le chat ne se superposent pas et l'espacement est correct", async ({
    page,
  }) => {
    // 1. Injecter l'état et naviguer
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
      window.history.pushState(state, "", "/chat-truth");
    });

    await page.goto("/chat-truth");

    // 2. Attendre que les éléments clés soient visibles
    const chatRail = page.locator(".chat-rail");
    const chatBody = page.locator(".chat-body");
    const firstBubble = chatBody.locator(".bubble").first();

    await expect(chatRail).toBeVisible({ timeout: 15000 });
    await expect(chatBody).toBeVisible({ timeout: 15000 });
    // Attendre qu'une bulle apparaisse confirme que le chat est initialisé
    await expect(firstBubble).toBeVisible({ timeout: 15000 });

    // 3. Vérifier l'absence de superposition et l'espacement
    const railBox = await chatRail.boundingBox();
    const chatBox = await chatBody.boundingBox();

    expect(railBox).not.toBeNull();
    expect(chatBox).not.toBeNull();

    // Le bas du rail (y + hauteur) doit être au-dessus du haut du chat (y)
    const railBottom = railBox.y + railBox.height;
    expect(railBottom).toBeLessThanOrEqual(chatBox.y);

    // Vérifier que l'espace est d'environ 50px (avec une marge de tolérance)
    const spaceBetween = chatBox.y - railBottom;
    console.log(`Espace mesuré entre le rail et le chat : ${spaceBetween}px`);
    expect(spaceBetween).toBeGreaterThanOrEqual(48); // Tolérance pour le rendu
    expect(spaceBetween).toBeLessThanOrEqual(52);   // Tolérance pour le rendu

    // 4. Prendre une capture d'écran pour vérification visuelle
    await page.screenshot({
      path: "jules-scratch/chat-layout-test.png",
      fullPage: true,
    });
  });
});
