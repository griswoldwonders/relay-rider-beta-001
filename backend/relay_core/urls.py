from rest_framework.routers import DefaultRouter

from .views import (
    CorridorDataViewSet,
    EVParticipantSignalViewSet,
    GreenRouteCreditViewSet,
    RelayZoneViewSet,
    RouteSignalViewSet,
    UserProfileViewSet,
)

router = DefaultRouter()
router.register("profiles", UserProfileViewSet)
router.register("route-signals", RouteSignalViewSet)
router.register("ev-participant-signals", EVParticipantSignalViewSet)
router.register("relay-zones", RelayZoneViewSet)
router.register("corridors", CorridorDataViewSet)
router.register("green-route-credits", GreenRouteCreditViewSet)

urlpatterns = router.urls
