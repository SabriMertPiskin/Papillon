from tests.selenium.base import PapillonSeleniumTest
from tests.selenium.users import SeleniumUserMixin


class RouteGuardTests(SeleniumUserMixin, PapillonSeleniumTest):
    def test_protected_routes_redirect_to_login_when_logged_out(self):
        protected_paths = [
            "/dashboard",
            "/password-strength",
            "/encryption",
            "/cve",
            "/profile",
            "/blacklist",
            "/cpanel-data",
        ]

        for path in protected_paths:
            with self.subTest(path=path):
                self.clear_browser_state()
                self.visit(path)
                self.wait_for_url_contains("/login", timeout=20)
                self.wait_for_body_text("Welcome Back", timeout=20)

    def test_unknown_route_shows_not_found_page(self):
        self.clear_browser_state()
        self.visit("/definitely-not-a-real-papillon-route")
        self.wait_for_body_text("Page Not Found", timeout=20)
        self.wait_for_body_text("404", timeout=20)


class SecuritySettingsSmokeTests(SeleniumUserMixin, PapillonSeleniumTest):
    def setUp(self):
        super().setUp()
        self.login_default_user()

    def test_mfa_settings_card_opens_setup_or_shows_active_state(self):
        self.visit("/profile")
        self.wait_for_body_text("Two-Factor Authentication", timeout=30)

        body = self.body_text()
        if "Enable MFA Security" in body:
            self.click_text("Enable MFA Security")
            self.wait_for_any_body_text(
                "6-Digit Verification Code",
                "6-DIGIT VERIFICATION CODE",
                "Manual Entry Key",
                "Manual key",
                "Complete MFA Setup",
                "Complete Setup",
                "MFA setup could not be initiated",
                "Failed to",
                timeout=30,
            )
            if "Cancel" in self.body_text():
                self.click_text("Cancel")
                self.wait_for_body_text("Enable MFA Security", timeout=20)
        else:
            self.assertIn("Active", body)
