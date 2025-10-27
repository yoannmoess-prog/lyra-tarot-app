// jules-scratch/verification/verify_drag_and_click.spec.mjs
import { test, expect } from '@playwright/test';

test('should allow both drag-and-drop and click to draw cards', async ({ page }) => {
  // Navigate directly to the page, simulating the state
  await page.goto('http://localhost:5175');
  await page.evaluate(() => {
    localStorage.setItem('lyra-tarot-state', JSON.stringify({
      name: 'Testeur',
      question: 'Is this working?'
    }));
  });
  await page.goto('http://localhost:5175/spread-advice');

  // Wait for the shuffle animation to become active
  await expect(page.locator('.deck-area.shuffling')).toBeVisible({ timeout: 10000 });

  const deck = page.locator('.deck-area');
  const rail = page.locator('.chosen-rail');
  const firstSlot = page.locator('.slot-wrap').nth(0);

  // --- Test 1: Drag and Drop ---
  await deck.hover();
  await page.mouse.down();

  // Drag over the first slot and check for highlight
  await firstSlot.hover();
  await expect(firstSlot).toHaveClass(/highlight/);

  // Capture the drag interaction
  await page.screenshot({ path: 'jules-scratch/verification/verification-drag.png' });

  // Drop the card onto the rail
  await rail.hover();
  await page.mouse.up();

  // Check if a card appeared in the first slot
  await expect(firstSlot.locator('.card-back.chosen')).toBeVisible();

  // --- Test 2: Click ---
  await deck.click({
    // Sometimes the animation is not perfectly settled, so we force the click.
    // This is acceptable in a verification script.
    force: true
  });

  // Check if a card appeared in the second slot
  const secondSlot = page.locator('.slot-wrap').nth(1);
  await expect(secondSlot.locator('.card-back.chosen')).toBeVisible();

  // Capture the final state
  await page.screenshot({ path: 'jules-scratch/verification/verification-final.png' });
});
