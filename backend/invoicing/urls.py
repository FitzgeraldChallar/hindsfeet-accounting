from django.urls import path
from subscriptions.permissions import feature_view

from .views import (
    CreateCustomerPaymentView,
    CreateInvoiceFromSaleView,
    CreateInvoiceView,
    CreateSupplierBillView,
    CreateSupplierPaymentView,
    CustomerDetailView,
    CustomerListCreateView,
    CustomerPaymentListView,
    InvoiceDetailView,
    InvoiceListView,
    IssueInvoiceView,
    PostSupplierBillView,
    SupplierBillDetailView,
    SupplierBillListView,
    SupplierDetailView,
    SupplierListCreateView,
    SupplierPaymentListView,
    InvoicePDFView,
)


urlpatterns = [
    # ============================================================
    # CUSTOMERS
    # ============================================================

    path(
        "customers/",
        feature_view(CustomerListCreateView, "sales_invoicing"),
        name="customer-list-create",
    ),

    path(
        "customers/<int:pk>/",
        feature_view(CustomerDetailView, "sales_invoicing"),
        name="customer-detail",
    ),

    # ============================================================
    # INVOICES
    # ============================================================

    path(
        "invoices/",
        feature_view(InvoiceListView, "sales_invoicing"),
        name="invoice-list",
    ),

    path(
        "invoices/create/",
        feature_view(CreateInvoiceView, "sales_invoicing"),
        name="invoice-create",
    ),

    path(
        "invoices/<int:pk>/",
        feature_view(InvoiceDetailView, "sales_invoicing"),
        name="invoice-detail",
    ),

    path(
        "invoices/<int:pk>/pdf/",
        feature_view(InvoicePDFView, "sales_invoicing"),
        name="invoice-pdf",
    ),

    path(
        "invoices/from-sale/",
        feature_view(CreateInvoiceFromSaleView, "sales_invoicing"),
        name="invoice-from-sale",
    ),

    path(
        "invoices/<int:pk>/issue/",
        feature_view(IssueInvoiceView, "sales_invoicing"),
        name="invoice-issue",
    ),

    # ============================================================
    # CUSTOMER PAYMENTS / A/R
    # ============================================================

    path(
        "customer-payments/",
        feature_view(CustomerPaymentListView, "sales_invoicing"),
        name="customer-payment-list",
    ),

    path(
        "customer-payments/create/",
        feature_view(CreateCustomerPaymentView, "sales_invoicing"),
        name="customer-payment-create",
    ),

    # ============================================================
    # SUPPLIERS
    # ============================================================

    path(
        "suppliers/",
        feature_view(SupplierListCreateView, "purchases_expenses"),
        name="supplier-list-create",
    ),

    path(
        "suppliers/<int:pk>/",
        feature_view(SupplierDetailView, "purchases_expenses"),
        name="supplier-detail",
    ),

    # ============================================================
    # SUPPLIER BILLS / A/P
    # ============================================================

    path(
        "supplier-bills/",
        feature_view(SupplierBillListView, "purchases_expenses"),
        name="supplier-bill-list",
    ),

    path(
        "supplier-bills/create/",
        feature_view(CreateSupplierBillView, "purchases_expenses"),
        name="supplier-bill-create",
    ),

    path(
        "supplier-bills/<int:pk>/",
        feature_view(SupplierBillDetailView, "purchases_expenses"),
        name="supplier-bill-detail",
    ),

    path(
        "supplier-bills/<int:pk>/post/",
        feature_view(PostSupplierBillView, "purchases_expenses"),
        name="supplier-bill-post",
    ),

    # ============================================================
    # SUPPLIER PAYMENTS / A/P
    # ============================================================

    path(
        "supplier-payments/",
        feature_view(SupplierPaymentListView, "accounts_payable"),
        name="supplier-payment-list",
    ),

    path(
        "supplier-payments/create/",
        feature_view(CreateSupplierPaymentView, "accounts_payable"),
        name="supplier-payment-create",
    ),
]