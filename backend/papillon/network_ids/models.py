from django.db import models
from django.utils import timezone
from django.conf import settings
from users.models import CustomUser
import base64
import hashlib
from cryptography.fernet import Fernet


class DomainTrafficEvent(models.Model):
    domain = models.CharField(max_length=255, db_index=True)
    client_ip = models.CharField(max_length=64, db_index=True, blank=True, default='')
    method = models.CharField(max_length=12, db_index=True)
    path = models.CharField(max_length=512)
    status_code = models.PositiveSmallIntegerField(null=True, blank=True)
    response_ms = models.FloatField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')
    requested_at = models.DateTimeField(default=timezone.now, db_index=True)
    source = models.CharField(max_length=32, default='middleware', db_index=True)

    class Meta:
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['domain', 'requested_at']),
            models.Index(fields=['domain', 'client_ip', 'requested_at']),
        ]

    def __str__(self):
        return f"{self.domain} {self.method} {self.client_ip} {self.requested_at.isoformat()}"


def _fernet():
    secret = (settings.SECRET_KEY or 'papillon-dev-secret').encode('utf-8')
    key = base64.urlsafe_b64encode(hashlib.sha256(secret).digest())
    return Fernet(key)


class CPanelCredential(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='cpanel_credential')
    host = models.CharField(max_length=255)
    username = models.CharField(max_length=255)
    token_encrypted = models.TextField()
    password_encrypted = models.TextField(blank=True, default='')
    verify_ssl = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def set_token(self, raw_token):
        self.token_encrypted = _fernet().encrypt((raw_token or '').encode('utf-8')).decode('utf-8')

    def get_token(self):
        if not self.token_encrypted:
            return ''
        try:
            return _fernet().decrypt(self.token_encrypted.encode('utf-8')).decode('utf-8')
        except Exception:
            return ''

    def masked_token(self):
        token = self.get_token()
        if len(token) <= 8:
            return '*' * len(token)
        return f"{token[:4]}{'*' * (len(token) - 8)}{token[-4:]}"

    def set_password(self, raw_password):
        self.password_encrypted = _fernet().encrypt((raw_password or '').encode('utf-8')).decode('utf-8')

    def get_password(self):
        if not self.password_encrypted:
            return ''
        try:
            return _fernet().decrypt(self.password_encrypted.encode('utf-8')).decode('utf-8')
        except Exception:
            return ''

    def __str__(self):
        return f"{self.user_id} @ {self.host}"
