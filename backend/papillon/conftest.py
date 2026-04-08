"""
conftest.py — pytest-django konfigürasyonu
Çalıştırma:
    cd backend/papillon
    pytest
"""
import os
import sys
import django
from pathlib import Path

# Django ayarlarını ortam değişkenine ekle
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'papillon.settings_test')

# Django setup
django.setup()

from django.conf import settings
from django.core.management import call_command


def pytest_configure(config):
    """pytest başlamadan önce Django ayarlarını override et."""
    # DATABASES'i SQLite ile override et (in-memory)
    settings.DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': ':memory:',
        }
    }
    settings.PASSWORD_HASHERS = [
        'django.contrib.auth.hashers.MD5PasswordHasher',
    ]
    
    # Test için ALLOWED_HOSTS ekle
    settings.ALLOWED_HOSTS = ['testserver', 'localhost', '127.0.0.1', '*']
    
    # Migrasyonları çalıştır
    call_command('migrate', verbosity=0, interactive=False)
