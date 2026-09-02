from rest_framework import mixins, viewsets
from rest_framework.permissions import AllowAny
from .models import ChargingHub, Corridor, EVParticipantSignal, GreenRouteCredit, Membership, Profile, RedemptionRequest, RelayZone, RouteSignal
from .permissions import CanReviewRedemptionRequest, IsTenantMember, user_institution_ids, user_is_platform_admin
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
#   - GreenRouteCredit / RedemptionRequest now carry real Institution
#     tenant scoping (see relay/permissions.py and Institution/Membership in
#     models.py) instead of the old ?profile=<id> query-param heuristic.
#     The query-param approach was defense-in-depth for a world with no
#     concept of "the current user" -- now that requests are authenticated
#     and each user's institution memberships are known server-side, real
#     scoping to those memberships is strictly stronger and replaces it
#     entirely (see TenantScopedQuerySetMixin below). platform_admin
#     membership bypasses tenant scoping and sees every institution's rows.
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


class TenantScopedQuerySetMixin:
    """Filters list/retrieve querysets to the caller's institution membership(s).

    platform_admin bypasses scoping and sees every row. Everyone else only
    sees rows whose `institution` matches one of their memberships; rows
    with no institution assigned yet (pre-backfill) are invisible to
    non-platform-admins. Object-level enforcement for retrieve/update still
    happens via IsTenantMember / CanReviewRedemptionRequest so a scoping bug
    here would 403/404 rather than leak data.
    """

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user_is_platform_admin(user):
            return queryset
        return queryset.filter(institution_id__in=user_institution_ids(user))


class GreenRouteCreditViewSet(TenantScopedQuerySetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    # IsTenantMember alone (not [IsAuthenticated, IsTenantMember]) is
    # sufficient and intentional: setting permission_classes here replaces
    # the global IsAuthenticated default rather than adding to it, and
    # IsTenantMember.has_permission already requires request.user.is_authenticated
    # before any tenant scoping is applied, so the authentication check is
    # not lost -- it is just performed by the more specific class.
    permission_classes = [IsTenantMember]
    queryset = GreenRouteCredit.objects.all().order_by('-created_at')
    serializer_class = GreenRouteCreditSerializer

class RedemptionRequestViewSet(TenantScopedQuerySetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    queryset = RedemptionRequest.objects.select_related('credit', 'charging_hub', 'profile').all().order_by('-requested_at')
    serializer_class = RedemptionRequestSerializer

    def get_permissions(self):
        # Administrative review (approve/deny) requires a staff-level role
        # within the request's own institution, not just tenant membership
        # -- see CanReviewRedemptionRequest. Every other action (list,
        # retrieve, create) only requires tenant membership.
        if self.action in ('update', 'partial_update'):
            return [CanReviewRedemptionRequest()]
        return [IsTenantMember()]

    def perform_create(self, serializer):
        # institution is read-only on the serializer -- assign it from the
        # caller's own (non-platform-admin) membership rather than trusting
        # client input. platform_admin callers have no single home
        # institution, so their creates are left unassigned for staff to
        # triage, same as the public signup flow.
        membership = Membership.objects.filter(user=self.request.user).exclude(role='platform_admin').first()
        serializer.save(institution=membership.institution if membership else None)
