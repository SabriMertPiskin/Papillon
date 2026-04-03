from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_customuser_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='vm_lab_path',
            field=models.CharField(blank=True, max_length=500, null=True),
        ),
    ]