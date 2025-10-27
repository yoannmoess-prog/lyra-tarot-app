
import time
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # 1. Naviguer vers la page d'introduction
        page.goto("http://localhost:5173/", timeout=60000)

        # 2. Démarrer le flux utilisateur
        page.locator('main.intro-root').click()
        page.wait_for_url("**/name", timeout=5000)

        # 3. Entrer le nom
        page.locator('input#name').fill("Jules")
        page.locator('button[type="submit"]').click()
        page.wait_for_url("**/question", timeout=5000)

        # 4. Entrer une question valide
        page.get_by_placeholder("Écris ta question ici...").fill("Quelle est la meilleure voie à suivre pour mon projet ?")
        page.locator('button[type="submit"]').click()
        page.wait_for_url("**/loading", timeout=5000)

        # 5. Attendre la fin de la page de chargement et l'arrivée sur la page de tirage
        page.wait_for_url("**/spread-advice", timeout=15000) # Timeout plus long pour l'API

        # 6. Attendre que l'animation de brassage commence
        page.wait_for_selector(".shuffling", timeout=5000)

        # Laisser le temps à l'animation de jouer un peu pour la capture d'écran
        time.sleep(2.5)

        # 7. Prendre une capture d'écran
        screenshot_path = "jules-scratch/verification/verification.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
