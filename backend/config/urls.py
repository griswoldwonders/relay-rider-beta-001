from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from relay.views import CorridorViewSet, GreenRouteCreditViewSet, ProfileViewSet, RelayZoneViewSet, RouteSignalViewSet, EVParticipantSignalViewSet
from relay.signup_view import SignupView

router = DefaultRouter()
router.register('profiles', ProfileViewSet)
router.register('route-signals', RouteSignalViewSet)
router.register('ev-participant-signals', EVParticipantSignalViewSet)
router.register('relay-zones', RelayZoneViewSet)
router.register('corridors', CorridorViewSet)
router.register('green-route-credits', GreenRouteCreditViewSet)

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
]
