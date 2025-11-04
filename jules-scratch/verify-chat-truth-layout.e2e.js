import { test, expect } from "@playwright/test";
import { Eyes, Target } from '@applitools/eyes-playwright';

test.describe("Chat Truth Layout Validation", () => {
  test("should display cards in a triangular layout on /chat-truth", async ({ page }) => {
    // Démarrer à la racine
    await page.goto("http://localhost:5173/");

    // Étape 1: Intro
    await page.locator('main[role="button"]').click();
    await expect(page).toHaveURL("http://localhost:5173/name");

    // Étape 2: Nom
    await page.locator("input#name").fill("Testeur");
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL("http://localhost:5173/question");

    // Étape 3: Question (doit déclencher spread-truth)
    await page.locator("textarea#question").fill("Je doute de mon avenir.");
    await page.locator('button[type="submit"]').click();

    // Étape 4: Chargement, puis redirection vers le chat
    await expect(page).toHaveURL("http://localhost:5173/loading");
    await expect(page).toHaveURL("http://localhost:5173/chat-truth", { timeout: 20000 });

    // Attendre que le rail de cartes soit visible et stable
    const railLocator = page.locator(".final-rail.rail-truth");
    await expect(railLocator).toBeVisible({ timeout: 15000 });

    // Attendre la fin de l'animation de retournement des cartes
    await page.waitForTimeout(4000); // Marge de sécurité pour les animations

    // Vérifier la disposition en triangle
    const cardA = railLocator.locator('[data-pos="A"]');
    const cardB = railLocator.locator('[data-pos="B"]');
    const cardC = railLocator.locator('[data-pos="C"]');

    const boxA = await cardA.boundingBox();
    const boxB = await cardB.boundingBox();
    const boxC = await cardC.boundingBox();

    expect(boxA).not.toBeNull();
    expect(boxB).not.toBeNull();
    expect(boxC).not.toBeNull();

    // Vérification clé : la coordonnée Y de la carte B doit être significativement plus grande
    // que celle des cartes A et C.
    expect(boxB.y).toBeGreaterThan(boxA.y + boxA.height / 2);
    expect(boxB.y).toBeGreaterThan(boxC.y + boxC.height / 2);

    // Vérification optionnelle : A et C doivent être à peu près au même niveau
    expect(Math.abs(boxA.y - boxC.y)).toBeLessThan(10);

    // Prendre une capture d'écran pour la validation visuelle
    await page.screenshot({ path: "jules-scratch/chat-truth-layout.png" });
  });
});
