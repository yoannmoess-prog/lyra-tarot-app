
import re
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        page.goto("http://localhost:5173/")

        # Attendre que la page d'introduction soit prête
        intro_button = page.locator('main[role="button"]')
        expect(intro_button).to_be_visible(timeout=10000)
        intro_button.click()

        # Remplir le nom
        name_input = page.locator('input#name')
        expect(name_input).to_be_visible(timeout=5000)
        name_input.fill("Jules")
        page.keyboard.press("Enter")

        # Remplir la question
        question_input = page.locator('textarea#question')
        expect(question_input).to_be_visible(timeout=5000)
        question_input.fill("Quelle est ma destinée ?")
        page.keyboard.press("Enter")

        # Attendre la fin du chargement et l'arrivée sur la page de tirage
        expect(page).to_have_url(re.compile(r"/spread-"), timeout=20000)

        # Attendre que le paquet de cartes soit visible
        deck_handle = page.locator("#deck-handle")
        expect(deck_handle).to_be_visible(timeout=10000)

        # Attendre que le rail soit visible
        rail = page.locator(".chosen-rail")
        expect(rail).to_be_visible(timeout=5000)

        # Effectuer le glisser-déposer
        deck_handle.drag_to(rail)

        # Attendre que l'animation de la carte soit terminée
        # On peut vérifier qu'une carte est bien apparue dans le rail
        chosen_card = page.locator(".slot-wrap .card.chosen")
        expect(chosen_card).to_have_count(1, timeout=5000)

        # Prendre la capture d'écran
        page.screenshot(path="jules-scratch/verification/verification.png")

    except Exception as e:
        print(f"Une erreur est survenue: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
