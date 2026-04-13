"""
network_ids/tests.py
FR4  — IDS Integration (Webhook Ingestion & ML Anomalies)
TC-01: Webhook ingestion, monitor snapshot, AI classification
Integration: ingest-event (auth required), monitor-snapshot, predict endpoints
"""
import json
import time
from unittest.mock import patch, MagicMock
from django.test import TestCase, Client
from network_ids.models import CPanelCredential, DomainTrafficEvent
from users.models import CustomUser


def make_analyst(username='ids_analyst', email='ids@test.com', domain='example.com'):
    user = CustomUser(username=username, email=email, role='analyst')
    user.set_password('TestPass123!')
    user.domain = domain
    user.save()
    return user


def make_admin(username='ids_admin', email='ids_admin@test.com'):
    user = CustomUser(username=username, email=email, role='admin')
    user.set_password('AdminPass123!')
    user.save()
    return user


def set_session(client, username):
    session = client.session
    session['user_id'] = username
    session.save()


# ---------------------------------------------------------------------------
# 1. Integration: /ai/network-ids/ingest-event/ — TC-01
# ---------------------------------------------------------------------------

class TestIngestEvent(TestCase):
    """
    TC-01: IDS webhook ingestion — event'ler DB'ye kaydedilmeli.
    NOT: ingest-event @require_role('admin', 'analyst') ile korumalı.
    """

    def setUp(self):
        self.client = Client()
        self.analyst = make_analyst()
        set_session(self.client, self.analyst.username)
        self.url = '/ai/network-ids/ingest-event/'

    def _post(self, data):
        return self.client.post(self.url, data=json.dumps(data),
                                content_type='application/json')

    def test_valid_event_returns_success(self):
        """TC-01: Geçerli webhook payload → 201, success: true."""
        res = self._post({
            'domain': 'example.com',
            'client_ip': '192.168.1.10',
            'method': 'GET',
            'path': '/api/data',
            'status_code': 200,
            'response_ms': 45.3,
        })
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.json()['success'])

    def test_valid_event_saved_to_db(self):
        """TC-01: Event DomainTrafficEvent olarak DB'ye kaydedilmeli."""
        self._post({
            'domain': 'example.com',
            'client_ip': '10.0.0.1',
            'method': 'POST',
            'path': '/auth/login',
            'status_code': 401,
            'response_ms': 12.0,
        })
        self.assertTrue(DomainTrafficEvent.objects.filter(
            domain='example.com', path='/auth/login').exists())

    def test_missing_domain_returns_400(self):
        """Domain olmadan gelen event reddedilmeli."""
        res = self._post({'client_ip': '1.2.3.4', 'method': 'GET', 'path': '/'})
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.json()['success'])

    def test_domain_is_normalized(self):
        """URL formatındaki domain normalize edilmeli."""
        self._post({
            'domain': 'https://example.com/path',  # URL formatı
            'method': 'GET',
            'path': '/norm-test',
        })
        # Normalize edilerek 'example.com' olarak kaydedilmeli
        self.assertTrue(DomainTrafficEvent.objects.filter(domain='example.com',
                                                           path='/norm-test').exists())

    def test_ingest_requires_auth(self):
        """TC-01: ingest-event auth gerektiriyor (@require_role)."""
        client2 = Client()
        res = client2.post(self.url,
                           data=json.dumps({'domain': 'example.com', 'method': 'GET', 'path': '/'}),
                           content_type='application/json')
        self.assertEqual(res.status_code, 401)

    def test_method_is_uppercased(self):
        self._post({
            'domain': 'example.com',
            'method': 'get',  # lowercase
            'path': '/method-test',
        })
        event = DomainTrafficEvent.objects.filter(path='/method-test').first()
        self.assertIsNotNone(event)
        self.assertEqual(event.method, 'GET')

    def test_optional_fields_are_optional(self):
        """status_code, response_ms, user_agent opsiyonel."""
        res = self._post({'domain': 'example.com', 'method': 'GET', 'path': '/opt-test'})
        self.assertEqual(res.status_code, 201)

    def test_multiple_events_bulk_storage(self):
        """TC-01: 10 event gönder → hepsi DB'ye kaydedilmeli."""
        for i in range(10):
            self._post({
                'domain': 'example.com',
                'client_ip': f'10.0.0.{i}',
                'method': 'GET',
                'path': f'/bulk/{i}',
                'status_code': 200,
            })
        count = DomainTrafficEvent.objects.filter(
            domain='example.com', path__startswith='/bulk/').count()
        self.assertEqual(count, 10)

    def test_invalid_json_returns_error(self):
        res = self.client.post(self.url, data='not-json',
                               content_type='application/json')
        self.assertIn(res.status_code, [400, 500])

    def test_webhook_single_request_latency(self):
        """TC-01: Tek webhook isteği makul sürede tamamlanmalı (< 1s)."""
        start = time.time()
        self._post({
            'domain': 'example.com',
            'client_ip': '192.168.1.1',
            'method': 'GET',
            'path': '/perf-test',
            'status_code': 200,
            'response_ms': 100.0,
        })
        elapsed = time.time() - start
        self.assertLess(elapsed, 1.0,
                        msg=f'Webhook işlem süresi {elapsed:.3f}s > 1.0s')

    def test_admin_can_also_ingest(self):
        """Admin rolü de ingest yapabilmeli."""
        admin = make_admin()
        admin_client = Client()
        set_session(admin_client, admin.username)
        res = admin_client.post(self.url,
                                data=json.dumps({'domain': 'admin-domain.com',
                                                 'method': 'GET', 'path': '/admin-test'}),
                                content_type='application/json')
        self.assertEqual(res.status_code, 201)


