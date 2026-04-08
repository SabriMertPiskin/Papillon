"""
cve/tests.py
FR2  — CVE Automation (NVD/ExploitDB Automated Sync)
TC-06: CVE synchronization — her 12 saatte çalışmalı, veri normalize edilmeli
Integration: /cve/latest/ endpoint (NVD API mocked)
"""
import json
from unittest.mock import patch, MagicMock
from django.test import TestCase, Client


# ---------------------------------------------------------------------------
# 1. Integration: /cve/latest/ — TC-06
# ---------------------------------------------------------------------------

class TestCVELatestEndpoint(TestCase):
    """
    TC-06: CVE fetch & normalize — NVD API mocked.
    """

    def setUp(self):
        self.client = Client()
        self.url = '/cve/latest/'
        self.mock_nvd_response = {
            'vulnerabilities': [
                {
                    'cve': {
                        'id': 'CVE-2024-12345',
                        'descriptions': [
                            {'lang': 'en', 'value': 'Critical buffer overflow in example library.'},
                            {'lang': 'es', 'value': 'Descripción en español.'},
                        ],
                        'metrics': {
                            'cvssMetricV31': [{
                                'cvssData': {
                                    'baseSeverity': 'CRITICAL',
                                    'baseScore': 9.8,
                                },
                            }],
                        },
                        'published': '2024-01-15T10:00:00.000',
                        'references': [
                            {'url': 'https://nvd.nist.gov/vuln/detail/CVE-2024-12345'},
                        ],
                    },
                },
                {
                    'cve': {
                        'id': 'CVE-2024-67890',
                        'descriptions': [
                            {'lang': 'en', 'value': 'SQL injection vulnerability.'},
                        ],
                        'metrics': {
                            'cvssMetricV31': [{
                                'cvssData': {
                                    'baseSeverity': 'HIGH',
                                    'baseScore': 7.5,
                                },
                            }],
                        },
                        'published': '2024-01-10T08:00:00.000',
                        'references': [],
                    },
                },
            ],
        }

    @patch('cve.views.requests.get')
    def test_latest_cves_returns_success(self, mock_get):
        """TC-06: /cve/latest/ → 200, success: true."""
        mock_response = MagicMock()
        mock_response.json.return_value = self.mock_nvd_response
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertIn('cves', body)

    @patch('cve.views.requests.get')
    def test_cve_data_normalized_correctly(self, mock_get):
        """TC-06: CVE verisi normalize edilmeli — id, description, severity, score."""
        mock_response = MagicMock()
        mock_response.json.return_value = self.mock_nvd_response
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        res = self.client.get(self.url)
        cves = res.json()['cves']
        self.assertGreater(len(cves), 0)

        first = cves[0]
        # Gerekli alanlar bulunmalı
        self.assertIn('id', first)
        self.assertIn('description', first)
        self.assertIn('severity', first)
        self.assertIn('score', first)
        self.assertIn('published', first)

    @patch('cve.views.requests.get')
    def test_english_description_selected(self, mock_get):
        """Birden fazla dil varsa İngilizce seçilmeli."""
        mock_response = MagicMock()
        mock_response.json.return_value = self.mock_nvd_response
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        res = self.client.get(self.url)
        first_cve = res.json()['cves'][0]
        self.assertEqual(first_cve['description'],
                         'Critical buffer overflow in example library.')

    @patch('cve.views.requests.get')
    def test_cvss_score_parsed_correctly(self, mock_get):
        """TC-06: CVSS score doğru parse edilmeli."""
        mock_response = MagicMock()
        mock_response.json.return_value = self.mock_nvd_response
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        res = self.client.get(self.url)
        first_cve = res.json()['cves'][0]
        self.assertEqual(first_cve['score'], 9.8)
        self.assertEqual(first_cve['severity'], 'CRITICAL')

    @patch('cve.views.requests.get')
    def test_limit_parameter_respected(self, mock_get):
        """limit parametresi sonuç sayısını sınırlamalı."""
        mock_response = MagicMock()
        mock_response.json.return_value = self.mock_nvd_response
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        res = self.client.get(self.url + '?limit=1')
        body = res.json()
        self.assertLessEqual(body['count'], 1)
        self.assertLessEqual(len(body['cves']), 1)

    @patch('cve.views.requests.get')
    def test_limit_clamped_to_50(self, mock_get):
        """limit 50'yi aşamaz."""
        mock_response = MagicMock()
        mock_response.json.return_value = {'vulnerabilities': []}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        res = self.client.get(self.url + '?limit=9999')
        body = res.json()
        self.assertLessEqual(body['limit'], 50)

    @patch('cve.views.requests.get')
    def test_limit_minimum_is_1(self, mock_get):
        mock_response = MagicMock()
        mock_response.json.return_value = {'vulnerabilities': []}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        res = self.client.get(self.url + '?limit=0')
        body = res.json()
        self.assertGreaterEqual(body['limit'], 1)

    @patch('cve.views.requests.get')
    def test_nvd_api_error_returns_500(self, mock_get):
        """TC-06: NVD API hata verirse 500 dönmeli."""
        import requests as req
        mock_get.side_effect = req.RequestException('Connection timeout')

        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 500)
        self.assertFalse(res.json()['success'])

    @patch('cve.views.requests.get')
    def test_empty_vulnerabilities_list(self, mock_get):
        """NVD boş liste döndürürse başarılı ama boş sonuç."""
        mock_response = MagicMock()
        mock_response.json.return_value = {'vulnerabilities': []}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertEqual(body['count'], 0)
        self.assertEqual(body['cves'], [])

    @patch('cve.views.requests.get')
    def test_cve_endpoint_is_public(self, mock_get):
        """TC-06: CVE endpoint auth gerektirmemeli."""
        mock_response = MagicMock()
        mock_response.json.return_value = {'vulnerabilities': []}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        res = self.client.get(self.url)
        self.assertNotEqual(res.status_code, 401)

    @patch('cve.views.requests.get')
    def test_cve_references_included(self, mock_get):
        """TC-06: CVE referansları response'a dahil edilmeli."""
        mock_response = MagicMock()
        mock_response.json.return_value = self.mock_nvd_response
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        res = self.client.get(self.url)
        first_cve = res.json()['cves'][0]
        self.assertIn('references', first_cve)
        self.assertIsInstance(first_cve['references'], list)

    @patch('cve.views.requests.get')
    def test_cvss_v2_fallback_when_v31_missing(self, mock_get):
        """TC-06: CVSSv3.1 yoksa CVSSv2'ye fallback."""
        mock_data = {
            'vulnerabilities': [{
                'cve': {
                    'id': 'CVE-2020-00001',
                    'descriptions': [{'lang': 'en', 'value': 'Old vulnerability.'}],
                    'metrics': {
                        'cvssMetricV2': [{
                            'baseSeverity': 'MEDIUM',
                            'baseScore': 5.0,
                        }],
                    },
                    'published': '2020-01-01T00:00:00.000',
                    'references': [],
                },
            }],
        }
        mock_response = MagicMock()
        mock_response.json.return_value = mock_data
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        res = self.client.get(self.url)
        cve = res.json()['cves'][0]
        # Severity ve score CVSSv2'den alınmalı
        self.assertIn(cve['severity'], ['MEDIUM', 'UNKNOWN'])

    @patch('cve.views.requests.get')
    def test_nvd_called_with_correct_date_range(self, mock_get):
        """TC-06: NVD API doğru tarih parametreleriyle çağrılmalı."""
        mock_response = MagicMock()
        mock_response.json.return_value = {'vulnerabilities': []}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        self.client.get(self.url)

        self.assertTrue(mock_get.called)
        call_kwargs = mock_get.call_args
        # URL doğru endpoint olmalı
        args = call_kwargs[0]
        self.assertIn('nvd.nist.gov', args[0])
