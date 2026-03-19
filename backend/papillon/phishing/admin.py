from django.contrib import admin
from .models import PhishingLog


@admin.register(PhishingLog)
class PhishingLogAdmin(admin.ModelAdmin):
    list_display = ('sender', 'subject', 'status', 'score', 'scanned_at')
    list_filter = ('status',)
    search_fields = ('sender', 'subject')
