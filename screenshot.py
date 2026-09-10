from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:3000')

    page.wait_for_timeout(1000)
    page.click("button:has-text('View Instant Static Demo')")
    page.wait_for_timeout(1000)

    loc = page.locator("button:has-text('Reactive DB Store')")
    loc.click()

    page.wait_for_timeout(2000)

    page.click("text='Tenant Isolation'")

    page.wait_for_timeout(2000)

    # Click the "Multi-Tenant Isolation" tab
    page.click("text='Multi-Tenant Isolation'")

    page.wait_for_timeout(2000)

    page.click("button:has-text('+ Onboard New Tenant')")

    page.wait_for_timeout(1000)

    page.screenshot(path='form_screenshot_6.png')

    browser.close()
