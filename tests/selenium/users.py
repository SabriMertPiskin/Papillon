from uuid import uuid4

from selenium.common.exceptions import TimeoutException


class SeleniumUserMixin:
    default_email = "test@test.com"
    default_password = "12345678"
    password = "PapillonReg123!"
    changed_password = "PapillonChanged123!"

    def make_unique_user(self):
        suffix = uuid4().hex[:8]
        self.username = f"sel_{suffix}"
        self.email = f"sel_{suffix}@example.com"
        self.domain = f"corp-{suffix}.local"

    def register_user(self):
        if not hasattr(self, "email"):
            self.make_unique_user()

        self.visit("/register")
        self.wait_for_body_text("Create Account")
        self.fill("input[name='username']", self.username)
        self.fill("input[name='email']", self.email)
        self.fill("input[name='password']", self.password)
        self.fill("input[name='password_confirm']", self.password)
        self.fill("input[name='domain']", self.domain)
        self.click_text("Create Account")
        self.wait_for_url_contains("/login", timeout=40)
        self.wait_for_body_text("Welcome Back", timeout=40)

    def ensure_registered_and_logged_in(self, password=None):
        self.clear_browser_state()
        self.register_user()
        self.login_with_credentials(self.email, password or self.password)

    def login_default_user(self):
        self.clear_browser_state()
        self.email = self.default_email
        self.password = self.default_password
        self.domain = "test.com"
        self.login_with_credentials(self.default_email, self.default_password)

    def assert_login_fails(self, email, password):
        try:
            self.login_with_credentials(email, password, expect_success=False)
        except TimeoutException:
            self.save_debug_artifacts("login_expected_failure_not_seen")
            raise
