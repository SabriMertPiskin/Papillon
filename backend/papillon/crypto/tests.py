"""
crypto/tests.py
FR8  — Cryptography Module (AES-256-GCM, RSA-2048, Hash functions)
TC-09: Encrypt → decrypt roundtrip; data must match exactly.
Unit:  AES, RSA roundtrip without HTTP layer
Integration: /crypto/encrypt/ and /crypto/decrypt/ endpoints
"""
import json
import base64
from django.test import TestCase, Client
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.backends import default_backend
from crypto.models import EncryptedData
from users.models import CustomUser


def make_user(username='crypto_user', email='crypto@test.com'):
    user = CustomUser(username=username, email=email, role='analyst')
    user.set_password('CryptoPass123!')
    user.domain = 'example.com'
    user.save()
    return user


def set_session(client, username):
    session = client.session
    session['user_id'] = username
    session.save()


# ---------------------------------------------------------------------------
# 1. Unit: AES-256-GCM roundtrip — TC-09
# ---------------------------------------------------------------------------

class TestAES256GCMUnit(TestCase):
    """
    TC-09: AES-256-GCM encrypt → decrypt roundtrip.
    Şifrelenmiş ve çözülen veri tam eşleşmeli.
    """

    def test_aes_encrypt_decrypt_roundtrip(self):
        """TC-09: Plaintext → encrypt → decrypt → aynı plaintext."""
        plaintext = b'Papillon test payload - secret message'
        key = AESGCM.generate_key(bit_length=256)
        nonce = b'\x00' * 12

        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(nonce, plaintext, None)
        decrypted = aesgcm.decrypt(nonce, ciphertext, None)

        self.assertEqual(decrypted, plaintext)

    def test_aes_key_is_256_bits(self):
        key = AESGCM.generate_key(bit_length=256)
        self.assertEqual(len(key), 32)  # 256 bit = 32 byte

    def test_aes_different_nonces_produce_different_ciphertexts(self):
        plaintext = b'same message'
        key = AESGCM.generate_key(bit_length=256)
        nonce1 = b'\x01' * 12
        nonce2 = b'\x02' * 12

        aesgcm = AESGCM(key)
        ct1 = aesgcm.encrypt(nonce1, plaintext, None)
        ct2 = aesgcm.encrypt(nonce2, plaintext, None)

        self.assertNotEqual(ct1, ct2)

    def test_aes_wrong_key_raises_exception(self):
        plaintext = b'secret'
        key1 = AESGCM.generate_key(bit_length=256)
        key2 = AESGCM.generate_key(bit_length=256)
        nonce = b'\x00' * 12

        ct = AESGCM(key1).encrypt(nonce, plaintext, None)
        with self.assertRaises(Exception):
            AESGCM(key2).decrypt(nonce, ct, None)

    def test_aes_empty_plaintext_encrypted_and_decrypted(self):
        key = AESGCM.generate_key(bit_length=256)
        nonce = b'\x00' * 12
        aesgcm = AESGCM(key)
        ct = aesgcm.encrypt(nonce, b'', None)
        decrypted = aesgcm.decrypt(nonce, ct, None)
        self.assertEqual(decrypted, b'')


# ---------------------------------------------------------------------------
# 2. Unit: RSA-2048 roundtrip — TC-09
# ---------------------------------------------------------------------------

class TestRSA2048Unit(TestCase):
    """
    TC-09: RSA-2048 encrypt → decrypt roundtrip.
    """

    def setUp(self):
        self.private_key = rsa.generate_private_key(
            public_exponent=65537, key_size=2048, backend=default_backend()
        )
        self.public_key = self.private_key.public_key()

    def test_rsa_encrypt_decrypt_roundtrip(self):
        """TC-09: RSA encrypt → decrypt → plaintext eşleşmeli."""
        plaintext = b'RSA test message'
        ciphertext = self.public_key.encrypt(
            plaintext,
            padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()),
                         algorithm=hashes.SHA256(), label=None)
        )
        decrypted = self.private_key.decrypt(
            ciphertext,
            padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()),
                         algorithm=hashes.SHA256(), label=None)
        )
        self.assertEqual(decrypted, plaintext)

    def test_rsa_key_size_is_2048(self):
        self.assertEqual(self.private_key.key_size, 2048)

    def test_rsa_wrong_key_raises_exception(self):
        plaintext = b'secret data'
        ciphertext = self.public_key.encrypt(
            plaintext,
            padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()),
                         algorithm=hashes.SHA256(), label=None)
        )
        other_key = rsa.generate_private_key(
            public_exponent=65537, key_size=2048, backend=default_backend()
        )
        with self.assertRaises(Exception):
            other_key.decrypt(
                ciphertext,
                padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()),
                             algorithm=hashes.SHA256(), label=None)
            )

    def test_rsa_pem_serialization_and_deserialization(self):
        """Private key PEM olarak serialize → deserialize → aynı key."""
        pem = self.private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        loaded = serialization.load_pem_private_key(pem, password=None,
                                                     backend=default_backend())
        self.assertEqual(loaded.key_size, 2048)


