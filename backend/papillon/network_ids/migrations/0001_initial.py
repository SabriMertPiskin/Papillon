from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='DomainTrafficEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('domain', models.CharField(db_index=True, max_length=255)),
                ('client_ip', models.CharField(blank=True, db_index=True, default='', max_length=64)),
                ('method', models.CharField(db_index=True, max_length=12)),
                ('path', models.CharField(max_length=512)),
                ('status_code', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('response_ms', models.FloatField(blank=True, null=True)),
                ('user_agent', models.TextField(blank=True, default='')),
                ('requested_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('source', models.CharField(db_index=True, default='middleware', max_length=32)),
            ],
            options={
                'ordering': ['-requested_at'],
            },
        ),
        migrations.AddIndex(
            model_name='domaintrafficevent',
            index=models.Index(fields=['domain', 'requested_at'], name='network_ids__domain__e4b123_idx'),
        ),
        migrations.AddIndex(
            model_name='domaintrafficevent',
            index=models.Index(fields=['domain', 'client_ip', 'requested_at'], name='network_ids__domain__a3e7f5_idx'),
        ),
    ]
