from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction

from accounting.models import Account
from accounting.services import AccountingService
from operations.models import Product, Sale
from operations.services import InventoryService

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


class InvoicingService:
    """
    Central service for customer invoicing, Accounts Receivable,
    supplier bills, and Accounts Payable.

    Currency rules:

    1. Company.currency is the company's functional currency.
    2. Invoice.currency is the currency printed on the invoice.
    3. Invoice amounts and balances remain in invoice.currency.
    4. Journal entries are always recorded in the company's
       functional currency.
    5. exchange_rate means:

           1 unit of invoice currency
           =
           X units of company functional currency

       Example:

           Company currency = USD
           Invoice currency = LRD
           Exchange rate = 0.005

           LRD 100,000 × 0.005 = USD 500
    """

    # ============================================================
    # HELPERS
    # ============================================================

    @staticmethod
    def _account(*, company, code):
        try:
            return Account.objects.get(
                company=company,
                code=code,
                is_active=True,
            )
        except Account.DoesNotExist:
            raise ValueError(
                f"Required account {code} does not exist "
                f"for {company.name}."
            )

    @staticmethod
    def _decimal(value):
        return Decimal(str(value or "0.00"))

    @staticmethod
    def _money(value):
        """
        Round an accounting amount to two decimal places.
        """
        return Decimal(value).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )

    @staticmethod
    def _validate_invoice_currency(
        *,
        company,
        currency,
        exchange_rate,
    ):
        """
        Validate invoice currency and determine the
        appropriate exchange rate.

        The exchange rate means:

            1 unit of invoice currency
            =
            X units of company functional currency
        """

        allowed_currencies = {
            "USD",
            "LRD",
        }

        if currency not in allowed_currencies:
            raise ValueError(
                "Invoice currency must be USD or LRD."
            )

        company_currency = str(
            company.currency or ""
        ).upper().strip()

        if company_currency not in allowed_currencies:
            raise ValueError(
                "Company currency must be USD or LRD."
            )

        if currency == company_currency:
            return Decimal("1.000000")

        if exchange_rate is None:
            raise ValueError(
                "An exchange rate is required when "
                "invoice currency differs from company currency."
            )

        exchange_rate = InvoicingService._decimal(
            exchange_rate
        )

        if exchange_rate <= 0:
            raise ValueError(
                "Exchange rate must be greater than zero."
            )

        return exchange_rate

    @staticmethod
    def _functional_amount(*, amount, exchange_rate):
        """
        Convert an invoice-currency amount into the
        company's functional currency.
        """

        amount = InvoicingService._decimal(amount)
        exchange_rate = InvoicingService._decimal(
            exchange_rate
        )

        return InvoicingService._money(
            amount * exchange_rate
        )

    # ============================================================
    # CUSTOMER INVOICES
    # ============================================================

    @staticmethod
    @transaction.atomic
    def create_invoice(
        *,
        company,
        customer,
        invoice_number,
        invoice_date,
        due_date,
        created_by,
        items,
        currency=None,
        exchange_rate=None,
        discount=Decimal("0.00"),
        tax=Decimal("0.00"),
        notes="",
        terms="",
        sale=None,
        issue=False,
    ):
        """
        Create a customer invoice.

        The invoice may be:

        1. Created manually.
        2. Created from an existing completed sale.

        If issue=True, the invoice is immediately issued and
        the Accounts Receivable journal entry is created.
        """

        if not items:
            raise ValueError(
                "An invoice must contain at least one item."
            )

        if customer.company_id != company.id:
            raise ValueError(
                "Customer does not belong to this company."
            )

        if sale is not None:
            if sale.company_id != company.id:
                raise ValueError(
                    "Sale does not belong to this company."
                )

            if sale.status != Sale.Status.COMPLETED:
                raise ValueError(
                    "Only completed sales can be invoiced."
                )

            if hasattr(sale, "invoice"):
                raise ValueError(
                    "This sale already has an invoice."
                )

        discount = InvoicingService._decimal(
            discount
        )

        tax = InvoicingService._decimal(
            tax
        )

        if currency is None:
            currency = company.currency

        currency = str(currency).upper().strip()

        exchange_rate = (
            InvoicingService._validate_invoice_currency(
                company=company,
                currency=currency,
                exchange_rate=exchange_rate,
            )
        )

        if discount < 0:
            raise ValueError(
                "Invoice discount cannot be negative."
            )

        if tax < 0:
            raise ValueError(
                "Invoice tax cannot be negative."
            )

        invoice = Invoice.objects.create(
            company=company,
            customer=customer,
            sale=sale,
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            due_date=due_date,
            currency=currency,
            exchange_rate=exchange_rate,
            status=Invoice.Status.DRAFT,
            discount=discount,
            tax=tax,
            notes=notes,
            terms=terms,
            created_by=created_by,
        )

        subtotal = Decimal("0.00")

        for item_data in items:
            product = item_data.get("product")

            if product is not None:
                if product.company_id != company.id:
                    raise ValueError(
                        "Product does not belong to this company."
                    )

            description = item_data.get(
                "description"
            )

            if not description:
                if product is not None:
                    description = product.name
                else:
                    raise ValueError(
                        "Each invoice item must have a description."
                    )

            quantity = InvoicingService._decimal(
                item_data.get("quantity")
            )

            unit_price = InvoicingService._decimal(
                item_data.get("unit_price")
            )

            item_discount = InvoicingService._decimal(
                item_data.get(
                    "discount",
                    "0.00",
                )
            )

            item_tax = InvoicingService._decimal(
                item_data.get(
                    "tax",
                    "0.00",
                )
            )

            if quantity <= 0:
                raise ValueError(
                    "Invoice quantity must be greater than zero."
                )

            if unit_price < 0:
                raise ValueError(
                    "Unit price cannot be negative."
                )

            if item_discount < 0:
                raise ValueError(
                    "Item discount cannot be negative."
                )

            if item_tax < 0:
                raise ValueError(
                    "Item tax cannot be negative."
                )

            line_subtotal = (
                quantity * unit_price
            )

            line_total = (
                line_subtotal
                - item_discount
                + item_tax
            )

            if line_total < 0:
                raise ValueError(
                    "Item discount cannot exceed "
                    "the item value."
                )

            InvoiceItem.objects.create(
                invoice=invoice,
                product=product,
                description=description,
                quantity=quantity,
                unit_price=unit_price,
                discount=item_discount,
                tax=item_tax,
                line_total=line_total,
            )

            subtotal += line_total

        total_amount = (
            subtotal
            - discount
            + tax
        )

        if total_amount < 0:
            raise ValueError(
                "Invoice total cannot be negative."
            )

        invoice.subtotal = subtotal
        invoice.total_amount = total_amount
        invoice.amount_paid = Decimal("0.00")
        invoice.balance_due = total_amount

        invoice.save(
            update_fields=[
                "subtotal",
                "total_amount",
                "amount_paid",
                "balance_due",
                "updated_at",
            ]
        )

        if issue:
            InvoicingService.issue_invoice(
                invoice=invoice,
                user=created_by,
            )

        return invoice

    # ============================================================
    # CREATE INVOICE FROM SALE
    # ============================================================

    @staticmethod
    @transaction.atomic
    def create_invoice_from_sale(
        *,
        sale,
        customer,
        invoice_number,
        due_date,
        created_by,
        currency=None,
        exchange_rate=None,
        notes="",
        terms="",
        issue=False,
    ):
        """
        Create an invoice directly from a completed Sale.

        Sale revenue is NOT posted again here if the sale has
        already been completed.

        This creates the commercial invoice/document while
        preserving the original sale accounting.
        """

        if sale.status != Sale.Status.COMPLETED:
            raise ValueError(
                "Only completed sales can be invoiced."
            )

        if customer.company_id != sale.company_id:
            raise ValueError(
                "Customer does not belong to the sale company."
            )

        if hasattr(sale, "invoice"):
            raise ValueError(
                "This sale already has an invoice."
            )

        sale_items = list(
            sale.items.select_related("product")
        )

        if not sale_items:
            raise ValueError(
                "Cannot create an invoice from a sale "
                "without items."
            )

        if currency is None:
            currency = sale.company.currency

        items = []

        for sale_item in sale_items:
            items.append({
                "product": sale_item.product,
                "description": sale_item.product.name,
                "quantity": sale_item.quantity,
                "unit_price": sale_item.unit_price,
                "discount": sale_item.discount,
                "tax": Decimal("0.00"),
            })

        invoice = InvoicingService.create_invoice(
            company=sale.company,
            customer=customer,
            invoice_number=invoice_number,
            invoice_date=sale.sale_date,
            due_date=due_date,
            created_by=created_by,
            items=items,
            currency=currency,
            exchange_rate=exchange_rate,
            discount=sale.discount,
            tax=Decimal("0.00"),
            notes=notes,
            terms=terms,
            sale=sale,
            issue=False,
        )

        if issue:
            InvoicingService.issue_invoice_from_sale(
                invoice=invoice,
                user=created_by,
            )

        return invoice

    # ============================================================
    # ISSUE MANUAL INVOICE
    # ============================================================

    @staticmethod
    @transaction.atomic
    def issue_invoice(*, invoice, user):
        """
        Issue a manually created invoice.

        Invoice values remain in the invoice currency.

        Accounting values are converted to the company's
        functional currency.

        Accounting:

            DR Accounts Receivable 1100
            CR Sales Revenue       4000
        """

        if invoice.status != Invoice.Status.DRAFT:
            raise ValueError(
                "Only draft invoices can be issued."
            )

        if invoice.total_amount <= 0:
            raise ValueError(
                "Cannot issue an invoice with zero value."
            )

        ar_account = InvoicingService._account(
            company=invoice.company,
            code="1100",
        )

        revenue_account = InvoicingService._account(
            company=invoice.company,
            code="4000",
        )

        functional_total = (
            InvoicingService._functional_amount(
                amount=invoice.total_amount,
                exchange_rate=invoice.exchange_rate,
            )
        )

        if functional_total <= 0:
            raise ValueError(
                "Invoice functional-currency value must "
                "be greater than zero."
            )

        journal_entry = AccountingService.create_journal_entry(
            company=invoice.company,
            reference=f"INV-{invoice.invoice_number}",
            description=(
                f"Accounts Receivable invoice "
                f"{invoice.invoice_number}"
            ),
            transaction_date=invoice.invoice_date,
            created_by=user,
            lines=[
                {
                    "account": ar_account,
                    "description": (
                        f"Accounts Receivable - "
                        f"{invoice.customer.name}"
                    ),
                    "debit": functional_total,
                    "credit": Decimal("0.00"),
                },
                {
                    "account": revenue_account,
                    "description": (
                        f"Revenue from invoice "
                        f"{invoice.invoice_number}"
                    ),
                    "debit": Decimal("0.00"),
                    "credit": functional_total,
                },
            ],
            post=True,
        )

        invoice.status = Invoice.Status.ISSUED

        invoice.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        return invoice, journal_entry

    # ============================================================
    # ISSUE INVOICE CREATED FROM SALE
    # ============================================================

    @staticmethod
    @transaction.atomic
    def issue_invoice_from_sale(*, invoice, user):
        """
        Issue an invoice that was generated from an existing Sale.

        The Sale already created its accounting entry.

        Therefore we do NOT create another revenue journal entry.
        """

        if invoice.status != Invoice.Status.DRAFT:
            raise ValueError(
                "Only draft invoices can be issued."
            )

        if invoice.sale_id is None:
            return InvoicingService.issue_invoice(
                invoice=invoice,
                user=user,
            )

        sale = invoice.sale

        if sale.status != Sale.Status.COMPLETED:
            raise ValueError(
                "The linked sale must be completed."
            )

        invoice.status = Invoice.Status.ISSUED

        invoice.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        return invoice

    # ============================================================
    # CUSTOMER PAYMENT
    # ============================================================

    @staticmethod
    @transaction.atomic
    def record_customer_payment(
        *,
        invoice,
        amount,
        payment_date,
        payment_method,
        created_by,
        reference="",
        notes="",
    ):
        """
        Record a payment against a customer invoice.

        The payment amount is entered in the invoice currency.

        The accounting journal entry is posted in the company's
        functional currency.

        Accounting:

            DR Cash/Bank
            CR Accounts Receivable
        """

        if invoice.status in [
            Invoice.Status.DRAFT,
            Invoice.Status.VOIDED,
        ]:
            raise ValueError(
                "Payments cannot be recorded against "
                "draft or voided invoices."
            )

        amount = InvoicingService._decimal(
            amount
        )

        if amount <= 0:
            raise ValueError(
                "Payment amount must be greater than zero."
            )

        if amount > invoice.balance_due:
            raise ValueError(
                "Payment cannot exceed the invoice balance."
            )

        functional_amount = (
            InvoicingService._functional_amount(
                amount=amount,
                exchange_rate=invoice.exchange_rate,
            )
        )

        if functional_amount <= 0:
            raise ValueError(
                "Payment functional-currency value must "
                "be greater than zero."
            )

        if payment_method == (
            CustomerPayment.PaymentMethod.CASH
        ):
            cash_account = InvoicingService._account(
                company=invoice.company,
                code="1000",
            )

        elif payment_method == (
            CustomerPayment.PaymentMethod.BANK
        ):
            cash_account = InvoicingService._account(
                company=invoice.company,
                code="1010",
            )

        else:
            # Mobile money and card are currently routed
            # through the bank account until dedicated
            # accounts are added.
            cash_account = InvoicingService._account(
                company=invoice.company,
                code="1010",
            )

        ar_account = InvoicingService._account(
            company=invoice.company,
            code="1100",
        )

        payment = CustomerPayment.objects.create(
            invoice=invoice,
            amount=amount,
            payment_date=payment_date,
            payment_method=payment_method,
            reference=reference,
            notes=notes,
            created_by=created_by,
        )

        journal_entry = AccountingService.create_journal_entry(
            company=invoice.company,
            reference=(
                reference
                or f"RECEIPT-{payment.id}"
            ),
            description=(
                f"Customer payment for "
                f"invoice {invoice.invoice_number}"
            ),
            transaction_date=payment_date,
            created_by=created_by,
            lines=[
                {
                    "account": cash_account,
                    "description": (
                        f"Payment received from "
                        f"{invoice.customer.name}"
                    ),
                    "debit": functional_amount,
                    "credit": Decimal("0.00"),
                },
                {
                    "account": ar_account,
                    "description": (
                        f"Payment against invoice "
                        f"{invoice.invoice_number}"
                    ),
                    "debit": Decimal("0.00"),
                    "credit": functional_amount,
                },
            ],
            post=True,
        )

        payment.journal_entry = journal_entry

        payment.save(
            update_fields=[
                "journal_entry",
            ]
        )

        # IMPORTANT:
        # Invoice balances remain in the invoice currency.
        invoice.amount_paid += amount

        invoice.balance_due = (
            invoice.total_amount
            - invoice.amount_paid
        )

        if invoice.balance_due == Decimal("0.00"):
            invoice.status = Invoice.Status.PAID
        else:
            invoice.status = Invoice.Status.PARTIALLY_PAID

        invoice.save(
            update_fields=[
                "amount_paid",
                "balance_due",
                "status",
                "updated_at",
            ]
        )

        return payment

    # ============================================================
    # SUPPLIER BILLS / ACCOUNTS PAYABLE
    # ============================================================

    @staticmethod
    @transaction.atomic
    def create_supplier_bill(
        *,
        company,
        supplier,
        bill_number,
        bill_date,
        due_date,
        created_by,
        items,
        discount=Decimal("0.00"),
        tax=Decimal("0.00"),
        notes="",
        terms="",
        post=False,
    ):
        """
        Create a supplier bill.

        If post=True:

            DR Expense/Inventory
            CR Accounts Payable 2000

        The exact debit account for each item is currently
        determined from whether the item references a product.
        """

        if not items:
            raise ValueError(
                "A supplier bill must contain at least one item."
            )

        if supplier.company_id != company.id:
            raise ValueError(
                "Supplier does not belong to this company."
            )

        discount = InvoicingService._decimal(
            discount
        )

        tax = InvoicingService._decimal(
            tax
        )

        if discount < 0:
            raise ValueError(
                "Bill discount cannot be negative."
            )

        if tax < 0:
            raise ValueError(
                "Bill tax cannot be negative."
            )

        bill = SupplierBill.objects.create(
            company=company,
            supplier=supplier,
            bill_number=bill_number,
            bill_date=bill_date,
            due_date=due_date,
            status=SupplierBill.Status.DRAFT,
            discount=discount,
            tax=tax,
            notes=notes,
            terms=terms,
            created_by=created_by,
        )

        subtotal = Decimal("0.00")

        for item_data in items:
            product = item_data.get("product")

            if product is not None:
                if product.company_id != company.id:
                    raise ValueError(
                        "Product does not belong to this company."
                    )

            description = item_data.get(
                "description"
            )

            if not description:
                if product is not None:
                    description = product.name
                else:
                    raise ValueError(
                        "Each bill item must have a description."
                    )

            quantity = InvoicingService._decimal(
                item_data.get("quantity")
            )

            unit_cost = InvoicingService._decimal(
                item_data.get("unit_cost")
            )

            item_discount = InvoicingService._decimal(
                item_data.get(
                    "discount",
                    "0.00",
                )
            )

            item_tax = InvoicingService._decimal(
                item_data.get(
                    "tax",
                    "0.00",
                )
            )

            if quantity <= 0:
                raise ValueError(
                    "Bill quantity must be greater than zero."
                )

            if unit_cost < 0:
                raise ValueError(
                    "Unit cost cannot be negative."
                )

            if item_discount < 0:
                raise ValueError(
                    "Item discount cannot be negative."
                )

            if item_tax < 0:
                raise ValueError(
                    "Item tax cannot be negative."
                )

            line_total = (
                quantity * unit_cost
                - item_discount
                + item_tax
            )

            if line_total < 0:
                raise ValueError(
                    "Item discount cannot exceed "
                    "the item value."
                )

            SupplierBillItem.objects.create(
                bill=bill,
                product=product,
                description=description,
                quantity=quantity,
                unit_cost=unit_cost,
                discount=item_discount,
                tax=item_tax,
                line_total=line_total,
            )

            subtotal += line_total

        total_amount = (
            subtotal
            - discount
            + tax
        )

        if total_amount < 0:
            raise ValueError(
                "Supplier bill total cannot be negative."
            )

        bill.subtotal = subtotal
        bill.total_amount = total_amount
        bill.amount_paid = Decimal("0.00")
        bill.balance_due = total_amount

        bill.save(
            update_fields=[
                "subtotal",
                "total_amount",
                "amount_paid",
                "balance_due",
                "updated_at",
            ]
        )

        if post:
            InvoicingService.post_supplier_bill(
                bill=bill,
                user=created_by,
            )

        return bill

    # ============================================================
    # POST SUPPLIER BILL
    # ============================================================

        # ============================================================
    # POST SUPPLIER BILL
    # ============================================================

    @staticmethod
    @transaction.atomic
    def post_supplier_bill(*, bill, user):
        """
        Post a supplier bill.

        Product-related purchases:

            DR Inventory 1200
            CR Accounts Payable 2000

        Non-product expenses:

            DR Office Expense 6400
            CR Accounts Payable 2000

        For every product-related purchase, a corresponding
        PURCHASE inventory transaction is also recorded.

        The inventory transaction and accounting entry are part
        of the same database transaction.
        """

        if bill.status != SupplierBill.Status.DRAFT:
            raise ValueError(
                "Only draft supplier bills can be posted."
            )

        if bill.total_amount <= 0:
            raise ValueError(
                "Cannot post a supplier bill with zero value."
            )

        ap_account = InvoicingService._account(
            company=bill.company,
            code="2000",
        )

        inventory_account = InvoicingService._account(
            company=bill.company,
            code="1200",
        )

        expense_account = InvoicingService._account(
            company=bill.company,
            code="6400",
        )

        lines = []

        for item in bill.items.select_related("product"):

            if item.product is not None:
                debit_account = inventory_account

                # ====================================================
                # INVENTORY PURCHASE
                # ====================================================
                #
                # This records the physical stock movement.
                #
                # Example:
                #
                # Mango Juice × 10
                # → PURCHASE +10
                #
                InventoryService.record_transaction(
                    company=bill.company,
                    product=item.product,
                    transaction_type="PURCHASE",
                    quantity=item.quantity,
                    unit_cost=item.unit_cost,
                    reference=(
                        f"BILL-{bill.bill_number}"
                    ),
                    description=(
                        f"Purchase of "
                        f"{item.product.name} "
                        f"from {bill.supplier.name}"
                    ),
                    transaction_date=bill.bill_date,
                    created_by=user,
                )

            else:
                debit_account = expense_account

            lines.append({
                "account": debit_account,
                "description": item.description,
                "debit": item.line_total,
                "credit": Decimal("0.00"),
            })

        lines.append({
            "account": ap_account,
            "description": (
                f"Accounts Payable - "
                f"{bill.supplier.name}"
            ),
            "debit": Decimal("0.00"),
            "credit": bill.total_amount,
        })

        AccountingService.create_journal_entry(
            company=bill.company,
            reference=f"BILL-{bill.bill_number}",
            description=(
                f"Accounts Payable supplier bill "
                f"{bill.bill_number}"
            ),
            transaction_date=bill.bill_date,
            created_by=user,
            lines=lines,
            post=True,
        )

        bill.status = SupplierBill.Status.POSTED

        bill.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        return bill

    # ============================================================
    # SUPPLIER PAYMENT
    # ============================================================

    @staticmethod
    @transaction.atomic
    def record_supplier_payment(
        *,
        bill,
        amount,
        payment_date,
        payment_method,
        created_by,
        reference="",
        notes="",
    ):
        """
        Record payment to a supplier.

        Supplier bills currently use the company's
        functional currency.

        Accounting:

            DR Accounts Payable
            CR Cash/Bank
        """

        if bill.status in [
            SupplierBill.Status.DRAFT,
            SupplierBill.Status.VOIDED,
        ]:
            raise ValueError(
                "Payments cannot be recorded against "
                "draft or voided supplier bills."
            )

        amount = InvoicingService._decimal(
            amount
        )

        if amount <= 0:
            raise ValueError(
                "Payment amount must be greater than zero."
            )

        if amount > bill.balance_due:
            raise ValueError(
                "Payment cannot exceed the bill balance."
            )

        if payment_method == (
            SupplierPayment.PaymentMethod.CASH
        ):
            cash_account = InvoicingService._account(
                company=bill.company,
                code="1000",
            )
        else:
            cash_account = InvoicingService._account(
                company=bill.company,
                code="1010",
            )

        ap_account = InvoicingService._account(
            company=bill.company,
            code="2000",
        )

        payment = SupplierPayment.objects.create(
            bill=bill,
            amount=amount,
            payment_date=payment_date,
            payment_method=payment_method,
            reference=reference,
            notes=notes,
            created_by=created_by,
        )

        journal_entry = AccountingService.create_journal_entry(
            company=bill.company,
            reference=(
                reference
                or f"SUP-PAY-{payment.id}"
            ),
            description=(
                f"Supplier payment for "
                f"bill {bill.bill_number}"
            ),
            transaction_date=payment_date,
            created_by=created_by,
            lines=[
                {
                    "account": ap_account,
                    "description": (
                        f"Payment to supplier "
                        f"{bill.supplier.name}"
                    ),
                    "debit": amount,
                    "credit": Decimal("0.00"),
                },
                {
                    "account": cash_account,
                    "description": (
                        f"Supplier payment for "
                        f"bill {bill.bill_number}"
                    ),
                    "debit": Decimal("0.00"),
                    "credit": amount,
                },
            ],
            post=True,
        )

        payment.journal_entry = journal_entry

        payment.save(
            update_fields=[
                "journal_entry",
            ]
        )

        bill.amount_paid += amount

        bill.balance_due = (
            bill.total_amount
            - bill.amount_paid
        )

        if bill.balance_due == Decimal("0.00"):
            bill.status = SupplierBill.Status.PAID
        else:
            bill.status = SupplierBill.Status.PARTIALLY_PAID

        bill.save(
            update_fields=[
                "amount_paid",
                "balance_due",
                "status",
                "updated_at",
            ]
        )

        return payment
    