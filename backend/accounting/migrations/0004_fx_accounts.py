from django.db import migrations


def seed_fx_accounts(apps, schema_editor):
    Company = apps.get_model("companies", "Company")
    CompanyCurrency = apps.get_model("companies", "CompanyCurrency")
    Account = apps.get_model("accounting", "Account")
    for company in Company.objects.all().iterator():
        currencies = list(CompanyCurrency.objects.filter(company_id=company.pk, is_active=True).values_list("currency", flat=True)) or [company.currency]
        for currency in currencies:
            Account.objects.get_or_create(
                company_id=company.pk, currency=currency, code="4200",
                defaults={"name": "Foreign Exchange Gain", "account_type": "REVENUE", "is_system_account": True},
            )
            Account.objects.get_or_create(
                company_id=company.pk, currency=currency, code="6700",
                defaults={"name": "Foreign Exchange Loss", "account_type": "EXPENSE", "is_system_account": True},
            )


class Migration(migrations.Migration):
    dependencies = [("accounting", "0003_full_multi_currency"), ("companies", "0005_default_workspace_currency")]
    operations = [migrations.RunPython(seed_fx_accounts, migrations.RunPython.noop)]
