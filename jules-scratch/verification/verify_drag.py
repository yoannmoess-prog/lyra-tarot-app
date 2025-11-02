from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Naviguer directement à la page de tirage
        page.goto("http://localhost:5173/spread-advice")

        # Attendre que la page se charge et que les animations initiales se terminent
        page.wait_for_selector(".deck-area", timeout=10000)

        # Localiser la poignée de glissement et le rail de destination
        handle = page.locator("#deck-handle")
        rail = page.locator(".chosen-rail")

        # Effectuer le glisser-déposer
        handle.drag_to(rail, target_position={"x": 100, "y": 100})

        # Prendre une capture d'écran pour vérification visuelle
        page.screenshot(path="jules-scratch/verification/verification.png")

    except Exception as e:
        print(f"Une erreur est survenue : {e}")
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        # Nettoyage
        context.close()
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
