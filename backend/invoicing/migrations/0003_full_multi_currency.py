from decimal import Decimal
from django.db import migrations, models
import django.db.models.deletion
import django.core.validators


def seed_invoice_currency_data(apps, schema_editor):
    Company = apps.get_model("companies", "Company")
    Invoice = apps.get_model("invoicing", "Invoice")
    SupplierBill = apps.get_model("invoicing", "SupplierBill")
    CustomerPayment = apps.get_model("invoicing", "CustomerPayment")
    SupplierPayment = apps.get_model("invoicing", "SupplierPayment")
    for invoice in Invoice.objects.select_related("company").all().iterator():
        if not invoice.currency:
            invoice.currency = invoice.company.currency
        invoice.exchange_rate = Decimal("1.000000")
        invoice.save(update_fields=["currency", "exchange_rate"])
    for bill in SupplierBill.objects.select_related("company").all().iterator():
        bill.currency = getattr(bill, "currency", None) or bill.company.currency
        bill.exchange_rate = Decimal("1.000000")
        bill.save(update_fields=["currency", "exchange_rate"])
    for payment in CustomerPayment.objects.select_related("invoice").all().iterator():
        payment.currency = payment.invoice.currency
        payment.exchange_rate = payment.invoice.exchange_rate
        payment.amount_in_invoice_currency = payment.amount
        payment.functional_amount = (payment.amount * payment.exchange_rate).quantize(Decimal("0.01"))
        payment.save(update_fields=["currency", "exchange_rate", "amount_in_invoice_currency", "functional_amount"])
    for payment in SupplierPayment.objects.select_related("bill").all().iterator():
        payment.currency = payment.bill.currency
        payment.exchange_rate = payment.bill.exchange_rate
        payment.amount_in_bill_currency = payment.amount
        payment.functional_amount = (payment.amount * payment.exchange_rate).quantize(Decimal("0.01"))
        payment.save(update_fields=["currency", "exchange_rate", "amount_in_bill_currency", "functional_amount"])


class Migration(migrations.Migration):
    dependencies = [
        ("invoicing", "0002_invoice_currency_invoice_exchange_rate"),
        ("companies", "0005_default_workspace_currency"),
        ("banking", "0002_full_multi_currency"),
    ]
    operations = [
        migrations.AddField(model_name="supplierbill", name="currency", field=models.CharField(choices=[("USD", "US Dollar (USD)"), ("LRD", "Liberian Dollar (LRD)")], default="USD", max_length=3)),
        migrations.AddField(model_name="supplierbill", name="exchange_rate", field=models.DecimalField(decimal_places=6, default=Decimal("1.000000"), max_digits=18, validators=[django.core.validators.MinValueValidator(Decimal("0.000001"))])),
        migrations.AddField(model_name="customerpayment", name="bank_account", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="customer_payments", to="banking.bankaccount")),
        migrations.AddField(model_name="customerpayment", name="currency", field=models.CharField(choices=[("USD", "US Dollar (USD)"), ("LRD", "Liberian Dollar (LRD)")], default="USD", max_length=3)),
        migrations.AddField(model_name="customerpayment", name="exchange_rate", field=models.DecimalField(decimal_places=6, default=Decimal("1.000000"), max_digits=18, validators=[django.core.validators.MinValueValidator(Decimal("0.000001"))])),
        migrations.AddField(model_name="customerpayment", name="amount_in_invoice_currency", field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=18)),
        migrations.AddField(model_name="customerpayment", name="functional_amount", field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=18)),
        migrations.AddField(model_name="supplierpayment", name="bank_account", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="supplier_payments", to="banking.bankaccount")),
        migrations.AddField(model_name="supplierpayment", name="currency", field=models.CharField(choices=[("USD", "US Dollar (USD)"), ("LRD", "Liberian Dollar (LRD)")], default="USD", max_length=3)),
        migrations.AddField(model_name="supplierpayment", name="exchange_rate", field=models.DecimalField(decimal_places=6, default=Decimal("1.000000"), max_digits=18, validators=[django.core.validators.MinValueValidator(Decimal("0.000001"))])),
        migrations.AddField(model_name="supplierpayment", name="amount_in_bill_currency", field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=18)),
        migrations.AddField(model_name="supplierpayment", name="functional_amount", field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=18)),
        migrations.RunPython(seed_invoice_currency_data, migrations.RunPython.noop),
    ]
