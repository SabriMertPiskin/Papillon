from uuid import uuid4

from selenium.webdriver.common.alert import Alert
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.select import Select
from selenium.webdriver.support.ui import WebDriverWait

from tests.selenium.base import PapillonSeleniumTest
from tests.selenium.users import SeleniumUserMixin


class ToolSmokeTests(SeleniumUserMixin, PapillonSeleniumTest):
    def setUp(self):
        super().setUp()
        self.login_default_user()

    def test_password_strength_tool(self):
        self.visit("/password-strength")
        self.wait_for_body_text("Password Strength Analysis")
        self.fill("input[placeholder*='Type a password']", "PapillonStrong123!")
        self.wait_for_body_text("Strength meter")
        body = self.body_text()
        self.assertIn("Contains uppercase letter", body)
        self.assertIn("Contains lowercase letter", body)
        self.assertIn("Contains number", body)
        self.assertTrue("Strong" in body or "Very Strong" in body)

    def test_encryption_base64_round_trip(self):
        self.visit("/encryption")
        self.wait_for_body_text("Text Encryption")
        selects = self.driver.find_elements(By.TAG_NAME, "select")
        Select(selects[0]).select_by_visible_text("Base64 (Not Encryption)")
        self.pause()

        plaintext = "Papillon Selenium Round Trip"
        self.fill("textarea[placeholder*='Secret military']", plaintext)
        self.click_text("Encrypt")
        self.wait_for_body_text("Base64 Output", timeout=30)
        encoded = self.driver.find_element(By.CSS_SELECTOR, ".encrypt-card .result-box code").text.strip()
        self.assertTrue(encoded)

        Select(selects[1]).select_by_visible_text("Base64 (Decode)")
        self.pause()
        self.fill("textarea[placeholder*='U2FsdGVk']", encoded)
        self.click_text("Decrypt")
        self.wait_for_body_text("Original / Decrypted Text", timeout=30)
        self.assertIn(plaintext, self.body_text())

    def test_cve_selector_smoke(self):
        self.visit("/cve")
        self.wait_for_body_text("Latest Vulnerabilities")
        select_el = WebDriverWait(self.driver, 30).until(
            lambda driver: (
                driver.find_element(By.TAG_NAME, "select")
                if driver.find_element(By.TAG_NAME, "select").is_enabled()
                and len(driver.find_element(By.TAG_NAME, "select").find_elements(By.TAG_NAME, "option")) > 0
                else False
            )
        )
        select = Select(select_el)
        enabled_options = [
            option.text.strip()
            for option in select.options
            if option.text.strip()
        ]
        self.assertTrue(enabled_options)
        select.select_by_visible_text(enabled_options[-1])
        self.pause()
        self.assertEqual(select.first_selected_option.text.strip(), enabled_options[-1])

    def test_outlook_modals_smoke(self):
        self.visit("/outlook-integration")
        self.wait_for_body_text("Outlook Integration")
        self.click_text("Connect Outlook")
        self.wait_for_body_text("Client ID", timeout=20)
        self.click_text("Cancel")
        self.click_text("How to get Client ID/Secret")
        self.wait_for_body_text("Register a New Application", timeout=20)
        self.click_text("Close")

    def test_phishing_history_filters_smoke(self):
        self.visit("/phishing-history")
        self.wait_for_body_text("AI Phishing Alert History")
        self.fill("input[placeholder*='Search by sender or subject']", "invoice")
        filter_select = Select(self.driver.find_element(By.CSS_SELECTOR, "select.filter-select"))
        filter_select.select_by_visible_text("Suspicious Only")
        self.pause()
        self.assertEqual(filter_select.first_selected_option.text.strip(), "Suspicious Only")

    def test_blacklist_add_and_remove_ip(self):
        self.visit("/blacklist")
        self.wait_for_body_text("Block New IP Address")

        ip_value = f"203.0.113.{int(uuid4().hex[:2], 16) % 200 + 1}"
        self.fill("input[placeholder*='192.168']", ip_value)
        self.fill("input[placeholder*='Port scanning']", "Selenium blacklist test")
        self.click_text("Add to Blacklist")
        self.wait_for_body_text("successfully added", timeout=30)
        self.assertIn(ip_value, self.body_text())

        remove_button = self.driver.find_element(
            By.XPATH,
            f"//tr[td[contains(normalize-space(.), '{ip_value}')]]//button[contains(normalize-space(.), 'Remove')]",
        )
        remove_button.click()
        self.pause()
        WebDriverWait(self.driver, 10).until(EC.alert_is_present())
        Alert(self.driver).accept()
        self.wait_for_body_text("removed from blacklist", timeout=30)
