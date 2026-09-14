from decimal import Decimal

from django.db import transaction

from accounting.models import Account
from accounting.services import AccountingService

from .models import PayrollPeriod


class PayrollPaymentService:
    """
    Handles actual payment of employee net salaries.

    Payroll expense is recognized when payroll is posted.

    This service records the subsequent settlement of the
    employee net-pay liability.

    PAYE and NASSCORP liabilities are NOT settled by this
    service. They are separate statutory liabilities and
    should be settled through the remittance workflow.
    """

    PAYROLL_LIABILITY_CODE = "2300"
    CASH_CODE = "1000"
    BANK_CODE = "1010"

    @staticmethod
    def _get_account(*, company, code):
        try:
            return Account.objects.get(
                company=company,
                code=code,
                is_active=True,
            )
        except Account.DoesNotExist:
            raise ValueError(
                f"Required payroll payment account {code} "
                f"does not exist or is inactive for "
                f"{company.name}."
            )

    @staticmethod
    @transaction.atomic
    def pay_payroll(
        *,
        payroll_period,
        paid_by,
        payment_method="BANK",
    ):
        """
        Records payment of employee net salaries.

        Accounting:

            DR Employee Payroll Liability
            CR Cash / Bank

        The payroll must already be LOCKED, meaning it has
        already been posted to accounting.

        This payment does not settle:
            - PAYE liability
            - Employee NASSCORP liability
            - Employer NASSCORP liability
        """

        if payroll_period.status != PayrollPeriod.Status.LOCKED:
            raise ValueError(
                "Only locked payroll can be paid."
            )

        records = list(
            payroll_period.records.all()
        )

        if not records:
            raise ValueError(
                "Cannot pay payroll without payroll records."
            )

        total_net_pay = sum(
            (
                record.net_pay
                for record in records
            ),
            Decimal("0.00"),
        )

        total_net_pay = total_net_pay.quantize(
            Decimal("0.01")
        )

        if total_net_pay <= Decimal("0.00"):
            raise ValueError(
                "Payroll net pay must be greater than zero."
            )

        payroll_liability_account = (
            PayrollPaymentService._get_account(
                company=payroll_period.company,
                code=PayrollPaymentService.PAYROLL_LIABILITY_CODE,
            )
        )

        if payment_method == "CASH":
            payment_account = (
                PayrollPaymentService._get_account(
                    company=payroll_period.company,
                    code=PayrollPaymentService.CASH_CODE,
                )
            )

        elif payment_method == "BANK":
            payment_account = (
                PayrollPaymentService._get_account(
                    company=payroll_period.company,
                    code=PayrollPaymentService.BANK_CODE,
                )
            )

        else:
            raise ValueError(
                "Payment method must be either CASH or BANK."
            )

        reference = (
            f"PAYROLL-PAY-{payroll_period.id}"
        )

        existing_entry = (
            payroll_period.company.journal_entries.filter(
                reference=reference,
            ).first()
        )

        if existing_entry:
            raise ValueError(
                "This payroll has already been paid."
            )

        journal_lines = [
            {
                "account": payroll_liability_account,
                "description": (
                    f"Settlement of employee net-pay "
                    f"liability - {payroll_period.name}"
                ),
                "debit": total_net_pay,
                "credit": Decimal("0.00"),
            },
            {
                "account": payment_account,
                "description": (
                    f"Payroll employee payment - "
                    f"{payroll_period.name}"
                ),
                "debit": Decimal("0.00"),
                "credit": total_net_pay,
            },
        ]

        journal_entry = (
            AccountingService.create_journal_entry(
                company=payroll_period.company,
                reference=reference,
                description=(
                    f"Payroll employee payment - "
                    f"{payroll_period.name}"
                ),
                transaction_date=payroll_period.pay_date,
                created_by=paid_by,
                lines=journal_lines,
                post=True,
            )
        )

        return journal_entry