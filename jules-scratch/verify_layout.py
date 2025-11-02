
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            await page.goto("http://localhost:5173/")
            print("Page loaded")

            # Click on the intro button
            await page.locator('main[role="button"]').click()
            print("Intro button clicked")

            # Fill in the name
            await page.wait_for_selector('input#name', timeout=5000)
            await page.fill('input#name', 'Test User')
            await page.press('input#name', 'Enter')
            print("Name entered")

            # Fill in the question
            await page.wait_for_selector('textarea#question', timeout=5000)
            await page.fill('textarea#question', "J'ai un doute")
            await page.press('textarea#question', 'Enter')
            print("Question submitted")

            # Wait for navigation to the spread page
            await page.wait_for_url('**/spread-truth', timeout=15000)
            print("Navigated to spread-truth page")

            # Click the deck handle 3 times to draw cards
            deck_selector = '#deck-handle'
            await page.wait_for_selector(deck_selector, timeout=5000)
            print("Deck handle is visible. Drawing cards...")
            await page.click(deck_selector)
            await page.wait_for_timeout(1000) # Wait for animation
            await page.click(deck_selector)
            await page.wait_for_timeout(1000)
            await page.click(deck_selector)
            print("3 cards drawn.")

            # Wait for navigation to the chat page
            await page.wait_for_url('**/chat-truth', timeout=15000)
            print("Navigated to chat-truth page")

            # Take screenshot
            await page.screenshot(path='jules-scratch/chat_truth_layout.png')
            print("Screenshot taken")

        except Exception as e:
            print(f"An error occurred: {e}")
            await page.screenshot(path='jules-scratch/error.png')
        finally:
            await browser.close()

asyncio.run(main())
