from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('network_ids', '0003_cpanelcredential'),
    ]

    operations = [
        migrations.AddField(
            model_name='cpanelcredential',
            name='password_encrypted',
            field=models.TextField(blank=True, default=''),
        ),
    ]
