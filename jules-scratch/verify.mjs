
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const screenshotPath = path.join(__dirname, 'verification/screenshot.png');

test('Vérification du parcours utilisateur et du chat', async ({ page }) => {
  try {
    console.log('Début de la navigation vers la page...');
    await page.goto('http://localhost:5173/');
    console.log('Navigation réussie. Attente du sélecteur #logo-and-title-container...');

    // 1. Cliquer sur l'écran d'introduction pour le faire disparaître
    await page.waitForSelector('#logo-and-title-container', { timeout: 15000 });
    console.log('Écran d\'introduction trouvé. Clic...');
    await page.locator('#logo-and-title-container').click();
    console.log('Clic sur l\'écran d\'introduction effectué.');

    // 2. Cliquer sur le bouton "Commencer"
    console.log('Attente du bouton "Commencer"...');
    const commencerButton = page.getByRole('button', { name: 'Commencer' });
    await commencerButton.waitFor({ state: 'visible', timeout: 15000 });
    console.log('Bouton "Commencer" trouvé. Clic...');
    await commencerButton.click();
    console.log('Clic sur "Commencer" effectué.');

    // 3. Entrer le prénom
    console.log('Attente du champ de saisie du prénom...');
    const prenomInput = page.getByPlaceholder('Ton prénom…');
    await prenomInput.waitFor({ state: 'visible', timeout: 15000 });
    console.log('Champ de saisie du prénom trouvé. Saisie du texte...');
    await prenomInput.fill('Jules');
    console.log('Prénom saisi. Attente de la navigation...');
    await page.waitForURL('**/question', { timeout: 10000 });
    console.log('Navigation vers la page de question réussie.');

    // 4. Poser une question
    console.log('Attente du champ de saisie de la question...');
    const questionInput = page.getByPlaceholder('Écris ta question…');
    await questionInput.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Champ de saisie de la question trouvé. Saisie du texte...');
    await questionInput.fill('Quelle est ma destinée ?');
    console.log('Question saisie. Clic sur le bouton d\'envoi...');
    await page.locator('#send-btn-question').click();
    console.log('Clic sur le bouton d\'envoi effectué. Attente de la navigation...');
    await page.waitForURL('**/tirage', { timeout: 10000 });
    console.log('Navigation vers la page de tirage réussie.');

    // 5. Tirer les cartes
    console.log('Attente du bouton "Tirer les cartes"...');
    const tirerButton = page.getByRole('button', { name: 'Tirer les cartes' });
    await tirerButton.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Bouton "Tirer les cartes" trouvé. Clic...');
    await tirerButton.click();
    console.log('Clic sur "Tirer les cartes" effectué. Attente de la navigation...');
    await page.waitForURL('**/chat', { timeout: 10000 });
    console.log('Navigation vers la page de chat réussie.');

    // 6. Vérifier la présence d'une bulle de chat de Lyra
    console.log('Attente de la première bulle de Lyra...');
    const lyraBubble = page.locator('.bubble.lyra').first();
    await lyraBubble.waitFor({ state: 'visible', timeout: 20000 });
    console.log('Bulle de Lyra trouvée.');

    // 7. Prendre une capture d'écran
    console.log(`Prise de la capture d'écran et sauvegarde dans : ${screenshotPath}`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Capture d\'écran réussie.');

  } catch (error) {
    console.error('Une erreur est survenue pendant le test Playwright :', error);
    await page.screenshot({ path: path.join(__dirname, 'verification/error.png'), fullPage: true });
    throw error;
  }
});
