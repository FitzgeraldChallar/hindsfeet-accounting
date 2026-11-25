from django.urls import path
from subscriptions.permissions import feature_view

from .views import (
    BankAccountListCreateView,
    BankAccountDetailView,
    BankTransactionListView,
    BankDepositCreateView,
    BankWithdrawalCreateView,
    BankFeeCreateView,
    BankInterestCreateView,
    BankAdjustmentCreateView,
    BankTransferCreateView,
    BankAccountSummaryView,
)


urlpatterns = [
    # --------------------------------------------------------
    # Bank Accounts
    # --------------------------------------------------------

    path(
        "accounts/",
        feature_view(BankAccountListCreateView, "banking"),
        name="bank-account-list-create",
    ),

    path(
        "accounts/<int:pk>/",
        feature_view(BankAccountDetailView, "banking"),
        name="bank-account-detail",
    ),

    path(
        "accounts/<int:pk>/summary/",
        feature_view(BankAccountSummaryView, "banking"),
        name="bank-account-summary",
    ),

    # --------------------------------------------------------
    # Transactions
    # --------------------------------------------------------

    path(
        "transactions/",
        feature_view(BankTransactionListView, "banking"),
        name="bank-transaction-list",
    ),

    # --------------------------------------------------------
    # Banking Operations
    # --------------------------------------------------------

    path(
        "deposits/",
        feature_view(BankDepositCreateView, "banking"),
        name="bank-deposit-create",
    ),

    path(
        "withdrawals/",
        feature_view(BankWithdrawalCreateView, "banking"),
        name="bank-withdrawal-create",
    ),

    path(
        "fees/",
        feature_view(BankFeeCreateView, "banking"),
        name="bank-fee-create",
    ),

    path(
        "interest/",
        feature_view(BankInterestCreateView, "banking"),
        name="bank-interest-create",
    ),

    path(
        "adjustments/",
        feature_view(BankAdjustmentCreateView, "banking"),
        name="bank-adjustment-create",
    ),

    path(
        "transfers/",
        feature_view(BankTransferCreateView, "banking"),
        name="bank-transfer-create",
    ),
]