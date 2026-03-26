from django.contrib import admin
from .models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'domain', 'role', 'is_active', 'mfa_enabled', 'created_at']
    list_filter = ['role', 'is_active', 'mfa_enabled', 'created_at']
    search_fields = ['username', 'email', 'domain']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Account Information', {
            'fields': ('username', 'email', 'password', 'domain')
        }),
        ('Access Control', {
            'fields': ('role', 'is_active')
        }),
        ('Multi-Factor Authentication', {
            'fields': ('mfa_enabled', 'mfa_secret', 'mfa_backup_code'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def has_add_permission(self, request):
        """Only admins can add users via admin panel"""
        return request.user.is_staff
    
    def has_delete_permission(self, request, obj=None):
        """Only superusers can delete users"""
        return request.user.is_superuser
