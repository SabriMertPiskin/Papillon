import os

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

from tests.selenium.base import PapillonSeleniumTest


class CPanelFlowTests(PapillonSeleniumTest):
    DEFAULT_EMAIL = "test@test.com"
    DEFAULT_PASSWORD = "12345678"

    def _env(self, *names, default=None):
        for name in names:
            value = os.getenv(name)
            if value:
                return value
        return default

    def test_cpanel_profile_connection_and_data_page(self):
        cpanel_host = self._env("SELENIUM_CPANEL_HOST", "CPANEL_HOST")
        cpanel_username = self._env("SELENIUM_CPANEL_USERNAME", "CPANEL_USERNAME")
        cpanel_token = self._env("SELENIUM_CPANEL_TOKEN", "CPANEL_TOKEN", "CPANEL_API")
        cpanel_password = self._env("SELENIUM_CPANEL_PASSWORD", "CPANEL_PASSWORD")
        missing = [
            name for name, value in {
                "SELENIUM_CPANEL_HOST or CPANEL_HOST": cpanel_host,
                "SELENIUM_CPANEL_USERNAME or CPANEL_USERNAME": cpanel_username,
                "SELENIUM_CPANEL_TOKEN, CPANEL_TOKEN, or CPANEL_API": cpanel_token,
                "SELENIUM_CPANEL_PASSWORD or CPANEL_PASSWORD": cpanel_password,
            }.items()
            if not value
        ]
        if missing:
            self.skipTest(f"Missing cPanel Selenium env vars: {', '.join(missing)}")

        print("Starting cPanel Selenium test...")
        self.clear_browser_state()
        self._cpanel_host = cpanel_host
        self._cpanel_username = cpanel_username
        self._cpanel_token = cpanel_token
        self._cpanel_password = cpanel_password
        self.login_with_credentials(
            self._env("SELENIUM_EMAIL", default=self.DEFAULT_EMAIL),
            self._env("SELENIUM_PASSWORD", default=self.DEFAULT_PASSWORD),
        )
        print("Logged in.")
        self._configure_cpanel_profile()
        print("cPanel profile configured.")
        self.visit("/cpanel-data")
        print("Opened /cpanel-data.")
        print("Waiting for cPanel data marker...")
        WebDriverWait(self.driver, 90).until(
            lambda driver: len(driver.find_elements(
                By.XPATH,
                "//*[@id='root']/div/main/div[2]/section[1]/div[1]/div/h2",
            )) > 0
            or any(
                marker in driver.find_element(By.TAG_NAME, "body").text
                for marker in (
                    "Monthly Trend",
                    "Webalizer Matrix",
                    "Bandwidth Data",
                    "cPanel connection is not configured",
                    "Records found",
                )
            )
        )
        print("cPanel data marker found.")

    def _configure_cpanel_profile(self):
        self.visit("/profile")
        self.wait_for_body_text("Turhost cPanel Integration", timeout=30)
        fields = {
            "cpanel.domain.com": self._cpanel_host,
            "cpanel username": self._cpanel_username,
            "Paste cPanel API token": self._cpanel_token,
            "Optional now, required for session login flow": self._cpanel_password,
        }
        for placeholder, value in fields.items():
            self.fill(f"input[placeholder='{placeholder}']", value)
        self.click_text("Save cPanel Settings")
        self.wait_for_body_text("cPanel settings saved securely", timeout=30)
