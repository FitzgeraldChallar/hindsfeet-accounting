from django.urls import path
from subscriptions.permissions import feature_view

from .views import (
    InventoryListView,
    InventoryTransactionListCreateView,
    ProductCategoryListCreateView,
    ProductListCreateView,
    ProductDetailView,
    ProductPriceListCreateView,

    # Sales
    SaleListView,
    CreateSaleView,
    SaleDetailView,

    # Gas station
    PumpAttendantListCreateView,
    PumpAttendantDetailView,
    FuelPumpListCreateView,
    FuelPumpDetailView,
    PumpSaleListView,
    CreatePumpSaleView,
    PumpSaleDetailView,
)


urlpatterns = [
    # ============================================================
    # PRODUCTS / INVENTORY
    # ============================================================

    path(
        "categories/",
        feature_view(ProductCategoryListCreateView, "sales_invoicing"),
        name="product-category-list-create",
    ),

    path(
        "products/",
        feature_view(ProductListCreateView, "sales_invoicing"),
        name="product-list-create",
    ),

    path(
        "products/prices/",
        feature_view(ProductPriceListCreateView, "sales_invoicing"),
        name="product-price-list-create",
    ),

    path(
       "products/<int:pk>/",
       feature_view(ProductDetailView, "sales_invoicing"),
       name="product-detail",
    ),

    path(
        "inventory/",
        feature_view(InventoryListView, "inventory"),
        name="inventory-list",
    ),

    path(
       "inventory/transactions/",
       feature_view(InventoryTransactionListCreateView, "inventory"),
       name="inventory-transaction-list-create",
   ),

    # ============================================================
    # SALES
    # ============================================================

    path(
        "sales/",
        feature_view(SaleListView, "sales_invoicing"),
        name="sale-list",
    ),

    path(
        "sales/create/",
        feature_view(CreateSaleView, "sales_invoicing"),
        name="sale-create",
    ),

    path(
        "sales/<int:pk>/",
        feature_view(SaleDetailView, "sales_invoicing"),
        name="sale-detail",
    ),

    # ============================================================
    # GAS STATION - PUMP ATTENDANTS
    # ============================================================

    path(
        "pump-attendants/",
        feature_view(PumpAttendantListCreateView, "gas_operations"),
        name="pump-attendant-list-create",
    ),

    path(
        "pump-attendants/<int:pk>/",
        feature_view(PumpAttendantDetailView, "gas_operations"),
        name="pump-attendant-detail",
    ),

    # ============================================================
    # GAS STATION - FUEL PUMPS
    # ============================================================

    path(
        "fuel-pumps/",
        feature_view(FuelPumpListCreateView, "gas_operations"),
        name="fuel-pump-list-create",
    ),

    path(
        "fuel-pumps/<int:pk>/",
        feature_view(FuelPumpDetailView, "gas_operations"),
        name="fuel-pump-detail",
    ),

    # ============================================================
    # GAS STATION - PUMP SALES
    # ============================================================

    path(
        "pump-sales/",
        feature_view(PumpSaleListView, "gas_operations"),
        name="pump-sale-list",
    ),

    path(
        "pump-sales/create/",
        feature_view(CreatePumpSaleView, "gas_operations"),
        name="pump-sale-create",
    ),

    path(
        "pump-sales/<int:pk>/",
        feature_view(PumpSaleDetailView, "gas_operations"),
        name="pump-sale-detail",
    ),
]