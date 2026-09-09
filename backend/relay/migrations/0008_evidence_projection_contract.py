import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('relay', '0007_operational_beta_hardening'),
    ]

    operations = [
        migrations.AddField(
            model_name='commuterrecord',
            name='observation_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='commuterrecord',
            name='one_way_miles',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True),
        ),
        migrations.CreateModel(
            name='EvidenceProjectionBinding',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization_uuid', models.UUIDField()),
                ('site_uuid', models.UUIDField()),
                ('cohort_uuid', models.UUIDField(blank=True, null=True)),
                ('source_uuid', models.UUIDField(blank=True, null=True)),
                ('active', models.BooleanField(default=True)),
                ('cohort', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='evidence_projection_bindings', to='relay.cohort')),
                ('institution', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='evidence_projection_bindings', to='relay.institution')),
                ('site', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='evidence_projection_bindings', to='relay.site')),
            ],
            options={
                'constraints': [
                    models.UniqueConstraint(
                        fields=('institution', 'site', 'cohort', 'organization_uuid', 'site_uuid'),
                        name='unique_evidence_projection_binding',
                    ),
                ],
            },
        ),
    ]
