from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Account(models.Model):
    class AccountType(models.TextChoices):
        ASSET = "ASSET", "Asset"
        LIABILITY = "LIABILITY", "Liability"
        EQUITY = "EQUITY", "Equity"
        REVENUE = "REVENUE", "Revenue"
        COGS = "COGS", "Cost of Goods Sold"
        EXPENSE = "EXPENSE", "Expense"

    class CashFlowCategory(models.TextChoices):
        OPERATING = "OPERATING", "Operating"
        INVESTING = "INVESTING", "Investing"
        FINANCING = "FINANCING", "Financing"
        NONE = "NONE", "Not Applicable"

    class Currency(models.TextChoices):
        USD = "USD", "US Dollar (USD)"
        LRD = "LRD", "Liberian Dollar (LRD)"

    company = models.ForeignKey(
        "companies.Company", on_delete=models.CASCADE, related_name="accounts"
    )
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=255)
    currency = models.CharField(
        max_length=3, choices=Currency.choices, default=Currency.USD
    )
    account_type = models.CharField(max_length=20, choices=AccountType.choices)
    cash_flow_category = models.CharField(
        max_length=20, choices=CashFlowCategory.choices, default=CashFlowCategory.NONE
    )
    description = models.TextField(blank=True)
    parent = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="subaccounts"
    )
    is_active = models.BooleanField(default=True)
    is_system_account = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["currency", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "currency", "code"],
                name="unique_account_currency_code_per_company",
            )
        ]

    def __str__(self):
        return f"{self.code} - {self.name} ({self.currency})"

    def clean(self):
        if self.parent:
            if self.parent.company_id != self.company_id:
                raise ValidationError("Parent account must belong to the same company.")
            if self.parent.currency != self.currency:
                raise ValidationError("Parent account must use the same currency.")
            if self.parent_id == self.id:
                raise ValidationError("An account cannot be its own parent.")


class JournalEntry(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        POSTED = "POSTED", "Posted"
        REVERSED = "REVERSED", "Reversed"

    company = models.ForeignKey(
        "companies.Company", on_delete=models.PROTECT, related_name="journal_entries"
    )
    reference = models.CharField(max_length=100)
    description = models.TextField()
    transaction_date = models.DateField()
    # Primary/source currency of the transaction. A journal may contain
    # more than one line currency for cross-currency settlements.
    currency = models.CharField(max_length=3, choices=Account.Currency.choices, default="USD")
    functional_currency = models.CharField(
        max_length=3, choices=Account.Currency.choices, default="USD"
    )
    exchange_rate = models.DecimalField(
        max_digits=18, decimal_places=6, default=Decimal("1.000000")
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_journal_entries"
    )
    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="posted_journal_entries", null=True, blank=True
    )
    posted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-transaction_date", "-id"]
        indexes = [
            models.Index(fields=["company", "currency", "transaction_date"]),
            models.Index(fields=["company", "functional_currency", "transaction_date"]),
        ]

    def __str__(self):
        return f"{self.reference} - {self.description}"

    @property
    def total_debit(self):
        return sum((line.debit for line in self.lines.all()), Decimal("0.00"))

    @property
    def total_credit(self):
        return sum((line.credit for line in self.lines.all()), Decimal("0.00"))

    @property
    def total_functional_debit(self):
        return sum((line.functional_debit for line in self.lines.all()), Decimal("0.00"))

    @property
    def total_functional_credit(self):
        return sum((line.functional_credit for line in self.lines.all()), Decimal("0.00"))

    @property
    def is_balanced(self):
        # A multi-currency journal is balanced in the functional ledger.
        return self.total_functional_debit == self.total_functional_credit


class JournalLine(models.Model):
    journal_entry = models.ForeignKey(
        JournalEntry, on_delete=models.CASCADE, related_name="lines"
    )
    account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name="journal_lines"
    )
    currency = models.CharField(max_length=3, choices=Account.Currency.choices, default="USD")
    exchange_rate = models.DecimalField(
        max_digits=18, decimal_places=6, default=Decimal("1.000000")
    )
    description = models.CharField(max_length=255, blank=True)
    debit = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"))
    credit = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"))
    functional_debit = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"))
    functional_credit = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"))
    # Synthetic balancing line used only to keep each currency sub-ledger
    # internally balanced for a cross-currency journal. Its functional
    # amounts remain zero because the economic entry is already represented
    # by the real transaction lines in functional currency.
    is_currency_clearing = models.BooleanField(default=False, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(fields=["account", "currency"]),
            models.Index(fields=["journal_entry", "currency"]),
        ]

    def __str__(self):
        return f"{self.journal_entry.reference} - {self.account.name}"

    def clean(self):
        if self.account.company_id != self.journal_entry.company_id:
            raise ValidationError("Account and journal entry must belong to the same company.")
        if self.account.currency != self.currency:
            raise ValidationError("Journal line currency must match the account currency.")
        for value, label in [(self.debit, "Debit"), (self.credit, "Credit")]:
            if value < Decimal("0.00"):
                raise ValidationError(f"{label} cannot be negative.")
        if self.debit > 0 and self.credit > 0:
            raise ValidationError("A journal line cannot contain both debit and credit.")
        if self.debit == 0 and self.credit == 0:
            raise ValidationError("A journal line must contain a debit or credit amount.")
