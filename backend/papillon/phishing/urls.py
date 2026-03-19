from django.urls import path
from . import views

urlpatterns = [
    path('predict/', views.predict_phishing, name='phishing_predict'),
    path('history/', views.get_phishing_history, name='phishing_history'),
]
