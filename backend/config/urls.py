from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from relay.views import (
    ChargingHubViewSet,
    CorridorViewSet,
    DecisionCardReviewView,
    EVParticipantSignalViewSet,
    GreenRouteCreditViewSet,
    InstitutionCommuterExportView,
    InstitutionDashboardView,
    ProfileBindUserView,
    ProfileViewSet,
    ProgramBenefitPolicyViewSet,
    RedemptionRequestViewSet,
    RelayZoneViewSet,
    RouteSignalViewSet,
)
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


def healthz(_request):
    return JsonResponse({'service': 'relay-rider-api', 'status': 'ok'})


def home(request):
    payload = {
        'service': 'relay-rider-api',
        'status': 'ok',
    }
    if settings.DEBUG:
        payload['api'] = request.build_absolute_uri('/api/')
        payload['admin'] = request.build_absolute_uri('/admin/')
    return JsonResponse(payload)


urlpatterns = [
    path('', home),
    path('healthz', healthz),
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/signup/', SignupView.as_view(), name='signup'),
    path('api/profiles/<int:profile_id>/bind-user/', ProfileBindUserView.as_view(), name='profile-bind-user'),
    path('api/decision-cards/<int:card_id>/review/', DecisionCardReviewView.as_view(), name='decision-card-review'),
    path('api/institutions/<int:institution_id>/dashboard/', InstitutionDashboardView.as_view(), name='institution-dashboard'),
    path('api/institutions/<int:institution_id>/commuter-records.csv', InstitutionCommuterExportView.as_view(), name='institution-commuter-export'),
]
