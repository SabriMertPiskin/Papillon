from django.db import models


class BlacklistedIP(models.Model):
    """Engellenen IP adresleri"""
    ip_address = models.CharField(max_length=45, unique=True)  # IPv4, IPv6, CIDR
    reason = models.CharField(max_length=255, default='Manual block')
    blocked_by = models.CharField(max_length=50, default='admin')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Blacklisted IP'
        verbose_name_plural = 'Blacklisted IPs'

    def __str__(self):
        return f"{self.ip_address} — {self.reason}"
