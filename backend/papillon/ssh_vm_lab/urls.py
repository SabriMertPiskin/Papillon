from django.urls import path
from . import views

urlpatterns = [
    path('start-instance/', views.start_instance_view, name='ssh_vm_lab_start_instance'),
    path('download-key/', views.download_aws_key, name='ssh_vm_lab_download_key'),
]
