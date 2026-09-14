from collections import defaultdict
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import Account, JournalEntry, JournalLine


class AccountingService:
    """
    Central service responsible for creating, validating,
    posting, and reporting double-entry journal entries.

    All financial reports are generated from POSTED journal
    entries only.
    """

    # ============================================================
    # HELPERS
    # ============================================================

    @staticmethod
    def _decimal(value):
        return Decimal(str(value or "0.00"))

    @staticmethod
    def _normal_balance(account_type):
        """
        Return the normal balance side for an account type.

        Assets, COGS and Expenses normally have debit balances.

        Liabilities, Equity and Revenue normally have credit
        balances.
        """

        if account_type in [
            Account.AccountType.ASSET,
            Account.AccountType.COGS,
            Account.AccountType.EXPENSE,
        ]:
            return "DEBIT"

        return "CREDIT"

    # ============================================================
    # JOURNAL VALIDATION
    # ============================================================

    @staticmethod
    def validate_lines(lines):
        """
        Validate journal lines and ensure that total debits
        equal total credits.
        """

        if not lines or len(lines) < 2:
            raise ValueError(
                "A journal entry must contain at least two lines."
            )

        total_debit = Decimal("0.00")
        total_credit = Decimal("0.00")

        for line in lines:
            debit = Decimal(
                str(line.get("debit", "0.00"))
            )

            credit = Decimal(
                str(line.get("credit", "0.00"))
            )

            if debit < 0 or credit < 0:
                raise ValueError(
                    "Debit and credit amounts cannot be negative."
                )

            if debit > 0 and credit > 0:
                raise ValueError(
                    "A line cannot contain both debit and credit."
                )

            if debit == 0 and credit == 0:
                raise ValueError(
                    "Every journal line must contain "
                    "a debit or credit amount."
                )

            total_debit += debit
            total_credit += credit

        if total_debit == 0:
            raise ValueError(
                "The journal entry amount must be greater than zero."
            )

        if total_debit != total_credit:
            raise ValueError(
                "Journal entry is not balanced. "
                f"Debit: {total_debit}, "
                f"Credit: {total_credit}."
            )

        return total_debit, total_credit

    # ============================================================
    # CREATE JOURNAL ENTRY
    # ============================================================

    @staticmethod
    @transaction.atomic
    def create_journal_entry(
        *,
        company,
        reference,
        description,
        transaction_date,
        created_by,
        lines,
        post=False,
    ):
        """
        Create a journal entry and its associated journal lines.

        If post=True, the entry is immediately posted.
        """

        AccountingService.validate_lines(lines)

        entry = JournalEntry.objects.create(
            company=company,
            reference=reference,
            description=description,
            transaction_date=transaction_date,
            created_by=created_by,
        )

        for line in lines:
            account = line["account"]

            if account.company_id != company.id:
                raise ValueError(
                    f"Account {account.code} does not belong "
                    "to the selected company."
                )

            if not account.is_active:
                raise ValueError(
                    f"Account {account.code} - "
                    f"{account.name} is inactive."
                )

            JournalLine.objects.create(
                journal_entry=entry,
                account=account,
                description=line.get(
                    "description",
                    "",
                ),
                debit=Decimal(
                    str(line.get("debit", "0.00"))
                ),
                credit=Decimal(
                    str(line.get("credit", "0.00"))
                ),
            )

        if post:
            AccountingService.post_journal_entry(
                entry=entry,
                user=created_by,
            )

        return entry

    # ============================================================
    # POST JOURNAL ENTRY
    # ============================================================

    @staticmethod
    @transaction.atomic
    def post_journal_entry(*, entry, user):
        """
        Post a draft journal entry.

        Posted entries become part of the official
        accounting ledger.
        """

        if entry.status != JournalEntry.Status.DRAFT:
            raise ValueError(
                "Only draft journal entries can be posted."
            )

        if not entry.lines.exists():
            raise ValueError(
                "Cannot post a journal entry without lines."
            )

        if not entry.is_balanced:
            raise ValueError(
                "Cannot post an unbalanced journal entry."
            )

        entry.status = JournalEntry.Status.POSTED
        entry.posted_by = user
        entry.posted_at = timezone.now()

        entry.save(
            update_fields=[
                "status",
                "posted_by",
                "posted_at",
                "updated_at",
            ]
        )

        return entry

    # ============================================================
    # GENERAL LEDGER
    # ============================================================

    @staticmethod
    def general_ledger(
        *,
        company,
        start_date=None,
        end_date=None,
        account=None,
    ):
        """
        Return posted journal activity grouped by account.

        If start_date is supplied, opening_balance represents
        the account balance immediately before start_date.

        closing_balance is:

            opening_balance
            + period activity

        using the account's normal balance.
        """

        # --------------------------------------------------------
        # Accounts to include
        # --------------------------------------------------------

        accounts_queryset = Account.objects.filter(
            company=company,
            is_active=True,
        ).order_by("code")

        if account:
            accounts_queryset = accounts_queryset.filter(
                pk=account.pk
            )

        accounts = list(accounts_queryset)

        if not accounts:
            return []

        account_ids = [item.id for item in accounts]

        # --------------------------------------------------------
        # Opening balances
        # --------------------------------------------------------

        opening_balances = {
            account_id: Decimal("0.00")
            for account_id in account_ids
        }

        if start_date:
            opening_lines = JournalLine.objects.filter(
                journal_entry__company=company,
                journal_entry__status=(
                    JournalEntry.Status.POSTED
                ),
                journal_entry__transaction_date__lt=start_date,
                account_id__in=account_ids,
            )

            for line in opening_lines:
                normal_balance = self_normal_balance = (
                    AccountingService._normal_balance(
                        line.account.account_type
                    )
                )

                if self_normal_balance == "DEBIT":
                    opening_balances[line.account_id] += (
                        line.debit - line.credit
                    )
                else:
                    opening_balances[line.account_id] += (
                        line.credit - line.debit
                    )

        # --------------------------------------------------------
        # Period transactions
        # --------------------------------------------------------

        lines = (
            JournalLine.objects.filter(
                journal_entry__company=company,
                journal_entry__status=(
                    JournalEntry.Status.POSTED
                ),
                account_id__in=account_ids,
            )
            .select_related(
                "account",
                "journal_entry",
            )
            .order_by(
                "account__code",
                "journal_entry__transaction_date",
                "journal_entry__id",
                "id",
            )
        )

        if start_date:
            lines = lines.filter(
                journal_entry__transaction_date__gte=start_date
            )

        if end_date:
            lines = lines.filter(
                journal_entry__transaction_date__lte=end_date
            )

        ledger = {}

        for account_obj in accounts:
            ledger[account_obj.id] = {
                "account": account_obj.id,
                "account_code": account_obj.code,
                "account_name": account_obj.name,
                "account_type": account_obj.account_type,
                "cash_flow_category": (
                    account_obj.cash_flow_category
                ),
                "opening_balance": opening_balances.get(
                    account_obj.id,
                    Decimal("0.00"),
                ),
                "debits": Decimal("0.00"),
                "credits": Decimal("0.00"),
                "closing_balance": opening_balances.get(
                    account_obj.id,
                    Decimal("0.00"),
                ),
                "transactions": [],
            }

        for line in lines:
            account_data = ledger.get(line.account_id)

            if account_data is None:
                continue

            account_data["debits"] += line.debit
            account_data["credits"] += line.credit

            normal_balance = AccountingService._normal_balance(
                line.account.account_type
            )

            if normal_balance == "DEBIT":
                movement = line.debit - line.credit
            else:
                movement = line.credit - line.debit

            account_data["closing_balance"] += movement

            account_data["transactions"].append({
                "journal_entry_id": line.journal_entry_id,
                "reference": line.journal_entry.reference,
                "date": line.journal_entry.transaction_date,
                "description": (
                    line.description
                    or line.journal_entry.description
                ),
                "debit": line.debit,
                "credit": line.credit,
                "balance": account_data["closing_balance"],
            })

        return list(ledger.values())

    # ============================================================
    # TRIAL BALANCE
    # ============================================================

    @staticmethod
    def trial_balance(
        *,
        company,
        start_date=None,
        end_date=None,
    ):
        """
        Produce a trial balance from posted journal entries.

        The report includes all active accounts, including accounts
        with zero activity during the selected period.
        """

        lines = (
            JournalLine.objects.filter(
                journal_entry__company=company,
                journal_entry__status=(
                    JournalEntry.Status.POSTED
                ),
            )
            .select_related(
                "account",
                "journal_entry",
            )
        )

        if start_date:
            lines = lines.filter(
                journal_entry__transaction_date__gte=start_date
            )

        if end_date:
            lines = lines.filter(
                journal_entry__transaction_date__lte=end_date
            )

        balances = {}

        for account in (
            Account.objects.filter(
                company=company,
                is_active=True,
            )
            .order_by("code")
        ):
            balances[account.id] = {
                "account": account.id,
                "account_code": account.code,
                "account_name": account.name,
                "account_type": account.account_type,
                "cash_flow_category": (
                    account.cash_flow_category
                ),
                "debit": Decimal("0.00"),
                "credit": Decimal("0.00"),
            }

        for line in lines:
            account_data = balances.get(
                line.account_id
            )

            if account_data is None:
                continue

            account_data["debit"] += line.debit
            account_data["credit"] += line.credit

        return list(balances.values())

    # ============================================================
    # INCOME STATEMENT
    # ============================================================

    @staticmethod
    def income_statement(
        *,
        company,
        start_date=None,
        end_date=None,
    ):
        """
        Generate an Income Statement / Profit & Loss statement.

        Includes:

        Revenue
        Cost of Goods Sold
        Gross Profit
        Operating Expenses
        Net Profit / Loss
        """

        trial_balance = AccountingService.trial_balance(
            company=company,
            start_date=start_date,
            end_date=end_date,
        )

        revenue = []
        cogs = []
        expenses = []

        total_revenue = Decimal("0.00")
        total_cogs = Decimal("0.00")
        total_expenses = Decimal("0.00")

        for account in trial_balance:
            account_type = account["account_type"]

            debit = account["debit"]
            credit = account["credit"]

            if account_type == Account.AccountType.REVENUE:
                amount = credit - debit

                if amount != 0:
                    revenue.append({
                        "account": account["account"],
                        "code": account["account_code"],
                        "name": account["account_name"],
                        "amount": amount,
                    })

                    total_revenue += amount

            elif account_type == Account.AccountType.COGS:
                amount = debit - credit

                if amount != 0:
                    cogs.append({
                        "account": account["account"],
                        "code": account["account_code"],
                        "name": account["account_name"],
                        "amount": amount,
                    })

                    total_cogs += amount

            elif account_type == Account.AccountType.EXPENSE:
                amount = debit - credit

                if amount != 0:
                    expenses.append({
                        "account": account["account"],
                        "code": account["account_code"],
                        "name": account["account_name"],
                        "amount": amount,
                    })

                    total_expenses += amount

        gross_profit = (
            total_revenue
            - total_cogs
        )

        net_profit = (
            gross_profit
            - total_expenses
        )

        return {
            "revenue": revenue,
            "total_revenue": total_revenue,

            "cost_of_goods_sold": cogs,
            "total_cost_of_goods_sold": total_cogs,

            "gross_profit": gross_profit,

            "expenses": expenses,
            "total_expenses": total_expenses,

            "net_profit": net_profit,

            "is_profitable": net_profit > 0,
        }

    # ============================================================
    # BALANCE SHEET
    # ============================================================

    @staticmethod
    def balance_sheet(
        *,
        company,
        as_of_date=None,
    ):
        """
        Generate a Balance Sheet from posted journal entries.

        Accounting equation:

            Assets = Liabilities + Equity + Current Profit/Loss
        """

        trial_balance = AccountingService.trial_balance(
            company=company,
            end_date=as_of_date,
        )

        assets = []
        liabilities = []
        equity = []

        total_assets = Decimal("0.00")
        total_liabilities = Decimal("0.00")
        total_equity = Decimal("0.00")

        for account in trial_balance:
            account_type = account["account_type"]

            debit = account["debit"]
            credit = account["credit"]

            if account_type == Account.AccountType.ASSET:
                amount = debit - credit

                if amount != 0:
                    assets.append({
                        "account": account["account"],
                        "code": account["account_code"],
                        "name": account["account_name"],
                        "amount": amount,
                    })

                    total_assets += amount

            elif account_type == Account.AccountType.LIABILITY:
                amount = credit - debit

                if amount != 0:
                    liabilities.append({
                        "account": account["account"],
                        "code": account["account_code"],
                        "name": account["account_name"],
                        "amount": amount,
                    })

                    total_liabilities += amount

            elif account_type == Account.AccountType.EQUITY:
                amount = credit - debit

                if amount != 0:
                    equity.append({
                        "account": account["account"],
                        "code": account["account_code"],
                        "name": account["account_name"],
                        "amount": amount,
                    })

                    total_equity += amount

        # --------------------------------------------------------
        # Current-period profit
        # --------------------------------------------------------

        current_profit = AccountingService.income_statement(
            company=company,
            end_date=as_of_date,
        )["net_profit"]

        total_equity_with_profit = (
            total_equity
            + current_profit
        )

        total_liabilities_and_equity = (
            total_liabilities
            + total_equity_with_profit
        )

        difference = (
            total_assets
            - total_liabilities_and_equity
        )

        return {
            "assets": assets,
            "total_assets": total_assets,

            "liabilities": liabilities,
            "total_liabilities": total_liabilities,

            "equity": equity,
            "total_equity": total_equity,

            "current_profit": current_profit,

            "total_equity_with_profit": (
                total_equity_with_profit
            ),

            "total_liabilities_and_equity": (
                total_liabilities_and_equity
            ),

            "difference": difference,

            "is_balanced": (
                difference == Decimal("0.00")
            ),
        }

    # ============================================================
    # CASH FLOW STATEMENT
    # ============================================================

    @staticmethod
    def cash_flow_statement(
        *,
        company,
        start_date=None,
        end_date=None,
    ):
        """
        Generate a Cash Flow Statement from posted journal entries.

        Cash flow is classified using each account's
        cash_flow_category:

            OPERATING
            INVESTING
            FINANCING

        Cash accounts are identified from Asset accounts whose
        account code begins with:

            10

        This matches the current chart-of-accounts structure where
        cash and bank accounts are in the 1000 range.

        The method uses actual movements in cash/bank accounts and
        classifies the corresponding non-cash side of each journal
        entry.

        This provides a practical direct-method cash flow report
        suitable for the current accounting system.
        """

        # --------------------------------------------------------
        # Identify cash and bank accounts
        # --------------------------------------------------------

        cash_accounts = list(
            Account.objects.filter(
                company=company,
                is_active=True,
                account_type=Account.AccountType.ASSET,
                code__startswith="10",
            ).order_by("code")
        )

        cash_account_ids = {
            account.id
            for account in cash_accounts
        }

        # --------------------------------------------------------
        # Base response
        # --------------------------------------------------------

        operating = []
        investing = []
        financing = []

        total_operating = Decimal("0.00")
        total_investing = Decimal("0.00")
        total_financing = Decimal("0.00")

        # --------------------------------------------------------
        # Opening cash balance
        # --------------------------------------------------------

        opening_cash_balance = Decimal("0.00")

        if start_date:
            opening_cash_lines = JournalLine.objects.filter(
                journal_entry__company=company,
                journal_entry__status=(
                    JournalEntry.Status.POSTED
                ),
                journal_entry__transaction_date__lt=start_date,
                account_id__in=cash_account_ids,
            )

            for line in opening_cash_lines:
                opening_cash_balance += (
                    line.debit
                    - line.credit
                )

        # --------------------------------------------------------
        # Cash transactions during reporting period
        # --------------------------------------------------------

        cash_lines = (
            JournalLine.objects.filter(
                journal_entry__company=company,
                journal_entry__status=(
                    JournalEntry.Status.POSTED
                ),
                account_id__in=cash_account_ids,
            )
            .select_related(
                "account",
                "journal_entry",
            )
            .prefetch_related(
                "journal_entry__lines__account",
            )
            .order_by(
                "journal_entry__transaction_date",
                "journal_entry__id",
                "id",
            )
        )

        if start_date:
            cash_lines = cash_lines.filter(
                journal_entry__transaction_date__gte=start_date
            )

        if end_date:
            cash_lines = cash_lines.filter(
                journal_entry__transaction_date__lte=end_date
            )

        # --------------------------------------------------------
        # Process each cash movement
        # --------------------------------------------------------

        processed_entries = set()

        for cash_line in cash_lines:

            entry = cash_line.journal_entry

            # Avoid processing the same journal entry more than
            # once when an entry contains multiple cash accounts.
            entry_key = entry.id

            if entry_key in processed_entries:
                continue

            processed_entries.add(entry_key)

            # ----------------------------------------------------
            # Calculate total cash movement for this entry.
            # ----------------------------------------------------

            entry_cash_debit = Decimal("0.00")
            entry_cash_credit = Decimal("0.00")

            cash_entry_lines = []

            for line in entry.lines.all():
                if line.account_id in cash_account_ids:
                    entry_cash_debit += line.debit
                    entry_cash_credit += line.credit
                    cash_entry_lines.append(line)

            net_cash_flow = (
                entry_cash_debit
                - entry_cash_credit
            )

            if net_cash_flow == Decimal("0.00"):
                continue

            # ----------------------------------------------------
            # Determine category.
            #
            # The category is taken from the non-cash account
            # involved in the journal entry.
            # ----------------------------------------------------

            category = (
                Account.CashFlowCategory.OPERATING
            )

            category_account = None

            for line in entry.lines.all():
                if line.account_id in cash_account_ids:
                    continue

                if (
                    line.account.cash_flow_category
                    != Account.CashFlowCategory.NONE
                ):
                    category_account = line.account
                    category = (
                        line.account.cash_flow_category
                    )
                    break

            # If nothing was explicitly classified, default to
            # Operating so ordinary cash receipts/payments are not
            # silently omitted.
            if category == Account.CashFlowCategory.NONE:
                category = (
                    Account.CashFlowCategory.OPERATING
                )

            # ----------------------------------------------------
            # Description
            # ----------------------------------------------------

            description = entry.description

            if category_account:
                description = (
                    f"{entry.description}"
                )

            item = {
                "journal_entry_id": entry.id,
                "reference": entry.reference,
                "date": entry.transaction_date,
                "description": description,
                "amount": net_cash_flow,
                "cash_account": cash_line.account_id,
                "cash_account_code": cash_line.account.code,
                "cash_account_name": cash_line.account.name,
            }

            # ----------------------------------------------------
            # Classification
            # ----------------------------------------------------

            if category == Account.CashFlowCategory.INVESTING:
                investing.append(item)
                total_investing += net_cash_flow

            elif category == Account.CashFlowCategory.FINANCING:
                financing.append(item)
                total_financing += net_cash_flow

            else:
                operating.append(item)
                total_operating += net_cash_flow

        # --------------------------------------------------------
        # Net change in cash
        # --------------------------------------------------------

        net_change_in_cash = (
            total_operating
            + total_investing
            + total_financing
        )

        closing_cash_balance = (
            opening_cash_balance
            + net_change_in_cash
        )

        # --------------------------------------------------------
        # Actual closing balance from the ledger.
        #
        # This provides a useful reconciliation check.
        # --------------------------------------------------------

        closing_cash_lines = JournalLine.objects.filter(
            journal_entry__company=company,
            journal_entry__status=(
                JournalEntry.Status.POSTED
            ),
            account_id__in=cash_account_ids,
        )

        if end_date:
            closing_cash_lines = closing_cash_lines.filter(
                journal_entry__transaction_date__lte=end_date
            )

        actual_closing_cash = Decimal("0.00")

        for line in closing_cash_lines:
            actual_closing_cash += (
                line.debit
                - line.credit
            )

        reconciliation_difference = (
            actual_closing_cash
            - closing_cash_balance
        )

        return {
            "operating_activities": operating,
            "total_operating_activities": (
                total_operating
            ),

            "investing_activities": investing,
            "total_investing_activities": (
                total_investing
            ),

            "financing_activities": financing,
            "total_financing_activities": (
                total_financing
            ),

            "net_change_in_cash": (
                net_change_in_cash
            ),

            "opening_cash_balance": (
                opening_cash_balance
            ),

            "closing_cash_balance": (
                closing_cash_balance
            ),

            "actual_closing_cash": (
                actual_closing_cash
            ),

            "reconciliation_difference": (
                reconciliation_difference
            ),

            "is_reconciled": (
                reconciliation_difference
                == Decimal("0.00")
            ),
        }