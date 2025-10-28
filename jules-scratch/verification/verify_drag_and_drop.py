
import re
from playwright.sync_api import Playwright, sync_playwright, expect
import json

def run(playwright: Playwright) -> None:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Naviguer directement vers la page de tirage pour isoler le test
    page.goto("http://localhost:5173/spread-advice")

    # Attendre que le paquet de cartes soit visible
    deck_handle = page.locator("#deck-handle")
    expect(deck_handle).to_be_visible(timeout=10000)

    # Simuler un glisser-déposer
    rail = page.locator(".chosen-rail")
    expect(rail).to_be_visible()

    # Coordonnées pour le glisser-déposer
    deck_box = deck_handle.bounding_box()
    rail_box = rail.bounding_box()

    if not deck_box or not rail_box:
        raise Exception("Impossible de récupérer les dimensions des éléments pour le test.")

    # Simuler le glisser-déposer avec des mouvements de souris plus réalistes
    page.mouse.move(deck_box['x'] + deck_box['width'] / 2, deck_box['y'] + deck_box['height'] / 2)
    page.mouse.down()
    page.mouse.move(rail_box['x'] + rail_box['width'] / 2, rail_box['y'] + rail_box['height'] / 2, steps=5)
    page.mouse.up()

    # Donner le temps à l'animation de se terminer
    page.wait_for_timeout(1000)

    # Prendre une capture d'écran
    page.screenshot(path="jules-scratch/verification/verification.png")

    # Fermer le navigateur
    context.close()
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
