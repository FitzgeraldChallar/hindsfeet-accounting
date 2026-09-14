import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  BarChart3,
  Box,
  CheckCircle2,
  Download,
  Package,
  RefreshCw,
  Search,
  TrendingDown,
  X,
} from "lucide-react";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";


// ============================================================
// HELPERS
// ============================================================

function extractList(response) {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  if (Array.isArray(response?.inventory)) {
    return response.inventory;
  }

  if (Array.isArray(response?.products)) {
    return response.products;
  }

  return [];
}


function number(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}


function formatMoney(value, currency = "USD") {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number(value))} ${currency}`;
}


function formatQuantity(value) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(number(value));
}


function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}


function errorMessage(error) {
  const data = error?.data;

  if (data?.detail) {
    return data.detail;
  }

  if (data?.message) {
    return data.message;
  }

  if (data && typeof data === "object") {
    return Object.entries(data)
      .map(
        ([field, message]) =>
          `${field}: ${
            Array.isArray(message)
              ? message.join(", ")
              : message
          }`
      )
      .join(" ");
  }

  return (
    error?.message ||
    "Unable to load inventory report."
  );
}


function productCategory(product, categoriesById) {
  if (!product) {
    return "Uncategorized";
  }

  if (
    product.category &&
    typeof product.category === "object"
  ) {
    return (
      product.category.name ||
      "Uncategorized"
    );
  }

  if (product.category) {
    return (
      categoriesById[product.category]?.name ||
      "Uncategorized"
    );
  }

  return "Uncategorized";
}


function productUnit(product) {
  return (
    product?.unit ||
    product?.unit_name ||
    product?.measurement_unit ||
    "Unit"
  );
}


function inventoryQuantity(product, inventory) {
  if (inventory) {
    return number(
      inventory.quantity_on_hand
    );
  }

  if (product?.inventory) {
    return number(
      product.inventory.quantity_on_hand
    );
  }

  return 0;
}


function inventoryReorderLevel(
  product,
  inventory
) {
  if (inventory) {
    return number(
      inventory.reorder_level
    );
  }

  if (product?.inventory) {
    return number(
      product.inventory.reorder_level
    );
  }

  return 0;
}


function stockState(quantity, reorderLevel) {
  if (quantity <= 0) {
    return "OUT";
  }

  if (
    reorderLevel > 0 &&
    quantity <= reorderLevel
  ) {
    return "LOW";
  }

  return "IN_STOCK";
}


function stockLabel(state) {
  if (state === "OUT") {
    return "Out of Stock";
  }

  if (state === "LOW") {
    return "Low Stock";
  }

  return "In Stock";
}


function stockClass(state) {
  return `inventory-stock-badge inventory-stock-${String(
    state
  ).toLowerCase()}`;
}


// ============================================================
// MAIN REPORT
// ============================================================

export default function InventoryReports() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;
  const companyName =
    currentCompany?.name ||
    "No company selected";

  const currency =
    currentCompany?.currency ||
    "USD";


  const [products, setProducts] =
    useState([]);

  const [inventory, setInventory] =
    useState([]);

  const [categories, setCategories] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("ALL");

  const [stockFilter, setStockFilter] =
    useState("ALL");


  // ==========================================================
  // LOAD DATA
  // ==========================================================

  const loadData = useCallback(
    async (showRefresh = false) => {
      if (!companyId) {
        setProducts([]);
        setInventory([]);
        setCategories([]);
        setLoading(false);
        return;
      }

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        /*
         * IMPORTANT:
         *
         * InventorySerializer contains:
         * - product
         * - product_code
         * - product_name
         * - quantity_on_hand
         * - reorder_level
         *
         * ProductSerializer contains:
         * - unit
         * - selling_price
         * - cost_price
         * - category
         * - inventory
         *
         * Therefore we load both and merge them below.
         */

        const [
          productsResponse,
          inventoryResponse,
          categoriesResponse,
        ] = await Promise.all([
          api.get(
            `/api/operations/products/?company=${companyId}`
          ),

          api.get(
            `/api/operations/inventory/?company=${companyId}`
          ),

          api.get(
            `/api/operations/categories/?company=${companyId}`
          ),
        ]);


        setProducts(
          extractList(productsResponse)
        );

        setInventory(
          extractList(inventoryResponse)
        );

        setCategories(
          extractList(categoriesResponse)
        );
      } catch (err) {
        console.error(
          "Inventory report loading error:",
          err
        );

        setError(
          errorMessage(err)
        );

        setProducts([]);
        setInventory([]);
        setCategories([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId]
  );


  useEffect(() => {
    loadData();
  }, [loadData]);


  // ==========================================================
  // LOOKUP MAPS
  // ==========================================================

  const inventoryByProductId =
    useMemo(() => {
      const map = {};

      inventory.forEach((item) => {
        if (item?.product != null) {
          map[String(item.product)] =
            item;
        }
      });

      return map;
    }, [inventory]);


  const categoriesById =
    useMemo(() => {
      const map = {};

      categories.forEach((category) => {
        map[String(category.id)] =
          category;
      });

      return map;
    }, [categories]);


  // ==========================================================
  // BUILD REPORT ROWS
  // ==========================================================

  const reportRows = useMemo(() => {
    return products.map((product) => {
      const inventoryRecord =
        inventoryByProductId[
          String(product.id)
        ] || null;

      const quantity =
        inventoryQuantity(
          product,
          inventoryRecord
        );

      const reorderLevel =
        inventoryReorderLevel(
          product,
          inventoryRecord
        );

      const costPrice =
        number(product.cost_price);

      const sellingPrice =
        number(product.selling_price);

      const stockValue =
        quantity * costPrice;

      const state =
        stockState(
          quantity,
          reorderLevel
        );

      return {
        ...product,

        quantity,
        reorderLevel,

        unit:
          productUnit(product),

        costPrice,
        sellingPrice,

        stockValue,

        category:
          productCategory(
            product,
            categoriesById
          ),

        state,
      };
    });
  }, [
    products,
    inventoryByProductId,
    categoriesById,
  ]);


  // ==========================================================
  // CATEGORY OPTIONS
  // ==========================================================

  const categoryOptions =
    useMemo(() => {
      const values = reportRows
        .map((row) => row.category)
        .filter(Boolean);

      return [...new Set(values)].sort(
        (a, b) =>
          a.localeCompare(b)
      );
    }, [reportRows]);


  // ==========================================================
  // FILTERED ROWS
  // ==========================================================

  const filteredRows =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return reportRows.filter(
        (row) => {
          const searchable = [
            row.name,
            row.code,
            row.description,
            row.category,
            row.unit,
            row.product_type,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !query ||
            searchable.includes(query);

          const matchesCategory =
            categoryFilter === "ALL" ||
            row.category ===
              categoryFilter;

          const matchesStock =
            stockFilter === "ALL" ||
            row.state ===
              stockFilter;

          return (
            matchesSearch &&
            matchesCategory &&
            matchesStock
          );
        }
      );
    }, [
      reportRows,
      search,
      categoryFilter,
      stockFilter,
    ]);


  // ==========================================================
  // REPORT TOTALS
  // ==========================================================

  const totals =
    useMemo(() => {
      return reportRows.reduce(
        (total, row) => ({
          products:
            total.products + 1,

          quantity:
            total.quantity +
            row.quantity,

          stockValue:
            total.stockValue +
            row.stockValue,

          outOfStock:
            total.outOfStock +
            (row.state === "OUT"
              ? 1
              : 0),

          lowStock:
            total.lowStock +
            (row.state === "LOW"
              ? 1
              : 0),

          inStock:
            total.inStock +
            (row.state === "IN_STOCK"
              ? 1
              : 0),
        }),
        {
          products: 0,
          quantity: 0,
          stockValue: 0,
          outOfStock: 0,
          lowStock: 0,
          inStock: 0,
        }
      );
    }, [reportRows]);


  // ==========================================================
  // CSV EXPORT
  // ==========================================================

  const exportCsv = () => {
    const quote = (value) =>
      `"${String(
        value ?? ""
      ).replaceAll('"', '""')}"`;

    const header = [
      "Product",
      "Code / SKU",
      "Category",
      "Unit",
      "Quantity",
      "Cost Price",
      "Selling Price",
      "Stock Value",
      "Reorder Level",
      "Status",
    ];

    const rows = filteredRows.map(
      (row) => [
        row.name,
        row.code,
        row.category,
        row.unit,
        row.quantity.toFixed(3),
        row.costPrice.toFixed(2),
        row.sellingPrice.toFixed(2),
        row.stockValue.toFixed(2),
        row.reorderLevel.toFixed(3),
        stockLabel(row.state),
      ]
    );

    const csv = [
      header.map(quote).join(","),
      ...rows.map((row) =>
        row.map(quote).join(",")
      ),
    ].join("\n");

    const blob =
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8;",
        }
      );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      `inventory-report-${companyId}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };


  // ==========================================================
  // CLEAR FILTERS
  // ==========================================================

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("ALL");
    setStockFilter("ALL");
  };


  const hasFilters =
    Boolean(search) ||
    categoryFilter !== "ALL" ||
    stockFilter !== "ALL";


  // ==========================================================
  // NO COMPANY
  // ==========================================================

  if (!companyId) {
    return (
      <div className="inventory-report-page">
        <div className="inventory-report-empty-company">
          <div className="inventory-report-empty-icon">
            <Package size={26} />
          </div>

          <h2>
            No Company Selected
          </h2>

          <p>
            Select a company before
            viewing inventory reports.
          </p>
        </div>
      </div>
    );
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="inventory-report-page">

      {/* ======================================================
          PAGE HEADER
          ====================================================== */}

      <div className="inventory-report-header">

        <div>
          <div className="inventory-report-eyebrow">
            INVENTORY REPORTING
          </div>

          <h1>
            Inventory Reports
          </h1>

          <p>
            Review stock quantities,
            inventory value and stock
            availability for{" "}
            {companyName}.
          </p>
        </div>


        <div className="inventory-report-header-actions">

          <button
            type="button"
            className="inventory-report-secondary-btn"
            onClick={() =>
              loadData(true)
            }
            disabled={
              refreshing ||
              loading
            }
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "inventory-report-spin"
                  : ""
              }
            />

            Refresh
          </button>


          <button
            type="button"
            className="inventory-report-primary-btn"
            onClick={exportCsv}
            disabled={
              loading ||
              filteredRows.length === 0
            }
          >
            <Download size={16} />

            Export CSV
          </button>

        </div>

      </div>


      {/* ======================================================
          COMPANY STRIP
          ====================================================== */}

      <div className="inventory-report-company-strip">

        <div className="inventory-report-company-mark">
          {companyName
            .slice(0, 1)
            .toUpperCase()}
        </div>

        <div>
          <span>
            Current Company
          </span>

          <strong>
            {companyName}
          </strong>
        </div>

        <div className="inventory-report-company-currency">
          <span>
            Currency
          </span>

          <strong>
            {currency}
          </strong>
        </div>

      </div>


      {/* ======================================================
          ERROR
          ====================================================== */}

      {error && (
        <div className="inventory-report-alert">
          <AlertCircle size={17} />

          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            <X size={15} />
          </button>
        </div>
      )}


      {/* ======================================================
          KPI CARDS
          ====================================================== */}

      <div className="inventory-report-kpi-grid">

        <div className="inventory-report-kpi-card">

          <div className="inventory-report-kpi-icon inventory-report-icon-blue">
            <Box size={19} />
          </div>

          <div>
            <span>
              Total Products
            </span>

            <strong>
              {totals.products}
            </strong>

            <small>
              Products in inventory
            </small>
          </div>

        </div>


        <div className="inventory-report-kpi-card">

          <div className="inventory-report-kpi-icon inventory-report-icon-gold">
            <Package size={19} />
          </div>

          <div>
            <span>
              Total Quantity
            </span>

            <strong>
              {formatQuantity(
                totals.quantity
              )}
            </strong>

            <small>
              Units currently held
            </small>
          </div>

        </div>


        <div className="inventory-report-kpi-card">

          <div className="inventory-report-kpi-icon inventory-report-icon-navy">
            <BarChart3 size={19} />
          </div>

          <div>
            <span>
              Inventory Value
            </span>

            <strong>
              {formatMoney(
                totals.stockValue,
                currency
              )}
            </strong>

            <small>
              Current stock value
            </small>
          </div>

        </div>


        <div className="inventory-report-kpi-card">

          <div className="inventory-report-kpi-icon inventory-report-icon-dark">
            <TrendingDown size={19} />
          </div>

          <div>
            <span>
              Stock Alerts
            </span>

            <strong>
              {totals.outOfStock +
                totals.lowStock}
            </strong>

            <small>
              {totals.outOfStock} out ·{" "}
              {totals.lowStock} low
            </small>
          </div>

        </div>

      </div>


      {/* ======================================================
          REPORT CARD
          ====================================================== */}

      <section className="inventory-report-card">

        <div className="inventory-report-card-header">

          <div>

            <div className="inventory-report-section-label">
              INVENTORY POSITION
            </div>

            <h2>
              Stock Valuation Report
            </h2>

            <p>
              Current inventory
              quantities, costs and
              estimated stock value.
            </p>

          </div>


          <div className="inventory-report-total-value">

            <span>
              Total Inventory Value
            </span>

            <strong>
              {formatMoney(
                totals.stockValue,
                currency
              )}
            </strong>

          </div>

        </div>


        {/* ====================================================
            TOOLBAR
            ==================================================== */}

        <div className="inventory-report-toolbar">

          <div className="inventory-report-search">

            <Search size={17} />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search product, SKU or category..."
            />

          </div>


          <select
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(
                event.target.value
              )
            }
            className="inventory-report-filter"
          >
            <option value="ALL">
              All Categories
            </option>

            {categoryOptions.map(
              (category) => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              )
            )}

          </select>


          <select
            value={stockFilter}
            onChange={(event) =>
              setStockFilter(
                event.target.value
              )
            }
            className="inventory-report-filter"
          >
            <option value="ALL">
              All Stock Status
            </option>

            <option value="IN_STOCK">
              In Stock
            </option>

            <option value="LOW">
              Low Stock
            </option>

            <option value="OUT">
              Out of Stock
            </option>

          </select>


          {hasFilters && (
            <button
              type="button"
              className="inventory-report-clear-btn"
              onClick={
                clearFilters
              }
            >
              <X size={14} />

              Clear
            </button>
          )}

        </div>


        {/* ====================================================
            TABLE
            ==================================================== */}

        {loading ? (
          <div className="inventory-report-loading">

            <RefreshCw
              size={23}
              className="inventory-report-spin"
            />

            <span>
              Loading inventory report...
            </span>

          </div>
        ) : filteredRows.length === 0 ? (

          <div className="inventory-report-empty">

            <div className="inventory-report-empty-icon">
              <Package size={25} />
            </div>

            <strong>
              {hasFilters
                ? "No matching inventory items"
                : "No inventory items found"}
            </strong>

            <span>
              {hasFilters
                ? "Try changing your search or filters."
                : "Products with inventory tracking will appear here."}
            </span>

          </div>

        ) : (

          <div className="inventory-report-table-wrapper">

            <table className="inventory-report-table">

              <thead>
                <tr>

                  <th>
                    PRODUCT
                  </th>

                  <th>
                    CODE / SKU
                  </th>

                  <th>
                    CATEGORY
                  </th>

                  <th>
                    QUANTITY
                  </th>

                  <th>
                    UNIT COST
                  </th>

                  <th>
                    SELLING PRICE
                  </th>

                  <th>
                    STOCK VALUE
                  </th>

                  <th>
                    REORDER LEVEL
                  </th>

                  <th>
                    STATUS
                  </th>

                </tr>
              </thead>


              <tbody>

                {filteredRows.map(
                  (row) => (
                    <tr
                      key={row.id}
                    >

                      {/* PRODUCT */}
                      <td>

                        <div className="inventory-report-product">

                          <div className="inventory-report-product-icon">
                            <Box size={17} />
                          </div>

                          <div>

                            <strong>
                              {row.name}
                            </strong>

                            <span>
                              {row.product_type ===
                              "SERVICE"
                                ? "Service"
                                : `${row.unit} · Inventory item`}
                            </span>

                          </div>

                        </div>

                      </td>


                      {/* CODE */}
                      <td>
                        <span className="inventory-report-code">
                          {row.code ||
                            "—"}
                        </span>
                      </td>


                      {/* CATEGORY */}
                      <td>
                        {row.category}
                      </td>


                      {/* QUANTITY */}
                      <td>

                        <div className="inventory-report-quantity">

                          <strong>
                            {formatQuantity(
                              row.quantity
                            )}
                          </strong>

                          <span>
                            {row.unit}
                          </span>

                        </div>

                      </td>


                      {/* COST */}
                      <td>

                        <div className="inventory-report-money-cell">

                          <strong>
                            {formatMoney(
                              row.costPrice,
                              currency
                            )}
                          </strong>

                          <span>
                            Cost price
                          </span>

                        </div>

                      </td>


                      {/* SELLING PRICE */}
                      <td>

                        <div className="inventory-report-money-cell">

                          <strong>
                            {formatMoney(
                              row.sellingPrice,
                              currency
                            )}
                          </strong>

                          <span>
                            Selling price
                          </span>

                        </div>

                      </td>


                      {/* STOCK VALUE */}
                      <td>

                        <strong className="inventory-report-stock-value">
                          {formatMoney(
                            row.stockValue,
                            currency
                          )}
                        </strong>

                      </td>


                      {/* REORDER */}
                      <td>

                        {row.reorderLevel >
                        0 ? (
                          <span>
                            {formatQuantity(
                              row.reorderLevel
                            )}{" "}
                            {row.unit}
                          </span>
                        ) : (
                          "—"
                        )}

                      </td>


                      {/* STATUS */}
                      <td>

                        <span
                          className={stockClass(
                            row.state
                          )}
                        >
                          {stockLabel(
                            row.state
                          )}
                        </span>

                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>

        )}


        {/* ====================================================
            REPORT FOOTER
            ==================================================== */}

        {!loading &&
          reportRows.length > 0 && (
            <div className="inventory-report-footer">

              <div>

                <span>
                  Showing
                </span>

                <strong>
                  {filteredRows.length}
                </strong>

                <span>
                  of
                </span>

                <strong>
                  {reportRows.length}
                </strong>

                <span>
                  products
                </span>

              </div>


              <div className="inventory-report-footer-status">

                <span>
                  <CheckCircle2
                    size={14}
                  />

                  {totals.inStock} in stock
                </span>

                <span>
                  <TrendingDown
                    size={14}
                  />

                  {totals.lowStock} low stock
                </span>

                <span>
                  <AlertCircle
                    size={14}
                  />

                  {totals.outOfStock} out of stock
                </span>

              </div>

            </div>
          )}

      </section>

    </div>
  );
}