from decimal import Decimal

from .models import PayrollPeriod, PayrollRecord


class PayrollReportService:
    """
    Generates structured payroll reports from finalized
    payroll records.

    This service does not modify payroll data.
    It only reads and organizes existing records.
    """

    @staticmethod
    def payroll_summary(
        *,
        payroll_period,
    ):
        """
        Returns the complete payroll summary for a period.
        """

        records = (
            PayrollRecord.objects
            .filter(
                payroll_period=payroll_period,
            )
            .select_related(
                "employee",
            )
            .prefetch_related(
                "earning_lines__earning_type",
                "deduction_lines__deduction_type",
            )
            .order_by(
                "employee__first_name",
                "employee__last_name",
            )
        )

        employees = []

        total_basic_salary = Decimal("0.00")
        total_earnings = Decimal("0.00")
        total_absence_deduction = Decimal("0.00")
        total_gross_pay = Decimal("0.00")
        total_taxable_income = Decimal("0.00")
        total_paye_tax = Decimal("0.00")
        total_social_security_employee = Decimal("0.00")
        total_social_security_employer = Decimal("0.00")
        total_deductions = Decimal("0.00")
        total_net_pay = Decimal("0.00")
        total_employer_cost = Decimal("0.00")

        for record in records:
            earnings = [
                {
                    "type": earning.earning_type.name,
                    "code": earning.earning_type.code,
                    "description": earning.description,
                    "amount": earning.amount,
                    "taxable": earning.is_taxable,
                }
                for earning in record.earning_lines.all()
            ]

            deductions = [
                {
                    "type": deduction.deduction_type.name,
                    "code": deduction.deduction_type.code,
                    "description": deduction.description,
                    "amount": deduction.amount,
                }
                for deduction in record.deduction_lines.all()
            ]

            employees.append({
                "employee_id": record.employee_id,
                "employee_number": record.employee.employee_number,
                "employee_name": record.employee.full_name,
                "department": record.employee.department,
                "position": record.employee.position,

                "basic_salary": record.basic_salary,

                "absent_days": record.absent_days,
                "absence_deduction": record.absence_deduction,

                "earnings": earnings,
                "total_earnings": record.total_earnings,

                "gross_pay": record.gross_pay,

                "taxable_income": record.taxable_income,
                "annual_taxable_income": (
                    record.annual_taxable_income
                ),

                "paye_tax": record.paye_tax,

                "social_security_employee": (
                    record.social_security_employee
                ),
                "social_security_employer": (
                    record.social_security_employer
                ),

                "deductions": deductions,
                "total_deductions": record.total_deductions,

                "net_pay": record.net_pay,
                "employer_cost": record.employer_cost,

                "exchange_rate": record.exchange_rate,
            })

            total_basic_salary += record.basic_salary
            total_earnings += record.total_earnings
            total_absence_deduction += record.absence_deduction
            total_gross_pay += record.gross_pay
            total_taxable_income += record.taxable_income
            total_paye_tax += record.paye_tax
            total_social_security_employee += (
                record.social_security_employee
            )
            total_social_security_employer += (
                record.social_security_employer
            )
            total_deductions += record.total_deductions
            total_net_pay += record.net_pay
            total_employer_cost += record.employer_cost

        return {
            "company": payroll_period.company_id,
            "company_name": payroll_period.company.name,

            "payroll_period": payroll_period.id,
            "period_name": payroll_period.name,

            "start_date": payroll_period.start_date,
            "end_date": payroll_period.end_date,
            "pay_date": payroll_period.pay_date,

            "status": payroll_period.status,

            "exchange_rate": payroll_period.exchange_rate,
            "working_days": payroll_period.working_days,

            "social_security_employee_rate": (
                payroll_period.social_security_employee_rate
            ),
            "social_security_employer_rate": (
                payroll_period.social_security_employer_rate
            ),

            "employee_count": len(employees),
            "employees": employees,

            "totals": {
                "basic_salary": total_basic_salary,
                "earnings": total_earnings,
                "absence_deduction": total_absence_deduction,
                "gross_pay": total_gross_pay,
                "taxable_income": total_taxable_income,
                "paye_tax": total_paye_tax,
                "social_security_employee": (
                    total_social_security_employee
                ),
                "social_security_employer": (
                    total_social_security_employer
                ),
                "deductions": total_deductions,
                "net_pay": total_net_pay,
                "employer_cost": total_employer_cost,
            },
        }

    @staticmethod
    def employee_payslip(
        *,
        payroll_period,
        employee,
    ):
        """
        Returns a detailed payslip structure for one employee.
        """

        try:
            record = (
                PayrollRecord.objects
                .select_related(
                    "employee",
                    "payroll_period",
                    "payroll_period__company",
                )
                .prefetch_related(
                    "earning_lines__earning_type",
                    "deduction_lines__deduction_type",
                )
                .get(
                    payroll_period=payroll_period,
                    employee=employee,
                )
            )
        except PayrollRecord.DoesNotExist:
            raise ValueError(
                "No payroll record exists for this employee "
                "in the selected payroll period."
            )

        earnings = [
            {
                "type": earning.earning_type.name,
                "code": earning.earning_type.code,
                "description": earning.description,
                "amount": earning.amount,
                "taxable": earning.is_taxable,
            }
            for earning in record.earning_lines.all()
        ]

        deductions = [
            {
                "type": deduction.deduction_type.name,
                "code": deduction.deduction_type.code,
                "description": deduction.description,
                "amount": deduction.amount,
            }
            for deduction in record.deduction_lines.all()
        ]

        return {
            "company": {
                "id": payroll_period.company_id,
                "name": payroll_period.company.name,
            },

            "payroll_period": {
                "id": payroll_period.id,
                "name": payroll_period.name,
                "start_date": payroll_period.start_date,
                "end_date": payroll_period.end_date,
                "pay_date": payroll_period.pay_date,
                "status": payroll_period.status,
                "exchange_rate": payroll_period.exchange_rate,
                "working_days": payroll_period.working_days,
                "social_security_employee_rate": (
                    payroll_period.social_security_employee_rate
                ),
                "social_security_employer_rate": (
                    payroll_period.social_security_employer_rate
                ),
            },

            "employee": {
                "id": employee.id,
                "employee_number": employee.employee_number,
                "name": employee.full_name,
                "department": employee.department,
                "position": employee.position,
            },

            "earnings": earnings,

            "basic_salary": record.basic_salary,

            "absent_days": record.absent_days,
            "absence_deduction": record.absence_deduction,

            "total_earnings": record.total_earnings,

            "gross_pay": record.gross_pay,

            "taxable_income": record.taxable_income,
            "annual_taxable_income": (
                record.annual_taxable_income
            ),

            "paye_tax": record.paye_tax,

            "social_security_employee": (
                record.social_security_employee
            ),
            "social_security_employer": (
                record.social_security_employer
            ),

            "deductions": deductions,

            "total_deductions": record.total_deductions,

            "net_pay": record.net_pay,

            "employer_cost": record.employer_cost,

            "exchange_rate": record.exchange_rate,
        }