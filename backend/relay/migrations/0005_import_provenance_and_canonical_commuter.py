import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('relay', '0004_operational_institutional_hierarchy'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ImportBatch',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('original_filename', models.CharField(max_length=255)),
                ('file_sha256', models.CharField(max_length=64)),
                ('schema_version', models.CharField(max_length=32)),
                ('status', models.CharField(choices=[('uploaded', 'Uploaded'), ('validated', 'Validated'), ('failed', 'Failed')], default='uploaded', max_length=32)),
                ('total_rows', models.PositiveIntegerField(default=0)),
                ('accepted_rows', models.PositiveIntegerField(default=0)),
                ('rejected_rows', models.PositiveIntegerField(default=0)),
                ('cohort', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='import_batches', to='relay.cohort')),
                ('institution', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='import_batches', to='relay.institution')),
                ('site', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='import_batches', to='relay.site')),
                ('uploaded_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='relay_import_batches', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='ImportRow',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('row_number', models.PositiveIntegerField()),
                ('raw_payload', models.JSONField(default=dict)),
                ('normalized_payload', models.JSONField(default=dict)),
                ('validation_status', models.CharField(choices=[('accepted', 'Accepted'), ('rejected', 'Rejected')], max_length=16)),
                ('error_codes', models.JSONField(default=list)),
                ('warning_codes', models.JSONField(default=list)),
                ('batch', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='rows', to='relay.importbatch')),
                ('cohort', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='import_rows', to='relay.cohort')),
                ('institution', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='import_rows', to='relay.institution')),
                ('site', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='import_rows', to='relay.site')),
            ],
            options={
                'constraints': [models.UniqueConstraint(fields=('batch', 'row_number'), name='unique_row_number_per_import_batch')],
            },
        ),
        migrations.CreateModel(
            name='CanonicalCommuterRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('participant_key', models.CharField(max_length=160)),
                ('origin_zone', models.CharField(max_length=160)),
                ('destination_zone', models.CharField(max_length=160)),
                ('commute_days', models.JSONField(default=list)),
                ('arrival_window_start', models.TimeField(blank=True, null=True)),
                ('arrival_window_end', models.TimeField(blank=True, null=True)),
                ('departure_window_start', models.TimeField(blank=True, null=True)),
                ('departure_window_end', models.TimeField(blank=True, null=True)),
                ('flexibility_minutes', models.PositiveIntegerField(default=0)),
                ('current_mode', models.CharField(blank=True, max_length=80)),
                ('vehicle_classification', models.CharField(blank=True, max_length=80)),
                ('commute_distance_miles', models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True)),
                ('commute_time_minutes', models.PositiveIntegerField(blank=True, null=True)),
                ('parking_difficulty', models.CharField(blank=True, max_length=80)),
                ('ev_hybrid_signal', models.CharField(blank=True, max_length=80)),
                ('canonicalization_version', models.CharField(default='1.0', max_length=32)),
                ('cohort', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='canonical_commuters', to='relay.cohort')),
                ('institution', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='canonical_commuters', to='relay.institution')),
                ('site', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='canonical_commuters', to='relay.site')),
                ('source_row', models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name='canonical_record', to='relay.importrow')),
            ],
        ),
    ]
