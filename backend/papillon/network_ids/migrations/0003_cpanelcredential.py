from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_customuser_vm_lab_path'),
        ('network_ids', '0002_rename_network_ids__domain__e4b123_idx_network_ids_domain_3183dd_idx_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='CPanelCredential',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('host', models.CharField(max_length=255)),
                ('username', models.CharField(max_length=255)),
                ('token_encrypted', models.TextField()),
                ('verify_ssl', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='cpanel_credential', to='users.customuser')),
            ],
            options={'ordering': ['-updated_at']},
        ),
    ]
