from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from django.test import Client, TestCase

from users.models import CustomUser


class FakeKeyPath:
    def exists(self):
        return True

    def is_file(self):
        return True

    def open(self, mode):
        return BytesIO(b'PRIVATE KEY')


def make_user(username='ssh_analyst', email='ssh@test.com', role='analyst'):
    user = CustomUser(username=username, email=email, role=role)
    user.set_password('TestPass123!')
    user.save()
    return user


def set_session(client, username):
    session = client.session
    session['user_id'] = username
    session.save()


class TestSSHVmLab(TestCase):

    def setUp(self):
        self.client = Client()
        self.analyst = make_user()
        set_session(self.client, self.analyst.username)

    def test_start_instance_requires_auth(self):
        res = Client().get('/ssh-vm-lab/start-instance/')
        self.assertEqual(res.status_code, 401)

    @patch('ssh_vm_lab.views.start_ec2_instance', return_value={'state': 'pending'})
    def test_start_instance_returns_aws_result(self, mock_start):
        res = self.client.get('/ssh-vm-lab/start-instance/')

        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()['success'])
        self.assertEqual(res.json()['data']['state'], 'pending')
        mock_start.assert_called_once()

    @patch('ssh_vm_lab.views.start_ec2_instance', side_effect=Exception('aws unavailable'))
    def test_start_instance_reports_aws_errors(self, mock_start):
        res = self.client.get('/ssh-vm-lab/start-instance/')

        self.assertEqual(res.status_code, 500)
        self.assertFalse(res.json()['success'])

    @patch('ssh_vm_lab.views.AWS_KEY_PATH', Path('C:/missing/awskey.pem'))
    def test_download_key_returns_404_when_key_missing(self):
        res = self.client.get('/ssh-vm-lab/download-key/')
        self.assertEqual(res.status_code, 404)

    def test_download_key_returns_file_when_key_exists(self):
        with patch('ssh_vm_lab.views.AWS_KEY_PATH', FakeKeyPath()), patch('ssh_vm_lab.views.AWS_KEY_FILENAME', 'awskey.pem'):
            res = self.client.get('/ssh-vm-lab/download-key/')

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Disposition'], 'attachment; filename="awskey.pem"')
