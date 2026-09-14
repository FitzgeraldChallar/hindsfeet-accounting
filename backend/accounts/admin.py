from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        (
            "Hindsfeet Information",
            {
                "fields": (
                    "role",
                    "phone",
                    "is_active_employee",
                )
            },
        ),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        (
            "Hindsfeet Information",
            {
                "fields": (
                    "role",
                    "phone",
                    "is_active_employee",
                )
            },
        ),
    )
    