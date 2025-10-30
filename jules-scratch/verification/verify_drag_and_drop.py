from playwright.sync_api import sync_playwright, expect
import time

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # 1. Naviguer directement à la page du tirage
        # La mémoire indique que le port peut varier, j'utilise un port commun.
        page.goto("http://localhost:5173/spread-advice")

        # 2. Attendre que le paquet de cartes soit visible
        deck_handle = page.locator("#deck-handle")
        expect(deck_handle).to_be_visible(timeout=10000)

        # 3. Simuler le glisser-déposer
        rail = page.locator(".chosen-rail")

        # Obtenir les boîtes de délimitation
        deck_box = deck_handle.bounding_box()
        rail_box = rail.bounding_box()

        # Commencer le glissement
        page.mouse.move(deck_box['x'] + deck_box['width'] / 2, deck_box['y'] + deck_box['height'] / 2)
        page.mouse.down()

        # Déplacer la souris vers une position intermédiaire pour la capture d'écran
        page.mouse.move(deck_box['x'] + deck_box['width'] / 2 + 100, deck_box['y'] + deck_box['height'] / 2 - 50, steps=10)

        # 4. Prendre la capture d'écran
        page.screenshot(path="jules-scratch/verification/verification.png")

        # Terminer le glissement
        page.mouse.move(rail_box['x'] + rail_box['width'] / 2, rail_box['y'] + rail_box['height'] / 2, steps=10)
        page.mouse.up()

        print("Vérification terminée avec succès.")

    except Exception as e:
        print(f"Une erreur est survenue: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run_verification(playwright)
