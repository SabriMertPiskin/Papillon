import json
from unittest.mock import MagicMock, patch

from django.test import Client, TestCase

from network_ids.models import CPanelCredential, DomainTrafficEvent
from network_ids.views import (
    _build_access_log_matrix,
    _classify_threat_level,
    _extract_ip_from_access_log_entry,
    _normalize_domain,
)
from users.models import CustomUser


def make_user(username, email, role='analyst', domain='example.com'):
    user = CustomUser(username=username, email=email, role=role, domain=domain)
    user.set_password('TestPass123!')
    user.save()
    return user


def set_session(client, username):
    session = client.session
    session['user_id'] = username
    session.save()


class TestNetworkIDSHelpers(TestCase):

    def test_normalize_domain_strips_scheme_path_port_and_case(self):
        self.assertEqual(_normalize_domain('HTTPS://Api.Example.COM:443/v1'), 'api.example.com')

    def test_classify_threat_level_maps_benign_to_low(self):
        risk, label = _classify_threat_level('BENIGN')
        self.assertEqual(risk, 'low')
        self.assertIn('Normal', label)

    def test_classify_threat_level_maps_attack_to_high(self):
        risk, _ = _classify_threat_level('DDoS')
        self.assertEqual(risk, 'critical')

    def test_extract_ip_from_common_log_line(self):
        line = '203.0.113.9 - - [16/Apr/2026:12:00:00 +0000] "GET /admin HTTP/1.1" 404 12'
        self.assertEqual(_extract_ip_from_access_log_entry(line), '203.0.113.9')

    def test_build_access_log_matrix_parses_structured_and_raw_entries(self):
        matrix = _build_access_log_matrix([
            {'ip': '198.51.100.4', 'method': 'POST', 'path': '/login', 'status': 401},
            '203.0.113.9 - - [16/Apr/2026:12:00:00 +0000] "GET /admin HTTP/1.1" 404 12',
        ])

        self.assertEqual(len(matrix), 2)
        self.assertEqual(matrix[0]['ip'], '198.51.100.4')
        self.assertEqual(matrix[1]['method'], 'GET')


class TestNetworkIDSEndpoints(TestCase):

    def setUp(self):
        self.client = Client()
        self.analyst = make_user('ids_analyst', 'ids@test.com')
        set_session(self.client, self.analyst.username)

    def test_predict_requires_auth(self):
        res = Client().post(
            '/ai/network-ids/predict/',
            data=json.dumps({'features': [0.1, 0.2]}),
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 401)

    def test_predict_rejects_missing_features(self):
        res = self.client.post('/ai/network-ids/predict/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res.status_code, 400)

    @patch('network_ids.views._load_model')
    def test_predict_returns_model_result(self, mock_load):
        model = MagicMock()
        model.predict.return_value = [0]
        model.predict_proba.return_value = [[0.92, 0.08]]
        encoder = MagicMock()
        encoder.inverse_transform.return_value = ['BENIGN']
        scaler = MagicMock()
        scaler.transform.side_effect = lambda value: value
        mock_load.return_value = (model, encoder, scaler)

        res = self.client.post(
            '/ai/network-ids/predict/',
            data=json.dumps({'features': [0.1] * 10}),
            content_type='application/json',
        )

        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertEqual(body['result']['prediction'], 'BENIGN')
        self.assertEqual(body['result']['risk_level'], 'low')

    def test_ingest_event_requires_auth(self):
        res = Client().post(
            '/ai/network-ids/ingest-event/',
            data=json.dumps({'domain': 'example.com'}),
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 401)

    def test_ingest_event_persists_normalized_event(self):
        res = self.client.post(
            '/ai/network-ids/ingest-event/',
            data=json.dumps({
                'domain': 'https://example.com/path',
                'client_ip': '192.0.2.10',
                'method': 'post',
                'path': '/login',
                'status_code': 401,
                'response_ms': 12.5,
            }),
            content_type='application/json',
        )

        self.assertEqual(res.status_code, 201)
        event = DomainTrafficEvent.objects.get(path='/login')
        self.assertEqual(event.domain, 'example.com')
        self.assertEqual(event.method, 'POST')
        self.assertEqual(event.source, 'collector')

    def test_hosting_overview_requires_auth(self):
        res = Client().post('/ai/network-ids/hosting-overview/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res.status_code, 401)

    def test_hosting_overview_returns_empty_domain_dashboard(self):
        res = self.client.post('/ai/network-ids/hosting-overview/', data=json.dumps({}), content_type='application/json')

        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertEqual(body['overview']['domain'], 'example.com')
        self.assertIn('summary', body['overview'])


class TestNetworkIDSCPanelConfig(TestCase):

    def setUp(self):
        self.client = Client()
        self.analyst = make_user('cpanel_ids_analyst', 'cpanel_ids@test.com')
        set_session(self.client, self.analyst.username)

    def test_get_cpanel_config_returns_none_when_missing(self):
        res = self.client.get('/ai/network-ids/cpanel-config/')

        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.json()['config'])

    def test_update_cpanel_config_requires_auth_material(self):
        res = self.client.post(
            '/ai/network-ids/cpanel-config/update/',
            data=json.dumps({'host': 'cpanel.example.com', 'username': 'cpuser'}),
            content_type='application/json',
        )

        self.assertEqual(res.status_code, 400)

    def test_update_cpanel_config_encrypts_credentials(self):
        res = self.client.post(
            '/ai/network-ids/cpanel-config/update/',
            data=json.dumps({
                'host': 'cpanel.example.com',
                'username': 'cpuser',
                'token': 'token-secret',
                'password': 'password-secret',
                'verify_ssl': False,
            }),
            content_type='application/json',
        )

        self.assertEqual(res.status_code, 200)
        credential = CPanelCredential.objects.get(user=self.analyst)
        self.assertNotEqual(credential.token_encrypted, 'token-secret')
        self.assertNotEqual(credential.password_encrypted, 'password-secret')
        self.assertEqual(credential.get_token(), 'token-secret')
        self.assertEqual(credential.get_password(), 'password-secret')

    @patch('network_ids.views._build_cpanel_client')
    def test_cpanel_test_uses_configured_client(self, mock_factory):
        credential = CPanelCredential(user=self.analyst, host='cpanel.example.com', username='cpuser')
        credential.set_token('token-secret')
        credential.save()
        client = MagicMock()
        client.test_connection.return_value = {'connected': True}
        mock_factory.return_value = client

        res = self.client.post('/ai/network-ids/cpanel-test/', data=json.dumps({}), content_type='application/json')

        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()['result']['connected'])

    def test_admin_cpanel_test_requires_for_analyst(self):
        admin_client = Client()
        admin = make_user('ids_admin', 'ids_admin@test.com', role='admin')
        set_session(admin_client, admin.username)

        res = admin_client.post('/ai/network-ids/cpanel-test/', data=json.dumps({}), content_type='application/json')

        self.assertEqual(res.status_code, 400)
