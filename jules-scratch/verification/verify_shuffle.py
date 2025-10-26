
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Naviguer à la racine
        page.goto("http://localhost:5173/")
        page.locator("main").click()

        # Page 'name'
        # Utilise le sélecteur d'ID correct et attend que l'élément soit visible
        name_input = page.locator('input#name')
        expect(name_input).to_be_visible(timeout=10000)
        name_input.fill("Jules")
        page.locator('button[type="submit"]').click()

        # Page 'question'
        question_input = page.locator('textarea')
        expect(question_input).to_be_visible(timeout=10000)
        question_input.fill("Quel est mon avenir ?")
        page.locator('button[type="submit"]').click()


        # Page 'loading' puis 'spread-advice'
        page.wait_for_url("**/spread-advice", timeout=30000)

        # Attendre que l'animation de brassage soit visible
        shuffle_area = page.locator(".deck-area.shuffling")
        expect(shuffle_area).to_be_visible(timeout=10000)

        # Prendre une capture d'écran
        page.screenshot(path="jules-scratch/verification/verification.png")
        print("Screenshot saved to jules-scratch/verification/verification.png")

    except Exception as e:
        print(f"Une erreur est survenue : {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
        print("Error screenshot saved to jules-scratch/verification/error.png")


    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
