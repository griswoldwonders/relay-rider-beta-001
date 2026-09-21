from django.contrib import admin
from .models import ChargingHub, Corridor, EVParticipantSignal, GreenRouteCredit, Institution, Membership, Profile, ProgramBenefitPolicy, RedemptionRequest, RelayZone, RouteSignal, WalletLedgerEntry

for model in [Institution, Membership, RouteSignal, EVParticipantSignal, RelayZone, Corridor, GreenRouteCredit, ChargingHub, RedemptionRequest, ProgramBenefitPolicy]:
    admin.site.register(model)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    """Profile ownership is assigned only through the governed bind-user API."""

    readonly_fields = ('user',)


@admin.register(WalletLedgerEntry)
class WalletLedgerEntryAdmin(admin.ModelAdmin):
    """Read-only in admin: entries are immutable and created only by the API."""

    list_display = ('id', 'entry_type', 'credit', 'quantity_delta', 'redemption_request', 'created_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
