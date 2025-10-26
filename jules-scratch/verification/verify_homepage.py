
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Naviguer à la racine
        await page.goto("http://localhost:5173/")

        # Prendre une capture d'écran de la page d'accueil
        await page.screenshot(path="jules-scratch/verification/homepage.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
