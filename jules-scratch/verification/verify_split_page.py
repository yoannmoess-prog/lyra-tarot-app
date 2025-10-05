import re
from playwright.sync_api import sync_playwright, Page, expect

def run_verification(page: Page):
    """
    This script verifies the new layout of Page 4 (/draw).
    It navigates to the page and takes a screenshot immediately to validate the layout.
    """
    page.set_default_timeout(60000)

    page.goto("http://localhost:5173/", wait_until="networkidle")

    # --- Navigate through Intro, Name, and Question pages ---
    page.get_by_role("button", name="Écran d’introduction — touchez, cliquez ou balayez pour continuer").click()

    expect(page).to_have_url(re.compile(".*name"), timeout=10000)
    page.get_by_placeholder("Ton prénom").fill("Testeur")
    page.get_by_role("button", name="Envoyer").click()

    expect(page).to_have_url(re.compile(".*question"), timeout=10000)
    page.get_by_placeholder("Écris ta question ici...").fill("Mon test va-t-il réussir ?")
    page.get_by_role("button", name="Envoyer la question").click()

    # --- On Page 4 (/draw), verify the initial layout ---
    expect(page).to_have_url(re.compile(".*draw"), timeout=10000)

    # Wait for the main container to be visible
    container = page.locator(".page4-container")
    expect(container).to_be_visible(timeout=10000)

    # Take a screenshot for visual verification of the layout
    page.screenshot(path="jules-scratch/verification/verification_page4_layout.png")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        run_verification(page)
        browser.close()

if __name__ == "__main__":
    main()