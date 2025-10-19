import { test, expect } from '@playwright/test';

test.describe('Frontend Verification', () => {
  test.setTimeout(60000); // Set timeout to 60 seconds for the whole test

  test('basic test', async ({ page }) => {
    console.log('Navigating to http://localhost:5173/');
    await page.goto('http://localhost:5173/');

    console.log('Clicking introductory screen button');
    // Click the introductory screen to proceed.
    const introButton = page.getByRole('button', { name: 'Écran d’introduction — touchez, cliquez ou balayez pour continuer' });
    await introButton.click({ timeout: 15000 });

    console.log('Waiting for URL to be http://localhost:5173/name');
    await page.waitForURL('http://localhost:5173/name', { timeout: 15000 });
    console.log('URL is now http://localhost:5173/name');

    // Wait for the page to be fully loaded and network to be idle
    await page.waitForLoadState('networkidle');

    // Use a more specific locator for the name input field
    const nameInput = page.getByPlaceholder('Ton prénom');
    await nameInput.fill('Test User');

    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/question', { timeout: 15000 });

    const questionInput = page.getByPlaceholder('Écris ta question');
    await questionInput.fill('This is a test question.');

    await page.click('button[type="submit"]');
    // Corrected the expected URL to /draw
    await page.waitForURL('http://localhost:5173/draw', { timeout: 15000 });

    // Click the card deck to draw cards, with delays in between.
    const cardDeck = page.getByRole('button', { name: 'Jeu de cartes : touchez pour piocher (séquentiel)' });
    await cardDeck.click();
    await page.waitForTimeout(1000); // 1 second delay
    await cardDeck.click();
    await page.waitForTimeout(1000); // 1 second delay
    await cardDeck.click();

    // The navigation to /chat should be triggered after the third card is drawn.
    await page.waitForURL('http://localhost:5173/chat', { timeout: 15000 });

    // Wait for Lyra's first bubble to appear.
    await page.waitForSelector('.bubble.lyra', { timeout: 20000 });

    // Take a screenshot of the chat page
    await page.screenshot({ path: 'jules-scratch/verification/chat_page.png' });
  });
});
