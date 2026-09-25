from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q


class Company(models.Model):

    class BusinessType(models.TextChoices):
        HOLDING = "HOLDING", "Holding / Parent Company"
        RETAIL = "RETAIL", "Retail / Trading"
        GAS_STATION = "GAS_STATION", "Gas Station"
        PROFESSIONAL_SERVICES = "PROFESSIONAL_SERVICES", "Professional Services"
        HR_CONSULTING = "HR_CONSULTING", "HR / Consulting"
        HEALTHCARE = "HEALTHCARE", "Laboratory / Healthcare"
        OTHER = "OTHER", "Other"

    class Currency(models.TextChoices):
        USD = "USD", "US Dollar (USD)"
        LRD = "LRD", "Liberian Dollar (LRD)"

    name = models.CharField(
        max_length=255,
    )

    legal_name = models.CharField(
        max_length=255,
        blank=True,
    )

    business_type = models.CharField(
        max_length=40,
        choices=BusinessType.choices,
        default=BusinessType.OTHER,
    )

    registration_number = models.CharField(
        max_length=100,
        blank=True,
    )

    address = models.TextField(
        blank=True,
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
    )

    email = models.EmailField(
        blank=True,
    )

    logo = models.ImageField(
        upload_to="company_logos/",
        null=True,
        blank=True,
    )

    # Functional/base accounting currency.
    #
    # This is no longer intended to mean that the company can only
    # transact in this currency. CompanyCurrency controls the currencies
    # enabled for the company.
    currency = models.CharField(
        max_length=3,
        choices=Currency.choices,
        default=Currency.USD,
    )

    # Preferred workspace shown when the user opens the company.
    # This is deliberately separate from functional currency.
    default_workspace_currency = models.CharField(
        max_length=3,
        choices=Currency.choices,
        default=Currency.USD,
    )

    fiscal_year_start_month = models.PositiveSmallIntegerField(
        default=1,
    )

    is_active = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_companies",
        null=True,
        blank=True,
    )

    def __str__(self):
        return self.name


class CompanyCurrency(models.Model):
    """
    A currency/workspace enabled for one legal company.

    A company can have multiple enabled currencies while remaining
    one legal/business entity.

    Example:

        Hindsfeet Investments Liberia Ltd
            - USD workspace
            - LRD workspace

    CompanyCurrency is configuration only. Financial transaction models
    continue to own their transaction-specific currency and historical
    exchange-rate information where required.
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="enabled_currencies",
    )

    currency = models.CharField(
        max_length=3,
        choices=Company.Currency.choices,
    )

    is_default = models.BooleanField(
        default=False,
    )

    is_active = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "-is_default",
            "currency",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["company", "currency"],
                name="unique_company_enabled_currency",
            ),
            models.UniqueConstraint(
                fields=["company"],
                condition=Q(is_default=True),
                name="unique_default_company_currency",
            ),
        ]

    def __str__(self):
        return f"{self.company.name} - {self.currency}"

    def clean(self):
        if self.is_default and not self.is_active:
            raise ValidationError(
                "The default company currency must be active."
            )

        if self.company_id and self.is_default:
            existing = (
                CompanyCurrency.objects
                .filter(
                    company_id=self.company_id,
                    is_default=True,
                )
                .exclude(pk=self.pk)
            )

            if existing.exists():
                raise ValidationError(
                    "A company can have only one default currency."
                )


class CompanyExchangeRate(models.Model):
    """
    Historical exchange rate for a company.

    The rate means:

        1 unit of from_currency = X units of to_currency

    Example:

        USD -> LRD
        rate = 200.000000

        1 USD = 200 LRD

    Rates are historical records. New rates should be added for new
    effective dates rather than changing old rates used by transactions.
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="exchange_rates",
    )

    from_currency = models.CharField(
        max_length=3,
        choices=Company.Currency.choices,
    )

    to_currency = models.CharField(
        max_length=3,
        choices=Company.Currency.choices,
    )

    rate = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        validators=[
            MinValueValidator(Decimal("0.000001")),
        ],
    )

    effective_date = models.DateField()

    is_active = models.BooleanField(
        default=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_company_exchange_rates",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "-effective_date",
            "-id",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "company",
                    "from_currency",
                    "to_currency",
                    "effective_date",
                ],
                name="unique_company_exchange_rate_date",
            ),
        ]

    def __str__(self):
        return (
            f"{self.company.name}: "
            f"1 {self.from_currency} = "
            f"{self.rate} {self.to_currency} "
            f"({self.effective_date})"
        )

    def clean(self):
        if self.from_currency == self.to_currency:
            raise ValidationError(
                "From and to currencies must be different."
            )

        if self.rate is not None and self.rate <= Decimal("0"):
            raise ValidationError(
                "Exchange rate must be greater than zero."
            )

        if self.company_id:
            enabled = set(
                CompanyCurrency.objects.filter(
                    company_id=self.company_id,
                    is_active=True,
                ).values_list(
                    "currency",
                    flat=True,
                )
            )

            missing = {
                currency
                for currency in [
                    self.from_currency,
                    self.to_currency,
                ]
                if currency not in enabled
            }

            if missing:
                raise ValidationError(
                    "Both currencies must be enabled for the company "
                    "before an exchange rate can be created."
                )


class CompanyMembership(models.Model):

    class Role(models.TextChoices):
        OWNER = "OWNER", "Owner"
        ADMIN = "ADMIN", "Administrator"
        ACCOUNTANT = "ACCOUNTANT", "Accountant"
        MANAGER = "MANAGER", "Manager"
        PAYROLL_OFFICER = "PAYROLL_OFFICER", "Payroll Officer"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="company_memberships",
    )

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="memberships",
    )

    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.ACCOUNTANT,
    )

    is_active = models.BooleanField(
        default=True,
    )

    joined_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "company"],
                name="unique_user_company_membership",
            )
        ]

    def __str__(self):
        return f"{self.user} → {self.company} ({self.role})"
