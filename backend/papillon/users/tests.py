"""
users/tests.py
FR10 — Security & Access: RBAC, MFA, Authentication
TC-04: RBAC privilege escalation audit (analyst/anon → admin endpoint → 403/401)
TC-12: Session-based auth flow validation
"""
import json
import pyotp
from django.test import TestCase, Client
from users.models import CustomUser


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(username='analyst1', email='analyst1@test.com', role='analyst',
              domain='example.com', password='TestPass123!'):
    user = CustomUser(username=username, email=email, role=role)
    user.set_password(password)
    if role == 'analyst':
        user.domain = domain
    user.save()
    return user


def make_admin(username='admin1', email='admin1@test.com', password='AdminPass123!'):
    user = CustomUser(username=username, email=email, role='admin')
    user.set_password(password)
    user.save()
    return user


def set_session(client, username):
    """Test client'ına doğrudan session set eder — login flow'u bypass eder."""
    session = client.session
    session['user_id'] = username
    session.save()


# ---------------------------------------------------------------------------
# 1. Registration
# ---------------------------------------------------------------------------

class TestUserRegistration(TestCase):

    def setUp(self):
        self.client = Client()
        self.url = '/auth/register/'

    def _post(self, data):
        return self.client.post(self.url, data=json.dumps(data),
                                content_type='application/json')

    def test_register_success_returns_201(self):
        res = self._post({'username': 'newuser', 'email': 'new@test.com', 'password': 'Pass123!'})
        self.assertEqual(res.status_code, 201)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertEqual(body['user']['username'], 'newuser')

    def test_register_duplicate_username_returns_400(self):
        make_user(username='dup', email='dup@test.com')
        res = self._post({'username': 'dup', 'email': 'other@test.com', 'password': 'Pass123!'})
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.json()['success'])

    def test_register_duplicate_email_returns_400(self):
        make_user(username='u1', email='same@test.com')
        res = self._post({'username': 'u2', 'email': 'same@test.com', 'password': 'Pass123!'})
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.json()['success'])

    def test_register_missing_required_fields_returns_400(self):
        res = self._post({'username': 'onlyuser'})
        self.assertEqual(res.status_code, 400)

    def test_register_invalid_json_returns_400(self):
        res = self.client.post(self.url, data='not-json', content_type='application/json')
        self.assertEqual(res.status_code, 400)

    def test_admin_role_clears_domain_on_save(self):
        """Admin kaydedilince domain boşaltılmalı (CustomUser.save() kısıtı)."""
        admin = make_admin()
        admin.refresh_from_db()
        self.assertEqual(admin.domain or '', '')

    def test_admin_role_clears_vm_lab_path_on_save(self):
        admin = make_admin()
        admin.vm_lab_path = '/some/path'
        admin.save()
        admin.refresh_from_db()
        self.assertEqual(admin.vm_lab_path or '', '')


# ---------------------------------------------------------------------------
# 2. Login
# ---------------------------------------------------------------------------

class TestUserLogin(TestCase):

    def setUp(self):
        self.client = Client()
        self.url = '/auth/login/'
        self.user = make_user(username='loginuser', email='login@test.com', password='LoginPass123!')

    def _post(self, data):
        return self.client.post(self.url, data=json.dumps(data),
                                content_type='application/json')

    def test_login_success_no_mfa(self):
        res = self._post({'email': 'login@test.com', 'password': 'LoginPass123!'})
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertFalse(body.get('mfa_required'))

    def test_login_wrong_password_returns_401(self):
        res = self._post({'email': 'login@test.com', 'password': 'WrongPass!'})
        self.assertEqual(res.status_code, 401)
        self.assertFalse(res.json()['success'])

    def test_login_unknown_email_returns_401(self):
        res = self._post({'email': 'ghost@test.com', 'password': 'Pass123!'})
        self.assertEqual(res.status_code, 401)

    def test_login_missing_fields_returns_400(self):
        res = self._post({'email': 'login@test.com'})
        self.assertEqual(res.status_code, 400)

    def test_login_creates_session(self):
        self._post({'email': 'login@test.com', 'password': 'LoginPass123!'})
        self.assertIn('user_id', self.client.session)
        self.assertEqual(self.client.session['user_id'], 'loginuser')

    def test_login_mfa_required_when_enabled(self):
        """MFA aktifse login 'mfa_required: true' dönmeli, session henüz oluşmamalı."""
        self.user.mfa_enabled = True
        self.user.mfa_secret = pyotp.random_base32()
        self.user.save()
        res = self._post({'email': 'login@test.com', 'password': 'LoginPass123!'})
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertTrue(body.get('mfa_required'))
        self.assertIn('mfa_token', body)

    def test_login_inactive_user_rejected(self):
        self.user.is_active = False
        self.user.save()
        res = self._post({'email': 'login@test.com', 'password': 'LoginPass123!'})
        self.assertEqual(res.status_code, 401)


