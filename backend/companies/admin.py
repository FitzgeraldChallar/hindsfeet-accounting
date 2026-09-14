from django.contrib import admin

from .deletion import delete_company_data
from .models import Company, CompanyMembership


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "business_type",
        "currency",
        "is_active",
        "created_at",
    )

    list_filter = (
        "business_type",
        "is_active",
    )

    search_fields = (
        "name",
        "legal_name",
        "registration_number",
    )

    def delete_model(self, request, obj):
        """
        Delete one company using the dedicated company-scoped deletion
        service.

        This intentionally bypasses Django's normal deletion behavior,
        because company deletion is designed to remove all records owned
        by the company, including records connected through PROTECT
        relationships.
        """
        delete_company_data(obj)

    def delete_queryset(self, request, queryset):
        """
        Delete selected companies using the dedicated company deletion
        service.

        This is important because Django's built-in delete_selected admin
        action eventually calls ModelAdmin.delete_queryset(). If we allowed
        the default implementation to run, Django would call:

            queryset.delete()

        and PROTECT relationships would raise ProtectedError.

        Each company is therefore deleted through delete_company_data().
        """
        for company in queryset.iterator():
            delete_company_data(company)

    def get_deleted_objects(self, objs, request):
        """
        Override Django Admin's normal protected-object discovery.

        Django normally uses its deletion Collector before displaying the
        confirmation page. The Collector sees PROTECT relationships and
        reports them as protected objects.

        For Company deletion, that behavior is intentional only for normal
        individual-object deletion. A company deletion is a deliberate,
        company-scoped destructive operation handled by delete_company_data().

        Therefore the Admin confirmation page must not block the operation
        because of those protected relationships.
        """
        deleted_objects = []
        model_count = {}
        perms_needed = set()
        protected = []

        return (
            deleted_objects,
            model_count,
            perms_needed,
            protected,
        )


@admin.register(CompanyMembership)
class CompanyMembershipAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "company",
        "role",
        "is_active",
        "joined_at",
    )

    list_filter = (
        "role",
        "is_active",
        "company",
    )

    search_fields = (
        "user__username",
        "user__first_name",
        "user__last_name",
        "company__name",
    )