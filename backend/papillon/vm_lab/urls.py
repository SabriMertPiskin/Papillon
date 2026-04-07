from django.urls import path
from . import views

urlpatterns = [
    path('status', views.machine_status, name='vm_lab_status'),
    path('start', views.start_machine, name='vm_lab_start'),
    path('terminate', views.terminate_machine, name='vm_lab_terminate'),
    path("start-instance/", views.start_instance_view),
]
