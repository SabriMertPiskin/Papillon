from django.urls import path
from . import views

urlpatterns = [
    path('authorize', views.authorize, name='outlook_authorize'),
    path('callback', views.callback, name='outlook_callback'),
    path('disconnect', views.disconnect, name='outlook_disconnect'),
    path('status', views.get_outlook_status, name='outlook_status'),
    path('latest-mail', views.get_latest_mail, name='outlook_latest_mail'),
]