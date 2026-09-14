from decimal import Decimal

from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from companies.models import Company, CompanyMembership
from operations.models import Product, Sale

from .models import (
    Customer,
    CustomerPayment,
    Invoice,
    Supplier,
    SupplierBill,
    SupplierPayment,
)
from .serializers import (
    CustomerPaymentSerializer,
    CustomerSerializer,
    InvoiceSerializer,
    SupplierBillSerializer,
    SupplierPaymentSerializer,
    SupplierSerializer,
)
from .services import InvoicingService
from django.http import FileResponse
from .pdf import generate_invoice_pdf


def user_can_access_company(user, company):
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


def get_company_for_user(user, company_id):
    company = get_object_or_404(
        Company,
        id=company_id,
    )

    if not user_can_access_company(
        user,
        company,
    ):
        raise PermissionDenied(
            "You do not have access to this company."
        )

    return company


# ============================================================
# CUSTOMERS
# ============================================================


class CustomerListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = CustomerSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = Customer.objects.select_related(
            "company",
        )

        company_id = self.request.query_params.get(
            "company"
        )

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                queryset = queryset.filter(
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


class CustomerDetailView(
    generics.RetrieveUpdateAPIView
):
    serializer_class = CustomerSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = Customer.objects.select_related(
            "company",
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


# ============================================================
# SUPPLIERS
# ============================================================


class SupplierListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = SupplierSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = Supplier.objects.select_related(
            "company",
        )

        company_id = self.request.query_params.get(
            "company"
        )

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                queryset = queryset.filter(
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


class SupplierDetailView(
    generics.RetrieveUpdateAPIView
):
    serializer_class = SupplierSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = Supplier.objects.select_related(
            "company",
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


# ============================================================
# INVOICES
# ============================================================


class InvoiceListView(
    generics.ListAPIView
):
    serializer_class = InvoiceSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = (
            Invoice.objects
            .select_related(
                "company",
                "customer",
                "sale",
                "created_by",
            )
            .prefetch_related(
                "items__product",
                "payments",
            )
        )

        company_id = self.request.query_params.get(
            "company"
        )

        status = self.request.query_params.get(
            "status"
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

        if status:
            queryset = queryset.filter(
                status=status
            )

        return queryset.distinct()


class InvoiceDetailView(
    generics.RetrieveAPIView
):
    serializer_class = InvoiceSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = (
            Invoice.objects
            .select_related(
                "company",
                "customer",
                "sale",
                "created_by",
            )
            .prefetch_related(
                "items__product",
                "payments",
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

class InvoicePDFView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request, pk):
        invoice = get_object_or_404(
            Invoice.objects.select_related(
                "company",
                "customer",
            ).prefetch_related(
                "items",
            ),
            id=pk,
        )

        if not user_can_access_company(
            request.user,
            invoice.company,
        ):
            raise PermissionDenied(
                "You do not have access to this company."
            )

        pdf_buffer = generate_invoice_pdf(
            invoice
        )

        response = FileResponse(
            pdf_buffer,
            content_type="application/pdf",
        )

        response[
            "Content-Disposition"
        ] = (
            f'inline; filename='
            f'"{invoice.invoice_number}.pdf"'
        )

        return response

class CreateInvoiceView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request):
        try:
            company = get_company_for_user(
                request.user,
                request.data["company"],
            )

            customer = get_object_or_404(
                Customer,
                id=request.data["customer"],
                company=company,
            )

            items = request.data.get(
                "items",
                [],
            )

            invoice = InvoicingService.create_invoice(
                company=company,
                customer=customer,
                invoice_number=request.data[
                    "invoice_number"
                ],
                invoice_date=request.data[
                    "invoice_date"
                ],
                due_date=request.data[
                    "due_date"
                ],
                created_by=request.user,
                items=[
                    {
                        "product": (
                            Product.objects.get(
                                id=item["product"],
                                company=company,
                            )
                            if item.get("product")
                            else None
                        ),
                        "description": item.get(
                            "description"
                        ),
                        "quantity": item[
                            "quantity"
                        ],
                        "unit_price": item[
                            "unit_price"
                        ],
                        "discount": item.get(
                            "discount",
                            "0.00",
                        ),
                        "tax": item.get(
                            "tax",
                            "0.00",
                        ),
                    }
                    for item in items
                ],
                discount=request.data.get(
                    "discount",
                    "0.00",
                ),
                tax=request.data.get(
                    "tax",
                    "0.00",
                ),
                notes=request.data.get(
                    "notes",
                    "",
                ),
                terms=request.data.get(
                    "terms",
                    "",
                ),
                issue=request.data.get(
                    "issue",
                    False,
                ),
            )

        except KeyError as exc:
            return Response(
                {
                    "detail":
                    f"Missing required field: {exc.args[0]}"
                },
                status=400,
            )

        except Product.DoesNotExist:
            return Response(
                {
                    "detail":
                    "One or more products do not "
                    "belong to this company."
                },
                status=400,
            )

        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=400,
            )

        return Response(
            InvoiceSerializer(invoice).data,
            status=201,
        )


# ============================================================
# INVOICE FROM SALE
# ============================================================


class CreateInvoiceFromSaleView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request):
        try:
            sale = get_object_or_404(
                Sale.objects.select_related(
                    "company",
                ),
                id=request.data["sale"],
            )

            if not user_can_access_company(
                request.user,
                sale.company,
            ):
                raise PermissionDenied(
                    "You do not have access to this company."
                )

            customer = get_object_or_404(
                Customer,
                id=request.data["customer"],
                company=sale.company,
            )

            invoice = (
                InvoicingService.create_invoice_from_sale(
                    sale=sale,
                    customer=customer,
                    invoice_number=request.data[
                        "invoice_number"
                    ],
                    due_date=request.data[
                        "due_date"
                    ],
                    created_by=request.user,
                    notes=request.data.get(
                        "notes",
                        "",
                    ),
                    terms=request.data.get(
                        "terms",
                        "",
                    ),
                    issue=request.data.get(
                        "issue",
                        False,
                    ),
                )
            )

        except KeyError as exc:
            return Response(
                {
                    "detail":
                    f"Missing required field: {exc.args[0]}"
                },
                status=400,
            )

        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=400,
            )

        return Response(
            InvoiceSerializer(invoice).data,
            status=201,
        )


# ============================================================
# ISSUE INVOICE
# ============================================================


class IssueInvoiceView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request, pk):
        invoice = get_object_or_404(
            Invoice.objects.select_related(
                "company",
                "customer",
                "sale",
            ),
            id=pk,
        )

        if not user_can_access_company(
            request.user,
            invoice.company,
        ):
            raise PermissionDenied(
                "You do not have access to this company."
            )

        try:
            if invoice.sale_id:
                InvoicingService.issue_invoice_from_sale(
                    invoice=invoice,
                    user=request.user,
                )
            else:
                InvoicingService.issue_invoice(
                    invoice=invoice,
                    user=request.user,
                )

        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=400,
            )

        return Response(
            InvoiceSerializer(invoice).data,
            status=200,
        )


