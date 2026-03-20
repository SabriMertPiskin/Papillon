from django.urls import path
from . import views

urlpatterns = [
    path('', views.blacklist_list_create, name='blacklist_list_create'),
    path('<int:pk>/', views.blacklist_delete, name='blacklist_delete'),
]
