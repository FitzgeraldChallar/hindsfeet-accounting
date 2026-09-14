from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from companies.models import Company


class Employee(models.Model):
    """
    Employee/payroll profile belonging to exactly one company.

    Payroll is company-independent, so this model can be used by
    every company in the Hindsfeet Investment system.
    """

    class EmploymentStatus(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"
        TERMINATED = "TERMINATED", "Terminated"

    class PayFrequency(models.TextChoices):
        MONTHLY = "MONTHLY", "Monthly"
        BI_WEEKLY = "BI_WEEKLY", "Bi-weekly"
        WEEKLY = "WEEKLY", "Weekly"
        DAILY = "DAILY", "Daily"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="employees",
    )

    employee_number = models.CharField(
        max_length=50,
    )

    first_name = models.CharField(
        max_length=100,
    )

    middle_name = models.CharField(
        max_length=100,
        blank=True,
    )

    last_name = models.CharField(
        max_length=100,
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
    )

    email = models.EmailField(
        blank=True,
    )

    address = models.TextField(
        blank=True,
    )

    department = models.CharField(
        max_length=100,
        blank=True,
    )

    position = models.CharField(
        max_length=150,
        blank=True,
    )

    employment_status = models.CharField(
        max_length=20,
        choices=EmploymentStatus.choices,
        default=EmploymentStatus.ACTIVE,
    )

    date_employed = models.DateField(
        null=True,
        blank=True,
    )

    date_terminated = models.DateField(
        null=True,
        blank=True,
    )

    pay_frequency = models.CharField(
        max_length=20,
        choices=PayFrequency.choices,
        default=PayFrequency.MONTHLY,
    )

    basic_salary = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    is_taxable = models.BooleanField(
        default=True,
    )

    notes = models.TextField(
        blank=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="employees_created",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "first_name",
            "last_name",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "company",
                    "employee_number",
                ],
                name="unique_employee_number_per_company",
            ),
        ]

    @property
    def full_name(self):
        parts = [
            self.first_name,
            self.middle_name,
            self.last_name,
        ]

        return " ".join(
            part.strip()
            for part in parts
            if part and part.strip()
        )

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.date_terminated and self.date_employed:
            if self.date_terminated < self.date_employed:
                raise ValidationError(
                    "Termination date cannot be earlier "
                    "than employment date."
                )

        if (
            self.employment_status == self.EmploymentStatus.TERMINATED
            and not self.date_terminated
        ):
            raise ValidationError(
                "A terminated employee must have "
                "a termination date."
            )

    def __str__(self):
        return (
            f"{self.employee_number} - "
            f"{self.full_name}"
        )

class PayrollPeriod(models.Model):
    """
    Defines a payroll processing period for a company.

    A payroll period represents one payroll run, such as:
    January 2026 Monthly Payroll.
    """

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PROCESSING = "PROCESSING", "Processing"
        PROCESSED = "PROCESSED", "Processed"
        APPROVED = "APPROVED", "Approved"
        LOCKED = "LOCKED", "Locked"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="payroll_periods",
    )

    name = models.CharField(
        max_length=150,
    )

    start_date = models.DateField()

    end_date = models.DateField()

    pay_date = models.DateField()

    # Payroll calculation configuration captured for this payroll run.
    # exchange_rate means: 1 unit of the company's payroll currency =
    # X units of LRD for statutory PAYE conversion.
    exchange_rate = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        default=Decimal("1.000000"),
        validators=[
            MinValueValidator(Decimal("0.000001")),
        ],
    )

    working_days = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal("22.00"),
        validators=[
            MinValueValidator(Decimal("1.00")),
        ],
    )

    social_security_employee_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("4.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    social_security_employer_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("6.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    notes = models.TextField(
        blank=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="payroll_periods_created",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "-start_date",
            "-id",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "company",
                    "start_date",
                    "end_date",
                ],
                name="unique_payroll_period_per_company",
            ),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.end_date < self.start_date:
            raise ValidationError(
                "Payroll end date cannot be earlier "
                "than the start date."
            )

        if self.pay_date < self.start_date:
            raise ValidationError(
                "Pay date cannot be earlier than "
                "the payroll start date."
            )

    def __str__(self):
        return (
            f"{self.company.name} - "
            f"{self.name}"
        )

