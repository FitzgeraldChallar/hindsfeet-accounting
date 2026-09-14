import csv
import re
from io import BytesIO
from xml.sax.saxutils import escape

from django.db import transaction
from django.http import HttpResponse

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from companies.models import Company, CompanyMembership

from .models import (
    Employee,
    PayrollDeduction,
    PayrollDeductionType,
    PayrollEarning,
    PayrollEarningType,
    PayrollPeriod,
    PayrollAbsence,
    PayrollTaxBand,
    PayrollRecord,
    PayrollRemittance,
)
from .serializers import (
    EmployeeSerializer,
    PayrollPeriodSerializer,
    PayrollTaxBandSerializer,
    PayrollAbsenceSerializer,
    PayrollEarningTypeSerializer,
    PayrollEarningSerializer,
    PayrollDeductionTypeSerializer,
    PayrollDeductionSerializer,
    PayrollRecordSerializer,
    PayrollRemittanceSerializer,
)
from .services import PayrollService
from .approval_services import PayrollApprovalService
from .accounting_services import PayrollAccountingService
from .payment_services import PayrollPaymentService
from .remittance_services import PayrollRemittanceService


def user_can_access_company(user, company):
    """
    Determines whether the authenticated user can access
    a company's payroll information.
    """

    if user.is_superuser:
        return True

    if user.role in ["OWNER", "ADMIN"]:
        return True

    return CompanyMembership.objects.filter(
        user=user,
        company=company,
        is_active=True,
    ).exists()


def get_company_for_user(user, company_id):
    """
    Returns a company if the authenticated user has access.
    """

    try:
        company = Company.objects.get(
            id=company_id,
            is_active=True,
        )
    except Company.DoesNotExist:
        return None

    if not user_can_access_company(user, company):
        return None

    return company


class EmployeeListCreateView(generics.ListCreateAPIView):
    serializer_class = EmployeeSerializer
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = Employee.objects.select_related(
            "company",
            "created_by",
        )

        company_id = self.request.query_params.get("company")

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                return queryset.filter(
                    company_id=company_id
                )

            return queryset

        queryset = queryset.filter(
            company__memberships__user=user,
            company__memberships__is_active=True,
        )

        if company_id:
            queryset = queryset.filter(
                company_id=company_id
            )

        return queryset.distinct()

    def perform_create(self, serializer):
        company = serializer.validated_data["company"]

        if not user_can_access_company(
            self.request.user,
            company,
        ):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "You do not have access to this company."
            )

        serializer.save(
            created_by=self.request.user,
        )


class EmployeeDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = EmployeeSerializer
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = Employee.objects.select_related(
            "company",
            "created_by",
        )

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            return queryset

        return queryset.filter(
            company__memberships__user=user,
            company__memberships__is_active=True,
        ).distinct()


class PayrollPeriodListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = PayrollPeriodSerializer
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = PayrollPeriod.objects.select_related(
            "company",
            "created_by",
        )

        company_id = self.request.query_params.get("company")

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                return queryset.filter(
                    company_id=company_id
                )

            return queryset

        queryset = queryset.filter(
            company__memberships__user=user,
            company__memberships__is_active=True,
        )

        if company_id:
            queryset = queryset.filter(
                company_id=company_id
            )

        return queryset.distinct()

    def perform_create(self, serializer):
        company = serializer.validated_data["company"]

        if not user_can_access_company(
            self.request.user,
            company,
        ):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "You do not have access to this company."
            )

        serializer.save(
            created_by=self.request.user,
        )


class PayrollPeriodDetailView(
    generics.RetrieveUpdateAPIView
):
    serializer_class = PayrollPeriodSerializer
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = PayrollPeriod.objects.select_related(
            "company",
            "created_by",
        )

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            return queryset

        return queryset.filter(
            company__memberships__user=user,
            company__memberships__is_active=True,
        ).distinct()


class PayrollEarningTypeListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = PayrollEarningTypeSerializer
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = PayrollEarningType.objects.select_related(
            "company",
        )

        company_id = self.request.query_params.get("company")

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                return queryset.filter(
                    company_id=company_id
                )

            return queryset

        queryset = queryset.filter(
            company__memberships__user=user,
            company__memberships__is_active=True,
        )

        if company_id:
            queryset = queryset.filter(
                company_id=company_id
            )

        return queryset.distinct()

    def perform_create(self, serializer):
        company = serializer.validated_data["company"]

        if not user_can_access_company(
            self.request.user,
            company,
        ):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "You do not have access to this company."
            )

        serializer.save()


class PayrollEarningListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = PayrollEarningSerializer
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = PayrollEarning.objects.select_related(
            "payroll_period",
            "employee",
            "earning_type",
        )

        company_id = self.request.query_params.get("company")

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                return queryset.filter(
                    payroll_period__company_id=company_id
                )

            return queryset

        queryset = queryset.filter(
            payroll_period__company__memberships__user=user,
            payroll_period__company__memberships__is_active=True,
        )

        if company_id:
            queryset = queryset.filter(
                payroll_period__company_id=company_id
            )

        return queryset.distinct()

    def perform_create(self, serializer):
        payroll_period = serializer.validated_data[
            "payroll_period"
        ]

        if not user_can_access_company(
            self.request.user,
            payroll_period.company,
        ):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "You do not have access to this company."
            )

        serializer.save()


class PayrollDeductionTypeListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = PayrollDeductionTypeSerializer
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = PayrollDeductionType.objects.select_related(
            "company",
        )

        company_id = self.request.query_params.get("company")

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                return queryset.filter(
                    company_id=company_id
                )

            return queryset

        queryset = queryset.filter(
            company__memberships__user=user,
            company__memberships__is_active=True,
        )

        if company_id:
            queryset = queryset.filter(
                company_id=company_id
            )

        return queryset.distinct()

    def perform_create(self, serializer):
        company = serializer.validated_data["company"]

        if not user_can_access_company(
            self.request.user,
            company,
        ):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "You do not have access to this company."
            )

        serializer.save()


class PayrollDeductionListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = PayrollDeductionSerializer
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = PayrollDeduction.objects.select_related(
            "payroll_period",
            "employee",
            "deduction_type",
        )

        company_id = self.request.query_params.get("company")

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                return queryset.filter(
                    payroll_period__company_id=company_id
                )

            return queryset

        queryset = queryset.filter(
            payroll_period__company__memberships__user=user,
            payroll_period__company__memberships__is_active=True,
        )

        if company_id:
            queryset = queryset.filter(
                payroll_period__company_id=company_id
            )

        return queryset.distinct()

    def perform_create(self, serializer):
        payroll_period = serializer.validated_data[
            "payroll_period"
        ]

        if not user_can_access_company(
            self.request.user,
            payroll_period.company,
        ):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "You do not have access to this company."
            )

        serializer.save()


class PayrollTaxBandListCreateView(generics.ListCreateAPIView):
    """List and create company-specific Liberia PAYE tax bands."""

    serializer_class = PayrollTaxBandSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = PayrollTaxBand.objects.select_related("company")
        company_id = self.request.query_params.get("company")

        if user.is_superuser or user.role in ["OWNER", "ADMIN"]:
            if company_id:
                return queryset.filter(company_id=company_id)
            return queryset

        queryset = queryset.filter(
            company__memberships__user=user,
            company__memberships__is_active=True,
        )
        if company_id:
            queryset = queryset.filter(company_id=company_id)
        return queryset.distinct()

    def perform_create(self, serializer):
        company = serializer.validated_data["company"]
        if not user_can_access_company(self.request.user, company):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have access to this company.")
        serializer.save()


class PayrollTaxBandDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update one company-specific PAYE tax band."""

    serializer_class = PayrollTaxBandSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = PayrollTaxBand.objects.select_related("company")

        if user.is_superuser or user.role in ["OWNER", "ADMIN"]:
            return queryset

        return queryset.filter(
            company__memberships__user=user,
            company__memberships__is_active=True,
        ).distinct()


class PayrollAbsenceListCreateView(generics.ListCreateAPIView):
    """List and create unpaid absence records for payroll periods."""

    serializer_class = PayrollAbsenceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = PayrollAbsence.objects.select_related(
            "payroll_period",
            "employee",
        )
        company_id = self.request.query_params.get("company")
        period_id = self.request.query_params.get("period")
        employee_id = self.request.query_params.get("employee")

        if user.is_superuser or user.role in ["OWNER", "ADMIN"]:
            if company_id:
                queryset = queryset.filter(
                    payroll_period__company_id=company_id
                )
            if period_id:
                queryset = queryset.filter(payroll_period_id=period_id)
            if employee_id:
                queryset = queryset.filter(employee_id=employee_id)
            return queryset

        queryset = queryset.filter(
            payroll_period__company__memberships__user=user,
            payroll_period__company__memberships__is_active=True,
        )
        if company_id:
            queryset = queryset.filter(
                payroll_period__company_id=company_id
            )
        if period_id:
            queryset = queryset.filter(payroll_period_id=period_id)
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset.distinct()

    def perform_create(self, serializer):
        payroll_period = serializer.validated_data["payroll_period"]

        if not user_can_access_company(
            self.request.user, payroll_period.company
        ):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have access to this company.")

        if payroll_period.status != PayrollPeriod.Status.DRAFT:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                "Absence records can only be added while the payroll period is in DRAFT status."
            )

        serializer.save()


class PayrollAbsenceDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update an absence record while its period is editable."""

    serializer_class = PayrollAbsenceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = PayrollAbsence.objects.select_related(
            "payroll_period",
            "employee",
        )

        if user.is_superuser or user.role in ["OWNER", "ADMIN"]:
            return queryset

        return queryset.filter(
            payroll_period__company__memberships__user=user,
            payroll_period__company__memberships__is_active=True,
        ).distinct()

    def perform_update(self, serializer):
        absence = self.get_object()
        if absence.payroll_period.status != PayrollPeriod.Status.DRAFT:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                "Absence records can only be changed while the payroll period is in DRAFT status."
            )
        serializer.save()


class PayrollRecordListView(generics.ListAPIView):
    serializer_class = PayrollRecordSerializer
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = PayrollRecord.objects.select_related(
            "payroll_period",
            "employee",
        ).prefetch_related(
            "earning_lines",
            "deduction_lines",
        )

        company_id = self.request.query_params.get("company")
        period_id = self.request.query_params.get("period")

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                queryset = queryset.filter(
                    payroll_period__company_id=company_id
                )

            if period_id:
                queryset = queryset.filter(
                    payroll_period_id=period_id
                )

            return queryset

        queryset = queryset.filter(
            payroll_period__company__memberships__user=user,
            payroll_period__company__memberships__is_active=True,
        )

        if company_id:
            queryset = queryset.filter(
                payroll_period__company_id=company_id
            )

        if period_id:
            queryset = queryset.filter(
                payroll_period_id=period_id
            )

        return queryset.distinct()


class PayrollRecordDetailView(
    generics.RetrieveAPIView
):
    serializer_class = PayrollRecordSerializer
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = PayrollRecord.objects.select_related(
            "payroll_period",
            "employee",
        ).prefetch_related(
            "earning_lines",
            "deduction_lines",
        )

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            return queryset

        return queryset.filter(
            payroll_period__company__memberships__user=user,
            payroll_period__company__memberships__is_active=True,
        ).distinct()


