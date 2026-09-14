from decimal import Decimal

from django.db import transaction

from accounting.services import AccountingService
from accounting.models import (
    Account,
    JournalEntry,
)

from .models import (
    InventoryTransaction,
    Product,
    Sale,
    SaleItem,
)
from .services import InventoryService


class SalesService:

    # ============================================================
    # CREATE SALE
    # ============================================================

    @staticmethod
    @transaction.atomic
    def create_sale(
        *,
        company,
        sale_number,
        sale_date,
        created_by,
        items,
        payment_method=Sale.PaymentMethod.CASH,
        customer_name="",
        discount=Decimal("0.00"),
        notes="",
        complete=True,
    ):
        """
        Creates a sale and, when complete=True:

        1. Validates all products.
        2. Calculates revenue and COGS.
        3. Reduces inventory.
        4. Creates inventory audit records.
        5. Creates the accounting journal entry.
        6. Marks the sale as completed.
        """

        if not items:
            raise ValueError(
                "A sale must contain at least one item."
            )

        discount = Decimal(str(discount))

        if discount < 0:
            raise ValueError(
                "Discount cannot be negative."
            )

        sale = Sale.objects.create(
            company=company,
            sale_number=sale_number,
            sale_date=sale_date,
            customer_name=customer_name,
            payment_method=payment_method,
            status=Sale.Status.DRAFT,
            discount=discount,
            notes=notes,
            created_by=created_by,
        )

        subtotal = Decimal("0.00")
        total_cost = Decimal("0.00")

        for item_data in items:
            product = item_data["product"]

            if product.company_id != company.id:
                raise ValueError(
                    "Product does not belong to this company."
                )

            quantity = Decimal(
                str(item_data["quantity"])
            )

            if quantity <= 0:
                raise ValueError(
                    "Sale quantity must be greater than zero."
                )

            unit_price = Decimal(
                str(
                    item_data.get(
                        "unit_price",
                        product.selling_price,
                    )
                )
            )

            unit_cost = Decimal(
                str(
                    item_data.get(
                        "unit_cost",
                        product.cost_price,
                    )
                )
            )

            item_discount = Decimal(
                str(
                    item_data.get(
                        "discount",
                        "0.00",
                    )
                )
            )

            if unit_price < 0:
                raise ValueError(
                    "Unit price cannot be negative."
                )

            if unit_cost < 0:
                raise ValueError(
                    "Unit cost cannot be negative."
                )

            if item_discount < 0:
                raise ValueError(
                    "Item discount cannot be negative."
                )

            line_total = (
                quantity * unit_price
            ) - item_discount

            line_cost = (
                quantity * unit_cost
            )

            if line_total < 0:
                raise ValueError(
                    "Item discount cannot exceed "
                    "the item value."
                )

            SaleItem.objects.create(
                sale=sale,
                product=product,
                quantity=quantity,
                unit_price=unit_price,
                unit_cost=unit_cost,
                discount=item_discount,
                line_total=line_total,
                line_cost=line_cost,
            )

            subtotal += line_total
            total_cost += line_cost

        total_amount = subtotal - discount

        if total_amount < 0:
            raise ValueError(
                "Sale discount cannot exceed "
                "the sale subtotal."
            )

        gross_profit = (
            total_amount - total_cost
        )

        sale.subtotal = subtotal
        sale.total_amount = total_amount
        sale.total_cost = total_cost
        sale.gross_profit = gross_profit

        sale.save(
            update_fields=[
                "subtotal",
                "total_amount",
                "total_cost",
                "gross_profit",
                "updated_at",
            ]
        )

        if complete:
            SalesService.complete_sale(
                sale=sale,
                user=created_by,
            )

        return sale

    # ============================================================
    # COMPLETE SALE
    # ============================================================

    @staticmethod
    @transaction.atomic
    def complete_sale(*, sale, user):
        """
        Completes a draft sale.

        Inventory and accounting are updated together.
        """

        if sale.status != Sale.Status.DRAFT:
            raise ValueError(
                "Only draft sales can be completed."
            )

        items = list(
            sale.items.select_related("product")
        )

        if not items:
            raise ValueError(
                "Cannot complete a sale without items."
            )

        total_cost = Decimal("0.00")

        for item in items:

            if item.product.track_inventory:

                InventoryService.record_transaction(
                    company=sale.company,
                    product=item.product,
                    transaction_type="SALE",
                    quantity=item.quantity,
                    unit_cost=item.unit_cost,
                    reference=sale.sale_number,
                    description=(
                        f"Sale of {item.product.name}"
                    ),
                    transaction_date=sale.sale_date,
                    created_by=user,
                )

            total_cost += item.line_cost

        sale.total_cost = total_cost
        sale.gross_profit = (
            sale.total_amount - total_cost
        )

        revenue_account = Account.objects.get(
            company=sale.company,
            code="4000",
        )

        cogs_account = Account.objects.get(
            company=sale.company,
            code="5000",
        )

        inventory_account = Account.objects.get(
            company=sale.company,
            code="1200",
        )

        if sale.payment_method == Sale.PaymentMethod.CREDIT:

            receivable_account = Account.objects.get(
                company=sale.company,
                code="1100",
            )

            debit_account = receivable_account

        else:

            if sale.payment_method == Sale.PaymentMethod.BANK:

                debit_account = Account.objects.get(
                    company=sale.company,
                    code="1010",
                )

            else:

                debit_account = Account.objects.get(
                    company=sale.company,
                    code="1000",
                )

        journal_lines = [
            {
                "account": debit_account,
                "description": (
                    f"Sale {sale.sale_number}"
                ),
                "debit": sale.total_amount,
                "credit": Decimal("0.00"),
            },
            {
                "account": revenue_account,
                "description": (
                    f"Revenue from sale "
                    f"{sale.sale_number}"
                ),
                "debit": Decimal("0.00"),
                "credit": sale.total_amount,
            },
        ]

        if total_cost > 0:

            journal_lines.extend([
                {
                    "account": cogs_account,
                    "description": (
                        f"COGS for sale "
                        f"{sale.sale_number}"
                    ),
                    "debit": total_cost,
                    "credit": Decimal("0.00"),
                },
                {
                    "account": inventory_account,
                    "description": (
                        f"Inventory reduction for "
                        f"sale {sale.sale_number}"
                    ),
                    "debit": Decimal("0.00"),
                    "credit": total_cost,
                },
            ])

        AccountingService.create_journal_entry(
            company=sale.company,
            reference=f"SALE-{sale.sale_number}",
            description=(
                f"Accounting entry for "
                f"sale {sale.sale_number}"
            ),
            transaction_date=sale.sale_date,
            created_by=user,
            lines=journal_lines,
            post=True,
        )

        sale.status = Sale.Status.COMPLETED

        sale.save(
            update_fields=[
                "total_cost",
                "gross_profit",
                "status",
                "updated_at",
            ]
        )

        return sale

    # ============================================================
    # REVERSE COMPLETED SALE
    # ============================================================

    @staticmethod
    @transaction.atomic
    def reverse_completed_sale(
        *,
        sale,
        user,
        sale_date,
    ):
        """
        Reverses the inventory and accounting impact of
        the latest completed version of a sale.

        Original records are never deleted.
        """

        journal_reference = (
            f"SALE-{sale.sale_number}"
        )

        journal_entry = (
            JournalEntry.objects
            .filter(
                company=sale.company,
                reference=journal_reference,
                status=JournalEntry.Status.POSTED,
            )
            .order_by("-id")
            .first()
        )

        if not journal_entry:
            raise ValueError(
                "The accounting entry for this sale "
                "could not be found. The sale cannot be edited."
            )

        # --------------------------------------------------------
        # Restore inventory
        # --------------------------------------------------------

        original_items = list(
            sale.items.select_related("product")
        )

        for item in original_items:

            inventory_sale_transaction = (
                InventoryTransaction.objects
                .filter(
                    company=sale.company,
                    product=item.product,
                    transaction_type="SALE",
                    reference=sale.sale_number,
                )
                .order_by("-id")
                .first()
            )

            if inventory_sale_transaction:

                InventoryService.record_transaction(
                    company=sale.company,
                    product=item.product,
                    transaction_type="RETURN_IN",
                    quantity=item.quantity,
                    unit_cost=item.unit_cost,
                    reference=(
                        f"SALE-EDIT-REV-{sale.id}"
                    ),
                    description=(
                        f"Inventory reversal for "
                        f"edited sale {sale.sale_number}"
                    ),
                    transaction_date=sale_date,
                    created_by=user,
                )

        # --------------------------------------------------------
        # Reverse accounting entry
        # --------------------------------------------------------

        reversal_lines = []

        for line in journal_entry.lines.select_related(
            "account"
        ):

            reversal_lines.append({
                "account": line.account,
                "description": (
                    f"Reversal of "
                    f"{journal_entry.reference}"
                ),
                "debit": line.credit,
                "credit": line.debit,
            })

        AccountingService.create_journal_entry(
            company=sale.company,
            reference=(
                f"SALE-EDIT-REV-{sale.id}-"
                f"{journal_entry.id}"
            ),
            description=(
                f"Reversal of accounting entry "
                f"{journal_entry.reference}"
            ),
            transaction_date=sale_date,
            created_by=user,
            lines=reversal_lines,
            post=True,
        )

        return journal_entry

    # ============================================================
    # UPDATE SALE
    # ============================================================

    @staticmethod
    @transaction.atomic
    def update_sale(
        *,
        sale,
        user,
        company=None,
        sale_number=None,
        sale_date=None,
        customer_name=None,
        payment_method=None,
        discount=None,
        notes=None,
        items=None,
    ):
        """
        Edit an existing sale.

        Draft sales:
            - Updated directly.

        Completed sales:
            - Original inventory impact is reversed.
            - Original accounting entry is reversed.
            - Sale is rebuilt.
            - New inventory/accounting entries are posted.

        Original accounting records remain intact.
        """

        if sale.status == Sale.Status.VOIDED:
            raise ValueError(
                "Voided sales cannot be edited."
            )

        # A sale linked to an invoice must not be altered
        # behind the invoicing/AR module's back.
        if hasattr(sale, "invoice"):
            raise ValueError(
                "This sale is linked to an invoice "
                "and cannot be edited."
            )

        old_status = sale.status
        old_sale_date = sale.sale_date

        if company is not None:
            if company.id != sale.company_id:
                raise ValueError(
                    "Sale cannot be moved to another company."
                )

        if sale_number is None:
            sale_number = sale.sale_number

        if sale_date is None:
            sale_date = sale.sale_date

        if customer_name is None:
            customer_name = sale.customer_name

        if payment_method is None:
            payment_method = sale.payment_method

        if discount is None:
            discount = sale.discount

        if notes is None:
            notes = sale.notes

        discount = Decimal(str(discount))

        if discount < 0:
            raise ValueError(
                "Sale discount cannot be negative."
            )

        # --------------------------------------------------------
        # Preserve old completed accounting/inventory effects
        # --------------------------------------------------------

        if old_status == Sale.Status.COMPLETED:

            SalesService.reverse_completed_sale(
                sale=sale,
                user=user,
                sale_date=old_sale_date,
            )

        # --------------------------------------------------------
        # Prepare updated sale
        # --------------------------------------------------------

        if items is None:

            items = [
                {
                    "product": item.product,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "unit_cost": item.unit_cost,
                    "discount": item.discount,
                }
                for item in sale.items.select_related(
                    "product"
                )
            ]

        if not items:
            raise ValueError(
                "A sale must contain at least one item."
            )

        # --------------------------------------------------------
        # Replace sale items
        # --------------------------------------------------------

        sale.items.all().delete()

        subtotal = Decimal("0.00")

        for item_data in items:

            product = item_data["product"]

            if product.company_id != sale.company_id:
                raise ValueError(
                    "Product does not belong to "
                    "the sale company."
                )

            quantity = Decimal(
                str(item_data["quantity"])
            )

            unit_price = Decimal(
                str(item_data["unit_price"])
            )

            unit_cost = Decimal(
                str(item_data["unit_cost"])
            )

            item_discount = Decimal(
                str(item_data.get(
                    "discount",
                    "0.00",
                ))
            )

            if quantity <= 0:
                raise ValueError(
                    "Sale quantity must be greater than zero."
                )

            if unit_price < 0:
                raise ValueError(
                    "Unit price cannot be negative."
                )

            if unit_cost < 0:
                raise ValueError(
                    "Unit cost cannot be negative."
                )

            if item_discount < 0:
                raise ValueError(
                    "Item discount cannot be negative."
                )

            line_total = (
                quantity * unit_price
            ) - item_discount

            line_cost = (
                quantity * unit_cost
            )

            if line_total < 0:
                raise ValueError(
                    "Item discount cannot exceed "
                    "the item value."
                )

            SaleItem.objects.create(
                sale=sale,
                product=product,
                quantity=quantity,
                unit_price=unit_price,
                unit_cost=unit_cost,
                discount=item_discount,
                line_total=line_total,
                line_cost=line_cost,
            )

            subtotal += line_total

        total_amount = (
            subtotal - discount
        )

        if total_amount < 0:
            raise ValueError(
                "Sale discount cannot exceed "
                "the sale subtotal."
            )

        sale.sale_number = sale_number
        sale.sale_date = sale_date
        sale.customer_name = customer_name
        sale.payment_method = payment_method
        sale.discount = discount
        sale.notes = notes

        sale.subtotal = subtotal
        sale.total_amount = total_amount

        sale.total_cost = sum(
            (
                item.line_cost
                for item in sale.items.all()
            ),
            Decimal("0.00"),
        )

        sale.gross_profit = (
            sale.total_amount
            - sale.total_cost
        )

        # Keep completed sales completed after re-posting.
        # Draft sales remain drafts until completed normally.
        sale.status = Sale.Status.DRAFT

        sale.save(
            update_fields=[
                "sale_number",
                "sale_date",
                "customer_name",
                "payment_method",
                "discount",
                "notes",
                "subtotal",
                "total_amount",
                "total_cost",
                "gross_profit",
                "status",
                "updated_at",
            ]
        )

        if old_status == Sale.Status.COMPLETED:

            SalesService.complete_sale(
                sale=sale,
                user=user,
            )

        return sale