from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    AssessmentAuditEvent,
    ChargingHub,
    Corridor,
    DecisionCard,
    EVParticipantSignal,
    GreenRouteCredit,
    Institution,
    Membership,
    Profile,
    ProgramBenefitPolicy,
    RedemptionRequest,
    RelayZone,
    RouteSignal,
    WalletLedgerEntry,
)
from .permissions import (
    CanReviewRedemptionRequest,
    CanSubmitRedemptionRequest,
    IsTenantMember,
    user_institution_ids,
    user_is_platform_admin,
    user_participant_institution_ids,
    user_staff_institution_ids,
)
from .serializers import (
    ChargingHubSerializer,
    CorridorSerializer,
    EVParticipantSignalSerializer,
    GreenRouteCreditSerializer,
    ProfileSerializer,
    ProgramBenefitPolicySerializer,
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


class ParticipantOwnedWalletQuerySetMixin:
    """Staff see their tenant; participants only see rows owned by their Profile."""

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user_is_platform_admin(user):
            return queryset

        staff_institutions = user_staff_institution_ids(user)
        participant_institutions = user_participant_institution_ids(user)
        return queryset.filter(
            Q(institution_id__in=staff_institutions)
            | Q(institution_id__in=participant_institutions, profile__user=user)
        ).distinct()


class GreenRouteCreditViewSet(ParticipantOwnedWalletQuerySetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsTenantMember]
    queryset = GreenRouteCredit.objects.select_related('profile').all().order_by('-created_at')
    serializer_class = GreenRouteCreditSerializer


class ProgramBenefitPolicyViewSet(TenantScopedQuerySetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsTenantMember]
    queryset = ProgramBenefitPolicy.objects.all().order_by('-created_at')
    serializer_class = ProgramBenefitPolicySerializer


class RedemptionRequestViewSet(
    ParticipantOwnedWalletQuerySetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = RedemptionRequest.objects.select_related('credit', 'charging_hub', 'profile', 'profile__user').all().order_by('-requested_at')
    serializer_class = RedemptionRequestSerializer

    def get_permissions(self):
        if self.action in ('update', 'partial_update'):
            return [CanReviewRedemptionRequest()]
        if self.action == 'create':
            return [CanSubmitRedemptionRequest()]
        return [IsTenantMember()]

    def _find_existing_redemption_request(self, credit_id, idempotency_key):
        if not (idempotency_key and credit_id):
            return None
        return self.get_queryset().filter(
            credit_id=credit_id,
            idempotency_key=idempotency_key,
        ).first()

    def create(self, request, *args, **kwargs):
        idempotency_key = request.data.get('idempotency_key')
        credit_id = request.data.get('credit')
        existing = self._find_existing_redemption_request(credit_id, idempotency_key)
        if existing is not None:
            return Response(self.get_serializer(existing).data, status=status.HTTP_201_CREATED)

        try:
            return super().create(request, *args, **kwargs)
        except IntegrityError:
            existing = self._find_existing_redemption_request(credit_id, idempotency_key)
            if existing is not None:
                return Response(self.get_serializer(existing).data, status=status.HTTP_201_CREATED)
            raise

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

            redemption_request = serializer.save(
                institution=credit.institution,
                unit_label=credit.unit_label,
                status='requested',
            )
            WalletLedgerEntry.objects.create(
                credit=credit,
                institution=credit.institution,
                redemption_request=redemption_request,
                entry_type='HOLD',
                quantity_delta=requested_units,
                reason='Redemption request submitted for administrative review.',
                correlation_id=redemption_request.idempotency_key or f'redemption:{redemption_request.pk}',
                actor_reference=self.request.user.get_username(),
            )

    def perform_update(self, serializer):
        previous_status = serializer.instance.status
        next_status = serializer.validated_data.get('status', previous_status)
        review_started = next_status in {'under-review', 'fulfilled', 'denied'}
        if review_started:
            redemption_request = serializer.save(
                reviewed_at=timezone.now(),
                reviewed_by=self.request.user.get_username(),
            )
        else:
            redemption_request = serializer.save()

        if previous_status != next_status and next_status in {'fulfilled', 'denied'}:
            WalletLedgerEntry.objects.create(
                credit=redemption_request.credit,
                institution=redemption_request.institution,
                redemption_request=redemption_request,
                entry_type='DEBIT' if next_status == 'fulfilled' else 'RELEASE',
                quantity_delta=redemption_request.requested_units,
                reason=(
                    'Redemption request fulfilled by manual research-beta program action.'
                    if next_status == 'fulfilled'
                    else 'Redemption request denied; held units released.'
                ),
                correlation_id=f'redemption:{redemption_request.pk}',
                actor_reference=self.request.user.get_username(),
            )


class ProfileBindUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, profile_id):
        User = get_user_model()
        target_user_id = request.data.get('user')
        if not target_user_id:
            return Response({'user': 'A target user is required.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            profile_queryset = Profile.objects.select_for_update().select_related('institution', 'user')
            if not user_is_platform_admin(request.user):
                admin_institution_ids = Membership.objects.filter(
                    user=request.user,
                    role='institution_admin',
                ).values_list('institution_id', flat=True)
                profile_queryset = profile_queryset.filter(institution_id__in=admin_institution_ids)
            try:
                profile = profile_queryset.get(pk=profile_id)
            except Profile.DoesNotExist as exc:
                raise NotFound('Profile not found') from exc

            if profile.institution_id is None:
                return Response(
                    {'profile': 'Unscoped research-beta profiles cannot be bound until an institution is assigned.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                target_user = User.objects.get(pk=target_user_id)
            except User.DoesNotExist:
                return Response({'user': 'Target user is not eligible for this profile.'}, status=status.HTTP_400_BAD_REQUEST)

            eligible_membership = Membership.objects.filter(
                user=target_user,
                institution_id=profile.institution_id,
                role='participant',
            ).exists()
            if not eligible_membership:
                return Response({'user': 'Target user is not an eligible participant in this institution.'}, status=status.HTTP_400_BAD_REQUEST)

            if profile.user_id is not None:
                if profile.user_id == target_user.id:
                    return Response({'profile': profile.id, 'user': target_user.id}, status=status.HTTP_200_OK)
                return Response({'profile': 'Profile ownership is already bound and cannot be reassigned.'}, status=status.HTTP_400_BAD_REQUEST)

            if Profile.objects.filter(user=target_user).exclude(pk=profile.pk).exists():
                return Response({'user': 'Target user already owns another Relay Rider profile.'}, status=status.HTTP_400_BAD_REQUEST)

            profile.user = target_user
            profile.save(update_fields=['user', 'updated_at'])
            AssessmentAuditEvent.objects.create(
                institution=profile.institution,
                actor=request.user,
                action='profile_owner_bound',
                entity_type='Profile',
                entity_id=str(profile.id),
                metadata={'target_user_id': target_user.id},
            )

        return Response({'profile': profile.id, 'user': target_user.id}, status=status.HTTP_200_OK)


class DecisionCardReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, card_id):
        with transaction.atomic():
            card_queryset = DecisionCard.objects.select_for_update().select_related('institution', 'site')
            if not user_is_platform_admin(request.user):
                card_queryset = card_queryset.filter(
                    institution_id__in=user_staff_institution_ids(request.user)
                )
            try:
                card = card_queryset.get(pk=card_id)
            except DecisionCard.DoesNotExist as exc:
                raise NotFound('Decision Card not found') from exc

            if card.status != 'ready_for_review':
                return Response(
                    {'status': f'Decision Card cannot transition from {card.status} to reviewed.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            review_note = (request.data.get('review_note') or '').strip()
            card.status = 'reviewed'
            card.reviewed_at = timezone.now()
            card.reviewed_by = request.user
            card.review_note = review_note
            card.save(update_fields=['status', 'reviewed_at', 'reviewed_by', 'review_note', 'updated_at'])
            AssessmentAuditEvent.objects.create(
                institution=card.institution,
                site=card.site,
                actor=request.user,
                action='decision_card_reviewed',
                entity_type='DecisionCard',
                entity_id=str(card.id),
                metadata={
                    'previous_status': 'ready_for_review',
                    'new_status': 'reviewed',
                    'review_note_present': bool(review_note),
                },
            )

        return Response({
            'id': card.id,
            'status': card.status,
            'reviewed_at': card.reviewed_at,
            'reviewed_by': card.reviewed_by_id,
            'review_note': card.review_note,
        }, status=status.HTTP_200_OK)


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
