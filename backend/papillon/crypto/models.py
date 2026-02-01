from django.db import models
from users.models import CustomUser

class EncryptedData(models.Model):
    ALGORITHM_CHOICES = [
        ('AES-256-GCM', 'AES-256-GCM'),
        ('RSA-2048', 'RSA-2048'),
        ('MD5', 'MD5'),
        ('SHA-1', 'SHA-1'),
        ('SHA-256', 'SHA-256'),
        ('SHA-512', 'SHA-512'),
        ('Base64', 'Base64'),
    ]
    
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    algorithm = models.CharField(max_length=20, choices=ALGORITHM_CHOICES)
    plaintext = models.TextField(blank=True, null=True)
    plaintext_preview = models.CharField(max_length=100, blank=True)  # ilk 100 char
    
    # Şifreleme sonuçları
    ciphertext = models.TextField(blank=True, null=True)
    key = models.TextField(blank=True, null=True)  # AES için
    nonce = models.TextField(blank=True, null=True)  # AES için
    private_key = models.TextField(blank=True, null=True)  # RSA için
    public_key = models.TextField(blank=True, null=True)  # RSA için
    hash_result = models.TextField(blank=True, null=True)  # SHA/MD5 için
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.algorithm} - {self.created_at}"