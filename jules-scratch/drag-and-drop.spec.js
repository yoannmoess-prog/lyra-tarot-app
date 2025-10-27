// jules-scratch/drag-and-drop.spec.js
import { test, expect } from "@playwright/test";

test.describe("Drag and Drop card validation", () => {
  test("should correctly display only one card being dragged, leaving the deck in place", async ({
    page,
  }) => {
    // Navigate to the page and set up state via localStorage
    await page.goto("/spread-advice");
    await page.evaluate(() => {
      localStorage.setItem("tartot-io-question", JSON.stringify("Test question"));
      localStorage.setItem("tartot-io-name", JSON.stringify("Test User"));
    });
    // Reload the page for localStorage to take effect
    await page.reload();

    // Ensure the deck is visible
    const deck = page.locator(".deck-area");
    await expect(deck).toBeVisible();

    // Define drag-and-drop targets
    const rail = page.locator(".chosen-rail");
    const deckBoundingBox = await deck.boundingBox();
    const railBoundingBox = await rail.boundingBox();

    expect(deckBoundingBox, "Deck should have a bounding box").toBeDefined();
    expect(railBoundingBox, "Rail should have a bounding box").toBeDefined();

    const startX = deckBoundingBox.x + deckBoundingBox.width / 2;
    const startY = deckBoundingBox.y + deckBoundingBox.height / 2;
    const endX = railBoundingBox.x + railBoundingBox.width / 2;
    const endY = railBoundingBox.y + railBoundingBox.height / 2;

    // Start the drag operation
    await page.mouse.move(startX, startY);
    await page.mouse.down();

    // Verify deck's style during the drag
    const deckStyleDuringDrag = await deck.evaluate((node) => window.getComputedStyle(node).transform);
    expect(deckStyleDuringDrag, "Deck should not be transformed during drag").toBe("none");

    // Move to the drop target
    await page.mouse.move(endX, endY, { steps: 5 });

    // Take screenshot for visual verification
    await page.screenshot({ path: "jules-scratch/verification-drag.png" });

    // Release the mouse to complete the drop
    await page.mouse.up();

    // Final check to see if a card has appeared in the rail
    const chosenCard = page.locator(".card.chosen");
    await expect(chosenCard).toBeVisible();
  });
});
