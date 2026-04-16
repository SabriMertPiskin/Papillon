from tests.selenium.base import PapillonSeleniumTest
from tests.selenium.users import SeleniumUserMixin


class AuthFlowTests(SeleniumUserMixin, PapillonSeleniumTest):
    def setUp(self):
        super().setUp()
        self.make_unique_user()

    def test_register_validates_password_confirmation(self):
        self.clear_browser_state()
        self.visit("/register")
        self.wait_for_body_text("Create Account")

        self.fill("input[name='username']", self.username)
        self.fill("input[name='email']", self.email)
        self.fill("input[name='password']", self.password)
        self.fill("input[name='password_confirm']", "Mismatch123!")
        self.click_text("Create Account")

        self.wait_for_body_text("Passwords do not match")

    def test_register_login_wrong_password_and_success(self):
        self.clear_browser_state()
        self.register_user()
        self.assert_login_fails(self.email, "WrongPassword123!")
        self.login_with_credentials(self.email, self.password)
        self.logout()
