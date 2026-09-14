from rest_framework.permissions import BasePermission

from .models import CompanyMembership


class IsCompanyMember(BasePermission):
    """
    Allows access only when the authenticated user
    has an active membership in the requested company.
    """

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser:
            return True

        if request.user.role in ["OWNER", "ADMIN"]:
            return True

        return CompanyMembership.objects.filter(
            user=request.user,
            company=obj,
            is_active=True,
        ).exists()