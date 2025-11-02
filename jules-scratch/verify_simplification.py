
import re
from playwright.sync_api import sync_playwright, Page, expect

def run_test(page: Page):
    """
    Ce test vérifie que l'interaction a été simplifiée en une seule action de clic.
    Toute tentative de glisser une carte depuis le paquet doit immédiatement la
    placer dans le prochain emplacement disponible.
    """
    # 1. Arrange: Naviguer et compléter le flux utilisateur.
    page.goto("http://localhost:5173/")
    page.locator('main[role="button"]').click()
    expect(page).to_have_url(re.compile(r'.*/name'))
    page.locator('input#name').fill('Jules')
    page.locator('button[type="submit"]').click()
    expect(page).to_have_url(re.compile(r'.*/question'))
    page.locator('textarea#question').fill('Quelle est ma destinée ?')
    page.locator('button[type="submit"]').click()

    # 2. Act: Attendre la navigation vers la page du tirage.
    expect(page).to_have_url(re.compile(r'.*/spread-'), timeout=20000)

    # Simuler un glisser-déposer sur la poignée du paquet.
    deck_handle = page.locator('#deck-handle')
    # Glisser vers un point arbitraire pour simuler une action de glissement.
    deck_handle.drag_to(page.locator('body'), target_position={'x': 100, 'y': 100})

    # 3. Assert: Vérifier que la carte est bien dans le premier emplacement.
    # Le data-testid pour les emplacements a été ajouté manuellement pour la robustesse.
    # NOTE: Cette information provient d'une exécution précédente. S'il échoue, il faudra inspecter le DOM.
    # Pour le moment, nous nous basons sur la structure visuelle.
    first_slot_card = page.locator('.chosen-rail .slot-wrap:first-child .card.chosen')
    expect(first_slot_card).to_be_visible(timeout=5000)

    # 4. Screenshot: Capturer le résultat.
    page.screenshot(path="/home/swebot/jules-scratch/verification/verification.png")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        run_test(page)
        browser.close()

if __name__ == "__main__":
    main()
