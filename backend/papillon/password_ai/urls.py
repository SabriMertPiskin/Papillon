from django.urls import path
from . import views

urlpatterns = [
    path('predict/', views.predict_strength, name='password_strength_predict'),
]
