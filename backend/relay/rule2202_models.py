from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Rule2202Run(models.Model):
    STATUS_CHOICES = [
        ('unavailable', 'Unavailable'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    institution = models.ForeignKey('relay.Institution', on_delete=models.PROTECT, related_name='rule2202_runs')
    analysis_run = models.ForeignKey('relay.AnalysisRun', on_delete=models.PROTECT, related_name='rule2202_runs')
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='relay_rule2202_runs')
    readiness_state = models.CharField(max_length=32)
    function_set_version = models.CharField(max_length=64, default='rule2202-sql-v1')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES)
    executed = models.BooleanField(default=False)
    input_manifest = models.JSONField(default=dict)
    output_manifest = models.JSONField(default=dict)
    exclusion_manifest = models.JSONField(default=dict)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_code = models.CharField(max_length=160, blank=True)
    error_detail = models.TextField(blank=True)

    def clean(self):
        super().clean()
        if self.analysis_run_id and self.institution_id != self.analysis_run.institution_id:
            raise ValidationError({'institution': 'Rule 2202 run institution must match its analysis run.'})
