import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('relay', '0005_import_provenance_and_canonical_commuter'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AnalysisRun',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('engine_version', models.CharField(max_length=64)),
                ('configuration_version', models.CharField(max_length=64)),
                ('code_version', models.CharField(max_length=128)),
                ('canonical_dataset_fingerprint', models.CharField(max_length=64)),
                ('reproducibility_fingerprint', models.CharField(max_length=64)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('running', 'Running'), ('completed', 'Completed'), ('failed', 'Failed')], default='pending', max_length=32)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('error_code', models.CharField(blank=True, max_length=160)),
                ('error_detail', models.TextField(blank=True)),
                ('cohort', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='analysis_runs', to='relay.cohort')),
                ('institution', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='analysis_runs', to='relay.institution')),
                ('requested_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='relay_analysis_runs', to=settings.AUTH_USER_MODEL)),
                ('site', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='analysis_runs', to='relay.site')),
                ('source_batch', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='analysis_runs', to='relay.importbatch')),
            ],
        ),
        migrations.CreateModel(
            name='AnalysisMetric',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('metric_key', models.CharField(max_length=160)),
                ('evidence_class', models.CharField(choices=[('observed', 'Observed'), ('calculated', 'Calculated'), ('modeled', 'Modeled')], max_length=16)),
                ('value', models.JSONField()),
                ('unit', models.CharField(blank=True, max_length=80)),
                ('source_manifest', models.JSONField(default=dict)),
                ('method_identifier', models.CharField(max_length=160)),
                ('confidence', models.CharField(blank=True, max_length=160)),
                ('privacy_treatment', models.CharField(max_length=160)),
                ('caveat', models.TextField(blank=True)),
                ('partner_wording', models.TextField(blank=True)),
                ('analysis_run', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='metrics', to='relay.analysisrun')),
                ('institution', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='analysis_metrics', to='relay.institution')),
            ],
            options={
                'constraints': [models.UniqueConstraint(fields=('analysis_run', 'metric_key'), name='unique_metric_key_per_analysis_run')],
            },
        ),
    ]
