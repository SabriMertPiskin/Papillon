from django.db import models
from django.contrib.auth.hashers import make_password

class CustomUser(models.Model):
    ROLE_CHOICES = [
        ('admin', 'Administrator'),
        ('analyst', 'Security Analyst'),
    ]
    
    username = models.CharField(max_length=150, unique=True, primary_key=True)
    email = models.EmailField(unique=True, null=False)
    password = models.CharField(max_length=255)
    domain = models.CharField(max_length=255, blank=True, null=True)
    vm_lab_path = models.CharField(max_length=500, blank=True, null=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='analyst')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    # MFA (Multi-Factor Authentication)
    mfa_enabled = models.BooleanField(default=False)
    mfa_secret = models.CharField(max_length=64, blank=True, null=True)
    mfa_backup_code = models.CharField(max_length=255, blank=True, null=True)  # hashed
    
    class Meta:
        db_table = 'users'
    
    def set_password(self, raw_password):
        """Hash the password using Django's make_password"""
        self.password = make_password(raw_password)

    def save(self, *args, **kwargs):
        # Admin accounts must not keep a personal domain.
        if self.role == 'admin':
            self.domain = ''
            self.vm_lab_path = ''
        super().save(*args, **kwargs)
    
    def __str__(self):
        return self.username