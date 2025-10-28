
import { test, expect } from '@playwright/test';

test.describe('Tarot Draw Interaction on Spread Page', () => {
  test('should allow drawing cards by click and drag without moving the deck', async ({ page }) => {
    await page.goto('/spread-advice');

    const pageRoot = page.locator(".page4-root");
    await expect(pageRoot).toBeVisible({ timeout: 15000 });
    await expect(pageRoot).toHaveClass(/fade-in-soft/, { timeout: 5000 });

    const deckHandle = page.locator(".draggable-handle");
    const rail = page.locator(".chosen-rail");
    const cardInSlot = page.locator(".card-in-slot");
    const deckArea = page.locator(".deck-area");

    const initialDeckPosition = await deckArea.boundingBox();
    expect(initialDeckPosition).not.toBeNull();

    await expect(cardInSlot).toHaveCount(0);

    // --- Test Click with low-level events and pauses ---
    console.log("Testing click...");
    await deckHandle.dispatchEvent('pointerdown');
    await page.waitForTimeout(50); // Small pause to ensure down event is processed
    await deckHandle.dispatchEvent('pointerup');
    await expect(cardInSlot).toHaveCount(1, { timeout: 10000 });
    console.log("Click test passed.");

    let currentDeckPosition = await deckArea.boundingBox();
    expect(currentDeckPosition.x).toEqual(initialDeckPosition.x);
    expect(currentDeckPosition.y).toEqual(initialDeckPosition.y);

    // --- Test Drag and Drop ---
    console.log("Testing drag and drop...");
    await deckHandle.dragTo(rail);
    await expect(cardInSlot).toHaveCount(2, { timeout: 10000 });
    console.log("Drag and drop test passed.");

    currentDeckPosition = await deckArea.boundingBox();
    expect(currentDeckPosition.x).toEqual(initialDeckPosition.x);
    expect(currentDeckPosition.y).toEqual(initialDeckPosition.y);

    console.log("All component interaction tests passed!");
  });
});