# ============================================================
# CUSTOMER PAYMENTS
# ============================================================


class CustomerPaymentListView(
    generics.ListAPIView
):
    serializer_class = CustomerPaymentSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = CustomerPayment.objects.select_related(
            "invoice",
            "invoice__company",
            "invoice__customer",
            "created_by",
            "journal_entry",
        )

        company_id = self.request.query_params.get(
            "company"
        )

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                queryset = queryset.filter(
                    invoice__company_id=company_id
                )

            return queryset

        queryset = queryset.filter(
            invoice__company__memberships__user=user,
            invoice__company__memberships__is_active=True,
        )

        if company_id:
            queryset = queryset.filter(
                invoice__company_id=company_id
            )

        return queryset.distinct()


class CreateCustomerPaymentView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request):
        try:
            invoice = get_object_or_404(
                Invoice.objects.select_related(
                    "company",
                    "customer",
                ),
                id=request.data["invoice"],
            )

            if not user_can_access_company(
                request.user,
                invoice.company,
            ):
                raise PermissionDenied(
                    "You do not have access to this company."
                )

            payment = (
                InvoicingService.record_customer_payment(
                    invoice=invoice,
                    amount=request.data["amount"],
                    payment_date=request.data[
                        "payment_date"
                    ],
                    payment_method=request.data[
                        "payment_method"
                    ],
                    created_by=request.user,
                    reference=request.data.get(
                        "reference",
                        "",
                    ),
                    notes=request.data.get(
                        "notes",
                        "",
                    ),
                )
            )

        except KeyError as exc:
            return Response(
                {
                    "detail":
                    f"Missing required field: {exc.args[0]}"
                },
                status=400,
            )

        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=400,
            )

        return Response(
            CustomerPaymentSerializer(payment).data,
            status=201,
        )


# ============================================================
# SUPPLIER BILLS / A/P
# ============================================================


