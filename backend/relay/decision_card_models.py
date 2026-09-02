from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class DecisionCard(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    institution = models.ForeignKey('relay.Institution', on_delete=models.PROTECT, related_name='decision_cards')
    site = models.ForeignKey('relay.Site', on_delete=models.PROTECT, related_name='decision_cards')
    cohort = models.ForeignKey('relay.Cohort', on_delete=models.PROTECT, related_name='decision_cards')
    analysis_run = models.ForeignKey('relay.AnalysisRun', on_delete=models.PROTECT, related_name='decision_cards')
    generated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='relay_decision_cards')
    decision_question = models.TextField()
    headline = models.CharField(max_length=255)
    evidence_summary = models.JSONField(default=dict)
    findings = models.JSONField(default=list)
    recommended_action = models.TextField()
    caveats = models.JSONField(default=list)
    evidence_manifest = models.JSONField(default=list)
    generation_version = models.CharField(max_length=64, default='decision-card-v1')
    reproducibility_fingerprint = models.CharField(max_length=64)
    generated_at = models.DateTimeField()

    def clean(self):
        super().clean()
        if not self.analysis_run_id:
            return
        errors = {}
        if self.institution_id != self.analysis_run.institution_id:
            errors['institution'] = 'Decision Card institution must match its analysis run.'
        if self.site_id != self.analysis_run.site_id:
            errors['site'] = 'Decision Card site must match its analysis run.'
        if self.cohort_id != self.analysis_run.cohort_id:
            errors['cohort'] = 'Decision Card cohort must match its analysis run.'
        if errors:
            raise ValidationError(errors)
