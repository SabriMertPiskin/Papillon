from django.urls import path
from . import views

urlpatterns = [
    path('predict/', views.predict_intrusion, name='network_ids_predict'),
    path('analyze-batch/', views.analyze_batch, name='network_ids_batch'),
]
