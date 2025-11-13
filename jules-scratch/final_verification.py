
import re
from playwright.sync_api import Page, expect, sync_playwright

def run(page: Page):
    # Go to the intro page
    page.goto("http://localhost:5173/")
    expect(page).to_have_title(re.compile(r"Vite \+ React"))

    # --- Intro Page ---
    intro_button = page.locator('main[role="button"]')
    expect(intro_button).to_be_visible()
    intro_button.click()
    expect(page).to_have_url(re.compile(r"/name$"))

    # --- Name Page ---
    name_input = page.get_by_placeholder("Ton prénom")
    expect(name_input).to_be_visible()
    name_input.fill("Jules")
    send_button = page.get_by_role("button", name="Envoyer")
    send_button.click()
    expect(page).to_have_url(re.compile(r"/question$"))

    # --- Question Page ---
    question_input = page.get_by_placeholder("Écris ta question ici...")
    expect(question_input).to_be_visible()
    question_input.fill("Test question?")
    send_question_button = page.get_by_role("button", name="Envoyer la question")
    send_question_button.click()

    # --- Loading and Spread Page ---
    expect(page).to_have_url(re.compile(r"/loading$"), timeout=2000)
    # Wait for the spread page to load after the loading animation
    expect(page).to_have_url(re.compile(r"/spread-advice$"), timeout=15000)

    # --- Verification ---
    # Take a screenshot to verify the navigation to the spread page is successful
    page.screenshot(path="final_verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run(page)
        finally:
            browser.close()
