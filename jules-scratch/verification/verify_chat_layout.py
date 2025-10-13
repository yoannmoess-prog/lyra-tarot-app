import time
from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Naviguer vers la page d'accueil
        page.goto("http://localhost:5173", timeout=60000)

        # Étape 1: Cliquer sur l'écran d'introduction
        intro_button = page.get_by_role("button", name="Écran d’introduction — touchez, cliquez ou balayez pour continuer")
        expect(intro_button).to_be_visible(timeout=15000)
        intro_button.click()

        # Étape 2: Page du nom
        page.wait_for_url("http://localhost:5173/name", timeout=15000)
        expect(page.get_by_role("heading", name="Commençons par faire connaissance. Je m’appelle Lyra, et toi ?")).to_be_visible(timeout=10000)

        name_input = page.get_by_placeholder("Ton prénom")
        name_input.fill("Jules")

        page.get_by_role("button", name="Envoyer").click()

        # Étape 3: Page de la question
        page.wait_for_url("http://localhost:5173/question", timeout=15000)
        expect(page.get_by_role("heading", name="Quelle est ta question ?")).to_be_visible(timeout=10000)

        question_input = page.get_by_placeholder("Pose ta question à Lyra...")
        question_input.fill("Quel est mon avenir ?")

        page.get_by_role("button", name="Envoyer").click()

        # Étape 4: Page du tirage
        page.wait_for_url("http://localhost:5173/draw", timeout=15000)
        expect(page.get_by_role("heading", name="Tirage en croix")).to_be_visible(timeout=10000)

        page.get_by_role("button", name="Tirer 3 cartes").click()

        # Étape 5: Page de chat
        page.wait_for_url("http://localhost:5173/chat", timeout=25000)

        header = page.locator("header.page5-header")
        expect(header).to_be_visible(timeout=15000)

        footer = page.locator("footer.page5-footer")
        expect(footer).to_be_visible(timeout=15000)

        first_bubble = page.locator(".bubble.lyra").first
        expect(first_bubble).to_be_visible(timeout=25000)

        page.screenshot(path="jules-scratch/verification/chat-layout-final.png")
        print("Verification screenshot saved to jules-scratch/verification/chat-layout-final.png")

    except Exception as e:
        print(f"An error occurred during verification: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        browser.close()

with sync_playwright() as p:
    run_verification(p)