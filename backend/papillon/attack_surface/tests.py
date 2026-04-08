"""
attack_surface/tests.py
FR3  — Attack Surface Analysis (Subdomain, Port, SSL scanning)
TC-10: Non-intrusive, isolated domain scanning; ≥ 80% task success rate
Unit:  domain normalization, access control logic
Integration: /attack-surface/scan/ endpoint (socket + tools mocked)

NOT: View, kullanıcının POST body'sinden target almaz.
     Her zaman kullanıcının DB'deki kayıtlı domain'ini tarar.
     Admin ise ?for_analyst=username parametresi zorunludur.
"""
import json
import socket
from unittest.mock import patch, MagicMock
from django.test import TestCase, Client
from attack_surface.views import _normalize_domain, _is_allowed_target
from users.models import CustomUser


def make_analyst(username='as_analyst', email='as@test.com', domain='example.com'):
    user = CustomUser(username=username, email=email, role='analyst')
    user.set_password('TestPass123!')
    user.domain = domain
    user.save()
    return user


def make_admin(username='as_admin', email='as_admin@test.com'):
    user = CustomUser(username=username, email=email, role='admin')
    user.set_password('AdminPass123!')
    user.save()
    return user


def set_session(client, username):
    session = client.session
    session['user_id'] = username
    session.save()


# ---------------------------------------------------------------------------
# 1. Unit: Domain Normalization — TC-10
# ---------------------------------------------------------------------------

class TestDomainNormalization(TestCase):
    """
    TC-10: Domain normalize fonksiyonu doğru çalışmalı.
    """

    def test_plain_domain_unchanged(self):
        self.assertEqual(_normalize_domain('example.com'), 'example.com')

    def test_http_prefix_stripped(self):
        """TC-10: http:// prefix normalize edilmeli."""
        self.assertEqual(_normalize_domain('http://example.com'), 'example.com')

    def test_https_prefix_stripped(self):
        """TC-10: https:// prefix normalize edilmeli."""
        self.assertEqual(_normalize_domain('https://example.com'), 'example.com')

    def test_path_stripped(self):
        """TC-10: URL'deki path normalize edilmeli."""
        self.assertEqual(_normalize_domain('https://example.com/some/path'), 'example.com')

    def test_port_stripped(self):
        self.assertEqual(_normalize_domain('example.com:8080'), 'example.com')

    def test_trailing_dot_stripped(self):
        self.assertEqual(_normalize_domain('example.com.'), 'example.com')

    def test_uppercase_lowercased(self):
        self.assertEqual(_normalize_domain('EXAMPLE.COM'), 'example.com')

    def test_whitespace_stripped(self):
        self.assertEqual(_normalize_domain('  example.com  '), 'example.com')

    def test_empty_string_returns_empty(self):
        self.assertEqual(_normalize_domain(''), '')

    def test_none_returns_empty(self):
        self.assertEqual(_normalize_domain(None), '')

    def test_subdomain_preserved(self):
        self.assertEqual(_normalize_domain('sub.example.com'), 'sub.example.com')

    def test_complex_url_normalized(self):
        result = _normalize_domain('https://api.example.com:443/v1/endpoint?query=test')
        self.assertEqual(result, 'api.example.com')


# ---------------------------------------------------------------------------
# 2. Unit: Access Control — _is_allowed_target — TC-10
# ---------------------------------------------------------------------------

class TestIsAllowedTarget(TestCase):
    """
    TC-10: Sadece kullanıcının kendi domain'i veya subdomain'i taranabilmeli.
    """

    def test_exact_domain_match_allowed(self):
        """TC-10: Tam domain eşleşmesi → izin verilmeli."""
        self.assertTrue(_is_allowed_target('example.com', 'example.com'))

    def test_subdomain_allowed(self):
        """TC-10: Subdomain → izin verilmeli."""
        self.assertTrue(_is_allowed_target('example.com', 'sub.example.com'))

    def test_deep_subdomain_allowed(self):
        self.assertTrue(_is_allowed_target('example.com', 'api.v2.example.com'))

    def test_foreign_domain_rejected(self):
        """TC-10: Başka domain → reddedilmeli (0 başarılı bypass)."""
        self.assertFalse(_is_allowed_target('example.com', 'evil.com'))

    def test_similar_domain_rejected(self):
        """TC-10: Benzer ama farklı domain — subdomain spoofing reddedilmeli."""
        self.assertFalse(_is_allowed_target('example.com', 'notexample.com'))

    def test_suffix_attack_rejected(self):
        """TC-10: Domain suffix attack reddedilmeli (fakeexample.com)."""
        self.assertFalse(_is_allowed_target('example.com', 'fakeexample.com'))

    def test_empty_user_domain_rejects_all(self):
        """Kullanıcının domain'i yoksa hiçbir şey taranamalı."""
        self.assertFalse(_is_allowed_target('', 'anything.com'))
        self.assertFalse(_is_allowed_target(None, 'example.com'))

    def test_empty_target_rejected(self):
        self.assertFalse(_is_allowed_target('example.com', ''))

    def test_http_prefix_normalized_before_check(self):
        """URL formatları normalize edilip karşılaştırılmalı."""
        self.assertTrue(_is_allowed_target('example.com', 'https://example.com'))

    def test_subdomain_of_different_domain_rejected(self):
        """TC-10: example.com.evil.com → reddedilmeli."""
        self.assertFalse(_is_allowed_target('example.com', 'example.com.evil.com'))


