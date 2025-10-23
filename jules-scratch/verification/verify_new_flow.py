from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Attendre un peu pour que le serveur de dev soit prêt
        page.wait_for_timeout(5000)

        # 1. Naviguer vers la page d'introduction pour commencer le flux
        page.goto("http://localhost:5173/intro", timeout=60000)

        # 2. Remplir le nom sur la page d'après
        page.get_by_role("button", name="Écran d’introduction — touchez, cliquez ou balayez pour continuer").click()
        page.wait_for_url("http://localhost:5173/name")
        page.get_by_placeholder("Ton prénom").fill("Jules")
        page.get_by_role("button", name="Envoyer").click()

        # 3. Poser une question qui devrait déclencher le "spread-truth"
        page.wait_for_url("http://localhost:5173/question")
        page.get_by_placeholder("Écris ta question ici...").fill("J'ai un peu peur de mon entretien d'embauche...")
        page.get_by_role("button", name="Envoyer la question").click()

        # 4. Attendre la page de chargement, puis la page de tirage
        page.wait_for_url("http://localhost:5173/loading", timeout=5000)
        print("Page de chargement atteinte.")

        # Attendre que la redirection vers la page de tirage soit terminée
        # On s'attend à être redirigé vers /spread-truth
        page.wait_for_url("http://localhost:5173/spread-truth", timeout=15000)
        print("Page de tirage 'spread-truth' atteinte.")

        # 5. Prendre une capture d'écran de la page de tirage
        page.screenshot(path="jules-scratch/verification/verification.png")
        print("Capture d'écran prise avec succès.")

    except Exception as e:
        print(f"Une erreur est survenue : {e}")
        # En cas d'erreur, on prend quand même une capture pour le débogage
        page.screenshot(path="jules-scratch/verification/error_screenshot.png")


    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
