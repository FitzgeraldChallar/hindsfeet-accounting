from decimal import Decimal

from django.db import transaction

from accounting.models import Account
from accounting.services import AccountingService

from .models import BankAccount, BankTransaction


class BankingService:
    """
    Central service for company-specific banking operations.

    Every physical bank account is linked to its own dedicated
    accounting Asset account.

    Banking transactions are always tied to a BankAccount, and
    every financial banking movement creates a corresponding
    double-entry accounting journal entry.

    Company isolation is enforced throughout the service.
    """

    # ============================================================
    # HELPERS
    # ============================================================

    @staticmethod
    def _decimal(value):
        return Decimal(str(value or "0.00"))

    @staticmethod
    def _validate_bank_account(
        *,
        bank_account,
        company,
    ):
        if not bank_account:
            raise ValueError(
                "Bank account is required."
            )

        if bank_account.company_id != company.id:
            raise ValueError(
                "Bank account does not belong "
                "to the selected company."
            )

        if not bank_account.is_active:
            raise ValueError(
                "The selected bank account is inactive."
            )

        if not bank_account.accounting_account:
            raise ValueError(
                "The bank account is not linked "
                "to an accounting account."
            )

        if (
            bank_account.accounting_account.company_id
            != company.id
        ):
            raise ValueError(
                "Bank account's accounting account "
                "does not belong to the selected company."
            )

        if not bank_account.accounting_account.is_active:
            raise ValueError(
                "The bank account's accounting account "
                "is inactive."
            )

        if (
            bank_account.accounting_account.account_type
            != Account.AccountType.ASSET
        ):
            raise ValueError(
                "The accounting account linked to a bank "
                "account must be an Asset account."
            )

    @staticmethod
    def _validate_counter_account(
        *,
        counter_account,
        company,
    ):
        if not counter_account:
            raise ValueError(
                "A counter account is required."
            )

        if counter_account.company_id != company.id:
            raise ValueError(
                "Counter account does not belong "
                "to the selected company."
            )

        if not counter_account.is_active:
            raise ValueError(
                "The counter account is inactive."
            )

    @staticmethod
    def _next_bank_account_code(*, company):
        """
        Generate the next available accounting code for a
        company-specific bank account.
        """

        existing_codes = (
            Account.objects.filter(
                company=company,
                code__startswith="10",
            )
            .values_list("code", flat=True)
        )

        numeric_codes = []

        for code in existing_codes:
            try:
                numeric_code = int(code)

                if 1000 <= numeric_code < 1100:
                    numeric_codes.append(numeric_code)

            except (TypeError, ValueError):
                continue

        next_code = max(
            numeric_codes,
            default=1010,
        ) + 1

        while Account.objects.filter(
            company=company,
            code=str(next_code),
        ).exists():
            next_code += 1

        return str(next_code)

    @staticmethod
    @transaction.atomic
    def create_accounting_account(
        *,
        company,
        bank_name,
        account_name,
    ):
        """
        Create a dedicated Asset accounting account for a
        physical bank account.
        """

        code = BankingService._next_bank_account_code(
            company=company,
        )

        name = (
            f"{bank_name} - {account_name}"
        )

        return Account.objects.create(
            company=company,
            code=code,
            name=name,
            account_type=Account.AccountType.ASSET,
            cash_flow_category=(
                Account.CashFlowCategory.NONE
            ),
            description=(
                f"Dedicated accounting ledger for "
                f"{bank_name} bank account "
                f"({account_name})."
            ),
            parent=None,
            is_active=True,
            is_system_account=False,
        )

    # ============================================================
    # CREATE STANDARD BANK TRANSACTION
    # ============================================================

    @staticmethod
    @transaction.atomic
    def create_transaction(
        *,
        company,
        bank_account,
        transaction_type,
        amount,
        transaction_date,
        created_by,
        counter_account,
        reference="",
        description="",
        adjustment_direction=None,
    ):
        """
        Create a banking transaction and its corresponding
        posted accounting journal entry.

        Standard transaction mapping:

        DEPOSIT
            DR Bank
            CR Counter Account

        WITHDRAWAL
            DR Counter Account
            CR Bank

        BANK_FEE
            DR Expense/Counter Account
            CR Bank

        INTEREST
            DR Bank
            CR Revenue/Counter Account

        ADJUSTMENT
            INCREASE:
                DR Bank
                CR Counter Account

            DECREASE:
                DR Counter Account
                CR Bank

        The supplied bank account must already be linked to
        its dedicated accounting Asset account.
        """

        BankingService._validate_bank_account(
            bank_account=bank_account,
            company=company,
        )

        BankingService._validate_counter_account(
            counter_account=counter_account,
            company=company,
        )

        amount = BankingService._decimal(amount)

        if amount <= Decimal("0.00"):
            raise ValueError(
                "Transaction amount must be "
                "greater than zero."
            )

        if not transaction_date:
            raise ValueError(
                "Transaction date is required."
            )

        valid_types = {
            BankTransaction.TransactionType.DEPOSIT,
            BankTransaction.TransactionType.WITHDRAWAL,
            BankTransaction.TransactionType.BANK_FEE,
            BankTransaction.TransactionType.INTEREST,
            BankTransaction.TransactionType.ADJUSTMENT,
        }

        if transaction_type not in valid_types:
            raise ValueError(
                "Invalid banking transaction type."
            )

        # --------------------------------------------------------
        # Adjustment validation
        # --------------------------------------------------------

        if (
            transaction_type
            == BankTransaction.TransactionType.ADJUSTMENT
        ):
            if adjustment_direction not in [
                "INCREASE",
                "DECREASE",
            ]:
                raise ValueError(
                    "Adjustment direction must be "
                    "either INCREASE or DECREASE."
                )

        bank_accounting_account = (
            bank_account.accounting_account
        )

        # --------------------------------------------------------
        # Journal direction
        # --------------------------------------------------------

        bank_increases = (
            transaction_type in [
                BankTransaction.TransactionType.DEPOSIT,
                BankTransaction.TransactionType.INTEREST,
            ]
            or (
                transaction_type
                == BankTransaction.TransactionType.ADJUSTMENT
                and adjustment_direction == "INCREASE"
            )
        )

        if bank_increases:
            journal_lines = [
                {
                    "account": bank_accounting_account,
                    "description": description,
                    "debit": amount,
                    "credit": Decimal("0.00"),
                },
                {
                    "account": counter_account,
                    "description": description,
                    "debit": Decimal("0.00"),
                    "credit": amount,
                },
            ]

        else:
            journal_lines = [
                {
                    "account": counter_account,
                    "description": description,
                    "debit": amount,
                    "credit": Decimal("0.00"),
                },
                {
                    "account": bank_accounting_account,
                    "description": description,
                    "debit": Decimal("0.00"),
                    "credit": amount,
                },
            ]

        # --------------------------------------------------------
        # Journal reference
        # --------------------------------------------------------

        journal_reference = (
            reference.strip()
            if reference
            else (
                f"BANK-"
                f"{bank_account.id}-"
                f"{transaction_date}"
            )
        )

        journal_description = (
            description.strip()
            if description
            else (
                f"{transaction_type} - "
                f"{bank_account.bank_name} - "
                f"{bank_account.account_name}"
            )
        )

        # --------------------------------------------------------
        # Create and immediately post journal
        # --------------------------------------------------------

        journal_entry = (
            AccountingService.create_journal_entry(
                company=company,
                reference=journal_reference,
                description=journal_description,
                transaction_date=transaction_date,
                created_by=created_by,
                lines=journal_lines,
                post=True,
            )
        )

        # --------------------------------------------------------
        # Create banking transaction
        # --------------------------------------------------------

        bank_transaction = (
            BankTransaction.objects.create(
                company=company,
                bank_account=bank_account,
                transaction_type=transaction_type,
                amount=amount,
                transaction_date=transaction_date,
                reference=reference.strip(),
                description=description.strip(),
                journal_entry=journal_entry,
                created_by=created_by,
            )
        )

        return bank_transaction

    # ============================================================
    # TRANSFER BETWEEN BANK ACCOUNTS
    # ============================================================

    @staticmethod
    @transaction.atomic
    def transfer(
        *,
        company,
        source_account,
        destination_account,
        amount,
        transaction_date,
        created_by,
        reference="",
        description="",
    ):
        """
        Transfer money between two bank accounts belonging
        to the same company.

        Transfers are currently supported only between accounts
        with the same currency.

        Accounting:

            DR Destination Bank Account
            CR Source Bank Account
        """

        BankingService._validate_bank_account(
            bank_account=source_account,
            company=company,
        )

        BankingService._validate_bank_account(
            bank_account=destination_account,
            company=company,
        )

        if source_account.id == destination_account.id:
            raise ValueError(
                "Source and destination bank accounts "
                "must be different."
            )

        amount = BankingService._decimal(amount)

        if amount <= Decimal("0.00"):
            raise ValueError(
                "Transfer amount must be "
                "greater than zero."
            )

        if not transaction_date:
            raise ValueError(
                "Transaction date is required."
            )

        if (
            source_account.currency
            != destination_account.currency
        ):
            raise ValueError(
                "Transfers between bank accounts with "
                "different currencies are not supported."
            )

        source_accounting_account = (
            source_account.accounting_account
        )

        destination_accounting_account = (
            destination_account.accounting_account
        )

        journal_reference = (
            reference.strip()
            if reference
            else (
                f"TRANSFER-"
                f"{source_account.id}-"
                f"{destination_account.id}-"
                f"{transaction_date}"
            )
        )

        journal_description = (
            description.strip()
            if description
            else (
                f"Transfer from "
                f"{source_account.account_name} "
                f"to "
                f"{destination_account.account_name}"
            )
        )

        journal_lines = [
            {
                "account": destination_accounting_account,
                "description": journal_description,
                "debit": amount,
                "credit": Decimal("0.00"),
            },
            {
                "account": source_accounting_account,
                "description": journal_description,
                "debit": Decimal("0.00"),
                "credit": amount,
            },
        ]

        journal_entry = (
            AccountingService.create_journal_entry(
                company=company,
                reference=journal_reference,
                description=journal_description,
                transaction_date=transaction_date,
                created_by=created_by,
                lines=journal_lines,
                post=True,
            )
        )

        transfer_out = (
            BankTransaction.objects.create(
                company=company,
                bank_account=source_account,
                transaction_type=(
                    BankTransaction
                    .TransactionType
                    .TRANSFER_OUT
                ),
                amount=amount,
                transaction_date=transaction_date,
                reference=reference.strip(),
                description=(
                    description.strip()
                    or (
                        f"Transfer to "
                        f"{destination_account.account_name}"
                    )
                ),
                journal_entry=journal_entry,
                created_by=created_by,
            )
        )

        transfer_in = (
            BankTransaction.objects.create(
                company=company,
                bank_account=destination_account,
                transaction_type=(
                    BankTransaction
                    .TransactionType
                    .TRANSFER_IN
                ),
                amount=amount,
                transaction_date=transaction_date,
                reference=reference.strip(),
                description=(
                    description.strip()
                    or (
                        f"Transfer from "
                        f"{source_account.account_name}"
                    )
                ),
                journal_entry=journal_entry,
                created_by=created_by,
            )
        )

        return {
            "journal_entry": journal_entry,
            "transfer_out": transfer_out,
            "transfer_in": transfer_in,
        }

    # ============================================================
    # BANK ACCOUNT BALANCE
    # ============================================================

    @staticmethod
    def get_balance(
        *,
        bank_account,
    ):
        """
        Calculate the current balance of one physical bank
        account.

        The balance consists of:

            Opening Balance
            + Posted Ledger Movement
        """

        BankingService._validate_bank_account(
            bank_account=bank_account,
            company=bank_account.company,
        )

        ledger = AccountingService.general_ledger(
            company=bank_account.company,
            account=bank_account.accounting_account,
        )

        if not ledger:
            return bank_account.opening_balance

        account_data = ledger[0]

        return (
            bank_account.opening_balance
            + account_data["closing_balance"]
        )

    # ============================================================
    # BANK ACCOUNT SUMMARY
    # ============================================================

    @staticmethod
    def account_summary(
        *,
        bank_account,
    ):
        """
        Return a practical summary for one bank account.
        """

        balance = BankingService.get_balance(
            bank_account=bank_account,
        )

        return {
            "id": bank_account.id,
            "company": bank_account.company_id,
            "bank_name": bank_account.bank_name,
            "account_name": bank_account.account_name,
            "account_number": bank_account.account_number,
            "account_type": bank_account.account_type,
            "currency": bank_account.currency,
            "opening_balance": (
                bank_account.opening_balance
            ),
            "balance": balance,
            "is_active": bank_account.is_active,
            "accounting_account": (
                bank_account.accounting_account_id
            ),
            "accounting_account_code": (
                bank_account.accounting_account.code
            ),
            "accounting_account_name": (
                bank_account.accounting_account.name
            ),
        }