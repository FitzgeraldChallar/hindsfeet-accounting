from datetime import date
from decimal import Decimal

from django.db import transaction
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from companies.models import CompanyMembership

from .models import Account, JournalEntry
from .permissions import CanAccessCompanyAccounting
from .serializers import (
    AccountSerializer,
    JournalEntrySerializer,
)
from .services import AccountingService
from .pdf import (
    balance_sheet_pdf,
    cash_flow_pdf,
    general_ledger_pdf,
    income_statement_pdf,
    trial_balance_pdf,
)


# ============================================================
# COMPANY ACCESS
# ============================================================

def user_can_access_company(user, company):
    if user.is_superuser:
        return True

    if user.role in ["OWNER", "ADMIN"]:
        return True

    return CompanyMembership.objects.filter(
        user=user,
        company=company,
        is_active=True,
    ).exists()


def get_company_for_request(request):
    """
    Retrieve and validate the company supplied through
    the ?company= query parameter.
    """

    company_id = request.query_params.get("company")

    if not company_id:
        return None, Response(
            {
                "detail": "Company is required."
            },
            status=400,
        )

    try:
        from companies.models import Company

        company = Company.objects.get(
            pk=company_id
        )

    except Company.DoesNotExist:
        return None, Response(
            {
                "detail": "Company not found."
            },
            status=404,
        )

    if not user_can_access_company(
        request.user,
        company,
    ):
        raise PermissionDenied(
            "You do not have access to this company."
        )

    return company, None


# ============================================================
# ACCOUNTS
# ============================================================

class AccountListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = AccountSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = Account.objects.select_related(
            "company",
            "parent",
        )

        company_id = self.request.query_params.get(
            "company"
        )

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
            raise PermissionDenied(
                "You do not have access to this company."
            )

        serializer.save()


class AccountDetailView(
    generics.RetrieveUpdateAPIView
):
    serializer_class = AccountSerializer

    permission_classes = [
        permissions.IsAuthenticated,
        CanAccessCompanyAccounting,
    ]

    def get_queryset(self):
        return Account.objects.select_related(
            "company",
            "parent",
        )


# ============================================================
# JOURNAL ENTRIES
# ============================================================

class JournalEntryListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = JournalEntrySerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = JournalEntry.objects.select_related(
            "company",
            "created_by",
            "posted_by",
        ).prefetch_related(
            "lines__account",
        )

        company_id = self.request.query_params.get(
            "company"
        )

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
            raise PermissionDenied(
                "You do not have access to this company."
            )

        serializer.save(
            created_by=self.request.user,
        )


class JournalEntryDetailView(
    generics.RetrieveAPIView
):
    serializer_class = JournalEntrySerializer

    permission_classes = [
        permissions.IsAuthenticated,
        CanAccessCompanyAccounting,
    ]

    def get_queryset(self):
        return JournalEntry.objects.select_related(
            "company",
            "created_by",
            "posted_by",
        ).prefetch_related(
            "lines__account",
        )


class JournalEntryPostView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    @transaction.atomic
    def post(self, request, pk):

        try:
            entry = (
                JournalEntry.objects
                .select_for_update()
                .get(pk=pk)
            )

        except JournalEntry.DoesNotExist:
            return Response(
                {
                    "detail": "Journal entry not found."
                },
                status=404,
            )

        if not user_can_access_company(
            request.user,
            entry.company,
        ):
            raise PermissionDenied(
                "You do not have access to this company."
            )

        try:
            entry = AccountingService.post_journal_entry(
                entry=entry,
                user=request.user,
            )

        except ValueError as exc:
            return Response(
                {
                    "detail": str(exc)
                },
                status=400,
            )

        return Response(
            JournalEntrySerializer(entry).data
        )


# ============================================================
# GENERAL LEDGER
# ============================================================

class GeneralLedgerView(APIView):

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request):

        company, error = get_company_for_request(
            request
        )

        if error:
            return error

        start_date = request.query_params.get(
            "start_date"
        )

        end_date = request.query_params.get(
            "end_date"
        )

        account_id = request.query_params.get(
            "account"
        )

        account = None

        if account_id:

            try:
                account = Account.objects.get(
                    pk=account_id,
                    company=company,
                )

            except Account.DoesNotExist:
                return Response(
                    {
                        "detail": "Account not found."
                    },
                    status=404,
                )

        ledger = AccountingService.general_ledger(
            company=company,
            start_date=start_date,
            end_date=end_date,
            account=account,
        )

        return Response({
            "company": company.id,
            "company_name": company.name,
            "start_date": start_date,
            "end_date": end_date,
            "accounts": ledger,
        })


