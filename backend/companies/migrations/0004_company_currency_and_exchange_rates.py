from django.db import migrations, models
from django.db.models import Q
import django.db.models.deletion
from django.conf import settings
import django.core.validators


def create_default_company_currencies(apps, schema_editor):
    Company = apps.get_model("companies", "Company")
    CompanyCurrency = apps.get_model("companies", "CompanyCurrency")

    for company in Company.objects.all().iterator():
        CompanyCurrency.objects.get_or_create(
            company_id=company.pk,
            currency=company.currency,
            defaults={
                "is_default": True,
                "is_active": True,
            },
        )


def remove_seeded_company_currencies(apps, schema_editor):
    CompanyCurrency = apps.get_model("companies", "CompanyCurrency")
    CompanyCurrency.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("companies", "0003_alter_company_currency"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CompanyCurrency",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "currency",
                    models.CharField(
                        choices=[
                            ("USD", "US Dollar (USD)"),
                            ("LRD", "Liberian Dollar (LRD)"),
                        ],
                        max_length=3,
                    ),
                ),
                (
                    "is_default",
                    models.BooleanField(default=False),
                ),
                (
                    "is_active",
                    models.BooleanField(default=True),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True),
                ),
                (
                    "company",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="enabled_currencies",
                        to="companies.company",
                    ),
                ),
            ],
            options={
                "ordering": ["-is_default", "currency"],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("company", "currency"),
                        name="unique_company_enabled_currency",
                    ),
                    models.UniqueConstraint(
                        condition=Q(is_default=True),
                        fields=("company",),
                        name="unique_default_company_currency",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="CompanyExchangeRate",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "from_currency",
                    models.CharField(
                        choices=[
                            ("USD", "US Dollar (USD)"),
                            ("LRD", "Liberian Dollar (LRD)"),
                        ],
                        max_length=3,
                    ),
                ),
                (
                    "to_currency",
                    models.CharField(
                        choices=[
                            ("USD", "US Dollar (USD)"),
                            ("LRD", "Liberian Dollar (LRD)"),
                        ],
                        max_length=3,
                    ),
                ),
                (
                    "rate",
                    models.DecimalField(
                        decimal_places=6,
                        max_digits=18,
                        validators=[
                            django.core.validators.MinValueValidator(
                                0.000001
                            )
                        ],
                    ),
                ),
                (
                    "effective_date",
                    models.DateField(),
                ),
                (
                    "is_active",
                    models.BooleanField(default=True),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True),
                ),
                (
                    "company",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="exchange_rates",
                        to="companies.company",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="created_company_exchange_rates",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-effective_date", "-id"],
                "constraints": [
                    models.UniqueConstraint(
                        fields=(
                            "company",
                            "from_currency",
                            "to_currency",
                            "effective_date",
                        ),
                        name="unique_company_exchange_rate_date",
                    ),
                ],
            },
        ),
        migrations.RunPython(
            create_default_company_currencies,
            remove_seeded_company_currencies,
        ),
    ]
