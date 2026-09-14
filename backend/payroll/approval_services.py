from django.db import transaction

from .models import PayrollPeriod


class PayrollApprovalService:
    """
    Controls payroll approval and recovery workflow.

    Normal workflow:

        DRAFT
          ↓
        PROCESSING
          ↓
        PROCESSED
          ↓
        APPROVED
          ↓
        LOCKED

    APPROVED → LOCKED occurs when payroll is successfully
    posted to accounting by PayrollAccountingService.

    PROCESSED payroll may be returned to DRAFT for correction.

    Approved or locked payroll cannot be returned to draft.
    """

    @staticmethod
    def approve_payroll(
        *,
        payroll_period,
        approved_by,
    ):
        """
        Approves a processed payroll period.

        Only PROCESSED payroll can be approved.
        """

        if payroll_period.status != PayrollPeriod.Status.PROCESSED:
            raise ValueError(
                "Only processed payroll can be approved."
            )

        if not payroll_period.records.exists():
            raise ValueError(
                "Cannot approve payroll without payroll records."
            )

        payroll_period.status = (
            PayrollPeriod.Status.APPROVED
        )

        payroll_period.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        return payroll_period

    @staticmethod
    @transaction.atomic
    def lock_payroll(
        *,
        payroll_period,
        locked_by,
    ):
        """
        Direct manual locking is no longer part of the
        normal payroll workflow.

        Payroll must become LOCKED through
        PayrollAccountingService.post_payroll() after
        accounting has been successfully posted.

        This method remains only for compatibility with
        existing code and deliberately refuses direct locking.
        """

        raise ValueError(
            "Payroll cannot be locked directly. "
            "Approved payroll must be posted to accounting, "
            "which locks the payroll automatically."
        )

    @staticmethod
    def return_to_draft(
        *,
        payroll_period,
    ):
        """
        Returns processed payroll to DRAFT for correction.

        Approved or locked payroll cannot be returned
        to draft through this method.
        """

        if payroll_period.status != PayrollPeriod.Status.PROCESSED:
            raise ValueError(
                "Only processed payroll can be returned to draft."
            )

        payroll_period.status = (
            PayrollPeriod.Status.DRAFT
        )

        payroll_period.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        return payroll_period

    @staticmethod
    def is_locked(
        *,
        payroll_period,
    ):
        """
        Returns True when payroll is permanently locked.
        """

        return (
            payroll_period.status
            == PayrollPeriod.Status.LOCKED
        )