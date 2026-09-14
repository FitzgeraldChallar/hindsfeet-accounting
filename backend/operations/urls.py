from django.urls import path

from .views import (
    InventoryListView,
    InventoryTransactionListCreateView,
    ProductCategoryListCreateView,
    ProductListCreateView,
    ProductDetailView,

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
        ProductCategoryListCreateView.as_view(),
        name="product-category-list-create",
    ),

    path(
        "products/",
        ProductListCreateView.as_view(),
        name="product-list-create",
    ),

    path(
       "products/<int:pk>/",
       ProductDetailView.as_view(),
       name="product-detail",
    ),

    path(
        "inventory/",
        InventoryListView.as_view(),
        name="inventory-list",
    ),

    path(
       "inventory/transactions/",
       InventoryTransactionListCreateView.as_view(),
       name="inventory-transaction-list-create",
   ),

    # ============================================================
    # SALES
    # ============================================================

    path(
        "sales/",
        SaleListView.as_view(),
        name="sale-list",
    ),

    path(
        "sales/create/",
        CreateSaleView.as_view(),
        name="sale-create",
    ),

    path(
        "sales/<int:pk>/",
        SaleDetailView.as_view(),
        name="sale-detail",
    ),

    # ============================================================
    # GAS STATION - PUMP ATTENDANTS
    # ============================================================

    path(
        "pump-attendants/",
        PumpAttendantListCreateView.as_view(),
        name="pump-attendant-list-create",
    ),

    path(
        "pump-attendants/<int:pk>/",
        PumpAttendantDetailView.as_view(),
        name="pump-attendant-detail",
    ),

    # ============================================================
    # GAS STATION - FUEL PUMPS
    # ============================================================

    path(
        "fuel-pumps/",
        FuelPumpListCreateView.as_view(),
        name="fuel-pump-list-create",
    ),

    path(
        "fuel-pumps/<int:pk>/",
        FuelPumpDetailView.as_view(),
        name="fuel-pump-detail",
    ),

    # ============================================================
    # GAS STATION - PUMP SALES
    # ============================================================

    path(
        "pump-sales/",
        PumpSaleListView.as_view(),
        name="pump-sale-list",
    ),

    path(
        "pump-sales/create/",
        CreatePumpSaleView.as_view(),
        name="pump-sale-create",
    ),

    path(
        "pump-sales/<int:pk>/",
        PumpSaleDetailView.as_view(),
        name="pump-sale-detail",
    ),
]