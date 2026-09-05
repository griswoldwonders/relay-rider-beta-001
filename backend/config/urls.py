from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from relay.views import ChargingHubViewSet, CorridorViewSet, GreenRouteCreditViewSet, ProfileViewSet, ProgramBenefitPolicyViewSet, RedemptionRequestViewSet, RelayZoneViewSet, RouteSignalViewSet, EVParticipantSignalViewSet, InstitutionDashboardView, InstitutionCommuterExportView
from relay.signup_view import SignupView

router = DefaultRouter()
router.register('profiles', ProfileViewSet)
router.register('route-signals', RouteSignalViewSet)
router.register('ev-participant-signals', EVParticipantSignalViewSet)
router.register('relay-zones', RelayZoneViewSet)
router.register('corridors', CorridorViewSet)
router.register('green-route-credits', GreenRouteCreditViewSet)
router.register('charging-hubs', ChargingHubViewSet)
router.register('redemption-requests', RedemptionRequestViewSet)
router.register('program-benefit-policies', ProgramBenefitPolicyViewSet)


def home(request):
    return JsonResponse({
        'service': 'Relay Rider local Django API',
        'status': 'ok',
        'api': request.build_absolute_uri('/api/'),
        'admin': request.build_absolute_uri('/admin/'),
    })


urlpatterns = [
    path('', home),
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/signup/', SignupView.as_view(), name='signup'),
    path('api/institutions/<int:institution_id>/dashboard/', InstitutionDashboardView.as_view(), name='institution-dashboard'),
    path('api/institutions/<int:institution_id>/commuter-records.csv', InstitutionCommuterExportView.as_view(), name='institution-commuter-export'),
]
