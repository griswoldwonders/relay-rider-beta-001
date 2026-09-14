from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('relay', '0008_evidence_projection_contract'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='evidenceprojectionbinding',
            constraint=models.UniqueConstraint(
                condition=models.Q(('active', True), ('cohort__isnull', False)),
                fields=('institution', 'site', 'cohort'),
                name='unique_active_evidence_binding_with_cohort',
            ),
        ),
        migrations.AddConstraint(
            model_name='evidenceprojectionbinding',
            constraint=models.UniqueConstraint(
                condition=models.Q(('active', True), ('cohort__isnull', True)),
                fields=('institution', 'site'),
                name='unique_active_evidence_binding_null_cohort',
            ),
        ),
    ]
