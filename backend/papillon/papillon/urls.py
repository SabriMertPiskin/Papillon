"""
URL configuration for papillon project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path
from django.http import JsonResponse
from papillon.vault_service import health_check


def vault_health(request):
    """Vault bağlantı durumunu kontrol et"""
    result = health_check()
    status = 200 if result['vault_available'] and result['authenticated'] else 503
    return JsonResponse(result, status=status)


urlpatterns = [
    path('admin/', admin.site.urls),
    path('auth/', include('users.urls')),
    path('cve/', include('cve.urls')),
    path('crypto/', include('crypto.urls')),
    path('outlook/', include('outlook.urls')),
    path('attack-surface/', include('attack_surface.urls')),
    path('ai/phishing/', include('phishing.urls')),
    path('ai/password-strength/', include('password_ai.urls')),
    path('ai/malware/', include('malware_analysis.urls')),
    path('ai/network-ids/', include('network_ids.urls')),
    path('blacklist/', include('blacklist.urls')),
    path('vault/health', vault_health, name='vault_health'),
]
