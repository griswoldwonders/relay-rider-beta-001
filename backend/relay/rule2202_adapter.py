from dataclasses import dataclass

from django.conf import settings
from django.utils import timezone

from .rule2202_models import Rule2202Run

_ALLOWED_STATES = {"unverified", "verified", "disabled"}
FUNCTION_SET_VERSION = "rule2202-sql-v1"


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


def _derived_inputs(analysis_run):
    metric_values = {
        metric.metric_key: metric.value
        for metric in analysis_run.metrics.order_by("metric_key")
        if metric.metric_key in {
            "record_count_accepted",
            "record_count_rejected",
            "mode_distribution",
            "gasoline_sov_count",
            "schedule_cluster_counts",
        }
    }
    return {
        "analysis_reproducibility_fingerprint": analysis_run.reproducibility_fingerprint,
        "source_file_sha256": analysis_run.source_batch.file_sha256,
        "engine_version": analysis_run.engine_version,
        "metric_inputs": metric_values,
    }


def _execute_verified_rule2202(inputs):
    raise RuntimeError(
        "Verified Rule 2202 execution backend is not configured in this development slice."
    )


def run_rule2202(*, analysis_run, requested_by):
    readiness = get_rule2202_readiness()
    inputs = _derived_inputs(analysis_run)
    now = timezone.now()

    if not readiness.can_execute:
        run = Rule2202Run(
            institution=analysis_run.institution,
            analysis_run=analysis_run,
            requested_by=requested_by,
            readiness_state=readiness.state,
            function_set_version=FUNCTION_SET_VERSION,
            status="unavailable",
            executed=False,
            input_manifest=inputs,
            output_manifest={},
            exclusion_manifest={"reason": readiness.reason},
            started_at=now,
            completed_at=now,
        )
        run.full_clean(exclude=["output_manifest"])
        run.save()
        return run

    run = Rule2202Run(
        institution=analysis_run.institution,
        analysis_run=analysis_run,
        requested_by=requested_by,
        readiness_state=readiness.state,
        function_set_version=FUNCTION_SET_VERSION,
        status="running",
        executed=False,
        input_manifest=inputs,
        output_manifest={},
        exclusion_manifest={},
        started_at=now,
    )
    run.full_clean(exclude=["output_manifest", "exclusion_manifest"])
    run.save()

    try:
        outputs = _execute_verified_rule2202(inputs)
        run.status = "completed"
        run.executed = True
        run.output_manifest = outputs
        run.completed_at = timezone.now()
        run.save(
            update_fields=[
                "status",
                "executed",
                "output_manifest",
                "completed_at",
                "updated_at",
            ]
        )
    except Exception as exc:
        run.status = "failed"
        run.executed = False
        run.completed_at = timezone.now()
        run.error_code = exc.__class__.__name__
        run.error_detail = str(exc)[:2000]
        run.save(
            update_fields=[
                "status",
                "executed",
                "completed_at",
                "error_code",
                "error_detail",
                "updated_at",
            ]
        )
        raise

    return run