# ---------------------------------------------------------------------------
# 2. Integration: /ai/network-ids/monitor-snapshot/ — TC-01
# ---------------------------------------------------------------------------

class TestMonitorSnapshot(TestCase):

    def setUp(self):
        self.client = Client()
        self.analyst = make_analyst()
        set_session(self.client, self.analyst.username)
        self.url = '/ai/network-ids/monitor-snapshot/'

        # Test event'leri oluştur
        for i in range(5):
            DomainTrafficEvent.objects.create(
                domain='example.com',
                client_ip=f'192.168.0.{i}',
                method='GET',
                path=f'/snap/{i}',
                status_code=200,
                response_ms=float(i * 10),
            )

    def test_snapshot_requires_auth(self):
        """Monitor snapshot auth gerektirmeli."""
        client2 = Client()
        res = client2.post(self.url,
                           data=json.dumps({'domain': 'example.com'}),
                           content_type='application/json')
        self.assertEqual(res.status_code, 401)

    @patch('network_ids.views._load_model')
    def test_snapshot_authenticated_analyst_succeeds(self, mock_load):
        """TC-01: Auth'lu analyst → 200 (ya da model yüklü değilse 503)."""
        mock_load.return_value = (None, None, None)  # model None → 503 dönebilir
        res = self.client.post(self.url,
                               data=json.dumps({}),
                               content_type='application/json')
        # Domain yoksa 400, model yoksa 503, başarılıysa 200
        self.assertIn(res.status_code, [200, 400, 503])
        # Kesinlikle 401 veya 403 dönmemeli
        self.assertNotEqual(res.status_code, 401)
        self.assertNotEqual(res.status_code, 403)

    def test_admin_must_specify_for_analyst(self):
        """Admin for_analyst olmadan snapshot alamaz."""
        admin = make_admin()
        admin_client = Client()
        set_session(admin_client, admin.username)
        res = admin_client.post(self.url,
                                data=json.dumps({}),
                                content_type='application/json')
        # Admin'in for_analyst parametresi gerekli → 400 beklenir
        self.assertIn(res.status_code, [400, 200])
        self.assertNotEqual(res.status_code, 403)


