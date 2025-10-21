# jules-scratch/verification/verify_chat_bubble.py
from playwright.sync_api import sync_playwright, expect
import json

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # 1. Naviguer directement vers la page de chat avec les données nécessaires
        chat_data = {
            "name": "Yoann",
            "question": "J'ai peur de sortir dehors",
            "cards": [
                {"name": "La Force", "src": "some_path"},
                {"name": "10 d’Épées", "src": "some_path"},
                {"name": "Roi de Coupes", "src": "some_path"}
            ],
            "isNew": True
        }

        # Le passage de state n'est pas direct avec goto, nous devons utiliser une fonction JS
        page.goto("http://localhost:5173/") # Aller à la page d'accueil pour avoir le contexte
        page.evaluate(f'''() => {{
            const data = {json.dumps(chat_data)};
            window.history.pushState(data, '', '/chat');
            window.dispatchEvent(new PopStateEvent('popstate', {{state: data}}));
        }}''')
        page.goto("http://localhost:5173/chat")


        # 3. Attendre que la réponse de Lyra apparaisse
        lyra_bubble = page.locator('.bubble.lyra .msg').first
        expect(lyra_bubble).to_be_visible(timeout=60000) # Attendre jusqu'à 60 secondes

        # 4. Prendre une capture d'écran
        page.screenshot(path="jules-scratch/verification/verification.png")

    finally:
        browser.close()

with sync_playwright() as p:
    run(p)