# ---------------------------------------------------------------------------
# 3. Logout
# ---------------------------------------------------------------------------

class TestUserLogout(TestCase):

    def setUp(self):
        self.client = Client()
        self.user = make_user()
        set_session(self.client, self.user.username)

    def test_logout_clears_session(self):
        self.client.post('/auth/logout/')
        self.assertNotIn('user_id', self.client.session)

    def test_logout_returns_success(self):
        res = self.client.post('/auth/logout/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()['success'])

    def test_logout_without_session_still_200(self):
        """Oturumu olmayan kullanıcı logout yaparsa hata dönmemeli."""
        client2 = Client()
        res = client2.post('/auth/logout/')
        self.assertEqual(res.status_code, 200)


# ---------------------------------------------------------------------------
# 4. Dashboard
# ---------------------------------------------------------------------------

class TestDashboard(TestCase):

    def setUp(self):
        self.client = Client()
        self.user = make_user()

    def test_dashboard_requires_auth(self):
        res = self.client.get('/auth/dashboard/')
        self.assertEqual(res.status_code, 401)

    def test_dashboard_returns_user_data_when_authenticated(self):
        set_session(self.client, self.user.username)
        res = self.client.get('/auth/dashboard/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()['success'])


# ---------------------------------------------------------------------------
# 5. MFA Flow
# ---------------------------------------------------------------------------

class TestMFAFlow(TestCase):

    def setUp(self):
        self.client = Client()
        self.user = make_user(username='mfauser', email='mfa@test.com', password='TestPass123!')
        set_session(self.client, self.user.username)

    def test_mfa_setup_returns_qr_and_secret(self):
        res = self.client.post('/auth/mfa/setup/')
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body.get('success'))
        self.assertIn('qr_code', body)
        self.assertIn('secret', body)

    def test_mfa_setup_requires_auth(self):
        client2 = Client()
        res = client2.post('/auth/mfa/setup/')
        self.assertEqual(res.status_code, 401)

    def test_mfa_verify_setup_with_valid_totp_enables_mfa(self):
        setup_res = self.client.post('/auth/mfa/setup/')
        secret = setup_res.json().get('secret')
        self.assertIsNotNone(secret)

        code = pyotp.TOTP(secret).now()
        res = self.client.post('/auth/mfa/verify-setup/',
                               data=json.dumps({'otp_code': code}),
                               content_type='application/json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json().get('success'))

        self.user.refresh_from_db()
        self.assertTrue(self.user.mfa_enabled)

    def test_mfa_verify_setup_with_invalid_code_fails(self):
        self.client.post('/auth/mfa/setup/')
        res = self.client.post('/auth/mfa/verify-setup/',
                               data=json.dumps({'otp_code': '000000'}),
                               content_type='application/json')
        self.assertFalse(res.json().get('success'))

    def test_mfa_status_returns_enabled_flag(self):
        res = self.client.get('/auth/mfa/status/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('mfa_enabled', res.json())

    def test_mfa_full_login_verify_flow(self):
        """MFA aktif kullanıcı → login → mfa_required → verify → session açılır."""
        secret = pyotp.random_base32()
        self.user.mfa_enabled = True
        self.user.mfa_secret = secret
        self.user.save()

        client2 = Client()
        login_res = client2.post('/auth/login/',
                                 data=json.dumps({'email': 'mfa@test.com',
                                                  'password': 'TestPass123!'}),
                                 content_type='application/json')
        self.assertTrue(login_res.json().get('mfa_required'))
        mfa_token = login_res.json().get('mfa_token')

        verify_res = client2.post('/auth/mfa/verify/',
                                  data=json.dumps({
                                      'mfa_token': mfa_token,
                                      'otp_code': pyotp.TOTP(secret).now(),
                                  }),
                                  content_type='application/json')
        self.assertTrue(verify_res.json().get('success'))
        self.assertIn('user_id', client2.session)


# ---------------------------------------------------------------------------
# 6. RBAC — TC-04
# ---------------------------------------------------------------------------

class TestRBACPrivilegeEscalation(TestCase):
    """
    TC-04: RBAC privilege escalation audit.
    Analiz / anonim kullanıcı admin endpoint'e erişememeli.
    Beklenen: 0 başarılı bypass, 403 Forbidden.
    """

    def setUp(self):
        self.client = Client()
        self.analyst = make_user(username='rbac_analyst', email='rbac_a@test.com', role='analyst')
        self.admin = make_admin(username='rbac_admin', email='rbac_adm@test.com')
        # Admin endpoint: GET /auth/resolve-analyst-vm-lab-path/
        self.admin_url = '/auth/resolve-analyst-vm-lab-path/'

    def test_anonymous_gets_401_on_admin_endpoint(self):
        """TC-04: Oturumsuz istek → 401."""
        res = self.client.get(self.admin_url + '?username=rbac_analyst')
        self.assertEqual(res.status_code, 401)
        self.assertFalse(res.json()['success'])

    def test_analyst_gets_403_on_admin_endpoint(self):
        """TC-04: Analyst rolü → admin endpoint → 403 Forbidden."""
        set_session(self.client, self.analyst.username)
        res = self.client.get(self.admin_url + '?username=rbac_analyst')
        self.assertEqual(res.status_code, 403)
        self.assertFalse(res.json()['success'])

    def test_zero_successful_rbac_bypasses(self):
        """TC-04: Analyst'in admin endpoint'e hiçbir şekilde erişim sağlayamaması."""
        set_session(self.client, self.analyst.username)
        for _ in range(3):  # Birden fazla deneme
            res = self.client.get(self.admin_url + '?username=rbac_analyst')
            self.assertEqual(res.status_code, 403)

    def test_admin_can_access_admin_endpoint(self):
        """TC-04: Admin rolü → admin endpoint → 403 değil."""
        self.analyst.domain = 'example.com'
        self.analyst.vm_lab_path = '/vms/lab.vmx'
        self.analyst.save()
        set_session(self.client, self.admin.username)
        res = self.client.get(self.admin_url + f'?username={self.analyst.username}')
        self.assertNotEqual(res.status_code, 403)
        self.assertNotEqual(res.status_code, 401)


# ---------------------------------------------------------------------------
# 7. Profile Management
# ---------------------------------------------------------------------------

class TestProfileManagement(TestCase):

    def setUp(self):
        self.client = Client()
        self.analyst = make_user(username='prof_analyst', email='prof@test.com', role='analyst')
        self.admin = make_admin(username='prof_admin', email='prof_admin@test.com')

    def test_analyst_can_update_domain(self):
        set_session(self.client, self.analyst.username)
        res = self.client.post('/auth/update-domain/',
                               data=json.dumps({'domain': 'newdomain.com'}),
                               content_type='application/json')
        self.assertEqual(res.status_code, 200)
        self.analyst.refresh_from_db()
        self.assertEqual(self.analyst.domain, 'newdomain.com')

    def test_admin_cannot_update_domain(self):
        set_session(self.client, self.admin.username)
        res = self.client.post('/auth/update-domain/',
                               data=json.dumps({'domain': 'admin-domain.com'}),
                               content_type='application/json')
        self.assertEqual(res.status_code, 403)

    def test_analyst_can_update_vm_lab_path(self):
        set_session(self.client, self.analyst.username)
        res = self.client.post('/auth/update-vm-lab-path/',
                               data=json.dumps({'vm_lab_path': 'C:/VMs/lab.vmx'}),
                               content_type='application/json')
        self.assertEqual(res.status_code, 200)
        self.analyst.refresh_from_db()
        self.assertEqual(self.analyst.vm_lab_path, 'C:/VMs/lab.vmx')

    def test_admin_cannot_update_vm_lab_path(self):
        set_session(self.client, self.admin.username)
        res = self.client.post('/auth/update-vm-lab-path/',
                               data=json.dumps({'vm_lab_path': '/some/path'}),
                               content_type='application/json')
        self.assertEqual(res.status_code, 403)

    def test_change_password_success(self):
        set_session(self.client, self.analyst.username)
        res = self.client.post('/auth/change-password/',
                               data=json.dumps({'current_password': 'TestPass123!',
                                                'new_password': 'NewPass456!'}),
                               content_type='application/json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()['success'])

    def test_change_password_wrong_old_fails(self):
        set_session(self.client, self.analyst.username)
        res = self.client.post('/auth/change-password/',
                               data=json.dumps({'current_password': 'WrongOld!',
                                                'new_password': 'NewPass456!'}),
                               content_type='application/json')
        self.assertFalse(res.json()['success'])

    def test_update_domain_requires_auth(self):
        res = self.client.post('/auth/update-domain/',
                               data=json.dumps({'domain': 'test.com'}),
                               content_type='application/json')
        self.assertEqual(res.status_code, 401)

    def test_update_vm_lab_path_requires_auth(self):
        res = self.client.post('/auth/update-vm-lab-path/',
                               data=json.dumps({'vm_lab_path': '/path'}),
                               content_type='application/json')
        self.assertEqual(res.status_code, 401)
