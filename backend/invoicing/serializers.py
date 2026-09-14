from decimal import Decimal

from rest_framework import serializers

from .models import (
    Customer,
    CustomerPayment,
    Invoice,
    InvoiceItem,
    Supplier,
    SupplierBill,
    SupplierBillItem,
    SupplierPayment,
)


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            "id",
            "company",
            "name",
            "email",
            "phone",
            "address",
            "tax_number",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            "id",
            "company",
            "name",
            "email",
            "phone",
            "address",
            "tax_number",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = [
            "id",
            "invoice",
            "product",
            "description",
            "quantity",
            "unit_price",
            "discount",
            "tax",
            "line_total",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "line_total",
            "created_at",
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(
        many=True,
        read_only=True,
    )

    functional_currency = serializers.CharField(
        read_only=True,
    )

    total_amount_in_functional_currency = (
        serializers.DecimalField(
            max_digits=18,
            decimal_places=2,
            read_only=True,
        )
    )

    amount_paid_in_functional_currency = (
        serializers.DecimalField(
            max_digits=18,
            decimal_places=2,
            read_only=True,
        )
    )

    balance_due_in_functional_currency = (
        serializers.DecimalField(
            max_digits=18,
            decimal_places=2,
            read_only=True,
        )
    )

    class Meta:
        model = Invoice
        fields = [
            "id",
            "company",
            "customer",
            "sale",
            "invoice_number",
            "invoice_date",
            "due_date",
            "currency",
            "exchange_rate",
            "functional_currency",
            "status",
            "subtotal",
            "discount",
            "tax",
            "total_amount",
            "amount_paid",
            "balance_due",
            "total_amount_in_functional_currency",
            "amount_paid_in_functional_currency",
            "balance_due_in_functional_currency",
            "notes",
            "terms",
            "created_by",
            "created_at",
            "updated_at",
            "items",
        ]

        read_only_fields = [
            "id",
            "status",
            "subtotal",
            "total_amount",
            "amount_paid",
            "balance_due",
            "functional_currency",
            "total_amount_in_functional_currency",
            "amount_paid_in_functional_currency",
            "balance_due_in_functional_currency",
            "created_by",
            "created_at",
            "updated_at",
            "items",
        ]

    def validate_currency(self, value):
        allowed = {
            Invoice.Currency.USD,
            Invoice.Currency.LRD,
        }

        if value not in allowed:
            raise serializers.ValidationError(
                "Invoice currency must be USD or LRD."
            )

        return value

    def validate_exchange_rate(self, value):
        if value <= Decimal("0"):
            raise serializers.ValidationError(
                "Exchange rate must be greater than zero."
            )

        return value


class CustomerPaymentSerializer(
    serializers.ModelSerializer
):
    invoice_currency = serializers.CharField(
        source="invoice.currency",
        read_only=True,
    )

    class Meta:
        model = CustomerPayment
        fields = [
            "id",
            "invoice",
            "invoice_currency",
            "amount",
            "payment_date",
            "payment_method",
            "reference",
            "notes",
            "created_by",
            "journal_entry",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "invoice_currency",
            "created_by",
            "journal_entry",
            "created_at",
        ]


class SupplierBillItemSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = SupplierBillItem
        fields = [
            "id",
            "bill",
            "product",
            "description",
            "quantity",
            "unit_cost",
            "discount",
            "tax",
            "line_total",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "line_total",
            "created_at",
        ]


class SupplierBillSerializer(
    serializers.ModelSerializer
):
    items = SupplierBillItemSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = SupplierBill
        fields = [
            "id",
            "company",
            "supplier",
            "bill_number",
            "bill_date",
            "due_date",
            "status",
            "subtotal",
            "discount",
            "tax",
            "total_amount",
            "amount_paid",
            "balance_due",
            "notes",
            "terms",
            "created_by",
            "created_at",
            "updated_at",
            "items",
        ]
        read_only_fields = [
            "id",
            "status",
            "subtotal",
            "total_amount",
            "amount_paid",
            "balance_due",
            "created_by",
            "created_at",
            "updated_at",
            "items",
        ]


class SupplierPaymentSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = SupplierPayment
        fields = [
            "id",
            "bill",
            "amount",
            "payment_date",
            "payment_method",
            "reference",
            "notes",
            "created_by",
            "journal_entry",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "journal_entry",
            "created_at",
        ]
        