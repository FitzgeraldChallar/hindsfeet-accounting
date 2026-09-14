from decimal import Decimal

from django.db import transaction

from .models import Inventory, InventoryTransaction


class InventoryService:

    @staticmethod
    @transaction.atomic
    def record_transaction(
        *,
        company,
        product,
        transaction_type,
        quantity,
        created_by,
        transaction_date,
        unit_cost=Decimal("0.00"),
        reference="",
        description="",
    ):
        """
        Record an inventory movement and update the
        current inventory balance atomically.
        """

        quantity = Decimal(str(quantity))
        unit_cost = Decimal(str(unit_cost))

        if quantity <= 0:
            raise ValueError(
                "Inventory quantity must be greater than zero."
            )

        if product.company_id != company.id:
            raise ValueError(
                "Product does not belong to this company."
            )

        if not product.track_inventory:
            raise ValueError(
                "Inventory tracking is disabled for this product."
            )

        inventory, _ = Inventory.objects.select_for_update().get_or_create(
            company=company,
            product=product,
        )

        increases = {
            InventoryTransaction.TransactionType.PURCHASE,
            InventoryTransaction.TransactionType.ADJUSTMENT_IN,
            InventoryTransaction.TransactionType.RETURN_IN,
            InventoryTransaction.TransactionType.OPENING_BALANCE,
        }

        decreases = {
            InventoryTransaction.TransactionType.SALE,
            InventoryTransaction.TransactionType.ADJUSTMENT_OUT,
            InventoryTransaction.TransactionType.RETURN_OUT,
        }

        if transaction_type in increases:
            inventory.quantity_on_hand += quantity

        elif transaction_type in decreases:
            if inventory.quantity_on_hand < quantity:
                raise ValueError(
                    f"Insufficient inventory for {product.name}. "
                    f"Available: {inventory.quantity_on_hand}, "
                    f"Requested: {quantity}."
                )

            inventory.quantity_on_hand -= quantity

        else:
            raise ValueError(
                "Invalid inventory transaction type."
            )

        inventory.save()

        transaction_record = InventoryTransaction.objects.create(
            company=company,
            product=product,
            transaction_type=transaction_type,
            quantity=quantity,
            unit_cost=unit_cost,
            reference=reference,
            description=description,
            transaction_date=transaction_date,
            created_by=created_by,
        )

        return transaction_record

    