# ============================================================
# TRIAL BALANCE
# ============================================================

class TrialBalanceView(APIView):

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request):

        company, error = get_company_for_request(
            request
        )

        if error:
            return error

        start_date = request.query_params.get(
            "start_date"
        )

        end_date = request.query_params.get(
            "end_date"
        )

        trial_balance = AccountingService.trial_balance(
            company=company,
            start_date=start_date,
            end_date=end_date,
        )

        total_debit = sum(
            (
                item["debit"]
                for item in trial_balance
            ),
            Decimal("0.00"),
        )

        total_credit = sum(
            (
                item["credit"]
                for item in trial_balance
            ),
            Decimal("0.00"),
        )

        return Response({
            "company": company.id,
            "company_name": company.name,
            "start_date": start_date,
            "end_date": end_date,
            "accounts": trial_balance,
            "total_debit": total_debit,
            "total_credit": total_credit,
            "is_balanced": (
                total_debit == total_credit
            ),
        })


# ============================================================
# INCOME STATEMENT
# ============================================================

class IncomeStatementView(APIView):

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request):

        company, error = get_company_for_request(
            request
        )

        if error:
            return error

        start_date = request.query_params.get(
            "start_date"
        )

        end_date = request.query_params.get(
            "end_date"
        )

        report = AccountingService.income_statement(
            company=company,
            start_date=start_date,
            end_date=end_date,
        )

        return Response({
            "company": company.id,
            "company_name": company.name,
            "start_date": start_date,
            "end_date": end_date,
            **report,
        })


# ============================================================
# BALANCE SHEET
# ============================================================

class BalanceSheetView(APIView):

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request):

        company, error = get_company_for_request(
            request
        )

        if error:
            return error

        as_of_date = request.query_params.get(
            "as_of_date"
        )

        report = AccountingService.balance_sheet(
            company=company,
            as_of_date=as_of_date,
        )

        return Response({
            "company": company.id,
            "company_name": company.name,
            "as_of_date": as_of_date,
            **report,
        })


# ============================================================
# CASH FLOW STATEMENT
# ============================================================

class CashFlowStatementView(APIView):

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request):

        company, error = get_company_for_request(
            request
        )

        if error:
            return error

        start_date = request.query_params.get(
            "start_date"
        )

        end_date = request.query_params.get(
            "end_date"
        )

        report = AccountingService.cash_flow_statement(
            company=company,
            start_date=start_date,
            end_date=end_date,
        )

        return Response({
            "company": company.id,
            "company_name": company.name,
            "start_date": start_date,
            "end_date": end_date,
            **report,
        })


# ============================================================
# PDF REPORTS
# ============================================================

class GeneralLedgerPDFView(APIView):

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request):

        company, error = get_company_for_request(
            request
        )

        if error:
            return error

        start_date = request.query_params.get(
            "start_date"
        )

        end_date = request.query_params.get(
            "end_date"
        )

        account_id = request.query_params.get(
            "account"
        )

        account = None

        if account_id:
            try:
                account = Account.objects.get(
                    pk=account_id,
                    company=company,
                )
            except Account.DoesNotExist:
                return Response(
                    {
                        "detail": "Account not found."
                    },
                    status=404,
                )

        return general_ledger_pdf(
            company=company,
            start_date=start_date,
            end_date=end_date,
            account=account,
        )


class TrialBalancePDFView(APIView):

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request):

        company, error = get_company_for_request(
            request
        )

        if error:
            return error

        start_date = request.query_params.get(
            "start_date"
        )

        end_date = request.query_params.get(
            "end_date"
        )

        return trial_balance_pdf(
            company=company,
            start_date=start_date,
            end_date=end_date,
        )


class IncomeStatementPDFView(APIView):

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request):

        company, error = get_company_for_request(
            request
        )

        if error:
            return error

        start_date = request.query_params.get(
            "start_date"
        )

        end_date = request.query_params.get(
            "end_date"
        )

        return income_statement_pdf(
            company=company,
            start_date=start_date,
            end_date=end_date,
        )


class BalanceSheetPDFView(APIView):

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request):

        company, error = get_company_for_request(
            request
        )

        if error:
            return error

        as_of_date = request.query_params.get(
            "as_of_date"
        )

        return balance_sheet_pdf(
            company=company,
            as_of_date=as_of_date,
        )


class CashFlowPDFView(APIView):

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request):

        company, error = get_company_for_request(
            request
        )

        if error:
            return error

        start_date = request.query_params.get(
            "start_date"
        )

        end_date = request.query_params.get(
            "end_date"
        )

        return cash_flow_pdf(
            company=company,
            start_date=start_date,
            end_date=end_date,
        )