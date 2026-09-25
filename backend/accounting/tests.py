from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from companies.models import Company, CompanyCurrency, CompanyExchangeRate
from .default_accounts import create_default_accounts
from .models import Account, JournalEntry, JournalLine
from .services import AccountingService


class MultiCurrencyLedgerBalanceTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="accounting-test",
            password="test-password",
        )
        self.company = Company.objects.create(
            name="Test Company",
            legal_name="Test Company",
            currency=Company.Currency.USD,
            default_workspace_currency=Company.Currency.USD,
        )
        CompanyCurrency.objects.create(
            company=self.company,
            currency=Company.Currency.USD,
            is_default=True,
            is_active=True,
        )
        CompanyCurrency.objects.create(
            company=self.company,
            currency=Company.Currency.LRD,
            is_default=False,
            is_active=True,
        )
        CompanyExchangeRate.objects.create(
            company=self.company,
            from_currency=Company.Currency.LRD,
            to_currency=Company.Currency.USD,
            rate=Decimal("0.005000"),
            effective_date="2026-09-15",
            created_by=self.user,
        )
        create_default_accounts(self.company)

    def account(self, code, currency):
        return Account.objects.get(
            company=self.company,
            code=code,
            currency=currency,
        )

    def test_same_currency_journal_does_not_create_clearing_line(self):
        entry = AccountingService.create_journal_entry(
            company=self.company,
            reference="TEST-USD-1",
            description="USD test",
            transaction_date="2026-09-15",
            created_by=self.user,
            lines=[
                {
                    "account": self.account("1000", "USD"),
                    "debit": Decimal("100.00"),
                    "credit": Decimal("0.00"),
                    "currency": "USD",
                },
                {
                    "account": self.account("3000", "USD"),
                    "debit": Decimal("0.00"),
                    "credit": Decimal("100.00"),
                    "currency": "USD",
                },
            ],
            post=True,
        )

        self.assertFalse(entry.lines.filter(is_currency_clearing=True).exists())
        self.assertTrue(entry.is_balanced)
        self.assertEqual(entry.lines.count(), 2)

    def test_cross_currency_journal_balances_each_native_currency(self):
        entry = AccountingService.create_journal_entry(
            company=self.company,
            reference="TEST-FX-1",
            description="Cross currency receipt",
            transaction_date="2026-09-15",
            created_by=self.user,
            lines=[
                {
                    "account": self.account("1010", "LRD"),
                    "debit": Decimal("3500.00"),
                    "credit": Decimal("0.00"),
                    "currency": "LRD",
                    "exchange_rate": Decimal("0.005000"),
                },
                {
                    "account": self.account("1100", "USD"),
                    "debit": Decimal("0.00"),
                    "credit": Decimal("17.50"),
                    "currency": "USD",
                },
            ],
            currency="LRD",
            exchange_rate=Decimal("0.005000"),
            post=True,
        )

        self.assertTrue(entry.is_balanced)
        self.assertEqual(entry.lines.filter(is_currency_clearing=True).count(), 2)

        for currency in ("USD", "LRD"):
            lines = entry.lines.filter(currency=currency)
            debit = sum((line.debit for line in lines), Decimal("0.00"))
            credit = sum((line.credit for line in lines), Decimal("0.00"))
            self.assertEqual(debit, credit)

        clearing = entry.lines.filter(is_currency_clearing=True)
        self.assertEqual(
            sum((line.functional_debit for line in clearing), Decimal("0.00")),
            Decimal("0.00"),
        )
        self.assertEqual(
            sum((line.functional_credit for line in clearing), Decimal("0.00")),
            Decimal("0.00"),
        )

    def test_transaction_trial_balance_and_balance_sheet_remain_balanced(self):
        AccountingService.create_journal_entry(
            company=self.company,
            reference="TEST-FX-2",
            description="Cross currency receipt",
            transaction_date="2026-09-15",
            created_by=self.user,
            lines=[
                {
                    "account": self.account("1010", "LRD"),
                    "debit": Decimal("3500.00"),
                    "credit": Decimal("0.00"),
                    "currency": "LRD",
                    "exchange_rate": Decimal("0.005000"),
                },
                {
                    "account": self.account("1100", "USD"),
                    "debit": Decimal("0.00"),
                    "credit": Decimal("17.50"),
                    "currency": "USD",
                },
            ],
            currency="LRD",
            exchange_rate=Decimal("0.005000"),
            post=True,
        )

        usd_tb = AccountingService.trial_balance(
            company=self.company,
            currency="USD",
        )
        lrd_tb = AccountingService.trial_balance(
            company=self.company,
            currency="LRD",
        )
        self.assertEqual(
            sum((row["debit"] for row in usd_tb), Decimal("0.00")),
            sum((row["credit"] for row in usd_tb), Decimal("0.00")),
        )
        self.assertEqual(
            sum((row["debit"] for row in lrd_tb), Decimal("0.00")),
            sum((row["credit"] for row in lrd_tb), Decimal("0.00")),
        )

        usd_bs = AccountingService.balance_sheet(
            company=self.company,
            currency="USD",
        )
        lrd_bs = AccountingService.balance_sheet(
            company=self.company,
            currency="LRD",
        )
        self.assertTrue(usd_bs["is_balanced"])
        self.assertTrue(lrd_bs["is_balanced"])
        self.assertEqual(usd_bs["difference"], Decimal("0.00"))
        self.assertEqual(lrd_bs["difference"], Decimal("0.00"))
