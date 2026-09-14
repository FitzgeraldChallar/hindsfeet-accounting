import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Package,
  RefreshCw,
  Search,
  ShoppingCart,
  X,
} from "lucide-react";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";

function extractList(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

function formatMoney(value, currency = "USD") {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))} ${currency}`;
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

function getStatusLabel(status) {
  const labels = {
    DRAFT: "Draft",
    POSTED: "Posted",
    VOIDED: "Voided",
  };

  return labels[status] || status || "Unknown";
}

function getStatusClass(status) {
  return String(status || "unknown").toLowerCase();
}

export default function PurchaseReports() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;
  const companyName =
    currentCompany?.name || "Current Company";
  const currency =
    currentCompany?.currency || "USD";

  const [bills, setBills] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedBill, setSelectedBill] =
    useState(null);

  const loadData = useCallback(
    async (refresh = false) => {
      if (!companyId) {
        setBills([]);
        setSuppliers([]);
        setLoading(false);
        return;
      }

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const [
          billsResponse,
          suppliersResponse,
        ] = await Promise.all([
          api.get(
            `/api/invoicing/supplier-bills/?company=${companyId}`
          ),
          api.get(
            `/api/invoicing/suppliers/?company=${companyId}`
          ),
        ]);

        setBills(
          extractList(billsResponse)
        );

        setSuppliers(
          extractList(suppliersResponse)
        );
      } catch (err) {
        setError(
          err?.data?.detail ||
            err?.message ||
            "Unable to load purchase reports."
        );
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

  const supplierById = useMemo(() => {
    const map = {};

    suppliers.forEach((supplier) => {
      map[supplier.id] = supplier;
    });

    return map;
  }, [suppliers]);

  const filteredBills = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return bills.filter((bill) => {
      const supplier =
        supplierById[bill.supplier];

      const supplierName =
        supplier?.name || "";

      const searchableText = [
        bill.bill_number,
        bill.reference,
        bill.notes,
        supplierName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query ||
        searchableText.includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        bill.status === statusFilter;

      const billDate = bill.bill_date
        ? new Date(
            `${bill.bill_date}T00:00:00`
          )
        : null;

      const matchesFrom =
        !dateFrom ||
        (
          billDate &&
          billDate >=
            new Date(
              `${dateFrom}T00:00:00`
            )
        );

      const matchesTo =
        !dateTo ||
        (
          billDate &&
          billDate <=
            new Date(
              `${dateTo}T23:59:59`
            )
        );

      return (
        matchesSearch &&
        matchesStatus &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [
    bills,
    supplierById,
    search,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  const stats = useMemo(() => {
    const posted = bills.filter(
      (bill) => bill.status === "POSTED"
    );

    const draft = bills.filter(
      (bill) => bill.status === "DRAFT"
    );

    const voided = bills.filter(
      (bill) => bill.status === "VOIDED"
    );

    const totalPurchaseValue =
      posted.reduce(
        (sum, bill) =>
          sum +
          Number(
            bill.total_amount || 0
          ),
        0
      );

    const outstandingAmount =
      posted.reduce(
        (sum, bill) =>
          sum +
          Number(
            bill.balance_due || 0
          ),
        0
      );

    return {
      total: bills.length,
      posted: posted.length,
      draft: draft.length,
      voided: voided.length,
      totalPurchaseValue,
      outstandingAmount,
    };
  }, [bills]);

  const supplierSummary = useMemo(() => {
    const summary = {};

    bills
      .filter(
        (bill) =>
          bill.status !== "VOIDED"
      )
      .forEach((bill) => {
        const supplierId =
          bill.supplier;

        const supplier =
          supplierById[supplierId];

        if (!summary[supplierId]) {
          summary[supplierId] = {
            id: supplierId,
            name:
              supplier?.name ||
              `Supplier #${supplierId}`,
            transactions: 0,
            purchaseValue: 0,
            outstanding: 0,
          };
        }

        summary[supplierId].transactions += 1;

        summary[supplierId].purchaseValue +=
          Number(
            bill.total_amount || 0
          );

        summary[supplierId].outstanding +=
          Number(
            bill.balance_due || 0
          );
      });

    return Object.values(summary).sort(
      (a, b) =>
        b.purchaseValue -
        a.purchaseValue
    );
  }, [bills, supplierById]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters =
    Boolean(search) ||
    statusFilter !== "ALL" ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  if (!companyId) {
    return (
      <div className="purchase-reports-page">
        <div className="purchase-reports-empty-company">
          <ShoppingCart size={30} />

          <h2>
            No Company Selected
          </h2>

          <p>
            Select a company to view
            purchase reports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="purchase-reports-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="purchase-reports-header">
        <div>
          <div className="purchase-reports-eyebrow">
            REPORTS / PURCHASES
          </div>

          <h1>
            Purchase Reports
          </h1>

          <p>
            Analyze supplier purchases,
            purchase activity and
            outstanding purchase balances.
          </p>
        </div>

        <button
          type="button"
          className="purchase-reports-refresh"
          onClick={() =>
            loadData(true)
          }
          disabled={
            loading || refreshing
          }
        >
          <RefreshCw
            size={16}
            className={
              refreshing
                ? "purchase-reports-spin"
                : ""
            }
          />

          Refresh
        </button>
      </div>

      {/* =====================================================
          COMPANY STRIP
      ===================================================== */}

      <div className="purchase-reports-company">
        <div className="purchase-reports-company-mark">
          {companyName
            .slice(0, 1)
            .toUpperCase()}
        </div>

        <div>
          <span>
            Reporting Company
          </span>

          <strong>
            {companyName}
          </strong>
        </div>

        <div className="purchase-reports-company-currency">
          <span>
            Currency
          </span>

          <strong>
            {currency}
          </strong>
        </div>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="purchase-reports-alert">
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

      {/* =====================================================
          KPI CARDS
      ===================================================== */}

      <div className="purchase-reports-kpi-grid">

        <div className="purchase-reports-kpi">
          <div className="purchase-reports-kpi-icon blue">
            <ShoppingCart size={19} />
          </div>

          <div>
            <span>
              Purchase Bills
            </span>

            <strong>
              {stats.total}
            </strong>

            <small>
              All purchase records
            </small>
          </div>
        </div>

        <div className="purchase-reports-kpi">
          <div className="purchase-reports-kpi-icon gold">
            <CheckCircle2 size={19} />
          </div>

          <div>
            <span>
              Posted Purchases
            </span>

            <strong>
              {stats.posted}
            </strong>

            <small>
              Posted supplier bills
            </small>
          </div>
        </div>

        <div className="purchase-reports-kpi">
          <div className="purchase-reports-kpi-icon navy">
            <Package size={19} />
          </div>

          <div>
            <span>
              Purchase Value
            </span>

            <strong>
              {formatMoney(
                stats.totalPurchaseValue,
                currency
              )}
            </strong>

            <small>
              Posted purchase value
            </small>
          </div>
        </div>

        <div className="purchase-reports-kpi">
          <div className="purchase-reports-kpi-icon dark">
            <FileText size={19} />
          </div>

          <div>
            <span>
              Outstanding
            </span>

            <strong>
              {formatMoney(
                stats.outstandingAmount,
                currency
              )}
            </strong>

            <small>
              Remaining supplier balances
            </small>
          </div>
        </div>

      </div>

      {/* =====================================================
          FILTERS
      ===================================================== */}

      <section className="purchase-reports-filter-card">

        <div className="purchase-reports-filter-header">
          <div>
            <div className="purchase-reports-section-label">
              PURCHASE ACTIVITY
            </div>

            <h2>
              Filter Purchase Reports
            </h2>

            <p>
              Narrow the report by supplier
              activity, status or date.
            </p>
          </div>

          {hasFilters && (
            <button
              type="button"
              className="purchase-reports-clear"
              onClick={clearFilters}
            >
              <X size={14} />
              Clear Filters
            </button>
          )}
        </div>

        <div className="purchase-reports-filters">

          <label>
            <span>
              Search
            </span>

            <div className="purchase-reports-search">
              <Search size={16} />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Bill number, supplier..."
              />
            </div>
          </label>

          <label>
            <span>
              Status
            </span>

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

              <option value="POSTED">
                Posted
              </option>

              <option value="DRAFT">
                Draft
              </option>

              <option value="VOIDED">
                Voided
              </option>
            </select>
          </label>

          <label>
            <span>
              From
            </span>

            <div className="purchase-reports-date">
              <CalendarDays size={15} />

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
              To
            </span>

            <div className="purchase-reports-date">
              <CalendarDays size={15} />

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

      {/* =====================================================
          PURCHASE REPORT
      ===================================================== */}

      <section className="purchase-reports-panel">

        <div className="purchase-reports-panel-header">
          <div>
            <div className="purchase-reports-section-label">
              PURCHASE REPORT
            </div>

            <h2>
              Purchase Transactions
            </h2>

            <p>
              Supplier bills and purchase
              activity for the selected
              company.
            </p>
          </div>

          <div className="purchase-reports-result-count">
            {filteredBills.length}{" "}
            record
            {filteredBills.length === 1
              ? ""
              : "s"}
          </div>
        </div>

        {loading ? (
          <div className="purchase-reports-loading">
            <RefreshCw
              size={21}
              className="purchase-reports-spin"
            />

            Loading purchase reports...
          </div>
        ) : filteredBills.length ===
          0 ? (
          <div className="purchase-reports-empty">
            <ClipboardList size={28} />

            <strong>
              No purchase records found
            </strong>

            <span>
              Try changing the selected
              filters.
            </span>
          </div>
        ) : (
          <div className="purchase-reports-table-wrap">
            <table className="purchase-reports-table">
              <thead>
                <tr>
                  <th>
                    Purchase Bill
                  </th>

                  <th>
                    Supplier
                  </th>

                  <th>
                    Bill Date
                  </th>

                  <th>
                    Due Date
                  </th>

                  <th>
                    Amount
                  </th>

                  <th>
                    Balance Due
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredBills.map(
                  (bill) => {
                    const supplier =
                      supplierById[
                        bill.supplier
                      ];

                    return (
                      <tr
                        key={bill.id}
                      >
                        <td>
                          <div className="purchase-reports-primary-cell">
                            <div className="purchase-reports-row-icon">
                              <FileText
                                size={17}
                              />
                            </div>

                            <div>
                              <strong>
                                {bill.bill_number ||
                                  `Bill #${bill.id}`}
                              </strong>

                              <span>
                                Supplier bill
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <strong>
                            {supplier?.name ||
                              `Supplier #${bill.supplier}`}
                          </strong>
                        </td>

                        <td>
                          {formatDate(
                            bill.bill_date
                          )}
                        </td>

                        <td>
                          {formatDate(
                            bill.due_date
                          )}
                        </td>

                        <td>
                          <strong>
                            {formatMoney(
                              bill.total_amount,
                              currency
                            )}
                          </strong>
                        </td>

                        <td>
                          {formatMoney(
                            bill.balance_due,
                            currency
                          )}
                        </td>

                        <td>
                          <span
                            className={`purchase-reports-status purchase-reports-status-${getStatusClass(
                              bill.status
                            )}`}
                          >
                            {getStatusLabel(
                              bill.status
                            )}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="purchase-reports-view-btn"
                            onClick={() =>
                              setSelectedBill(
                                bill
                              )
                            }
                          >
                            <FileText
                              size={15}
                            />

                            View
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* =====================================================
          SUPPLIER SUMMARY
      ===================================================== */}

      <section className="purchase-reports-panel">

        <div className="purchase-reports-panel-header">
          <div>
            <div className="purchase-reports-section-label">
              SUPPLIER ANALYSIS
            </div>

            <h2>
              Supplier Purchase Summary
            </h2>

            <p>
              Purchase volume and outstanding
              balances by supplier.
            </p>
          </div>
        </div>

        {supplierSummary.length ===
        0 ? (
          <div className="purchase-reports-empty compact">
            <Package size={26} />

            <strong>
              No supplier purchase data
            </strong>
          </div>
        ) : (
          <div className="purchase-reports-table-wrap">
            <table className="purchase-reports-table">
              <thead>
                <tr>
                  <th>
                    Supplier
                  </th>

                  <th>
                    Transactions
                  </th>

                  <th>
                    Purchase Value
                  </th>

                  <th>
                    Outstanding
                  </th>
                </tr>
              </thead>

              <tbody>
                {supplierSummary.map(
                  (supplier) => (
                    <tr
                      key={supplier.id}
                    >
                      <td>
                        <strong>
                          {supplier.name}
                        </strong>
                      </td>

                      <td>
                        {supplier.transactions}
                      </td>

                      <td>
                        <strong>
                          {formatMoney(
                            supplier.purchaseValue,
                            currency
                          )}
                        </strong>
                      </td>

                      <td>
                        {formatMoney(
                          supplier.outstanding,
                          currency
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

      {/* =====================================================
          BILL DETAILS MODAL
      ===================================================== */}

      {selectedBill && (
        <div
          className="purchase-reports-modal-backdrop"
          onMouseDown={() =>
            setSelectedBill(null)
          }
        >
          <div
            className="purchase-reports-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="purchase-reports-modal-header">
              <div>
                <div className="purchase-reports-section-label">
                  PURCHASE BILL
                </div>

                <h2>
                  {selectedBill.bill_number ||
                    `Bill #${selectedBill.id}`}
                </h2>
              </div>

              <button
                type="button"
                className="purchase-reports-modal-close"
                onClick={() =>
                  setSelectedBill(null)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="purchase-reports-detail-grid">

              <div>
                <span>
                  Supplier
                </span>

                <strong>
                  {supplierById[
                    selectedBill.supplier
                  ]?.name ||
                    `Supplier #${selectedBill.supplier}`}
                </strong>
              </div>

              <div>
                <span>
                  Status
                </span>

                <strong>
                  {getStatusLabel(
                    selectedBill.status
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Bill Date
                </span>

                <strong>
                  {formatDate(
                    selectedBill.bill_date
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Due Date
                </span>

                <strong>
                  {formatDate(
                    selectedBill.due_date
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Total Amount
                </span>

                <strong>
                  {formatMoney(
                    selectedBill.total_amount,
                    currency
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Balance Due
                </span>

                <strong>
                  {formatMoney(
                    selectedBill.balance_due,
                    currency
                  )}
                </strong>
              </div>

            </div>

            {selectedBill.notes && (
              <div className="purchase-reports-notes">
                <span>
                  Notes
                </span>

                <p>
                  {selectedBill.notes}
                </p>
              </div>
            )}

            <div className="purchase-reports-modal-footer">
              <button
                type="button"
                className="purchase-reports-secondary-btn"
                onClick={() =>
                  setSelectedBill(null)
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}