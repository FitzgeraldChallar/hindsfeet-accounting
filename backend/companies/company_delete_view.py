from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .deletion import delete_company_data
from .models import Company, CompanyMembership


class CompanyDeleteView(APIView):
    """Permanently delete a company and every company-owned record."""

    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _can_delete(user, company):
        if user.is_superuser:
            return True
        return CompanyMembership.objects.filter(
            user=user,
            company=company,
            is_active=True,
            role__in={"OWNER", "ADMIN"},
        ).exists()

    def delete(self, request, pk):
        company = get_object_or_404(Company, pk=pk)

        if not self._can_delete(request.user, company):
            raise PermissionDenied(
                "Only a company owner or administrator can permanently delete a company."
            )

        company_name = company.name
        deleted = delete_company_data(company)

        return Response(
            {
                "detail": f"Company '{company_name}' and all company-owned records were permanently deleted.",
                "company_id": pk,
                "deleted": deleted,
            },
            status=status.HTTP_200_OK,
        )
