from decimal import Decimal

from companies.models import Company
from payroll.models import PayrollTaxBand
from payroll.services import PayrollService

company = Company.objects.order_by("id").first()

if company is None:
    raise SystemExit("No company exists in the database.")

print(f"Company: {company.name} ({company.currency})")
print(f"Tax bands configured: {PayrollTaxBand.objects.filter(company=company, is_active=True).count()}")

print("\nPAYE checks")
for monthly in [Decimal("5000.00"), Decimal("10000.00"), Decimal("50000.00"), Decimal("100000.00")]:
    rate = Decimal("1.00") if str(company.currency).upper() == "LRD" else Decimal("200.00")
    result = PayrollService.calculate_paye(
        company=company,
        monthly_taxable_income=monthly,
        exchange_rate=rate,
    )
    print(
        f"  {monthly} payroll currency/month -> "
        f"{result['annual_taxable_income']} LRD annual -> "
        f"{result['monthly_tax_in_payroll_currency']} PAYE/month "
        f"(rate {rate})"
    )

print("\nAbsence check")
absence = PayrollService.calculate_absence(
    basic_salary=Decimal("1000.00"),
    days_absent=Decimal("2.00"),
    working_days=Decimal("22.00"),
)
print(f"  1000 salary / 22 working days × 2 absent days = {absence}")

print("\nNASSCORP check")
ss = PayrollService.calculate_social_security(
    gross_pay=Decimal("1000.00"),
    employee_rate=Decimal("4.00"),
    employer_rate=Decimal("6.00"),
)
print(f"  Employee contribution: {ss['employee']}")
print(f"  Employer contribution: {ss['employer']}")