# ---------------------------------------------------------------------------
# 3. Integration: /crypto/encrypt/ endpoint — TC-09
# ---------------------------------------------------------------------------

class TestCryptoEncryptEndpoint(TestCase):

    def setUp(self):
        self.client = Client()
        self.user = make_user()
        set_session(self.client, self.user.username)

    def _post_encrypt(self, data):
        return self.client.post('/crypto/encrypt/',
                                data=json.dumps(data),
                                content_type='application/json')

    def test_aes_encrypt_endpoint_returns_encrypted_data(self):
        """TC-09: POST /crypto/encrypt/ AES-256-GCM → ciphertext, key, nonce döner."""
        res = self._post_encrypt({'text': 'hello world', 'algorithm': 'AES-256-GCM'})
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertIn('encrypted', body)
        enc = body['encrypted']
        self.assertIn('ciphertext', enc)
        self.assertIn('key', enc)
        self.assertIn('nonce', enc)

    def test_aes_encrypt_saves_to_db(self):
        self._post_encrypt({'text': 'db test', 'algorithm': 'AES-256-GCM'})
        self.assertTrue(EncryptedData.objects.filter(
            user=self.user, algorithm='AES-256-GCM').exists())

    def test_rsa_encrypt_endpoint_returns_keys(self):
        """TC-09: POST /crypto/encrypt/ RSA-2048 → ciphertext, private_key, public_key döner."""
        res = self._post_encrypt({'text': 'rsa message', 'algorithm': 'RSA-2048'})
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        enc = body['encrypted']
        self.assertIn('ciphertext', enc)
        self.assertIn('private_key', enc)
        self.assertIn('public_key', enc)

    def test_sha256_hash_deterministic(self):
        """Aynı input → her zaman aynı SHA-256 hash."""
        res1 = self._post_encrypt({'text': 'consistent', 'algorithm': 'SHA-256'})
        res2 = self._post_encrypt({'text': 'consistent', 'algorithm': 'SHA-256'})
        hash1 = res1.json()['encrypted']['hash']
        hash2 = res2.json()['encrypted']['hash']
        self.assertEqual(hash1, hash2)

    def test_sha512_endpoint(self):
        res = self._post_encrypt({'text': 'test sha512', 'algorithm': 'SHA-512'})
        self.assertEqual(res.status_code, 200)
        self.assertIn('hash', res.json()['encrypted'])

    def test_md5_endpoint(self):
        res = self._post_encrypt({'text': 'md5 test', 'algorithm': 'MD5'})
        self.assertEqual(res.status_code, 200)

    def test_base64_encoding_endpoint(self):
        res = self._post_encrypt({'text': 'base64 text', 'algorithm': 'Base64'})
        self.assertEqual(res.status_code, 200)
        encoded = res.json()['encrypted']['encoded']
        decoded = base64.b64decode(encoded).decode('utf-8')
        self.assertEqual(decoded, 'base64 text')

    def test_empty_text_returns_400(self):
        res = self._post_encrypt({'text': '', 'algorithm': 'AES-256-GCM'})
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.json()['success'])

    def test_unsupported_algorithm_returns_400(self):
        res = self._post_encrypt({'text': 'hello', 'algorithm': 'DES'})
        self.assertEqual(res.status_code, 400)

    def test_unauthenticated_returns_401(self):
        client2 = Client()
        res = client2.post('/crypto/encrypt/',
                           data=json.dumps({'text': 'hi', 'algorithm': 'AES-256-GCM'}),
                           content_type='application/json')
        self.assertEqual(res.status_code, 401)

    def test_invalid_json_returns_400(self):
        res = self.client.post('/crypto/encrypt/', data='not-json',
                               content_type='application/json')
        self.assertEqual(res.status_code, 400)


