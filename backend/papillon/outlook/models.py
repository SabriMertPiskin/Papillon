from django.db import models
from users.models import CustomUser
from cryptography.fernet import Fernet
import os
import base64

# Encryption key from settings
def get_cipher():
    """Get Fernet cipher for token encryption"""
    key = os.environ.get('ENCRYPTION_KEY')
    if not key:
        # For development, use a default key (should be in .env in production)
        key = base64.urlsafe_b64encode(b'papillon-encryption-key-32chars!')[:32]
        key = base64.urlsafe_b64encode(key)
    return Fernet(key)

class OutlookAccount(models.Model):
    """Store encrypted Outlook OAuth tokens for each user"""
    
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='outlook_account')
    
    # Encrypted tokens
    _access_token = models.TextField(blank=True, null=True)  # encrypted
    _refresh_token = models.TextField(blank=True, null=True)  # encrypted

    # Per-user OAuth app config (encrypted at rest)
    _client_id = models.TextField(blank=True, null=True)
    _client_secret = models.TextField(blank=True, null=True)
    auth_tenant = models.CharField(max_length=255, blank=True, null=True)
    
    expires_at = models.DateTimeField(null=True, blank=True)
    is_connected = models.BooleanField(default=False)
    
    outlook_email = models.EmailField(blank=True, null=True)  # Outlook email sahibinin
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"{self.user.username} - Outlook ({self.outlook_email})"

    def _decrypt_value(self, value):
        if not value:
            return None
        try:
            cipher = get_cipher()
            decrypted = cipher.decrypt(value.encode())
            return decrypted.decode('utf-8')
        except Exception as e:
            print(f"Error decrypting value: {e}")
            return None

    def _encrypt_value(self, value):
        if value:
            try:
                cipher = get_cipher()
                encrypted = cipher.encrypt(value.encode())
                return encrypted.decode('utf-8')
            except Exception as e:
                print(f"Error encrypting value: {e}")
        return None
    
    # Encrypted field properties
    @property
    def access_token(self):
        """Decrypt access token"""
        return self._decrypt_value(self._access_token)
    
    @access_token.setter
    def access_token(self, value):
        """Encrypt and store access token"""
        encrypted = self._encrypt_value(value)
        if encrypted is not None:
            self._access_token = encrypted
    
    @property
    def refresh_token(self):
        """Decrypt refresh token"""
        return self._decrypt_value(self._refresh_token)
    
    @refresh_token.setter
    def refresh_token(self, value):
        """Encrypt and store refresh token"""
        encrypted = self._encrypt_value(value)
        if encrypted is not None:
            self._refresh_token = encrypted

    @property
    def client_id(self):
        return self._decrypt_value(self._client_id)

    @client_id.setter
    def client_id(self, value):
        encrypted = self._encrypt_value(value)
        if encrypted is not None:
            self._client_id = encrypted

    @property
    def client_secret(self):
        return self._decrypt_value(self._client_secret)

    @client_secret.setter
    def client_secret(self, value):
        encrypted = self._encrypt_value(value)
        if encrypted is not None:
            self._client_secret = encrypted
