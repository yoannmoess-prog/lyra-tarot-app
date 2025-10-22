from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        page.goto("http://localhost:5173", wait_until="networkidle", timeout=60000)
        page.screenshot(path="jules-scratch/verification/debug_screenshot.png")

        # Page 1: Intro
        start_button = page.get_by_role("button", name="Commencer")
        expect(start_button).to_be_visible(timeout=30000)
        start_button.click()

        # Page 2: Name
        name_input = page.get_by_placeholder("Écris ton prénom...")
        expect(name_input).to_be_visible()
        name_input.fill("Yoann")
        page.get_by_role("button", name="Continuer").click()

        # Page 3: Question
        question_input = page.get_by_placeholder("Écris ta question ici...")
        expect(question_input).to_be_visible()
        question_input.fill("Je crains de ne pas être à la hauteur.")
        page.get_by_role("button", name="Envoyer la question").click()
        page.wait_for_url("**/draw")

        # Page 4: Draw
        # Simulate drawing 3 cards
        deck = page.locator(".deck-area")
        expect(deck).to_be_visible()
        for _ in range(3):
            deck.click()
            page.wait_for_timeout(1000) # Wait for animation

        page.wait_for_url("**/chat", timeout=60000)

        # Page 5: Chat
        # Wait for the chat to be visible and cards to be flipped
        chat = page.locator(".chat-wrap.show")
        expect(chat).to_be_visible(timeout=30000)

        flipped_cards = page.locator(".final-card-flip.is-flipped")
        expect(flipped_cards).to_have_count(3, timeout=30000)

        # Wait for Lyra's first message to appear
        lyra_message = page.locator(".bubble.lyra .msg")
        expect(lyra_message).to_be_visible(timeout=30000)

        # Take screenshot
        page.screenshot(path="jules-scratch/verification/verification.png")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
