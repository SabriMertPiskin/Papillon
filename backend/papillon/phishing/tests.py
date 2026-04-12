"""
phishing/tests.py
FR6  — Phishing Detection (OAuth & ML Scoring within SLA)
TC-02: Phishing ML model accuracy (Precision ≥ 0.90, Recall ≥ 0.80)
Integration: /ai/phishing/predict/ and /ai/phishing/history/ endpoints (model mocked)

Response structure:
  predict → { success, result: { id, is_phishing, label, score, status, ai_reasons, scanned_at } }
  history → { success, logs: [...], stats: {...} }
"""
import json
from unittest.mock import patch, MagicMock
from django.test import TestCase, Client
from phishing.models import PhishingLog
from phishing.views import _generate_ai_reasons, _score_from_prediction
from users.models import CustomUser


def make_user(username='phish_user', email='phish@test.com'):
    user = CustomUser(username=username, email=email, role='analyst')
    user.set_password('TestPass123!')
    user.domain = 'example.com'
    user.save()
    return user


def set_session(client, username):
    session = client.session
    session['user_id'] = username
    session.save()


# ---------------------------------------------------------------------------
# 1. Unit: Score & Reason Helpers
# ---------------------------------------------------------------------------

class TestPhishingHelpers(TestCase):

    def test_phishing_prediction_score_is_90_and_status_phishing(self):
        score, status = _score_from_prediction(is_phishing=True)
        self.assertEqual(score, 90)
        self.assertEqual(status, 'phishing')

    def test_clean_prediction_score_is_10_and_status_clean(self):
        score, status = _score_from_prediction(is_phishing=False)
        self.assertEqual(score, 10)
        self.assertEqual(status, 'clean')

    def test_generate_reasons_for_phishing_label(self):
        prediction = {'label': 'PHISHING', 'is_phishing': True}
        reasons = _generate_ai_reasons(prediction,
                                       sender='attacker@evil-unknown.com',
                                       subject='URGENT! Verify your account now')
        self.assertGreater(len(reasons), 0)
        combined = ' '.join(reasons).lower()
        self.assertTrue('phishing' in combined or 'model' in combined
                        or 'suspicious' in combined)

    def test_generate_reasons_for_clean_label(self):
        prediction = {'label': 'SAFE', 'is_phishing': False}
        reasons = _generate_ai_reasons(prediction,
                                       sender='noreply@gmail.com',
                                       subject='Your receipt')
        self.assertGreater(len(reasons), 0)
        combined = ' '.join(reasons).lower()
        self.assertIn('safe', combined)

    def test_urgency_keywords_detected_in_subject(self):
        """Urgency kelimeler subject'te varsa gerekçe listesine eklenmeli."""
        prediction = {'label': 'PHISHING', 'is_phishing': True}
        reasons = _generate_ai_reasons(prediction,
                                       sender='x@x.com',
                                       subject='URGENT! Account suspended')
        combined = ' '.join(reasons).lower()
        self.assertTrue('urgent' in combined or 'urgency' in combined
                        or 'keyword' in combined)

    def test_unknown_sender_domain_flagged(self):
        """Tanınmayan domain sender'ı işaretlenmeli."""
        prediction = {'label': 'PHISHING', 'is_phishing': True}
        reasons = _generate_ai_reasons(prediction,
                                       sender='user@totally-unknown-xyz123.com',
                                       subject='Hello')
        combined = ' '.join(reasons).lower()
        self.assertTrue('domain' in combined or 'sender' in combined)

    def test_known_sender_domain_not_flagged_as_unknown(self):
        prediction = {'label': 'PHISHING', 'is_phishing': True}
        reasons = _generate_ai_reasons(prediction,
                                       sender='user@gmail.com',
                                       subject='Urgent!')
        combined = ' '.join(reasons).lower()
        self.assertNotIn('not recognized', combined)


# ---------------------------------------------------------------------------
# 2. Integration: /ai/phishing/predict/ — TC-02
# ---------------------------------------------------------------------------

