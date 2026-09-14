from django.urls import path

from .views import (
    AccountDetailView,
    AccountListCreateView,
    BalanceSheetPDFView,
    BalanceSheetView,
    CashFlowPDFView,
    CashFlowStatementView,
    GeneralLedgerPDFView,
    GeneralLedgerView,
    IncomeStatementPDFView,
    IncomeStatementView,
    JournalEntryDetailView,
    JournalEntryListCreateView,
    JournalEntryPostView,
    TrialBalancePDFView,
    TrialBalanceView,
)


urlpatterns = [

    # ========================================================
    # ACCOUNTS
    # ========================================================

    path(
        "accounts/",
        AccountListCreateView.as_view(),
        name="account-list-create",
    ),

    path(
        "accounts/<int:pk>/",
        AccountDetailView.as_view(),
        name="account-detail",
    ),

    # ========================================================
    # JOURNAL ENTRIES
    # ========================================================

    path(
        "journal-entries/",
        JournalEntryListCreateView.as_view(),
        name="journal-entry-list-create",
    ),

    path(
        "journal-entries/<int:pk>/",
        JournalEntryDetailView.as_view(),
        name="journal-entry-detail",
    ),

    path(
        "journal-entries/<int:pk>/post/",
        JournalEntryPostView.as_view(),
        name="journal-entry-post",
    ),

    # ========================================================
    # FINANCIAL REPORTS - JSON
    # ========================================================

    path(
        "reports/general-ledger/",
        GeneralLedgerView.as_view(),
        name="general-ledger",
    ),

    path(
        "reports/trial-balance/",
        TrialBalanceView.as_view(),
        name="trial-balance",
    ),

    path(
        "reports/income-statement/",
        IncomeStatementView.as_view(),
        name="income-statement",
    ),

    path(
        "reports/balance-sheet/",
        BalanceSheetView.as_view(),
        name="balance-sheet",
    ),

    path(
        "reports/cash-flow/",
        CashFlowStatementView.as_view(),
        name="cash-flow",
    ),

    # ========================================================
    # FINANCIAL REPORTS - PDF
    # ========================================================

    path(
        "reports/general-ledger/pdf/",
        GeneralLedgerPDFView.as_view(),
        name="general-ledger-pdf",
    ),

    path(
        "reports/trial-balance/pdf/",
        TrialBalancePDFView.as_view(),
        name="trial-balance-pdf",
    ),

    path(
        "reports/income-statement/pdf/",
        IncomeStatementPDFView.as_view(),
        name="income-statement-pdf",
    ),

    path(
        "reports/balance-sheet/pdf/",
        BalanceSheetPDFView.as_view(),
        name="balance-sheet-pdf",
    ),

    path(
        "reports/cash-flow/pdf/",
        CashFlowPDFView.as_view(),
        name="cash-flow-pdf",
    ),

]