from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from companies.models import Company
from operations.models import Product, Sale


class Customer(models.Model):
    """
    Customer belonging to a company.

    A company maintains its own customer list.
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="customers",
    )

    name = models.CharField(
        max_length=150,
    )

    email = models.EmailField(
        blank=True,
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
    )

    address = models.TextField(
        blank=True,
    )

    tax_number = models.CharField(
        max_length=100,
        blank=True,
    )

    is_active = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["name"]

        constraints = [
            models.UniqueConstraint(
                fields=["company", "name", "phone"],
                name="unique_customer_per_company",
            ),
        ]

    def __str__(self):
        return f"{self.name} - {self.company.name}"


class Supplier(models.Model):
    """
    Supplier belonging to a company.

    Used for Accounts Payable and supplier bills.
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="suppliers",
    )

    name = models.CharField(
        max_length=150,
    )

    email = models.EmailField(
        blank=True,
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
    )

    address = models.TextField(
        blank=True,
    )

    tax_number = models.CharField(
        max_length=100,
        blank=True,
    )

    is_active = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} - {self.company.name}"


class Invoice(models.Model):
    """
    Customer invoice.

    Supports:
    - Manually created invoices.
    - Invoices generated from completed sales.
    - Accounts Receivable tracking.
    - Partial and full payments.
    - USD and LRD invoice currencies.
    - Currency conversion to the company's
      functional currency for accounting.
    """

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ISSUED = "ISSUED", "Issued"
        PARTIALLY_PAID = "PARTIALLY_PAID", "Partially Paid"
        PAID = "PAID", "Paid"
        OVERDUE = "OVERDUE", "Overdue"
        VOIDED = "VOIDED", "Voided"

    class Currency(models.TextChoices):
        USD = "USD", "US Dollar (USD)"
        LRD = "LRD", "Liberian Dollar (LRD)"

    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name="invoices",
    )

    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="invoices",
    )

    sale = models.OneToOneField(
        Sale,
        on_delete=models.PROTECT,
        related_name="invoice",
        null=True,
        blank=True,
    )

    invoice_number = models.CharField(
        max_length=50,
    )

    invoice_date = models.DateField()

    due_date = models.DateField()

    currency = models.CharField(
        max_length=3,
        choices=Currency.choices,
        default=Currency.USD,
    )

    exchange_rate = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        default=Decimal("1.000000"),
        validators=[
            MinValueValidator(Decimal("0.000001")),
        ],
        help_text=(
            "Number of company functional currency units "
            "equal to 1 unit of invoice currency."
        ),
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    subtotal = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    discount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    tax = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    total_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    amount_paid = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    balance_due = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    notes = models.TextField(
        blank=True,
    )

    terms = models.TextField(
        blank=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="invoices_created",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "-invoice_date",
            "-id",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["company", "invoice_number"],
                name="unique_invoice_number_per_company",
            ),
        ]

    def __str__(self):
        return (
            f"{self.invoice_number} - "
            f"{self.company.name}"
        )

    @property
    def functional_currency(self):
        """
        The company's accounting/functional currency.
        """
        return self.company.currency

    @property
    def total_amount_in_functional_currency(self):
        """
        Convert the invoice total from invoice currency
        into the company's functional currency.
        """
        return (
            self.total_amount * self.exchange_rate
        )

    @property
    def amount_paid_in_functional_currency(self):
        """
        Convert the amount paid from invoice currency
        into the company's functional currency.
        """
        return (
            self.amount_paid * self.exchange_rate
        )

    @property
    def balance_due_in_functional_currency(self):
        """
        Convert the outstanding balance from invoice
        currency into the company's functional currency.
        """
        return (
            self.balance_due * self.exchange_rate
        )


class InvoiceItem(models.Model):
    """
    Individual product/service line on an invoice.

    Product is optional so invoices can also contain
    custom service or miscellaneous line items.
    """

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name="items",
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="invoice_items",
        null=True,
        blank=True,
    )

    description = models.CharField(
        max_length=255,
    )

    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=3,
        validators=[
            MinValueValidator(Decimal("0.001")),
        ],
    )

    unit_price = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    discount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    tax = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    line_total = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    def __str__(self):
        return (
            f"{self.invoice.invoice_number} - "
            f"{self.description}"
        )


