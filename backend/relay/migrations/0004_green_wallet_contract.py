from django.db import migrations, models


def normalize_legacy_green_wallet_values(apps, schema_editor):
    ChargingHub = apps.get_model('relay', 'ChargingHub')
    RedemptionRequest = apps.get_model('relay', 'RedemptionRequest')

    hub_status_map = {
        'Candidate': 'candidate',
        'Verified': 'verified',
        'Active': 'active',
    }
    evidence_label_map = {
        'Synthetic': 'synthetic',
        'Modeled': 'modeled',
        'Verified': 'verified',
    }
    redemption_status_map = {
        'approved': 'fulfilled',
        'redemption_requested': 'requested',
        'under_review': 'under-review',
    }

    for old_value, new_value in hub_status_map.items():
        ChargingHub.objects.filter(status=old_value).update(status=new_value)
    for old_value, new_value in evidence_label_map.items():
        ChargingHub.objects.filter(evidence_label=old_value).update(evidence_label=new_value)
    for old_value, new_value in redemption_status_map.items():
        RedemptionRequest.objects.filter(status=old_value).update(status=new_value)


class Migration(migrations.Migration):
    dependencies = [('relay', '0003_institution_charginghub_institution_and_more')]

    operations = [
        migrations.AddField(
            model_name='greenroutecredit',
            name='amount_units',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='greenroutecredit',
            name='unit_label',
            field=models.CharField(default='Green Route Credits', max_length=80),
        ),
        migrations.AddField(
            model_name='greenroutecredit',
            name='status',
            field=models.CharField(choices=[('issued', 'Issued'), ('redeemed', 'Redeemed'), ('expired', 'Expired')], default='issued', max_length=32),
        ),
        migrations.RunPython(
            normalize_legacy_green_wallet_values,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name='charginghub',
            name='status',
            field=models.CharField(choices=[('candidate', 'Candidate'), ('verified', 'Verified'), ('active', 'Active')], default='candidate', max_length=32),
        ),
        migrations.AlterField(
            model_name='charginghub',
            name='evidence_label',
            field=models.CharField(choices=[('synthetic', 'Synthetic'), ('modeled', 'Modeled'), ('verified', 'Verified')], default='modeled', max_length=32),
        ),
        migrations.AlterField(
            model_name='redemptionrequest',
            name='status',
            field=models.CharField(choices=[('requested', 'Requested'), ('under-review', 'Under administrative review'), ('fulfilled', 'Fulfilled'), ('denied', 'Denied')], default='requested', max_length=32),
        ),
    ]
