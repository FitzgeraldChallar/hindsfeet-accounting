from rest_framework.permissions import BasePermission

from companies.models import CompanyMembership


class CanAccessCompanyAccounting(BasePermission):
    """
    Ensures the user has access to the company associated
    with the accounting object.
    """

    def has_company_access(self, user, company):
        if user.is_superuser:
            return True

        if user.role in ["OWNER", "ADMIN"]:
            return True

        return CompanyMembership.objects.filter(
            user=user,
            company=company,
            is_active=True,
        ).exists()

    def has_object_permission(self, request, view, obj):
        company = getattr(obj, "company", None)

        if company is None and hasattr(obj, "journal_entry"):
            company = obj.journal_entry.company

        return self.has_company_access(
            request.user,
            company,
        )

    