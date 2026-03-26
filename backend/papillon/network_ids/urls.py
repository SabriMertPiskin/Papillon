from django.urls import path
from . import views

urlpatterns = [
    path('predict/', views.predict_intrusion, name='network_ids_predict'),
    path('analyze-batch/', views.analyze_batch, name='network_ids_batch'),
    path('monitor-snapshot/', views.monitor_snapshot, name='network_ids_monitor_snapshot'),
    path('resolve-analyst-domain/', views.resolve_analyst_domain, name='network_ids_resolve_analyst_domain'),
    path('ingest-event/', views.ingest_event, name='network_ids_ingest_event'),
]
