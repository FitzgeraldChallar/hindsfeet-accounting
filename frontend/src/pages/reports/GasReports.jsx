import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Download,
  Fuel,
  Gauge,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";

function list(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

function number(value) {
  return Number(value || 0);
}

function money(value, currency = "USD") {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number(value))} ${currency}`;
}

function litres(value) {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(number(value))} L`;
}

function formatDate(value) {
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

function errorText(error) {
  const data = error?.data;

  if (data && typeof data === "object") {
    if (data.detail) return data.detail;
    if (data.message) return data.message;

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
    "Unable to load gas reports."
  );
}

function resolveObject(value, collection) {
  if (
    value &&
    typeof value === "object"
  ) {
    return value;
  }

  return (
    collection.find(
      (item) =>
        String(item.id) === String(value)
    ) || null
  );
}

function productName(product) {
  return (
    product?.name ||
    product?.product_name ||
    "Unknown Fuel"
  );
}

function pumpName(pump) {
  if (!pump) return "Unknown Pump";

  return (
    pump.pump_number ||
    pump.name ||
    `Pump ${pump.id}`
  );
}

function attendantName(attendant) {
  return (
    attendant?.full_name ||
    attendant?.name ||
    "Unknown Attendant"
  );
}

function paymentLabel(value) {
  const labels = {
    CASH: "Cash",
    BANK: "Bank",
    MOBILE_MONEY: "Mobile Money",
    CARD: "Card",
    CREDIT: "Credit",
  };

  return (
    labels[value] ||
    value ||
    "Unknown"
  );
}

function statusLabel(value) {
  const labels = {
    DRAFT: "Draft",
    COMPLETED: "Completed",
    VOIDED: "Voided",
  };

  return (
    labels[value] ||
    value ||
    "Unknown"
  );
}

function statusClass(value) {
  return `gr-status gr-status-${String(
    value || "unknown"
  ).toLowerCase()}`;
}

function today() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function firstDayOfMonth() {
  const date = new Date();

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  )
    .toISOString()
    .slice(0, 10);
}

