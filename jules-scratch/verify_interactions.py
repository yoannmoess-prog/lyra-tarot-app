# jules-scratch/verify_interactions.py
import os
import re
from playwright.sync_api import sync_playwright, expect

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        base_url = os.environ.get("BASE_URL", "http://localhost:5174")

        try:
            print("Navigating to the application...")
            page.goto(base_url)

            print("On Intro Page, clicking to continue...")
            page.locator('main[role="button"]').click()

            print("On Name Page, entering name and continuing...")
            page.wait_for_selector("input#name", timeout=5000)
            page.fill("input#name", "Testeur")
            page.get_by_role("button", name=re.compile(r"Continuer", re.IGNORECASE)).click()

            print("On Question Page, entering question and continuing...")
            page.wait_for_selector("textarea#question", timeout=5000)
            page.fill("textarea#question", "Est-ce que le test fonctionne ?")
            page.get_by_role("button", name=re.compile(r"Continuer", re.IGNORECASE)).click()

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

            # Verify deck did not move
            current_deck_box = deck_area.bounding_box()
            print(f"Deck position after click: {current_deck_box}")
            assert initial_deck_box == current_deck_box, "Deck moved after click!"
            print("Deck position is stable after click. OK.")


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

            # Verify deck did not move
            current_deck_box_after_drag = deck_area.bounding_box()
            print(f"Deck position after drag: {current_deck_box_after_drag}")
            assert initial_deck_box == current_deck_box_after_drag, "Deck moved after drag!"
            print("Deck position is stable after drag. OK.")

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
