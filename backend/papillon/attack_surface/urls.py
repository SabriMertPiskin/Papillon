from django.urls import path
from . import views

urlpatterns = [
    path('scan/', views.attack_surface_scan, name='attack_surface_scan'),
]