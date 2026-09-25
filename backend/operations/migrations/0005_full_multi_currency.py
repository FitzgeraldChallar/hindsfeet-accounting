from decimal import Decimal
from django.db import migrations, models
import django.core.validators
import django.db.models.deletion


def seed_product_prices(apps, schema_editor):
    Product = apps.get_model("operations", "Product")
    ProductPrice = apps.get_model("operations", "ProductPrice")
    CompanyCurrency = apps.get_model("companies", "CompanyCurrency")
    for product in Product.objects.all().iterator():
        currencies = list(CompanyCurrency.objects.filter(company_id=product.company_id, is_active=True).values_list("currency", flat=True)) or [product.company.currency]
        for currency in currencies:
            # Preserve the existing product price as the functional/default
            # currency. Other workspace prices are intentionally left at the
            # same starting value only for migration continuity; users can
            # maintain independent USD/LRD prices afterward.
            ProductPrice.objects.get_or_create(
                product_id=product.pk,
                currency=currency,
                defaults={
                    "selling_price": product.selling_price,
                    "cost_price": product.cost_price,
                    "is_active": True,
                },
            )


class Migration(migrations.Migration):
    dependencies = [
        ("operations", "0004_fuelpump_pumpattendant_pumpsale_and_more"),
        ("companies", "0005_default_workspace_currency"),
    ]
    operations = [
        migrations.CreateModel(
            name="ProductPrice",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("currency", models.CharField(choices=[("USD", "US Dollar (USD)"), ("LRD", "Liberian Dollar (LRD)")], max_length=3)),
                ("selling_price", models.DecimalField(decimal_places=2, max_digits=18, validators=[django.core.validators.MinValueValidator(Decimal("0.00"))])),
                ("cost_price", models.DecimalField(decimal_places=2, max_digits=18, validators=[django.core.validators.MinValueValidator(Decimal("0.00"))])),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="prices", to="operations.product")),
            ],
            options={"ordering": ["currency"]},
        ),
        migrations.AddConstraint(
            model_name="productprice",
            constraint=models.UniqueConstraint(fields=("product", "currency"), name="unique_product_price_currency"),
        ),
        migrations.AddField(
            model_name="inventorytransaction",
            name="currency",
            field=models.CharField(choices=[("USD", "US Dollar (USD)"), ("LRD", "Liberian Dollar (LRD)")], default="USD", max_length=3),
        ),
        migrations.AddField(
            model_name="inventorytransaction",
            name="exchange_rate",
            field=models.DecimalField(decimal_places=6, default=Decimal("1.000000"), max_digits=18),
        ),
        migrations.AddField(
            model_name="inventorytransaction",
            name="functional_unit_cost",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=18),
        ),
        migrations.AddField(
            model_name="sale",
            name="currency",
            field=models.CharField(choices=[("USD", "US Dollar (USD)"), ("LRD", "Liberian Dollar (LRD)")], default="USD", max_length=3),
        ),
        migrations.AddField(
            model_name="sale",
            name="exchange_rate",
            field=models.DecimalField(decimal_places=6, default=Decimal("1.000000"), max_digits=18),
        ),
        migrations.AddField(
            model_name="pumpsale",
            name="currency",
            field=models.CharField(choices=[("USD", "US Dollar (USD)"), ("LRD", "Liberian Dollar (LRD)")], default="USD", max_length=3),
        ),
        migrations.AddField(
            model_name="pumpsale",
            name="exchange_rate",
            field=models.DecimalField(decimal_places=6, default=Decimal("1.000000"), max_digits=18),
        ),
        migrations.RunPython(seed_product_prices, migrations.RunPython.noop),
    ]
