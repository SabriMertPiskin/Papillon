"""
password_ai/tests.py
FR11 — Password Strength Detection
TC-11: Feature extraction & Random Forest classification
Unit:  entropy calculation, feature extraction, edge cases
Integration: /ai/password-strength/predict/ endpoint (model mocked)
"""
import json
import math
from unittest.mock import patch, MagicMock
import pandas as pd
from django.test import TestCase, Client

# Doğrudan views modülünden helper fonksiyonları import et
from password_ai.views import _calculate_entropy, _extract_features, _generate_suggestions


# ---------------------------------------------------------------------------
# 1. Unit: Entropy Calculation — TC-11
# ---------------------------------------------------------------------------

class TestEntropyCalculation(TestCase):
    """
    TC-11: Şifre entropi hesabı doğru çalışmalı.
    """

    def test_empty_password_entropy_is_zero(self):
        self.assertEqual(_calculate_entropy(''), 0)

    def test_single_char_lowercase_entropy(self):
        # charset_size = 26, length = 1 → entropy = log2(26) ≈ 4.7
        entropy = _calculate_entropy('a')
        self.assertAlmostEqual(entropy, math.log2(26), places=5)

    def test_all_lowercase_entropy_proportional_to_length(self):
        e1 = _calculate_entropy('abc')
        e2 = _calculate_entropy('abcdef')
        # Uzun şifre daha yüksek entropi
        self.assertGreater(e2, e1)

    def test_complex_password_has_high_entropy(self):
        """TC-11: Karmaşık şifre → yüksek entropi."""
        entropy = _calculate_entropy('StrongP@ssw0rd!')
        # uppercase(26) + lowercase(26) + digit(10) + special(32) = 94
        # entropi = 15 * log2(94) ≈ 98.5
        self.assertGreater(entropy, 50.0)

    def test_weak_password_has_low_entropy(self):
        """TC-11: Basit şifre → düşük entropi."""
        entropy = _calculate_entropy('123')
        # sadece digit, length=3 → 3 * log2(10) ≈ 9.97
        self.assertLess(entropy, 15.0)

    def test_digits_only_charset_is_10(self):
        entropy = _calculate_entropy('0')
        self.assertAlmostEqual(entropy, math.log2(10), places=5)

    def test_mixed_upper_lower_increases_entropy(self):
        e_lower = _calculate_entropy('abc')
        e_mixed = _calculate_entropy('aBc')
        self.assertGreater(e_mixed, e_lower)

    def test_special_chars_increase_entropy(self):
        e_plain = _calculate_entropy('abc123')
        e_special = _calculate_entropy('abc123!')
        self.assertGreater(e_special, e_plain)

    def test_turkish_chars_add_to_charset(self):
        """TC-11: Türkçe karakter içeren şifre — charset artmalı."""
        e_ascii = _calculate_entropy('abcdef')
        e_turkish = _calculate_entropy('abcğüş')
        # Türkçe char varsa charset büyür → entropi artar (aynı uzunlukta)
        self.assertGreaterEqual(e_turkish, e_ascii)


# ---------------------------------------------------------------------------
# 2. Unit: Feature Extraction — TC-11
# ---------------------------------------------------------------------------

class TestFeatureExtraction(TestCase):
    """
    TC-11: Feature extraction doğru çalışmalı.
    """

    def _features(self, password):
        df = _extract_features(password)
        return df.iloc[0].to_dict()

    def test_feature_length_correct(self):
        f = self._features('hello')
        self.assertEqual(f['length'], 5)

    def test_feature_has_upper_detected(self):
        f = self._features('Hello')
        self.assertEqual(f['has_upper'], 1)

    def test_feature_has_upper_not_detected_for_lowercase(self):
        f = self._features('hello')
        self.assertEqual(f['has_upper'], 0)

    def test_feature_has_lower_detected(self):
        f = self._features('Hello')
        self.assertEqual(f['has_lower'], 1)

    def test_feature_has_digit_detected(self):
        f = self._features('abc123')
        self.assertEqual(f['has_digit'], 1)
        self.assertEqual(f['digit_count'], 3)

    def test_feature_has_special_detected(self):
        f = self._features('abc!')
        self.assertEqual(f['has_special'], 1)

    def test_feature_unique_chars(self):
        f = self._features('aabbcc')
        self.assertEqual(f['unique_chars'], 3)

    def test_feature_repeated_ratio(self):
        # 'aaaa' → unique=1, length=4 → repeated_ratio = 4/1 = 4
        f = self._features('aaaa')
        self.assertEqual(f['repeated_ratio'], 4.0)

    def test_feature_entropy_matches_standalone_function(self):
        password = 'TestPass123!'
        f = self._features(password)
        expected_entropy = _calculate_entropy(password)
        self.assertAlmostEqual(f['entropy'], expected_entropy, places=5)

    def test_feature_extraction_returns_dataframe(self):
        result = _extract_features('test')
        self.assertIsInstance(result, pd.DataFrame)
        self.assertEqual(len(result), 1)


# ---------------------------------------------------------------------------
# 3. Unit: Suggestion Generation — TC-11
# ---------------------------------------------------------------------------

