from django.db import transaction
from rest_framework import serializers

from .models import Account, JournalEntry, JournalLine


# ============================================================
# ACCOUNT
# ============================================================

class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = [
            "id",
            "company",
            "code",
            "name",
            "account_type",
            "cash_flow_category",
            "description",
            "parent",
            "is_active",
            "is_system_account",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "is_system_account",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        company = attrs.get(
            "company",
            getattr(
                self.instance,
                "company",
                None,
            ),
        )

        parent = attrs.get(
            "parent",
            getattr(
                self.instance,
                "parent",
                None,
            ),
        )

        if parent and company and parent.company_id != company.id:
            raise serializers.ValidationError({
                "parent": (
                    "Parent account must belong to "
                    "the same company."
                )
            })

        return attrs


# ============================================================
# JOURNAL LINE
# ============================================================

class JournalLineSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(
        source="account.name",
        read_only=True,
    )

    account_code = serializers.CharField(
        source="account.code",
        read_only=True,
    )

    class Meta:
        model = JournalLine
        fields = [
            "id",
            "account",
            "account_code",
            "account_name",
            "description",
            "debit",
            "credit",
        ]

        read_only_fields = [
            "id",
            "account_code",
            "account_name",
        ]


# ============================================================
# JOURNAL ENTRY
# ============================================================

class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalLineSerializer(
        many=True,
    )

    total_debit = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        read_only=True,
    )

    total_credit = serializers.DecimalField(
        max_digits=18,
        decimal_places=2,
        read_only=True,
    )

    is_balanced = serializers.BooleanField(
        read_only=True,
    )

    class Meta:
        model = JournalEntry

        fields = [
            "id",
            "company",
            "reference",
            "description",
            "transaction_date",
            "status",
            "created_by",
            "posted_by",
            "posted_at",
            "created_at",
            "updated_at",
            "lines",
            "total_debit",
            "total_credit",
            "is_balanced",
        ]

        read_only_fields = [
            "id",
            "status",
            "created_by",
            "posted_by",
            "posted_at",
            "created_at",
            "updated_at",
            "total_debit",
            "total_credit",
            "is_balanced",
        ]

    def validate(self, attrs):
        company = attrs.get("company")

        lines = attrs.get(
            "lines",
            [],
        )

        if not company:
            raise serializers.ValidationError({
                "company": "Company is required."
            })

        if len(lines) < 2:
            raise serializers.ValidationError({
                "lines": (
                    "A journal entry must contain "
                    "at least two lines."
                )
            })

        total_debit = 0
        total_credit = 0

        for line in lines:
            account = line["account"]

            if account.company_id != company.id:
                raise serializers.ValidationError({
                    "lines": (
                        "Every account must belong to "
                        "the selected company."
                    )
                })

            if not account.is_active:
                raise serializers.ValidationError({
                    "lines": (
                        f"Account {account.code} - "
                        f"{account.name} is inactive."
                    )
                })

            total_debit += line["debit"]
            total_credit += line["credit"]

        if total_debit != total_credit:
            raise serializers.ValidationError({
                "lines": (
                    f"Journal entry is not balanced. "
                    f"Debit: {total_debit}. "
                    f"Credit: {total_credit}."
                )
            })

        if total_debit == 0:
            raise serializers.ValidationError({
                "lines": (
                    "The journal entry amount must "
                    "be greater than zero."
                )
            })

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")

        entry = JournalEntry.objects.create(
            **validated_data,
        )

        for line in lines:
            JournalLine.objects.create(
                journal_entry=entry,
                **line,
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

    