class TestPhishingPredictEndpoint(TestCase):
    """
    TC-02: Phishing ML model endpoint testleri (model mocked).
    Response format: { success: bool, result: { status, score, ai_reasons, ... } }
    """

    def setUp(self):
        self.client = Client()
        self.user = make_user()
        set_session(self.client, self.user.username)
        self.url = '/ai/phishing/predict/'

    def _post(self, data):
        return self.client.post(self.url, data=json.dumps(data),
                                content_type='application/json')

    @patch('phishing.views._get_detector')
    def test_phishing_email_returns_phishing_status(self, mock_get_detector):
        """TC-02: Phishing email → result.status: 'phishing', result.score ≥ 80."""
        mock_detector = MagicMock()
        mock_detector.predict.return_value = {'is_phishing': True, 'label': 'PHISHING'}
        mock_get_detector.return_value = mock_detector

        res = self._post({
            'email_text': 'Click here immediately to verify your account or it will be suspended!',
            'sender': 'attacker@evil-domain.xyz',
            'subject': 'URGENT! Account suspended',
        })
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        result = body['result']
        self.assertEqual(result['status'], 'phishing')
        self.assertGreaterEqual(result['score'], 80)

    @patch('phishing.views._get_detector')
    def test_clean_email_returns_clean_status(self, mock_get_detector):
        """TC-02: Temiz email → result.status: 'clean'."""
        mock_detector = MagicMock()
        mock_detector.predict.return_value = {'is_phishing': False, 'label': 'SAFE'}
        mock_get_detector.return_value = mock_detector

        res = self._post({
            'email_text': 'Hi, your order has been shipped. Thank you for your purchase.',
            'sender': 'noreply@amazon.com',
            'subject': 'Your order is on the way',
        })
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertEqual(body['result']['status'], 'clean')

    @patch('phishing.views._get_detector')
    def test_prediction_saved_to_db(self, mock_get_detector):
        """Analiz sonucu PhishingLog olarak DB'ye kaydedilmeli."""
        mock_detector = MagicMock()
        mock_detector.predict.return_value = {'is_phishing': False, 'label': 'SAFE'}
        mock_get_detector.return_value = mock_detector

        self._post({
            'email_text': 'Normal email content here',
            'sender': 'sender@example.com',
            'subject': 'Hello',
        })
        self.assertTrue(PhishingLog.objects.filter(user=self.user).exists())

    @patch('phishing.views._get_detector')
    def test_response_contains_ai_reasons(self, mock_get_detector):
        """TC-02: Response result.ai_reasons listesi içermeli."""
        mock_detector = MagicMock()
        mock_detector.predict.return_value = {'is_phishing': True, 'label': 'PHISHING'}
        mock_get_detector.return_value = mock_detector

        res = self._post({
            'email_text': 'Phishing attempt click here now',
            'sender': 'x@bad.com',
            'subject': 'Urgent!',
        })
        body = res.json()
        self.assertIn('result', body)
        result = body['result']
        self.assertIn('ai_reasons', result)
        self.assertIsInstance(result['ai_reasons'], list)
        self.assertGreater(len(result['ai_reasons']), 0)

    @patch('phishing.views._get_detector')
    def test_response_result_contains_required_fields(self, mock_get_detector):
        """TC-02: result objesi id, is_phishing, label, score, status, scanned_at içermeli."""
        mock_detector = MagicMock()
        mock_detector.predict.return_value = {'is_phishing': True, 'label': 'PHISHING'}
        mock_get_detector.return_value = mock_detector

        res = self._post({'email_text': 'test phishing', 'sender': 'x@x.com', 'subject': 'test'})
        result = res.json()['result']
        for field in ['id', 'is_phishing', 'label', 'score', 'status', 'scanned_at']:
            self.assertIn(field, result, msg=f"'{field}' result'da eksik")

    def test_missing_email_text_returns_400(self):
        res = self._post({'sender': 'x@x.com', 'subject': 'test'})
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.json()['success'])

    def test_empty_email_text_returns_400(self):
        res = self._post({'email_text': '', 'sender': 'x@x.com', 'subject': 'test'})
        self.assertEqual(res.status_code, 400)

    def test_unauthenticated_returns_401(self):
        client2 = Client()
        res = client2.post(self.url,
                           data=json.dumps({'email_text': 'test email',
                                            'sender': '', 'subject': ''}),
                           content_type='application/json')
        self.assertEqual(res.status_code, 401)

    def test_invalid_json_returns_400(self):
        res = self.client.post(self.url, data='not-json',
                               content_type='application/json')
        self.assertEqual(res.status_code, 400)

    @patch('phishing.views._get_detector')
    def test_model_error_response_returns_500(self, mock_get_detector):
        """Model hata döndürürse 500 dönmeli."""
        mock_detector = MagicMock()
        mock_detector.predict.return_value = {'error': 'Model inference failed'}
        mock_get_detector.return_value = mock_detector

        res = self._post({'email_text': 'some email', 'sender': '', 'subject': ''})
        self.assertEqual(res.status_code, 500)

    @patch('phishing.views._get_detector')
    def test_model_unavailable_returns_503(self, mock_get_detector):
        mock_get_detector.return_value = None
        res = self._post({'email_text': 'some email', 'sender': '', 'subject': ''})
        self.assertEqual(res.status_code, 503)


# ---------------------------------------------------------------------------
# 3. Integration: /ai/phishing/history/ — TC-02
# ---------------------------------------------------------------------------

class TestPhishingHistoryEndpoint(TestCase):

    def setUp(self):
        self.client = Client()
        self.user = make_user(username='hist_user', email='hist@test.com')
        set_session(self.client, self.user.username)
        self.url = '/ai/phishing/history/'

    def test_history_returns_200_and_success(self):
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])

    def test_history_shows_user_logs(self):
        PhishingLog.objects.create(
            user=self.user,
            sender='attacker@evil.com',
            subject='Test phishing',
            preview='test content',
            score=90,
            status='phishing',
        )
        res = self.client.get(self.url)
        body = res.json()
        self.assertIn('logs', body)
        self.assertEqual(len(body['logs']), 1)
        self.assertEqual(body['logs'][0]['subject'], 'Test phishing')

    def test_history_does_not_show_other_user_logs(self):
        """Başka kullanıcının logları görünmemeli."""
        other_user = make_user(username='other_phish', email='other_phish@test.com')
        PhishingLog.objects.create(
            user=other_user,
            sender='x@x.com',
            subject='Other user log',
            preview='',
            score=10,
            status='clean',
        )
        res = self.client.get(self.url)
        subjects = [log['subject'] for log in res.json().get('logs', [])]
        self.assertNotIn('Other user log', subjects)

    def test_history_contains_stats(self):
        """History response istatistik alanı içermeli."""
        res = self.client.get(self.url)
        body = res.json()
        self.assertIn('stats', body)

    def test_history_status_filter(self):
        """?status=phishing filtresi çalışmalı."""
        PhishingLog.objects.create(user=self.user, sender='x@x.com',
                                   subject='Phishing', preview='', score=90, status='phishing')
        PhishingLog.objects.create(user=self.user, sender='y@y.com',
                                   subject='Clean', preview='', score=10, status='clean')
        res = self.client.get(self.url + '?status=phishing')
        logs = res.json().get('logs', [])
        self.assertTrue(all(log['status'] == 'phishing' for log in logs))

    def test_history_requires_auth(self):
        client2 = Client()
        res = client2.get(self.url)
        self.assertEqual(res.status_code, 401)
