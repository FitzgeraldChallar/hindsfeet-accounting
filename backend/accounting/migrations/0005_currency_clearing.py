from decimal import Decimal

from django.db import migrations, models


CURRENCY_CLEARING_CODE = "1900"


def seed_and_repair_currency_ledgers(apps, schema_editor):
    Company = apps.get_model("companies", "Company")
    CompanyCurrency = apps.get_model("companies", "CompanyCurrency")
    Account = apps.get_model("accounting", "Account")
    JournalEntry = apps.get_model("accounting", "JournalEntry")
    JournalLine = apps.get_model("accounting", "JournalLine")

    # Ensure every enabled currency has the system clearing account. The
    # account is an Asset because the currency-specific ledger may carry
    # either a positive or negative clearing balance while the paired
    # currency carries the opposite side.
    for company in Company.objects.all().iterator():
        currencies = list(
            CompanyCurrency.objects.filter(
                company_id=company.pk,
                is_active=True,
            ).values_list("currency", flat=True)
        ) or [company.currency]

        for currency in currencies:
            Account.objects.get_or_create(
                company_id=company.pk,
                currency=currency,
                code=CURRENCY_CLEARING_CODE,
                defaults={
                    "name": "Foreign Currency Clearing",
                    "account_type": "ASSET",
                    "cash_flow_category": "NONE",
                    "description": (
                        "System clearing account used to balance cross-currency "
                        "transaction ledgers. Its functional value is zero."
                    ),
                    "is_active": True,
                    "is_system_account": True,
                    "parent_id": None,
                },
            )

    # Repair historical cross-currency journals already posted before this
    # migration. Each native currency is balanced independently. Existing
    # functional values are untouched; the synthetic line carries zero
    # functional value so the economic functional ledger remains unchanged.
    for entry in JournalEntry.objects.filter(status="POSTED").iterator():
        lines = list(
            JournalLine.objects.filter(
                journal_entry_id=entry.pk,
            ).order_by("id")
        )
        currencies = {line.currency for line in lines}
        if len(currencies) <= 1:
            continue

        for currency in sorted(currencies):
            currency_lines = [line for line in lines if line.currency == currency]
            debit = sum((line.debit for line in currency_lines), Decimal("0.00"))
            credit = sum((line.credit for line in currency_lines), Decimal("0.00"))
            net = debit - credit

            if net == Decimal("0.00"):
                continue

            # Avoid creating a second repair line if this migration is ever
            # reapplied against a partially repaired database.
            if JournalLine.objects.filter(
                journal_entry_id=entry.pk,
                currency=currency,
                is_currency_clearing=True,
            ).exists():
                continue

            clearing_account = Account.objects.get(
                company_id=entry.company_id,
                currency=currency,
                code=CURRENCY_CLEARING_CODE,
            )

            JournalLine.objects.create(
                journal_entry_id=entry.pk,
                account_id=clearing_account.pk,
                currency=currency,
                exchange_rate=Decimal("1.000000"),
                description="Foreign currency clearing for cross-currency journal",
                debit=Decimal("0.00") if net > 0 else abs(net),
                credit=net if net > 0 else Decimal("0.00"),
                functional_debit=Decimal("0.00"),
                functional_credit=Decimal("0.00"),
                is_currency_clearing=True,
            )


def reverse_currency_clearing(apps, schema_editor):
    # The clearing lines are a repair to historical accounting data. They are
    # intentionally retained on rollback rather than deleting posted ledger
    # history automatically.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounting", "0004_fx_accounts"),
    ]

    operations = [
        migrations.AddField(
            model_name="journalline",
            name="is_currency_clearing",
            field=models.BooleanField(default=False, editable=False),
        ),
        migrations.RunPython(
            seed_and_repair_currency_ledgers,
            reverse_currency_clearing,
        ),
    ]
