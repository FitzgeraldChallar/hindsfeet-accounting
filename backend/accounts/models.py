from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model for the Hindsfeet Accounting System.
    """

    class Role(models.TextChoices):
        OWNER = "OWNER", "Owner"
        ADMIN = "ADMIN", "Administrator"
        ACCOUNTANT = "ACCOUNTANT", "Accountant"
        MANAGER = "MANAGER", "Manager"
        PAYROLL_OFFICER = "PAYROLL_OFFICER", "Payroll Officer"

    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.ACCOUNTANT,
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
    )

    is_active_employee = models.BooleanField(
        default=True,
    )

    def __str__(self):
        return self.get_full_name() or self.username