# ---------------------------------------------------------------------------
# 4. Integration: /crypto/decrypt/ endpoint — TC-09
# ---------------------------------------------------------------------------

class TestCryptoDecryptEndpoint(TestCase):

    def setUp(self):
        self.client = Client()
        self.user = make_user(username='crypto_dec', email='dec@test.com')
        set_session(self.client, self.user.username)

    def _encrypt_aes(self, text):
        """Önce encrypt et, key/nonce/ciphertext döndür."""
        res = self.client.post('/crypto/encrypt/',
                               data=json.dumps({'text': text, 'algorithm': 'AES-256-GCM'}),
                               content_type='application/json')
        return res.json()['encrypted']

    def _encrypt_rsa(self, text):
        res = self.client.post('/crypto/encrypt/',
                               data=json.dumps({'text': text, 'algorithm': 'RSA-2048'}),
                               content_type='application/json')
        return res.json()['encrypted']

    def test_aes_decrypt_roundtrip_matches_original(self):
        """TC-09: AES encrypt → decrypt → orijinal plaintext eşleşmeli."""
        original = 'TC-09 AES roundtrip test message'
        enc = self._encrypt_aes(original)

        res = self.client.post('/crypto/decrypt/',
                               data=json.dumps({
                                   'ciphertext': enc['ciphertext'],
                                   'key': enc['key'],
                                   'nonce': enc['nonce'],
                                   'algorithm': 'AES-256-GCM',
                               }),
                               content_type='application/json')
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertEqual(body['decrypted'], original)

    def test_rsa_decrypt_roundtrip_matches_original(self):
        """TC-09: RSA encrypt → decrypt → orijinal plaintext eşleşmeli."""
        original = 'TC-09 RSA roundtrip message'
        enc = self._encrypt_rsa(original)

        res = self.client.post('/crypto/decrypt/',
                               data=json.dumps({
                                   'ciphertext': enc['ciphertext'],
                                   'private_key': enc['private_key'],
                                   'algorithm': 'RSA-2048',
                               }),
                               content_type='application/json')
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['success'])
        self.assertEqual(body['decrypted'], original)

    def test_base64_decode_roundtrip(self):
        original = 'base64 decode test'
        enc_res = self.client.post('/crypto/encrypt/',
                                   data=json.dumps({'text': original, 'algorithm': 'Base64'}),
                                   content_type='application/json')
        encoded = enc_res.json()['encrypted']['encoded']

        res = self.client.post('/crypto/decrypt/',
                               data=json.dumps({'ciphertext': encoded, 'algorithm': 'Base64'}),
                               content_type='application/json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['decrypted'], original)

    def test_hash_algorithms_cannot_be_decrypted(self):
        """Hash fonksiyonları one-way — decrypt denemesi 400 dönmeli."""
        for algo in ['MD5', 'SHA-1', 'SHA-256', 'SHA-512']:
            res = self.client.post('/crypto/decrypt/',
                                   data=json.dumps({'ciphertext': 'abc123', 'algorithm': algo}),
                                   content_type='application/json')
            self.assertEqual(res.status_code, 400,
                             msg=f'{algo} decrypt 400 döndürmeli')

    def test_aes_decrypt_missing_key_returns_400(self):
        enc = self._encrypt_aes('test')
        res = self.client.post('/crypto/decrypt/',
                               data=json.dumps({
                                   'ciphertext': enc['ciphertext'],
                                   'nonce': enc['nonce'],
                                   'algorithm': 'AES-256-GCM',
                                   # key eksik
                               }),
                               content_type='application/json')
        self.assertEqual(res.status_code, 400)

    def test_aes_decrypt_wrong_key_fails(self):
        enc = self._encrypt_aes('test')
        wrong_key = base64.b64encode(b'\xff' * 32).decode()
        res = self.client.post('/crypto/decrypt/',
                               data=json.dumps({
                                   'ciphertext': enc['ciphertext'],
                                   'key': wrong_key,
                                   'nonce': enc['nonce'],
                                   'algorithm': 'AES-256-GCM',
                               }),
                               content_type='application/json')
        self.assertFalse(res.json()['success'])

    def test_empty_ciphertext_returns_400(self):
        res = self.client.post('/crypto/decrypt/',
                               data=json.dumps({'ciphertext': '', 'algorithm': 'AES-256-GCM'}),
                               content_type='application/json')
        self.assertEqual(res.status_code, 400)
