from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class BankAccount(models.Model):
    """
    A bank account belonging to one specific company.

    Each BankAccount is linked to an Accounting Account so that
    banking activity can remain synchronized with the general ledger.
    """

    class AccountType(models.TextChoices):
        CHECKING = "CHECKING", "Checking"
        SAVINGS = "SAVINGS", "Savings"
        MOBILE_MONEY = "MOBILE_MONEY", "Mobile Money"
        OTHER = "OTHER", "Other"

    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="bank_accounts",
    )

    accounting_account = models.OneToOneField(
        "accounting.Account",
        on_delete=models.PROTECT,
        related_name="bank_account",
    )

    bank_name = models.CharField(
        max_length=255,
    )

    account_name = models.CharField(
        max_length=255,
    )

    account_number = models.CharField(
        max_length=100,
    )

    account_type = models.CharField(
        max_length=20,
        choices=AccountType.choices,
        default=AccountType.CHECKING,
    )

    currency = models.CharField(
        max_length=10,
        default="USD",
    )

    opening_balance = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    is_active = models.BooleanField(
        default=True,
    )

    notes = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "bank_name",
            "account_name",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "company",
                    "account_number",
                ],
                name="unique_bank_account_number_per_company",
            ),
        ]

    def __str__(self):
        return (
            f"{self.bank_name} - "
            f"{self.account_name} "
            f"({self.account_number})"
        )

    def clean(self):
        if self.accounting_account:
            if (
                self.accounting_account.company_id
                != self.company_id
            ):
                raise ValidationError(
                    "Accounting account must belong "
                    "to the same company."
                )

            if (
                self.accounting_account.account_type
                != "ASSET"
            ):
                raise ValidationError(
                    "A bank account must be linked "
                    "to an Asset accounting account."
                )

        if self.opening_balance < Decimal("0.00"):
            raise ValidationError(
                "Opening balance cannot be negative."
            )

        if self.currency not in [
            "USD",
            "LRD",
        ]:
            raise ValidationError(
                "Bank account currency must be "
                "either USD or LRD."
            )


class BankTransaction(models.Model):
    """
    Individual movement through a company's bank account.

    Banking transactions are company-specific and are linked to
    the bank account through which the movement occurred.
    """

    class TransactionType(models.TextChoices):
        DEPOSIT = "DEPOSIT", "Deposit"
        WITHDRAWAL = "WITHDRAWAL", "Withdrawal"
        TRANSFER_IN = "TRANSFER_IN", "Transfer In"
        TRANSFER_OUT = "TRANSFER_OUT", "Transfer Out"
        BANK_FEE = "BANK_FEE", "Bank Fee"
        INTEREST = "INTEREST", "Interest"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"

    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.PROTECT,
        related_name="bank_transactions",
    )

    bank_account = models.ForeignKey(
        BankAccount,
        on_delete=models.PROTECT,
        related_name="transactions",
    )

    transaction_type = models.CharField(
        max_length=20,
        choices=TransactionType.choices,
    )

    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    transaction_date = models.DateField()

    reference = models.CharField(
        max_length=100,
        blank=True,
    )

    description = models.TextField(
        blank=True,
    )

    journal_entry = models.ForeignKey(
        "accounting.JournalEntry",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="bank_transactions",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_bank_transactions",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = [
            "-transaction_date",
            "-id",
        ]

    def __str__(self):
        return (
            f"{self.bank_account.account_name} - "
            f"{self.transaction_type} - "
            f"{self.amount}"
        )

    def clean(self):
        if self.amount <= Decimal("0.00"):
            raise ValidationError(
                "Transaction amount must be "
                "greater than zero."
            )

        if self.bank_account_id:
            if (
                self.bank_account.company_id
                != self.company_id
            ):
                raise ValidationError(
                    "Bank account must belong "
                    "to the same company."
                )

        if self.journal_entry_id:
            if (
                self.journal_entry.company_id
                != self.company_id
            ):
                raise ValidationError(
                    "Journal entry must belong "
                    "to the same company."
                )