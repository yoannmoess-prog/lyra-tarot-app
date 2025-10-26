
import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Naviguer à la racine et commencer
        await page.goto("http://localhost:5173/")
        await page.get_by_role("button", name="Commencer").click()

        # Remplir le nom (étape intermédiaire)
        await page.wait_for_url("**/name")
        await page.get_by_placeholder("Votre nom").fill("Jules")
        await page.get_by_role("button", name="Continuer").click()

        # Remplir la question et continuer
        await page.wait_for_url("**/question")
        await page.get_by_placeholder("Posez votre question...").fill("Quelle est ma voie ?")
        await page.get_by_role("button", name="Continuer").click()

        # Attendre la navigation vers la page de chargement, puis la page de tirage
        await page.wait_for_url("**/loading")
        await page.wait_for_url("**/spread-advice", timeout=60000)

        # Attendre que l'animation de brassage soit active
        deck_area = page.locator(".deck-area.shuffling")
        await expect(deck_area).to_be_visible(timeout=10000)

        # Prendre une capture d'écran de l'animation
        await page.screenshot(path="jules-scratch/verification/verification.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