class PayrollEarningType(models.Model):
    """
    Defines an earning/allowance that can be used in payroll.

    Examples:
    - Basic Salary
    - Housing Allowance
    - Transport Allowance
    - Meal Allowance
    - Overtime
    - Bonus
    """

    class CalculationType(models.TextChoices):
        FIXED = "FIXED", "Fixed Amount"
        PERCENTAGE = "PERCENTAGE", "Percentage"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="payroll_earning_types",
    )

    name = models.CharField(
        max_length=100,
    )

    code = models.CharField(
        max_length=50,
    )

    calculation_type = models.CharField(
        max_length=20,
        choices=CalculationType.choices,
        default=CalculationType.FIXED,
    )

    is_taxable = models.BooleanField(
        default=True,
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
        ordering = ["name"]

        constraints = [
            models.UniqueConstraint(
                fields=["company", "code"],
                name="unique_payroll_earning_code_per_company",
            ),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"


class PayrollEarning(models.Model):
    """
    An actual earning assigned to an employee for a
    specific payroll period.
    """

    payroll_period = models.ForeignKey(
        PayrollPeriod,
        on_delete=models.CASCADE,
        related_name="earnings",
    )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name="payroll_earnings",
    )

    earning_type = models.ForeignKey(
        PayrollEarningType,
        on_delete=models.PROTECT,
        related_name="payroll_earnings",
    )

    description = models.CharField(
        max_length=200,
        blank=True,
    )

    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    is_taxable = models.BooleanField(
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
            "employee__first_name",
            "employee__last_name",
            "earning_type__name",
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.payroll_period.company_id != self.employee.company_id:
            raise ValidationError(
                "Employee must belong to the same company "
                "as the payroll period."
            )

        if (
            self.earning_type.company_id
            != self.payroll_period.company_id
        ):
            raise ValidationError(
                "Earning type must belong to the same company "
                "as the payroll period."
            )

        if self.amount < Decimal("0.00"):
            raise ValidationError(
                "Earning amount cannot be negative."
            )

    def __str__(self):
        return (
            f"{self.employee.full_name} - "
            f"{self.earning_type.name} - "
            f"{self.amount}"
        )

class PayrollDeductionType(models.Model):
    """
    Defines a deduction that can be applied during payroll.

    Examples:
    - PAYE / Income Tax
    - Social Security
    - Loan Repayment
    - Salary Advance
    - Staff Welfare
    - Other Deduction
    """

    class CalculationType(models.TextChoices):
        FIXED = "FIXED", "Fixed Amount"
        PERCENTAGE = "PERCENTAGE", "Percentage"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="payroll_deduction_types",
    )

    name = models.CharField(
        max_length=100,
    )

    code = models.CharField(
        max_length=50,
    )

    calculation_type = models.CharField(
        max_length=20,
        choices=CalculationType.choices,
        default=CalculationType.FIXED,
    )

    is_statutory = models.BooleanField(
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
        ordering = ["name"]

        constraints = [
            models.UniqueConstraint(
                fields=["company", "code"],
                name="unique_payroll_deduction_code_per_company",
            ),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"


class PayrollDeduction(models.Model):
    """
    An actual deduction assigned to an employee for
    a specific payroll period.
    """

    payroll_period = models.ForeignKey(
        PayrollPeriod,
        on_delete=models.CASCADE,
        related_name="deductions",
    )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name="payroll_deductions",
    )

    deduction_type = models.ForeignKey(
        PayrollDeductionType,
        on_delete=models.PROTECT,
        related_name="payroll_deductions",
    )

    description = models.CharField(
        max_length=200,
        blank=True,
    )

    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "employee__first_name",
            "employee__last_name",
            "deduction_type__name",
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if (
            self.payroll_period.company_id
            != self.employee.company_id
        ):
            raise ValidationError(
                "Employee must belong to the same company "
                "as the payroll period."
            )

        if (
            self.deduction_type.company_id
            != self.payroll_period.company_id
        ):
            raise ValidationError(
                "Deduction type must belong to the same company "
                "as the payroll period."
            )

        if self.amount < Decimal("0.00"):
            raise ValidationError(
                "Deduction amount cannot be negative."
            )

    def __str__(self):
        return (
            f"{self.employee.full_name} - "
            f"{self.deduction_type.name} - "
            f"{self.amount}"
        )


class PayrollTaxBand(models.Model):
    """
    Progressive personal income tax band used by payroll.

    Limits are annual taxable-income thresholds in Liberian dollars.
    ``upper_limit`` is NULL for the final/open-ended band.
    ``fixed_tax`` is the tax accumulated before the band starts.
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="payroll_tax_bands",
    )

    name = models.CharField(max_length=100)

    lower_limit = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    upper_limit = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    rate = models.DecimalField(
        max_digits=7,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Tax rate as a percentage, e.g. 15.00 for 15%.",
    )

    fixed_tax = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Tax accumulated before this band.",
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["lower_limit", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "lower_limit"],
                name="unique_payroll_tax_band_lower_limit_per_company",
            ),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.upper_limit is not None and self.upper_limit <= self.lower_limit:
            raise ValidationError(
                "Tax band upper limit must be greater than its lower limit."
            )

        if self.rate > Decimal("100.00"):
            raise ValidationError("Tax rate cannot exceed 100%.")

    def __str__(self):
        return f"{self.company.name} - {self.name}"


class PayrollAbsence(models.Model):
    """
    Unpaid absence recorded for one employee in one payroll period.

    The payroll engine converts the configured number of absent days into
    an automatic salary deduction using the payroll period's working_days.
    """

    payroll_period = models.ForeignKey(
        PayrollPeriod,
        on_delete=models.CASCADE,
        related_name="absences",
    )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name="payroll_absences",
    )

    days_absent = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    reason = models.CharField(
        max_length=200,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee__first_name", "employee__last_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["payroll_period", "employee"],
                name="unique_payroll_absence_per_employee_period",
            ),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.payroll_period.company_id != self.employee.company_id:
            raise ValidationError(
                "Employee must belong to the same company as the payroll period."
            )

        if self.days_absent < Decimal("0.00"):
            raise ValidationError("Absent days cannot be negative.")

        if self.days_absent > self.payroll_period.working_days:
            raise ValidationError(
                "Absent days cannot exceed the payroll period's working days."
            )

    def __str__(self):
        return (
            f"{self.payroll_period.name} - "
            f"{self.employee.full_name} - {self.days_absent} days"
        )


class PayrollRecord(models.Model):
    """
    Final calculated payroll result for one employee
    within one payroll period.

    Once a payroll period is approved/locked, these values
    preserve the exact payroll calculation that was performed.
    """

    payroll_period = models.ForeignKey(
        PayrollPeriod,
        on_delete=models.CASCADE,
        related_name="records",
    )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name="payroll_records",
    )

    basic_salary = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    total_earnings = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    gross_pay = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    taxable_income = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    annual_taxable_income = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    paye_tax = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    absent_days = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    absence_deduction = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    taxable_income = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    annual_taxable_income = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    paye_tax = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    social_security_employee = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    social_security_employer = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    exchange_rate = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        default=Decimal("1.000000"),
        validators=[
            MinValueValidator(Decimal("0.000001")),
        ],
    )

    total_deductions = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    net_pay = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    employer_cost = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "employee__first_name",
            "employee__last_name",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "payroll_period",
                    "employee",
                ],
                name="unique_payroll_record_per_employee_period",
            ),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if (
            self.payroll_period.company_id
            != self.employee.company_id
        ):
            raise ValidationError(
                "Employee must belong to the same company "
                "as the payroll period."
            )

        expected_gross = (
            self.basic_salary
            + self.total_earnings
            - self.absence_deduction
        )

        if self.gross_pay != expected_gross:
            raise ValidationError(
                "Gross pay must equal basic salary plus earnings "
                "less absence deduction."
            )

        calculated_net = (
            self.gross_pay - self.total_deductions
        )

        if calculated_net != self.net_pay:
            raise ValidationError(
                "Net pay must equal gross pay minus "
                "total deductions."
            )

    def __str__(self):
        return (
            f"{self.payroll_period.name} - "
            f"{self.employee.full_name} - "
            f"{self.net_pay}"
        )


class PayrollRecordEarning(models.Model):
    """
    Snapshot of each earning included in a finalized
    employee payroll record.
    """

    payroll_record = models.ForeignKey(
        PayrollRecord,
        on_delete=models.CASCADE,
        related_name="earning_lines",
    )

    earning_type = models.ForeignKey(
        PayrollEarningType,
        on_delete=models.PROTECT,
        related_name="record_earning_lines",
    )

    description = models.CharField(
        max_length=200,
        blank=True,
    )

    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    is_taxable = models.BooleanField(
        default=True,
    )

    def __str__(self):
        return (
            f"{self.payroll_record.employee.full_name} - "
            f"{self.earning_type.name} - "
            f"{self.amount}"
        )


class PayrollRecordDeduction(models.Model):
    """
    Snapshot of each deduction included in a finalized
    employee payroll record.
    """

    payroll_record = models.ForeignKey(
        PayrollRecord,
        on_delete=models.CASCADE,
        related_name="deduction_lines",
    )

    deduction_type = models.ForeignKey(
        PayrollDeductionType,
        on_delete=models.PROTECT,
        related_name="record_deduction_lines",
    )

    description = models.CharField(
        max_length=200,
        blank=True,
    )

    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    def __str__(self):
        return (
            f"{self.payroll_record.employee.full_name} - "
            f"{self.deduction_type.name} - "
            f"{self.amount}"
        )
class PayrollRemittance(models.Model):
    """
    Records the settlement/remittance of payroll deductions.

    Examples:
    - Tax remittance
    - Social security remittance
    - Salary advance settlement
    - Other payroll liabilities
    """

    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"
        BANK = "BANK", "Bank"

    payroll_period = models.ForeignKey(
        PayrollPeriod,
        on_delete=models.PROTECT,
        related_name="remittances",
    )

    deduction_type = models.ForeignKey(
        PayrollDeductionType,
        on_delete=models.PROTECT,
        related_name="remittances",
    )

    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.01")),
        ],
    )

    remittance_date = models.DateField()

    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.BANK,
    )

    reference = models.CharField(
        max_length=100,
    )

    description = models.TextField(
        blank=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="payroll_remittances_created",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = [
            "-remittance_date",
            "-id",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "payroll_period",
                    "deduction_type",
                    "reference",
                ],
                name="unique_payroll_remittance_reference",
            ),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if (
            self.payroll_period.company_id
            != self.deduction_type.company_id
        ):
            raise ValidationError(
                "Deduction type must belong to the same "
                "company as the payroll period."
            )

        if self.amount <= Decimal("0.00"):
            raise ValidationError(
                "Remittance amount must be greater than zero."
            )

    def __str__(self):
        return (
            f"{self.payroll_period.name} - "
            f"{self.deduction_type.name} - "
            f"{self.amount}"
        )
    