# jules-scratch/verify_interactions.py
import re
import time
from playwright.sync_api import sync_playwright, expect

def get_server_url(log_file="dev_server.log", retries=5, delay=2):
    """Reads the server log file to find the Local URL."""
    for i in range(retries):
        try:
            with open(log_file, "r") as f:
                log_content = f.read()
            match = re.search(r"➜  Local:   (http://localhost:\d+)", log_content)
            if match:
                url = match.group(1)
                print(f"Found server URL: {url}")
                return url
        except FileNotFoundError:
            print(f"Log file not found. Retrying in {delay}s...")
        time.sleep(delay)
    raise RuntimeError("Could not find server URL in log file.")

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            base_url = get_server_url()
            print(f"Navigating to the application at {base_url}...")
            page.goto(base_url)

            print("On Intro Page, clicking to continue...")
            page.locator('main[role="button"]').click()

            print("On Name Page, entering name and continuing...")
            page.wait_for_selector("input#name", timeout=5000)
            page.fill("input#name", "Testeur")
            # Correct selector for the submit button on the name page
            page.locator('button[aria-label="Envoyer"]').click()

            print("On Question Page, entering question and continuing...")
            page.wait_for_selector("textarea#question", timeout=5000)
            page.fill("textarea#question", "Est-ce que le test fonctionne ?")
            # Correct selector for the submit button on the question page
            page.locator('button[type="submit"]').click()

            print("On Loading Page, waiting for navigation to spread page...")
            page.wait_for_url(re.compile(r"/spread-"), timeout=15000)
            print(f"Navigated to {page.url}")

            deck_handle_selector = "#deck-handle"
            print(f"Waiting for deck handle '{deck_handle_selector}' to be visible...")
            deck_handle = page.locator(deck_handle_selector)
            expect(deck_handle).to_be_visible(timeout=10000)
            print("Deck handle is visible.")

            # Get initial position of the deck
            deck_area_selector = ".deck-area"
            deck_area = page.locator(deck_area_selector)
            initial_deck_box = deck_area.bounding_box()
            print(f"Initial deck position: {initial_deck_box}")

            # --- Test 1: Click to draw first card ---
            print("\n--- Testing: Click to draw ---")
            deck_handle.click()
            print("Clicked on the deck.")

            # Verify the card is in the first slot
            first_slot_selector = ".slot-wrap:nth-child(1) .card.chosen"
            expect(page.locator(first_slot_selector)).to_be_visible(timeout=5000)
            print("First card appeared in the correct slot.")

            # Verify deck did not move (with tolerance)
            current_deck_box = deck_area.bounding_box()
            print(f"Deck position after click: {current_deck_box}")

            # Allow for a small tolerance in position and size
            tolerance = 15 # pixels, increased tolerance for headless rendering variations
            assert abs(initial_deck_box['x'] - current_deck_box['x']) < tolerance, "Deck moved horizontally after click!"
            assert abs(initial_deck_box['y'] - current_deck_box['y']) < tolerance, "Deck moved vertically after click!"
            assert abs(initial_deck_box['width'] - current_deck_box['width']) < tolerance, "Deck resized horizontally after click!"
            assert abs(initial_deck_box['height'] - current_deck_box['height']) < tolerance, "Deck resized vertically after click!"

            print("Deck position is stable after click (within tolerance). OK.")


            # --- Test 2: Drag and drop to draw second card ---
            print("\n--- Testing: Drag and drop ---")
            rail_selector = ".chosen-rail"
            rail = page.locator(rail_selector)
            expect(rail).to_be_visible()

            deck_handle.drag_to(rail)
            print("Dragged from deck to rail.")

            # Verify the card is in the second slot
            second_slot_selector = ".slot-wrap:nth-child(2) .card.chosen"
            expect(page.locator(second_slot_selector)).to_be_visible(timeout=5000)
            print("Second card appeared in the correct slot.")

            # Verify deck did not move (with tolerance)
            current_deck_box_after_drag = deck_area.bounding_box()
            print(f"Deck position after drag: {current_deck_box_after_drag}")

            tolerance = 15 # pixels, increased tolerance for headless rendering variations
            assert abs(initial_deck_box['x'] - current_deck_box_after_drag['x']) < tolerance, "Deck moved horizontally after drag!"
            assert abs(initial_deck_box['y'] - current_deck_box_after_drag['y']) < tolerance, "Deck moved vertically after drag!"
            assert abs(initial_deck_box['width'] - current_deck_box_after_drag['width']) < tolerance, "Deck resized horizontally after drag!"
            assert abs(initial_deck_box['height'] - current_deck_box_after_drag['height']) < tolerance, "Deck resized vertically after drag!"

            print("Deck position is stable after drag (within tolerance). OK.")

            print("\n✅ All interaction tests passed successfully!")

        except Exception as e:
            print(f"\n❌ An error occurred: {e}")
            page.screenshot(path="error_screenshot.png")
            print("Screenshot saved to error_screenshot.png")
            raise

        finally:
            browser.close()

if __name__ == "__main__":
    run_test()
