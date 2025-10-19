
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Increase timeout to 60 seconds
    page.set_default_timeout(60000)

    try:
        # Navigate to the home page and take a screenshot
        page.goto("http://localhost:5173/")
        page.screenshot(path="jules-scratch/verification/initial_page.png")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
