from django.db import models
from users.models import CustomUser


class PhishingLog(models.Model):
    """AI tarafından analiz edilen e-posta kayıtları"""

    STATUS_CHOICES = [
        ('phishing', 'Phishing'),
        ('suspicious', 'Suspicious'),
        ('clean', 'Clean'),
    ]

    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='phishing_logs'
    )
    sender = models.CharField(max_length=255, blank=True, default='')
    subject = models.CharField(max_length=500, blank=True, default='')
    preview = models.TextField(blank=True, default='')
    full_body = models.TextField(blank=True, default='')
    score = models.IntegerField(default=0, help_text='AI risk score 0-100')
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='clean'
    )
    ai_label = models.CharField(max_length=50, blank=True, default='')
    ai_reasons = models.JSONField(default=list, blank=True)
    scanned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'phishing_logs'
        ordering = ['-scanned_at']

    def __str__(self):
        return f"[{self.status.upper()}] {self.subject[:50]} - {self.sender}"
