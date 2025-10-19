import re
from playwright.sync_api import Page, expect

def test_take_screenshots(page: Page):
    # Set a higher timeout for the entire test
    page.set_default_timeout(180000) # 180 seconds

    # Navigate to the home page
    page.goto("http://localhost:5177/")

    # Go to draw page
    page.get_by_role("link", name="Commencer").click()
    page.get_by_placeholder("Comment devrais-je vous appeler ?").fill("test")
    page.get_by_role("button", name="Continuer").click()
    page.get_by_placeholder("Posez votre question ici...").fill("test")
    page.get_by_role("button", name="Poser ma question").click()
    expect(page).to_have_url("http://localhost:5177/draw")

    # Take screenshot of the draw page
    page.screenshot(path="jules-scratch/verification/draw_page.png")

    # Go to chat page
    page.get_by_role("button", name="Tirer 3 cartes").click()
    expect(page).to_have_url(re.compile(r"http://localhost:5177/chat\?question=test&cards=.*"))

    # Wait for the AI's response to appear
    lyra_bubble = page.locator('.chat-bubble.ai')
    expect(lyra_bubble.first).to_be_visible()

    # Take screenshot of the chat page
    page.screenshot(path="jules-scratch/verification/chat_page.png")