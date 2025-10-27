
import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            # Naviguer vers la page d'accueil
            await page.goto("http://localhost:5176/")

            # Page 1: Intro - Cliquer pour commencer
            await page.locator('main.intro-root[role="button"]').click()
            await expect(page).to_have_url("http://localhost:5176/name")

            # Page 2: Name - Entrer un nom et continuer
            await page.get_by_placeholder("Ton prénom").fill("Jules")
            await page.get_by_role("button", name="Envoyer").click()
            await expect(page).to_have_url("http://localhost:5176/question", timeout=10000)

            # Page 3: Question - Poser une question valide et continuer
            await page.get_by_placeholder("Écris ta question ici...").fill("Quel est mon avenir professionnel ?")
            await page.get_by_role("button", name="Envoyer la question").click()

            # Page 4: Loading - Attendre la redirection vers la page du tirage
            # L'API peut être lente, donc on met un timeout généreux
            await expect(page).to_have_url("http://localhost:5176/spread-advice", timeout=20000)

            # Page 5: Spread - La page avec l'animation de brassage
            await expect(page.locator(".board")).to_be_visible(timeout=10000)

            # Laisser à l'animation le temps de démarrer pour une capture pertinente
            await page.wait_for_timeout(2000)

            # Prendre la capture d'écran
            await page.screenshot(path="jules-scratch/verification/verification.png")

            print("Screenshot saved to jules-scratch/verification/verification.png")

        except Exception as e:
            print(f"An error occurred: {e}")
            await page.screenshot(path="jules-scratch/verification/error.png")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
