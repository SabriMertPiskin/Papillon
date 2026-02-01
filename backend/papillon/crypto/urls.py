from django.urls import path
from . import views

urlpatterns = [
    path('encrypt/', views.encrypt_text, name='encrypt_text'),
]