from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from companies.models import Company


class ProductCategory(models.Model):
    """
    Groups products within a company.

    Examples:
    - Fuel
    - Mini-Mart
    - Cement
    - Office Supplies
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="product_categories",
    )

    name = models.CharField(
        max_length=100,
    )

    description = models.TextField(
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
                fields=["company", "name"],
                name="unique_product_category_per_company",
            ),
        ]

    def __str__(self):
        return f"{self.company.name} - {self.name}"


class Product(models.Model):
    """
    Products or services sold by a company.
    """

    class ProductType(models.TextChoices):
        PRODUCT = "PRODUCT", "Product"
        SERVICE = "SERVICE", "Service"
        FUEL = "FUEL", "Fuel"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="products",
    )

    category = models.ForeignKey(
        ProductCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
    )

    code = models.CharField(
        max_length=50,
    )

    name = models.CharField(
        max_length=150,
    )

    product_type = models.CharField(
        max_length=20,
        choices=ProductType.choices,
        default=ProductType.PRODUCT,
    )

    description = models.TextField(
        blank=True,
    )

    unit = models.CharField(
        max_length=30,
        default="unit",
    )

    selling_price = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    cost_price = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    track_inventory = models.BooleanField(
        default=True,
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
                fields=["company", "code"],
                name="unique_product_code_per_company",
            ),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"


class Inventory(models.Model):
    """
    Stores the current inventory balance for a product.
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="inventories",
    )

    product = models.OneToOneField(
        Product,
        on_delete=models.CASCADE,
        related_name="inventory",
    )

    quantity_on_hand = models.DecimalField(
        max_digits=18,
        decimal_places=3,
        default=Decimal("0.000"),
    )

    reorder_level = models.DecimalField(
        max_digits=18,
        decimal_places=3,
        default=Decimal("0.000"),
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        verbose_name_plural = "Inventory"

    def __str__(self):
        return (
            f"{self.product.name} - "
            f"{self.quantity_on_hand}"
        )


class InventoryTransaction(models.Model):
    """
    Permanent audit record of every inventory movement.

    Inventory stores the current balance.

    InventoryTransaction stores the history explaining
    how that balance was reached.
    """

    class TransactionType(models.TextChoices):
        PURCHASE = "PURCHASE", "Purchase"
        SALE = "SALE", "Sale"
        ADJUSTMENT_IN = "ADJUSTMENT_IN", "Adjustment In"
        ADJUSTMENT_OUT = "ADJUSTMENT_OUT", "Adjustment Out"
        RETURN_IN = "RETURN_IN", "Return In"
        RETURN_OUT = "RETURN_OUT", "Return Out"
        OPENING_BALANCE = "OPENING_BALANCE", "Opening Balance"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="inventory_transactions",
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="inventory_transactions",
    )

    transaction_type = models.CharField(
        max_length=30,
        choices=TransactionType.choices,
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
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    reference = models.CharField(
        max_length=100,
        blank=True,
    )

    description = models.TextField(
        blank=True,
    )

    transaction_date = models.DateField()

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="inventory_transactions_created",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = [
            "-transaction_date",
            "-id",
        ]

    def __str__(self):
        return (
            f"{self.product.name} - "
            f"{self.transaction_type} - "
            f"{self.quantity}"
        )
    
class Sale(models.Model):
    """
    Represents a completed sale.

    A sale belongs to exactly one company and can contain
    multiple products.
    """

    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"
        BANK = "BANK", "Bank"
        MOBILE_MONEY = "MOBILE_MONEY", "Mobile Money"
        CARD = "CARD", "Card"
        CREDIT = "CREDIT", "Credit"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        COMPLETED = "COMPLETED", "Completed"
        VOIDED = "VOIDED", "Voided"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="sales",
    )

    sale_number = models.CharField(
        max_length=50,
    )

    sale_date = models.DateField()

    customer_name = models.CharField(
        max_length=150,
        blank=True,
    )

    payment_method = models.CharField(
        max_length=30,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CASH,
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

    total_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    total_cost = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    gross_profit = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    notes = models.TextField(
        blank=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sales_created",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "-sale_date",
            "-id",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["company", "sale_number"],
                name="unique_sale_number_per_company",
            )
        ]

    def __str__(self):
        return (
            f"{self.sale_number} - "
            f"{self.company.name}"
        )


