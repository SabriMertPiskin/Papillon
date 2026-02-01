from django.urls import path
from . import views

urlpatterns = [
    path('latest/', views.latest_cves, name='latest_cves'),
]