from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('relay', '0001_initial')]

    operations = [
        migrations.CreateModel(
            name='ChargingHub',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('name', models.CharField(max_length=160)),
                ('network', models.CharField(max_length=120)),
                ('city', models.CharField(max_length=120)),
                ('stalls', models.PositiveIntegerField(default=0)),
                ('connector_types', models.JSONField(default=list)),
                ('status', models.CharField(default='candidate', max_length=32)),
                ('evidence_label', models.CharField(default='modeled', max_length=32)),
            ],
        ),
        migrations.CreateModel(
            name='RedemptionRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('requested_units', models.DecimalField(decimal_places=2, max_digits=10)),
                ('unit_label', models.CharField(default='Green Route Credits', max_length=80)),
                ('status', models.CharField(default='requested', max_length=32)),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('reviewed_by', models.CharField(blank=True, max_length=160)),
                ('review_note', models.TextField(blank=True)),
                ('charging_hub', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='redemption_requests', to='relay.charginghub')),
                ('credit', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='redemption_requests', to='relay.greenroutecredit')),
                ('profile', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='relay.profile')),
            ],
        ),
    ]
