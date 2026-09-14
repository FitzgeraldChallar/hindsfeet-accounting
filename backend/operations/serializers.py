from rest_framework import serializers

from .models import (
    Inventory,
    InventoryTransaction,
    Product,
    ProductCategory,
    FuelPump,
    PumpAttendant,
    PumpSale,
    Sale,
    SaleItem,
)


class ProductCategorySerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = ProductCategory

        fields = [
            "id",
            "company",
            "name",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class InventorySerializer(
    serializers.ModelSerializer
):
    product_name = serializers.CharField(
        source="product.name",
        read_only=True,
    )

    product_code = serializers.CharField(
        source="product.code",
        read_only=True,
    )

    class Meta:
        model = Inventory

        fields = [
            "id",
            "company",
            "product",
            "product_code",
            "product_name",
            "quantity_on_hand",
            "reorder_level",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "product_code",
            "product_name",
            "updated_at",
        ]


class InventoryTransactionSerializer(
    serializers.ModelSerializer
):
    product_name = serializers.CharField(
        source="product.name",
        read_only=True,
    )

    product_code = serializers.CharField(
        source="product.code",
        read_only=True,
    )

    transaction_type_display = serializers.CharField(
        source="get_transaction_type_display",
        read_only=True,
    )

    class Meta:
        model = InventoryTransaction

        fields = [
            "id",
            "company",
            "product",
            "product_code",
            "product_name",
            "transaction_type",
            "transaction_type_display",
            "quantity",
            "unit_cost",
            "reference",
            "description",
            "transaction_date",
            "created_by",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "product_code",
            "product_name",
            "transaction_type_display",
            "created_by",
            "created_at",
        ]

    def validate(self, attrs):
        company = attrs.get("company")

        product = attrs.get("product")

        if (
            company
            and product
            and product.company_id != company.id
        ):
            raise serializers.ValidationError({
                "product": (
                    "Product must belong to "
                    "the selected company."
                )
            })

        quantity = attrs.get("quantity")

        if quantity is not None and quantity <= 0:
            raise serializers.ValidationError({
                "quantity": (
                    "Quantity must be "
                    "greater than zero."
                )
            })

        unit_cost = attrs.get("unit_cost")

        if unit_cost is not None and unit_cost < 0:
            raise serializers.ValidationError({
                "unit_cost": (
                    "Unit cost cannot "
                    "be negative."
                )
            })

        return attrs


class ProductSerializer(
    serializers.ModelSerializer
):
    inventory = InventorySerializer(
        read_only=True,
    )

    # These are used when editing a product.
    # They do NOT become fields on Product itself.
    inventory_quantity = serializers.DecimalField(
        max_digits=18,
        decimal_places=3,
        min_value=0,
        required=False,
        write_only=True,
    )

    reorder_level = serializers.DecimalField(
        max_digits=18,
        decimal_places=3,
        min_value=0,
        required=False,
        write_only=True,
    )

    class Meta:
        model = Product

        fields = [
            "id",
            "company",
            "category",
            "code",
            "name",
            "product_type",
            "description",
            "unit",
            "selling_price",
            "cost_price",
            "track_inventory",
            "is_active",
            "inventory",
            "inventory_quantity",
            "reorder_level",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "inventory",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        company = attrs.get(
            "company",
            getattr(
                self.instance,
                "company",
                None,
            ),
        )

        category = attrs.get(
            "category",
            getattr(
                self.instance,
                "category",
                None,
            ),
        )

        if (
            category
            and company
            and category.company_id != company.id
        ):
            raise serializers.ValidationError({
                "category": (
                    "Category must belong to "
                    "the same company."
                )
            })

        # A product cannot be moved between companies.
        if (
            self.instance
            and "company" in attrs
            and attrs["company"].id
            != self.instance.company_id
        ):
            raise serializers.ValidationError({
                "company": (
                    "A product cannot be moved "
                    "to another company."
                )
            })

        track_inventory = attrs.get(
            "track_inventory",
            getattr(
                self.instance,
                "track_inventory",
                True,
            ),
        )

        if (
            "inventory_quantity" in attrs
            and not track_inventory
        ):
            raise serializers.ValidationError({
                "inventory_quantity": (
                    "Inventory quantity can only be "
                    "set when inventory tracking is enabled."
                )
            })

        if (
            "reorder_level" in attrs
            and not track_inventory
        ):
            raise serializers.ValidationError({
                "reorder_level": (
                    "Reorder level can only be set when "
                    "inventory tracking is enabled."
                )
            })

        return attrs


class SaleItemSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = SaleItem

        fields = [
            "id",
            "sale",
            "product",
            "quantity",
            "unit_price",
            "unit_cost",
            "discount",
            "line_total",
            "line_cost",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "line_total",
            "line_cost",
            "created_at",
        ]


class SaleSerializer(
    serializers.ModelSerializer
):
    items = SaleItemSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = Sale

        fields = [
            "id",
            "company",
            "sale_number",
            "sale_date",
            "customer_name",
            "payment_method",
            "status",
            "subtotal",
            "discount",
            "total_amount",
            "total_cost",
            "gross_profit",
            "notes",
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
            "total_cost",
            "gross_profit",
            "created_by",
            "created_at",
            "updated_at",
            "items",
        ]


class SaleUpdateItemSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = SaleItem

        fields = [
            "product",
            "quantity",
            "unit_price",
            "unit_cost",
            "discount",
        ]


class SaleUpdateSerializer(
    serializers.ModelSerializer
):
    items = SaleUpdateItemSerializer(
        many=True,
        required=False,
    )

    class Meta:
        model = Sale

        fields = [
            "company",
            "sale_number",
            "sale_date",
            "customer_name",
            "payment_method",
            "discount",
            "notes",
            "items",
        ]

    def validate(self, attrs):
        company = attrs.get(
            "company",
            getattr(
                self.instance,
                "company",
                None,
            ),
        )

        if (
            self.instance
            and "company" in attrs
            and attrs["company"].id
            != self.instance.company_id
        ):
            raise serializers.ValidationError({
                "company": (
                    "A sale cannot be moved "
                    "to another company."
                )
            })

        items = attrs.get("items")

        if items is not None and not items:
            raise serializers.ValidationError({
                "items": (
                    "A sale must contain at least one item."
                )
            })

        if items is not None:
            for item in items:
                product = item["product"]

                if product.company_id != company.id:
                    raise serializers.ValidationError({
                        "items": (
                            "Every product must belong "
                            "to the sale company."
                        )
                    })

                if item["quantity"] <= 0:
                    raise serializers.ValidationError({
                        "items": (
                            "Sale quantity must be "
                            "greater than zero."
                        )
                    })

                if item["unit_price"] < 0:
                    raise serializers.ValidationError({
                        "items": (
                            "Unit price cannot "
                            "be negative."
                        )
                    })

                if item["unit_cost"] < 0:
                    raise serializers.ValidationError({
                        "items": (
                            "Unit cost cannot "
                            "be negative."
                        )
                    })

                if item["discount"] < 0:
                    raise serializers.ValidationError({
                        "items": (
                            "Item discount cannot "
                            "be negative."
                        )
                    })

        discount = attrs.get(
            "discount",
            getattr(
                self.instance,
                "discount",
                0,
            ),
        )

        if discount < 0:
            raise serializers.ValidationError({
                "discount": (
                    "Sale discount cannot "
                    "be negative."
                )
            })

        return attrs


class FuelPumpSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = FuelPump

        fields = [
            "id",
            "company",
            "pump_number",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class PumpAttendantSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = PumpAttendant

        fields = [
            "id",
            "company",
            "employee_code",
            "full_name",
            "phone",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class PumpSaleSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = PumpSale

        fields = [
            "id",
            "company",
            "attendant",
            "pump",
            "fuel_product",
            "sale_date",
            "opening_meter",
            "closing_meter",
            "litres_sold",
            "price_per_litre",
            "total_amount",
            "payment_method",
            "status",
            "reference",
            "notes",
            "created_by",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "litres_sold",
            "total_amount",
            "status",
            "created_by",
            "created_at",
            "updated_at",
        ]