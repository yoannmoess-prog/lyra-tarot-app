// jules-scratch/verification/verify_drag_and_click.spec.js
import { test, expect } from '@playwright/test';

test('should allow both drag-and-drop and click to draw cards', async ({ page }) => {
  // Stratégie : Contourner le flux de navigation qui dépend de l'API LLM
  // en injectant l'état directement et en naviguant vers la page du tirage.

  // 1. Aller à la racine pour que le local storage soit associé au bon domaine.
  await page.goto('http://localhost:5178/');

  // 2. Injecter l'état nécessaire dans le localStorage.
  await page.evaluate(() => {
    localStorage.setItem('lyra-tarot-state', JSON.stringify({
      name: 'Testeur',
      question: 'Is this working?'
    }));
  });

  // 3. Naviguer directement à la page du tirage.
  await page.goto('http://localhost:5178/spread-advice');

  // 4. Exécuter les tests de drag-and-drop et de clic
  // Attendre que l'animation de mélange soit visible.
  await expect(page.locator('.deck-area.shuffling')).toBeVisible({ timeout: 15000 });

  const deck = page.locator('.deck-area');
  const rail = page.locator('.chosen-rail');
  const firstSlot = page.locator('.slot-wrap').nth(0);

  // --- Test 1: Drag and Drop ---
  await deck.hover();
  await page.mouse.down();

  await firstSlot.hover();
  await expect(firstSlot).toHaveClass(/highlight/, { timeout: 5000 });

  await page.screenshot({ path: 'jules-scratch/verification/verification-drag.png' });

  await rail.hover();
  await page.mouse.up();

  await expect(firstSlot.locator('.card-back.chosen')).toBeVisible({ timeout: 5000 });

  // --- Test 2: Click ---
  await deck.click();

  const secondSlot = page.locator('.slot-wrap').nth(1);
  await expect(secondSlot.locator('.card-back.chosen')).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: 'jules-scratch/verification/verification-final.png' });
});