class SaleItem(models.Model):
    """
    Individual product/service line within a sale.
    """

    sale = models.ForeignKey(
        Sale,
        on_delete=models.CASCADE,
        related_name="items",
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="sale_items",
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

    line_total = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    line_cost = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    def __str__(self):
        return (
            f"{self.sale.sale_number} - "
            f"{self.product.name}"
        )

class PumpAttendant(models.Model):
    """
    Pump attendant working at a gas station.

    This model is only valid for companies whose company_type
    is GAS_STATION.
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="pump_attendants",
    )

    employee_code = models.CharField(
        max_length=50,
    )

    full_name = models.CharField(
        max_length=150,
    )

    phone = models.CharField(
        max_length=30,
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
        ordering = ["full_name"]

        constraints = [
            models.UniqueConstraint(
                fields=["company", "employee_code"],
                name="unique_attendant_code_per_company",
            ),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.company.company_type != Company.CompanyType.GAS_STATION:
            raise ValidationError(
                "Pump attendants can only be created "
                "for gas station companies."
            )

    def __str__(self):
        return f"{self.employee_code} - {self.full_name}"


class FuelPump(models.Model):
    """
    A physical fuel pump at a gas station.

    A pump belongs to one gas station company.
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="fuel_pumps",
    )

    pump_number = models.CharField(
        max_length=30,
    )

    description = models.CharField(
        max_length=150,
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
        ordering = ["pump_number"]

        constraints = [
            models.UniqueConstraint(
                fields=["company", "pump_number"],
                name="unique_pump_number_per_company",
            ),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.company.company_type != Company.CompanyType.GAS_STATION:
            raise ValidationError(
                "Fuel pumps can only be created "
                "for gas station companies."
            )

    def __str__(self):
        return (
            f"{self.company.name} - "
            f"Pump {self.pump_number}"
        )


class PumpSale(models.Model):
    """
    Daily fuel sale recorded against a pump attendant
    and a physical fuel pump.

    This provides the detailed audit trail behind
    the gas station's fuel revenue.
    """

    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"
        BANK = "BANK", "Bank"
        MOBILE_MONEY = "MOBILE_MONEY", "Mobile Money"
        CARD = "CARD", "Card"
        CREDIT = "CREDIT", "Credit"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        COMPLETED = "COMPLETED", "Completed"
        VOIDED = "VOIDED", "Voided"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="pump_sales",
    )

    attendant = models.ForeignKey(
        PumpAttendant,
        on_delete=models.PROTECT,
        related_name="pump_sales",
    )

    pump = models.ForeignKey(
        FuelPump,
        on_delete=models.PROTECT,
        related_name="pump_sales",
    )

    fuel_product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="pump_sales",
    )

    sale_date = models.DateField()

    opening_meter = models.DecimalField(
        max_digits=18,
        decimal_places=3,
        validators=[
            MinValueValidator(Decimal("0.000")),
        ],
    )

    closing_meter = models.DecimalField(
        max_digits=18,
        decimal_places=3,
        validators=[
            MinValueValidator(Decimal("0.000")),
        ],
    )

    litres_sold = models.DecimalField(
        max_digits=18,
        decimal_places=3,
        default=Decimal("0.000"),
        validators=[
            MinValueValidator(Decimal("0.001")),
        ],
    )

    price_per_litre = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00")),
        ],
    )

    total_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    payment_method = models.CharField(
        max_length=30,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CASH,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
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
        related_name="pump_sales_created",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "-sale_date",
            "-id",
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.company.company_type != Company.CompanyType.GAS_STATION:
            raise ValidationError(
                "Pump sales can only be created "
                "for gas station companies."
            )

        if self.attendant.company_id != self.company_id:
            raise ValidationError(
                "The attendant must belong to the same company."
            )

        if self.pump.company_id != self.company_id:
            raise ValidationError(
                "The pump must belong to the same company."
            )

        if self.fuel_product.company_id != self.company_id:
            raise ValidationError(
                "The fuel product must belong to the same company."
            )

        if self.fuel_product.product_type != Product.ProductType.FUEL:
            raise ValidationError(
                "Pump sales must use a fuel product."
            )

        if self.closing_meter < self.opening_meter:
            raise ValidationError(
                "Closing meter cannot be less than opening meter."
            )

        calculated_litres = (
            self.closing_meter - self.opening_meter
        )

        if self.litres_sold != calculated_litres:
            raise ValidationError(
                "Litres sold must equal closing meter "
                "minus opening meter."
            )

        calculated_total = (
            self.litres_sold * self.price_per_litre
        )

        if self.total_amount != calculated_total:
            raise ValidationError(
                "Total amount must equal litres sold "
                "multiplied by price per litre."
            )

    def __str__(self):
        return (
            f"{self.sale_date} - "
            f"{self.attendant.full_name} - "
            f"{self.fuel_product.name} - "
            f"{self.litres_sold} L"
        )