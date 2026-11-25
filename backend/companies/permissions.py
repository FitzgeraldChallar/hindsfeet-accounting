from rest_framework.permissions import BasePermission

from .models import CompanyMembership


class IsCompanyMember(BasePermission):
    """Allow only superusers or users with an active membership in this company."""

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser:
            return True
        return CompanyMembership.objects.filter(
            user=request.user,
            company=obj,
            is_active=True,
        ).exists()
