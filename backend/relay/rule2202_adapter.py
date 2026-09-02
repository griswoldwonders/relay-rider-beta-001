from dataclasses import dataclass

from django.conf import settings

_ALLOWED_STATES = {"unverified", "verified", "disabled"}


@dataclass(frozen=True)
class Rule2202Readiness:
    state: str
    reason: str

    @property
    def can_execute(self) -> bool:
        return self.state == "verified"


def get_rule2202_readiness() -> Rule2202Readiness:
    state = getattr(settings, "RELAY_RULE2202_STATE", "unverified")
    if state not in _ALLOWED_STATES:
        state = "unverified"

    reason = {
        "unverified": "Supabase migration history has not been reconciled and verified.",
        "verified": "Migration history is explicitly marked verified for this environment.",
        "disabled": "Rule 2202 execution is intentionally disabled for this environment.",
    }[state]
    return Rule2202Readiness(state=state, reason=reason)
