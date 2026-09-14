from django.urls import path

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
        BankAccountListCreateView.as_view(),
        name="bank-account-list-create",
    ),

    path(
        "accounts/<int:pk>/",
        BankAccountDetailView.as_view(),
        name="bank-account-detail",
    ),

    path(
        "accounts/<int:pk>/summary/",
        BankAccountSummaryView.as_view(),
        name="bank-account-summary",
    ),

    # --------------------------------------------------------
    # Transactions
    # --------------------------------------------------------

    path(
        "transactions/",
        BankTransactionListView.as_view(),
        name="bank-transaction-list",
    ),

    # --------------------------------------------------------
    # Banking Operations
    # --------------------------------------------------------

    path(
        "deposits/",
        BankDepositCreateView.as_view(),
        name="bank-deposit-create",
    ),

    path(
        "withdrawals/",
        BankWithdrawalCreateView.as_view(),
        name="bank-withdrawal-create",
    ),

    path(
        "fees/",
        BankFeeCreateView.as_view(),
        name="bank-fee-create",
    ),

    path(
        "interest/",
        BankInterestCreateView.as_view(),
        name="bank-interest-create",
    ),

    path(
        "adjustments/",
        BankAdjustmentCreateView.as_view(),
        name="bank-adjustment-create",
    ),

    path(
        "transfers/",
        BankTransferCreateView.as_view(),
        name="bank-transfer-create",
    ),
]