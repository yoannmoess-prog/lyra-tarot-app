from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Naviguer à la page d'accueil
        page.goto("http://localhost:5173/")

        # Cliquer sur l'élément principal pour commencer
        page.locator('main[role="button"]').click()

        # Attendre la navigation vers la page /name
        page.wait_for_url("http://localhost:5173/name")

        # Entrer un nom
        page.locator('input[placeholder="Ton prénom"]').fill("Jules")

        # Cliquer sur le bouton d'envoi
        page.locator('button[aria-label="Envoyer"]').click()

        # Attendre la navigation vers la page /question
        page.wait_for_url("http://localhost:5173/question")

        # Entrer la question de test
        question_text = "Je crains ne pas réussir à aller à mon examen du code de la route."
        page.locator('textarea[placeholder="Écris ta question ici..."]').fill(question_text)

        # Cliquer sur le bouton d'envoi
        page.locator('button[aria-label="Envoyer la question"]').click()

        # Attendre la navigation vers la page du tirage - on attend /spread-truth
        page.wait_for_url("http://localhost:5173/spread-truth", timeout=15000)

        # Prendre une capture d'écran
        page.screenshot(path="jules-scratch/verification/verification.png")

        print("Vérification réussie : Redirection vers /spread-truth confirmée.")

    except Exception as e:
        print(f"Une erreur est survenue lors de la vérification : {e}")
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
