# Generated migration for adding role field to CustomUser

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_customuser_mfa_backup_code'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='role',
            field=models.CharField(
                choices=[('admin', 'Administrator'), ('analyst', 'Security Analyst')],
                default='analyst',
                max_length=20
            ),
        ),
    ]
