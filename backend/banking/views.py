from django.db import transaction

from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from companies.models import CompanyMembership

from accounting.models import Account

from .models import BankAccount, BankTransaction
from .serializers import (
    BankAccountSerializer,
    BankTransactionSerializer,
)
from .services import BankingService


# ============================================================
# COMPANY ACCESS
# ============================================================

def user_can_access_company(user, company):
    """
    Determine whether the authenticated user can access
    the selected company.
    """

    if user.is_superuser:
        return True

    if user.role in [
        "OWNER",
        "ADMIN",
    ]:
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

    company_id = request.query_params.get(
        "company"
    )

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
# BANK ACCOUNTS
# ============================================================

class BankAccountListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = BankAccountSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = (
            BankAccount.objects
            .select_related(
                "company",
                "accounting_account",
            )
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
        company = serializer.validated_data[
            "company"
        ]

        if not user_can_access_company(
            self.request.user,
            company,
        ):
            raise PermissionDenied(
                "You do not have access to this company."
            )

        bank_name = serializer.validated_data[
            "bank_name"
        ]

        account_name = serializer.validated_data[
            "account_name"
        ]

        accounting_account = (
            BankingService.create_accounting_account(
                company=company,
                bank_name=bank_name,
                account_name=account_name,
            )
        )

        serializer.save(
            accounting_account=accounting_account
        )


class BankAccountDetailView(
    generics.RetrieveUpdateAPIView
):
    serializer_class = BankAccountSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = (
            BankAccount.objects
            .select_related(
                "company",
                "accounting_account",
            )
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

    def perform_update(self, serializer):
        bank_account = self.get_object()
        company = bank_account.company

        if not user_can_access_company(
            self.request.user,
            company,
        ):
            raise PermissionDenied(
                "You do not have access to this company."
            )

        accounting_account = (
            serializer.validated_data.get(
                "accounting_account",
                bank_account.accounting_account,
            )
        )

        if (
            accounting_account.company_id
            != company.id
        ):
            raise PermissionDenied(
                "Accounting account does not belong "
                "to the selected company."
            )

        if (
            accounting_account.account_type
            != Account.AccountType.ASSET
        ):
            raise PermissionDenied(
                "A bank account must be linked "
                "to an Asset accounting account."
            )

        serializer.save()


# ============================================================
# BANK TRANSACTIONS
# ============================================================

class BankTransactionListView(
    generics.ListAPIView
):
    serializer_class = BankTransactionSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = (
            BankTransaction.objects
            .select_related(
                "company",
                "bank_account",
                "journal_entry",
                "created_by",
            )
        )

        company_id = self.request.query_params.get(
            "company"
        )

        bank_account_id = (
            self.request.query_params.get(
                "bank_account"
            )
        )

        transaction_type = (
            self.request.query_params.get(
                "transaction_type"
            )
        )

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                queryset = queryset.filter(
                    company_id=company_id
                )

        else:
            queryset = queryset.filter(
                company__memberships__user=user,
                company__memberships__is_active=True,
            )

            if company_id:
                queryset = queryset.filter(
                    company_id=company_id
                )

        if bank_account_id:
            queryset = queryset.filter(
                bank_account_id=bank_account_id
            )

        if transaction_type:
            queryset = queryset.filter(
                transaction_type=transaction_type
            )

        return queryset.distinct()


# ============================================================
# DEPOSITS
# ============================================================

class BankDepositCreateView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    @transaction.atomic
    def post(self, request):

        company, error = get_company_for_request(
            request
        )

        if error:
            return error

        bank_account_id = request.data.get(
            "bank_account"
        )

        counter_account_id = request.data.get(
            "counter_account"
        )

        amount = request.data.get(
            "amount"
        )

        transaction_date = request.data.get(
            "transaction_date"
        )

        reference = request.data.get(
            "reference",
            "",
        )

        description = request.data.get(
            "description",
            "",
        )

        try:
            bank_account = (
                BankAccount.objects
                .select_related(
                    "company",
                    "accounting_account",
                )
                .get(
                    pk=bank_account_id,
                    company=company,
                )
            )

        except BankAccount.DoesNotExist:
            return Response(
                {
                    "detail": (
                        "Bank account not found "
                        "for this company."
                    )
                },
                status=404,
            )

        try:
            counter_account = Account.objects.get(
                pk=counter_account_id,
                company=company,
            )

        except Account.DoesNotExist:
            return Response(
                {
                    "detail": (
                        "Counter account not found "
                        "for this company."
                    )
                },
                status=404,
            )

        try:
            banking_transaction = (
                BankingService.create_transaction(
                    company=company,
                    bank_account=bank_account,
                    transaction_type=(
                        BankTransaction
                        .TransactionType
                        .DEPOSIT
                    ),
                    amount=amount,
                    transaction_date=transaction_date,
                    created_by=request.user,
                    counter_account=counter_account,
                    reference=reference,
                    description=description,
                )
            )

        except ValueError as exc:
            return Response(
                {
                    "detail": str(exc)
                },
                status=400,
            )

        return Response(
            BankTransactionSerializer(
                banking_transaction
            ).data,
            status=201,
        )


# ============================================================
# WITHDRAWALS
# ============================================================

class BankWithdrawalCreateView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    @transaction.atomic
    def post(self, request):

        company, error = get_company_for_request(
            request
        )

        if error:
            return error

        bank_account_id = request.data.get(
            "bank_account"
        )

        counter_account_id = request.data.get(
            "counter_account"
        )

        amount = request.data.get(
            "amount"
        )

        transaction_date = request.data.get(
            "transaction_date"
        )

        reference = request.data.get(
            "reference",
            "",
        )

        description = request.data.get(
            "description",
            "",
        )

        try:
            bank_account = (
                BankAccount.objects
                .select_related(
                    "company",
                    "accounting_account",
                )
                .get(
                    pk=bank_account_id,
                    company=company,
                )
            )

        except BankAccount.DoesNotExist:
            return Response(
                {
                    "detail": (
                        "Bank account not found "
                        "for this company."
                    )
                },
                status=404,
            )

        try:
            counter_account = Account.objects.get(
                pk=counter_account_id,
                company=company,
            )

        except Account.DoesNotExist:
            return Response(
                {
                    "detail": (
                        "Counter account not found "
                        "for this company."
                    )
                },
                status=404,
            )

        try:
            banking_transaction = (
                BankingService.create_transaction(
                    company=company,
                    bank_account=bank_account,
                    transaction_type=(
                        BankTransaction
                        .TransactionType
                        .WITHDRAWAL
                    ),
                    amount=amount,
                    transaction_date=transaction_date,
                    created_by=request.user,
                    counter_account=counter_account,
                    reference=reference,
                    description=description,
                )
            )

        except ValueError as exc:
            return Response(
                {
                    "detail": str(exc)
                },
                status=400,
            )

        return Response(
            BankTransactionSerializer(
                banking_transaction
            ).data,
            status=201,
        )


# ============================================================
# BANK FEES
# ============================================================

class BankFeeCreateView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    @transaction.atomic
    def post(self, request):

        company, error = get_company_for_request(
            request
        )

        if error:
            return error

        bank_account_id = request.data.get(
            "bank_account"
        )

        expense_account_id = request.data.get(
            "expense_account"
        )

        amount = request.data.get(
            "amount"
        )

        transaction_date = request.data.get(
            "transaction_date"
        )

        reference = request.data.get(
            "reference",
            "",
        )

        description = request.data.get(
            "description",
            "Bank fee",
        )

        try:
            bank_account = (
                BankAccount.objects
                .select_related(
                    "company",
                    "accounting_account",
                )
                .get(
                    pk=bank_account_id,
                    company=company,
                )
            )

        except BankAccount.DoesNotExist:
            return Response(
                {
                    "detail": (
                        "Bank account not found "
                        "for this company."
                    )
                },
                status=404,
            )

        try:
            expense_account = Account.objects.get(
                pk=expense_account_id,
                company=company,
            )

        except Account.DoesNotExist:
            return Response(
                {
                    "detail": (
                        "Expense account not found "
                        "for this company."
                    )
                },
                status=404,
            )

        if (
            expense_account.account_type
            != Account.AccountType.EXPENSE
        ):
            return Response(
                {
                    "detail": (
                        "Bank fees must be posted "
                        "to an Expense account."
                    )
                },
                status=400,
            )

        try:
            banking_transaction = (
                BankingService.create_transaction(
                    company=company,
                    bank_account=bank_account,
                    transaction_type=(
                        BankTransaction
                        .TransactionType
                        .BANK_FEE
                    ),
                    amount=amount,
                    transaction_date=transaction_date,
                    created_by=request.user,
                    counter_account=expense_account,
                    reference=reference,
                    description=description,
                )
            )

        except ValueError as exc:
            return Response(
                {
                    "detail": str(exc)
                },
                status=400,
            )

        return Response(
            BankTransactionSerializer(
                banking_transaction
            ).data,
            status=201,
        )


# ============================================================
# INTEREST
# ============================================================

class BankInterestCreateView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    @transaction.atomic
    def post(self, request):

        company, error = get_company_for_request(
            request
        )

        if error:
            return error

        bank_account_id = request.data.get(
            "bank_account"
        )

        revenue_account_id = request.data.get(
            "revenue_account"
        )

        amount = request.data.get(
            "amount"
        )

        transaction_date = request.data.get(
            "transaction_date"
        )

        reference = request.data.get(
            "reference",
            "",
        )

        description = request.data.get(
            "description",
            "Bank interest",
        )

        try:
            bank_account = (
                BankAccount.objects
                .select_related(
                    "company",
                    "accounting_account",
                )
                .get(
                    pk=bank_account_id,
                    company=company,
                )
            )

        except BankAccount.DoesNotExist:
            return Response(
                {
                    "detail": (
                        "Bank account not found "
                        "for this company."
                    )
                },
                status=404,
            )

        try:
            revenue_account = Account.objects.get(
                pk=revenue_account_id,
                company=company,
            )

        except Account.DoesNotExist:
            return Response(
                {
                    "detail": (
                        "Revenue account not found "
                        "for this company."
                    )
                },
                status=404,
            )

        if (
            revenue_account.account_type
            != Account.AccountType.REVENUE
        ):
            return Response(
                {
                    "detail": (
                        "Bank interest must be posted "
                        "to a Revenue account."
                    )
                },
                status=400,
            )

        try:
            banking_transaction = (
                BankingService.create_transaction(
                    company=company,
                    bank_account=bank_account,
                    transaction_type=(
                        BankTransaction
                        .TransactionType
                        .INTEREST
                    ),
                    amount=amount,
                    transaction_date=transaction_date,
                    created_by=request.user,
                    counter_account=revenue_account,
                    reference=reference,
                    description=description,
                )
            )

        except ValueError as exc:
            return Response(
                {
                    "detail": str(exc)
                },
                status=400,
            )

        return Response(
            BankTransactionSerializer(
                banking_transaction
            ).data,
            status=201,
        )


# ============================================================
# ADJUSTMENTS
# ============================================================

class BankAdjustmentCreateView(APIView):
    """
    Record a manual bank balance adjustment.

    INCREASE:

        DR Bank
        CR Counter Account

    DECREASE:

        DR Counter Account
        CR Bank
    """

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    @transaction.atomic
    def post(self, request):

        company, error = get_company_for_request(
            request
        )

        if error:
            return error

        bank_account_id = request.data.get(
            "bank_account"
        )

        counter_account_id = request.data.get(
            "counter_account"
        )

        amount = request.data.get(
            "amount"
        )

        adjustment_direction = request.data.get(
            "adjustment_direction"
        )

        transaction_date = request.data.get(
            "transaction_date"
        )

        reference = request.data.get(
            "reference",
            "",
        )

        description = request.data.get(
            "description",
            "",
        )

        if adjustment_direction not in [
            "INCREASE",
            "DECREASE",
        ]:
            return Response(
                {
                    "detail": (
                        "Adjustment direction must be "
                        "either INCREASE or DECREASE."
                    )
                },
                status=400,
            )

        try:
            bank_account = (
                BankAccount.objects
                .select_related(
                    "company",
                    "accounting_account",
                )
                .get(
                    pk=bank_account_id,
                    company=company,
                )
            )

        except BankAccount.DoesNotExist:
            return Response(
                {
                    "detail": (
                        "Bank account not found "
                        "for this company."
                    )
                },
                status=404,
            )

        try:
            counter_account = Account.objects.get(
                pk=counter_account_id,
                company=company,
            )

        except Account.DoesNotExist:
            return Response(
                {
                    "detail": (
                        "Counter account not found "
                        "for this company."
                    )
                },
                status=404,
            )

        try:
            banking_transaction = (
                BankingService.create_transaction(
                    company=company,
                    bank_account=bank_account,
                    transaction_type=(
                        BankTransaction
                        .TransactionType
                        .ADJUSTMENT
                    ),
                    amount=amount,
                    transaction_date=transaction_date,
                    created_by=request.user,
                    counter_account=counter_account,
                    reference=reference,
                    description=description,
                    adjustment_direction=(
                        adjustment_direction
                    ),
                )
            )

        except ValueError as exc:
            return Response(
                {
                    "detail": str(exc)
                },
                status=400,
            )

        return Response(
            BankTransactionSerializer(
                banking_transaction
            ).data,
            status=201,
        )


# ============================================================
# TRANSFERS
# ============================================================

class BankTransferCreateView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    @transaction.atomic
    def post(self, request):

        company, error = get_company_for_request(
            request
        )

        if error:
            return error

        source_account_id = request.data.get(
            "source_account"
        )

        destination_account_id = request.data.get(
            "destination_account"
        )

        amount = request.data.get(
            "amount"
        )

        transaction_date = request.data.get(
            "transaction_date"
        )

        reference = request.data.get(
            "reference",
            "",
        )

        description = request.data.get(
            "description",
            "",
        )

        try:
            source_account = (
                BankAccount.objects
                .select_related(
                    "company",
                    "accounting_account",
                )
                .get(
                    pk=source_account_id,
                    company=company,
                )
            )

        except BankAccount.DoesNotExist:
            return Response(
                {
                    "detail": (
                        "Source bank account not found "
                        "for this company."
                    )
                },
                status=404,
            )

        try:
            destination_account = (
                BankAccount.objects
                .select_related(
                    "company",
                    "accounting_account",
                )
                .get(
                    pk=destination_account_id,
                    company=company,
                )
            )

        except BankAccount.DoesNotExist:
            return Response(
                {
                    "detail": (
                        "Destination bank account "
                        "not found for this company."
                    )
                },
                status=404,
            )

        try:
            result = BankingService.transfer(
                company=company,
                source_account=source_account,
                destination_account=destination_account,
                amount=amount,
                transaction_date=transaction_date,
                created_by=request.user,
                reference=reference,
                description=description,
            )

        except ValueError as exc:
            return Response(
                {
                    "detail": str(exc)
                },
                status=400,
            )

        return Response(
            {
                "journal_entry": (
                    result[
                        "journal_entry"
                    ].id
                ),
                "transfer_out": (
                    BankTransactionSerializer(
                        result["transfer_out"]
                    ).data
                ),
                "transfer_in": (
                    BankTransactionSerializer(
                        result["transfer_in"]
                    ).data
                ),
            },
            status=201,
        )


# ============================================================
# BANK ACCOUNT SUMMARY
# ============================================================

class BankAccountSummaryView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request, pk):

        try:
            bank_account = (
                BankAccount.objects
                .select_related(
                    "company",
                    "accounting_account",
                )
                .get(pk=pk)
            )

        except BankAccount.DoesNotExist:
            return Response(
                {
                    "detail": "Bank account not found."
                },
                status=404,
            )

        if not user_can_access_company(
            request.user,
            bank_account.company,
        ):
            raise PermissionDenied(
                "You do not have access to this company."
            )

        summary = BankingService.account_summary(
            bank_account=bank_account,
        )

        return Response(summary)