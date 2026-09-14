from django.utils import timezone

from django.db import transaction
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from companies.models import CompanyMembership

from .models import (
    FuelPump,
    Inventory,
    InventoryTransaction,
    Product,
    ProductCategory,
    PumpAttendant,
    PumpSale,
    Sale,
    SaleItem,
)

from .serializers import (
    FuelPumpSerializer,
    InventorySerializer,
    InventoryTransactionSerializer,
    ProductCategorySerializer,
    ProductSerializer,
    PumpAttendantSerializer,
    PumpSaleSerializer,
    SaleSerializer,
    SaleUpdateSerializer,
)

from .gas_station_services import GasStationService
from .sales_services import SalesService


# ============================================================
# COMPANY ACCESS
# ============================================================


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


# ============================================================
# PRODUCT CATEGORIES
# ============================================================


class ProductCategoryListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = ProductCategorySerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = ProductCategory.objects.select_related(
            "company"
        )

        company_id = self.request.query_params.get(
            "company"
        )

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                return queryset.filter(
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


# ============================================================
# PRODUCTS
# ============================================================


class ProductListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = ProductSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = Product.objects.select_related(
            "company",
            "category",
            "inventory",
        )

        company_id = self.request.query_params.get(
            "company"
        )

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                return queryset.filter(
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

        inventory_quantity = (
            serializer.validated_data.pop(
                "inventory_quantity",
                None,
            )
        )

        reorder_level = (
            serializer.validated_data.pop(
                "reorder_level",
                None,
            )
        )

        product = serializer.save()

        if not product.track_inventory:
            return

        inventory, created = (
            Inventory.objects.get_or_create(
                company=company,
                product=product,
            )
        )

        if reorder_level is not None:
            inventory.reorder_level = reorder_level

            inventory.save(
                update_fields=[
                    "reorder_level",
                    "updated_at",
                ]
            )

        if (
            inventory_quantity is not None
            and inventory_quantity > 0
        ):
            from .services import InventoryService

            InventoryService.record_transaction(
                company=company,
                product=product,
                transaction_type="OPENING_BALANCE",
                quantity=inventory_quantity,
                unit_cost=product.cost_price,
                reference=(
                    f"OPENING-{product.id}"
                ),
                description=(
                    f"Opening inventory for "
                    f"{product.name}"
                ),
                transaction_date=timezone.localdate(),
                created_by=self.request.user,
            )


class ProductDetailView(
    generics.RetrieveUpdateAPIView
):
    serializer_class = ProductSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = Product.objects.select_related(
            "company",
            "category",
            "inventory",
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

    def retrieve(
        self,
        request,
        *args,
        **kwargs,
    ):
        instance = self.get_object()

        if not user_can_access_company(
            request.user,
            instance.company,
        ):
            raise PermissionDenied(
                "You do not have access to this company."
            )

        serializer = self.get_serializer(
            instance
        )

        return Response(
            serializer.data
        )

    def update(
        self,
        request,
        *args,
        **kwargs,
    ):
        instance = self.get_object()

        if not user_can_access_company(
            request.user,
            instance.company,
        ):
            raise PermissionDenied(
                "You do not have access to this company."
            )

        partial = kwargs.pop(
            "partial",
            False,
        )

        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=partial,
        )

        serializer.is_valid(
            raise_exception=True
        )

        inventory_quantity = (
            serializer.validated_data.pop(
                "inventory_quantity",
                None,
            )
        )

        reorder_level = (
            serializer.validated_data.pop(
                "reorder_level",
                None,
            )
        )

        product = serializer.save()

        if product.track_inventory:
            inventory, created = (
                Inventory.objects.get_or_create(
                    company=product.company,
                    product=product,
                )
            )

            if inventory_quantity is not None:
                from .services import InventoryService

                current_quantity = (
                    inventory.quantity_on_hand
                )

                target_quantity = (
                    inventory_quantity
                )

                difference = (
                    target_quantity
                    - current_quantity
                )

                if difference > 0:
                    InventoryService.record_transaction(
                        company=product.company,
                        product=product,
                        transaction_type="ADJUSTMENT_IN",
                        quantity=difference,
                        unit_cost=product.cost_price,
                        reference=(
                            f"PRODUCT-ADJ-{product.id}"
                        ),
                        description=(
                            f"Inventory increase from "
                            f"product edit for "
                            f"{product.name}"
                        ),
                        transaction_date=(
                            timezone.localdate()
                        ),
                        created_by=request.user,
                    )

                elif difference < 0:
                    InventoryService.record_transaction(
                        company=product.company,
                        product=product,
                        transaction_type="ADJUSTMENT_OUT",
                        quantity=abs(difference),
                        unit_cost=product.cost_price,
                        reference=(
                            f"PRODUCT-ADJ-{product.id}"
                        ),
                        description=(
                            f"Inventory decrease from "
                            f"product edit for "
                            f"{product.name}"
                        ),
                        transaction_date=(
                            timezone.localdate()
                        ),
                        created_by=request.user,
                    )

            if reorder_level is not None:
                inventory.reorder_level = (
                    reorder_level
                )

                inventory.save(
                    update_fields=[
                        "reorder_level",
                        "updated_at",
                    ]
                )

        product.refresh_from_db()

        return Response(
            ProductSerializer(product).data
        )


# ============================================================
# INVENTORY
# ============================================================


class InventoryListView(
    generics.ListAPIView
):
    serializer_class = InventorySerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = Inventory.objects.select_related(
            "company",
            "product",
        )

        company_id = self.request.query_params.get(
            "company"
        )

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                return queryset.filter(
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
    
class InventoryTransactionListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = InventoryTransactionSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = InventoryTransaction.objects.select_related(
            "company",
            "product",
            "created_by",
        )

        company_id = self.request.query_params.get(
            "company"
        )

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                return queryset.filter(
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
        company = serializer.validated_data[
            "company"
        ]

        if not user_can_access_company(
            self.request.user,
            company,
        ):
            raise PermissionDenied(
                "You do not have access to this company."
            )

        product = serializer.validated_data[
            "product"
        ]

        if product.company_id != company.id:
            raise PermissionDenied(
                "Product does not belong to this company."
            )

        from .services import InventoryService

        InventoryService.record_transaction(
            company=company,
            product=product,
            transaction_type=serializer.validated_data[
                "transaction_type"
            ],
            quantity=serializer.validated_data[
                "quantity"
            ],
            unit_cost=serializer.validated_data[
                "unit_cost"
            ],
            reference=serializer.validated_data.get(
                "reference",
                "",
            ),
            description=serializer.validated_data.get(
                "description",
                "",
            ),
            transaction_date=serializer.validated_data[
                "transaction_date"
            ],
            created_by=self.request.user,
        )


# ============================================================
# SALES
# ============================================================


class SaleListView(
    generics.ListAPIView
):
    serializer_class = SaleSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = Sale.objects.select_related(
            "company",
            "created_by",
        ).prefetch_related(
            "items__product",
        )

        company_id = self.request.query_params.get(
            "company"
        )

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                return queryset.filter(
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


class CreateSaleView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request):
        company_id = request.data.get(
            "company"
        )

        try:
            company = request.user.company_set.get(
                id=company_id
            )

        except Exception:
            try:
                from companies.models import Company

                company = Company.objects.get(
                    id=company_id
                )

            except Company.DoesNotExist:
                return Response(
                    {
                        "detail":
                        "Company not found."
                    },
                    status=404,
                )

        if not user_can_access_company(
            request.user,
            company,
        ):
            raise PermissionDenied(
                "You do not have access to this company."
            )

        items = request.data.get(
            "items",
            [],
        )

        try:
            sale = SalesService.create_sale(
                company=company,
                sale_number=request.data[
                    "sale_number"
                ],
                sale_date=request.data[
                    "sale_date"
                ],
                created_by=request.user,
                items=[
                    {
                        "product":
                        Product.objects.get(
                            id=item["product"],
                            company=company,
                        ),
                        "quantity":
                        item["quantity"],
                        "unit_price":
                        item.get(
                            "unit_price"
                        ),
                        "unit_cost":
                        item.get(
                            "unit_cost"
                        ),
                        "discount":
                        item.get(
                            "discount",
                            "0.00",
                        ),
                    }
                    for item in items
                ],
                payment_method=(
                    request.data.get(
                        "payment_method",
                        Sale.PaymentMethod.CASH,
                    )
                ),
                customer_name=(
                    request.data.get(
                        "customer_name",
                        "",
                    )
                ),
                discount=request.data.get(
                    "discount",
                    "0.00",
                ),
                notes=request.data.get(
                    "notes",
                    "",
                ),
                complete=request.data.get(
                    "complete",
                    True,
                ),
            )

        except Product.DoesNotExist:
            return Response(
                {
                    "detail":
                    "One or more selected products "
                    "do not belong to this company."
                },
                status=400,
            )

        except (KeyError, ValueError) as exc:
            return Response(
                {
                    "detail": str(exc)
                },
                status=400,
            )

        return Response(
            SaleSerializer(sale).data,
            status=201,
        )


class SaleDetailView(
    generics.RetrieveUpdateAPIView
):
    serializer_class = SaleSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = Sale.objects.select_related(
            "company",
            "created_by",
        ).prefetch_related(
            "items__product",
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

    def retrieve(
        self,
        request,
        *args,
        **kwargs,
    ):
        instance = self.get_object()

        if not user_can_access_company(
            request.user,
            instance.company,
        ):
            raise PermissionDenied(
                "You do not have access to this company."
            )

        return Response(
            SaleSerializer(instance).data
        )

    def update(
        self,
        request,
        *args,
        **kwargs,
    ):
        instance = self.get_object()

        if not user_can_access_company(
            request.user,
            instance.company,
        ):
            raise PermissionDenied(
                "You do not have access to this company."
            )

        partial = kwargs.pop(
            "partial",
            False,
        )

        serializer = SaleUpdateSerializer(
            instance,
            data=request.data,
            partial=partial,
            context={
                "request": request,
            },
        )

        serializer.is_valid(
            raise_exception=True
        )

        try:
            sale = SalesService.update_sale(
                sale=instance,
                user=request.user,
                **serializer.validated_data,
            )

        except ValueError as exc:
            return Response(
                {
                    "detail": str(exc)
                },
                status=400,
            )

        sale.refresh_from_db()

        return Response(
            SaleSerializer(sale).data
        )


# ============================================================
# GAS STATION
# ============================================================


class GasStationCompanyMixin:
    def check_company(self, company):
        if company.business_type != "GAS_STATION":
            raise PermissionDenied(
                "Gas station features are only available "
                "for gas station companies."
            )

        if not user_can_access_company(
            self.request.user,
            company,
        ):
            raise PermissionDenied(
                "You do not have access to this company."
            )


# ============================================================
# GAS STATION - PUMP ATTENDANTS
# ============================================================


class PumpAttendantListCreateView(
    GasStationCompanyMixin,
    generics.ListCreateAPIView,
):
    serializer_class = PumpAttendantSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = PumpAttendant.objects.select_related(
            "company",
        )

        company_id = self.request.query_params.get(
            "company"
        )

        if company_id:
            queryset = queryset.filter(
                company_id=company_id
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

    def perform_create(self, serializer):
        company = serializer.validated_data[
            "company"
        ]

        self.check_company(
            company
        )

        serializer.save()


class PumpAttendantDetailView(
    GasStationCompanyMixin,
    generics.RetrieveUpdateAPIView,
):
    serializer_class = PumpAttendantSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = PumpAttendant.objects.select_related(
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

    def retrieve(
        self,
        request,
        *args,
        **kwargs,
    ):
        instance = self.get_object()

        self.check_company(
            instance.company
        )

        serializer = self.get_serializer(
            instance
        )

        return Response(
            serializer.data
        )

    def update(
        self,
        request,
        *args,
        **kwargs,
    ):
        instance = self.get_object()

        self.check_company(
            instance.company
        )

        return super().update(
            request,
            *args,
            **kwargs,
        )


# ============================================================
# GAS STATION - FUEL PUMPS
# ============================================================


class FuelPumpListCreateView(
    GasStationCompanyMixin,
    generics.ListCreateAPIView,
):
    serializer_class = FuelPumpSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = FuelPump.objects.select_related(
            "company",
        )

        company_id = self.request.query_params.get(
            "company"
        )

        if company_id:
            queryset = queryset.filter(
                company_id=company_id
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

    def perform_create(self, serializer):
        company = serializer.validated_data[
            "company"
        ]

        self.check_company(
            company
        )

        serializer.save()


class FuelPumpDetailView(
    GasStationCompanyMixin,
    generics.RetrieveUpdateAPIView,
):
    serializer_class = FuelPumpSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = FuelPump.objects.select_related(
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

    def retrieve(
        self,
        request,
        *args,
        **kwargs,
    ):
        instance = self.get_object()

        self.check_company(
            instance.company
        )

        serializer = self.get_serializer(
            instance
        )

        return Response(
            serializer.data
        )

    def update(
        self,
        request,
        *args,
        **kwargs,
    ):
        instance = self.get_object()

        self.check_company(
            instance.company
        )

        return super().update(
            request,
            *args,
            **kwargs,
        )


# ============================================================
# GAS STATION - PUMP SALES
# ============================================================


class PumpSaleListView(
    generics.ListAPIView
):
    serializer_class = PumpSaleSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = PumpSale.objects.select_related(
            "company",
            "attendant",
            "pump",
            "fuel_product",
            "created_by",
        )

        company_id = self.request.query_params.get(
            "company"
        )

        if user.is_superuser or user.role in [
            "OWNER",
            "ADMIN",
        ]:
            if company_id:
                return queryset.filter(
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

class CreatePumpSaleView(APIView):
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    @transaction.atomic
    def post(self, request):
        from companies.models import Company

        try:
            company = Company.objects.get(
                id=request.data["company"]
            )

            attendant = PumpAttendant.objects.get(
                id=request.data["attendant"],
                company=company,
            )

            pump = FuelPump.objects.get(
                id=request.data["pump"],
                company=company,
            )

            fuel_product = Product.objects.get(
                id=request.data["fuel_product"],
                company=company,
            )

        except (
            Company.DoesNotExist,
            PumpAttendant.DoesNotExist,
            FuelPump.DoesNotExist,
            Product.DoesNotExist,
            KeyError,
        ):
            return Response(
                {
                    "detail":
                    "Invalid company, attendant, pump, "
                    "or fuel product."
                },
                status=400,
            )

        self._check_access(
            request.user,
            company,
        )

        try:
            # --------------------------------------------------------
            # 1. Record the actual gas station pump sale.
            #
            # This continues to handle the existing gas accounting
            # and inventory logic.
            # --------------------------------------------------------
            pump_sale = (
                GasStationService.record_pump_sale(
                    company=company,
                    attendant=attendant,
                    pump=pump,
                    fuel_product=fuel_product,
                    sale_date=request.data["sale_date"],
                    opening_meter=request.data[
                        "opening_meter"
                    ],
                    closing_meter=request.data[
                        "closing_meter"
                    ],
                    price_per_litre=request.data[
                        "price_per_litre"
                    ],
                    created_by=request.user,
                    payment_method=request.data.get(
                        "payment_method",
                        PumpSale.PaymentMethod.CASH,
                    ),
                    reference=request.data.get(
                        "reference",
                        "",
                    ),
                    notes=request.data.get(
                        "notes",
                        "",
                    ),
                    complete=request.data.get(
                        "complete",
                        True,
                    ),
                )
            )

            # --------------------------------------------------------
            # 2. Only completed pump sales become normal Sales
            # transactions.
            # --------------------------------------------------------
            if (
                pump_sale.status
                == PumpSale.Status.COMPLETED
            ):
                sale_number = (
                    f"GAS-{pump_sale.id}"
                )

                # Prevent accidental duplicate generic sales
                # if this integration is ever called again.
                if not Sale.objects.filter(
                    company=company,
                    sale_number=sale_number,
                ).exists():

                    quantity = pump_sale.litres_sold
                    unit_price = (
                        pump_sale.price_per_litre
                    )
                    unit_cost = (
                        fuel_product.cost_price
                    )

                    line_total = (
                        quantity * unit_price
                    )

                    line_cost = (
                        quantity * unit_cost
                    )

                    generic_sale = Sale.objects.create(
                        company=company,
                        sale_number=sale_number,
                        sale_date=pump_sale.sale_date,
                        customer_name=(
                            "Walk-in Customer"
                        ),
                        payment_method=(
                            pump_sale.payment_method
                        ),
                        status=Sale.Status.COMPLETED,
                        subtotal=line_total,
                        discount=(
                            0
                        ),
                        total_amount=line_total,
                        total_cost=line_cost,
                        gross_profit=(
                            line_total - line_cost
                        ),
                        notes=(
                            f"Gas station pump sale "
                            f"#{pump_sale.id}. "
                            f"Pump {pump.pump_number}. "
                            f"Attendant "
                            f"{attendant.full_name}."
                        ),
                        created_by=request.user,
                    )

                    SaleItem.objects.create(
                        sale=generic_sale,
                        product=fuel_product,
                        quantity=quantity,
                        unit_price=unit_price,
                        unit_cost=unit_cost,
                        discount=0,
                        line_total=line_total,
                        line_cost=line_cost,
                    )

        except (KeyError, ValueError) as exc:
            return Response(
                {"detail": str(exc)},
                status=400,
            )

        return Response(
            PumpSaleSerializer(
                pump_sale
            ).data,
            status=201,
        )

    @staticmethod
    def _check_access(user, company):
        if company.business_type != "GAS_STATION":
            raise PermissionDenied(
                "Gas station features are only available "
                "for gas station companies."
            )

        if not user_can_access_company(
            user,
            company,
        ):
            raise PermissionDenied(
                "You do not have access to this company."
            )


class PumpSaleDetailView(
    generics.RetrieveAPIView
):
    serializer_class = PumpSaleSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = PumpSale.objects.select_related(
            "company",
            "attendant",
            "pump",
            "fuel_product",
            "created_by",
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

    def retrieve(
        self,
        request,
        *args,
        **kwargs,
    ):
        instance = self.get_object()

        if (
            instance.company.business_type
            != "GAS_STATION"
        ):
            raise PermissionDenied(
                "Pump sale features are only available "
                "for gas station companies."
            )

        if not user_can_access_company(
            request.user,
            instance.company,
        ):
            raise PermissionDenied(
                "You do not have access to this company."
            )

        serializer = self.get_serializer(
            instance
        )

        return Response(
            serializer.data
        )