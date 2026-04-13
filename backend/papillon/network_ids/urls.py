from django.urls import path
from . import views

urlpatterns = [
    path('predict/', views.predict_intrusion, name='network_ids_predict'),
    path('analyze-batch/', views.analyze_batch, name='network_ids_batch'),
    path('monitor-snapshot/', views.monitor_snapshot, name='network_ids_monitor_snapshot'),
    path('cpanel-config/', views.get_cpanel_config, name='network_ids_get_cpanel_config'),
    path('cpanel-config/update/', views.update_cpanel_config, name='network_ids_update_cpanel_config'),
    path('cpanel-test/', views.test_cpanel_connection, name='network_ids_test_cpanel_connection'),
    path('cpanel-live-snapshot/', views.cpanel_live_snapshot, name='network_ids_cpanel_live_snapshot'),
    path('hosting-overview/', views.hosting_overview, name='network_ids_hosting_overview'),
    path('resolve-analyst-domain/', views.resolve_analyst_domain, name='network_ids_resolve_analyst_domain'),
    path('ingest-event/', views.ingest_event, name='network_ids_ingest_event'),
]
