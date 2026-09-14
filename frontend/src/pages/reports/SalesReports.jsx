import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  Download,
  FileBarChart,
  Filter,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";

function extractList(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.sales)) return response.sales;
  return [];
}

function money(value, currency = "USD") {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))} ${currency}`;
}

function number(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateLabel(value) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDate(sale) {
  return (
    sale.sale_date ||
    sale.transaction_date ||
    sale.date ||
    sale.created_at?.slice(0, 10) ||
    null
  );
}

function getCustomerName(sale) {
  if (sale.customer_name) {
    return sale.customer_name;
  }

  if (
    sale.customer &&
    typeof sale.customer === "object"
  ) {
    return (
      sale.customer.name ||
      sale.customer.full_name ||
      `Customer #${sale.customer.id}`
    );
  }

  if (sale.customer) {
    return `Customer #${sale.customer}`;
  }

  return "Walk-in Customer";
}

function getPaymentMethod(sale) {
  return (
    sale.payment_method ||
    sale.payment_type ||
    "OTHER"
  );
}

function statusLabel(status) {
  const labels = {
    COMPLETED: "Completed",
    PENDING: "Pending",
    CANCELLED: "Cancelled",
    DRAFT: "Draft",
  };

  return (
    labels[status] ||
    status ||
    "Unknown"
  );
}

function statusClass(status) {
  return `sales-report-status sales-report-status-${String(
    status || "unknown"
  ).toLowerCase()}`;
}

function getError(error) {
  const data = error?.data;

  if (data?.detail) {
    return data.detail;
  }

  if (data?.message) {
    return data.message;
  }

  return (
    error?.message ||
    "Unable to load sales reports."
  );
}

