import json
from unittest.mock import MagicMock, patch

from django.test import Client, TestCase
from django.utils import timezone

from outlook.models import OutlookAccount
from users.models import CustomUser


def make_analyst(username='outlook_analyst', email='outlook@test.com'):
    user = CustomUser(username=username, email=email, role='analyst')
    user.set_password('TestPass123!')
    user.save()
    return user


def make_admin(username='outlook_admin', email='outlook_admin@test.com'):
    user = CustomUser(username=username, email=email, role='admin')
    user.set_password('AdminPass123!')
    user.save()
    return user


def set_session(client, username):
    session = client.session
    session['user_id'] = username
    session.save()


class TestOutlookAuthFlow(TestCase):

    def setUp(self):
        self.client = Client()
        self.analyst = make_analyst()
        set_session(self.client, self.analyst.username)

    def test_save_client_id_requires_auth(self):
        res = Client().post(
            '/outlook/save-client-id',
            data=json.dumps({'client_id': 'cid', 'client_secret': 'secret'}),
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 401)

    def test_save_client_id_rejects_missing_fields(self):
        res = self.client.post(
            '/outlook/save-client-id',
            data=json.dumps({'client_id': 'cid'}),
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 400)

    def test_save_client_id_stores_oauth_values_in_session(self):
        res = self.client.post(
            '/outlook/save-client-id',
            data=json.dumps({'client_id': 'cid-123', 'client_secret': 'secret-123'}),
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 200)
        session = self.client.session
        self.assertEqual(session['outlook_temp_client_id'], 'cid-123')
        self.assertEqual(session['outlook_temp_client_secret'], 'secret-123')

    def test_save_client_id_updates_existing_account_credentials(self):
        account = OutlookAccount(user=self.analyst, expires_at=timezone.now(), is_connected=False)
        account.access_token = 'old-access'
        account.refresh_token = 'old-refresh'
        account.save()

        res = self.client.post(
            '/outlook/save-client-id',
            data=json.dumps({'client_id': 'new-client', 'client_secret': 'new-secret'}),
            content_type='application/json',
        )

        self.assertEqual(res.status_code, 200)
        account.refresh_from_db()
        self.assertEqual(account.client_id, 'new-client')
        self.assertEqual(account.client_secret, 'new-secret')

    def test_authorize_requires_saved_client_id(self):
        res = self.client.get('/outlook/authorize')
        self.assertEqual(res.status_code, 400)

    def test_authorize_returns_microsoft_auth_url(self):
        session = self.client.session
        session['outlook_temp_client_id'] = 'cid-123'
        session.save()

        res = self.client.get('/outlook/authorize')

        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertIn('login.microsoftonline.com', body['auth_url'])
        self.assertIn('cid-123', body['auth_url'])
        self.assertEqual(self.client.session['outlook_auth_user_id'], self.analyst.username)

    def test_admin_cannot_use_analyst_outlook_flow(self):
        admin_client = Client()
        admin = make_admin()
        set_session(admin_client, admin.username)

        res = admin_client.get('/outlook/status')

        self.assertEqual(res.status_code, 403)


class TestOutlookAccountEndpoints(TestCase):

    def setUp(self):
        self.client = Client()
        self.analyst = make_analyst(username='mail_analyst', email='mail@test.com')
        set_session(self.client, self.analyst.username)

    def _connected_account(self):
        account = OutlookAccount(user=self.analyst, expires_at=timezone.now() + timezone.timedelta(hours=1), is_connected=True)
        account.access_token = 'access-token'
        account.refresh_token = 'refresh-token'
        account.client_id = 'client-id'
        account.client_secret = 'client-secret'
        account.outlook_email = 'analyst@example.com'
        account.save()
        return account

    def test_status_returns_disconnected_when_no_account_exists(self):
        res = self.client.get('/outlook/status')
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertFalse(body['is_connected'])

    def test_status_returns_connected_account_details(self):
        self._connected_account()

        res = self.client.get('/outlook/status')

        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['is_connected'])
        self.assertEqual(body['outlook_email'], 'analyst@example.com')

    def test_disconnect_without_account_returns_404(self):
        res = self.client.post('/outlook/disconnect')
        self.assertEqual(res.status_code, 404)

    def test_disconnect_deletes_existing_account(self):
        self._connected_account()

        res = self.client.post('/outlook/disconnect')

        self.assertEqual(res.status_code, 200)
        self.assertFalse(OutlookAccount.objects.filter(user=self.analyst).exists())

    def test_latest_mail_requires_connected_account(self):
        res = self.client.get('/outlook/latest-mail')
        self.assertEqual(res.status_code, 400)

    @patch('outlook.views.requests.get')
    def test_latest_mail_returns_graph_message(self, mock_get):
        self._connected_account()
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            'value': [{
                'subject': 'Security alert',
                'from': {'emailAddress': {'address': 'sender@example.com', 'name': 'Sender'}},
                'receivedDateTime': '2026-04-16T10:00:00Z',
                'bodyPreview': 'Preview text',
                'body': {'content': 'Full body', 'contentType': 'text'},
            }]
        }
        response.raise_for_status.return_value = None
        mock_get.return_value = response

        res = self.client.get('/outlook/latest-mail')

        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertEqual(body['email']['subject'], 'Security alert')
        self.assertEqual(body['email']['from'], 'sender@example.com')

    @patch('outlook.views.requests.get')
    def test_latest_mail_handles_empty_inbox(self, mock_get):
        self._connected_account()
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {'value': []}
        response.raise_for_status.return_value = None
        mock_get.return_value = response

        res = self.client.get('/outlook/latest-mail')

        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertIsNone(body['email'])
