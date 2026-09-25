from django.db import migrations, models


def seed_default_workspace_currency(apps, schema_editor):
    Company = apps.get_model("companies", "Company")
    CompanyCurrency = apps.get_model("companies", "CompanyCurrency")
    for company in Company.objects.all().iterator():
        company.default_workspace_currency = company.currency
        company.save(update_fields=["default_workspace_currency"])
        CompanyCurrency.objects.filter(company_id=company.pk).update(is_default=False)
        CompanyCurrency.objects.filter(
            company_id=company.pk, currency=company.currency
        ).update(is_default=True, is_active=True)


class Migration(migrations.Migration):
    dependencies = [("companies", "0004_company_currency_and_exchange_rates")]
    operations = [
        migrations.AddField(
            model_name="company",
            name="default_workspace_currency",
            field=models.CharField(
                choices=[("USD", "US Dollar (USD)"), ("LRD", "Liberian Dollar (LRD)")],
                default="USD",
                max_length=3,
            ),
        ),
        migrations.RunPython(seed_default_workspace_currency, migrations.RunPython.noop),
    ]
