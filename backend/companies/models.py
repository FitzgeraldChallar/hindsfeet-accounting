from django.conf import settings
from django.db import models


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

    currency = models.CharField(
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