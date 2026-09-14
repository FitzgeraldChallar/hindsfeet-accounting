from decimal import Decimal
from django.db import transaction
from payroll.models import PayrollTaxBand
from companies.models import Company

BANDS = [
    ("PIT Exempt", Decimal("0.00"), Decimal("70000.00"), Decimal("0.00"), Decimal("0.00")),
    ("PIT Band 2", Decimal("70000.00"), Decimal("200000.00"), Decimal("5.00"), Decimal("0.00")),
    ("PIT Band 3", Decimal("200000.00"), Decimal("800000.00"), Decimal("15.00"), Decimal("6500.00")),
    ("PIT Band 4", Decimal("800000.00"), None, Decimal("25.00"), Decimal("96500.00")),
]

@transaction.atomic
def seed():
    for company in Company.objects.all():
        for name, lower, upper, rate, fixed_tax in BANDS:
            PayrollTaxBand.objects.update_or_create(
                company=company,
                lower_limit=lower,
                defaults={
                    "name": name,
                    "upper_limit": upper,
                    "rate": rate,
                    "fixed_tax": fixed_tax,
                    "is_active": True,
                },
            )
