from django.db import models
from django.contrib.auth.hashers import make_password

class CustomUser(models.Model):
    username = models.CharField(max_length=150, unique=True, primary_key=True)
    email = models.EmailField(unique=True, null=False)
    password = models.CharField(max_length=255)
    domain = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'users'
    
    def set_password(self, raw_password):
        """Hash the password using Django's make_password"""
        self.password = make_password(raw_password)
    
    def __str__(self):
        return self.username