from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction

from .models import (
    Employee,
    PayrollAbsence,
    PayrollDeduction,
    PayrollEarning,
    PayrollPeriod,
    PayrollRecord,
    PayrollRecordDeduction,
    PayrollRecordEarning,
    PayrollDeductionType,
    PayrollTaxBand,
)


MONEY = Decimal("0.01")


def money(value):
    """
    Normalize a monetary value to two decimal places.
    """
    return Decimal(str(value)).quantize(
        MONEY,
        rounding=ROUND_HALF_UP,
    )


class PayrollService:
    """
    Central payroll processing engine.

    Hindsfeet payroll rules:

    - Payroll is processed monthly.
    - Employee basic_salary represents monthly basic salary.
    - Only ACTIVE MONTHLY employees are included.
    - Fixed earnings/deductions use their configured amount.
    - Percentage earnings/deductions are calculated against
      monthly basic salary.
    - Unpaid absence reduces gross pay.
    - PAYE is calculated automatically from taxable income.
    - Employee NASSCORP is calculated automatically from gross pay.
    - Employer NASSCORP is calculated automatically from gross pay.
    - Payroll records are snapshots of the final calculation.

    IMPORTANT ACCOUNTING RULE:

    Absence is already included in gross_pay:

        gross_pay =
            basic_salary
            + total_earnings
            - absence_deduction

    Therefore absence must NOT be deducted a second time from
    gross_pay when calculating net_pay.

    Net pay is:

        gross_pay
        - PAYE
        - employee NASSCORP
        - manual deductions

    This ensures:

        gross_pay =
            net_pay
            + PAYE
            + employee NASSCORP
            + manual deductions
    """

    @staticmethod
    def validate_period(payroll_period):
        """
        Validate that a payroll period is suitable for processing.
        """

        if payroll_period.end_date < payroll_period.start_date:
            raise ValueError(
                "Payroll end date cannot be earlier than "
                "the payroll start date."
            )

        if payroll_period.pay_date < payroll_period.start_date:
            raise ValueError(
                "Pay date cannot be earlier than "
                "the payroll start date."
            )

        if payroll_period.status == PayrollPeriod.Status.PROCESSING:
            raise ValueError(
                "This payroll period is already being processed."
            )

        if payroll_period.status == PayrollPeriod.Status.PROCESSED:
            raise ValueError(
                "This payroll period has already been processed. "
                "Return it to draft before processing it again."
            )

        if payroll_period.status == PayrollPeriod.Status.APPROVED:
            raise ValueError(
                "This payroll period has already been approved "
                "and cannot be processed again."
            )

        if payroll_period.status == PayrollPeriod.Status.LOCKED:
            raise ValueError(
                "This payroll period is locked and cannot "
                "be processed again."
            )

    @staticmethod
    def _eligible_employees(*, payroll_period):
        """
        Return employees eligible for the monthly payroll run.

        Eligibility rules:

        1. Employee belongs to the payroll company.
        2. Employee is ACTIVE.
        3. Employee pay frequency is MONTHLY.
        4. Employee was employed on or before the end of
           the payroll period.
        5. Employee has not terminated before the payroll
           period started.

        Mid-month employment is not prorated in this version.
        """

        employees = Employee.objects.filter(
            company=payroll_period.company,
            employment_status=Employee.EmploymentStatus.ACTIVE,
            pay_frequency=Employee.PayFrequency.MONTHLY,
        ).order_by(
            "first_name",
            "last_name",
            "id",
        )

        eligible = []

        for employee in employees:

            if (
                employee.date_employed
                and employee.date_employed
                > payroll_period.end_date
            ):
                continue

            if (
                employee.date_terminated
                and employee.date_terminated
                < payroll_period.start_date
            ):
                continue

            eligible.append(employee)

        return eligible

    @staticmethod
    def _calculate_line_amount(
        *,
        amount,
        calculation_type,
        base_amount,
    ):
        """
        Calculate a fixed or percentage payroll line.

        FIXED:
            amount is the actual monetary amount.

        PERCENTAGE:
            amount represents a percentage against monthly
            basic salary.
        """

        amount = Decimal(str(amount))
        base_amount = Decimal(str(base_amount))

        if amount < Decimal("0.00"):
            raise ValueError(
                "Payroll earning or deduction amount "
                "cannot be negative."
            )

        if calculation_type == "PERCENTAGE":
            return money(
                base_amount
                * amount
                / Decimal("100")
            )

        return money(amount)

    @staticmethod
    def _validate_payroll_configuration(*, payroll_period):
        """
        Validate period-level payroll configuration.
        """

        exchange_rate = Decimal(
            str(payroll_period.exchange_rate)
        )

        working_days = Decimal(
            str(payroll_period.working_days)
        )

        employee_rate = Decimal(
            str(
                payroll_period.social_security_employee_rate
            )
        )

        employer_rate = Decimal(
            str(
                payroll_period.social_security_employer_rate
            )
        )

        if exchange_rate <= Decimal("0.00"):
            raise ValueError(
                "Payroll exchange rate must be greater than zero."
            )

        if working_days <= Decimal("0.00"):
            raise ValueError(
                "Payroll working days must be greater than zero."
            )

        if (
            employee_rate < Decimal("0.00")
            or employee_rate > Decimal("100.00")
        ):
            raise ValueError(
                "Employee social security rate must be "
                "between 0 and 100%."
            )

        if (
            employer_rate < Decimal("0.00")
            or employer_rate > Decimal("100.00")
        ):
            raise ValueError(
                "Employer social security rate must be "
                "between 0 and 100%."
            )

        company_currency = str(
            payroll_period.company.currency or ""
        ).upper().strip()

        if company_currency not in {"USD", "LRD"}:
            raise ValueError(
                "Company currency must be USD or LRD "
                "for payroll processing."
            )

        if (
            company_currency == "LRD"
            and exchange_rate != Decimal("1.000000")
        ):
            raise ValueError(
                "The exchange rate must be 1.000000 "
                "when the company currency is LRD."
            )

        return {
            "exchange_rate": exchange_rate,
            "working_days": working_days,
            "employee_rate": employee_rate,
            "employer_rate": employer_rate,
            "company_currency": company_currency,
        }

    @staticmethod
    def calculate_social_security(
        *,
        gross_pay,
        employee_rate,
        employer_rate,
    ):
        """
        Calculate employee and employer NASSCORP contributions.

        Employee:
            gross pay × employee rate

        Employer:
            gross pay × employer rate
        """

        gross_pay = money(gross_pay)

        employee_rate = Decimal(
            str(employee_rate)
        )

        employer_rate = Decimal(
            str(employer_rate)
        )

        return {
            "employee": money(
                gross_pay
                * employee_rate
                / Decimal("100")
            ),
            "employer": money(
                gross_pay
                * employer_rate
                / Decimal("100")
            ),
        }

    @staticmethod
    def calculate_absence(
        *,
        basic_salary,
        days_absent,
        working_days,
    ):
        """
        Calculate unpaid absence deduction from monthly
        basic salary.
        """

        basic_salary = money(basic_salary)

        days_absent = Decimal(
            str(days_absent or "0.00")
        )

        working_days = Decimal(
            str(working_days)
        )

        if days_absent < Decimal("0.00"):
            raise ValueError(
                "Absent days cannot be negative."
            )

        if working_days <= Decimal("0.00"):
            raise ValueError(
                "Working days must be greater than zero."
            )

        if days_absent > working_days:
            raise ValueError(
                "Absent days cannot exceed working days."
            )

        return money(
            basic_salary
            * days_absent
            / working_days
        )

    @staticmethod
    def calculate_paye(
        *,
        company,
        monthly_taxable_income,
        exchange_rate=Decimal("1.000000"),
    ):
        """
        Calculate Liberia progressive PAYE from
        annualized monthly taxable income.

        PAYE bands are denominated in LRD.

        For USD payroll:

            USD taxable income
                × exchange rate
                = LRD taxable income

        The annual LRD taxable income is then processed
        through the configured tax bands.

        The resulting PAYE is converted back to the
        payroll currency.
        """

        monthly_taxable_income = money(
            monthly_taxable_income
        )

        exchange_rate = Decimal(
            str(exchange_rate)
        )

        if exchange_rate <= Decimal("0.00"):
            raise ValueError(
                "Payroll exchange rate must be greater than zero."
            )

        if monthly_taxable_income <= Decimal("0.00"):
            return {
                "monthly_taxable_income": Decimal("0.00"),
                "monthly_taxable_income_lrd": Decimal("0.00"),
                "annual_taxable_income": Decimal("0.00"),
                "annual_tax": Decimal("0.00"),
                "monthly_tax": Decimal("0.00"),
                "monthly_tax_in_payroll_currency": Decimal(
                    "0.00"
                ),
                "tax_band": None,
            }

        monthly_taxable_income_lrd = money(
            monthly_taxable_income
            * exchange_rate
        )

        annual_taxable_income = money(
            monthly_taxable_income_lrd
            * Decimal("12")
        )

        bands = list(
            PayrollTaxBand.objects.filter(
                company=company,
                is_active=True,
            ).order_by(
                "lower_limit",
                "id",
            )
        )

        if not bands:
            raise ValueError(
                f"No active payroll tax bands are configured "
                f"for {company.name}."
            )

        matching_band = None

        for band in bands:

            if (
                annual_taxable_income
                >= band.lower_limit
                and (
                    band.upper_limit is None
                    or annual_taxable_income
                    <= band.upper_limit
                )
            ):
                matching_band = band
                break

        if matching_band is None:
            raise ValueError(
                "No payroll tax band covers annual taxable "
                f"income of {annual_taxable_income}."
            )

        annual_tax = money(
            matching_band.fixed_tax
            + (
                max(
                    annual_taxable_income
                    - matching_band.lower_limit,
                    Decimal("0.00"),
                )
                * matching_band.rate
                / Decimal("100")
            )
        )

        monthly_tax = money(
            annual_tax
            / Decimal("12")
        )

        monthly_tax_in_payroll_currency = money(
            monthly_tax
            / exchange_rate
        )

        return {
            "monthly_taxable_income": monthly_taxable_income,
            "monthly_taxable_income_lrd": monthly_taxable_income_lrd,
            "annual_taxable_income": annual_taxable_income,
            "annual_tax": annual_tax,
            "monthly_tax": monthly_tax,
            "monthly_tax_in_payroll_currency": (
                monthly_tax_in_payroll_currency
            ),
            "tax_band": matching_band,
        }

    @staticmethod
    def _get_paye_type(*, company):
        """
        Return the company's automatic PAYE deduction type.
        """

        deduction_type, _ = (
            PayrollDeductionType.objects.get_or_create(
                company=company,
                code="PAYE",
                defaults={
                    "name": (
                        "Personal Income Tax (PAYE)"
                    ),
                    "calculation_type": (
                        PayrollDeductionType
                        .CalculationType
                        .FIXED
                    ),
                    "is_statutory": True,
                    "is_active": True,
                },
            )
        )

        return deduction_type

    @staticmethod
    def calculate_employee(
        *,
        payroll_period,
        employee,
    ):
        """
        Calculate the complete monthly payroll for one employee.

        Calculation order:

            Basic Salary
                +
            Earnings
                -
            Absence Deduction
                =
            Gross Pay

            Gross Pay
                -
            PAYE
                -
            Employee NASSCORP
                -
            Manual Deductions
                =
            Net Pay

        IMPORTANT:

        Absence is already included in gross_pay and therefore
        is NOT deducted again from gross_pay when calculating
        net_pay.
        """

        if employee.company_id != payroll_period.company_id:
            raise ValueError(
                "Employee does not belong to the payroll "
                "company."
            )

        if (
            employee.employment_status
            != Employee.EmploymentStatus.ACTIVE
        ):
            raise ValueError(
                f"Employee {employee.full_name} is not active."
            )

        if (
            employee.pay_frequency
            != Employee.PayFrequency.MONTHLY
        ):
            raise ValueError(
                f"Employee {employee.full_name} is not "
                "configured for monthly payroll."
            )

        if (
            employee.date_employed
            and employee.date_employed
            > payroll_period.end_date
        ):
            raise ValueError(
                f"Employee {employee.full_name} was not "
                "employed during this payroll period."
            )

        if (
            employee.date_terminated
            and employee.date_terminated
            < payroll_period.start_date
        ):
            raise ValueError(
                f"Employee {employee.full_name} was "
                "terminated before this payroll period."
            )

        config = (
            PayrollService
            ._validate_payroll_configuration(
                payroll_period=payroll_period
            )
        )

        basic_salary = money(
            employee.basic_salary
        )

        if basic_salary < Decimal("0.00"):
            raise ValueError(
                f"Employee {employee.full_name} has an "
                "invalid negative basic salary."
            )

        # =========================================================
        # EARNINGS
        # =========================================================

        earnings = (
            PayrollEarning.objects.filter(
                payroll_period=payroll_period,
                employee=employee,
            )
            .select_related("earning_type")
            .order_by("id")
        )

        earning_lines = []
        total_earnings = Decimal("0.00")

        for earning in earnings:

            if (
                earning.earning_type.company_id
                != payroll_period.company_id
            ):
                raise ValueError(
                    f"Earning type for {employee.full_name} "
                    "does not belong to the payroll company."
                )

            if not earning.earning_type.is_active:
                raise ValueError(
                    f"Earning type "
                    f"{earning.earning_type.name} "
                    "is inactive."
                )

            calculated_amount = (
                PayrollService
                ._calculate_line_amount(
                    amount=earning.amount,
                    calculation_type=(
                        earning
                        .earning_type
                        .calculation_type
                    ),
                    base_amount=basic_salary,
                )
            )

            earning_lines.append(
                {
                    "earning_type": (
                        earning.earning_type
                    ),
                    "description": earning.description,
                    "amount": calculated_amount,
                    "is_taxable": earning.is_taxable,
                }
            )

            total_earnings += calculated_amount

        total_earnings = money(
            total_earnings
        )

        # =========================================================
        # ABSENCE
        # =========================================================

        absence = (
            PayrollAbsence.objects.filter(
                payroll_period=payroll_period,
                employee=employee,
            )
            .first()
        )

        absent_days = (
            Decimal(
                str(absence.days_absent)
            )
            if absence is not None
            else Decimal("0.00")
        )

        absence_deduction = (
            PayrollService.calculate_absence(
                basic_salary=basic_salary,
                days_absent=absent_days,
                working_days=config["working_days"],
            )
        )

        # =========================================================
        # GROSS PAY
        # =========================================================

        gross_pay = money(
            basic_salary
            + total_earnings
            - absence_deduction
        )

        if gross_pay < Decimal("0.00"):
            raise ValueError(
                f"Employee {employee.full_name} has "
                "absence deductions greater than gross earnings."
            )

        # =========================================================
        # TAXABLE INCOME
        # =========================================================

        taxable_income = Decimal("0.00")

        if employee.is_taxable:

            # Basic salary is reduced by unpaid absence.
            taxable_income = (
                basic_salary
                - absence_deduction
            )

            # Taxable earnings are added.
            for earning_line in earning_lines:

                if earning_line["is_taxable"]:
                    taxable_income += (
                        earning_line["amount"]
                    )

        taxable_income = money(
            max(
                taxable_income,
                Decimal("0.00"),
            )
        )

        # =========================================================
        # PAYE
        # =========================================================

        paye = PayrollService.calculate_paye(
            company=payroll_period.company,
            monthly_taxable_income=taxable_income,
            exchange_rate=config["exchange_rate"],
        )

        paye_amount = paye[
            "monthly_tax_in_payroll_currency"
        ]

        # =========================================================
        # NASSCORP
        # =========================================================

        social_security = (
            PayrollService
            .calculate_social_security(
                gross_pay=gross_pay,
                employee_rate=config["employee_rate"],
                employer_rate=config["employer_rate"],
            )
        )

        # =========================================================
        # DEDUCTION SNAPSHOT LINES
        # =========================================================

        deductions = (
            PayrollDeduction.objects.filter(
                payroll_period=payroll_period,
                employee=employee,
            )
            .select_related("deduction_type")
            .order_by("id")
        )

        deduction_lines = []

        # Keep absence visible in the payroll snapshot.
        #
        # IMPORTANT:
        # This is informational here because absence has already
        # reduced gross_pay. It must not be subtracted again from
        # gross_pay when calculating net_pay.
        if absence_deduction > Decimal("0.00"):

            absence_type, _ = (
                PayrollDeductionType.objects.get_or_create(
                    company=payroll_period.company,
                    code="ABSENCE",
                    defaults={
                        "name": "Absence from Work",
                        "calculation_type": (
                            PayrollDeductionType
                            .CalculationType
                            .FIXED
                        ),
                        "is_statutory": False,
                        "is_active": True,
                    },
                )
            )

            deduction_lines.append(
                {
                    "deduction_type": absence_type,
                    "description": (
                        "Automatic absence deduction: "
                        f"{absent_days} day(s)"
                    ),
                    "amount": absence_deduction,
                    "is_automatic": True,
                    "affects_net_pay": False,
                }
            )

        # =========================================================
        # AUTOMATIC NASSCORP
        # =========================================================

        social_security_type, _ = (
            PayrollDeductionType.objects.get_or_create(
                company=payroll_period.company,
                code="NASSCORP",
                defaults={
                    "name": (
                        "NASSCORP Employee Social Security"
                    ),
                    "calculation_type": (
                        PayrollDeductionType
                        .CalculationType
                        .FIXED
                    ),
                    "is_statutory": True,
                    "is_active": True,
                },
            )
        )

        if (
            social_security["employee"]
            > Decimal("0.00")
        ):

            deduction_lines.append(
                {
                    "deduction_type": (
                        social_security_type
                    ),
                    "description": (
                        "Automatic NASSCORP employee "
                        "contribution "
                        f"({config['employee_rate']}%)"
                    ),
                    "amount": (
                        social_security["employee"]
                    ),
                    "is_automatic": True,
                    "affects_net_pay": True,
                }
            )

        # =========================================================
        # AUTOMATIC PAYE
        # =========================================================

        if paye_amount > Decimal("0.00"):

            paye_type = (
                PayrollService._get_paye_type(
                    company=payroll_period.company,
                )
            )

            deduction_lines.append(
                {
                    "deduction_type": paye_type,
                    "description": (
                        f"Automatic PAYE for "
                        f"{payroll_period.name}"
                    ),
                    "amount": paye_amount,
                    "is_automatic": True,
                    "affects_net_pay": True,
                }
            )

        # =========================================================
        # MANUAL DEDUCTIONS
        # =========================================================

        manual_deductions_total = Decimal(
            "0.00"
        )

        for deduction in deductions:

            if (
                deduction.deduction_type.company_id
                != payroll_period.company_id
            ):
                raise ValueError(
                    f"Deduction type for "
                    f"{employee.full_name} does not belong "
                    "to the payroll company."
                )

            if not deduction.deduction_type.is_active:
                raise ValueError(
                    f"Deduction type "
                    f"{deduction.deduction_type.name} "
                    "is inactive."
                )

            # Prevent manually configured statutory
            # automatic deductions from being duplicated.
            deduction_code = str(
                deduction.deduction_type.code or ""
            ).upper().strip()

            if deduction_code in {
                "PAYE",
                "NASSCORP",
                "ABSENCE",
            }:
                raise ValueError(
                    f"{deduction.deduction_type.name} "
                    "is an automatic payroll deduction and "
                    "cannot be manually added to payroll."
                )

            calculated_amount = (
                PayrollService
                ._calculate_line_amount(
                    amount=deduction.amount,
                    calculation_type=(
                        deduction
                        .deduction_type
                        .calculation_type
                    ),
                    base_amount=basic_salary,
                )
            )

            deduction_lines.append(
                {
                    "deduction_type": (
                        deduction.deduction_type
                    ),
                    "description": deduction.description,
                    "amount": calculated_amount,
                    "is_automatic": False,
                    "affects_net_pay": True,
                }
            )

            manual_deductions_total += (
                calculated_amount
            )

        manual_deductions_total = money(
            manual_deductions_total
        )

        # =========================================================
        # TOTAL DEDUCTIONS
        # =========================================================
        #
        # This total represents deductions that are taken FROM
        # gross pay to arrive at net pay.
        #
        # Absence is deliberately excluded here because it has
        # already been applied when calculating gross_pay.
        #
        # Therefore:
        #
        # total_deductions =
        #     PAYE
        #     + employee NASSCORP
        #     + manual deductions
        #
        # Absence remains separately recorded as
        # absence_deduction.
        # =========================================================

        total_deductions = money(
            paye_amount
            + social_security["employee"]
            + manual_deductions_total
        )

        # =========================================================
        # NET PAY
        # =========================================================

        net_pay = money(
            gross_pay
            - total_deductions
        )

        if net_pay < Decimal("0.00"):
            raise ValueError(
                f"Employee {employee.full_name} has "
                "deductions greater than gross pay."
            )

        # =========================================================
        # EMPLOYER COST
        # =========================================================

        employer_cost = money(
            gross_pay
            + social_security["employer"]
        )

        # =========================================================
        # FINAL ACCOUNTING BALANCE CHECK
        # =========================================================
        #
        # This is an internal payroll-engine check.
        #
        # Gross pay must equal:
        #
        #     Net pay
        #     + PAYE
        #     + Employee NASSCORP
        #     + Manual deductions
        #
        # If this fails, processing must stop rather than
        # creating an unbalanced payroll record.
        # =========================================================

        accounting_check = money(
            net_pay
            + paye_amount
            + social_security["employee"]
            + manual_deductions_total
        )

        if accounting_check != gross_pay:
            raise ValueError(
                f"Payroll calculation does not balance for "
                f"{employee.full_name}. "
                f"Gross pay is {gross_pay}, but "
                f"net pay + PAYE + employee NASSCORP + "
                f"manual deductions equals "
                f"{accounting_check}."
            )

        return {
            "basic_salary": basic_salary,
            "total_earnings": total_earnings,
            "gross_pay": gross_pay,

            "absent_days": absent_days,
            "absence_deduction": absence_deduction,

            "taxable_income": taxable_income,
            "annual_taxable_income": (
                paye["annual_taxable_income"]
            ),

            "paye_tax": paye_amount,

            "social_security_employee": (
                social_security["employee"]
            ),
            "social_security_employer": (
                social_security["employer"]
            ),

            "exchange_rate": config["exchange_rate"],

            "manual_deductions": (
                manual_deductions_total
            ),

            "total_deductions": total_deductions,

            "net_pay": net_pay,

            "employer_cost": employer_cost,

            "earning_lines": earning_lines,
            "deduction_lines": deduction_lines,
        }

    @staticmethod
    @transaction.atomic
    def process_employee(
        *,
        payroll_period,
        employee,
    ):
        """
        Create the finalized payroll record for one employee.

        This method uses calculate_employee() as the single
        source of payroll calculation truth.
        """

        calculation = (
            PayrollService.calculate_employee(
                payroll_period=payroll_period,
                employee=employee,
            )
        )

        PayrollRecord.objects.filter(
            payroll_period=payroll_period,
            employee=employee,
        ).delete()

        record = PayrollRecord.objects.create(
            payroll_period=payroll_period,
            employee=employee,

            basic_salary=calculation[
                "basic_salary"
            ],

            total_earnings=calculation[
                "total_earnings"
            ],

            gross_pay=calculation[
                "gross_pay"
            ],

            absent_days=calculation[
                "absent_days"
            ],

            absence_deduction=calculation[
                "absence_deduction"
            ],

            taxable_income=calculation[
                "taxable_income"
            ],

            annual_taxable_income=calculation[
                "annual_taxable_income"
            ],

            paye_tax=calculation[
                "paye_tax"
            ],

            social_security_employee=calculation[
                "social_security_employee"
            ],

            social_security_employer=calculation[
                "social_security_employer"
            ],

            exchange_rate=calculation[
                "exchange_rate"
            ],

            total_deductions=calculation[
                "total_deductions"
            ],

            net_pay=calculation[
                "net_pay"
            ],

            employer_cost=calculation[
                "employer_cost"
            ],
        )

        # =========================================================
        # SNAPSHOT EARNINGS
        # =========================================================

        for earning in calculation[
            "earning_lines"
        ]:

            PayrollRecordEarning.objects.create(
                payroll_record=record,
                earning_type=earning[
                    "earning_type"
                ],
                description=earning[
                    "description"
                ],
                amount=earning[
                    "amount"
                ],
                is_taxable=earning[
                    "is_taxable"
                ],
            )

        # =========================================================
        # SNAPSHOT DEDUCTIONS
        # =========================================================

        for deduction in calculation[
            "deduction_lines"
        ]:

            PayrollRecordDeduction.objects.create(
                payroll_record=record,
                deduction_type=deduction[
                    "deduction_type"
                ],
                description=deduction[
                    "description"
                ],
                amount=deduction[
                    "amount"
                ],
            )

        return record

    @staticmethod
    @transaction.atomic
    def process_payroll(
        *,
        payroll_period,
        employees=None,
    ):
        """
        Process the complete monthly payroll.

        Workflow:

            DRAFT
              ↓
            PROCESSING
              ↓
            PROCESSED

        If anything fails, the transaction is rolled back
        and the period returns to DRAFT.
        """

        PayrollService.validate_period(
            payroll_period
        )

        if payroll_period.company_id is None:
            raise ValueError(
                "Payroll period must belong to a company."
            )

        if employees is None:

            employees = (
                PayrollService
                ._eligible_employees(
                    payroll_period=payroll_period
                )
            )

        else:
            employees = list(employees)

        if not employees:
            raise ValueError(
                "There are no active monthly employees "
                "available for this payroll period."
            )

        # =========================================================
        # VALIDATE EMPLOYEES
        # =========================================================

        for employee in employees:

            if (
                employee.company_id
                != payroll_period.company_id
            ):
                raise ValueError(
                    f"Employee {employee.full_name} "
                    "does not belong to the payroll company."
                )

            if (
                employee.employment_status
                != Employee.EmploymentStatus.ACTIVE
            ):
                raise ValueError(
                    f"Employee {employee.full_name} "
                    "is not active."
                )

            if (
                employee.pay_frequency
                != Employee.PayFrequency.MONTHLY
            ):
                raise ValueError(
                    f"Employee {employee.full_name} "
                    "is not configured for monthly payroll."
                )

        # =========================================================
        # PROCESSING STATUS
        # =========================================================

        payroll_period.status = (
            PayrollPeriod.Status.PROCESSING
        )

        payroll_period.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        records = []

        try:

            for employee in employees:

                record = (
                    PayrollService.process_employee(
                        payroll_period=payroll_period,
                        employee=employee,
                    )
                )

                records.append(record)

            if not records:
                raise ValueError(
                    "Payroll processing did not produce "
                    "any payroll records."
                )

            payroll_period.status = (
                PayrollPeriod.Status.PROCESSED
            )

            payroll_period.save(
                update_fields=[
                    "status",
                    "updated_at",
                ]
            )

        except Exception:

            payroll_period.status = (
                PayrollPeriod.Status.DRAFT
            )

            payroll_period.save(
                update_fields=[
                    "status",
                    "updated_at",
                ]
            )

            raise

        return records

    @staticmethod
    def payroll_summary(*, payroll_period):
        """
        Return summarized payroll totals for a period.

        Absence is reported separately because it reduces gross
        pay rather than being deducted a second time from gross
        pay.
        """

        records = PayrollRecord.objects.filter(
            payroll_period=payroll_period,
        )

        total_basic = Decimal("0.00")
        total_earnings = Decimal("0.00")
        total_absence = Decimal("0.00")
        total_gross = Decimal("0.00")
        total_taxable = Decimal("0.00")
        total_paye = Decimal("0.00")
        total_employee_nasscorp = Decimal("0.00")
        total_employer_nasscorp = Decimal("0.00")
        total_deductions = Decimal("0.00")
        total_net = Decimal("0.00")
        total_employer_cost = Decimal("0.00")

        for record in records:

            total_basic += (
                record.basic_salary
            )

            total_earnings += (
                record.total_earnings
            )

            total_absence += (
                record.absence_deduction
            )

            total_gross += (
                record.gross_pay
            )

            total_taxable += (
                record.taxable_income
            )

            total_paye += (
                record.paye_tax
            )

            total_employee_nasscorp += (
                record.social_security_employee
            )

            total_employer_nasscorp += (
                record.social_security_employer
            )

            total_deductions += (
                record.total_deductions
            )

            total_net += (
                record.net_pay
            )

            total_employer_cost += (
                record.employer_cost
            )

        return {
            "employee_count": records.count(),

            "total_basic_salary": money(
                total_basic
            ),

            "total_earnings": money(
                total_earnings
            ),

            "total_absence_deduction": money(
                total_absence
            ),

            "total_gross_pay": money(
                total_gross
            ),

            "total_taxable_income": money(
                total_taxable
            ),

            "total_paye": money(
                total_paye
            ),

            "total_employee_nasscorp": money(
                total_employee_nasscorp
            ),

            "total_employer_nasscorp": money(
                total_employer_nasscorp
            ),

            "total_deductions": money(
                total_deductions
            ),

            "total_net_pay": money(
                total_net
            ),

            "total_employer_cost": money(
                total_employer_cost
            ),
        }