export default function GasReports() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;
  const companyName =
    currentCompany?.name ||
    "No company selected";
  const currency =
    currentCompany?.currency || "USD";

  const isGasStation =
    String(
      currentCompany?.business_type || ""
    ).toUpperCase() === "GAS_STATION";

  const [sales, setSales] = useState([]);
  const [pumps, setPumps] = useState([]);
  const [attendants, setAttendants] =
    useState([]);
  const [products, setProducts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [dateFrom, setDateFrom] =
    useState(firstDayOfMonth());

  const [dateTo, setDateTo] =
    useState(today());

  const [fuelFilter, setFuelFilter] =
    useState("ALL");

  const [pumpFilter, setPumpFilter] =
    useState("ALL");

  const [paymentFilter, setPaymentFilter] =
    useState("ALL");

  const loadReports = useCallback(
    async (refresh = false) => {
      if (!companyId || !isGasStation) {
        setSales([]);
        setPumps([]);
        setAttendants([]);
        setProducts([]);
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

        const [
          salesResponse,
          pumpsResponse,
          attendantsResponse,
          productsResponse,
        ] = await Promise.all([
          api.get(
            `/api/operations/pump-sales/?company=${companyId}`
          ),
          api.get(
            `/api/operations/fuel-pumps/?company=${companyId}`
          ),
          api.get(
            `/api/operations/pump-attendants/?company=${companyId}`
          ),
          api.get(
            `/api/operations/products/?company=${companyId}`
          ),
        ]);

        setSales(list(salesResponse));
        setPumps(list(pumpsResponse));
        setAttendants(
          list(attendantsResponse)
        );

        setProducts(
          list(productsResponse).filter(
            (product) =>
              product.product_type === "FUEL" ||
              !product.product_type
          )
        );
      } catch (err) {
        console.error(
          "Gas reports load error:",
          err
        );

        setError(errorText(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId, isGasStation]
  );

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const enrichedSales = useMemo(() => {
    return sales.map((sale) => {
      const product = resolveObject(
        sale.fuel_product,
        products
      );

      const pump = resolveObject(
        sale.pump,
        pumps
      );

      const attendant =
        resolveObject(
          sale.attendant,
          attendants
        );

      return {
        ...sale,
        product,
        pump,
        attendant,
      };
    });
  }, [
    sales,
    products,
    pumps,
    attendants,
  ]);

  const filteredSales = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return enrichedSales.filter(
      (sale) => {
        if (
          dateFrom &&
          sale.sale_date < dateFrom
        ) {
          return false;
        }

        if (
          dateTo &&
          sale.sale_date > dateTo
        ) {
          return false;
        }

        if (
          fuelFilter !== "ALL" &&
          String(
            sale.fuel_product
          ) !== String(fuelFilter)
        ) {
          return false;
        }

        if (
          pumpFilter !== "ALL" &&
          String(sale.pump) !==
            String(pumpFilter)
        ) {
          return false;
        }

        if (
          paymentFilter !== "ALL" &&
          sale.payment_method !==
            paymentFilter
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        const searchable = [
          sale.sale_number,
          sale.reference,
          sale.product?.name,
          sale.product?.code,
          sale.pump?.pump_number,
          sale.attendant?.full_name,
          sale.payment_method,
          sale.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      }
    );
  }, [
    enrichedSales,
    search,
    dateFrom,
    dateTo,
    fuelFilter,
    pumpFilter,
    paymentFilter,
  ]);

  const completedSales =
    useMemo(
      () =>
        filteredSales.filter(
          (sale) =>
            sale.status !== "VOIDED"
        ),
      [filteredSales]
    );

  const stats = useMemo(() => {
    const totalLitres =
      completedSales.reduce(
        (sum, sale) =>
          sum +
          number(sale.litres_sold),
        0
      );

    const totalRevenue =
      completedSales.reduce(
        (sum, sale) =>
          sum +
          number(sale.total_amount),
        0
      );

    const totalTransactions =
      completedSales.length;

    const averagePrice =
      totalLitres > 0
        ? totalRevenue / totalLitres
        : 0;

    const voided =
      filteredSales.filter(
        (sale) =>
          sale.status === "VOIDED"
      ).length;

    return {
      totalLitres,
      totalRevenue,
      totalTransactions,
      averagePrice,
      voided,
    };
  }, [completedSales, filteredSales]);

  const fuelSummary = useMemo(() => {
    const map = new Map();

    completedSales.forEach(
      (sale) => {
        const id =
          sale.fuel_product ??
          sale.product?.id ??
          "unknown";

        if (!map.has(id)) {
          map.set(id, {
            id,
            name: productName(
              sale.product
            ),
            litres: 0,
            revenue: 0,
            transactions: 0,
            averagePrice: 0,
          });
        }

        const row = map.get(id);

        row.litres += number(
          sale.litres_sold
        );

        row.revenue += number(
          sale.total_amount
        );

        row.transactions += 1;
      }
    );

    return [...map.values()]
      .map((row) => ({
        ...row,
        averagePrice:
          row.litres > 0
            ? row.revenue / row.litres
            : 0,
      }))
      .sort(
        (a, b) =>
          b.revenue - a.revenue
      );
  }, [completedSales]);

  const pumpSummary = useMemo(() => {
    const map = new Map();

    completedSales.forEach(
      (sale) => {
        const id =
          sale.pump ??
          sale.pump?.id ??
          "unknown";

        if (!map.has(id)) {
          map.set(id, {
            id,
            name: pumpName(
              sale.pump
            ),
            litres: 0,
            revenue: 0,
            transactions: 0,
          });
        }

        const row = map.get(id);

        row.litres += number(
          sale.litres_sold
        );

        row.revenue += number(
          sale.total_amount
        );

        row.transactions += 1;
      }
    );

    return [...map.values()].sort(
      (a, b) =>
        b.revenue - a.revenue
    );
  }, [completedSales]);

  const attendantSummary =
    useMemo(() => {
      const map = new Map();

      completedSales.forEach(
        (sale) => {
          const id =
            sale.attendant ??
            sale.attendant?.id ??
            "unknown";

          if (!map.has(id)) {
            map.set(id, {
              id,
              name: attendantName(
                sale.attendant
              ),
              litres: 0,
              revenue: 0,
              transactions: 0,
            });
          }

          const row =
            map.get(id);

          row.litres += number(
            sale.litres_sold
          );

          row.revenue += number(
            sale.total_amount
          );

          row.transactions += 1;
        }
      );

      return [...map.values()].sort(
        (a, b) =>
          b.revenue - a.revenue
      );
    }, [completedSales]);

  const paymentSummary =
    useMemo(() => {
      const map = new Map();

      completedSales.forEach(
        (sale) => {
          const key =
            sale.payment_method ||
            "UNKNOWN";

          if (!map.has(key)) {
            map.set(key, {
              method: key,
              litres: 0,
              revenue: 0,
              transactions: 0,
            });
          }

          const row =
            map.get(key);

          row.litres += number(
            sale.litres_sold
          );

          row.revenue += number(
            sale.total_amount
          );

          row.transactions += 1;
        }
      );

      return [...map.values()].sort(
        (a, b) =>
          b.revenue - a.revenue
      );
    }, [completedSales]);

  const exportCsv = () => {
    if (!filteredSales.length) {
      return;
    }

    const headers = [
      "Date",
      "Sale Number",
      "Fuel",
      "Fuel Code",
      "Pump",
      "Attendant",
      "Opening Meter",
      "Closing Meter",
      "Litres Sold",
      "Price Per Litre",
      "Total Amount",
      "Payment Method",
      "Reference",
      "Status",
    ];

    const rows =
      filteredSales.map(
        (sale) => [
          sale.sale_date || "",
          sale.sale_number || "",
          productName(
            sale.product
          ),
          sale.product?.code || "",
          pumpName(sale.pump),
          attendantName(
            sale.attendant
          ),
          sale.opening_meter || "",
          sale.closing_meter || "",
          sale.litres_sold || "",
          sale.price_per_litre || "",
          sale.total_amount || "",
          paymentLabel(
            sale.payment_method
          ),
          sale.reference || "",
          statusLabel(sale.status),
        ]
      );

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) => {
            const text = String(
              value ?? ""
            );

            return `"${text.replace(
              /"/g,
              '""'
            )}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      `gas-sales-report-${companyId}-${dateFrom || "all"}-${dateTo || "all"}.csv`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
  };

  if (!companyId) {
    return (
      <div className="gas-reports-page">
        <div className="gr-empty-company">
          <div className="gr-empty-icon">
            <Fuel size={28} />
          </div>

          <h2>No Company Selected</h2>

          <p>
            Select a company before
            opening Gas Reports.
          </p>
        </div>
      </div>
    );
  }

  if (!isGasStation) {
    return (
      <div className="gas-reports-page">
        <div className="gr-empty-company">
          <div className="gr-empty-icon">
            <Fuel size={28} />
          </div>

          <h2>
            Gas Reports Unavailable
          </h2>

          <p>
            Gas reports are only
            available for gas station
            companies.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="gas-reports-page">
      {/* HEADER */}
      <div className="gr-page-header">
        <div>
          <div className="gr-eyebrow">
            GAS OPERATIONS REPORTING
          </div>

          <h1>Gas Reports</h1>

          <p>
            Review fuel sales, litres
            dispensed, revenue, pump
            activity and payment
            performance.
          </p>
        </div>

        <button
          type="button"
          className="gr-refresh-button"
          onClick={() =>
            loadReports(true)
          }
          disabled={
            refreshing || loading
          }
        >
          <RefreshCw
            size={16}
            className={
              refreshing
                ? "gr-spin"
                : ""
            }
          />

          Refresh
        </button>
      </div>

      {/* COMPANY STRIP */}
      <div className="gr-company-strip">
        <div className="gr-company-mark">
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

        <div className="gr-company-currency">
          <span>Currency</span>

          <strong>
            {currency}
          </strong>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="gr-alert">
          <AlertCircle size={17} />

          <span>{error}</span>

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
      <section className="gr-filter-card">
        <div className="gr-filter-heading">
          <div>
            <div className="gr-section-label">
              REPORT PERIOD
            </div>

            <h2>
              Fuel Sales Report
            </h2>

            <p>
              Filter the gas station
              activity you want to
              analyze.
            </p>
          </div>

          <button
            type="button"
            className="gr-export-button"
            onClick={exportCsv}
            disabled={
              !filteredSales.length
            }
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>

        <div className="gr-filters">
          <label>
            <span>From</span>

            <div className="gr-input-icon">
              <CalendarDays
                size={16}
              />

              <input
                type="date"
                value={dateFrom}
                onChange={(e) =>
                  setDateFrom(
                    e.target.value
                  )
                }
              />
            </div>
          </label>

          <label>
            <span>To</span>

            <div className="gr-input-icon">
              <CalendarDays
                size={16}
              />

              <input
                type="date"
                value={dateTo}
                onChange={(e) =>
                  setDateTo(
                    e.target.value
                  )
                }
              />
            </div>
          </label>

          <label className="gr-search-field">
            <span>Search</span>

            <div className="gr-input-icon">
              <Search size={16} />

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Fuel, pump, attendant, reference..."
              />
            </div>
          </label>

          <label>
            <span>Fuel</span>

            <select
              value={fuelFilter}
              onChange={(e) =>
                setFuelFilter(
                  e.target.value
                )
              }
            >
              <option value="ALL">
                All Fuel Products
              </option>

              {products.map(
                (product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.name}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            <span>Pump</span>

            <select
              value={pumpFilter}
              onChange={(e) =>
                setPumpFilter(
                  e.target.value
                )
              }
            >
              <option value="ALL">
                All Pumps
              </option>

              {pumps.map((pump) => (
                <option
                  key={pump.id}
                  value={pump.id}
                >
                  {pumpName(pump)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Payment</span>

            <select
              value={paymentFilter}
              onChange={(e) =>
                setPaymentFilter(
                  e.target.value
                )
              }
            >
              <option value="ALL">
                All Methods
              </option>

              <option value="CASH">
                Cash
              </option>

              <option value="BANK">
                Bank
              </option>

              <option value="MOBILE_MONEY">
                Mobile Money
              </option>

              <option value="CARD">
                Card
              </option>

              <option value="CREDIT">
                Credit
              </option>
            </select>
          </label>
        </div>
      </section>

      {/* KPI CARDS */}
      <div className="gr-kpi-grid">
        <div className="gr-kpi-card">
          <div className="gr-kpi-icon gr-icon-blue">
            <CircleDollarSign
              size={19}
            />
          </div>

          <div>
            <span>
              Total Sales Revenue
            </span>

            <strong>
              {money(
                stats.totalRevenue,
                currency
              )}
            </strong>

            <small>
              Selected reporting
              period
            </small>
          </div>
        </div>

        <div className="gr-kpi-card">
          <div className="gr-kpi-icon gr-icon-gold">
            <Fuel size={19} />
          </div>

          <div>
            <span>
              Litres Sold
            </span>

            <strong>
              {litres(
                stats.totalLitres
              )}
            </strong>

            <small>
              Fuel dispensed
            </small>
          </div>
        </div>

        <div className="gr-kpi-card">
          <div className="gr-kpi-icon gr-icon-navy">
            <BarChart3 size={19} />
          </div>

          <div>
            <span>
              Transactions
            </span>

            <strong>
              {stats.totalTransactions}
            </strong>

            <small>
              Completed sales
            </small>
          </div>
        </div>

        <div className="gr-kpi-card">
          <div className="gr-kpi-icon gr-icon-dark">
            <CircleDollarSign
              size={19}
            />
          </div>

          <div>
            <span>
              Average Price / Litre
            </span>

            <strong>
              {money(
                stats.averagePrice,
                currency
              )}
            </strong>

            <small>
              Revenue ÷ litres sold
            </small>
          </div>
        </div>
      </div>

      {/* SECONDARY OVERVIEW */}
      <div className="gr-overview-grid">
        <div className="gr-overview-card">
          <div className="gr-overview-icon">
            <Gauge size={19} />
          </div>

          <div>
            <span>
              Active Pumps
            </span>

            <strong>
              {
                pumps.filter(
                  (pump) =>
                    pump.is_active !==
                    false
                ).length
              }
            </strong>
          </div>
        </div>

        <div className="gr-overview-card">
          <div className="gr-overview-icon">
            <Users size={19} />
          </div>

          <div>
            <span>
              Active Attendants
            </span>

            <strong>
              {
                attendants.filter(
                  (item) =>
                    item.is_active !==
                    false
                ).length
              }
            </strong>
          </div>
        </div>

        <div className="gr-overview-card">
          <div className="gr-overview-icon">
            <Fuel size={19} />
          </div>

          <div>
            <span>
              Fuel Products
            </span>

            <strong>
              {products.length}
            </strong>
          </div>
        </div>

        <div className="gr-overview-card">
          <div className="gr-overview-icon">
            <AlertCircle size={19} />
          </div>

          <div>
            <span>
              Voided Sales
            </span>

            <strong>
              {stats.voided}
            </strong>
          </div>
        </div>
      </div>

      {/* SUMMARY GRID */}
      <div className="gr-summary-grid">
        {/* FUEL SUMMARY */}
        <section className="gr-panel">
          <div className="gr-panel-header">
            <div>
              <div className="gr-section-label">
                FUEL PERFORMANCE
              </div>

              <h2>
                Sales by Fuel
              </h2>

              <p>
                Revenue and volume
                generated by each fuel
                product.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="gr-loading">
              <RefreshCw
                size={20}
                className="gr-spin"
              />

              Loading report...
            </div>
          ) : fuelSummary.length ===
            0 ? (
            <div className="gr-empty">
              <Fuel size={25} />

              <strong>
                No fuel sales found
              </strong>

              <span>
                No completed fuel
                sales match the
                selected filters.
              </span>
            </div>
          ) : (
            <div className="gr-summary-list">
              {fuelSummary.map(
                (row) => (
                  <div
                    className="gr-summary-row"
                    key={row.id}
                  >
                    <div className="gr-summary-main">
                      <div className="gr-summary-mark">
                        <Fuel size={16} />
                      </div>

                      <div>
                        <strong>
                          {row.name}
                        </strong>

                        <span>
                          {
                            row.transactions
                          }{" "}
                          transaction
                          {row.transactions ===
                          1
                            ? ""
                            : "s"}
                        </span>
                      </div>
                    </div>

                    <div className="gr-summary-metrics">
                      <div>
                        <span>
                          Litres
                        </span>

                        <strong>
                          {litres(
                            row.litres
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Revenue
                        </span>

                        <strong>
                          {money(
                            row.revenue,
                            currency
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Avg / L
                        </span>

                        <strong>
                          {money(
                            row.averagePrice,
                            currency
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {/* PUMP SUMMARY */}
        <section className="gr-panel">
          <div className="gr-panel-header">
            <div>
              <div className="gr-section-label">
                PUMP PERFORMANCE
              </div>

              <h2>
                Sales by Pump
              </h2>

              <p>
                Compare volume and
                revenue across station
                pumps.
              </p>
            </div>
          </div>

          {pumpSummary.length ===
          0 ? (
            <div className="gr-empty">
              <Gauge size={25} />

              <strong>
                No pump activity
              </strong>

              <span>
                No completed sales
                were found for the
                selected period.
              </span>
            </div>
          ) : (
            <div className="gr-summary-list">
              {pumpSummary.map(
                (row) => (
                  <div
                    className="gr-summary-row"
                    key={row.id}
                  >
                    <div className="gr-summary-main">
                      <div className="gr-summary-mark">
                        <Gauge size={16} />
                      </div>

                      <div>
                        <strong>
                          {row.name}
                        </strong>

                        <span>
                          {
                            row.transactions
                          }{" "}
                          transaction
                          {row.transactions ===
                          1
                            ? ""
                            : "s"}
                        </span>
                      </div>
                    </div>

                    <div className="gr-summary-metrics">
                      <div>
                        <span>
                          Litres
                        </span>

                        <strong>
                          {litres(
                            row.litres
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Revenue
                        </span>

                        <strong>
                          {money(
                            row.revenue,
                            currency
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>

      {/* ATTENDANT + PAYMENT */}
      <div className="gr-summary-grid">
        <section className="gr-panel">
          <div className="gr-panel-header">
            <div>
              <div className="gr-section-label">
                ATTENDANT PERFORMANCE
              </div>

              <h2>
                Sales by Attendant
              </h2>

              <p>
                Fuel volume and revenue
                recorded by attendant.
              </p>
            </div>
          </div>

          {attendantSummary.length ===
          0 ? (
            <div className="gr-empty">
              <Users size={25} />

              <strong>
                No attendant activity
              </strong>

              <span>
                No completed sales
                were found.
              </span>
            </div>
          ) : (
            <div className="gr-summary-list">
              {attendantSummary.map(
                (row) => (
                  <div
                    className="gr-summary-row"
                    key={row.id}
                  >
                    <div className="gr-summary-main">
                      <div className="gr-summary-avatar">
                        {row.name
                          .split(" ")
                          .map(
                            (part) =>
                              part[0]
                          )
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>

                      <div>
                        <strong>
                          {row.name}
                        </strong>

                        <span>
                          {
                            row.transactions
                          }{" "}
                          transaction
                          {row.transactions ===
                          1
                            ? ""
                            : "s"}
                        </span>
                      </div>
                    </div>

                    <div className="gr-summary-metrics">
                      <div>
                        <span>
                          Litres
                        </span>

                        <strong>
                          {litres(
                            row.litres
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Revenue
                        </span>

                        <strong>
                          {money(
                            row.revenue,
                            currency
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        <section className="gr-panel">
          <div className="gr-panel-header">
            <div>
              <div className="gr-section-label">
                PAYMENT ANALYSIS
              </div>

              <h2>
                Sales by Payment
              </h2>

              <p>
                Revenue collected
                through each payment
                method.
              </p>
            </div>
          </div>

          {paymentSummary.length ===
          0 ? (
            <div className="gr-empty">
              <CircleDollarSign
                size={25}
              />

              <strong>
                No payment activity
              </strong>

              <span>
                No completed sales
                were found.
              </span>
            </div>
          ) : (
            <div className="gr-payment-list">
              {paymentSummary.map(
                (row) => (
                  <div
                    className="gr-payment-row"
                    key={row.method}
                  >
                    <div>
                      <strong>
                        {paymentLabel(
                          row.method
                        )}
                      </strong>

                      <span>
                        {
                          row.transactions
                        }{" "}
                        transaction
                        {row.transactions ===
                        1
                          ? ""
                          : "s"}
                      </span>
                    </div>

                    <div>
                      <strong>
                        {money(
                          row.revenue,
                          currency
                        )}
                      </strong>

                      <span>
                        {litres(
                          row.litres
                        )}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>

      {/* DETAILED LEDGER */}
      <section className="gr-panel gr-ledger-panel">
        <div className="gr-panel-header gr-ledger-header">
          <div>
            <div className="gr-section-label">
              DETAILED SALES LEDGER
            </div>

            <h2>
              Fuel Sales Transactions
            </h2>

            <p>
              Detailed pump-level fuel
              sales recorded during the
              selected reporting period.
            </p>
          </div>

          <div className="gr-record-count">
            {filteredSales.length}{" "}
            record
            {filteredSales.length ===
            1
              ? ""
              : "s"}
          </div>
        </div>

        {loading ? (
          <div className="gr-loading">
            <RefreshCw
              size={20}
              className="gr-spin"
            />

            Loading gas sales...
          </div>
        ) : filteredSales.length ===
          0 ? (
          <div className="gr-empty gr-empty-large">
            <Fuel size={28} />

            <strong>
              No fuel sales found
            </strong>

            <span>
              Try changing the reporting
              dates or filters.
            </span>
          </div>
        ) : (
          <div className="gr-table-wrap">
            <table className="gr-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Fuel</th>
                  <th>Pump</th>
                  <th>Attendant</th>
                  <th>Meter Reading</th>
                  <th>Litres</th>
                  <th>Price / L</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredSales.map(
                  (sale) => (
                    <tr
                      key={sale.id}
                    >
                      <td>
                        {formatDate(
                          sale.sale_date
                        )}
                      </td>

                      <td>
                        <div className="gr-fuel-cell">
                          <div className="gr-fuel-icon">
                            <Fuel
                              size={15}
                            />
                          </div>

                          <div>
                            <strong>
                              {productName(
                                sale.product
                              )}
                            </strong>

                            <span>
                              {sale.product
                                ?.code ||
                                "Fuel product"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <strong>
                          {pumpName(
                            sale.pump
                          )}
                        </strong>
                      </td>

                      <td>
                        {attendantName(
                          sale.attendant
                        )}
                      </td>

                      <td>
                        <div className="gr-meter-cell">
                          <span>
                            {
                              sale.opening_meter
                            }
                          </span>

                          <b>→</b>

                          <span>
                            {
                              sale.closing_meter
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {litres(
                          sale.litres_sold
                        )}
                      </td>

                      <td>
                        {money(
                          sale.price_per_litre,
                          currency
                        )}
                      </td>

                      <td>
                        <strong>
                          {money(
                            sale.total_amount,
                            currency
                          )}
                        </strong>
                      </td>

                      <td>
                        {paymentLabel(
                          sale.payment_method
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
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}

        {filteredSales.length >
          0 && (
          <div className="gr-table-footer">
            <div>
              <span>
                Total litres
              </span>

              <strong>
                {litres(
                  stats.totalLitres
                )}
              </strong>
            </div>

            <div>
              <span>
                Total revenue
              </span>

              <strong>
                {money(
                  stats.totalRevenue,
                  currency
                )}
              </strong>
            </div>

            <div>
              <span>
                Transactions
              </span>

              <strong>
                {stats.totalTransactions}
              </strong>
            </div>
          </div>
        )}
      </section>

      {/* REPORT FOOTER */}
      <div className="gr-report-footer">
        <div>
          <strong>
            Gas Reports
          </strong>

          <span>
            {companyName}
          </span>
        </div>

        <span>
          Period:{" "}
          {dateFrom
            ? formatDate(dateFrom)
            : "All dates"}{" "}
          —{" "}
          {dateTo
            ? formatDate(dateTo)
            : "All dates"}
        </span>
      </div>
    </div>
  );
}