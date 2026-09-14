import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Download,
  FileBarChart,
  FileText,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

import { api, API_BASE_URL } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";

function formatMoney(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function formatDate(date) {
  if (!date) {
    return "";
  }

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function labelAccountType(type) {
  if (!type) {
    return "—";
  }

  return type
    .toLowerCase()
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

export default function IncomeStatement() {
  const { currentCompany } = useCompany();

  const [report, setReport] = useState(null);

  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("ALL");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const companyId = currentCompany?.id;
  const companyName =
    report?.company_name ||
    currentCompany?.name ||
    "Selected Company";

  const currency =
    currentCompany?.currency ||
    report?.currency ||
    "USD";

  /* ============================================================
     LOAD REPORT
     ============================================================ */

  const loadReport = async () => {
    if (!companyId) {
      setReport(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const params = new URLSearchParams();

      params.set("company", companyId);

      if (dateFrom) {
        params.set("start_date", dateFrom);
      }

      if (dateTo) {
        params.set("end_date", dateTo);
      }

      const response = await api.get(
        `/api/accounting/reports/income-statement/?${params.toString()}`
      );

      setReport(response);
    } catch (err) {
      setReport(null);

      setError(
        err?.data?.detail ||
          err?.message ||
          "Unable to load the income statement."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [companyId]);

  /* ============================================================
     REPORT DATA
     ============================================================ */

  const revenue = Array.isArray(report?.revenue)
    ? report.revenue
    : [];

  const cogs = Array.isArray(
    report?.cost_of_goods_sold
  )
    ? report.cost_of_goods_sold
    : [];

  const expenses = Array.isArray(report?.expenses)
    ? report.expenses
    : [];

  const totalRevenue = Number(
    report?.total_revenue || 0
  );

  const totalCogs = Number(
    report?.total_cost_of_goods_sold || 0
  );

  const grossProfit = Number(
    report?.gross_profit || 0
  );

  const totalExpenses = Number(
    report?.total_expenses || 0
  );

  const netProfit = Number(
    report?.net_profit || 0
  );

  const isProfitable =
    Boolean(report?.is_profitable) &&
    netProfit > 0;

  /* ============================================================
     FILTERING
     ============================================================ */

  const filteredRevenue = useMemo(() => {
    const query = search.trim().toLowerCase();

    return revenue.filter((item) => {
      if (sectionFilter !== "ALL" &&
          sectionFilter !== "REVENUE") {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        String(item.code || "")
          .toLowerCase()
          .includes(query) ||
        String(item.name || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [revenue, search, sectionFilter]);

  const filteredCogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return cogs.filter((item) => {
      if (sectionFilter !== "ALL" &&
          sectionFilter !== "COGS") {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        String(item.code || "")
          .toLowerCase()
          .includes(query) ||
        String(item.name || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [cogs, search, sectionFilter]);

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return expenses.filter((item) => {
      if (sectionFilter !== "ALL" &&
          sectionFilter !== "EXPENSE") {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        String(item.code || "")
          .toLowerCase()
          .includes(query) ||
        String(item.name || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [expenses, search, sectionFilter]);

  const displayedAccountCount =
    filteredRevenue.length +
    filteredCogs.length +
    filteredExpenses.length;

  const hasFilters =
    Boolean(search) ||
    sectionFilter !== "ALL" ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  /* ============================================================
     CLEAR FILTERS
     ============================================================ */

  const clearFilters = () => {
    setSearch("");
    setSectionFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  /* ============================================================
     APPLY DATE FILTER
     ============================================================ */

  const applyDateFilter = async () => {
    if (
      dateFrom &&
      dateTo &&
      dateFrom > dateTo
    ) {
      setError(
        "The From Date cannot be later than the To Date."
      );

      return;
    }

    await loadReport();
  };

  /* ============================================================
     CSV EXPORT
     ============================================================ */

  const exportCsv = () => {
    if (!report) {
      return;
    }

    const rows = [
      [
        "Section",
        "Account Code",
        "Account",
        "Amount",
      ],
    ];

    revenue.forEach((item) => {
      rows.push([
        "Revenue",
        item.code || "",
        item.name || "",
        Number(item.amount || 0).toFixed(2),
      ]);
    });

    cogs.forEach((item) => {
      rows.push([
        "Cost of Goods Sold",
        item.code || "",
        item.name || "",
        Number(item.amount || 0).toFixed(2),
      ]);
    });

    expenses.forEach((item) => {
      rows.push([
        "Operating Expense",
        item.code || "",
        item.name || "",
        Number(item.amount || 0).toFixed(2),
      ]);
    });

    rows.push([]);
    rows.push([
      "SUMMARY",
      "",
      "Total Revenue",
      totalRevenue.toFixed(2),
    ]);

    rows.push([
      "",
      "",
      "Cost of Goods Sold",
      totalCogs.toFixed(2),
    ]);

    rows.push([
      "",
      "",
      "Gross Profit",
      grossProfit.toFixed(2),
    ]);

    rows.push([
      "",
      "",
      "Operating Expenses",
      totalExpenses.toFixed(2),
    ]);

    rows.push([
      "",
      "",
      "Net Profit / Loss",
      netProfit.toFixed(2),
    ]);

    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");

            if (
              text.includes(",") ||
              text.includes('"') ||
              text.includes("\n")
            ) {
              return `"${text.replace(
                /"/g,
                '""'
              )}"`;
            }

            return text;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = `income-statement-${companyName
      .replace(/\s+/g, "-")
      .toLowerCase()}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    setSuccess(
      "Income Statement CSV exported successfully."
    );
  };

  /* ============================================================
     PDF EXPORT
     ============================================================ */

  const downloadPdf = async () => {
    if (!companyId) {
      return;
    }

    try {
      setDownloadingPdf(true);
      setError("");
      setSuccess("");

      const token =
        localStorage.getItem("access_token");

      const params = new URLSearchParams();

      params.set("company", companyId);

      if (dateFrom) {
        params.set("start_date", dateFrom);
      }

      if (dateTo) {
        params.set("end_date", dateTo);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/accounting/reports/income-statement/pdf/?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        let message =
          "Unable to download the Income Statement PDF.";

        try {
          const data = await response.json();

          message =
            data?.detail ||
            data?.message ||
            message;
        } catch {
          // Keep default message.
        }

        throw new Error(message);
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        `income-statement-${companyName
          .replace(/\s+/g, "-")
          .toLowerCase()}.pdf`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      setSuccess(
        "Income Statement PDF downloaded successfully."
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to download the Income Statement PDF."
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div className="accounting-income-page">

      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="income-page-header">
        <div>
          <div className="income-eyebrow">
            <BarChart3 size={15} />
            ACCOUNTING
          </div>

          <h1>Income Statement</h1>

          <p>
            Review revenue, cost of goods sold,
            operating expenses, and profitability.
          </p>
        </div>

        <div className="income-header-actions">
          <button
            type="button"
            className="income-secondary-button"
            onClick={exportCsv}
            disabled={!report || loading}
          >
            <Download size={16} />
            Export CSV
          </button>

          <button
            type="button"
            className="income-primary-button"
            onClick={downloadPdf}
            disabled={
              !report ||
              loading ||
              downloadingPdf
            }
          >
            {downloadingPdf ? (
              <RefreshCw
                size={16}
                className="income-spin"
              />
            ) : (
              <FileText size={16} />
            )}

            {downloadingPdf
              ? "Downloading..."
              : "Download PDF"}
          </button>
        </div>
      </div>

      {/* ======================================================
          COMPANY STRIP
          ====================================================== */}

      <div className="income-company-strip">
        <div>
          <span>REPORTING ENTITY</span>

          <strong>{companyName}</strong>
        </div>

        <div>
          <span>CURRENCY</span>

          <strong>{currency}</strong>
        </div>

        <div>
          <span>REPORT PERIOD</span>

          <strong>
            {dateFrom || dateTo
              ? `${dateFrom
                  ? formatDate(dateFrom)
                  : "Beginning"} — ${
                  dateTo
                    ? formatDate(dateTo)
                    : "Current"
                }`
              : "All posted activity"}
          </strong>
        </div>
      </div>

      {/* ======================================================
          ALERTS
          ====================================================== */}

      {error && (
        <div className="income-alert income-alert-error">
          <AlertCircle size={17} />

          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {success && (
        <div className="income-alert income-alert-success">
          <CheckCircle2 size={17} />

          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="Dismiss success message"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ======================================================
          KPI CARDS
          ====================================================== */}

      <div className="income-kpi-grid">

        <div className="income-kpi-card">
          <div className="income-kpi-icon income-kpi-blue">
            <TrendingUp size={19} />
          </div>

          <div>
            <span>Total Revenue</span>

            <strong>
              {currency}{" "}
              {formatMoney(totalRevenue)}
            </strong>

            <small>
              {revenue.length} revenue account
              {revenue.length === 1
                ? ""
                : "s"}
            </small>
          </div>
        </div>

        <div className="income-kpi-card">
          <div className="income-kpi-icon income-kpi-gold">
            <FileBarChart size={19} />
          </div>

          <div>
            <span>Gross Profit</span>

            <strong>
              {currency}{" "}
              {formatMoney(grossProfit)}
            </strong>

            <small>
              Revenue less COGS
            </small>
          </div>
        </div>

        <div className="income-kpi-card">
          <div className="income-kpi-icon income-kpi-slate">
            <TrendingDown size={19} />
          </div>

          <div>
            <span>Operating Expenses</span>

            <strong>
              {currency}{" "}
              {formatMoney(totalExpenses)}
            </strong>

            <small>
              {expenses.length} expense account
              {expenses.length === 1
                ? ""
                : "s"}
            </small>
          </div>
        </div>

        <div
          className={`income-kpi-card ${
            isProfitable
              ? "income-kpi-profit"
              : "income-kpi-loss"
          }`}
        >
          <div className="income-kpi-icon income-kpi-status">
            {isProfitable ? (
              <CheckCircle2 size={19} />
            ) : (
              <AlertCircle size={19} />
            )}
          </div>

          <div>
            <span>
              {netProfit >= 0
                ? "Net Profit"
                : "Net Loss"}
            </span>

            <strong>
              {currency}{" "}
              {formatMoney(
                Math.abs(netProfit)
              )}
            </strong>

            <small>
              {isProfitable
                ? "Business is profitable"
                : netProfit === 0
                ? "Break-even result"
                : "Expenses exceed gross profit"}
            </small>
          </div>
        </div>
      </div>

      {/* ======================================================
          FILTERS
          ====================================================== */}

      <div className="income-filter-card">

        <div className="income-filter-heading">
          <div>
            <h2>Income Statement Filters</h2>

            <p>
              Narrow the report by account,
              section, or reporting period.
            </p>
          </div>
        </div>

        <div className="income-filter-grid">

          <div className="income-search-box">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search account code or name..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="income-select-filter">
            <label>SECTION</label>

            <select
              value={sectionFilter}
              onChange={(event) =>
                setSectionFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All Sections
              </option>

              <option value="REVENUE">
                Revenue
              </option>

              <option value="COGS">
                Cost of Goods Sold
              </option>

              <option value="EXPENSE">
                Operating Expenses
              </option>
            </select>
          </div>

          <div className="income-date-filter">
            <label>FROM DATE</label>

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

          <div className="income-date-filter">
            <label>TO DATE</label>

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

          <div className="income-filter-actions">

            <button
              type="button"
              className="income-apply-button"
              onClick={applyDateFilter}
              disabled={loading}
            >
              <RefreshCw size={15} />
              Apply
            </button>

            {hasFilters && (
              <button
                type="button"
                className="income-clear-button"
                onClick={clearFilters}
              >
                Clear
              </button>
            )}

          </div>
        </div>
      </div>

      {/* ======================================================
          REPORT
          ====================================================== */}

      <div className="income-report-card">

        <div className="income-report-header">
          <div>
            <div className="income-report-icon">
              <FileBarChart size={20} />
            </div>

            <div>
              <h2>Statement of Income</h2>

              <p>
                {displayedAccountCount} account
                {displayedAccountCount === 1
                  ? ""
                  : "s"} displayed
              </p>
            </div>
          </div>

          <div className="income-report-company">
            {companyName}
          </div>
        </div>

        {loading ? (
          <div className="income-loading">
            <RefreshCw
              size={24}
              className="income-spin"
            />

            <span>
              Loading income statement...
            </span>
          </div>
        ) : !report ? (
          <div className="income-empty">
            <div className="income-empty-icon">
              <FileBarChart size={26} />
            </div>

            <h3>
              Income statement unavailable
            </h3>

            <p>
              The report could not be loaded
              for the selected company.
            </p>
          </div>
        ) : (
          <div className="income-statement-content">

            {/* ==================================================
                REVENUE
                ================================================== */}

            {(sectionFilter === "ALL" ||
              sectionFilter === "REVENUE") && (
              <section className="income-section">

                <div className="income-section-heading">
                  <div>
                    <span className="income-section-number">
                      01
                    </span>

                    <div>
                      <h3>Revenue</h3>

                      <p>
                        Income generated from
                        business activities
                      </p>
                    </div>
                  </div>

                  <strong>
                    {currency}{" "}
                    {formatMoney(
                      totalRevenue
                    )}
                  </strong>
                </div>

                {filteredRevenue.length > 0 ? (
                  <div className="income-table-wrapper">
                    <table className="income-table">
                      <thead>
                        <tr>
                          <th>Account Code</th>
                          <th>Revenue Account</th>
                          <th>Type</th>
                          <th>Amount</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredRevenue.map(
                          (item) => (
                            <tr
                              key={`revenue-${item.account}`}
                            >
                              <td>
                                <span className="income-account-code">
                                  {item.code}
                                </span>
                              </td>

                              <td>
                                <strong>
                                  {item.name}
                                </strong>
                              </td>

                              <td>
                                <span className="income-type-badge income-type-revenue">
                                  Revenue
                                </span>
                              </td>

                              <td className="income-amount">
                                {currency}{" "}
                                {formatMoney(
                                  item.amount
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>

                      <tfoot>
                        <tr>
                          <td
                            colSpan={3}
                          >
                            Total Revenue
                          </td>

                          <td>
                            {currency}{" "}
                            {formatMoney(
                              totalRevenue
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="income-section-empty">
                    No revenue accounts match
                    the current filters.
                  </div>
                )}
              </section>
            )}

            {/* ==================================================
                COGS
                ================================================== */}

            {(sectionFilter === "ALL" ||
              sectionFilter === "COGS") && (
              <section className="income-section">

                <div className="income-section-heading">
                  <div>
                    <span className="income-section-number">
                      02
                    </span>

                    <div>
                      <h3>
                        Cost of Goods Sold
                      </h3>

                      <p>
                        Direct costs associated
                        with goods sold
                      </p>
                    </div>
                  </div>

                  <strong>
                    {currency}{" "}
                    {formatMoney(totalCogs)}
                  </strong>
                </div>

                {filteredCogs.length > 0 ? (
                  <div className="income-table-wrapper">
                    <table className="income-table">
                      <thead>
                        <tr>
                          <th>Account Code</th>
                          <th>Account</th>
                          <th>Type</th>
                          <th>Amount</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredCogs.map(
                          (item) => (
                            <tr
                              key={`cogs-${item.account}`}
                            >
                              <td>
                                <span className="income-account-code">
                                  {item.code}
                                </span>
                              </td>

                              <td>
                                <strong>
                                  {item.name}
                                </strong>
                              </td>

                              <td>
                                <span className="income-type-badge income-type-cogs">
                                  COGS
                                </span>
                              </td>

                              <td className="income-amount">
                                {currency}{" "}
                                {formatMoney(
                                  item.amount
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>

                      <tfoot>
                        <tr>
                          <td
                            colSpan={3}
                          >
                            Total Cost of Goods Sold
                          </td>

                          <td>
                            {currency}{" "}
                            {formatMoney(
                              totalCogs
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="income-section-empty">
                    No COGS accounts match the
                    current filters.
                  </div>
                )}
              </section>
            )}

            {/* ==================================================
                GROSS PROFIT
                ================================================== */}

            {sectionFilter === "ALL" && (
              <div className="income-calculation-card">

                <div>
                  <span>Gross Profit</span>

                  <small>
                    Total Revenue − Cost of
                    Goods Sold
                  </small>
                </div>

                <strong>
                  {currency}{" "}
                  {formatMoney(grossProfit)}
                </strong>
              </div>
            )}

            {/* ==================================================
                EXPENSES
                ================================================== */}

            {(sectionFilter === "ALL" ||
              sectionFilter === "EXPENSE") && (
              <section className="income-section">

                <div className="income-section-heading">
                  <div>
                    <span className="income-section-number">
                      03
                    </span>

                    <div>
                      <h3>
                        Operating Expenses
                      </h3>

                      <p>
                        Expenses incurred in
                        operating the business
                      </p>
                    </div>
                  </div>

                  <strong>
                    {currency}{" "}
                    {formatMoney(
                      totalExpenses
                    )}
                  </strong>
                </div>

                {filteredExpenses.length > 0 ? (
                  <div className="income-table-wrapper">
                    <table className="income-table">
                      <thead>
                        <tr>
                          <th>Account Code</th>
                          <th>Expense Account</th>
                          <th>Type</th>
                          <th>Amount</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredExpenses.map(
                          (item) => (
                            <tr
                              key={`expense-${item.account}`}
                            >
                              <td>
                                <span className="income-account-code">
                                  {item.code}
                                </span>
                              </td>

                              <td>
                                <strong>
                                  {item.name}
                                </strong>
                              </td>

                              <td>
                                <span className="income-type-badge income-type-expense">
                                  Expense
                                </span>
                              </td>

                              <td className="income-amount">
                                {currency}{" "}
                                {formatMoney(
                                  item.amount
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>

                      <tfoot>
                        <tr>
                          <td
                            colSpan={3}
                          >
                            Total Operating Expenses
                          </td>

                          <td>
                            {currency}{" "}
                            {formatMoney(
                              totalExpenses
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="income-section-empty">
                    No operating expense accounts
                    match the current filters.
                  </div>
                )}
              </section>
            )}

            {/* ==================================================
                NET PROFIT
                ================================================== */}

            {sectionFilter === "ALL" && (
              <div
                className={`income-net-profit ${
                  netProfit >= 0
                    ? "income-net-profit-positive"
                    : "income-net-profit-negative"
                }`}
              >
                <div>
                  <span>
                    {netProfit >= 0
                      ? "Net Profit"
                      : "Net Loss"}
                  </span>

                  <small>
                    Gross Profit − Operating
                    Expenses
                  </small>
                </div>

                <strong>
                  {currency}{" "}
                  {formatMoney(
                    Math.abs(netProfit)
                  )}
                </strong>
              </div>
            )}

            {/* ==================================================
                REPORT FOOTER
                ================================================== */}

            <div className="income-report-footer">

              <div>
                <FileText size={16} />

                <div>
                  <strong>
                    Income Statement Summary
                  </strong>

                  <span>
                    Based on posted accounting
                    journal entries for the
                    selected company and period.
                  </span>
                </div>
              </div>

              <div className="income-footer-status">
                {isProfitable ? (
                  <>
                    <CheckCircle2 size={16} />
                    Profitable
                  </>
                ) : netProfit === 0 ? (
                  <>
                    <AlertCircle size={16} />
                    Break-even
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} />
                    Loss Position
                  </>
                )}
              </div>

            </div>

          </div>
        )}
      </div>
    </div>
  );
}
