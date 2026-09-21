from rest_framework.permissions import BasePermission

from .models import Membership


STAFF_ROLES = {'institution_admin', 'program_staff'}
PARTICIPANT_ROLE = 'participant'


def user_institution_ids(user):
    if not user or not user.is_authenticated:
        return set()
    return set(Membership.objects.filter(user=user).values_list('institution_id', flat=True))


def user_staff_institution_ids(user):
    if not user or not user.is_authenticated:
        return set()
    return set(Membership.objects.filter(
        user=user,
        role__in=STAFF_ROLES,
    ).values_list('institution_id', flat=True))


def user_participant_institution_ids(user):
    if not user or not user.is_authenticated:
        return set()
    return set(Membership.objects.filter(
        user=user,
        role=PARTICIPANT_ROLE,
    ).values_list('institution_id', flat=True))


def user_is_platform_admin(user):
    if not user or not user.is_authenticated:
        return False
    return Membership.objects.filter(user=user, role='platform_admin').exists()


class IsTenantMember(BasePermission):
    """Requires authentication; scopes access to the caller's institution(s).

    platform_admin membership (in any institution) bypasses tenant scoping
    entirely. Everyone else may only read/write rows whose `institution`
    matches one of their memberships. Rows with no institution assigned yet
    (pre-backfill) are only visible to platform_admin.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if user_is_platform_admin(request.user):
            return True
        institution_id = getattr(obj, 'institution_id', None)
        if institution_id is None:
            return False
        return institution_id in user_institution_ids(request.user)


class CanSubmitRedemptionRequest(IsTenantMember):
    """Only participants or staff may submit governed redemption requests."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if user_is_platform_admin(request.user):
            return True
        return Membership.objects.filter(
            user=request.user,
            role__in={PARTICIPANT_ROLE, *STAFF_ROLES},
        ).exists()


class CanReviewRedemptionRequest(IsTenantMember):
    """Tenant membership plus a staff-level role for write actions on review."""

    def has_object_permission(self, request, view, obj):
        if not super().has_object_permission(request, view, obj):
            return False
        if user_is_platform_admin(request.user):
            return True
        return Membership.objects.filter(
            user=request.user, institution_id=obj.institution_id, role__in=STAFF_ROLES
        ).exists()
