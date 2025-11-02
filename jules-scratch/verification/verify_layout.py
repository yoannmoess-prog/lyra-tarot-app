# jules-scratch/verification/verify_layout.py
import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        front_url = "http://localhost:5174"

        # 1. Naviguer vers l'URL de base
        await page.goto(front_url)

        # 2. Définir l'état nécessaire pour la page de chat
        chat_page_state = {
            "name": "Vérificateur",
            "question": "Cette mise en page est-elle correcte ?",
            "cards": [
                { "id": "05", "name": "Le Pape", "src": "/assets/cards/05.webp" },
                { "id": "10", "name": "La Roue de Fortune", "src": "/assets/cards/10.webp" },
                { "id": "20", "name": "Le Jugement", "src": "/assets/cards/20.webp" },
            ],
            "isNew": True,
        }

        # 3. Injecter l'état et naviguer vers /chat-truth
        await page.evaluate(
            '({ url, state }) => { window.history.pushState(state, "", url); window.dispatchEvent(new PopStateEvent("popstate", { state })); }',
            { "url": "/chat-truth", "state": chat_page_state }
        )

        # Recharger la page pour qu'elle soit rendue avec le nouvel état
        await page.reload()

        # 4. Attendre que la page et les éléments clés soient chargés
        await expect(page).to_have_url(f"{front_url}/chat-truth", timeout=10000)
        await expect(page.locator(".final-hero")).to_be_visible(timeout=20000)
        await expect(page.locator(".chat-wrap")).to_be_visible(timeout=25000)

        # 5. Prendre une capture d'écran en pleine page pour vérification
        screenshot_path = "jules-scratch/verification/verification.png"
        await page.screenshot(path=screenshot_path, full_page=True)
        print(f"Capture d'écran enregistrée sur : {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
