from decimal import Decimal, InvalidOperation

from rest_framework import serializers

from companies.currency_service import CompanyCurrencyService

from .models import (
    Employee,
    PayrollAbsence,
    PayrollDeduction,
    PayrollDeductionType,
    PayrollEarning,
    PayrollEarningType,
    PayrollPeriod,
    PayrollRecord,
    PayrollRecordDeduction,
    PayrollRecordEarning,
    PayrollRemittance,
    PayrollTaxBand,
)


class EmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "company",
            "employee_number",
            "first_name",
            "middle_name",
            "last_name",
            "full_name",
            "phone",
            "email",
            "address",
            "department",
            "position",
            "employment_status",
            "date_employed",
            "date_terminated",
            "pay_frequency",
            "currency",
            "basic_salary",
            "is_taxable",
            "notes",
            "created_by",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "full_name",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        company = attrs.get("company", getattr(self.instance, "company", None))
        currency = attrs.get("currency", getattr(self.instance, "currency", None))
        if company and currency:
            try:
                CompanyCurrencyService.validate_enabled_currency(
                    company=company,
                    currency=currency,
                )
            except ValueError as exc:
                raise serializers.ValidationError({"currency": str(exc)})
        return attrs


class PayrollPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollPeriod
        fields = [
            "id",
            "company",
            "name",
            "start_date",
            "end_date",
            "pay_date",
            "currency",

            # Payroll configuration
            "exchange_rate",
            "working_days",
            "social_security_employee_rate",
            "social_security_employer_rate",

            # Workflow
            "status",
            "notes",

            # Audit
            "created_by",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "status",
            "created_by",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        company = attrs.get("company", getattr(self.instance, "company", None))
        currency = attrs.get("currency", getattr(self.instance, "currency", None))
        exchange_rate = attrs.get(
            "exchange_rate",
            getattr(self.instance, "exchange_rate", None),
        )

        if company and currency:
            try:
                currency = CompanyCurrencyService.validate_enabled_currency(
                    company=company,
                    currency=currency,
                )
            except ValueError as exc:
                raise serializers.ValidationError({"currency": str(exc)})

            if currency == "LRD" and exchange_rate is not None and str(exchange_rate) != "1.000000":
                try:
                    if Decimal(str(exchange_rate)) != Decimal("1.000000"):
                        raise serializers.ValidationError({
                            "exchange_rate": "LRD payroll must use an exchange rate of 1.000000 (1 LRD = 1 LRD)."
                        })
                except (ValueError, TypeError, InvalidOperation):
                    raise serializers.ValidationError({"exchange_rate": "Enter a valid exchange rate."})

        return attrs


class PayrollTaxBandSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollTaxBand
        fields = [
            "id",
            "company",
            "name",
            "lower_limit",
            "upper_limit",
            "rate",
            "fixed_tax",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        lower_limit = attrs.get(
            "lower_limit",
            getattr(self.instance, "lower_limit", None),
        )

        upper_limit = attrs.get(
            "upper_limit",
            getattr(self.instance, "upper_limit", None),
        )

        rate = attrs.get(
            "rate",
            getattr(self.instance, "rate", None),
        )

        fixed_tax = attrs.get(
            "fixed_tax",
            getattr(self.instance, "fixed_tax", None),
        )

        if lower_limit is not None and lower_limit < 0:
            raise serializers.ValidationError(
                {
                    "lower_limit": (
                        "Lower limit cannot be negative."
                    )
                }
            )

        if (
            upper_limit is not None
            and lower_limit is not None
            and upper_limit <= lower_limit
        ):
            raise serializers.ValidationError(
                {
                    "upper_limit": (
                        "Upper limit must be greater than "
                        "the lower limit."
                    )
                }
            )

        if rate is not None and rate < 0:
            raise serializers.ValidationError(
                {
                    "rate": "Tax rate cannot be negative."
                }
            )

        if rate is not None and rate > 100:
            raise serializers.ValidationError(
                {
                    "rate": "Tax rate cannot exceed 100%."
                }
            )

        if fixed_tax is not None and fixed_tax < 0:
            raise serializers.ValidationError(
                {
                    "fixed_tax": (
                        "Fixed tax cannot be negative."
                    )
                }
            )

        return attrs


class PayrollEarningTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollEarningType
        fields = [
            "id",
            "company",
            "name",
            "code",
            "calculation_type",
            "is_taxable",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class PayrollEarningSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollEarning
        fields = [
            "id",
            "payroll_period",
            "employee",
            "earning_type",
            "description",
            "amount",
            "is_taxable",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class PayrollDeductionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollDeductionType
        fields = [
            "id",
            "company",
            "name",
            "code",
            "calculation_type",
            "is_statutory",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class PayrollDeductionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollDeduction
        fields = [
            "id",
            "payroll_period",
            "employee",
            "deduction_type",
            "description",
            "amount",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class PayrollAbsenceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source="employee.full_name",
        read_only=True,
    )

    employee_number = serializers.CharField(
        source="employee.employee_number",
        read_only=True,
    )

    class Meta:
        model = PayrollAbsence
        fields = [
            "id",
            "payroll_period",
            "employee",
            "employee_name",
            "employee_number",
            "days_absent",
            "reason",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "employee_name",
            "employee_number",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        payroll_period = attrs.get(
            "payroll_period",
            getattr(
                self.instance,
                "payroll_period",
                None,
            ),
        )

        employee = attrs.get(
            "employee",
            getattr(
                self.instance,
                "employee",
                None,
            ),
        )

        days_absent = attrs.get(
            "days_absent",
            getattr(
                self.instance,
                "days_absent",
                None,
            ),
        )

        if payroll_period and employee:
            if (
                payroll_period.company_id
                != employee.company_id
            ):
                raise serializers.ValidationError(
                    {
                        "employee": (
                            "Employee must belong to the "
                            "same company as the payroll "
                            "period."
                        )
                    }
                )

        if (
            payroll_period
            and days_absent is not None
            and days_absent > payroll_period.working_days
        ):
            raise serializers.ValidationError(
                {
                    "days_absent": (
                        "Absent days cannot exceed the "
                        "working days configured for "
                        "the payroll period."
                    )
                }
            )

        return attrs


class PayrollRecordEarningSerializer(
    serializers.ModelSerializer
):
    earning_type_name = serializers.CharField(
        source="earning_type.name",
        read_only=True,
    )

    earning_type_code = serializers.CharField(
        source="earning_type.code",
        read_only=True,
    )

    class Meta:
        model = PayrollRecordEarning
        fields = [
            "id",
            "payroll_record",
            "earning_type",
            "earning_type_name",
            "earning_type_code",
            "description",
            "amount",
            "is_taxable",
        ]

        read_only_fields = [
            "id",
            "earning_type_name",
            "earning_type_code",
        ]


class PayrollRecordDeductionSerializer(
    serializers.ModelSerializer
):
    deduction_type_name = serializers.CharField(
        source="deduction_type.name",
        read_only=True,
    )

    deduction_type_code = serializers.CharField(
        source="deduction_type.code",
        read_only=True,
    )

    class Meta:
        model = PayrollRecordDeduction
        fields = [
            "id",
            "payroll_record",
            "deduction_type",
            "deduction_type_name",
            "deduction_type_code",
            "description",
            "amount",
        ]

        read_only_fields = [
            "id",
            "deduction_type_name",
            "deduction_type_code",
        ]


class PayrollRecordSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source="employee.full_name",
        read_only=True,
    )

    employee_number = serializers.CharField(
        source="employee.employee_number",
        read_only=True,
    )

    earnings = PayrollRecordEarningSerializer(
        source="earning_lines",
        many=True,
        read_only=True,
    )

    deductions = PayrollRecordDeductionSerializer(
        source="deduction_lines",
        many=True,
        read_only=True,
    )

    class Meta:
        model = PayrollRecord
        fields = [
            "id",
            "payroll_period",
            "employee",
            "employee_name",
            "employee_number",
            "currency",

            # Salary
            "basic_salary",
            "total_earnings",
            "gross_pay",

            # Absence
            "absent_days",
            "absence_deduction",

            # Tax
            "taxable_income",
            "annual_taxable_income",
            "paye_tax",

            # Social security
            "social_security_employee",
            "social_security_employer",

            # Net payroll
            "total_deductions",
            "net_pay",
            "employer_cost",

            # Exchange-rate snapshot
            "exchange_rate",

            # Detailed lines
            "earnings",
            "deductions",

            # Audit
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "employee_name",
            "employee_number",
            "basic_salary",
            "total_earnings",
            "gross_pay",
            "absent_days",
            "absence_deduction",
            "taxable_income",
            "annual_taxable_income",
            "paye_tax",
            "social_security_employee",
            "social_security_employer",
            "total_deductions",
            "net_pay",
            "employer_cost",
            "exchange_rate",
            "earnings",
            "deductions",
            "created_at",
            "updated_at",
        ]


class PayrollRemittanceSerializer(
    serializers.ModelSerializer
):
    deduction_type_name = serializers.CharField(
        source="deduction_type.name",
        read_only=True,
    )

    deduction_type_code = serializers.CharField(
        source="deduction_type.code",
        read_only=True,
    )

    class Meta:
        model = PayrollRemittance
        fields = [
            "id",
            "payroll_period",
            "deduction_type",
            "deduction_type_name",
            "deduction_type_code",
            "amount",
            "remittance_date",
            "payment_method",
            "reference",
            "description",
            "created_by",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "deduction_type_name",
            "deduction_type_code",
            "created_by",
            "created_at",
        ]