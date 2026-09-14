from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from accounting.models import Account
from accounting.services import AccountingService

from .models import (
    FuelPump,
    Inventory,
    InventoryTransaction,
    Product,
    PumpAttendant,
    PumpSale,
)


class GasStationService:
    """
    Business logic for gas-station-specific operations.

    Gas-station functionality is only available to companies
    whose business_type is GAS_STATION.
    """

    GAS_STATION_BUSINESS_TYPE = "GAS_STATION"

    @staticmethod
    def _validate_gas_station_company(company):
        """
        Ensure that the company is actually a gas station.
        """

        if company.business_type != (
            GasStationService.GAS_STATION_BUSINESS_TYPE
        ):
            raise ValueError(
                "Gas station operations are only available "
                "for gas station companies."
            )

    @staticmethod
    def _get_payment_account(
        *,
        company,
        payment_method,
    ):
        """
        Returns the accounting account that receives
        the pump-sale payment.
        """

        if payment_method == PumpSale.PaymentMethod.CREDIT:
            code = "1100"

        elif payment_method == PumpSale.PaymentMethod.BANK:
            code = "1010"

        else:
            code = "1000"

        try:
            return Account.objects.get(
                company=company,
                code=code,
                is_active=True,
            )
        except Account.DoesNotExist:
            raise ValueError(
                f"Required accounting account {code} "
                f"does not exist for this company."
            )

    @staticmethod
    def _get_account(
        *,
        company,
        code,
        name,
    ):
        """
        Safely retrieve a required accounting account.
        """

        try:
            return Account.objects.get(
                company=company,
                code=code,
                is_active=True,
            )
        except Account.DoesNotExist:
            raise ValueError(
                f"Required account '{name}' "
                f"({code}) does not exist for this company."
            )

    @staticmethod
    @transaction.atomic
    def record_pump_sale(
        *,
        company,
        attendant,
        pump,
        fuel_product,
        sale_date,
        opening_meter,
        closing_meter,
        price_per_litre,
        created_by,
        payment_method=PumpSale.PaymentMethod.CASH,
        reference="",
        notes="",
        complete=True,
    ):
        """
        Record a fuel sale from a specific pump.

        Process:

        1. Validate company.
        2. Validate attendant.
        3. Validate pump.
        4. Validate fuel product.
        5. Calculate litres sold.
        6. Calculate total revenue.
        7. Create PumpSale.
        8. Reduce fuel inventory.
        9. Create inventory transaction.
        10. Create and post accounting journal entry.
        """

        GasStationService._validate_gas_station_company(
            company
        )

        if attendant.company_id != company.id:
            raise ValueError(
                "The pump attendant does not belong "
                "to this company."
            )

        if not attendant.is_active:
            raise ValueError(
                "The pump attendant is inactive."
            )

        if pump.company_id != company.id:
            raise ValueError(
                "The fuel pump does not belong "
                "to this company."
            )

        if not pump.is_active:
            raise ValueError(
                "The fuel pump is inactive."
            )

        if fuel_product.company_id != company.id:
            raise ValueError(
                "The fuel product does not belong "
                "to this company."
            )

        if fuel_product.product_type != Product.ProductType.FUEL:
            raise ValueError(
                "The selected product is not a fuel product."
            )

        opening_meter = Decimal(
            str(opening_meter)
        )

        closing_meter = Decimal(
            str(closing_meter)
        )

        price_per_litre = Decimal(
            str(price_per_litre)
        )

        if opening_meter < 0:
            raise ValueError(
                "Opening meter cannot be negative."
            )

        if closing_meter < opening_meter:
            raise ValueError(
                "Closing meter cannot be less "
                "than opening meter."
            )

        if price_per_litre < 0:
            raise ValueError(
                "Price per litre cannot be negative."
            )

        litres_sold = (
            closing_meter - opening_meter
        )

        if litres_sold <= 0:
            raise ValueError(
                "The pump sale must contain "
                "a positive quantity of fuel sold."
            )

        total_amount = (
            litres_sold * price_per_litre
        )

        pump_sale = PumpSale.objects.create(
            company=company,
            attendant=attendant,
            pump=pump,
            fuel_product=fuel_product,
            sale_date=sale_date,
            opening_meter=opening_meter,
            closing_meter=closing_meter,
            litres_sold=litres_sold,
            price_per_litre=price_per_litre,
            total_amount=total_amount,
            payment_method=payment_method,
            status=PumpSale.Status.DRAFT,
            reference=reference,
            notes=notes,
            created_by=created_by,
        )

        if complete:
            GasStationService.complete_pump_sale(
                pump_sale=pump_sale,
                user=created_by,
            )

        return pump_sale

    @staticmethod
    @transaction.atomic
    def complete_pump_sale(
        *,
        pump_sale,
        user,
    ):
        """
        Complete a draft pump sale.

        Inventory and accounting are updated atomically.
        """

        if pump_sale.status != PumpSale.Status.DRAFT:
            raise ValueError(
                "Only draft pump sales can be completed."
            )

        company = pump_sale.company
        product = pump_sale.fuel_product

        GasStationService._validate_gas_station_company(
            company
        )

        if pump_sale.attendant.company_id != company.id:
            raise ValueError(
                "The pump attendant does not belong "
                "to this company."
            )

        if pump_sale.pump.company_id != company.id:
            raise ValueError(
                "The fuel pump does not belong "
                "to this company."
            )

        if product.company_id != company.id:
            raise ValueError(
                "The fuel product does not belong "
                "to this company."
            )

        if product.product_type != Product.ProductType.FUEL:
            raise ValueError(
                "Pump sale product must be fuel."
            )

        try:
            inventory = (
                Inventory.objects
                .select_for_update()
                .get(
                    company=company,
                    product=product,
                )
            )
        except Inventory.DoesNotExist:
            raise ValueError(
                f"No inventory record exists for "
                f"{product.name}."
            )

        if (
            inventory.quantity_on_hand
            < pump_sale.litres_sold
        ):
            raise ValueError(
                f"Insufficient inventory for "
                f"{product.name}. "
                f"Available: "
                f"{inventory.quantity_on_hand}, "
                f"Required: "
                f"{pump_sale.litres_sold}."
            )

        unit_cost = product.cost_price

        total_cost = (
            pump_sale.litres_sold * unit_cost
        )

        inventory.quantity_on_hand -= (
            pump_sale.litres_sold
        )

        inventory.save(
            update_fields=[
                "quantity_on_hand",
                "updated_at",
            ]
        )

        InventoryTransaction.objects.create(
            company=company,
            product=product,
            transaction_type=(
                InventoryTransaction.TransactionType.SALE
            ),
            quantity=pump_sale.litres_sold,
            unit_cost=unit_cost,
            reference=(
                pump_sale.reference
                or f"PUMP-{pump_sale.id}"
            ),
            description=(
                f"Fuel sale by "
                f"{pump_sale.attendant.full_name} "
                f"on Pump "
                f"{pump_sale.pump.pump_number}"
            ),
            transaction_date=pump_sale.sale_date,
            created_by=user,
        )

        payment_account = (
            GasStationService._get_payment_account(
                company=company,
                payment_method=(
                    pump_sale.payment_method
                ),
            )
        )

        revenue_account = (
            GasStationService._get_account(
                company=company,
                code="4000",
                name="Sales Revenue",
            )
        )

        cogs_account = (
            GasStationService._get_account(
                company=company,
                code="5000",
                name="Cost of Goods Sold",
            )
        )

        inventory_account = (
            GasStationService._get_account(
                company=company,
                code="1200",
                name="Inventory",
            )
        )

        journal_lines = [
            {
                "account": payment_account,
                "description": (
                    f"Fuel sale by "
                    f"{pump_sale.attendant.full_name}"
                ),
                "debit": pump_sale.total_amount,
                "credit": Decimal("0.00"),
            },
            {
                "account": revenue_account,
                "description": (
                    f"Fuel revenue - "
                    f"{product.name}"
                ),
                "debit": Decimal("0.00"),
                "credit": pump_sale.total_amount,
            },
            {
                "account": cogs_account,
                "description": (
                    f"Fuel COGS - "
                    f"{product.name}"
                ),
                "debit": total_cost,
                "credit": Decimal("0.00"),
            },
            {
                "account": inventory_account,
                "description": (
                    f"Fuel inventory reduction - "
                    f"{product.name}"
                ),
                "debit": Decimal("0.00"),
                "credit": total_cost,
            },
        ]

        AccountingService.create_journal_entry(
            company=company,
            reference=(
                f"PUMP-SALE-{pump_sale.id}"
            ),
            description=(
                f"Fuel sale by "
                f"{pump_sale.attendant.full_name} "
                f"on Pump "
                f"{pump_sale.pump.pump_number}"
            ),
            transaction_date=pump_sale.sale_date,
            created_by=user,
            lines=journal_lines,
            post=True,
        )

        pump_sale.status = PumpSale.Status.COMPLETED

        pump_sale.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        return pump_sale

