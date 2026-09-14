import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpToLine,
  Boxes,
  ClipboardList,
  DollarSign,
  Package,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingDown,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "../services/api";
import { useCompany } from "../context/CompanyContext";

const PRODUCT_TYPES = [
  { value: "ALL", label: "All Types" },
  { value: "PRODUCT", label: "Products" },
  { value: "SERVICE", label: "Services" },
  { value: "FUEL", label: "Fuel" },
];

const TRANSACTION_TYPES = [
  { value: "PURCHASE", label: "Purchase" },
  { value: "ADJUSTMENT_IN", label: "Adjustment In" },
  { value: "ADJUSTMENT_OUT", label: "Adjustment Out" },
  { value: "OPENING_BALANCE", label: "Opening Balance" },
  { value: "RETURN_IN", label: "Return In" },
  { value: "RETURN_OUT", label: "Return Out" },
];

const emptyAdjustment = {
  product: "",
  transaction_type: "ADJUSTMENT_IN",
  quantity: "",
  unit_cost: "",
  reference: "",
  description: "",
  transaction_date: new Date().toISOString().split("T")[0],
};

function formatMoney(value, currency = "USD") {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(Number(value || 0));
}

function getProductTypeLabel(type) {
  const match = PRODUCT_TYPES.find((item) => item.value === type);
  return match?.label || type || "—";
}

function getTransactionLabel(type) {
  const match = TRANSACTION_TYPES.find(
    (item) => item.value === type
  );

  if (match) {
    return match.label;
  }

  switch (type) {
    case "SALE":
      return "Sale";
    default:
      return type || "—";
  }
}

function getMovementSign(type) {
  if (
    [
      "PURCHASE",
      "ADJUSTMENT_IN",
      "RETURN_IN",
      "OPENING_BALANCE",
    ].includes(type)
  ) {
    return "+";
  }

  return "-";
}

