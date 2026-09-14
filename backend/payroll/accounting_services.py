from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction

from accounting.models import Account
from accounting.services import AccountingService

from .models import PayrollPeriod


MONEY = Decimal("0.01")


class PayrollAccountingService:
    """
    Connects finalized payroll to the accounting system.

    Payroll expense is recognized when payroll is posted.

    Accounting separates:
        - Employee net salary liability
        - PAYE tax liability
        - Employee NASSCORP liability
        - Employer NASSCORP liability

    Employer NASSCORP is part of the employer's payroll expense
    and therefore must also be recognized as a liability.

    Actual employee payment is handled separately.
    PAYE and NASSCORP remittances are handled separately.
    """

    SALARY_EXPENSE_CODE = "6000"

    PAYROLL_LIABILITY_CODE = "2300"
    PAYE_LIABILITY_CODE = "2300"
    NASSCORP_LIABILITY_CODE = "2300"

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
                f"Required payroll account {code} "
                f"does not exist or is inactive for "
                f"{company.name}."
            )

    @staticmethod
    def _money(value):
        return Decimal(
            str(value or "0.00")
        ).quantize(
            MONEY,
            rounding=ROUND_HALF_UP,
        )

    @staticmethod
    @transaction.atomic
    def post_payroll(
        *,
        payroll_period,
        posted_by,
    ):
        """
        Posts an approved payroll period to accounting.

        Accounting entry:

            DR Payroll / Salary Expense
                CR Employee Net Pay Liability
                CR PAYE Liability
                CR Employee NASSCORP Liability
                CR Employer NASSCORP Liability

        Employer NASSCORP is included in payroll expense.

        Therefore:

            Employer Cost
                = Gross Pay + Employer NASSCORP

        And:

            Employer Cost
                =
                Net Pay
                + PAYE
                + Employee NASSCORP
                + Employer NASSCORP

        The payroll period must already be APPROVED.

        Once successfully posted, the payroll period is
        locked to prevent changes and duplicate posting.
        """

        # =========================================================
        # STATUS VALIDATION
        # =========================================================

        if payroll_period.status != PayrollPeriod.Status.APPROVED:
            raise ValueError(
                "Only approved payroll can be posted "
                "to accounting."
            )

        # =========================================================
        # LOAD PAYROLL RECORDS
        # =========================================================

        records = list(
            payroll_period.records.select_related(
                "employee",
            )
        )

        if not records:
            raise ValueError(
                "Cannot post payroll without payroll records."
            )

        # =========================================================
        # PAYROLL TOTALS
        # =========================================================

        total_gross = PayrollAccountingService._money(
            sum(
                (
                    record.gross_pay
                    for record in records
                ),
                Decimal("0.00"),
            )
        )

        total_net_pay = PayrollAccountingService._money(
            sum(
                (
                    record.net_pay
                    for record in records
                ),
                Decimal("0.00"),
            )
        )

        total_paye = PayrollAccountingService._money(
            sum(
                (
                    record.paye_tax
                    for record in records
                ),
                Decimal("0.00"),
            )
        )

        total_employee_nasscorp = (
            PayrollAccountingService._money(
                sum(
                    (
                        record.social_security_employee
                        for record in records
                    ),
                    Decimal("0.00"),
                )
            )
        )

        total_employer_nasscorp = (
            PayrollAccountingService._money(
                sum(
                    (
                        record.social_security_employer
                        for record in records
                    ),
                    Decimal("0.00"),
                )
            )
        )

        # Employer cost includes the employer's NASSCORP
        # contribution in addition to gross payroll.
        total_employer_cost = (
            total_gross
            + total_employer_nasscorp
        )

        # =========================================================
        # BASIC VALIDATION
        # =========================================================

        if total_gross <= Decimal("0.00"):
            raise ValueError(
                "Payroll gross amount must be greater than zero."
            )

        if total_net_pay < Decimal("0.00"):
            raise ValueError(
                "Payroll net pay cannot be negative."
            )

        if total_paye < Decimal("0.00"):
            raise ValueError(
                "PAYE tax cannot be negative."
            )

        if total_employee_nasscorp < Decimal("0.00"):
            raise ValueError(
                "Employee NASSCORP contribution cannot be negative."
            )

        if total_employer_nasscorp < Decimal("0.00"):
            raise ValueError(
                "Employer NASSCORP contribution cannot be negative."
            )

        # =========================================================
        # VERIFY PAYROLL RECORD BALANCE
        # =========================================================
        #
        # Employer NASSCORP is NOT part of this particular
        # reconciliation because it is an employer expense,
        # not an employee deduction.
        #
        # Gross Pay must equal:
        #
        #     Net Pay
        #     + PAYE
        #     + Employee NASSCORP
        #
        # This confirms that the payroll records themselves
        # are internally balanced.
        # =========================================================

        liability_total = (
            total_net_pay
            + total_paye
            + total_employee_nasscorp
        )

        expected_liability = total_gross

        if liability_total != expected_liability:
            raise ValueError(
                "Payroll accounting totals do not balance. "
                f"Gross payroll is {expected_liability}, "
                f"but net pay + PAYE + employee NASSCORP "
                f"equals {liability_total}."
            )

        # =========================================================
        # VERIFY EMPLOYER COST
        # =========================================================

        expected_employer_cost = (
            total_gross
            + total_employer_nasscorp
        )

        if total_employer_cost != expected_employer_cost:
            raise ValueError(
                "Payroll employer cost does not balance. "
                f"Expected employer cost is "
                f"{expected_employer_cost}, "
                f"but calculated employer cost is "
                f"{total_employer_cost}."
            )

        # =========================================================
        # VERIFY FINAL JOURNAL BALANCE BEFORE POSTING
        # =========================================================
        #
        # The journal must satisfy:
        #
        #     Debit:
        #         Gross Pay + Employer NASSCORP
        #
        #     Credit:
        #         Net Pay
        #         + PAYE
        #         + Employee NASSCORP
        #         + Employer NASSCORP
        #
        # =========================================================

        expected_credit_total = PayrollAccountingService._money(
            total_net_pay
            + total_paye
            + total_employee_nasscorp
            + total_employer_nasscorp
        )

        if total_employer_cost != expected_credit_total:
            raise ValueError(
                "Payroll journal totals do not balance. "
                f"Debit is {total_employer_cost}, "
                f"while expected credits total "
                f"{expected_credit_total}."
            )

        # =========================================================
        # ACCOUNT LOOKUP
        # =========================================================

        salary_expense_account = (
            PayrollAccountingService._get_account(
                company=payroll_period.company,
                code=(
                    PayrollAccountingService
                    .SALARY_EXPENSE_CODE
                ),
            )
        )

        payroll_liability_account = (
            PayrollAccountingService._get_account(
                company=payroll_period.company,
                code=(
                    PayrollAccountingService
                    .PAYROLL_LIABILITY_CODE
                ),
            )
        )

        paye_liability_account = (
            PayrollAccountingService._get_account(
                company=payroll_period.company,
                code=(
                    PayrollAccountingService
                    .PAYE_LIABILITY_CODE
                ),
            )
        )

        nasscorp_liability_account = (
            PayrollAccountingService._get_account(
                company=payroll_period.company,
                code=(
                    PayrollAccountingService
                    .NASSCORP_LIABILITY_CODE
                ),
            )
        )

        # =========================================================
        # DUPLICATE POSTING PROTECTION
        # =========================================================

        reference = (
            f"PAYROLL-{payroll_period.id}"
        )

        existing_entry = (
            payroll_period.company.journal_entries.filter(
                reference=reference,
            ).first()
        )

        if existing_entry:
            raise ValueError(
                "This payroll has already been posted "
                "to accounting."
            )

        # =========================================================
        # JOURNAL LINES
        # =========================================================
        #
        # IMPORTANT:
        #
        # Employer NASSCORP MUST be credited separately.
        #
        # The salary expense debit includes:
        #
        #     Gross Pay
        #     + Employer NASSCORP
        #
        # The credits therefore include:
        #
        #     Net Pay
        #     + PAYE
        #     + Employee NASSCORP
        #     + Employer NASSCORP
        #
        # =========================================================

        journal_lines = [
            {
                "account": salary_expense_account,
                "description": (
                    f"Payroll expense including employer "
                    f"NASSCORP - {payroll_period.name}"
                ),
                "debit": total_employer_cost,
                "credit": Decimal("0.00"),
            },
            {
                "account": payroll_liability_account,
                "description": (
                    f"Employee net salary liability - "
                    f"{payroll_period.name}"
                ),
                "debit": Decimal("0.00"),
                "credit": total_net_pay,
            },
        ]

        # =========================================================
        # PAYE LIABILITY
        # =========================================================

        if total_paye > Decimal("0.00"):
            journal_lines.append(
                {
                    "account": paye_liability_account,
                    "description": (
                        f"PAYE tax liability - "
                        f"{payroll_period.name}"
                    ),
                    "debit": Decimal("0.00"),
                    "credit": total_paye,
                }
            )

        # =========================================================
        # EMPLOYEE NASSCORP LIABILITY
        # =========================================================

        if total_employee_nasscorp > Decimal("0.00"):
            journal_lines.append(
                {
                    "account": nasscorp_liability_account,
                    "description": (
                        f"Employee NASSCORP liability - "
                        f"{payroll_period.name}"
                    ),
                    "debit": Decimal("0.00"),
                    "credit": total_employee_nasscorp,
                }
            )

        # =========================================================
        # EMPLOYER NASSCORP LIABILITY
        # =========================================================
        #
        # THIS WAS THE MISSING JOURNAL LINE.
        #
        # The employer contribution increases the company's
        # payroll expense and simultaneously creates an amount
        # payable to NASSCORP.
        #
        # =========================================================

        if total_employer_nasscorp > Decimal("0.00"):
            journal_lines.append(
                {
                    "account": nasscorp_liability_account,
                    "description": (
                        f"Employer NASSCORP liability - "
                        f"{payroll_period.name}"
                    ),
                    "debit": Decimal("0.00"),
                    "credit": total_employer_nasscorp,
                }
            )

        # =========================================================
        # FINAL JOURNAL LINE BALANCE CHECK
        # =========================================================

        journal_debits = PayrollAccountingService._money(
            sum(
                (
                    line["debit"]
                    for line in journal_lines
                ),
                Decimal("0.00"),
            )
        )

        journal_credits = PayrollAccountingService._money(
            sum(
                (
                    line["credit"]
                    for line in journal_lines
                ),
                Decimal("0.00"),
            )
        )

        if journal_debits != journal_credits:
            raise ValueError(
                "Journal entry is not balanced. "
                f"Debit: {journal_debits}, "
                f"Credit: {journal_credits}."
            )

        # =========================================================
        # CREATE AND POST JOURNAL
        # =========================================================

        journal_entry = (
            AccountingService.create_journal_entry(
                company=payroll_period.company,
                reference=reference,
                description=(
                    f"Payroll accounting entry - "
                    f"{payroll_period.name}"
                ),
                transaction_date=payroll_period.pay_date,
                created_by=posted_by,
                lines=journal_lines,
                post=True,
            )
        )

        # =========================================================
        # LOCK PAYROLL
        # =========================================================
        #
        # Payroll is locked only after successful accounting
        # posting.
        # =========================================================

        payroll_period.status = (
            PayrollPeriod.Status.LOCKED
        )

        payroll_period.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        return journal_entry