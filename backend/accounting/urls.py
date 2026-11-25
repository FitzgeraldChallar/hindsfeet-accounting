from django.urls import path
from subscriptions.permissions import feature_view

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
        feature_view(AccountListCreateView, "core_accounting"),
        name="account-list-create",
    ),

    path(
        "accounts/<int:pk>/",
        feature_view(AccountDetailView, "core_accounting"),
        name="account-detail",
    ),

    # ========================================================
    # JOURNAL ENTRIES
    # ========================================================

    path(
        "journal-entries/",
        feature_view(JournalEntryListCreateView, "core_accounting"),
        name="journal-entry-list-create",
    ),

    path(
        "journal-entries/<int:pk>/",
        feature_view(JournalEntryDetailView, "core_accounting"),
        name="journal-entry-detail",
    ),

    path(
        "journal-entries/<int:pk>/post/",
        feature_view(JournalEntryPostView, "core_accounting"),
        name="journal-entry-post",
    ),

    # ========================================================
    # FINANCIAL REPORTS - JSON
    # ========================================================

    path(
        "reports/general-ledger/",
        feature_view(GeneralLedgerView, "core_accounting"),
        name="general-ledger",
    ),

    path(
        "reports/trial-balance/",
        feature_view(TrialBalanceView, "core_accounting"),
        name="trial-balance",
    ),

    path(
        "reports/income-statement/",
        feature_view(IncomeStatementView, "core_accounting"),
        name="income-statement",
    ),

    path(
        "reports/balance-sheet/",
        feature_view(BalanceSheetView, "core_accounting"),
        name="balance-sheet",
    ),

    path(
        "reports/cash-flow/",
        feature_view(CashFlowStatementView, "core_accounting"),
        name="cash-flow",
    ),

    # ========================================================
    # FINANCIAL REPORTS - PDF
    # ========================================================

    path(
        "reports/general-ledger/pdf/",
        feature_view(GeneralLedgerPDFView, "core_accounting"),
        name="general-ledger-pdf",
    ),

    path(
        "reports/trial-balance/pdf/",
        feature_view(TrialBalancePDFView, "core_accounting"),
        name="trial-balance-pdf",
    ),

    path(
        "reports/income-statement/pdf/",
        feature_view(IncomeStatementPDFView, "core_accounting"),
        name="income-statement-pdf",
    ),

    path(
        "reports/balance-sheet/pdf/",
        feature_view(BalanceSheetPDFView, "core_accounting"),
        name="balance-sheet-pdf",
    ),

    path(
        "reports/cash-flow/pdf/",
        feature_view(CashFlowPDFView, "core_accounting"),
        name="cash-flow-pdf",
    ),

]