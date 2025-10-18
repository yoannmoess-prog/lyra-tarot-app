from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Naviguer vers la page de démonstration
    page.goto("http://localhost:5173/spreads-demo")

    # Attendre que la page soit chargée
    page.wait_for_selector(".sd-wrap")

    # Remplir une question et cliquer sur le bouton pour afficher les cartes
    page.fill("#q", "Comment puis-je améliorer ma relation avec mes collègues ?")
    page.click("button[type='submit']")

    # Attendre que les cartes apparaissent
    page.wait_for_selector(".sd-cards")

    # Prendre une capture d'écran
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)