export default function SalesReports() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;
  const companyName =
    currentCompany?.name ||
    "No company selected";
  const currency =
    currentCompany?.currency ||
    "USD";

  const [sales, setSales] = useState([]);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");
  const [statusFilter, setStatusFilter] =
    useState("ALL");
  const [paymentFilter, setPaymentFilter] =
    useState("ALL");

  const [dateFrom, setDateFrom] =
    useState("");
  const [dateTo, setDateTo] =
    useState("");

  const loadSales = useCallback(
    async (refresh = false) => {
      if (!companyId) {
        setSales([]);
        setLoading(false);
        return;
      }

      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await api.get(
          `/api/operations/sales/?company=${companyId}`
        );

        setSales(
          extractList(response)
        );
      } catch (err) {
        setSales([]);
        setError(getError(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId]
  );

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const paymentMethods = useMemo(() => {
    return [
      ...new Set(
        sales
          .map(getPaymentMethod)
          .filter(Boolean)
      ),
    ].sort();
  }, [sales]);

  const filteredSales = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return sales.filter((sale) => {
      const saleDate = getDate(sale);

      const searchText = [
        sale.sale_number,
        getCustomerName(sale),
        getPaymentMethod(sale),
        sale.status,
        sale.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query ||
        searchText.includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        sale.status === statusFilter;

      const matchesPayment =
        paymentFilter === "ALL" ||
        getPaymentMethod(sale) ===
          paymentFilter;

      const matchesFrom =
        !dateFrom ||
        !saleDate ||
        saleDate >= dateFrom;

      const matchesTo =
        !dateTo ||
        !saleDate ||
        saleDate <= dateTo;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPayment &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [
    sales,
    search,
    statusFilter,
    paymentFilter,
    dateFrom,
    dateTo,
  ]);

  const completedSales = useMemo(
    () =>
      filteredSales.filter(
        (sale) =>
          sale.status ===
          "COMPLETED"
      ),
    [filteredSales]
  );

  const summary = useMemo(() => {
    const revenue =
      completedSales.reduce(
        (sum, sale) =>
          sum +
          Number(
            sale.total_amount || 0
          ),
        0
      );

    const profit =
      completedSales.reduce(
        (sum, sale) =>
          sum +
          Number(
            sale.gross_profit || 0
          ),
        0
      );

    const totalCost =
      completedSales.reduce(
        (sum, sale) =>
          sum +
          Number(
            sale.total_cost || 0
          ),
        0
      );

    const average =
      completedSales.length
        ? revenue /
          completedSales.length
        : 0;

    const margin =
      revenue > 0
        ? (profit / revenue) * 100
        : 0;

    return {
      transactions:
        filteredSales.length,
      completed:
        completedSales.length,
      revenue,
      profit,
      totalCost,
      average,
      margin,
    };
  }, [
    filteredSales,
    completedSales,
  ]);

  const statusSummary = useMemo(() => {
    const counts = {
      COMPLETED: 0,
      PENDING: 0,
      CANCELLED: 0,
      DRAFT: 0,
    };

    filteredSales.forEach(
      (sale) => {
        if (
          counts[sale.status] !==
          undefined
        ) {
          counts[sale.status] += 1;
        }
      }
    );

    return counts;
  }, [filteredSales]);

  const paymentSummary = useMemo(() => {
    const map = {};

    completedSales.forEach(
      (sale) => {
        const method =
          getPaymentMethod(sale);

        if (!map[method]) {
          map[method] = {
            method,
            transactions: 0,
            amount: 0,
          };
        }

        map[method].transactions += 1;

        map[method].amount +=
          Number(
            sale.total_amount || 0
          );
      }
    );

    return Object.values(map).sort(
      (a, b) =>
        b.amount - a.amount
    );
  }, [completedSales]);

  const customerSummary = useMemo(() => {
    const map = {};

    completedSales.forEach(
      (sale) => {
        const customer =
          getCustomerName(sale);

        if (!map[customer]) {
          map[customer] = {
            customer,
            transactions: 0,
            revenue: 0,
            profit: 0,
          };
        }

        map[customer].transactions += 1;

        map[customer].revenue +=
          Number(
            sale.total_amount || 0
          );

        map[customer].profit +=
          Number(
            sale.gross_profit || 0
          );
      }
    );

    return Object.values(map)
      .sort(
        (a, b) =>
          b.revenue - a.revenue
      )
      .slice(0, 10);
  }, [completedSales]);

  const productSummary = useMemo(() => {
    const map = {};

    completedSales.forEach(
      (sale) => {
        const items =
          Array.isArray(sale.items)
            ? sale.items
            : Array.isArray(
                sale.sale_items
              )
            ? sale.sale_items
            : [];

        items.forEach((item) => {
          let name =
            item.product_name ||
            item.product?.name ||
            item.description ||
            "Unknown Product";

          if (
            item.product &&
            typeof item.product ===
              "number"
          ) {
            name = `Product #${item.product}`;
          }

          if (!map[name]) {
            map[name] = {
              product: name,
              quantity: 0,
              revenue: 0,
            };
          }

          map[name].quantity +=
            Number(
              item.quantity || 0
            );

          map[name].revenue +=
            Number(
              item.line_total ||
                item.total ||
                (
                  Number(
                    item.quantity || 0
                  ) *
                  Number(
                    item.unit_price || 0
                  )
                )
            );
        });
      }
    );

    return Object.values(map)
      .sort(
        (a, b) =>
          b.revenue - a.revenue
      )
      .slice(0, 10);
  }, [completedSales]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setPaymentFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters =
    Boolean(search) ||
    statusFilter !== "ALL" ||
    paymentFilter !== "ALL" ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const exportCsv = () => {
    const rows = filteredSales.map(
      (sale) => [
        getDate(sale) || "",
        sale.sale_number || "",
        getCustomerName(sale),
        getPaymentMethod(sale),
        statusLabel(sale.status),
        Number(
          sale.total_cost || 0
        ).toFixed(2),
        Number(
          sale.gross_profit || 0
        ).toFixed(2),
        Number(
          sale.total_amount || 0
        ).toFixed(2),
      ]
    );

    const quote = (value) =>
      `"${String(
        value ?? ""
      ).replaceAll(
        '"',
        '""'
      )}"`;

    const csv = [
      [
        "Date",
        "Sale Number",
        "Customer",
        "Payment Method",
        "Status",
        "Total Cost",
        "Gross Profit",
        "Total Amount",
      ]
        .map(quote)
        .join(","),

      ...rows.map((row) =>
        row.map(quote).join(",")
      ),
    ].join("\n");

    const url =
      URL.createObjectURL(
        new Blob([csv], {
          type:
            "text/csv;charset=utf-8;",
        })
      );

    const link =
      document.createElement("a");

    link.href = url;
    link.download = `sales-report-${companyId}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  if (!companyId) {
    return (
      <div className="sales-reports-page">
        <div className="sales-report-empty-company">
          <FileBarChart size={30} />

          <h2>
            No Company Selected
          </h2>

          <p>
            Select a company to view
            sales reports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sales-reports-page">
      {/* HEADER */}
      <div className="sales-report-header">
        <div>
          <div className="sales-report-eyebrow">
            SALES REPORTING
          </div>

          <h1>Sales Reports</h1>

          <p>
            Analyze sales revenue,
            profitability, customers
            and transaction activity
            for the selected company.
          </p>
        </div>

        <div className="sales-report-header-actions">
          <button
            type="button"
            className="sales-report-btn sales-report-btn-secondary"
            onClick={() =>
              loadSales(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "sales-report-spin"
                  : ""
              }
            />

            Refresh
          </button>

          <button
            type="button"
            className="sales-report-btn sales-report-btn-primary"
            onClick={exportCsv}
            disabled={
              !filteredSales.length
            }
          >
            <Download size={16} />

            Export CSV
          </button>
        </div>
      </div>

      {/* COMPANY */}
      <div className="sales-report-company-strip">
        <div className="sales-report-company-mark">
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

        <div className="sales-report-company-currency">
          <span>
            Reporting Currency
          </span>

          <strong>
            {currency}
          </strong>
        </div>
      </div>

      {error && (
        <div className="sales-report-alert">
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

      {/* FILTERS */}
      <section className="sales-report-filter-card">
        <div className="sales-report-filter-heading">
          <div>
            <Filter size={17} />

            <div>
              <h2>
                Report Filters
              </h2>

              <p>
                Refine the sales data
                used in this report.
              </p>
            </div>
          </div>

          {hasFilters && (
            <button
              type="button"
              className="sales-report-clear"
              onClick={
                clearFilters
              }
            >
              <X size={14} />

              Clear Filters
            </button>
          )}
        </div>

        <div className="sales-report-filters">
          <label>
            <span>
              Search
            </span>

            <div className="sales-report-input-wrap">
              <Search size={15} />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Sale number, customer..."
              />
            </div>
          </label>

          <label>
            <span>
              Status
            </span>

            <div className="sales-report-select-wrap">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
              >
                <option value="ALL">
                  All Statuses
                </option>
                <option value="COMPLETED">
                  Completed
                </option>
                <option value="PENDING">
                  Pending
                </option>
                <option value="CANCELLED">
                  Cancelled
                </option>
                <option value="DRAFT">
                  Draft
                </option>
              </select>

              <ChevronDown
                size={15}
              />
            </div>
          </label>

          <label>
            <span>
              Payment Method
            </span>

            <div className="sales-report-select-wrap">
              <select
                value={
                  paymentFilter
                }
                onChange={(event) =>
                  setPaymentFilter(
                    event.target.value
                  )
                }
              >
                <option value="ALL">
                  All Payment Methods
                </option>

                {paymentMethods.map(
                  (method) => (
                    <option
                      key={method}
                      value={method}
                    >
                      {method}
                    </option>
                  )
                )}
              </select>

              <ChevronDown
                size={15}
              />
            </div>
          </label>

          <label>
            <span>
              From Date
            </span>

            <div className="sales-report-date-wrap">
              <CalendarDays
                size={15}
              />

              <input
                type="date"
                value={dateFrom}
                onChange={(event) =>
                  setDateFrom(
                    event.target.value
                  )
                }
              />
            </div>
          </label>

          <label>
            <span>
              To Date
            </span>

            <div className="sales-report-date-wrap">
              <CalendarDays
                size={15}
              />

              <input
                type="date"
                value={dateTo}
                onChange={(event) =>
                  setDateTo(
                    event.target.value
                  )
                }
              />
            </div>
          </label>
        </div>
      </section>

      {/* KPI GRID */}
      <div className="sales-report-kpi-grid">
        <div className="sales-report-kpi">
          <div className="sales-report-kpi-icon sales-report-icon-blue">
            <ShoppingCart size={19} />
          </div>

          <div>
            <span>
              Transactions
            </span>

            <strong>
              {number(
                summary.transactions
              )}
            </strong>

            <small>
              {summary.completed} completed
            </small>
          </div>
        </div>

        <div className="sales-report-kpi">
          <div className="sales-report-kpi-icon sales-report-icon-gold">
            <DollarSign size={19} />
          </div>

          <div>
            <span>
              Sales Revenue
            </span>

            <strong>
              {money(
                summary.revenue,
                currency
              )}
            </strong>

            <small>
              Completed sales
            </small>
          </div>
        </div>

        <div className="sales-report-kpi">
          <div className="sales-report-kpi-icon sales-report-icon-navy">
            <TrendingUp size={19} />
          </div>

          <div>
            <span>
              Gross Profit
            </span>

            <strong>
              {money(
                summary.profit,
                currency
              )}
            </strong>

            <small>
              {summary.margin.toFixed(
                1
              )}
              % margin
            </small>
          </div>
        </div>

        <div className="sales-report-kpi">
          <div className="sales-report-kpi-icon sales-report-icon-dark">
            <BarChart3 size={19} />
          </div>

          <div>
            <span>
              Average Sale
            </span>

            <strong>
              {money(
                summary.average,
                currency
              )}
            </strong>

            <small>
              Per completed sale
            </small>
          </div>
        </div>
      </div>

      {/* STATUS + PAYMENT */}
      <div className="sales-report-two-column">
        <section className="sales-report-panel">
          <div className="sales-report-panel-header">
            <div>
              <div className="sales-report-section-label">
                TRANSACTION STATUS
              </div>

              <h2>
                Sales Activity
              </h2>

              <p>
                Transaction status
                across the selected
                reporting period.
              </p>
            </div>
          </div>

          <div className="sales-report-status-grid">
            {[
              [
                "COMPLETED",
                "Completed",
              ],
              [
                "PENDING",
                "Pending",
              ],
              [
                "CANCELLED",
                "Cancelled",
              ],
              [
                "DRAFT",
                "Draft",
              ],
            ].map(
              ([status, label]) => (
                <div
                  key={status}
                  className="sales-report-status-card"
                >
                  <span
                    className={statusClass(
                      status
                    )}
                  >
                    {label}
                  </span>

                  <strong>
                    {
                      statusSummary[
                        status
                      ]
                    }
                  </strong>

                  <small>
                    transactions
                  </small>
                </div>
              )
            )}
          </div>
        </section>

        <section className="sales-report-panel">
          <div className="sales-report-panel-header">
            <div>
              <div className="sales-report-section-label">
                PAYMENT ANALYSIS
              </div>

              <h2>
                Payment Methods
              </h2>

              <p>
                Completed sales grouped
                by payment method.
              </p>
            </div>
          </div>

          {paymentSummary.length ===
          0 ? (
            <div className="sales-report-empty">
              <DollarSign size={24} />

              <span>
                No completed sales
                available.
              </span>
            </div>
          ) : (
            <div className="sales-report-payment-list">
              {paymentSummary.map(
                (item) => (
                  <div
                    key={item.method}
                    className="sales-report-payment-row"
                  >
                    <div>
                      <strong>
                        {item.method}
                      </strong>

                      <span>
                        {
                          item.transactions
                        }{" "}
                        transaction
                        {item.transactions ===
                        1
                          ? ""
                          : "s"}
                      </span>
                    </div>

                    <strong>
                      {money(
                        item.amount,
                        currency
                      )}
                    </strong>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>

      {/* CUSTOMER + PRODUCT */}
      <div className="sales-report-two-column">
        <section className="sales-report-panel">
          <div className="sales-report-panel-header">
            <div>
              <div className="sales-report-section-label">
                CUSTOMER PERFORMANCE
              </div>

              <h2>
                Top Customers
              </h2>

              <p>
                Customers ranked by
                completed sales revenue.
              </p>
            </div>

            <Users size={19} />
          </div>

          {customerSummary.length ===
          0 ? (
            <div className="sales-report-empty">
              <Users size={24} />

              <span>
                No customer sales
                available.
              </span>
            </div>
          ) : (
            <div className="sales-report-ranking-list">
              {customerSummary.map(
                (item, index) => (
                  <div
                    key={item.customer}
                    className="sales-report-ranking-row"
                  >
                    <div className="sales-report-rank">
                      {index + 1}
                    </div>

                    <div className="sales-report-ranking-main">
                      <strong>
                        {item.customer}
                      </strong>

                      <span>
                        {
                          item.transactions
                        }{" "}
                        sale
                        {item.transactions ===
                        1
                          ? ""
                          : "s"}
                      </span>
                    </div>

                    <div className="sales-report-ranking-value">
                      <strong>
                        {money(
                          item.revenue,
                          currency
                        )}
                      </strong>

                      <span>
                        Profit{" "}
                        {money(
                          item.profit,
                          currency
                        )}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        <section className="sales-report-panel">
          <div className="sales-report-panel-header">
            <div>
              <div className="sales-report-section-label">
                PRODUCT PERFORMANCE
              </div>

              <h2>
                Top Products / Services
              </h2>

              <p>
                Highest-value products
                recorded in completed
                sales.
              </p>
            </div>
          </div>

          {productSummary.length ===
          0 ? (
            <div className="sales-report-empty">
              <ShoppingCart size={24} />

              <span>
                No item-level sales
                data available.
              </span>
            </div>
          ) : (
            <div className="sales-report-ranking-list">
              {productSummary.map(
                (item, index) => (
                  <div
                    key={item.product}
                    className="sales-report-ranking-row"
                  >
                    <div className="sales-report-rank">
                      {index + 1}
                    </div>

                    <div className="sales-report-ranking-main">
                      <strong>
                        {item.product}
                      </strong>

                      <span>
                        Qty{" "}
                        {number(
                          item.quantity
                        )}
                      </span>
                    </div>

                    <div className="sales-report-ranking-value">
                      <strong>
                        {money(
                          item.revenue,
                          currency
                        )}
                      </strong>

                      <span>
                        Sales revenue
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>

      {/* TRANSACTION TABLE */}
      <section className="sales-report-panel sales-report-transactions-panel">
        <div className="sales-report-panel-header">
          <div>
            <div className="sales-report-section-label">
              SALES REGISTER
            </div>

            <h2>
              Sales Transactions
            </h2>

            <p>
              Detailed sales activity
              matching the selected
              filters.
            </p>
          </div>

          <span className="sales-report-result-count">
            {filteredSales.length}{" "}
            record
            {filteredSales.length ===
            1
              ? ""
              : "s"}
          </span>
        </div>

        {loading ? (
          <div className="sales-report-loading">
            <RefreshCw
              size={22}
              className="sales-report-spin"
            />

            <span>
              Loading sales reports...
            </span>
          </div>
        ) : filteredSales.length ===
          0 ? (
          <div className="sales-report-empty">
            <FileBarChart size={27} />

            <strong>
              No sales found
            </strong>

            <span>
              Try changing the report
              filters.
            </span>
          </div>
        ) : (
          <div className="sales-report-table-wrap">
            <table className="sales-report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Sale Number</th>
                  <th>Customer</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Cost</th>
                  <th>Gross Profit</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {filteredSales.map(
                  (sale) => (
                    <tr
                      key={sale.id}
                    >
                      <td>
                        {dateLabel(
                          getDate(
                            sale
                          )
                        )}
                      </td>

                      <td>
                        <strong>
                          {sale.sale_number ||
                            `SALE-${sale.id}`}
                        </strong>
                      </td>

                      <td>
                        {getCustomerName(
                          sale
                        )}
                      </td>

                      <td>
                        {getPaymentMethod(
                          sale
                        )}
                      </td>

                      <td>
                        <span
                          className={statusClass(
                            sale.status
                          )}
                        >
                          {statusLabel(
                            sale.status
                          )}
                        </span>
                      </td>

                      <td>
                        {money(
                          sale.total_cost,
                          currency
                        )}
                      </td>

                      <td>
                        <strong>
                          {money(
                            sale.gross_profit,
                            currency
                          )}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {money(
                            sale.total_amount,
                            currency
                          )}
                        </strong>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* FOOTER */}
      <div className="sales-report-footer">
        <div>
          <CheckCircle2 size={16} />

          <span>
            Report generated for{" "}
            <strong>
              {companyName}
            </strong>
          </span>
        </div>

        <span>
          {filteredSales.length}{" "}
          matching transaction
          {filteredSales.length === 1
            ? ""
            : "s"}
        </span>
      </div>
    </div>
  );
}