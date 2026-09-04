from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .models import ChargingHub, Corridor, EVParticipantSignal, GreenRouteCredit, Profile, ProgramBenefitPolicy, RedemptionRequest, RelayZone, RouteSignal, WalletLedgerEntry
from .permissions import CanReviewRedemptionRequest, IsTenantMember, user_institution_ids, user_is_platform_admin
from .serializers import ChargingHubSerializer, CorridorSerializer, EVParticipantSignalSerializer, GreenRouteCreditSerializer, ProfileSerializer, ProgramBenefitPolicySerializer, RedemptionRequestSerializer, RelayZoneSerializer, RouteSignalSerializer

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

class ProgramBenefitPolicyViewSet(TenantScopedQuerySetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsTenantMember]
    queryset = ProgramBenefitPolicy.objects.all().order_by('-created_at')
    serializer_class = ProgramBenefitPolicySerializer


class RedemptionRequestViewSet(TenantScopedQuerySetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    queryset = RedemptionRequest.objects.select_related('credit', 'charging_hub', 'profile').all().order_by('-requested_at')
    serializer_class = RedemptionRequestSerializer

    def get_permissions(self):
        if self.action in ('update', 'partial_update'):
            return [CanReviewRedemptionRequest()]
        return [IsTenantMember()]

    def _find_existing_redemption_request(self, credit_id, idempotency_key):
        """Looks up a prior request for the same (credit, idempotency_key) pair.

        Extracted to an instance method (rather than a local closure) so
        tests can deterministically force a "miss" on the pre-insert fast
        path -- simulating the window where a concurrent request has not
        committed yet -- without relying on real thread timing.
        """
        if not (idempotency_key and credit_id):
            return None
        return RedemptionRequest.objects.filter(
            credit_id=credit_id, idempotency_key=idempotency_key,
        ).first()

    def create(self, request, *args, **kwargs):
        idempotency_key = request.data.get('idempotency_key')
        credit_id = request.data.get('credit')

        # Fast path: a prior request with this idempotency key already committed.
        existing = self._find_existing_redemption_request(credit_id, idempotency_key)
        if existing is not None:
            return Response(self.get_serializer(existing).data, status=status.HTTP_201_CREATED)

        try:
            return super().create(request, *args, **kwargs)
        except IntegrityError:
            # Concurrency-safe fallback: another request committed the same
            # (credit, idempotency_key) pair after our fast-path check above
            # ran but before our insert. The database's unique constraint
            # (unique_credit_idempotency_key) lets exactly one insert --
            # and therefore exactly one HOLD ledger entry, written in the
            # same perform_create transaction -- succeed; our
            # transaction.atomic() block rolls back our insert (and we never
            # reach the ledger write, which happens after serializer.save())
            # automatically on the IntegrityError. We recover by returning
            # the winner's row instead of surfacing a 500.
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