class ProcessPayrollView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    @transaction.atomic
    def post(self, request, pk):
        try:
            period = PayrollPeriod.objects.select_related(
                "company"
            ).get(pk=pk)
        except PayrollPeriod.DoesNotExist:
            return Response(
                {"detail": "Payroll period not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not user_can_access_company(
            request.user,
            period.company,
        ):
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            records = PayrollService.process_payroll(
                payroll_period=period,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        period.refresh_from_db()

        return Response(
            {
                "message": "Payroll processed successfully.",
                "period": PayrollPeriodSerializer(period).data,
                "records": PayrollRecordSerializer(
                    records,
                    many=True,
                ).data,
                "summary": PayrollService.payroll_summary(
                    payroll_period=period,
                ),
            },
            status=status.HTTP_200_OK,
        )


class PayrollSummaryView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request, pk):
        try:
            period = PayrollPeriod.objects.select_related(
                "company"
            ).get(pk=pk)
        except PayrollPeriod.DoesNotExist:
            return Response(
                {"detail": "Payroll period not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not user_can_access_company(
            request.user,
            period.company,
        ):
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(
            PayrollService.payroll_summary(
                payroll_period=period,
            ),
            status=status.HTTP_200_OK,
        )


class ApprovePayrollView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request, pk):
        try:
            period = PayrollPeriod.objects.select_related(
                "company"
            ).get(pk=pk)
        except PayrollPeriod.DoesNotExist:
            return Response(
                {"detail": "Payroll period not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not user_can_access_company(
            request.user,
            period.company,
        ):
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            period = PayrollApprovalService.approve_payroll(
                payroll_period=period,
                approved_by=request.user,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "Payroll approved successfully.",
                "period": PayrollPeriodSerializer(period).data,
            }
        )


class ReturnPayrollToDraftView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request, pk):
        try:
            period = PayrollPeriod.objects.select_related(
                "company"
            ).get(pk=pk)
        except PayrollPeriod.DoesNotExist:
            return Response(
                {"detail": "Payroll period not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not user_can_access_company(
            request.user,
            period.company,
        ):
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            period = PayrollApprovalService.return_to_draft(
                payroll_period=period,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "Payroll returned to draft.",
                "period": PayrollPeriodSerializer(period).data,
            }
        )


class LockPayrollView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request, pk):
        try:
            period = PayrollPeriod.objects.select_related(
                "company"
            ).get(pk=pk)
        except PayrollPeriod.DoesNotExist:
            return Response(
                {"detail": "Payroll period not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not user_can_access_company(
            request.user,
            period.company,
        ):
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            period = PayrollApprovalService.lock_payroll(
                payroll_period=period,
                locked_by=request.user,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "Payroll locked successfully.",
                "period": PayrollPeriodSerializer(period).data,
            }
        )


