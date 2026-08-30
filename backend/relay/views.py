from rest_framework import mixins, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from .models import ChargingHub, Corridor, EVParticipantSignal, GreenRouteCredit, Profile, RedemptionRequest, RelayZone, RouteSignal
from .serializers import ChargingHubSerializer, CorridorSerializer, EVParticipantSignalSerializer, GreenRouteCreditSerializer, ProfileSerializer, RedemptionRequestSerializer, RelayZoneSerializer, RouteSignalSerializer

# ---------------------------------------------------------------------------
# Least-privilege note (see SECURITY.md / DEPLOYMENT.md pre-pilot checklist):
#
# settings.py now defaults DEFAULT_PERMISSION_CLASSES to IsAuthenticated
# (with SessionAuthentication + TokenAuthentication) for every DRF endpoint.
# This API still has no real participant login/session system, so
# "authenticated" effectively means "no unauthenticated caller can reach
# this endpoint" -- there is no way yet to identify "the current user"
# server-side or scope a request to their own records. Until real
# authentication exists, these viewsets are scoped as narrowly as they can
# be:
#
#   - PII-bearing / submission endpoints (Profile, RouteSignal,
#     EVParticipantSignal) stay CREATE-ONLY over the API (no public
#     list/retrieve/update/delete) AND now require authentication like
#     everything else -- nothing in src/ calls these viewsets directly today
#     (the frontend's only public submission path is /api/signup/, a
#     separate APIView that is explicitly allowlisted below), so there is no
#     reason for them to accept unauthenticated writes of participant PII.
#   - GreenRouteCredit / RedemptionRequest reads REQUIRE an explicit
#     ?profile=<id> query param; without one they return an empty queryset
#     instead of every participant's records. This is defense-in-depth on
#     top of now also requiring authentication -- both are needed until real
#     per-user authorization exists. (The frontend's greenWalletApi.ts
#     client currently has no call sites in src/ -- WalletAdminScreen.tsx
#     uses local session-memory state instead -- but the Django endpoints
#     are reachable directly regardless of what the UI does.)
#   - Public reference data (ChargingHub, Corridor, RelayZone) is not
#     participant data and is explicitly allowlisted with AllowAny below so
#     it stays read-only and world-listable, matching its existing
#     documented intent.
#
# This is a real, scoped hardening pass -- it is NOT a substitute for actual
# participant authentication and per-user authorization, which SECURITY.md
# and DEPLOYMENT.md already require before any real-data pilot.
# ---------------------------------------------------------------------------

class CreateOnlyViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Accepts submissions but exposes no list/retrieve/update/delete."""


class ProfileViewSet(CreateOnlyViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer

class RouteSignalViewSet(CreateOnlyViewSet):
    queryset = RouteSignal.objects.all()
    serializer_class = RouteSignalSerializer

class EVParticipantSignalViewSet(CreateOnlyViewSet):
    queryset = EVParticipantSignal.objects.all()
    serializer_class = EVParticipantSignalSerializer

class RelayZoneViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Public reference data -- not participant data. See module note above."""
    queryset = RelayZone.objects.all().order_by('name')
    serializer_class = RelayZoneSerializer
    permission_classes = [AllowAny]

class CorridorViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Public reference data -- not participant data. See module note above."""
    queryset = Corridor.objects.all().order_by('name')
    serializer_class = CorridorSerializer
    permission_classes = [AllowAny]

class ChargingHubViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Public reference data -- not participant data. See module note above."""
    queryset = ChargingHub.objects.all().order_by('name')
    serializer_class = ChargingHubSerializer
    permission_classes = [AllowAny]


class ProfileScopedReadMixin:
    """Requires a ?profile=<id> query param on LIST; returns nothing without one.

    Only scopes the list endpoint. Retrieve/update by primary key (e.g. the
    admin-review PATCH below) still resolves against the full queryset --
    scoping those too would make every lookup 404 instead of surfacing the
    real authorization error, which is enforced separately in
    RedemptionRequestViewSet.perform_update.

    This is defense-in-depth, not real authorization -- any caller can still
    pass any profile id, since there is no session tying a request to a
    specific participant. It only prevents the "list every participant's
    records with no filter at all" case.
    """

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != 'list':
            return queryset
        profile_id = self.request.query_params.get('profile')
        if not profile_id:
            return queryset.none()
        return queryset.filter(profile_id=profile_id)


class GreenRouteCreditViewSet(ProfileScopedReadMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = GreenRouteCredit.objects.all().order_by('-created_at')
    serializer_class = GreenRouteCreditSerializer

class RedemptionRequestViewSet(ProfileScopedReadMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    queryset = RedemptionRequest.objects.select_related('credit', 'charging_hub', 'profile').all().order_by('-requested_at')
    serializer_class = RedemptionRequestSerializer

    def perform_update(self, serializer):
        # Administrative review (approve/deny) has no real admin
        # authentication behind it yet -- see the module docstring above.
        # Reject destructive status flips from this open endpoint until a
        # real admin auth check exists rather than silently trusting the
        # caller-supplied review fields.
        raise PermissionDenied(
            'Administrative review requires authenticated admin access, '
            'which is not yet implemented on this API. See SECURITY.md.'
        )
