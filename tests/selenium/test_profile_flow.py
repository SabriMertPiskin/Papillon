from selenium.webdriver.common.by import By

from tests.selenium.base import PapillonSeleniumTest
from tests.selenium.users import SeleniumUserMixin


class ProfileFlowTests(SeleniumUserMixin, PapillonSeleniumTest):
    def setUp(self):
        super().setUp()
        self.login_default_user()

    def test_profile_updates_domain_vm_path_and_password(self):
        self.visit("/profile")
        self.wait_for_body_text("Profile & Account")

        domain_input = self.driver.find_element(
            By.XPATH,
            "//label[contains(., 'Corporate Domain')]/following-sibling::input",
        )
        domain_input.clear()
        domain_input.send_keys(self.domain)
        self.click_text("Save Domain")
        self.wait_for_body_text("Domain information updated", timeout=30)

        vm_input = self.driver.find_element(
            By.XPATH,
            "//label[contains(., 'VirtualBox Executable Path')]/following-sibling::input",
        )
        vm_input.clear()
        vm_input.send_keys(r"C:\Program Files\Oracle\VirtualBox\VBoxManage.exe")
        self.click_text("Save Path")
        self.wait_for_body_text("VM Lab path updated successfully", timeout=30)

        self.fill("input[placeholder='Enter your current password']", self.password)
        self.fill("input[placeholder='Minimum 8 characters']", self.changed_password)
        self.fill("input[placeholder='Re-enter your new password']", self.changed_password)
        self.click_text("Update Password")
        self.wait_for_body_text("Password changed successfully", timeout=30)

        self.logout()
        self.assert_login_fails(self.email, self.password)
        self.login_with_credentials(self.email, self.changed_password)
        self._change_password_back_to_default()

    def _change_password_back_to_default(self):
        self.visit("/profile")
        self.wait_for_body_text("Profile & Account")
        self.fill("input[placeholder='Enter your current password']", self.changed_password)
        self.fill("input[placeholder='Minimum 8 characters']", self.default_password)
        self.fill("input[placeholder='Re-enter your new password']", self.default_password)
        self.click_text("Update Password")
        self.wait_for_body_text("Password changed successfully", timeout=30)
