import re
from playwright.sync_api import sync_playwright, Page, expect

def run_verification(page: Page):
    """
    This script verifies the new user flow after splitting Page 4 into Page 4 and 5.
    It's been made more robust with longer timeouts and more specific selectors.
    """
    # Increase the default timeout for all actions
    page.set_default_timeout(60000) # 60 seconds

    # Start at the root and wait for the network to be idle
    page.goto("http://localhost:5173/", wait_until="networkidle")

    # --- 1. Intro Page ---
    # Wait for the main clickable area to be visible
    intro_button = page.get_by_role("button", name="Écran d’introduction — touchez, cliquez ou balayez pour continuer")
    expect(intro_button).to_be_visible()
    intro_button.click()

    # --- 2. Name Page ---
    expect(page).to_have_url(re.compile(".*name"), timeout=10000)
    name_input = page.get_by_placeholder("Ton prénom")
    expect(name_input).to_be_visible()
    name_input.fill("Testeur")
    page.get_by_role("button", name="Envoyer").click()

    # --- 3. Question Page ---
    expect(page).to_have_url(re.compile(".*question"), timeout=10000)
    question_input = page.get_by_placeholder("Écris ta question ici...")
    expect(question_input).to_be_visible()
    question_input.fill("Mon test va-t-il réussir ?")
    page.get_by_role("button", name="Envoyer la question").click()

    # --- 4. Draw Page ---
    expect(page).to_have_url(re.compile(".*draw"), timeout=10000)
    deck_area = page.locator(".deck-area")
    expect(deck_area).to_be_visible()
    deck_area.click()
    deck_area.click()
    deck_area.click()

    # --- 5. Chat Page ---
    expect(page).to_have_url(re.compile(".*chat"), timeout=15000)
    final_rail = page.locator(".final-rail")
    expect(final_rail).to_be_visible()

    # Wait for all 3 cards to be flipped
    flipped_cards = final_rail.locator(".final-card-flip.is-flipped")
    expect(flipped_cards).to_have_count(3, timeout=10000)

    # Wait for the chat to appear
    chat = page.locator(".chat-wrap.show")
    expect(chat).to_be_visible()

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/verification.png")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        run_verification(page)
        browser.close()

if __name__ == "__main__":
    main()