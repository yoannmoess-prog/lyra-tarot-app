
import re
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Navigate directly to the spread page to bypass the failing API call
        page.goto("http://localhost:5173/spread-advice")
        print("Navigated directly to spread-advice page.")

        # Wait for the page to be ready (e.g., for the deck to appear)
        expect(page.locator(".deck-area")).to_be_visible(timeout=10000)

        # Find the deck handle
        deck_handle = page.locator("#deck-handle")
        expect(deck_handle).to_be_visible()
        print("Deck handle is visible.")

        # Simulate a drag and drop
        deck_box = deck_handle.bounding_box()
        if deck_box is None:
            raise Exception("Could not get bounding box for deck handle")

        start_x = deck_box['x'] + deck_box['width'] / 2
        start_y = deck_box['y'] + deck_box['height'] / 2

        page.mouse.move(start_x, start_y)
        page.mouse.down()
        page.mouse.move(start_x + 100, start_y - 50, steps=5)

        # Take a screenshot during the drag
        page.screenshot(path="jules-scratch/verification/verification.png")
        print("Screenshot taken.")

        page.mouse.up()
        print("Mouse released.")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
