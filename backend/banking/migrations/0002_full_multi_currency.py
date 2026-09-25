from decimal import Decimal
from django.db import migrations, models


def seed_bank_currency_snapshots(apps, schema_editor):
    BankAccount = apps.get_model("banking", "BankAccount")
    BankTransaction = apps.get_model("banking", "BankTransaction")
    for account in BankAccount.objects.select_related("company").all().iterator():
        account.currency = str(account.company.currency or account.currency or "USD").upper()
        account.save(update_fields=["currency"])
    for tx in BankTransaction.objects.select_related("bank_account").all().iterator():
        tx.currency = tx.bank_account.currency
        tx.exchange_rate = Decimal("1.000000")
        tx.functional_amount = tx.amount
        tx.save(update_fields=["currency", "exchange_rate", "functional_amount"])


class Migration(migrations.Migration):
    dependencies = [("banking", "0001_initial")]
    operations = [
        migrations.AlterField(
            model_name="bankaccount", name="currency",
            field=models.CharField(choices=[("USD", "US Dollar (USD)"), ("LRD", "Liberian Dollar (LRD)")], default="USD", max_length=3),
        ),
        migrations.AddField(
            model_name="banktransaction", name="currency",
            field=models.CharField(choices=[("USD", "US Dollar (USD)"), ("LRD", "Liberian Dollar (LRD)")], default="USD", max_length=3),
        ),
        migrations.AddField(
            model_name="banktransaction", name="exchange_rate",
            field=models.DecimalField(decimal_places=6, default=Decimal("1.000000"), max_digits=18),
        ),
        migrations.AddField(
            model_name="banktransaction", name="functional_amount",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=18),
        ),
        migrations.RunPython(seed_bank_currency_snapshots, migrations.RunPython.noop),
    ]
