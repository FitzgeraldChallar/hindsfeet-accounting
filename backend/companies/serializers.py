from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Company, CompanyMembership

User = get_user_model()


class CompanySerializer(serializers.ModelSerializer):
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
            "currency",
            "fiscal_year_start_month",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]

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

        