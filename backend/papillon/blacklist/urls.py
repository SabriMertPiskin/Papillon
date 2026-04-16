from django.urls import path
from . import views

urlpatterns = [
    path('', views.blacklist_list_create, name='blacklist_list_create'),
    path('abuseipdb/', views.blacklist_abuseipdb_lookup, name='blacklist_abuseipdb_lookup'),
    path('<int:pk>/', views.blacklist_delete, name='blacklist_delete'),
]
