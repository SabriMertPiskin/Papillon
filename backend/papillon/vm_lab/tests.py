import json
from unittest.mock import MagicMock, patch

from django.test import Client, TestCase

from users.models import CustomUser
from vm_lab import views


def make_user(username, email, role='analyst', domain='example.com', vm_lab_path='C:/labs/vm'):
    user = CustomUser(username=username, email=email, role=role, domain=domain, vm_lab_path=vm_lab_path)
    user.set_password('TestPass123!')
    user.save()
    return user


def set_session(client, username):
    session = client.session
    session['user_id'] = username
    session.save()


class TestVMLabMachineLifecycle(TestCase):

    def setUp(self):
        views._MACHINE_SESSIONS.clear()
        self.client = Client()
        self.analyst = make_user('vm_analyst', 'vm@test.com')
        set_session(self.client, self.analyst.username)

    def tearDown(self):
        views._MACHINE_SESSIONS.clear()

    def test_machine_status_requires_auth(self):
        res = Client().get('/vm-lab/status')
        self.assertEqual(res.status_code, 401)

    def test_machine_status_returns_not_running_by_default(self):
        res = self.client.get('/vm-lab/status')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json()['machine']['running'])

    def test_start_machine_requires_saved_vm_lab_path(self):
        self.analyst.vm_lab_path = ''
        self.analyst.save()

        res = self.client.post('/vm-lab/start')

        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.json()['success'])

    @patch('vm_lab.views.requests.get')
    def test_start_machine_triggers_agent_and_records_state(self, mock_get):
        response = MagicMock()
        response.status_code = 200
        response.text = 'started'
        mock_get.return_value = response

        res = self.client.post('/vm-lab/start')

        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertTrue(body['machine']['running'])
        self.assertIn(self.analyst.username, views._MACHINE_SESSIONS)
        mock_get.assert_called_once()

    @patch('vm_lab.views.requests.get')
    def test_start_machine_agent_failure_returns_502(self, mock_get):
        response = MagicMock()
        response.status_code = 500
        response.text = 'failed'
        mock_get.return_value = response

        res = self.client.post('/vm-lab/start')

        self.assertEqual(res.status_code, 502)
        self.assertFalse(res.json()['success'])

    @patch('vm_lab.views.requests.get')
    def test_terminate_machine_clears_running_state(self, mock_get):
        response = MagicMock()
        response.status_code = 200
        response.text = 'ok'
        mock_get.return_value = response
        self.client.post('/vm-lab/start')

        res = self.client.post('/vm-lab/terminate')

        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json()['machine']['running'])
        self.assertNotIn(self.analyst.username, views._MACHINE_SESSIONS)

    def test_admin_start_requires_for_analyst(self):
        admin = make_user('vm_admin', 'vm_admin@test.com', role='admin')
        admin_client = Client()
        set_session(admin_client, admin.username)

        res = admin_client.post('/vm-lab/start', data=json.dumps({}), content_type='application/json')

        self.assertEqual(res.status_code, 400)

    @patch('vm_lab.views.requests.get')
    def test_admin_can_start_for_named_analyst(self, mock_get):
        admin = make_user('vm_admin2', 'vm_admin2@test.com', role='admin')
        admin_client = Client()
        set_session(admin_client, admin.username)
        response = MagicMock()
        response.status_code = 200
        response.text = 'started'
        mock_get.return_value = response

        res = admin_client.post(
            '/vm-lab/start',
            data=json.dumps({'for_analyst': self.analyst.username}),
            content_type='application/json',
        )

        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()['machine']['running'])


class TestVMLabAwsStartView(TestCase):

    @patch('vm_lab.views.start_ec2_instance', return_value={'state': 'pending'})
    def test_start_instance_view_wraps_aws_result(self, mock_start):
        res = Client().get('/vm-lab/start-instance/')

        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()['success'])
        mock_start.assert_called_once()