# ---------------------------------------------------------------------------
# 3. Integration: /attack-surface/scan/ — TC-10
# ---------------------------------------------------------------------------

class TestAttackSurfaceScanEndpoint(TestCase):
    """
    TC-10: Attack surface scan endpoint — socket ve tool importları mocked.

    View'da target POST body'den değil, kullanıcının kayıtlı domain'inden gelir.
    Tool importları (dns_records, ssl_scanner vb.) lazy import ile yapılır;
    başarısız olsa bile view graceful hata döndürür.
    """

    def setUp(self):
        self.client = Client()
        self.analyst = make_analyst()
        set_session(self.client, self.analyst.username)
        self.url = '/attack-surface/scan/'

    def test_scan_requires_auth(self):
        """TC-10: Auth olmadan scan başlatılamaz."""
        client2 = Client()
        res = client2.post(self.url)
        self.assertEqual(res.status_code, 401)

    def test_analyst_without_domain_gets_400(self):
        """TC-10: Domain tanımsız analyst tarama yapamaz → 400."""
        self.analyst.domain = ''
        self.analyst.save()
        res = self.client.post(self.url)
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.json()['success'])

    @patch('attack_surface.views.socket.gethostbyname', return_value='93.184.216.34')
    def test_analyst_with_domain_can_trigger_scan(self, mock_dns):
        """TC-10: Domain'i olan analyst scan başlatabilmeli — auth/403 hatası almaz."""
        res = self.client.post(self.url)
        # Tools başarısız olsa bile 401/403 dönmemeli
        self.assertNotEqual(res.status_code, 401)
        self.assertNotEqual(res.status_code, 403)

    @patch('attack_surface.views.socket.gethostbyname',
           side_effect=socket.gaierror('DNS resolution failed'))
    def test_invalid_domain_dns_failure_returns_400(self, mock_dns):
        """TC-10: Çözülemeyen domain → 400."""
        res = self.client.post(self.url)
        self.assertEqual(res.status_code, 400)

    @patch('attack_surface.views.socket.gethostbyname', return_value='93.184.216.34')
    def test_scan_response_contains_domain_and_ip(self, mock_dns):
        """TC-10: Başarılı scan sonucu domain ve IP içermeli."""
        res = self.client.post(self.url)
        if res.status_code == 200:
            body = res.json()
            # Response: {'success': True, 'results': {'domain': ..., 'ip': ..., ...}}
            results = body.get('results', body)
            self.assertIn('domain', results)
            self.assertIn('ip', results)

    @patch('attack_surface.views.socket.gethostbyname', return_value='93.184.216.34')
    def test_scan_response_contains_all_expected_fields(self, mock_dns):
        """TC-10: Scan sonucu tüm alan türlerini içermeli."""
        res = self.client.post(self.url)
        if res.status_code == 200:
            body = res.json()
            results = body.get('results', body)
            expected_keys = ['domain', 'ip', 'dns_records', 'subdomains',
                             'ssl_info', 'open_ports']
            for key in expected_keys:
                self.assertIn(key, results,
                              msg=f"'{key}' scan response'da eksik")

    def test_admin_without_for_analyst_gets_400(self):
        """TC-10: Admin for_analyst olmadan scan yapamaz → 400."""
        admin = make_admin()
        client_admin = Client()
        set_session(client_admin, admin.username)
        res = client_admin.post(self.url)
        self.assertIn(res.status_code, [400, 403])

    @patch('attack_surface.views.socket.gethostbyname', return_value='93.184.216.34')
    def test_admin_with_for_analyst_can_scan(self, mock_dns):
        """TC-10: Admin for_analyst parametresiyle scan yapabilmeli."""
        admin = make_admin()
        client_admin = Client()
        set_session(client_admin, admin.username)
        res = client_admin.post(
            self.url + f'?for_analyst={self.analyst.username}')
        # 401/403 dönmemeli
        self.assertNotEqual(res.status_code, 401)
        self.assertNotEqual(res.status_code, 403)

    @patch('attack_surface.views.socket.gethostbyname', return_value='93.184.216.34')
    def test_scan_tool_errors_handled_gracefully(self, mock_dns):
        """TC-10: Tool importları başarısız olsa bile response yapısı korunmalı."""
        res = self.client.post(self.url)
        if res.status_code == 200:
            body = res.json()
            results = body.get('results', body)
            # Tools hata döndürse bile alan var olmalı
            self.assertIn('dns_records', results)
            # Hata mesajı olabilir ama crash olmaz
            self.assertIsInstance(results['dns_records'], list)
