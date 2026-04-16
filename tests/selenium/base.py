import os
import shutil
import tempfile
import time
import unittest
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


class PapillonSeleniumTest(unittest.TestCase):
    BASE_URL = os.getenv("SELENIUM_BASE_URL", "http://localhost:5173").rstrip("/")
    HEADLESS = os.getenv("SELENIUM_HEADLESS", "0").lower() in {"1", "true", "yes"}
    STEP_SLEEP = float(os.getenv("SELENIUM_STEP_SLEEP", "0"))
    TIMEOUT = int(os.getenv("SELENIUM_TIMEOUT", "30"))
    ARTIFACT_DIR = Path(os.getenv("SELENIUM_ARTIFACT_DIR", "tests/selenium/artifacts"))

    def setUp(self):
        profile_root = self.ARTIFACT_DIR / "chrome_profiles"
        profile_root.mkdir(parents=True, exist_ok=True)
        self._chrome_profile_dir = tempfile.mkdtemp(
            prefix="papillon-selenium-chrome-",
            dir=str(profile_root.resolve()),
        )
        options = webdriver.ChromeOptions()
        if self.HEADLESS:
            options.add_argument("--headless=new")
        options.add_argument(f"--user-data-dir={self._chrome_profile_dir}")
        options.add_argument("--remote-debugging-port=0")
        options.add_argument("--no-first-run")
        options.add_argument("--no-default-browser-check")
        options.add_argument("--window-size=1440,1000")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--no-sandbox")
        self.driver = webdriver.Chrome(options=options)
        self.wait = WebDriverWait(self.driver, self.TIMEOUT)

    def tearDown(self):
        if hasattr(self, "driver"):
            self.driver.quit()
        if hasattr(self, "_chrome_profile_dir"):
            shutil.rmtree(self._chrome_profile_dir, ignore_errors=True)

    def pause(self):
        if self.STEP_SLEEP > 0:
            time.sleep(self.STEP_SLEEP)

    def visit(self, path):
        self.driver.get(f"{self.BASE_URL}{path}")
        self.pause()

    def body_text(self):
        return self.driver.find_element(By.TAG_NAME, "body").text

    def wait_for_body_text(self, text, timeout=None):
        WebDriverWait(self.driver, timeout or self.TIMEOUT).until(
            lambda driver: text in driver.find_element(By.TAG_NAME, "body").text
        )

    def wait_for_any_body_text(self, *texts, timeout=None):
        WebDriverWait(self.driver, timeout or self.TIMEOUT).until(
            lambda driver: any(text in driver.find_element(By.TAG_NAME, "body").text for text in texts)
        )

    def wait_for_url_contains(self, text, timeout=None):
        WebDriverWait(self.driver, timeout or self.TIMEOUT).until(EC.url_contains(text))

    def save_debug_artifacts(self, name):
        self.ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
        safe_name = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in name)
        html_path = self.ARTIFACT_DIR / f"{safe_name}.html"
        png_path = self.ARTIFACT_DIR / f"{safe_name}.png"
        html_path.write_text(self.driver.page_source, encoding="utf-8")
        self.driver.save_screenshot(str(png_path))

    def clear_browser_state(self):
        self.visit("/login")
        self.driver.execute_script("localStorage.clear(); sessionStorage.clear();")
        self.driver.delete_all_cookies()
        self.pause()

    def fill(self, selector, value):
        element = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
        element.clear()
        element.send_keys(value)
        self.pause()
        return element

    def click_text(self, *labels):
        labels_lower = [label.lower() for label in labels]
        candidates = self.driver.find_elements(By.CSS_SELECTOR, "button, a, [role='button'], .module-card")
        candidate_texts = []
        for candidate in candidates:
            text = (
                self.driver.execute_script(
                    "return (arguments[0].textContent || arguments[0].innerText || arguments[0].ariaLabel || '').trim();",
                    candidate,
                )
                or ""
            )
            normalized = " ".join(text.lower().split())
            candidate_texts.append((candidate, normalized))

        for matcher in (
            lambda text, label: text == label,
            lambda text, label: text.startswith(label),
            lambda text, label: label in text,
        ):
            for candidate, text in candidate_texts:
                if any(matcher(text, label) for label in labels_lower):
                    self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", candidate)
                    self.pause()
                    self.driver.execute_script("arguments[0].click();", candidate)
                    self.pause()
                    return candidate
        raise AssertionError(f"Could not find clickable text: {labels}")

    def login_with_credentials(self, email, password, expect_success=True):
        self.visit("/login")
        self.fill("input[type='email']", email)
        self.fill("input[name='password']", password)
        self.click_text("Sign In")
        if expect_success:
            self.wait_for_url_contains("/dashboard", timeout=40)
            self.wait_for_body_text("Papillon security dashboard", timeout=40)
        else:
            self.wait_for_body_text("Invalid email or password", timeout=20)
        self.pause()

    def logout(self):
        self.visit("/dashboard")
        try:
            self.click_text("Logout")
            self.wait_for_url_contains("/login", timeout=20)
        except TimeoutException:
            self.driver.execute_script("localStorage.clear(); sessionStorage.clear();")
            self.driver.delete_all_cookies()
            self.visit("/login")
        self.pause()