class SupplierBillListView(
    generics.ListAPIView
):
    serializer_class = SupplierBillSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = (
            SupplierBill.objects
            .select_related(
                "company",
                "supplier",
                "created_by",
            )
            .prefetch_related(
                "items__product",
                "payments",
            )
        )

        company_id = self.request.query_params.get(
            "company"
        )

        status = self.request.query_params.get(
            "status"
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

        if status:
            queryset = queryset.filter(
                status=status
            )

        return queryset.distinct()


class SupplierBillDetailView(
    generics.RetrieveAPIView
):
    serializer_class = SupplierBillSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = (
            SupplierBill.objects
            .select_related(
                "company",
                "supplier",
                "created_by",
            )
            .prefetch_related(
                "items__product",
                "payments",
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


class CreateSupplierBillView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request):
        try:
            company = get_company_for_user(
                request.user,
                request.data["company"],
            )

            supplier = get_object_or_404(
                Supplier,
                id=request.data["supplier"],
                company=company,
            )

            items = request.data.get(
                "items",
                [],
            )

            bill = InvoicingService.create_supplier_bill(
                company=company,
                supplier=supplier,
                bill_number=request.data[
                    "bill_number"
                ],
                bill_date=request.data[
                    "bill_date"
                ],
                due_date=request.data[
                    "due_date"
                ],
                created_by=request.user,
                items=[
                    {
                        "product": (
                            Product.objects.get(
                                id=item["product"],
                                company=company,
                            )
                            if item.get("product")
                            else None
                        ),
                        "description": item.get(
                            "description"
                        ),
                        "quantity": item[
                            "quantity"
                        ],
                        "unit_cost": item[
                            "unit_cost"
                        ],
                        "discount": item.get(
                            "discount",
                            "0.00",
                        ),
                        "tax": item.get(
                            "tax",
                            "0.00",
                        ),
                    }
                    for item in items
                ],
                discount=request.data.get(
                    "discount",
                    "0.00",
                ),
                tax=request.data.get(
                    "tax",
                    "0.00",
                ),
                notes=request.data.get(
                    "notes",
                    "",
                ),
                terms=request.data.get(
                    "terms",
                    "",
                ),
                post=request.data.get(
                    "post",
                    False,
                ),
            )

        except KeyError as exc:
            return Response(
                {
                    "detail":
                    f"Missing required field: {exc.args[0]}"
                },
                status=400,
            )

        except Product.DoesNotExist:
            return Response(
                {
                    "detail":
                    "One or more products do not "
                    "belong to this company."
                },
                status=400,
            )

        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=400,
            )

        return Response(
            SupplierBillSerializer(bill).data,
            status=201,
        )


# ============================================================
# POST SUPPLIER BILL
# ============================================================


class PostSupplierBillView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request, pk):
        bill = get_object_or_404(
            SupplierBill.objects.select_related(
                "company",
                "supplier",
            ),
            id=pk,
        )

        if not user_can_access_company(
            request.user,
            bill.company,
        ):
            raise PermissionDenied(
                "You do not have access to this company."
            )

        try:
            InvoicingService.post_supplier_bill(
                bill=bill,
                user=request.user,
            )

        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=400,
            )

        return Response(
            SupplierBillSerializer(bill).data,
            status=200,
        )


# ============================================================
# SUPPLIER PAYMENTS
# ============================================================


class SupplierPaymentListView(
    generics.ListAPIView
):
    serializer_class = SupplierPaymentSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = SupplierPayment.objects.select_related(
            "bill",
            "bill__company",
            "bill__supplier",
            "created_by",
            "journal_entry",
        )

        company_id = self.request.query_params.get(
            "company"
        )

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                queryset = queryset.filter(
                    bill__company_id=company_id
                )

            return queryset

        queryset = queryset.filter(
            bill__company__memberships__user=user,
            bill__company__memberships__is_active=True,
        )

        if company_id:
            queryset = queryset.filter(
                bill__company_id=company_id
            )

        return queryset.distinct()


class CreateSupplierPaymentView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request):
        try:
            bill = get_object_or_404(
                SupplierBill.objects.select_related(
                    "company",
                    "supplier",
                ),
                id=request.data["bill"],
            )

            if not user_can_access_company(
                request.user,
                bill.company,
            ):
                raise PermissionDenied(
                    "You do not have access to this company."
                )

            payment = (
                InvoicingService.record_supplier_payment(
                    bill=bill,
                    amount=request.data["amount"],
                    payment_date=request.data[
                        "payment_date"
                    ],
                    payment_method=request.data[
                        "payment_method"
                    ],
                    created_by=request.user,
                    reference=request.data.get(
                        "reference",
                        "",
                    ),
                    notes=request.data.get(
                        "notes",
                        "",
                    ),
                )
            )

        except KeyError as exc:
            return Response(
                {
                    "detail":
                    f"Missing required field: {exc.args[0]}"
                },
                status=400,
            )

        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=400,
            )

        return Response(
            SupplierPaymentSerializer(payment).data,
            status=201,
        )