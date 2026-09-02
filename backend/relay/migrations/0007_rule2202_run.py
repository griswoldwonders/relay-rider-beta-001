import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('relay', '0006_analysis_run_and_metric'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Rule2202Run',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('readiness_state', models.CharField(max_length=32)),
                ('function_set_version', models.CharField(default='rule2202-sql-v1', max_length=64)),
                ('status', models.CharField(choices=[('unavailable', 'Unavailable'), ('running', 'Running'), ('completed', 'Completed'), ('failed', 'Failed')], max_length=32)),
                ('executed', models.BooleanField(default=False)),
                ('input_manifest', models.JSONField(default=dict)),
                ('output_manifest', models.JSONField(default=dict)),
                ('exclusion_manifest', models.JSONField(default=dict)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('error_code', models.CharField(blank=True, max_length=160)),
                ('error_detail', models.TextField(blank=True)),
                ('analysis_run', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='rule2202_runs', to='relay.analysisrun')),
                ('institution', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='rule2202_runs', to='relay.institution')),
                ('requested_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='relay_rule2202_runs', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
