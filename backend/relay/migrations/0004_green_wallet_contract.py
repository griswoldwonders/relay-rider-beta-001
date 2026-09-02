from django.db import migrations, models


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
