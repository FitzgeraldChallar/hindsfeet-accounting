from decimal import Decimal

from django.test import TestCase

from accounts.models import User
from companies.models import Company, CompanyCurrency
from subscriptions.models import Plan, Subscription

from .models import Employee, PayrollPeriod, PayrollTaxBand
from .services import PayrollService


class PayrollMultiCurrencyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="payroll-test",
            password="test-password",
            role=User.Role.OWNER,
        )
        self.company = Company.objects.create(
            name="Payroll Currency Test Company",
            legal_name="Payroll Currency Test Company Ltd",
            currency=Company.Currency.USD,
            default_workspace_currency=Company.Currency.USD,
            created_by=self.user,
        )
        CompanyCurrency.objects.create(
            company=self.company,
            currency=Company.Currency.USD,
            is_active=True,
            is_default=True,
        )
        CompanyCurrency.objects.create(
            company=self.company,
            currency=Company.Currency.LRD,
            is_active=True,
            is_default=False,
        )

    def _period(self, currency, name):
        return PayrollPeriod.objects.create(
            company=self.company,
            name=name,
            start_date="2026-09-01",
            end_date="2026-09-30",
            pay_date="2026-09-30",
            currency=currency,
            exchange_rate=Decimal("1.000000"),
            created_by=self.user,
        )

    def test_same_date_range_can_have_usd_and_lrd_payroll_periods(self):
        usd = self._period("USD", "September USD Payroll")
        lrd = self._period("LRD", "September LRD Payroll")

        self.assertNotEqual(usd.id, lrd.id)
        self.assertEqual(usd.currency, "USD")
        self.assertEqual(lrd.currency, "LRD")

    def test_employee_currency_is_used_to_select_the_correct_payroll_population(self):
        usd_employee = Employee.objects.create(
            company=self.company,
            employee_number="USD-001",
            first_name="USD",
            last_name="Employee",
            currency="USD",
            basic_salary=Decimal("1000.00"),
            created_by=self.user,
        )
        lrd_employee = Employee.objects.create(
            company=self.company,
            employee_number="LRD-001",
            first_name="LRD",
            last_name="Employee",
            currency="LRD",
            basic_salary=Decimal("100000.00"),
            created_by=self.user,
        )

        usd_period = self._period("USD", "September USD Payroll")
        lrd_period = self._period("LRD", "September LRD Payroll")

        usd_ids = {
            employee.id
            for employee in PayrollService._eligible_employees(
                payroll_period=usd_period
            )
        }
        lrd_ids = {
            employee.id
            for employee in PayrollService._eligible_employees(
                payroll_period=lrd_period
            )
        }

        self.assertEqual(usd_ids, {usd_employee.id})
        self.assertEqual(lrd_ids, {lrd_employee.id})

    def test_lra_tax_table_automation_is_not_applied_without_complete_entitlement(self):
        result = PayrollService.calculate_paye(
            company=self.company,
            monthly_taxable_income=Decimal("10000.00"),
            exchange_rate=Decimal("1.000000"),
        )

        self.assertFalse(result["automation_available"])
        self.assertEqual(
            result["monthly_tax_in_payroll_currency"],
            Decimal("0.00"),
        )

    def test_lrd_paye_is_calculated_directly_in_lrd(self):
        subscription = Subscription.objects.get(company=self.company)
        subscription.plan = Plan.objects.get(code=Plan.Code.COMPLETE)
        subscription.status = Subscription.Status.ACTIVE
        subscription.save()

        PayrollTaxBand.objects.create(
            company=self.company,
            name="0 to 70,000",
            lower_limit=Decimal("0.00"),
            upper_limit=Decimal("70000.00"),
            rate=Decimal("0.00"),
            fixed_tax=Decimal("0.00"),
        )
        PayrollTaxBand.objects.create(
            company=self.company,
            name="70,000 to 200,000",
            lower_limit=Decimal("70000.00"),
            upper_limit=Decimal("200000.00"),
            rate=Decimal("5.00"),
            fixed_tax=Decimal("0.00"),
        )

        result = PayrollService.calculate_paye(
            company=self.company,
            monthly_taxable_income=Decimal("10000.00"),
            exchange_rate=Decimal("1.000000"),
        )

        self.assertEqual(
            result["monthly_taxable_income_lrd"],
            Decimal("10000.00"),
        )
        self.assertEqual(
            result["annual_taxable_income"],
            Decimal("120000.00"),
        )
        self.assertEqual(
            result["monthly_tax_in_payroll_currency"],
            Decimal("208.33"),
        )
