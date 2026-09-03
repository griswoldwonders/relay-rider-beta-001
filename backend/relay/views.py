from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    ChargingHub,
    Corridor,
    EVParticipantSignal,
    GreenRouteCredit,
    Institution,
    Membership,
    Profile,
    RedemptionRequest,
    RelayZone,
    RouteSignal,
)
from .permissions import CanReviewRedemptionRequest, IsTenantMember, user_institution_ids, user_is_platform_admin
from .serializers import (
    ChargingHubSerializer,
    CorridorSerializer,
    EVParticipantSignalSerializer,
    GreenRouteCreditSerializer,
    ProfileSerializer,
    RedemptionRequestSerializer,
    RelayZoneSerializer,
    RouteSignalSerializer,
)
from .services.exports import commuter_records_csv, dashboard_payload


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
    queryset = RelayZone.objects.all().order_by('name')
    serializer_class = RelayZoneSerializer
    permission_classes = [AllowAny]


class CorridorViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Corridor.objects.all().order_by('name')
    serializer_class = CorridorSerializer
    permission_classes = [AllowAny]


class ChargingHubViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Public research-beta reference data; not a private charger inventory."""
    queryset = ChargingHub.objects.all().order_by('name')
    serializer_class = ChargingHubSerializer
    permission_classes = [AllowAny]


class TenantScopedQuerySetMixin:
    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user_is_platform_admin(user):
            return queryset
        return queryset.filter(institution_id__in=user_institution_ids(user))


class GreenRouteCreditViewSet(TenantScopedQuerySetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsTenantMember]
    queryset = GreenRouteCredit.objects.all().order_by('-created_at')
    serializer_class = GreenRouteCreditSerializer


class RedemptionRequestViewSet(
    TenantScopedQuerySetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = RedemptionRequest.objects.select_related('credit', 'charging_hub', 'profile').all().order_by('-requested_at')
    serializer_class = RedemptionRequestSerializer

    def get_permissions(self):
        if self.action in ('update', 'partial_update'):
            return [CanReviewRedemptionRequest()]
        return [IsTenantMember()]

    def perform_create(self, serializer):
        with transaction.atomic():
            credit = GreenRouteCredit.objects.select_for_update().get(
                pk=serializer.validated_data['credit'].pk
            )
            requested_units = serializer.validated_data['requested_units']
            committed_units = RedemptionRequest.objects.filter(
                credit=credit,
                status__in={'requested', 'under-review', 'fulfilled'},
            ).aggregate(total=Sum('requested_units'))['total'] or Decimal('0')

            if credit.status != 'issued':
                raise ValidationError({
                    'credit': 'Only issued Green Route Credits can be submitted for redemption review.'
                })
            if committed_units + requested_units > credit.amount_units:
                raise ValidationError({
                    'requested_units': 'Requested units exceed the uncommitted Green Route Credit balance.'
                })

            serializer.save(
                institution=credit.institution,
                unit_label=credit.unit_label,
                status='requested',
            )

    def perform_update(self, serializer):
        next_status = serializer.validated_data.get('status', serializer.instance.status)
        review_started = next_status in {'under-review', 'fulfilled', 'denied'}
        if review_started:
            serializer.save(
                reviewed_at=timezone.now(),
                reviewed_by=self.request.user.get_username(),
            )
        else:
            serializer.save()


def _institution_for_user(user, institution_id):
    try:
        institution = Institution.objects.get(pk=institution_id)
    except Institution.DoesNotExist as exc:
        raise NotFound('Institution not found') from exc

    if user_is_platform_admin(user):
        return institution
    if not Membership.objects.filter(user=user, institution=institution).exists():
        raise PermissionDenied('You do not have access to this institution')
    return institution


class InstitutionDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, institution_id):
        institution = _institution_for_user(request.user, institution_id)
        return Response(dashboard_payload(institution))


class InstitutionCommuterExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, institution_id):
        institution = _institution_for_user(request.user, institution_id)
        response = HttpResponse(commuter_records_csv(institution), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{institution.slug}-commuter-records.csv"'
        return response
