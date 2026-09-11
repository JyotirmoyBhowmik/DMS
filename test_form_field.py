from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Intercept any native dialogs to prevent hanging
        page.on("dialog", lambda dialog: dialog.accept())

        # Go directly to route to open the modal
        page.goto("http://localhost:3000/#/control/users")

        # Click view static demo first
        page.click("text=View Instant Static Demo")
        page.click("text=Reactive DB Store")

        # Open add new user modal
        page.click("text=+ Add New User")
        page.wait_for_timeout(1000)

        # Wait for the modal and specifically form fields to appear
        page.wait_for_selector("input")

        # Evaluate DOM attributes of a FormField input
        input_id = page.evaluate('document.querySelector("input").getAttribute("id")')
        label_for = page.evaluate('document.querySelector("label").getAttribute("for")')

        print(f"Input ID: {input_id}")
        print(f"Label For: {label_for}")

        page.screenshot(path="form_field.png", full_page=True)
        browser.close()

if __name__ == "__main__":
    verify()