from rest_framework import serializers

from .models import BankAccount, BankTransaction


class BankAccountSerializer(serializers.ModelSerializer):
    bank_account_balance = serializers.SerializerMethodField()

    accounting_account_code = serializers.CharField(
        source="accounting_account.code",
        read_only=True,
    )

    accounting_account_name = serializers.CharField(
        source="accounting_account.name",
        read_only=True,
    )

    account_type_display = serializers.CharField(
        source="get_account_type_display",
        read_only=True,
    )

    class Meta:
        model = BankAccount

        fields = [
            "id",
            "company",
            "accounting_account",
            "accounting_account_code",
            "accounting_account_name",
            "bank_name",
            "account_name",
            "account_number",
            "account_type",
            "account_type_display",
            "currency",
            "opening_balance",
            "bank_account_balance",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "accounting_account",
            "accounting_account_code",
            "accounting_account_name",
            "account_type_display",
            "bank_account_balance",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        opening_balance = attrs.get(
            "opening_balance"
        )

        currency = attrs.get("currency")

        if (
            opening_balance is not None
            and opening_balance < 0
        ):
            raise serializers.ValidationError({
                "opening_balance": (
                    "Opening balance cannot be negative."
                )
            })

        if currency and currency not in [
            "USD",
            "LRD",
        ]:
            raise serializers.ValidationError({
                "currency": (
                    "Bank account currency must be "
                    "either USD or LRD."
                )
            })

        return attrs

    def get_bank_account_balance(self, obj):
        from .services import BankingService

        return BankingService.get_balance(
            bank_account=obj
        )


class BankTransactionSerializer(serializers.ModelSerializer):
    bank_name = serializers.CharField(
        source="bank_account.bank_name",
        read_only=True,
    )

    bank_account_name = serializers.CharField(
        source="bank_account.account_name",
        read_only=True,
    )

    account_number = serializers.CharField(
        source="bank_account.account_number",
        read_only=True,
    )

    transaction_type_display = serializers.CharField(
        source="get_transaction_type_display",
        read_only=True,
    )

    class Meta:
        model = BankTransaction

        fields = [
            "id",
            "company",
            "bank_account",
            "bank_name",
            "bank_account_name",
            "account_number",
            "transaction_type",
            "transaction_type_display",
            "amount",
            "transaction_date",
            "reference",
            "description",
            "journal_entry",
            "created_by",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "bank_name",
            "bank_account_name",
            "account_number",
            "transaction_type_display",
            "journal_entry",
            "created_by",
            "created_at",
        ]

    def validate(self, attrs):
        company = attrs.get("company")
        bank_account = attrs.get("bank_account")

        if company and bank_account:
            if (
                bank_account.company_id
                != company.id
            ):
                raise serializers.ValidationError({
                    "bank_account": (
                        "Bank account must belong "
                        "to the selected company."
                    )
                })

        amount = attrs.get("amount")

        if amount is not None and amount <= 0:
            raise serializers.ValidationError({
                "amount": (
                    "Transaction amount must be "
                    "greater than zero."
                )
            })

        return attrs