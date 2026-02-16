from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('dashboard/', views.dashboard, name='dashboard'),
    
    # MFA endpoints
    path('mfa/setup/', views.mfa_setup, name='mfa_setup'),
    path('mfa/verify-setup/', views.mfa_verify_setup, name='mfa_verify_setup'),
    path('mfa/verify/', views.verify_mfa, name='verify_mfa'),
    path('mfa/disable/', views.mfa_disable, name='mfa_disable'),
    path('mfa/status/', views.mfa_status, name='mfa_status'),
]