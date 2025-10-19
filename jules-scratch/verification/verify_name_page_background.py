
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:5173/name")
    page.wait_for_selector('h1', timeout=5000)
    page.screenshot(path="jules-scratch/verification/name_page_background.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
