from tests.selenium.base import PapillonSeleniumTest
from tests.selenium.users import SeleniumUserMixin


class NavigationTests(SeleniumUserMixin, PapillonSeleniumTest):
    def setUp(self):
        super().setUp()
        self.login_default_user()

    def test_dashboard_cards_are_clickable(self):
        card_cases = [
            ("Password Strength Analysis", "/password-strength", "Password Strength Analysis"),
            ("Text Encryption", "/encryption", "Text Encryption"),
            ("CVE Vulnerabilities", "/cve", "Latest Vulnerabilities"),
            ("Vulnerability Map", "/vulnerability-map", "Vulnerability Map"),
            ("cPanel Data", "/cpanel-data", "cPanel Data"),
            ("VM Attack Lab", "/vm-lab", "VM Attack Lab"),
            ("SSH VM Lab", "/ssh-vm-lab", "SSH VM Lab"),
            ("Outlook Integration", "/outlook-integration", "Outlook Integration"),
            ("Phishing History", "/phishing-history", "Phishing"),
            ("Malware Analysis", "/malware-analysis", "Malware Analysis"),
            ("Profile & Account", "/profile", "Profile & Account"),
            ("IP Blacklist", "/blacklist", "IP Blacklist Management"),
        ]

        for title, path, marker in card_cases:
            with self.subTest(card=title):
                self.visit("/dashboard")
                self.click_text(title)
                self.wait_for_url_contains(path, timeout=30)
                self.wait_for_body_text(marker, timeout=30)

    def test_sidebar_links_are_clickable(self):
        nav_cases = [
            ("Dashboard", "/dashboard", "Papillon security dashboard"),
            ("Password Analysis", "/password-strength", "Password Strength Analysis"),
            ("Text Encryption", "/encryption", "Text Encryption"),
            ("CVE Vulnerabilities", "/cve", "Latest Vulnerabilities"),
            ("Vulnerability Map", "/vulnerability-map", "Vulnerability Map"),
            ("cPanel Data", "/cpanel-data", "cPanel Data"),
            ("VM Lab", "/vm-lab", "VM Attack Lab"),
            ("SSH VM Lab", "/ssh-vm-lab", "SSH VM Lab"),
            ("Outlook Integration", "/outlook-integration", "Outlook Integration"),
            ("Phishing History", "/phishing-history", "Phishing"),
            ("Malware Analysis", "/malware-analysis", "Malware Analysis"),
            ("Profile & Account", "/profile", "Profile & Account"),
            ("IP Blacklist", "/blacklist", "IP Blacklist Management"),
        ]

        for label, path, marker in nav_cases:
            with self.subTest(sidebar=label):
                self.visit("/dashboard")
                self.click_text(label)
                self.wait_for_url_contains(path, timeout=30)
                self.wait_for_body_text(marker, timeout=30)
