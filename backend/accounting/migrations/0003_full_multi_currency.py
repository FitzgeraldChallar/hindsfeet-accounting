from decimal import Decimal
from django.db import migrations, models
import django.db.models.deletion


def migrate_currency_data(apps, schema_editor):
    Company = apps.get_model("companies", "Company")
    CompanyCurrency = apps.get_model("companies", "CompanyCurrency")
    Account = apps.get_model("accounting", "Account")
    JournalEntry = apps.get_model("accounting", "JournalEntry")
    JournalLine = apps.get_model("accounting", "JournalLine")

    for company in Company.objects.all().iterator():
        functional = company.currency
        # Every existing company gets both supported workspaces. This is
        # configuration only; historical transactions keep their snapshots.
        for currency in ("USD", "LRD"):
            obj, _ = CompanyCurrency.objects.get_or_create(
                company_id=company.pk,
                currency=currency,
                defaults={
                    "is_active": True,
                    "is_default": currency == getattr(company, "default_workspace_currency", functional),
                },
            )
            if obj.is_default:
                CompanyCurrency.objects.filter(company_id=company.pk).exclude(pk=obj.pk).update(is_default=False)

        existing = list(Account.objects.filter(company_id=company.pk).order_by("id"))
        for account in existing:
            account.currency = functional
            account.save(update_fields=["currency"])

        clones = {}
        for account in existing:
            clone, _ = Account.objects.get_or_create(
                company_id=company.pk,
                currency="LRD" if functional == "USD" else "USD",
                code=account.code,
                defaults={
                    "name": account.name,
                    "account_type": account.account_type,
                    "cash_flow_category": account.cash_flow_category,
                    "description": account.description,
                    "parent_id": None,
                    "is_active": account.is_active,
                    "is_system_account": account.is_system_account,
                },
            )
            clones[account.id] = clone.id
        # Rebuild clone parent hierarchy.
        for account in existing:
            if account.parent_id and account.parent_id in clones:
                clone_id = clones[account.id]
                Account.objects.filter(pk=clone_id).update(parent_id=clones[account.parent_id])

    for entry in JournalEntry.objects.select_related("company").all().iterator():
        functional = entry.company.currency
        entry.currency = functional
        entry.functional_currency = functional
        entry.exchange_rate = Decimal("1.000000")
        entry.save(update_fields=["currency", "functional_currency", "exchange_rate"])

    for line in JournalLine.objects.select_related("account", "journal_entry").all().iterator():
        line.currency = line.account.currency
        line.exchange_rate = Decimal("1.000000")
        line.functional_debit = line.debit
        line.functional_credit = line.credit
        line.save(update_fields=["currency", "exchange_rate", "functional_debit", "functional_credit"])


def reverse_currency_data(apps, schema_editor):
    # The schema/data conversion is intentionally irreversible because it
    # creates currency-specific ledgers. Migrations should not be used to
    # destructively merge those ledgers on rollback.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("companies", "0005_default_workspace_currency"),
        ("accounting", "0002_account_cash_flow_category"),
    ]

    operations = [
        migrations.AddField(
            model_name="account",
            name="currency",
            field=models.CharField(
                choices=[("USD", "US Dollar (USD)"), ("LRD", "Liberian Dollar (LRD)")],
                default="USD",
                max_length=3,
            ),
        ),
        migrations.AddField(
            model_name="journalentry",
            name="currency",
            field=models.CharField(
                choices=[("USD", "US Dollar (USD)"), ("LRD", "Liberian Dollar (LRD)")],
                default="USD",
                max_length=3,
            ),
        ),
        migrations.AddField(
            model_name="journalentry",
            name="functional_currency",
            field=models.CharField(
                choices=[("USD", "US Dollar (USD)"), ("LRD", "Liberian Dollar (LRD)")],
                default="USD",
                max_length=3,
            ),
        ),
        migrations.AddField(
            model_name="journalentry",
            name="exchange_rate",
            field=models.DecimalField(default=Decimal("1.000000"), max_digits=18, decimal_places=6),
        ),
        migrations.AddField(
            model_name="journalline",
            name="currency",
            field=models.CharField(
                choices=[("USD", "US Dollar (USD)"), ("LRD", "Liberian Dollar (LRD)")],
                default="USD",
                max_length=3,
            ),
        ),
        migrations.AddField(
            model_name="journalline",
            name="exchange_rate",
            field=models.DecimalField(default=Decimal("1.000000"), max_digits=18, decimal_places=6),
        ),
        migrations.AddField(
            model_name="journalline",
            name="functional_debit",
            field=models.DecimalField(default=Decimal("0.00"), max_digits=18, decimal_places=2),
        ),
        migrations.AddField(
            model_name="journalline",
            name="functional_credit",
            field=models.DecimalField(default=Decimal("0.00"), max_digits=18, decimal_places=2),
        ),
        migrations.RemoveConstraint(
            model_name="account",
            name="unique_account_code_per_company",
        ),
        migrations.RunPython(migrate_currency_data, reverse_currency_data),
        migrations.AddConstraint(
            model_name="account",
            constraint=models.UniqueConstraint(
                fields=("company", "currency", "code"),
                name="unique_account_currency_code_per_company",
            ),
        ),
        migrations.AddIndex(
            model_name="account",
            index=models.Index(fields=["company", "currency"], name="accounting_account_company_currency_idx"),
        ),
        migrations.AddIndex(
            model_name="journalentry",
            index=models.Index(fields=["company", "currency", "transaction_date"], name="accounting_je_currency_date_idx"),
        ),
        migrations.AddIndex(
            model_name="journalline",
            index=models.Index(fields=["account", "currency"], name="accounting_jl_account_currency_idx"),
        ),
    ]
