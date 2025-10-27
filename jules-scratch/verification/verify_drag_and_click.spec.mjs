// jules-scratch/verification/verify_drag_and_click.spec.mjs
import { test, expect } from '@playwright/test';

test('should allow both drag-and-drop and click to draw cards', async ({ page }) => {
  // --- Full User Flow Simulation ---
  await page.goto('http://localhost:5175/');

  // 1. Intro page
  await page.locator('main[role="button"]').click();
  await page.waitForURL('**/name');

  // 2. Name page
  await page.locator('input#name').fill('Testeur E2E');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/question');

  // 3. Question page
  await page.locator('textarea#question').fill('Ce test va-t-il passer ?');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/loading');

  // 4. Spread page (wait for navigation to complete)
  await page.waitForURL('**/spread-advice', { timeout: 15000 }); // Increased timeout for API calls

  // --- Verification Steps ---

  // Wait for a stable element like the title to ensure the page is loaded
  await expect(page.locator('.p4-fixed-title')).toBeVisible({ timeout: 10000 });

  // Now, wait for the shuffle animation to become active by checking the class
  const deck = page.locator('.deck-area');
  await expect(deck).toHaveClass(/shuffling/, { timeout: 10000 });

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
  await deck.click({ force: true });

  // Check if a card appeared in the second slot
  const secondSlot = page.locator('.slot-wrap').nth(1);
  await expect(secondSlot.locator('.card-back.chosen')).toBeVisible();

  // Capture the final state
  await page.screenshot({ path: 'jules-scratch/verification/verification-final.png' });
});
