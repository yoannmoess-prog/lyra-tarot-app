
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            # Navigate to the name page
            await page.goto("http://localhost:5173/name")

            # Fill in the name and submit
            await page.fill('input[placeholder="Ton prénom"]', "Jules")
            await page.click('button[aria-label="Envoyer"]')

            # Wait for navigation to the question page
            await page.wait_for_url("http://localhost:5173/question")

            # Check if the textarea is focused
            is_focused = await page.evaluate("document.activeElement.tagName === 'TEXTAREA'")
            print(f"Textarea is focused: {is_focused}")

            # Take a screenshot
            await page.screenshot(path="jules-scratch/verification/verification.png")

            print("Screenshot taken successfully.")

        except Exception as e:
            print(f"An error occurred: {e}")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
