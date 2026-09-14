from django.urls import path

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
        CustomerListCreateView.as_view(),
        name="customer-list-create",
    ),

    path(
        "customers/<int:pk>/",
        CustomerDetailView.as_view(),
        name="customer-detail",
    ),

    # ============================================================
    # INVOICES
    # ============================================================

    path(
        "invoices/",
        InvoiceListView.as_view(),
        name="invoice-list",
    ),

    path(
        "invoices/create/",
        CreateInvoiceView.as_view(),
        name="invoice-create",
    ),

    path(
        "invoices/<int:pk>/",
        InvoiceDetailView.as_view(),
        name="invoice-detail",
    ),

    path(
        "invoices/<int:pk>/pdf/",
        InvoicePDFView.as_view(),
        name="invoice-pdf",
    ),

    path(
        "invoices/from-sale/",
        CreateInvoiceFromSaleView.as_view(),
        name="invoice-from-sale",
    ),

    path(
        "invoices/<int:pk>/issue/",
        IssueInvoiceView.as_view(),
        name="invoice-issue",
    ),

    # ============================================================
    # CUSTOMER PAYMENTS / A/R
    # ============================================================

    path(
        "customer-payments/",
        CustomerPaymentListView.as_view(),
        name="customer-payment-list",
    ),

    path(
        "customer-payments/create/",
        CreateCustomerPaymentView.as_view(),
        name="customer-payment-create",
    ),

    # ============================================================
    # SUPPLIERS
    # ============================================================

    path(
        "suppliers/",
        SupplierListCreateView.as_view(),
        name="supplier-list-create",
    ),

    path(
        "suppliers/<int:pk>/",
        SupplierDetailView.as_view(),
        name="supplier-detail",
    ),

    # ============================================================
    # SUPPLIER BILLS / A/P
    # ============================================================

    path(
        "supplier-bills/",
        SupplierBillListView.as_view(),
        name="supplier-bill-list",
    ),

    path(
        "supplier-bills/create/",
        CreateSupplierBillView.as_view(),
        name="supplier-bill-create",
    ),

    path(
        "supplier-bills/<int:pk>/",
        SupplierBillDetailView.as_view(),
        name="supplier-bill-detail",
    ),

    path(
        "supplier-bills/<int:pk>/post/",
        PostSupplierBillView.as_view(),
        name="supplier-bill-post",
    ),

    # ============================================================
    # SUPPLIER PAYMENTS / A/P
    # ============================================================

    path(
        "supplier-payments/",
        SupplierPaymentListView.as_view(),
        name="supplier-payment-list",
    ),

    path(
        "supplier-payments/create/",
        CreateSupplierPaymentView.as_view(),
        name="supplier-payment-create",
    ),
]