class TestSuggestionGeneration(TestCase):

    def test_short_password_gets_length_suggestion(self):
        suggestions = _generate_suggestions('abc', 'Weak')
        self.assertTrue(any('8 characters' in s for s in suggestions))

    def test_no_uppercase_gets_suggestion(self):
        suggestions = _generate_suggestions('abcdef123!', 'Normal')
        self.assertTrue(any('uppercase' in s.lower() for s in suggestions))

    def test_no_digit_gets_suggestion(self):
        suggestions = _generate_suggestions('abcABC!!!', 'Normal')
        self.assertTrue(any('number' in s.lower() or 'digit' in s.lower()
                            for s in suggestions))

    def test_common_password_gets_warning(self):
        suggestions = _generate_suggestions('password', 'Weak')
        self.assertTrue(any('commonly used' in s.lower() for s in suggestions))

    def test_strong_password_gets_mfa_suggestion(self):
        suggestions = _generate_suggestions('StrongP@ssw0rd!XYZ', 'Strong')
        self.assertTrue(any('MFA' in s or 'mfa' in s.lower() for s in suggestions))


# ---------------------------------------------------------------------------
# 4. Integration: /ai/password-strength/predict/ — TC-11
# ---------------------------------------------------------------------------

class TestPasswordStrengthEndpoint(TestCase):
    """
    TC-11: API endpoint — model mocked, business logic test edilir.
    """

    def setUp(self):
        self.client = Client()
        self.url = '/ai/password-strength/predict/'

    def _post(self, password):
        return self.client.post(self.url,
                                data=json.dumps({'password': password}),
                                content_type='application/json')

    @patch('password_ai.views._get_model')
    def test_strong_password_returns_strength_level_2(self, mock_get_model):
        """TC-11: 'StrongP@ssw0rd!' → model strength_level: 2 (Strong) döndürmeli."""
        mock_model = MagicMock()
        mock_model.predict.return_value = [2]
        mock_get_model.return_value = mock_model

        res = self._post('StrongP@ssw0rd!')
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertEqual(body['strength_level'], 2)
        self.assertEqual(body['prediction'], 'Strong')

    @patch('password_ai.views._get_model')
    def test_weak_password_returns_strength_level_0(self, mock_get_model):
        """TC-11: '123' → model strength_level: 0 (Weak) döndürmeli."""
        mock_model = MagicMock()
        mock_model.predict.return_value = [0]
        mock_get_model.return_value = mock_model

        res = self._post('123')
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body['strength_level'], 0)
        self.assertEqual(body['prediction'], 'Weak')

    @patch('password_ai.views._get_model')
    def test_normal_password_returns_strength_level_1(self, mock_get_model):
        mock_model = MagicMock()
        mock_model.predict.return_value = [1]
        mock_get_model.return_value = mock_model

        res = self._post('NormalPass1')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['strength_level'], 1)
        self.assertEqual(res.json()['prediction'], 'Normal')

    @patch('password_ai.views._get_model')
    def test_response_contains_entropy_and_length(self, mock_get_model):
        mock_model = MagicMock()
        mock_model.predict.return_value = [2]
        mock_get_model.return_value = mock_model

        res = self._post('StrongP@ssw0rd!')
        body = res.json()
        self.assertIn('entropy', body)
        self.assertIn('password_length', body)
        self.assertGreater(body['entropy'], 0)

    @patch('password_ai.views._get_model')
    def test_response_contains_suggestions(self, mock_get_model):
        mock_model = MagicMock()
        mock_model.predict.return_value = [0]
        mock_get_model.return_value = mock_model

        res = self._post('abc')
        self.assertIn('suggestions', res.json())

    def test_empty_password_returns_400(self):
        res = self._post('')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.json()['success'])

    def test_missing_password_field_returns_400(self):
        res = self.client.post(self.url, data=json.dumps({}),
                               content_type='application/json')
        self.assertEqual(res.status_code, 400)

    def test_invalid_json_returns_400(self):
        res = self.client.post(self.url, data='not-json',
                               content_type='application/json')
        self.assertEqual(res.status_code, 400)

    @patch('password_ai.views._get_model')
    def test_endpoint_is_public_no_auth_required(self, mock_get_model):
        """Password strength endpoint auth gerektirmemeli."""
        mock_model = MagicMock()
        mock_model.predict.return_value = [1]
        mock_get_model.return_value = mock_model

        res = self._post('SomePassword1!')
        # 401 dönmemeli
        self.assertNotEqual(res.status_code, 401)

    @patch('password_ai.views._get_model')
    def test_very_short_password_edge_case(self, mock_get_model):
        """TC-11: Edge case — tek karakter şifre."""
        mock_model = MagicMock()
        mock_model.predict.return_value = [0]
        mock_get_model.return_value = mock_model

        res = self._post('x')
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body['password_length'], 1)

    @patch('password_ai.views._get_model')
    def test_very_long_complex_password_edge_case(self, mock_get_model):
        """TC-11: Edge case — çok uzun ve karmaşık şifre."""
        mock_model = MagicMock()
        mock_model.predict.return_value = [2]
        mock_get_model.return_value = mock_model

        long_pass = 'Ab1!Cd2@Ef3#Gh4$Ij5%Kl6^Mn7&Op8*Qr9(St0)'
        res = self._post(long_pass)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['strength_level'], 2)
