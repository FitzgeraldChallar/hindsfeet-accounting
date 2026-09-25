from django.db import migrations, models
from decimal import Decimal


def seed_payroll_currency(apps, schema_editor):
    PayrollPeriod = apps.get_model("payroll", "PayrollPeriod")
    PayrollRecord = apps.get_model("payroll", "PayrollRecord")
    for period in PayrollPeriod.objects.select_related("company").all().iterator():
        period.currency = period.company.currency
        period.save(update_fields=["currency"])
    for record in PayrollRecord.objects.select_related("payroll_period").all().iterator():
        record.currency = record.payroll_period.currency
        record.save(update_fields=["currency"])


class Migration(migrations.Migration):
    dependencies = [("payroll", "0007_payrollperiod_exchange_rate_and_more")]
    operations = [
        migrations.AddField(model_name="payrollperiod", name="currency", field=models.CharField(choices=[("USD", "US Dollar (USD)"), ("LRD", "Liberian Dollar (LRD)")], default="USD", max_length=3)),
        migrations.AddField(model_name="payrollrecord", name="currency", field=models.CharField(choices=[("USD", "US Dollar (USD)"), ("LRD", "Liberian Dollar (LRD)")], default="USD", max_length=3)),
        migrations.RunPython(seed_payroll_currency, migrations.RunPython.noop),
    ]
