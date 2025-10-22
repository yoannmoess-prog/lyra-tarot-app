
from playwright.sync_api import sync_playwright, expect
import re

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        try:
            # 1. Naviguer et passer l'intro
            page.goto("http://localhost:5177/")
            page.locator("main.intro-root").click()

            # 2. Remplir le nom
            expect(page).to_have_url("http://localhost:5177/name", timeout=10000)
            page.locator('input[placeholder="Ton prénom"]').fill("Testeur")
            page.locator('button[aria-label="Envoyer"]').click()

            # 3. Attendre la page de question et que l'animation d'arrivée soit terminée
            expect(page).to_have_url("http://localhost:5177/question", timeout=10000)

            question_form = page.locator("form.question-inner")
            # Utiliser une regex pour correspondre à la classe, en ignorant les espaces superflus
            expect(question_form).to_have_class(re.compile(r"question-inner\s+arrive"), timeout=10000)

            question_input = page.locator('textarea[placeholder*="Écris ta question ici..."]')
            expect(question_input).to_be_visible()
            question_input.fill("J'ai peur de ne pas être à la hauteur.")

            page.locator('button[aria-label="Envoyer la question"]').click()

            # 4. Piocher les cartes
            expect(page).to_have_url("http://localhost:5177/draw", timeout=10000)
            deck = page.locator(".deck-area")
            expect(deck).to_be_visible()
            deck.click()
            page.wait_for_timeout(1000)
            deck.click()
            page.wait_for_timeout(1000)
            deck.click()

            # 5. Vérifier la page de chat
            expect(page).to_have_url("http://localhost:5177/chat", timeout=15000)

            spread_title = page.locator(".spread-title")
            expect(spread_title).to_have_text("tirage verite", timeout=5000)

            lyra_bubble = page.locator(".bubble.lyra .msg p")
            expect(lyra_bubble.first).to_be_visible(timeout=20000)

            page.screenshot(path="jules-scratch/verification/verification.png")
            print("Vérification terminée, capture d'écran sauvegardée.")

        except Exception as e:
            print(f"Une erreur est survenue lors de la vérification : {e}")
            page.screenshot(path="jules-scratch/verification/error.png")

        finally:
            browser.close()

if __name__ == "__main__":
    run_verification()
