from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Navigate to the initial page
            page.goto("http://localhost:5173/", timeout=60000)

            # Take a screenshot of the initial page for debugging
            page.screenshot(path="jules-scratch/verification/debug_initial_page.png")
            print("Initial page screenshot taken for debugging.")

            # Click the intro screen to continue
            page.locator('.logo-container').click(timeout=30000)

            # Wait for navigation to the name page and fill in the name
            page.wait_for_url("http://localhost:5173/name", timeout=30000)
            page.get_by_placeholder("Ton prénom...").fill("Test", timeout=30000)
            page.get_by_role("button").click(timeout=30000)

            # Wait for navigation to the question page and fill in the question
            page.wait_for_url("http://localhost:5173/question", timeout=30000)
            page.get_by_placeholder("Écris ta question...").fill("Test question", timeout=30000)
            page.get_by_role("button").click(timeout=30000)

            # Wait for navigation to the cards page
            page.wait_for_url("http://localhost:5173/cards", timeout=30000)
            page.get_by_role("button", name="Tirer 3 cartes").click(timeout=30000)

            # Wait for navigation to the chat page
            page.wait_for_url("http://localhost:5173/chat", timeout=60000)

            # Wait for Lyra's initial bubble to be visible
            page.wait_for_selector(".bubble.lyra", timeout=30000)

            # Take a screenshot of the chat page
            page.screenshot(path="jules-scratch/verification/chat_page_reverted.png")

            print("Screenshot taken successfully.")

        except Exception as e:
            print(f"An error occurred: {e}")

        finally:
            browser.close()

if __name__ == "__main__":
    run()
