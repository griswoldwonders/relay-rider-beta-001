import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('relay', '0006_institutional_vertical_slice'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='membership',
            name='role',
            field=models.CharField(
                choices=[
                    ('platform_admin', 'Platform admin'),
                    ('institution_admin', 'Institution admin'),
                    ('program_staff', 'Program staff'),
                    ('viewer', 'Viewer'),
                    ('participant', 'Participant'),
                ],
                default='viewer',
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name='profile',
            name='user',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='relay_profile',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='decisioncard',
            name='review_note',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='decisioncard',
            name='reviewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='decisioncard',
            name='reviewed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='reviewed_decision_cards',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
