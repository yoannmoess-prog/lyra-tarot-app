import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            # Augmenter le timeout par défaut pour les actions
            page.set_default_timeout(15000) # 15 secondes

            # 1. Naviguer vers la page d'accueil et commencer
            print("Navigating to home page...")
            await page.goto("http://localhost:5173", wait_until="networkidle")
            await page.locator('main[role="button"]').click()

            # 2. Entrer un nom et continuer
            print("Entering name...")
            await expect(page.locator("input#name")).to_be_visible()
            await page.fill("input#name", "Jules")
            await page.click("button[type=submit]")

            # 3. Poser une question et continuer
            print("Asking a question...")
            await expect(page.locator("textarea#question")).to_be_visible()
            await page.fill("textarea#question", "Quel est mon chemin ?")
            await page.click("button[type=submit]")

            # 4. Attendre la fin de la page de chargement et l'arrivée sur la page de tirage
            print("Waiting for loading to complete...")
            await expect(page).to_have_url("http://localhost:5173/spread-advice", timeout=20000)

            # S'assurer que le paquet de cartes est visible
            deck_handle = page.locator("#deck-handle")
            await expect(deck_handle).to_be_visible(timeout=10000)
            print("Deck is visible.")

            # --- Vérification du Clic ---
            print("Testing click interaction...")
            # Capture d'écran avant le clic
            await page.screenshot(path="jules-scratch/verification/01_before_click.png")

            # Cliquer sur le paquet pour tirer la première carte
            await deck_handle.click()

            # Attendre que la carte arrive à sa place
            await asyncio.sleep(1) # Attente pour la fin de l'animation
            await page.screenshot(path="jules-scratch/verification/02_after_click.png")
            print("First card drawn by click.")

            # --- Vérification du Glisser-Déposer ---
            print("Testing drag-and-drop interaction...")
            rail = page.locator("#rail")
            await expect(rail).to_be_visible()

            # Glisser le paquet vers le rail pour tirer la deuxième carte
            await deck_handle.drag_to(rail)

            # Attendre que la carte arrive à sa place
            await asyncio.sleep(1)
            await page.screenshot(path="jules-scratch/verification/03_after_drag.png")
            print("Second card drawn by drag-and-drop.")

            print("Verification script completed successfully!")

        except Exception as e:
            print(f"An error occurred: {e}")
            await page.screenshot(path="jules-scratch/verification/error.png")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
