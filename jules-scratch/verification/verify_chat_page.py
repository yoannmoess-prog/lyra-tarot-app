from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    )
    page = context.new_page()

    try:
        print("Waiting for dev server to be ready...")
        time.sleep(20) # Attente plus longue pour le démarrage du serveur

        # --- Flux complet de l'application ---
        # 1. Page d'intro
        print("Navigating to homepage...")
        page.goto("http://localhost:5173/", wait_until="networkidle")
        print("Homepage loaded.")

        intro_button = page.get_by_label("Écran d’introduction — touchez, cliquez ou balayez pour continuer")
        expect(intro_button).to_be_visible(timeout=15000)
        intro_button.click()

        # 2. Page Nom
        page.wait_for_url("**/name", timeout=10000)
        page.get_by_placeholder("Ton prénom").fill("Jules")
        page.get_by_role("button", name="Envoyer").click()

        # 3. Page Question
        page.wait_for_url("**/question", timeout=10000)
        page.get_by_placeholder("Écris ta question ici...").fill("Quelles sont les nouvelles fonctionnalités ?")
        page.get_by_role("button", name="Envoyer la question").click()

        # 4. Page Tirage
        page.wait_for_url("**/draw", timeout=10000)
        deck = page.locator(".deck-area")
        expect(deck).to_be_visible()
        # Piocher 3 cartes
        deck.click()
        time.sleep(1.5)
        deck.click()
        time.sleep(1.5)
        deck.click()

        # 5. Page Chat
        page.wait_for_url("**/chat", timeout=20000)
        time.sleep(10) # Attendre l'animation des cartes + première réponse de Lyra

        # --- Vérifications sur la page de Chat ---

        # Vérification 1: Apparence générale
        expect(page.locator(".page5-header")).to_be_visible()
        expect(page.locator(".page5-footer")).to_be_visible()
        expect(page.locator(".you-input")).to_be_visible()
        page.screenshot(path="jules-scratch/verification/01_chat_view.png")
        print("Screenshot 1: Chat view OK")

        # Vérification 2: Zoom sur une carte
        card_to_click = page.locator('.final-card-outer').nth(1)
        expect(card_to_click).to_be_visible()
        card_to_click.click()

        zoom_overlay = page.locator(".card-zoom-overlay")
        expect(zoom_overlay).to_be_visible(timeout=5000)
        time.sleep(1)
        page.screenshot(path="jules-scratch/verification/02_card_zoom.png")
        print("Screenshot 2: Card zoom OK")
        page.locator('.card-zoom-overlay .close-zoom-btn').click()
        expect(zoom_overlay).not_to_be_visible()

        # Vérification 3: Apparition de l'icône de tirage
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(2)
        draw_icon = page.locator(".draw-icon-btn")
        expect(draw_icon).to_be_visible()
        page.screenshot(path="jules-scratch/verification/03_draw_icon_visible.png")
        print("Screenshot 3: Draw icon OK")

        # Vérification 4: Affichage de l'overlay du tirage
        # Utiliser page.evaluate pour le clic, car le header intercepte le pointeur
        page.evaluate("document.querySelector('.draw-icon-btn').click()")

        draw_overlay = page.locator(".draw-overlay")
        expect(draw_overlay).to_be_visible(timeout=5000)
        time.sleep(1)
        page.screenshot(path="jules-scratch/verification/04_draw_overlay.png")
        print("Screenshot 4: Draw overlay OK")
        print("Verification script finished successfully!")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)