class CustomerPayment(models.Model):
    """
    Payment received from a customer against an invoice.

    Accounting:

        DR Cash / Bank
        CR Accounts Receivable
    """

    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"
        BANK = "BANK", "Bank"
        MOBILE_MONEY = "MOBILE_MONEY", "Mobile Money"
        CARD = "CARD", "Card"

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.PROTECT,
        related_name="payments",
    )

    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.01")),
        ],
    )

    payment_date = models.DateField()

    payment_method = models.CharField(
        max_length=30,
        choices=PaymentMethod.choices,
        default=PaymentMethod.BANK,
    )

    reference = models.CharField(
        max_length=100,
        blank=True,
    )

    notes = models.TextField(
        blank=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="customer_payments_created",
    )

    journal_entry = models.OneToOneField(
        "accounting.JournalEntry",
        on_delete=models.PROTECT,
        related_name="customer_payment",
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = [
            "-payment_date",
            "-id",
        ]

    def __str__(self):
        return (
            f"{self.invoice.invoice_number} - "
            f"{self.amount}"
        )


class SupplierBill(models.Model):
    """
    Supplier bill representing an Accounts Payable liability.
    """

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        POSTED = "POSTED", "Posted"
        PARTIALLY_PAID = "PARTIALLY_PAID", "Partially Paid"
        PAID = "PAID", "Paid"
        OVERDUE = "OVERDUE", "Overdue"
        VOIDED = "VOIDED", "Voided"

    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name="supplier_bills",
    )

    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name="bills",
    )

    bill_number = models.CharField(
        max_length=50,
    )

    bill_date = models.DateField()

    due_date = models.DateField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    subtotal = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    discount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    tax = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    total_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    amount_paid = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    balance_due = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    notes = models.TextField(
        blank=True,
    )

    terms = models.TextField(
        blank=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="supplier_bills_created",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "-bill_date",
            "-id",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["company", "bill_number"],
                name="unique_bill_number_per_company",
            ),
        ]

    def __str__(self):
        return (
            f"{self.bill_number} - "
            f"{self.supplier.name}"
        )


class SupplierBillItem(models.Model):
    """
    Individual line on a supplier bill.
    """

    bill = models.ForeignKey(
        SupplierBill,
        on_delete=models.CASCADE,
        related_name="items",
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="supplier_bill_items",
        null=True,
        blank=True,
    )

    description = models.CharField(
        max_length=255,
    )

    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=3,
        validators=[
            MinValueValidator(Decimal("0.001")),
        ],
    )

    unit_cost = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    discount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    tax = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    line_total = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    def __str__(self):
        return (
            f"{self.bill.bill_number} - "
            f"{self.description}"
        )


class SupplierPayment(models.Model):
    """
    Payment made to a supplier against a supplier bill.

    Accounting:

        DR Accounts Payable
        CR Cash / Bank
    """

    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"
        BANK = "BANK", "Bank"
        MOBILE_MONEY = "MOBILE_MONEY", "Mobile Money"
        CARD = "CARD", "Card"

    bill = models.ForeignKey(
        SupplierBill,
        on_delete=models.PROTECT,
        related_name="payments",
    )

    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.01")),
        ],
    )

    payment_date = models.DateField()

    payment_method = models.CharField(
        max_length=30,
        choices=PaymentMethod.choices,
        default=PaymentMethod.BANK,
    )

    reference = models.CharField(
        max_length=100,
        blank=True,
    )

    notes = models.TextField(
        blank=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="supplier_payments_created",
    )

    journal_entry = models.OneToOneField(
        "accounting.JournalEntry",
        on_delete=models.PROTECT,
        related_name="supplier_payment",
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = [
            "-payment_date",
            "-id",
        ]

    def __str__(self):
        return (
            f"{self.bill.bill_number} - "
            f"{self.amount}"
        )
    