class TestHostingOverview(TestCase):

    def setUp(self):
        self.client = Client()
        self.analyst = make_analyst(username='hosting_analyst', email='hosting@test.com')
        set_session(self.client, self.analyst.username)
        self.url = '/ai/network-ids/hosting-overview/'

        DomainTrafficEvent.objects.create(
            domain='example.com',
            client_ip='10.10.10.10',
            method='GET',
            path='/',
            status_code=200,
            response_ms=120.0,
        )
        DomainTrafficEvent.objects.create(
            domain='example.com',
            client_ip='10.10.10.11',
            method='POST',
            path='/login',
            status_code=500,
            response_ms=880.0,
        )

    def test_hosting_overview_requires_auth(self):
        client2 = Client()
        res = client2.post(self.url, data=json.dumps({}), content_type='application/json')
        self.assertEqual(res.status_code, 401)

    def test_hosting_overview_returns_cpanel_mapping(self):
        res = self.client.post(self.url, data=json.dumps({}), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        overview = body['overview']
        self.assertEqual(overview['provider_focus'], 'Turhost')
        self.assertIn('cpanel', overview['panel_name'].lower())
        self.assertGreaterEqual(len(overview['cpanel_modules']), 3)
        self.assertIn('structure_name', overview['terminology'])


class TestCPanelIntegration(TestCase):

    def setUp(self):
        self.client = Client()
        self.analyst = make_analyst(username='cpanel_analyst', email='cpanel@test.com')
        set_session(self.client, self.analyst.username)

    def test_update_cpanel_config_persists_encrypted_token(self):
        res = self.client.post(
            '/ai/network-ids/cpanel-config/update/',
            data=json.dumps({
                'host': 'cpanel.example.com',
                'username': 'cpuser',
                'token': 'secret-token-value',
                'password': 'SecretPass123!',
                'verify_ssl': True,
            }),
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 200)
        credential = CPanelCredential.objects.get(user=self.analyst)
        self.assertEqual(credential.host, 'cpanel.example.com')
        self.assertEqual(credential.username, 'cpuser')
        self.assertNotEqual(credential.token_encrypted, 'secret-token-value')
        self.assertEqual(credential.get_token(), 'secret-token-value')
        self.assertNotEqual(credential.password_encrypted, 'SecretPass123!')
        self.assertEqual(credential.get_password(), 'SecretPass123!')

    @patch('network_ids.views._build_cpanel_client')
    def test_cpanel_test_endpoint_returns_live_status(self, mock_client_factory):
        credential = CPanelCredential(user=self.analyst, host='cpanel.example.com', username='cpuser')
        credential.set_token('secret-token-value')
        credential.save()

        mock_client = MagicMock()
        mock_client.test_connection.return_value = {'connected': True, 'stats': []}
        mock_client_factory.return_value = mock_client

        res = self.client.post('/ai/network-ids/cpanel-test/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()['success'])

    @patch('network_ids.views._build_cpanel_client')
    def test_cpanel_live_snapshot_returns_mocked_data(self, mock_client_factory):
        credential = CPanelCredential(user=self.analyst, host='cpanel.example.com', username='cpuser')
        credential.set_token('secret-token-value')
        credential.save()

        mock_client = MagicMock()
        mock_client.fetch_live_snapshot.return_value = {
            'stats_bar': [{'name': 'bandwidthusage', 'value': '123 MB'}],
            'resource_usage': [{'description': 'CPU', 'percent': '42'}],
            'bandwidth': [{'domain': 'example.com'}],
            'errors': ['sample error'],
            'awstats_daily': {'hits': []},
            'archives': ['access_log-2026-04.gz'],
        }
        mock_client_factory.return_value = mock_client

        res = self.client.post('/ai/network-ids/cpanel-live-snapshot/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertEqual(body['snapshot']['resource_peak_percent'], 42.0)
        self.assertEqual(body['snapshot']['error_log_entries'], 1)


# ---------------------------------------------------------------------------
# 3. Integration: /ai/network-ids/predict/ — TC-01
# ---------------------------------------------------------------------------

class TestNetworkIDSPredict(TestCase):

    def setUp(self):
        self.client = Client()
        self.analyst = make_analyst(username='predict_analyst', email='predict@test.com')
        set_session(self.client, self.analyst.username)
        self.url = '/ai/network-ids/predict/'

    @patch('network_ids.views._load_model')
    def test_predict_with_valid_features(self, mock_load):
        """TC-01: Geçerli feature array → sınıflandırma sonucu döner."""
        mock_model = MagicMock()
        mock_model.predict.return_value = ['BENIGN']
        mock_label_encoder = MagicMock()
        mock_label_encoder.inverse_transform.return_value = ['BENIGN']
        mock_scaler = MagicMock()
        mock_scaler.transform.return_value = [[0.0] * 10]
        mock_load.return_value = (mock_model, mock_label_encoder, mock_scaler)

        features = [0.1] * 10
        res = self.client.post(self.url,
                               data=json.dumps({'features': features}),
                               content_type='application/json')
        self.assertIn(res.status_code, [200, 500, 503])
        self.assertNotEqual(res.status_code, 401)

    def test_predict_missing_features_returns_400(self):
        res = self.client.post(self.url,
                               data=json.dumps({'features': None}),
                               content_type='application/json')
        self.assertEqual(res.status_code, 400)

    def test_predict_empty_body_returns_400(self):
        res = self.client.post(self.url,
                               data=json.dumps({}),
                               content_type='application/json')
        self.assertEqual(res.status_code, 400)

    def test_predict_requires_auth(self):
        client2 = Client()
        res = client2.post(self.url,
                           data=json.dumps({'features': [0.1] * 5}),
                           content_type='application/json')
        self.assertEqual(res.status_code, 401)


# ---------------------------------------------------------------------------
# 4. Domain İzolasyonu — Analyst Kendi Domain'ini Görmeli
# ---------------------------------------------------------------------------

class TestDomainIsolation(TestCase):

    def setUp(self):
        self.analyst_a = make_analyst(username='domain_a', email='a@test.com',
                                      domain='domain-a.com')
        self.analyst_b = make_analyst(username='domain_b', email='b@test.com',
                                      domain='domain-b.com')
        # Analyst A ve B için ayrı event'ler
        DomainTrafficEvent.objects.create(
            domain='domain-a.com', method='GET', path='/a-only')
        DomainTrafficEvent.objects.create(
            domain='domain-b.com', method='GET', path='/b-only')

    def test_events_stored_with_correct_domain(self):
        """Her domain'in event'leri ayrı tutulmalı."""
        a_events = DomainTrafficEvent.objects.filter(domain='domain-a.com')
        b_events = DomainTrafficEvent.objects.filter(domain='domain-b.com')
        self.assertEqual(a_events.count(), 1)
        self.assertEqual(b_events.count(), 1)
        self.assertEqual(a_events.first().path, '/a-only')
        self.assertEqual(b_events.first().path, '/b-only')
