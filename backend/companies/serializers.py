from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
    Company,
    CompanyCurrency,
    CompanyExchangeRate,
    CompanyMembership,
)

User = get_user_model()


class CompanyCurrencySerializer(serializers.ModelSerializer):
    currency_name = serializers.CharField(
        source="get_currency_display",
        read_only=True,
    )

    class Meta:
        model = CompanyCurrency
        fields = [
            "id",
            "company",
            "currency",
            "currency_name",
            "is_default",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "currency_name",
            "created_at",
            "updated_at",
        ]


class CompanyExchangeRateSerializer(serializers.ModelSerializer):
    from_currency_name = serializers.CharField(
        source="get_from_currency_display",
        read_only=True,
    )

    to_currency_name = serializers.CharField(
        source="get_to_currency_display",
        read_only=True,
    )

    created_by_name = serializers.CharField(
        source="created_by.get_full_name",
        read_only=True,
    )

    class Meta:
        model = CompanyExchangeRate
        fields = [
            "id",
            "company",
            "from_currency",
            "from_currency_name",
            "to_currency",
            "to_currency_name",
            "rate",
            "effective_date",
            "is_active",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "created_by_name",
            "from_currency_name",
            "to_currency_name",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        from_currency = attrs.get(
            "from_currency",
            getattr(
                self.instance,
                "from_currency",
                None,
            ),
        )
        to_currency = attrs.get(
            "to_currency",
            getattr(
                self.instance,
                "to_currency",
                None,
            ),
        )

        if from_currency == to_currency:
            raise serializers.ValidationError(
                {
                    "to_currency": (
                        "From and to currencies must be different."
                    )
                }
            )

        if "rate" in attrs and attrs["rate"] <= 0:
            raise serializers.ValidationError(
                {
                    "rate": (
                        "Exchange rate must be greater than zero."
                    )
                }
            )

        return attrs


class CompanySerializer(serializers.ModelSerializer):
    currencies = CompanyCurrencySerializer(
        source="enabled_currencies",
        many=True,
        read_only=True,
    )

    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "legal_name",
            "business_type",
            "registration_number",
            "address",
            "phone",
            "email",
            "logo",
            "currency",
            "default_workspace_currency",
            "currencies",
            "fiscal_year_start_month",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "currencies",
        ]

    def validate_default_workspace_currency(self, value):
        if value not in {Company.Currency.USD, Company.Currency.LRD}:
            raise serializers.ValidationError("Default workspace currency must be USD or LRD.")
        return value

    def validate_fiscal_year_start_month(self, value):
        if not 1 <= value <= 12:
            raise serializers.ValidationError(
                "Fiscal year start month must be between 1 and 12."
            )

        return value


class CompanyMembershipSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(
        source="user.get_full_name",
        read_only=True,
    )

    company_name = serializers.CharField(
        source="company.name",
        read_only=True,
    )

    class Meta:
        model = CompanyMembership
        fields = [
            "id",
            "user",
            "user_name",
            "company",
            "company_name",
            "role",
            "is_active",
            "joined_at",
        ]
        read_only_fields = [
            "id",
            "user_name",
            "company_name",
            "joined_at",
        ]
