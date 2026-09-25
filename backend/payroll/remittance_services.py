from decimal import Decimal

from django.db import transaction

from companies.currency_service import CompanyCurrencyService

from accounting.models import Account
from accounting.services import AccountingService

from .models import (
    PayrollDeduction,
    PayrollRemittance,
)


class PayrollRemittanceService:
    """
    Handles settlement of payroll deduction liabilities.

    Accounting:

        DR Payroll Liabilities
        CR Cash / Bank
    """

    PAYROLL_LIABILITY_CODE = "2300"
    CASH_CODE = "1000"
    BANK_CODE = "1010"

    @staticmethod
    def _get_account(*, company, code, currency=None):
        try:
            return Account.objects.get(
                company=company,
                code=code,
                currency=currency or company.currency,
                is_active=True,
            )
        except Account.DoesNotExist:
            raise ValueError(
                f"Required account {code} does not exist "
                f"or is inactive for {company.name}."
            )

    @staticmethod
    @transaction.atomic
    def remit_deduction(
        *,
        payroll_period,
        deduction_type,
        amount,
        remittance_date,
        reference,
        created_by,
        payment_method="BANK",
        description="",
    ):
        """
        Remits a payroll deduction liability.

        The amount cannot exceed the outstanding amount for
        that deduction type within the payroll period.
        """

        amount = Decimal(str(amount))

        if amount <= Decimal("0.00"):
            raise ValueError(
                "Remittance amount must be greater than zero."
            )

        if deduction_type.company_id != payroll_period.company_id:
            raise ValueError(
                "Deduction type does not belong to the "
                "payroll company."
            )

        deductions = PayrollDeduction.objects.filter(
            payroll_period=payroll_period,
            deduction_type=deduction_type,
        )

        total_deducted = sum(
            (
                deduction.amount
                for deduction in deductions
            ),
            Decimal("0.00"),
        )

        existing_remittances = PayrollRemittance.objects.filter(
            payroll_period=payroll_period,
            deduction_type=deduction_type,
        )

        total_remitted = sum(
            (
                remittance.amount
                for remittance in existing_remittances
            ),
            Decimal("0.00"),
        )

        outstanding = (
            total_deducted - total_remitted
        ).quantize(
            Decimal("0.01")
        )

        if outstanding <= Decimal("0.00"):
            raise ValueError(
                "There is no outstanding liability for "
                "this deduction."
            )

        if amount > outstanding:
            raise ValueError(
                f"Remittance amount cannot exceed the "
                f"outstanding liability of {outstanding}."
            )

        company = payroll_period.company

        liability_account = (
            PayrollRemittanceService._get_account(
                company=company,
                currency=payroll_period.currency,
                code=PayrollRemittanceService.PAYROLL_LIABILITY_CODE,
            )
        )

        if payment_method == "CASH":
            payment_account = (
                PayrollRemittanceService._get_account(
                    company=company,
                    currency=payroll_period.currency,
                    code=PayrollRemittanceService.CASH_CODE,
                )
            )
        elif payment_method == "BANK":
            payment_account = (
                PayrollRemittanceService._get_account(
                    company=company,
                    currency=payroll_period.currency,
                    code=PayrollRemittanceService.BANK_CODE,
                )
            )
        else:
            raise ValueError(
                "Payment method must be either CASH or BANK."
            )

        existing_reference = PayrollRemittance.objects.filter(
            payroll_period=payroll_period,
            deduction_type=deduction_type,
            reference=reference,
        ).exists()

        if existing_reference:
            raise ValueError(
                "A remittance with this reference already exists."
            )

        remittance = PayrollRemittance.objects.create(
            payroll_period=payroll_period,
            deduction_type=deduction_type,
            amount=amount,
            remittance_date=remittance_date,
            payment_method=payment_method,
            reference=reference,
            description=description,
            created_by=created_by,
        )

        accounting_rate = CompanyCurrencyService.get_rate(
            company=company,
            from_currency=payroll_period.currency,
            to_currency=company.currency,
            effective_date=remittance_date,
            supplied_rate=None,
        )

        journal_entry = AccountingService.create_journal_entry(
            company=company,
            reference=f"REMIT-{reference}",
            description=(
                f"Payroll deduction remittance - "
                f"{deduction_type.name}"
            ),
            transaction_date=remittance_date,
            created_by=created_by,
            lines=[
                {
                    "account": liability_account,
                    "description": (
                        f"Settlement of {deduction_type.name}"
                    ),
                    "debit": amount,
                    "credit": Decimal("0.00"),
                    "currency": payroll_period.currency,
                    "exchange_rate": accounting_rate,
                },
                {
                    "account": payment_account,
                    "description": (
                        f"Remittance payment - "
                        f"{deduction_type.name}"
                    ),
                    "debit": Decimal("0.00"),
                    "credit": amount,
                    "currency": payroll_period.currency,
                    "exchange_rate": accounting_rate,
                },
            ],
            currency=payroll_period.currency,
            exchange_rate=accounting_rate,
            post=True,
        )

        return remittance, journal_entry
    