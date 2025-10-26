
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Naviguer directement vers la page de spread pour vérifier les animations
        page.goto("http://localhost:5173/spread-advice")

        # Attendre que la page soit chargée et que l'animation de brassage soit visible
        page.wait_for_url("http://localhost:5173/spread-advice", timeout=10000)
        expect(page.locator(".deck-area.shuffling")).to_be_visible(timeout=5000)

        # Laisser le temps à l'animation de se dérouler
        page.wait_for_timeout(2000)

        # Prendre une capture d'écran
        page.screenshot(path="jules-scratch/verification/verification.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