export default function Inventory() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;
  const currency = currentCompany?.currency || "USD";

  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [stockFilter, setStockFilter] = useState("ALL");

  const [showAdjustmentModal, setShowAdjustmentModal] =
    useState(false);

  const [adjustmentForm, setAdjustmentForm] =
    useState(emptyAdjustment);

  const [savingAdjustment, setSavingAdjustment] =
    useState(false);

  const [adjustmentError, setAdjustmentError] =
    useState("");

  const loadInventory = async (showRefresh = false) => {
    if (!companyId) {
      setInventory([]);
      setTransactions([]);
      setProducts([]);
      setLoading(false);
      return;
    }

    try {
      setError("");

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [
        inventoryResponse,
        transactionResponse,
        productResponse,
      ] = await Promise.all([
        api.get(
          `/api/operations/inventory/?company=${companyId}`
        ),
        api.get(
          `/api/operations/inventory/transactions/?company=${companyId}`
        ),
        api.get(
          `/api/operations/products/?company=${companyId}`
        ),
      ]);

      setInventory(
        Array.isArray(inventoryResponse)
          ? inventoryResponse
          : inventoryResponse?.results || []
      );

      setTransactions(
        Array.isArray(transactionResponse)
          ? transactionResponse
          : transactionResponse?.results || []
      );

      setProducts(
        Array.isArray(productResponse)
          ? productResponse
          : productResponse?.results || []
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.data?.detail ||
          err?.data?.message ||
          err?.message ||
          "Unable to load inventory."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [companyId]);

  const inventoryRows = useMemo(() => {
    return inventory
      .map((item) => {
        const product =
          item.product_details ||
          item.product_data ||
          products.find(
            (productItem) =>
              Number(productItem.id) === Number(item.product)
          );

        const productType =
          item.product_type ||
          product?.product_type ||
          "";

        const productName =
          item.product_name ||
          product?.name ||
          `Product #${item.product}`;

        const productCode =
          item.product_code ||
          product?.code ||
          "—";

        const unit =
          item.unit ||
          product?.unit ||
          "unit";

        const sellingPrice = Number(
          item.selling_price ??
            product?.selling_price ??
            0
        );

        const costPrice = Number(
          item.cost_price ??
            product?.cost_price ??
            0
        );

        const quantity = Number(
          item.quantity_on_hand || 0
        );

        const reorderLevel = Number(
          item.reorder_level || 0
        );

        const inventoryValue =
          quantity * costPrice;

        const isLowStock =
          reorderLevel > 0 &&
          quantity <= reorderLevel;

        const isOutOfStock =
          quantity <= 0;

        return {
          ...item,
          productId: item.product,
          productName,
          productCode,
          productType,
          unit,
          sellingPrice,
          costPrice,
          quantity,
          reorderLevel,
          inventoryValue,
          isLowStock,
          isOutOfStock,
        };
      })
      .filter((item) => {
        const normalizedSearch =
          search.trim().toLowerCase();

        const matchesSearch =
          !normalizedSearch ||
          item.productName
            .toLowerCase()
            .includes(normalizedSearch) ||
          item.productCode
            .toLowerCase()
            .includes(normalizedSearch);

        const matchesType =
          typeFilter === "ALL" ||
          item.productType === typeFilter;

        const matchesStock =
          stockFilter === "ALL" ||
          (stockFilter === "LOW" &&
            item.isLowStock) ||
          (stockFilter === "OUT" &&
            item.isOutOfStock) ||
          (stockFilter === "AVAILABLE" &&
            !item.isOutOfStock);

        return (
          matchesSearch &&
          matchesType &&
          matchesStock
        );
      });
  }, [
    inventory,
    products,
    search,
    typeFilter,
    stockFilter,
  ]);

  /*
   * ==========================================================
   * FILTERED INVENTORY STATISTICS
   * ==========================================================
   *
   * IMPORTANT:
   * These statistics intentionally use inventoryRows instead
   * of the complete inventory array.
   *
   * inventoryRows is the same filtered dataset displayed in
   * the Stock Overview table. Therefore:
   *
   *   All Types  -> all inventory statistics
   *   Products   -> product-only statistics
   *   Services   -> service-only statistics
   *   Fuel       -> fuel-only statistics
   *
   * The stock filter and search filter also affect the cards
   * because they determine which inventory rows are currently
   * being represented.
   */
  const stats = useMemo(() => {
    const totalProducts =
      inventoryRows.length;

    const totalUnits =
      inventoryRows.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0),
        0
      );

    const lowStock =
      inventoryRows.filter(
        (item) => item.isLowStock
      ).length;

    const outOfStock =
      inventoryRows.filter(
        (item) => item.isOutOfStock
      ).length;

    const inventoryValue =
      inventoryRows.reduce(
        (sum, item) =>
          sum +
          Number(item.quantity || 0) *
            Number(item.costPrice || 0),
        0
      );

    return {
      totalProducts,
      totalUnits,
      lowStock,
      outOfStock,
      inventoryValue,
    };
  }, [inventoryRows]);

  const summaryDescription = useMemo(() => {
    if (
      search.trim() ||
      typeFilter !== "ALL" ||
      stockFilter !== "ALL"
    ) {
      return "Based on current filters";
    }

    return "Across all inventory items";
  }, [
    search,
    typeFilter,
    stockFilter,
  ]);

  const inventoryValueDescription = useMemo(() => {
    if (
      search.trim() ||
      typeFilter !== "ALL" ||
      stockFilter !== "ALL"
    ) {
      return "Based on current filtered inventory";
    }

    return "Based on current cost";
  }, [
    search,
    typeFilter,
    stockFilter,
  ]);

  const movementChart = useMemo(() => {
    const grouped = {};

    transactions.forEach((transaction) => {
      const date =
        transaction.transaction_date;

      if (!date) {
        return;
      }

      if (!grouped[date]) {
        grouped[date] = {
          date,
          incoming: 0,
          outgoing: 0,
        };
      }

      const quantity = Number(
        transaction.quantity || 0
      );

      if (
        [
          "PURCHASE",
          "ADJUSTMENT_IN",
          "RETURN_IN",
          "OPENING_BALANCE",
        ].includes(
          transaction.transaction_type
        )
      ) {
        grouped[date].incoming += quantity;
      } else {
        grouped[date].outgoing += quantity;
      }
    });

    return Object.values(grouped)
      .sort(
        (a, b) =>
          new Date(a.date) -
          new Date(b.date)
      )
      .slice(-14);
  }, [transactions]);

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => {
        const first = new Date(
          `${a.transaction_date || ""}T00:00:00`
        );

        const second = new Date(
          `${b.transaction_date || ""}T00:00:00`
        );

        return second - first || b.id - a.id;
      })
      .slice(0, 8);
  }, [transactions]);

  const handleAdjustmentChange = (
    event
  ) => {
    const { name, value } = event.target;

    setAdjustmentForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const openAdjustment = () => {
    setAdjustmentError("");
    setAdjustmentForm({
      ...emptyAdjustment,
      transaction_date: new Date()
        .toISOString()
        .split("T")[0],
    });
    setShowAdjustmentModal(true);
  };

  const closeAdjustment = () => {
    if (savingAdjustment) {
      return;
    }

    setShowAdjustmentModal(false);
    setAdjustmentError("");
  };

  const submitAdjustment = async (
    event
  ) => {
    event.preventDefault();

    if (!companyId) {
      setAdjustmentError(
        "Please select a company first."
      );
      return;
    }

    if (!adjustmentForm.product) {
      setAdjustmentError(
        "Please select a product."
      );
      return;
    }

    if (
      !adjustmentForm.quantity ||
      Number(adjustmentForm.quantity) <= 0
    ) {
      setAdjustmentError(
        "Quantity must be greater than zero."
      );
      return;
    }

    if (
      adjustmentForm.unit_cost !== "" &&
      Number(adjustmentForm.unit_cost) < 0
    ) {
      setAdjustmentError(
        "Unit cost cannot be negative."
      );
      return;
    }

    try {
      setSavingAdjustment(true);
      setAdjustmentError("");

      await api.post(
        "/api/operations/inventory/transactions/",
        {
          company: companyId,
          product: Number(
            adjustmentForm.product
          ),
          transaction_type:
            adjustmentForm.transaction_type,
          quantity:
            adjustmentForm.quantity,
          unit_cost:
            adjustmentForm.unit_cost || "0.00",
          reference:
            adjustmentForm.reference.trim(),
          description:
            adjustmentForm.description.trim(),
          transaction_date:
            adjustmentForm.transaction_date,
        }
      );

      setShowAdjustmentModal(false);
      setAdjustmentForm(emptyAdjustment);

      await loadInventory(true);
    } catch (err) {
      console.error(err);

      setAdjustmentError(
        err?.data?.detail ||
          err?.data?.message ||
          err?.data?.quantity?.[0] ||
          err?.data?.product?.[0] ||
          err?.message ||
          "Unable to record inventory adjustment."
      );
    } finally {
      setSavingAdjustment(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("ALL");
    setStockFilter("ALL");
  };

  const hasFilters =
    search ||
    typeFilter !== "ALL" ||
    stockFilter !== "ALL";

  return (
    <div className="inventory-page">
      <div className="inventory-page-header">
        <div>
          <div className="inventory-eyebrow">
            INVENTORY CONTROL
          </div>

          <h1>Inventory</h1>

          <p>
            Monitor stock levels, inventory value,
            and product movements for{" "}
            <strong>
              {currentCompany?.name ||
                "your company"}
            </strong>
            .
          </p>
        </div>

        <div className="inventory-header-actions">
          <button
            type="button"
            className="inventory-secondary-btn"
            onClick={() => loadInventory(true)}
            disabled={refreshing}
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "inventory-spin"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            type="button"
            className="inventory-primary-btn"
            onClick={openAdjustment}
          >
            <Plus size={18} />
            Stock Adjustment
          </button>
        </div>
      </div>

      {error && (
        <div className="inventory-error">
          <AlertTriangle size={18} />

          <span>{error}</span>

          <button
            type="button"
            onClick={() => loadInventory()}
          >
            Try Again
          </button>
        </div>
      )}

      <div className="inventory-kpi-grid">
        <div className="inventory-kpi-card">
          <div className="inventory-kpi-icon inventory-kpi-blue">
            <Boxes size={21} />
          </div>

          <div>
            <span>Total Products</span>

            <strong>
              {formatNumber(
                stats.totalProducts
              )}
            </strong>

            <small>
              {summaryDescription}
            </small>
          </div>
        </div>

        <div className="inventory-kpi-card">
          <div className="inventory-kpi-icon inventory-kpi-gold">
            <Package size={21} />
          </div>

          <div>
            <span>Units in Stock</span>

            <strong>
              {formatNumber(
                stats.totalUnits
              )}
            </strong>

            <small>
              {summaryDescription}
            </small>
          </div>
        </div>

        <div className="inventory-kpi-card">
          <div className="inventory-kpi-icon inventory-kpi-warning">
            <TrendingDown size={21} />
          </div>

          <div>
            <span>Low Stock</span>

            <strong>
              {formatNumber(
                stats.lowStock
              )}
            </strong>

            <small>
              {hasFilters
                ? "Within current filters"
                : "Items at or below reorder level"}
            </small>
          </div>
        </div>

        <div className="inventory-kpi-card">
          <div className="inventory-kpi-icon inventory-kpi-value">
            <DollarSign size={21} />
          </div>

          <div>
            <span>Inventory Value</span>

            <strong>
              {formatMoney(
                stats.inventoryValue,
                currency
              )}
            </strong>

            <small>
              {inventoryValueDescription}
            </small>
          </div>
        </div>
      </div>

      <div className="inventory-content-grid">
        <section className="inventory-panel inventory-chart-panel">
          <div className="inventory-panel-header">
            <div>
              <h2>Stock Movement</h2>
              <p>
                Incoming and outgoing inventory
                activity.
              </p>
            </div>

            <div className="inventory-chart-legend">
              <span>
                <i className="inventory-dot incoming" />
                Incoming
              </span>

              <span>
                <i className="inventory-dot outgoing" />
                Outgoing
              </span>
            </div>
          </div>

          <div className="inventory-chart">
            {movementChart.length === 0 ? (
              <div className="inventory-empty-chart">
                <ClipboardList size={30} />

                <span>
                  No inventory movement recorded
                  yet.
                </span>
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <AreaChart
                  data={movementChart}
                  margin={{
                    top: 10,
                    right: 10,
                    left: -20,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => {
                      const date =
                        new Date(value);

                      return date.toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                        }
                      );
                    }}
                    tick={{
                      fontSize: 11,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    tick={{
                      fontSize: 11,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    formatter={(value, name) => [
                      formatNumber(value),
                      name === "incoming"
                        ? "Incoming"
                        : "Outgoing",
                    ]}
                    labelFormatter={(value) =>
                      new Date(
                        `${value}T00:00:00`
                      ).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )
                    }
                  />

                  <Area
                    type="monotone"
                    dataKey="incoming"
                    stroke="#123C78"
                    fill="#123C78"
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />

                  <Area
                    type="monotone"
                    dataKey="outgoing"
                    stroke="#D99A00"
                    fill="#D99A00"
                    fillOpacity={0.10}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="inventory-panel inventory-alert-panel">
          <div className="inventory-panel-header">
            <div>
              <h2>Stock Alerts</h2>
              <p>
                Items that need attention.
              </p>
            </div>

            <div className="inventory-alert-count">
              {stats.lowStock}
            </div>
          </div>

          <div className="inventory-alert-list">
            {inventoryRows
              .filter(
                (item) => item.isLowStock
              )
              .slice(0, 5)
              .map((item) => {
                return (
                  <div
                    className="inventory-alert-item"
                    key={item.id}
                  >
                    <div className="inventory-alert-icon">
                      <AlertTriangle size={17} />
                    </div>

                    <div className="inventory-alert-info">
                      <strong>
                        {item.productName}
                      </strong>

                      <span>
                        {formatNumber(
                          item.quantity
                        )}{" "}
                        remaining · Reorder at{" "}
                        {formatNumber(
                          item.reorderLevel
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}

            {stats.lowStock === 0 && (
              <div className="inventory-no-alerts">
                <Boxes size={30} />

                <strong>
                  Inventory looks healthy
                </strong>

                <span>
                  {hasFilters
                    ? "No matching products are currently below their reorder levels."
                    : "No products are currently below their reorder levels."}
                </span>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="inventory-panel inventory-table-panel">
        <div className="inventory-panel-header inventory-table-header">
          <div>
            <h2>Stock Overview</h2>

            <p>
              Current quantity and valuation by
              product.
            </p>
          </div>

          <div className="inventory-table-summary">
            {inventoryRows.length} item
            {inventoryRows.length === 1
              ? ""
              : "s"}
          </div>
        </div>

        <div className="inventory-toolbar">
          <div className="inventory-search">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search products or codes..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />
          </div>

          <div className="inventory-filter">
            <SlidersHorizontal size={16} />

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value
                )
              }
            >
              {PRODUCT_TYPES.map(
                (type) => (
                  <option
                    key={type.value}
                    value={type.value}
                  >
                    {type.label}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="inventory-filter">
            <select
              value={stockFilter}
              onChange={(event) =>
                setStockFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All Stock
              </option>

              <option value="AVAILABLE">
                Available
              </option>

              <option value="LOW">
                Low Stock
              </option>

              <option value="OUT">
                Out of Stock
              </option>
            </select>
          </div>

          {hasFilters && (
            <button
              type="button"
              className="inventory-clear-btn"
              onClick={clearFilters}
            >
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="inventory-loading">
            <RefreshCw
              size={22}
              className="inventory-spin"
            />

            <span>
              Loading inventory...
            </span>
          </div>
        ) : inventoryRows.length === 0 ? (
          <div className="inventory-empty">
            <Boxes size={42} />

            <h3>
              {hasFilters
                ? "No matching inventory"
                : "No inventory records"}
            </h3>

            <p>
              {hasFilters
                ? "Try adjusting your search or filters."
                : "Inventory records will appear here once products are stocked."}
            </p>
          </div>
        ) : (
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Type</th>
                  <th>On Hand</th>
                  <th>Reorder Level</th>
                  <th>Cost Price</th>
                  <th>Inventory Value</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {inventoryRows.map(
                  (item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="inventory-product-cell">
                          <div className="inventory-product-avatar">
                            {item.productName
                              ?.charAt(0)
                              ?.toUpperCase() ||
                              "P"}
                          </div>

                          <div>
                            <strong>
                              {item.productName}
                            </strong>

                            <span>
                              {item.productCode}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="inventory-type-badge">
                          {getProductTypeLabel(
                            item.productType
                          )}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {formatNumber(
                            item.quantity
                          )}
                        </strong>

                        <span className="inventory-unit">
                          {item.unit}
                        </span>
                      </td>

                      <td>
                        {item.reorderLevel > 0
                          ? formatNumber(
                              item.reorderLevel
                            )
                          : "—"}
                      </td>

                      <td>
                        {formatMoney(
                          item.costPrice,
                          currency
                        )}
                      </td>

                      <td>
                        <strong>
                          {formatMoney(
                            item.inventoryValue,
                            currency
                          )}
                        </strong>
                      </td>

                      <td>
                        {item.isOutOfStock ? (
                          <span className="inventory-status inventory-status-out">
                            Out of Stock
                          </span>
                        ) : item.isLowStock ? (
                          <span className="inventory-status inventory-status-low">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inventory-status inventory-status-ok">
                            In Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="inventory-panel inventory-movement-panel">
        <div className="inventory-panel-header">
          <div>
            <h2>Recent Inventory Movements</h2>

            <p>
              Latest purchases, sales, returns,
              and adjustments.
            </p>
          </div>

          <div className="inventory-movement-count">
            {transactions.length} movement
            {transactions.length === 1
              ? ""
              : "s"}
          </div>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="inventory-empty inventory-empty-small">
            <ClipboardList size={32} />

            <h3>
              No inventory movements yet
            </h3>

            <p>
              Inventory transactions will appear
              here as stock activity occurs.
            </p>
          </div>
        ) : (
          <div className="inventory-movements">
            {recentTransactions.map(
              (transaction) => {
                const incoming =
                  getMovementSign(
                    transaction.transaction_type
                  ) === "+";

                return (
                  <div
                    className="inventory-movement-row"
                    key={transaction.id}
                  >
                    <div
                      className={`inventory-movement-icon ${
                        incoming
                          ? "inventory-movement-in"
                          : "inventory-movement-out"
                      }`}
                    >
                      {incoming ? (
                        <ArrowUpToLine
                          size={18}
                        />
                      ) : (
                        <ArrowDownToLine
                          size={18}
                        />
                      )}
                    </div>

                    <div className="inventory-movement-main">
                      <strong>
                        {transaction.product_name ||
                          `Product #${transaction.product}`}
                      </strong>

                      <span>
                        {getTransactionLabel(
                          transaction.transaction_type
                        )}
                        {transaction.reference
                          ? ` · ${transaction.reference}`
                          : ""}
                      </span>
                    </div>

                    <div className="inventory-movement-date">
                      {transaction.transaction_date ||
                        "—"}
                    </div>

                    <div
                      className={`inventory-movement-quantity ${
                        incoming
                          ? "movement-positive"
                          : "movement-negative"
                      }`}
                    >
                      {getMovementSign(
                        transaction.transaction_type
                      )}
                      {formatNumber(
                        transaction.quantity
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>

      {showAdjustmentModal && (
        <div
          className="inventory-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeAdjustment();
            }
          }}
        >
          <div className="inventory-modal">
            <div className="inventory-modal-header">
              <div>
                <span>
                  INVENTORY CONTROL
                </span>

                <h2>
                  Record Stock Adjustment
                </h2>

                <p>
                  Add or remove stock while
                  maintaining a complete inventory
                  transaction history.
                </p>
              </div>

              <button
                type="button"
                className="inventory-modal-close"
                onClick={closeAdjustment}
                disabled={savingAdjustment}
              >
                <X size={19} />
              </button>
            </div>

            {adjustmentError && (
              <div className="inventory-modal-error">
                <AlertTriangle size={17} />

                <span>
                  {adjustmentError}
                </span>
              </div>
            )}

            <form
              onSubmit={submitAdjustment}
              className="inventory-adjustment-form"
            >
              <div className="inventory-form-grid">
                <label>
                  <span>Product *</span>

                  <select
                    name="product"
                    value={
                      adjustmentForm.product
                    }
                    onChange={
                      handleAdjustmentChange
                    }
                    required
                  >
                    <option value="">
                      Select product
                    </option>

                    {products
                      .filter(
                        (product) =>
                          product.track_inventory !==
                            false &&
                          product.is_active !==
                            false
                      )
                      .map((product) => (
                        <option
                          key={product.id}
                          value={product.id}
                        >
                          {product.name}
                          {product.code
                            ? ` (${product.code})`
                            : ""}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  <span>
                    Transaction Type *
                  </span>

                  <select
                    name="transaction_type"
                    value={
                      adjustmentForm.transaction_type
                    }
                    onChange={
                      handleAdjustmentChange
                    }
                    required
                  >
                    {TRANSACTION_TYPES.map(
                      (type) => (
                        <option
                          key={type.value}
                          value={type.value}
                        >
                          {type.label}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  <span>Quantity *</span>

                  <input
                    type="number"
                    name="quantity"
                    min="0.001"
                    step="0.001"
                    placeholder="0.000"
                    value={
                      adjustmentForm.quantity
                    }
                    onChange={
                      handleAdjustmentChange
                    }
                    required
                  />
                </label>

                <label>
                  <span>
                    Unit Cost ({currency})
                  </span>

                  <input
                    type="number"
                    name="unit_cost"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={
                      adjustmentForm.unit_cost
                    }
                    onChange={
                      handleAdjustmentChange
                    }
                  />
                </label>

                <label>
                  <span>
                    Transaction Date *
                  </span>

                  <input
                    type="date"
                    name="transaction_date"
                    value={
                      adjustmentForm.transaction_date
                    }
                    onChange={
                      handleAdjustmentChange
                    }
                    required
                  />
                </label>

                <label>
                  <span>Reference</span>

                  <input
                    type="text"
                    name="reference"
                    placeholder="e.g. STOCK-ADJ-001"
                    value={
                      adjustmentForm.reference
                    }
                    onChange={
                      handleAdjustmentChange
                    }
                  />
                </label>
              </div>

              <label className="inventory-form-full">
                <span>Description</span>

                <textarea
                  name="description"
                  rows="3"
                  placeholder="Explain the reason for this stock movement..."
                  value={
                    adjustmentForm.description
                  }
                  onChange={
                    handleAdjustmentChange
                  }
                />
              </label>

              <div className="inventory-modal-footer">
                <button
                  type="button"
                  className="inventory-cancel-btn"
                  onClick={closeAdjustment}
                  disabled={savingAdjustment}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="inventory-primary-btn"
                  disabled={savingAdjustment}
                >
                  {savingAdjustment ? (
                    <>
                      <RefreshCw
                        size={17}
                        className="inventory-spin"
                      />

                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      Record Movement
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}