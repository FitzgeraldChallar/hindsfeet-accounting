from rest_framework import serializers

from .models import Account, JournalEntry, JournalLine
from .services import AccountingService


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = [
            "id", "company", "code", "name", "currency", "account_type",
            "cash_flow_category", "description", "parent", "is_active",
            "is_system_account", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "is_system_account", "created_at", "updated_at"]

    def validate(self, attrs):
        company = attrs.get("company", getattr(self.instance, "company", None))
        parent = attrs.get("parent", getattr(self.instance, "parent", None))
        currency = attrs.get("currency", getattr(self.instance, "currency", None))
        if parent and company and parent.company_id != company.id:
            raise serializers.ValidationError({"parent": "Parent account must belong to the same company."})
        if parent and currency and parent.currency != currency:
            raise serializers.ValidationError({"parent": "Parent account must use the same currency."})
        return attrs


class JournalLineSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source="account.name", read_only=True)
    account_code = serializers.CharField(source="account.code", read_only=True)
    class Meta:
        model = JournalLine
        fields = ["id", "account", "account_code", "account_name", "currency", "exchange_rate", "description", "debit", "credit", "functional_debit", "functional_credit", "is_currency_clearing"]
        read_only_fields = ["id", "account_code", "account_name", "functional_debit", "functional_credit", "is_currency_clearing"]


class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalLineSerializer(many=True)
    total_debit = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    total_credit = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    total_functional_debit = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    total_functional_credit = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    is_balanced = serializers.BooleanField(read_only=True)
    class Meta:
        model = JournalEntry
        fields = [
            "id", "company", "reference", "description", "transaction_date",
            "status", "currency", "functional_currency", "exchange_rate",
            "created_by", "posted_by", "posted_at", "created_at", "updated_at",
            "lines", "total_debit", "total_credit", "total_functional_debit",
            "total_functional_credit", "is_balanced",
        ]
        read_only_fields = [
            "id", "status", "created_by", "posted_by", "posted_at", "created_at",
            "updated_at", "functional_currency", "total_debit", "total_credit",
            "total_functional_debit", "total_functional_credit", "is_balanced",
        ]

    def validate(self, attrs):
        company = attrs.get("company")
        lines = attrs.get("lines", [])
        if not company:
            raise serializers.ValidationError({"company": "Company is required."})
        if len(lines) < 2:
            raise serializers.ValidationError({"lines": "A journal entry must contain at least two lines."})
        for line in lines:
            account = line["account"]
            if account.company_id != company.id:
                raise serializers.ValidationError({"lines": "Every account must belong to the selected company."})
            if not account.is_active:
                raise serializers.ValidationError({"lines": f"Account {account.code} - {account.name} is inactive."})
            currency = line.get("currency") or account.currency
            if account.currency != currency:
                raise serializers.ValidationError({"lines": f"Account {account.code} is {account.currency}; line currency is {currency}."})
        return attrs

    def create(self, validated_data):
        lines = validated_data.pop("lines")
        created_by = validated_data.pop("created_by", self.context["request"].user)
        entry = AccountingService.create_journal_entry(
            **validated_data, lines=lines, created_by=created_by
        )
        return entry


# ============================================================
# GENERAL LEDGER
# ============================================================

class LedgerTransactionSerializer(serializers.Serializer):
    journal_entry_id = serializers.IntegerField()

    reference = serializers.CharField()

    date = serializers.DateField()

    description = serializers.CharField()

    debit = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    credit = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    balance = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        required=False,
    )


class GeneralLedgerAccountSerializer(serializers.Serializer):
    account = serializers.IntegerField()

    account_code = serializers.CharField()

    account_name = serializers.CharField()

    account_type = serializers.CharField()

    cash_flow_category = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    opening_balance = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    debits = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    credits = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    closing_balance = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    transactions = LedgerTransactionSerializer(
        many=True,
    )


# ============================================================
# TRIAL BALANCE
# ============================================================

class TrialBalanceAccountSerializer(serializers.Serializer):
    account = serializers.IntegerField()

    account_code = serializers.CharField()

    account_name = serializers.CharField()

    account_type = serializers.CharField()

    cash_flow_category = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    debit = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    credit = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )


# ============================================================
# INCOME STATEMENT
# ============================================================

class IncomeStatementAccountSerializer(serializers.Serializer):
    account = serializers.IntegerField()

    code = serializers.CharField()

    name = serializers.CharField()

    amount = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )


class IncomeStatementSerializer(serializers.Serializer):
    revenue = IncomeStatementAccountSerializer(
        many=True,
    )

    total_revenue = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    cost_of_goods_sold = IncomeStatementAccountSerializer(
        many=True,
    )

    total_cost_of_goods_sold = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    gross_profit = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    expenses = IncomeStatementAccountSerializer(
        many=True,
    )

    total_expenses = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    net_profit = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    is_profitable = serializers.BooleanField()


# ============================================================
# BALANCE SHEET
# ============================================================

class BalanceSheetAccountSerializer(serializers.Serializer):
    account = serializers.IntegerField()

    code = serializers.CharField()

    name = serializers.CharField()

    amount = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )


class BalanceSheetSerializer(serializers.Serializer):
    assets = BalanceSheetAccountSerializer(
        many=True,
    )

    total_assets = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    liabilities = BalanceSheetAccountSerializer(
        many=True,
    )

    total_liabilities = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    equity = BalanceSheetAccountSerializer(
        many=True,
    )

    total_equity = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    current_profit = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    total_equity_with_profit = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    total_liabilities_and_equity = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    difference = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    is_balanced = serializers.BooleanField()


# ============================================================
# CASH FLOW STATEMENT
# ============================================================

class CashFlowActivitySerializer(serializers.Serializer):
    journal_entry_id = serializers.IntegerField()

    reference = serializers.CharField()

    date = serializers.DateField()

    description = serializers.CharField()

    amount = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    cash_account = serializers.IntegerField()

    cash_account_code = serializers.CharField()

    cash_account_name = serializers.CharField()


class CashFlowStatementSerializer(serializers.Serializer):
    operating_activities = CashFlowActivitySerializer(
        many=True,
    )

    total_operating_activities = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    investing_activities = CashFlowActivitySerializer(
        many=True,
    )

    total_investing_activities = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    financing_activities = CashFlowActivitySerializer(
        many=True,
    )

    total_financing_activities = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    net_change_in_cash = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    opening_cash_balance = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    closing_cash_balance = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    actual_closing_cash = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    reconciliation_difference = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
    )

    is_reconciled = serializers.BooleanField()

    