from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone

from companies.currency_service import CompanyCurrencyService
from .models import Account, JournalEntry, JournalLine

MONEY = Decimal("0.01")
CURRENCY_CLEARING_ACCOUNT_CODE = "1900"


class AccountingService:
    """Currency-aware double-entry accounting engine."""

    @staticmethod
    def _decimal(value):
        return Decimal(str(value or "0.00"))

    @staticmethod
    def _money(value):
        return AccountingService._decimal(value).quantize(MONEY, rounding=ROUND_HALF_UP)

    @staticmethod
    def _normal_balance(account_type):
        return "DEBIT" if account_type in [
            Account.AccountType.ASSET,
            Account.AccountType.COGS,
            Account.AccountType.EXPENSE,
        ] else "CREDIT"

    @staticmethod
    def account(*, company, code, currency=None, required=True):
        currency = currency or company.currency
        try:
            return Account.objects.get(
                company=company, code=code, currency=currency, is_active=True
            )
        except Account.DoesNotExist:
            if required:
                raise ValueError(
                    f"Required account {code} ({currency}) does not exist for {company.name}."
                )
            return None

    @staticmethod
    def validate_lines(lines):
        if not lines or len(lines) < 2:
            raise ValueError("A journal entry must contain at least two lines.")
        total_debit = Decimal("0.00")
        total_credit = Decimal("0.00")
        for line in lines:
            debit = AccountingService._decimal(line.get("debit"))
            credit = AccountingService._decimal(line.get("credit"))
            if debit < 0 or credit < 0:
                raise ValueError("Debit and credit amounts cannot be negative.")
            if debit > 0 and credit > 0:
                raise ValueError("A line cannot contain both debit and credit.")
            if debit == 0 and credit == 0:
                raise ValueError("Every journal line must contain a debit or credit amount.")
            total_debit += debit
            total_credit += credit
        if total_debit == 0:
            raise ValueError("The journal entry amount must be greater than zero.")
        # For single-currency journals the transaction values must balance.
        currencies = {str(item.get("currency") or "") for item in lines}
        if len(currencies) <= 1 and total_debit != total_credit:
            raise ValueError(
                f"Journal entry is not balanced. Debit: {total_debit}, Credit: {total_credit}."
            )
        return total_debit, total_credit

    @staticmethod
    def _get_currency_clearing_account(*, company, currency):
        """Return the system account used to balance a currency sub-ledger.

        A cross-currency journal is one economic transaction, but its native
        currency legs cannot be balanced against one another (for example,
        LRD 3,500 cannot be posted directly against USD 17.50). The clearing
        account gives each currency its own balanced double-entry ledger.
        Clearing lines are marked separately and carry zero functional value
        because the real economic entry is already represented by the source
        and destination lines in functional currency.
        """
        account = Account.objects.filter(
            company=company,
            currency=currency,
            code=CURRENCY_CLEARING_ACCOUNT_CODE,
        ).first()
        if account is None:
            account = Account.objects.create(
                company=company,
                currency=currency,
                code=CURRENCY_CLEARING_ACCOUNT_CODE,
                name="Foreign Currency Clearing",
                account_type=Account.AccountType.ASSET,
                cash_flow_category=Account.CashFlowCategory.NONE,
                description=(
                    "System clearing account used to balance cross-currency "
                    "transaction ledgers. It is excluded from functional-basis "
                    "reporting because its functional value is zero."
                ),
                is_active=True,
                is_system_account=True,
            )
        elif not account.is_active:
            raise ValueError(
                f"Foreign Currency Clearing account {CURRENCY_CLEARING_ACCOUNT_CODE} "
                f"({currency}) is inactive for {company.name}."
            )
        return account

    @staticmethod
    def _prepare_currency_balancing_lines(*, company, lines):
        """Add synthetic clearing lines so every native currency balances.

        Same-currency journals are left untouched. For a journal containing
        multiple currencies, each currency is independently balanced by one
        clearing line. The clearing line is a reporting/sub-ledger artifact;
        it has zero functional debit/credit and therefore cannot distort the
        company's functional ledger.
        """
        prepared = [dict(line) for line in lines]
        currency_totals = defaultdict(lambda: {"debit": Decimal("0.00"), "credit": Decimal("0.00")})

        for line in prepared:
            account = line.get("account")
            if account is None:
                raise ValueError("Every journal line must specify an account.")
            line_currency = CompanyCurrencyService.normalize_currency(
                line.get("currency") or account.currency
            )
            line["currency"] = line_currency
            debit = AccountingService._decimal(line.get("debit"))
            credit = AccountingService._decimal(line.get("credit"))
            currency_totals[line_currency]["debit"] += debit
            currency_totals[line_currency]["credit"] += credit

        currencies = [currency for currency, totals in currency_totals.items()
                      if totals["debit"] != totals["credit"]]
        if len(currency_totals) <= 1:
            return prepared

        for line_currency in sorted(currencies):
            totals = currency_totals[line_currency]
            net = totals["debit"] - totals["credit"]
            if net == Decimal("0.00"):
                continue

            clearing_account = AccountingService._get_currency_clearing_account(
                company=company,
                currency=line_currency,
            )
            prepared.append({
                "account": clearing_account,
                "description": "Foreign currency clearing for cross-currency journal",
                "debit": Decimal("0.00") if net > 0 else abs(net),
                "credit": net if net > 0 else Decimal("0.00"),
                "currency": line_currency,
                # This is a synthetic native-currency balancing line. Its
                # functional values are deliberately zero below.
                "exchange_rate": Decimal("1.000000"),
                "is_currency_clearing": True,
            })

        return prepared

    @staticmethod
    @transaction.atomic
    def create_journal_entry(
        *, company, reference, description, transaction_date, created_by,
        lines, post=False, currency=None, exchange_rate=None,
    ):
        """Create a journal. Each line can have its own currency/rate.

        Functional values are snapshotted on every real transaction line.
        Cross-currency journals additionally receive native-currency clearing
        lines so every currency-specific trial balance and balance sheet stays
        balanced without changing the functional ledger.
        """
        AccountingService.validate_lines(lines)
        lines = AccountingService._prepare_currency_balancing_lines(
            company=company,
            lines=lines,
        )
        functional_currency = CompanyCurrencyService.get_functional_currency(company)
        primary_currency = CompanyCurrencyService.normalize_currency(
            currency or lines[0].get("currency") or functional_currency
        )
        entry_rate = CompanyCurrencyService.get_rate(
            company=company,
            from_currency=primary_currency,
            to_currency=functional_currency,
            effective_date=transaction_date,
            supplied_rate=exchange_rate,
        )
        entry = JournalEntry.objects.create(
            company=company,
            reference=reference,
            description=description,
            transaction_date=transaction_date,
            currency=primary_currency,
            functional_currency=functional_currency,
            exchange_rate=entry_rate,
            created_by=created_by,
        )
        for line in lines:
            account = line["account"]
            line_currency = CompanyCurrencyService.normalize_currency(
                line.get("currency") or account.currency or primary_currency
            )
            if account.company_id != company.id:
                raise ValueError(f"Account {account.code} does not belong to the selected company.")
            if account.currency != line_currency:
                raise ValueError(
                    f"Account {account.code} is a {account.currency} account; transaction line is {line_currency}."
                )
            if not account.is_active:
                raise ValueError(f"Account {account.code} - {account.name} is inactive.")
            is_currency_clearing = bool(line.get("is_currency_clearing", False))
            if is_currency_clearing:
                line_rate = Decimal("1.000000")
            else:
                line_rate = CompanyCurrencyService.get_rate(
                    company=company,
                    from_currency=line_currency,
                    to_currency=functional_currency,
                    effective_date=transaction_date,
                    supplied_rate=line.get("exchange_rate") if line_currency != functional_currency else None,
                )
            debit = AccountingService._decimal(line.get("debit"))
            credit = AccountingService._decimal(line.get("credit"))
            if is_currency_clearing:
                functional_debit = Decimal("0.00")
                functional_credit = Decimal("0.00")
            else:
                functional_debit = AccountingService._money(debit * line_rate)
                functional_credit = AccountingService._money(credit * line_rate)
            JournalLine.objects.create(
                journal_entry=entry,
                account=account,
                currency=line_currency,
                exchange_rate=line_rate,
                description=line.get("description", ""),
                debit=debit,
                credit=credit,
                functional_debit=functional_debit,
                functional_credit=functional_credit,
                is_currency_clearing=is_currency_clearing,
            )
        if not entry.is_balanced:
            # Functional rounding differences must never silently enter the ledger.
            functional_debit = entry.total_functional_debit
            functional_credit = entry.total_functional_credit
            entry.delete()
            raise ValueError(
                "Journal entry is not balanced in functional currency. "
                f"Debit: {functional_debit}, Credit: {functional_credit}."
            )
        if post:
            AccountingService.post_journal_entry(entry=entry, user=created_by)
        return entry

    @staticmethod
    @transaction.atomic
    def post_journal_entry(*, entry, user):
        if entry.status != JournalEntry.Status.DRAFT:
            raise ValueError("Only draft journal entries can be posted.")
        if not entry.lines.exists():
            raise ValueError("Cannot post a journal entry without lines.")
        if not entry.is_balanced:
            raise ValueError("Cannot post an unbalanced journal entry.")
        entry.status = JournalEntry.Status.POSTED
        entry.posted_by = user
        entry.posted_at = timezone.now()
        entry.save(update_fields=["status", "posted_by", "posted_at", "updated_at"])
        return entry

    @staticmethod
    def _report_lines(*, company, currency=None, functional=False, start_date=None, end_date=None, account=None):
        qs = JournalLine.objects.filter(
            journal_entry__company=company,
            journal_entry__status=JournalEntry.Status.POSTED,
        ).select_related("account", "journal_entry")
        if start_date:
            qs = qs.filter(journal_entry__transaction_date__gte=start_date)
        if end_date:
            qs = qs.filter(journal_entry__transaction_date__lte=end_date)
        if account:
            qs = qs.filter(account=account)
        if functional:
            # Currency-clearing lines are native-ledger balancing artifacts and
            # have no functional value. Excluding them keeps functional
            # reports focused on economic postings.
            return qs.filter(is_currency_clearing=False)
        currency = currency or company.currency
        return qs.filter(currency=currency, account__currency=currency)

    @staticmethod
    def general_ledger(*, company, start_date=None, end_date=None, account=None, currency=None, functional=False):
        currency = currency or company.currency
        accounts_qs = Account.objects.filter(company=company, is_active=True)
        if not functional:
            accounts_qs = accounts_qs.filter(currency=currency)
        if account:
            accounts_qs = accounts_qs.filter(pk=account.pk)
        accounts = list(accounts_qs.order_by("currency", "code"))
        if not accounts:
            return []
        ids = [a.id for a in accounts]
        before = {a.id: Decimal("0.00") for a in accounts}
        if start_date:
            opening = AccountingService._report_lines(
                company=company, currency=currency, functional=functional,
                end_date=None,
            ).filter(account_id__in=ids, journal_entry__transaction_date__lt=start_date)
            for line in opening:
                debit = line.functional_debit if functional else line.debit
                credit = line.functional_credit if functional else line.credit
                movement = debit - credit if AccountingService._normal_balance(line.account.account_type) == "DEBIT" else credit - debit
                before[line.account_id] += movement
        lines = AccountingService._report_lines(
            company=company, currency=currency, functional=functional,
            start_date=start_date, end_date=end_date,
        ).filter(account_id__in=ids).order_by("account__currency", "account__code", "journal_entry__transaction_date", "journal_entry__id", "id")
        ledger = {}
        for a in accounts:
            ledger[a.id] = {
                "account": a.id, "account_code": a.code, "account_name": a.name,
                "currency": a.currency, "account_type": a.account_type,
                "cash_flow_category": a.cash_flow_category,
                "opening_balance": before[a.id], "debits": Decimal("0.00"),
                "credits": Decimal("0.00"), "closing_balance": before[a.id],
                "transactions": [],
            }
        for line in lines:
            d = line.functional_debit if functional else line.debit
            c = line.functional_credit if functional else line.credit
            data = ledger[line.account_id]
            data["debits"] += d
            data["credits"] += c
            movement = d - c if AccountingService._normal_balance(line.account.account_type) == "DEBIT" else c - d
            data["closing_balance"] += movement
            data["transactions"].append({
                "journal_entry_id": line.journal_entry_id,
                "reference": line.journal_entry.reference,
                "date": line.journal_entry.transaction_date,
                "description": line.description or line.journal_entry.description,
                "currency": line.currency,
                "debit": d, "credit": c, "balance": data["closing_balance"],
                "transaction_debit": line.debit, "transaction_credit": line.credit,
                "exchange_rate": line.exchange_rate,
            })
        return list(ledger.values())

    @staticmethod
    def trial_balance(*, company, start_date=None, end_date=None, currency=None, functional=False):
        currency = currency or company.currency
        accounts_qs = Account.objects.filter(company=company, is_active=True)
        if not functional:
            accounts_qs = accounts_qs.filter(currency=currency)
        balances = {
            a.id: {
                "account": a.id, "account_code": a.code, "account_name": a.name,
                "currency": a.currency, "account_type": a.account_type,
                "cash_flow_category": a.cash_flow_category,
                "debit": Decimal("0.00"), "credit": Decimal("0.00"),
            } for a in accounts_qs.order_by("currency", "code")
        }
        for line in AccountingService._report_lines(
            company=company, currency=currency, functional=functional,
            start_date=start_date, end_date=end_date,
        ):
            if line.account_id not in balances:
                continue
            balances[line.account_id]["debit"] += line.functional_debit if functional else line.debit
            balances[line.account_id]["credit"] += line.functional_credit if functional else line.credit
        return list(balances.values())

    @staticmethod
    def income_statement(*, company, start_date=None, end_date=None, currency=None, functional=False):
        tb = AccountingService.trial_balance(company=company, start_date=start_date, end_date=end_date, currency=currency, functional=functional)
        revenue, cogs, expenses = [], [], []
        tr = tc = te = Decimal("0.00")
        for a in tb:
            d, c = a["debit"], a["credit"]
            amount = Decimal("0.00")
            if a["account_type"] == Account.AccountType.REVENUE:
                amount = c - d
                bucket, total = revenue, "revenue"
            elif a["account_type"] == Account.AccountType.COGS:
                amount = d - c
                bucket, total = cogs, "cogs"
            elif a["account_type"] == Account.AccountType.EXPENSE:
                amount = d - c
                bucket, total = expenses, "expenses"
            else:
                continue
            if amount:
                bucket.append({"account": a["account"], "code": a["account_code"], "name": a["account_name"], "currency": a["currency"], "amount": amount})
                if total == "revenue": tr += amount
                elif total == "cogs": tc += amount
                else: te += amount
        gross = tr - tc
        net = gross - te
        return {"currency": currency or company.currency, "revenue": revenue, "total_revenue": tr, "cost_of_goods_sold": cogs, "total_cost_of_goods_sold": tc, "gross_profit": gross, "expenses": expenses, "total_expenses": te, "net_profit": net, "is_profitable": net > 0}

    @staticmethod
    def balance_sheet(*, company, as_of_date=None, currency=None, functional=False):
        tb = AccountingService.trial_balance(company=company, end_date=as_of_date, currency=currency, functional=functional)
        assets, liabilities, equity = [], [], []
        ta = tl = te = Decimal("0.00")
        for a in tb:
            d, c = a["debit"], a["credit"]
            if a["account_type"] == Account.AccountType.ASSET:
                amount = d - c; bucket = assets; total = "a"
            elif a["account_type"] == Account.AccountType.LIABILITY:
                amount = c - d; bucket = liabilities; total = "l"
            elif a["account_type"] == Account.AccountType.EQUITY:
                amount = c - d; bucket = equity; total = "e"
            else:
                continue
            if amount:
                bucket.append({"account": a["account"], "code": a["account_code"], "name": a["account_name"], "currency": a["currency"], "amount": amount})
                if total == "a": ta += amount
                elif total == "l": tl += amount
                else: te += amount
        profit = AccountingService.income_statement(company=company, end_date=as_of_date, currency=currency, functional=functional)["net_profit"]
        tewp = te + profit
        lte = tl + tewp
        return {"currency": currency or company.currency, "assets": assets, "total_assets": ta, "liabilities": liabilities, "total_liabilities": tl, "equity": equity, "total_equity": te, "current_profit": profit, "total_equity_with_profit": tewp, "total_liabilities_and_equity": lte, "difference": ta - lte, "is_balanced": ta == lte}

    @staticmethod
    def cash_flow_statement(*, company, start_date=None, end_date=None, currency=None, functional=False):
        currency = currency or company.currency
        qs = Account.objects.filter(company=company, is_active=True, account_type=Account.AccountType.ASSET, code__startswith="10")
        if not functional:
            qs = qs.filter(currency=currency)
        cash_ids = set(qs.values_list("id", flat=True))
        lines = AccountingService._report_lines(company=company, currency=currency, functional=functional, start_date=start_date, end_date=end_date).filter(account_id__in=cash_ids).prefetch_related("journal_entry__lines__account")
        opening = Decimal("0.00")
        if start_date:
            for line in AccountingService._report_lines(company=company, currency=currency, functional=functional).filter(account_id__in=cash_ids, journal_entry__transaction_date__lt=start_date):
                opening += (line.functional_debit - line.functional_credit) if functional else (line.debit - line.credit)
        operating, investing, financing = [], [], []
        totals = defaultdict(lambda: Decimal("0.00"))
        processed = set()
        for cash_line in lines:
            entry = cash_line.journal_entry
            if entry.id in processed: continue
            processed.add(entry.id)
            cash_movement = Decimal("0.00")
            for line in entry.lines.all():
                if line.account_id in cash_ids:
                    cash_movement += (line.functional_debit - line.functional_credit) if functional else (line.debit - line.credit)
            if not cash_movement: continue
            category = Account.CashFlowCategory.OPERATING
            for line in entry.lines.all():
                if line.account_id not in cash_ids and line.account.cash_flow_category != Account.CashFlowCategory.NONE:
                    category = line.account.cash_flow_category; break
            item = {"journal_entry_id": entry.id, "reference": entry.reference, "date": entry.transaction_date, "description": entry.description, "amount": cash_movement, "cash_account": cash_line.account_id, "cash_account_code": cash_line.account.code, "cash_account_name": cash_line.account.name, "currency": cash_line.currency}
            if category == Account.CashFlowCategory.INVESTING: investing.append(item); totals["investing"] += cash_movement
            elif category == Account.CashFlowCategory.FINANCING: financing.append(item); totals["financing"] += cash_movement
            else: operating.append(item); totals["operating"] += cash_movement
        net = totals["operating"] + totals["investing"] + totals["financing"]
        actual = opening + net
        return {"currency": currency, "operating_activities": operating, "total_operating_activities": totals["operating"], "investing_activities": investing, "total_investing_activities": totals["investing"], "financing_activities": financing, "total_financing_activities": totals["financing"], "net_change_in_cash": net, "opening_cash_balance": opening, "closing_cash_balance": actual, "actual_closing_cash": actual, "reconciliation_difference": Decimal("0.00")}