class PostPayrollToAccountingView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request, pk):
        try:
            period = PayrollPeriod.objects.select_related(
                "company"
            ).get(pk=pk)
        except PayrollPeriod.DoesNotExist:
            return Response(
                {"detail": "Payroll period not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not user_can_access_company(
            request.user,
            period.company,
        ):
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            entry = PayrollAccountingService.post_payroll(
                payroll_period=period,
                posted_by=request.user,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        period.refresh_from_db()

        return Response(
            {
                "message": "Payroll posted to accounting successfully.",
                "journal_entry_id": entry.id,
                "journal_reference": entry.reference,
                "period": PayrollPeriodSerializer(period).data,
            },
            status=status.HTTP_200_OK,
        )


class PayPayrollView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request, pk):
        try:
            period = PayrollPeriod.objects.select_related(
                "company"
            ).get(pk=pk)
        except PayrollPeriod.DoesNotExist:
            return Response(
                {"detail": "Payroll period not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not user_can_access_company(
            request.user,
            period.company,
        ):
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        payment_method = request.data.get(
            "payment_method",
            "BANK",
        )

        try:
            entry = PayrollPaymentService.pay_payroll(
                payroll_period=period,
                paid_by=request.user,
                payment_method=payment_method,
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "Payroll payment recorded successfully.",
                "journal_entry_id": entry.id,
                "journal_reference": entry.reference,
            },
            status=status.HTTP_200_OK,
        )


class ExportPayrollCSVView(APIView):
    """
    Export the finalized payroll register for an approved or locked
    payroll period as a CSV file that can be opened in Excel.

    The export is generated from PayrollRecord snapshots, so the values
    submitted from this endpoint are the same finalized payroll values
    that were approved/locked for the selected company and period.
    """

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request, pk):
        try:
            period = PayrollPeriod.objects.select_related(
                "company"
            ).get(pk=pk)
        except PayrollPeriod.DoesNotExist:
            return Response(
                {"detail": "Payroll period not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not user_can_access_company(
            request.user,
            period.company,
        ):
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if period.status not in [
            PayrollPeriod.Status.APPROVED,
            PayrollPeriod.Status.LOCKED,
        ]:
            return Response(
                {
                    "detail": (
                        "Payroll can only be exported after it has "
                        "been approved."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        records = list(
            PayrollRecord.objects.filter(
                payroll_period=period,
            )
            .select_related(
                "employee",
            )
            .order_by(
                "employee__first_name",
                "employee__last_name",
                "employee__id",
            )
        )

        if not records:
            return Response(
                {"detail": "There are no payroll records to export."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        safe_company = re.sub(
            r"[^A-Za-z0-9_-]+",
            "_",
            period.company.name,
        ).strip("_") or "company"

        safe_period = re.sub(
            r"[^A-Za-z0-9_-]+",
            "_",
            period.name,
        ).strip("_") or f"period_{period.id}"

        filename = f"{safe_company}_{safe_period}_Payroll.csv"

        response = HttpResponse(
            content_type="text/csv; charset=utf-8",
        )
        response["Content-Disposition"] = (
            f'attachment; filename="{filename}"'
        )

        # UTF-8 BOM helps Excel detect Unicode company/employee names.
        response.write("\ufeff")

        writer = csv.writer(response)

        writer.writerow([
            "Company",
            "Employee Number",
            "Employee Name",
            "Department",
            "Position",
            "Payroll Period",
            "Start Date",
            "End Date",
            "Pay Date",
            "Currency",
            "Exchange Rate",
            "Basic Salary",
            "Total Earnings",
            "Days Absent",
            "Absence Deduction",
            "Gross Pay",
            "Taxable Income",
            "Annual Taxable Income",
            "PAYE",
            "Employee NASSCORP",
            "Employer NASSCORP",
            "Total Deductions",
            "Net Pay",
            "Employer Cost",
        ])

        currency = getattr(
            period.company,
            "currency",
            None,
        ) or "USD"

        for record in records:
            employee = record.employee

            writer.writerow([
                period.company.name,
                employee.employee_number,
                employee.full_name,
                employee.department,
                employee.position,
                period.name,
                period.start_date,
                period.end_date,
                period.pay_date,
                currency,
                getattr(record, "exchange_rate", "1.000000"),
                record.basic_salary,
                record.total_earnings,
                getattr(record, "absent_days", "0.00"),
                getattr(record, "absence_deduction", "0.00"),
                record.gross_pay,
                getattr(record, "taxable_income", "0.00"),
                getattr(record, "annual_taxable_income", "0.00"),
                getattr(record, "paye_tax", "0.00"),
                getattr(record, "social_security_employee", "0.00"),
                getattr(record, "social_security_employer", "0.00"),
                record.total_deductions,
                record.net_pay,
                record.employer_cost,
            ])

        return response


class PayrollPayslipView(APIView):
    """
    Generate a one-page employee payslip PDF from a finalized
    PayrollRecord snapshot.

    Payslips are available only for APPROVED or LOCKED payroll periods.
    The company identity is always taken from the payroll period's
    company relationship; it is never hardcoded.
    """

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    @staticmethod
    def _money(value):
        try:
            return f"{float(value or 0):,.2f}"
        except (TypeError, ValueError):
            return "0.00"

    @staticmethod
    def _currency_symbol(currency):
        return {
            "USD": "$",
            "LRD": "L$",
        }.get(
            str(currency or "USD").upper(),
            f"{str(currency or 'USD').upper()} ",
        ).strip()

    @staticmethod
    def _date_label(value):
        if not value:
            return "—"
        return value.strftime("%B %d, %Y").replace(" 0", " ")

    def get(self, request, period_id, record_id):
        try:
            record = (
                PayrollRecord.objects
                .select_related(
                    "payroll_period__company",
                    "employee",
                )
                .prefetch_related(
                    "earning_lines__earning_type",
                    "deduction_lines__deduction_type",
                )
                .get(
                    id=record_id,
                    payroll_period_id=period_id,
                )
            )
        except PayrollRecord.DoesNotExist:
            return Response(
                {"detail": "Payroll record not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        period = record.payroll_period
        company = period.company
        employee = record.employee

        if not user_can_access_company(
            request.user,
            company,
        ):
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if period.status not in [
            PayrollPeriod.Status.APPROVED,
            PayrollPeriod.Status.LOCKED,
        ]:
            return Response(
                {
                    "detail": (
                        "Payslips can only be generated after "
                        "payroll has been approved."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if employee.company_id != company.id:
            return Response(
                {
                    "detail": (
                        "This employee does not belong to the payroll "
                        "company."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        currency = getattr(
            company,
            "currency",
            None,
        ) or "USD"
        symbol = self._currency_symbol(currency)

        buffer = BytesIO()

        from reportlab.lib import colors
        from reportlab.lib.enums import TA_LEFT, TA_RIGHT
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import (
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )

        page_width, page_height = landscape(A4)

        document = SimpleDocTemplate(
            buffer,
            pagesize=(page_width, page_height),
            rightMargin=18 * mm,
            leftMargin=18 * mm,
            topMargin=14 * mm,
            bottomMargin=14 * mm,
            title=(
                f"Payslip - {employee.full_name} - {period.name}"
            ),
            author="Hindsfeet Accounting",
        )

        styles = getSampleStyleSheet()

        company_style = ParagraphStyle(
            "PayslipCompany",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=19,
            alignment=TA_LEFT,
            textColor=colors.black,
            spaceAfter=3,
        )

        title_style = ParagraphStyle(
            "PayslipTitle",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            alignment=TA_LEFT,
            textColor=colors.black,
            spaceBefore=7,
            spaceAfter=9,
        )

        body_style = ParagraphStyle(
            "PayslipBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=12,
            textColor=colors.black,
        )

        body_bold = ParagraphStyle(
            "PayslipBodyBold",
            parent=body_style,
            fontName="Helvetica-Bold",
        )

        section_style = ParagraphStyle(
            "PayslipSection",
            parent=body_bold,
            fontSize=9.5,
            leading=12,
        )

        amount_style = ParagraphStyle(
            "PayslipAmount",
            parent=body_style,
            alignment=TA_RIGHT,
            fontSize=9.5,
        )

        amount_bold = ParagraphStyle(
            "PayslipAmountBold",
            parent=amount_style,
            fontName="Helvetica-Bold",
        )

        story = []

        # ---------------------------------------------------------
        # COMPANY HEADER
        # ---------------------------------------------------------
        company_display_name = (
            str(getattr(company, "name", "") or "Company").strip()
        )
        legal_name = str(
            getattr(company, "legal_name", "") or ""
        ).strip()

        if legal_name:
            company_display_name = (
                f"{company_display_name} - {legal_name}"
            )

        company_name = escape(company_display_name)

        header_table = Table(
            [[
                Paragraph(company_name, company_style),
            ]],
            colWidths=[page_width - 36 * mm],
        )

        header_table.setStyle(
            TableStyle([
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    colors.HexColor("#FFF200"),
                ),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ])
        )

        story.append(header_table)

        company_details = []
        address = getattr(company, "address", "") or ""
        phone = getattr(company, "phone", "") or ""
        email = getattr(company, "email", "") or ""

        if address:
            company_details.append(escape(str(address)))

        contact_parts = [
            escape(str(part))
            for part in [phone, email]
            if part
        ]
        if contact_parts:
            company_details.append(" | ".join(contact_parts))

        if company_details:
            story.append(
                Spacer(1, 2),
            )
            story.append(
                Paragraph(
                    "<br/>".join(company_details),
                    body_style,
                )
            )

        story.append(
            Paragraph(
                f"PAYSLIP FOR THE MONTH ENDED "
                f"{self._date_label(period.end_date).upper()}",
                title_style,
            )
        )

        story.append(
            Table(
                [["", ""]],
                colWidths=[page_width - 36 * mm, 0],
                rowHeights=[1],
                style=TableStyle([
                    (
                        "LINEBELOW",
                        (0, 0),
                        (-1, -1),
                        0.8,
                        colors.black,
                    ),
                ]),
            )
        )
        story.append(Spacer(1, 8))

        # ---------------------------------------------------------
        # EMPLOYEE INFORMATION
        # ---------------------------------------------------------
        employee_name = escape(
            str(
                getattr(employee, "full_name", "")
                or "Unknown Employee"
            )
        )
        employee_number = escape(
            str(
                getattr(employee, "employee_number", "")
                or "—"
            )
        )
        department = escape(
            str(
                getattr(employee, "department", "")
                or "—"
            )
        )
        position = escape(
            str(
                getattr(employee, "position", "")
                or "—"
            )
        )

        employee_info = Table(
            [
                [
                    Paragraph(
                        f"<b>Name:</b> {employee_name}",
                        body_style,
                    ),
                    Paragraph(
                        f"<b>Employee No.:</b> {employee_number}",
                        body_style,
                    ),
                ],
                [
                    Paragraph(
                        f"<b>Department:</b> {department}",
                        body_style,
                    ),
                    Paragraph(
                        f"<b>Position:</b> {position}",
                        body_style,
                    ),
                ],
            ],
            colWidths=[
                (page_width - 36 * mm) * 0.50,
                (page_width - 36 * mm) * 0.50,
            ],
        )
        employee_info.setStyle(
            TableStyle([
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ])
        )
        story.append(employee_info)
        story.append(Spacer(1, 7))

        usable_width = page_width - 36 * mm
        label_width = usable_width * 0.64
        amount_width = usable_width * 0.36

        def money_paragraph(value, bold=False):
            style = amount_bold if bold else amount_style
            return Paragraph(
                f"{symbol}{self._money(value)}",
                style,
            )

        def row(label, value, bold=False):
            label_style = body_bold if bold else body_style
            return [
                Paragraph(str(label), label_style),
                money_paragraph(value, bold=bold),
            ]

        # ---------------------------------------------------------
        # EARNINGS
        # ---------------------------------------------------------
        earnings_rows = [
            [
                Paragraph("Earnings and Hours", section_style),
                Paragraph("Amount", section_style),
            ],
            row("Basic Remuneration", record.basic_salary),
        ]

        for earning_line in record.earning_lines.all():
            earning_name = escape(
                str(
                    getattr(
                        earning_line.earning_type,
                        "name",
                        None,
                    )
                    or earning_line.description
                    or "Other Earnings"
                )
            )
            earnings_rows.append(
                row(
                    earning_name,
                    earning_line.amount,
                )
            )

        absence_deduction = getattr(
            record,
            "absence_deduction",
            0,
        )
        absent_days = getattr(
            record,
            "absent_days",
            0,
        )

        earnings_rows.append(
            row(
                f"Absent Days Deduction ({self._money(absent_days)} days)",
                absence_deduction,
            )
        )
        earnings_rows.append(
            row(
                "Gross Remuneration",
                record.gross_pay,
                bold=True,
            )
        )

        earnings_table = Table(
            earnings_rows,
            colWidths=[label_width, amount_width],
            repeatRows=1,
        )
        earnings_table.setStyle(
            TableStyle([
                ("LINEBELOW", (0, 0), (-1, 0), 0.7, colors.black),
                ("LINEBELOW", (0, -1), (-1, -1), 0.7, colors.black),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ])
        )
        story.append(earnings_table)
        story.append(Spacer(1, 7))

        # ---------------------------------------------------------
        # WITHHOLDINGS
        # ---------------------------------------------------------
        withholding_rows = [
            [
                Paragraph("Withholdings", section_style),
                Paragraph("Amount", section_style),
            ],
            row(
                "Income Tax",
                getattr(record, "paye_tax", 0),
            ),
            row(
                "Social Security",
                getattr(record, "social_security_employee", 0),
            ),
        ]

        reserved_codes = {
            "PAYE",
            "NASSCORP",
            "ABSENCE",
        }

        for deduction_line in record.deduction_lines.all():
            code = str(
                getattr(
                    deduction_line.deduction_type,
                    "code",
                    "",
                )
                or ""
            ).upper()

            if code in reserved_codes:
                continue

            deduction_name = escape(
                str(
                    getattr(
                        deduction_line.deduction_type,
                        "name",
                        None,
                    )
                    or deduction_line.description
                    or "Other Deduction"
                )
            )

            withholding_rows.append(
                row(
                    deduction_name,
                    deduction_line.amount,
                )
            )

        withholding_rows.append(
            row(
                "Total Deductions",
                record.total_deductions,
                bold=True,
            )
        )
        withholding_rows.append(
            row(
                "Net Pay",
                record.net_pay,
                bold=True,
            )
        )

        withholding_table = Table(
            withholding_rows,
            colWidths=[label_width, amount_width],
            repeatRows=1,
        )
        withholding_table.setStyle(
            TableStyle([
                ("LINEBELOW", (0, 0), (-1, 0), 0.7, colors.black),
                ("LINEBELOW", (0, -2), (-1, -2), 0.7, colors.black),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ])
        )
        story.append(withholding_table)
        story.append(Spacer(1, 16))

        signature_table = Table(
            [[
                Paragraph(
                    "Signed: __________________________",
                    body_style,
                ),
                Paragraph(
                    "Date: __________________________",
                    body_style,
                ),
            ]],
            colWidths=[usable_width * 0.58, usable_width * 0.42],
        )
        signature_table.setStyle(
            TableStyle([
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ])
        )
        story.append(signature_table)

        document.build(story)

        buffer.seek(0)

        safe_employee = re.sub(
            r"[^A-Za-z0-9_-]+",
            "_",
            employee_name,
        ).strip("_") or f"employee_{employee.id}"

        safe_period = re.sub(
            r"[^A-Za-z0-9_-]+",
            "_",
            period.name,
        ).strip("_") or f"period_{period.id}"

        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/pdf",
        )
        response["Content-Disposition"] = (
            f'attachment; filename="Payslip_{safe_employee}_'
            f'{safe_period}.pdf"'
        )

        return response


class PayrollRemittanceListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = PayrollRemittanceSerializer
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = PayrollRemittance.objects.select_related(
            "payroll_period",
            "deduction_type",
            "created_by",
        )

        company_id = self.request.query_params.get("company")
        period_id = self.request.query_params.get("period")

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                queryset = queryset.filter(
                    payroll_period__company_id=company_id
                )

            if period_id:
                queryset = queryset.filter(
                    payroll_period_id=period_id
                )

            return queryset

        queryset = queryset.filter(
            payroll_period__company__memberships__user=user,
            payroll_period__company__memberships__is_active=True,
        )

        if company_id:
            queryset = queryset.filter(
                payroll_period__company_id=company_id
            )

        if period_id:
            queryset = queryset.filter(
                payroll_period_id=period_id
            )

        return queryset.distinct()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        payroll_period = data["payroll_period"]
        deduction_type = data["deduction_type"]

        if not user_can_access_company(
            request.user,
            payroll_period.company,
        ):
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            remittance, journal_entry = (
                PayrollRemittanceService.remit_deduction(
                    payroll_period=payroll_period,
                    deduction_type=deduction_type,
                    amount=data["amount"],
                    remittance_date=data["remittance_date"],
                    reference=data["reference"],
                    created_by=request.user,
                    payment_method=data.get(
                        "payment_method",
                        "BANK",
                    ),
                    description=data.get(
                        "description",
                        "",
                    ),
                )
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "Payroll remittance recorded successfully.",
                "remittance": PayrollRemittanceSerializer(
                    remittance
                ).data,
                "journal_entry_id": journal_entry.id,
                "journal_reference": journal_entry.reference,
            },
            status=status.HTTP_201_CREATED,
        )

    