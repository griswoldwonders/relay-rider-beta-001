import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('relay', '0003_institution_charginghub_institution_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Site',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('name', models.CharField(max_length=160)),
                ('slug', models.SlugField(max_length=160)),
                ('status', models.CharField(choices=[('active', 'Active'), ('inactive', 'Inactive'), ('pending', 'Pending')], default='active', max_length=32)),
                ('institution', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sites', to='relay.institution')),
            ],
            options={
                'constraints': [models.UniqueConstraint(fields=('institution', 'slug'), name='unique_site_slug_per_institution')],
            },
        ),
        migrations.CreateModel(
            name='Cohort',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('name', models.CharField(max_length=160)),
                ('slug', models.SlugField(max_length=160)),
                ('status', models.CharField(choices=[('active', 'Active'), ('inactive', 'Inactive'), ('pending', 'Pending')], default='active', max_length=32)),
                ('institution', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cohorts', to='relay.institution')),
                ('site', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cohorts', to='relay.site')),
            ],
            options={
                'constraints': [
                    models.UniqueConstraint(fields=('institution', 'slug'), name='unique_cohort_slug_per_institution'),
                    models.UniqueConstraint(fields=('site', 'slug'), name='unique_cohort_slug_per_site'),
                ],
            },
        ),
    ]
