"""
Test settings — MySQL yerine in-memory SQLite kullanır.
Çalıştırma: python manage.py test --settings=papillon.settings_test
"""
import os
os.environ.setdefault('VAULT_ADDR', '')      # Vault'u test ortamında devre dışı bırak
os.environ.setdefault('VAULT_TOKEN', '')

from papillon.settings import *              # noqa: F401, F403

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Testlerde şifreleme için sabit anahtar (production'da Vault'tan gelir)
SECRET_KEY = 'django-insecure-test-secret-key-papillon-2025'

# Session engine — DB tabanlı (test DB ile çalışır)
SESSION_ENGINE = 'django.contrib.sessions.backends.db'

# Şifre hashleme — testlerde hızlı çalışsın
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# Logging'i kapat — test çıktısını temiz tut
LOGGING = {}
