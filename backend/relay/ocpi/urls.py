from django.urls import path

from .views import OcpiCdrIngestView, OcpiSessionIngestView

urlpatterns = [
    path('sessions/', OcpiSessionIngestView.as_view(), name='ocpi-session-ingest'),
    path('cdrs/', OcpiCdrIngestView.as_view(), name='ocpi-cdr-ingest'),
]
