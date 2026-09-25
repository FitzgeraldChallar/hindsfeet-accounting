from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction

from .models import Company, CompanyCurrency, CompanyExchangeRate


MONEY = Decimal("0.01")
RATE = Decimal("0.000001")


class CompanyCurrencyService:
    """Central currency/workspace and historical FX service."""

    ALLOWED_CURRENCIES = {
        Company.Currency.USD,
        Company.Currency.LRD,
    }

    @staticmethod
    def normalize_currency(value):
        currency = str(value or "").upper().strip()
        if currency not in CompanyCurrencyService.ALLOWED_CURRENCIES:
            raise ValueError("Currency must be USD or LRD.")
        return currency

    @staticmethod
    def money(value):
        return Decimal(str(value or "0")).quantize(
            MONEY, rounding=ROUND_HALF_UP
        )

    @staticmethod
    def get_functional_currency(company):
        return CompanyCurrencyService.normalize_currency(company.currency)

    @staticmethod
    def get_enabled_currencies(company):
        return CompanyCurrency.objects.filter(
            company=company, is_active=True
        ).order_by("-is_default", "currency")

    @staticmethod
    def validate_enabled_currency(*, company, currency):
        currency = CompanyCurrencyService.normalize_currency(currency)
        exists = CompanyCurrency.objects.filter(
            company=company,
            currency=currency,
            is_active=True,
        ).exists()
        if not exists:
            raise ValueError(
                f"{currency} is not enabled for {company.name}."
            )
        return currency

    @staticmethod
    @transaction.atomic
    def enable_currency(*, company, currency, make_default=False):
        currency = CompanyCurrencyService.normalize_currency(currency)
        enabled = CompanyCurrency.objects.filter(
            company=company, currency=currency
        ).first()
        if enabled is None:
            enabled = CompanyCurrency.objects.create(
                company=company,
                currency=currency,
                is_active=True,
                is_default=False,
            )
        else:
            enabled.is_active = True
            enabled.save(update_fields=["is_active", "updated_at"])
        if make_default:
            CompanyCurrencyService.set_default_currency(
                company=company, currency=currency
            )
        return enabled

    @staticmethod
    @transaction.atomic
    def set_default_currency(*, company, currency):
        currency = CompanyCurrencyService.normalize_currency(currency)
        target = CompanyCurrency.objects.filter(
            company=company, currency=currency, is_active=True
        ).first()
        if target is None:
            raise ValueError(
                "The currency must be enabled before it can become the default workspace."
            )
        CompanyCurrency.objects.filter(
            company=company, is_default=True
        ).exclude(pk=target.pk).update(is_default=False)
        target.is_default = True
        target.save(update_fields=["is_default", "updated_at"])
        # IMPORTANT: default workspace is not the same thing as the
        # company's functional currency. Functional currency remains
        # Company.currency for accounting/reporting compatibility.
        return target

    @staticmethod
    @transaction.atomic
    def disable_currency(*, company, currency):
        currency = CompanyCurrencyService.normalize_currency(currency)
        target = CompanyCurrency.objects.filter(
            company=company, currency=currency
        ).first()
        if target is None:
            raise ValueError("The requested currency is not enabled for this company.")
        if target.is_default:
            raise ValueError("The default workspace currency cannot be disabled. Choose another default first.")
        if currency == CompanyCurrencyService.get_functional_currency(company):
            raise ValueError("The functional currency cannot be disabled.")
        target.is_active = False
        target.save(update_fields=["is_active", "updated_at"])
        return target

    @staticmethod
    def get_rate(*, company, from_currency, to_currency, effective_date, supplied_rate=None):
        from_currency = CompanyCurrencyService.normalize_currency(from_currency)
        to_currency = CompanyCurrencyService.normalize_currency(to_currency)
        if from_currency == to_currency:
            return Decimal("1.000000")
        CompanyCurrencyService.validate_enabled_currency(
            company=company, currency=from_currency
        )
        CompanyCurrencyService.validate_enabled_currency(
            company=company, currency=to_currency
        )
        if supplied_rate is not None:
            rate = Decimal(str(supplied_rate))
            if rate <= 0:
                raise ValueError("Exchange rate must be greater than zero.")
            return rate.quantize(RATE, rounding=ROUND_HALF_UP)
        if not effective_date:
            raise ValueError("An effective date is required to determine an exchange rate.")
        direct = CompanyExchangeRate.objects.filter(
            company=company,
            from_currency=from_currency,
            to_currency=to_currency,
            effective_date__lte=effective_date,
            is_active=True,
        ).order_by("-effective_date", "-id").first()
        if direct:
            return Decimal(direct.rate)
        inverse = CompanyExchangeRate.objects.filter(
            company=company,
            from_currency=to_currency,
            to_currency=from_currency,
            effective_date__lte=effective_date,
            is_active=True,
        ).order_by("-effective_date", "-id").first()
        if inverse:
            return (Decimal("1") / Decimal(inverse.rate)).quantize(
                RATE, rounding=ROUND_HALF_UP
            )
        raise ValueError(
            f"No exchange rate exists for {from_currency} to {to_currency} on or before {effective_date}."
        )

    @staticmethod
    def convert(*, company, amount, from_currency, to_currency, effective_date, supplied_rate=None):
        rate = CompanyCurrencyService.get_rate(
            company=company,
            from_currency=from_currency,
            to_currency=to_currency,
            effective_date=effective_date,
            supplied_rate=supplied_rate,
        )
        return CompanyCurrencyService.money(Decimal(str(amount or "0")) * rate), rate

    @staticmethod
    def workspace_payload(company):
        functional = CompanyCurrencyService.get_functional_currency(company)
        default = (
            CompanyCurrency.objects.filter(
                company=company, is_default=True, is_active=True
            ).first()
        )
        return {
            "company_id": company.id,
            "company_name": company.name,
            "legal_name": company.legal_name,
            "functional_currency": functional,
            "default_workspace_currency": default.currency if default else functional,
            "currencies": [
                {
                    "id": item.id,
                    "currency": item.currency,
                    "is_default": item.is_default,
                    "is_active": item.is_active,
                }
                for item in CompanyCurrency.objects.filter(company=company).order_by("-is_default", "currency")
            ],
        }
