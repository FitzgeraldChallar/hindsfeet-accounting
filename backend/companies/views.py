from rest_framework import generics, permissions

from .models import Company, CompanyMembership
from .permissions import IsCompanyMember
from .serializers import (
    CompanyMembershipSerializer,
    CompanySerializer,
)
from accounting.default_accounts import create_default_accounts


class CompanyListCreateView(generics.ListCreateAPIView):
    serializer_class = CompanySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if user.is_superuser or user.role in ["OWNER", "ADMIN"]:
            return Company.objects.filter(is_active=True)

        return Company.objects.filter(
            memberships__user=user,
            memberships__is_active=True,
            is_active=True,
        ).distinct()

    def perform_create(self, serializer):
        company = serializer.save(
            created_by=self.request.user
        )

        CompanyMembership.objects.get_or_create(
            user=self.request.user,
            company=company,
            defaults={
                "role": (
                    "OWNER"
                    if self.request.user.role == "OWNER"
                    else "ADMIN"
                )
            },
        )

        create_default_accounts(company)


class CompanyDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = CompanySerializer
    permission_classes = [
        permissions.IsAuthenticated,
        IsCompanyMember,
    ]

    def get_queryset(self):
        user = self.request.user

        if user.is_superuser or user.role in ["OWNER", "ADMIN"]:
            return Company.objects.all()

        return Company.objects.filter(
            memberships__user=user,
            memberships__is_active=True,
        ).distinct()

