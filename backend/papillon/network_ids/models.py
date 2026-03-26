from django.db import models
from django.utils import timezone


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
