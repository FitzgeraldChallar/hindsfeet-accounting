import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileBarChart,
  FileText,
  RefreshCw,
  Search,
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

function sectionLabel(section) {
  if (section === "OPERATING") {
    return "Operating";
  }

  if (section === "INVESTING") {
    return "Investing";
  }

  if (section === "FINANCING") {
    return "Financing";
  }

  return section;
}

export default function CashFlowStatement() {
  const { currentCompany } = useCompany();

  const [report, setReport] = useState(null);

  const [search, setSearch] = useState("");
  const [activityFilter, setActivityFilter] =
    useState("ALL");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] =
    useState(false);

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

  const loadReport = async (
    from = dateFrom,
    to = dateTo
  ) => {
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

      if (from) {
        params.set("start_date", from);
      }

      if (to) {
        params.set("end_date", to);
      }

      const response = await api.get(
        `/api/accounting/reports/cash-flow/?${params.toString()}`
      );

      setReport(response);
    } catch (err) {
      setReport(null);

      setError(
        err?.data?.detail ||
          err?.message ||
          "Unable to load the cash flow statement."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport("", "");
  }, [companyId]);

  /* ============================================================
     REPORT DATA
     ============================================================ */

  const operating = Array.isArray(
    report?.operating_activities
  )
    ? report.operating_activities
    : [];

  const investing = Array.isArray(
    report?.investing_activities
  )
    ? report.investing_activities
    : [];

  const financing = Array.isArray(
    report?.financing_activities
  )
    ? report.financing_activities
    : [];

  const totalOperating = Number(
    report?.total_operating_activities || 0
  );

  const totalInvesting = Number(
    report?.total_investing_activities || 0
  );

  const totalFinancing = Number(
    report?.total_financing_activities || 0
  );

  const openingCash = Number(
    report?.opening_cash_balance || 0
  );

  const netChange = Number(
    report?.net_change_in_cash || 0
  );

  const closingCash = Number(
    report?.closing_cash_balance || 0
  );

  const actualClosingCash = Number(
    report?.actual_closing_cash || 0
  );

  const reconciliationDifference = Number(
    report?.reconciliation_difference || 0
  );

  const isReconciled =
    Boolean(report?.is_reconciled) ||
    Math.abs(reconciliationDifference) < 0.005;

  const totalActivities =
    operating.length +
    investing.length +
    financing.length;

  /* ============================================================
     FILTER ACTIVITIES
     ============================================================ */

  const filterActivities = (
    items,
    section
  ) => {
    const query = search
      .trim()
      .toLowerCase();

    if (
      activityFilter !== "ALL" &&
      activityFilter !== section
    ) {
      return [];
    }

    if (!query) {
      return items;
    }

    return items.filter((item) => {
      const searchable = [
        item.reference,
        item.description,
        item.date,
        item.cash_account_code,
        item.cash_account_name,
        item.journal_entry_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  };

  const filteredOperating = useMemo(
    () =>
      filterActivities(
        operating,
        "OPERATING"
      ),
    [
      operating,
      search,
      activityFilter,
    ]
  );

  const filteredInvesting = useMemo(
    () =>
      filterActivities(
        investing,
        "INVESTING"
      ),
    [
      investing,
      search,
      activityFilter,
    ]
  );

  const filteredFinancing = useMemo(
    () =>
      filterActivities(
        financing,
        "FINANCING"
      ),
    [
      financing,
      search,
      activityFilter,
    ]
  );

  const displayedActivities =
    filteredOperating.length +
    filteredInvesting.length +
    filteredFinancing.length;

  const hasFilters =
    Boolean(search) ||
    activityFilter !== "ALL" ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  /* ============================================================
     APPLY FILTERS
     ============================================================ */

  const applyFilters = () => {
    loadReport(dateFrom, dateTo);
  };

  /* ============================================================
     CLEAR FILTERS
     ============================================================ */

  const clearFilters = () => {
    setSearch("");
    setActivityFilter("ALL");
    setDateFrom("");
    setDateTo("");

    loadReport("", "");
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
        "Date",
        "Reference",
        "Description",
        "Cash Account",
        "Cash Account Code",
        "Amount",
      ],
    ];

    const addRows = (
      items,
      section
    ) => {
      items.forEach((item) => {
        rows.push([
          sectionLabel(section),
          item.date || "",
          item.reference || "",
          item.description || "",
          item.cash_account_name || "",
          item.cash_account_code || "",
          Number(
            item.amount || 0
          ).toFixed(2),
        ]);
      });
    };

    addRows(
      filteredOperating,
      "OPERATING"
    );

    addRows(
      filteredInvesting,
      "INVESTING"
    );

    addRows(
      filteredFinancing,
      "FINANCING"
    );

    rows.push([]);

    rows.push([
      "SUMMARY",
      "",
      "",
      "Opening Cash Balance",
      "",
      "",
      openingCash.toFixed(2),
    ]);

    rows.push([
      "",
      "",
      "",
      "Operating Activities",
      "",
      "",
      totalOperating.toFixed(2),
    ]);

    rows.push([
      "",
      "",
      "",
      "Investing Activities",
      "",
      "",
      totalInvesting.toFixed(2),
    ]);

    rows.push([
      "",
      "",
      "",
      "Financing Activities",
      "",
      "",
      totalFinancing.toFixed(2),
    ]);

    rows.push([
      "",
      "",
      "",
      "Net Change in Cash",
      "",
      "",
      netChange.toFixed(2),
    ]);

    rows.push([
      "",
      "",
      "",
      "Closing Cash Balance",
      "",
      "",
      closingCash.toFixed(2),
    ]);

    rows.push([
      "",
      "",
      "",
      "Actual Ledger Cash",
      "",
      "",
      actualClosingCash.toFixed(2),
    ]);

    rows.push([
      "",
      "",
      "",
      "Reconciliation Difference",
      "",
      "",
      reconciliationDifference.toFixed(
        2
      ),
    ]);

    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(
              value ?? ""
            );

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

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      `cash-flow-statement-${companyName
        .replace(/\s+/g, "-")
        .toLowerCase()}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    setSuccess(
      "Cash Flow Statement CSV exported successfully."
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
        localStorage.getItem(
          "access_token"
        );

      const params =
        new URLSearchParams();

      params.set(
        "company",
        companyId
      );

      if (dateFrom) {
        params.set(
          "start_date",
          dateFrom
        );
      }

      if (dateTo) {
        params.set(
          "end_date",
          dateTo
        );
      }

      const response =
        await fetch(
          `${API_BASE_URL}/api/accounting/reports/cash-flow/pdf/?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

      if (!response.ok) {
        let message =
          "Unable to download the Cash Flow Statement PDF.";

        try {
          const data =
            await response.json();

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
        `cash-flow-statement-${companyName
          .replace(/\s+/g, "-")
          .toLowerCase()}.pdf`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      setSuccess(
        "Cash Flow Statement PDF downloaded successfully."
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to download the Cash Flow Statement PDF."
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  /* ============================================================
     ACTIVITY SECTION
     ============================================================ */

  const renderActivitySection = ({
    number,
    title,
    description,
    items,
    total,
    typeClass,
    emptyMessage,
  }) => (
    <section className="cashflow-section">
      <div className="cashflow-section-heading">
        <div>
          <span className="cashflow-section-number">
            {number}
          </span>

          <div>
            <h3>{title}</h3>

            <p>{description}</p>
          </div>
        </div>

        <strong
          className={
            total < 0
              ? "cashflow-negative"
              : "cashflow-positive"
          }
        >
          {currency}{" "}
          {formatMoney(total)}
        </strong>
      </div>

      {items.length > 0 ? (
        <div className="cashflow-table-wrapper">
          <table className="cashflow-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Description</th>
                <th>Cash Account</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => (
                <tr
                  key={`${typeClass}-${item.journal_entry_id}`}
                >
                  <td>
                    {formatDate(item.date)}
                  </td>

                  <td>
                    <span className="cashflow-reference">
                      {item.reference ||
                        `JE-${item.journal_entry_id}`}
                    </span>
                  </td>

                  <td>
                    <strong>
                      {item.description ||
                        "Cash movement"}
                    </strong>
                  </td>

                  <td>
                    <div className="cashflow-account">
                      <strong>
                        {item.cash_account_name}
                      </strong>

                      <span>
                        {item.cash_account_code}
                      </span>
                    </div>
                  </td>

                  <td
                    className={`cashflow-amount ${
                      Number(item.amount || 0) <
                      0
                        ? "cashflow-negative"
                        : "cashflow-positive"
                    }`}
                  >
                    {Number(
                      item.amount || 0
                    ) < 0
                      ? `(${currency} ${formatMoney(
                          Math.abs(
                            Number(
                              item.amount ||
                                0
                            )
                          )
                        )})`
                      : `${currency} ${formatMoney(
                          item.amount
                        )}`}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr>
                <td colSpan={4}>
                  Net {title} Cash Flow
                </td>

                <td
                  className={
                    total < 0
                      ? "cashflow-negative"
                      : "cashflow-positive"
                  }
                >
                  {total < 0
                    ? `(${currency} ${formatMoney(
                        Math.abs(total)
                      )})`
                    : `${currency} ${formatMoney(
                        total
                      )}`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="cashflow-section-empty">
          {emptyMessage}
        </div>
      )}
    </section>
  );

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div className="accounting-cashflow-page">

      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="cashflow-page-header">
        <div>
          <div className="cashflow-eyebrow">
            <FileBarChart size={15} />
            ACCOUNTING
          </div>

          <h1>Cash Flow Statement</h1>

          <p>
            Review cash inflows and outflows
            across operating, investing, and
            financing activities.
          </p>
        </div>

        <div className="cashflow-header-actions">
          <button
            type="button"
            className="cashflow-secondary-button"
            onClick={exportCsv}
            disabled={
              !report || loading
            }
          >
            <Download size={16} />
            Export CSV
          </button>

          <button
            type="button"
            className="cashflow-primary-button"
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
                className="cashflow-spin"
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

      <div className="cashflow-company-strip">
        <div>
          <span>REPORTING ENTITY</span>

          <strong>
            {companyName}
          </strong>
        </div>

        <div>
          <span>CURRENCY</span>

          <strong>
            {currency}
          </strong>
        </div>

        <div>
          <span>REPORTING PERIOD</span>

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
        <div className="cashflow-alert cashflow-alert-error">
          <AlertCircle size={17} />

          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            aria-label="Dismiss error"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {success && (
        <div className="cashflow-alert cashflow-alert-success">
          <CheckCircle2 size={17} />

          <span>{success}</span>

          <button
            type="button"
            onClick={() =>
              setSuccess("")
            }
            aria-label="Dismiss success message"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ======================================================
          KPI CARDS
          ====================================================== */}

      <div className="cashflow-kpi-grid">

        <div className="cashflow-kpi-card">
          <div className="cashflow-kpi-icon cashflow-kpi-blue">
            <FileBarChart size={19} />
          </div>

          <div>
            <span>Opening Cash</span>

            <strong>
              {currency}{" "}
              {formatMoney(
                openingCash
              )}
            </strong>

            <small>
              Beginning of selected period
            </small>
          </div>
        </div>

        <div className="cashflow-kpi-card">
          <div className="cashflow-kpi-icon cashflow-kpi-gold">
            <FileText size={19} />
          </div>

          <div>
            <span>Net Change in Cash</span>

            <strong
              className={
                netChange < 0
                  ? "cashflow-negative"
                  : "cashflow-positive"
              }
            >
              {currency}{" "}
              {formatMoney(
                Math.abs(netChange)
              )}
            </strong>

            <small>
              Operating + Investing +
              Financing
            </small>
          </div>
        </div>

        <div className="cashflow-kpi-card">
          <div className="cashflow-kpi-icon cashflow-kpi-slate">
            <FileBarChart size={19} />
          </div>

          <div>
            <span>Closing Cash</span>

            <strong>
              {currency}{" "}
              {formatMoney(
                closingCash
              )}
            </strong>

            <small>
              Calculated closing position
            </small>
          </div>
        </div>

        <div
          className={`cashflow-kpi-card ${
            isReconciled
              ? "cashflow-kpi-reconciled"
              : "cashflow-kpi-unreconciled"
          }`}
        >
          <div className="cashflow-kpi-icon cashflow-kpi-status">
            {isReconciled ? (
              <CheckCircle2 size={19} />
            ) : (
              <AlertCircle size={19} />
            )}
          </div>

          <div>
            <span>
              Reconciliation
            </span>

            <strong>
              {isReconciled
                ? "Reconciled"
                : "Not Reconciled"}
            </strong>

            <small>
              Difference: {currency}{" "}
              {formatMoney(
                Math.abs(
                  reconciliationDifference
                )
              )}
            </small>
          </div>
        </div>
      </div>

      {/* ======================================================
          FILTERS
          ====================================================== */}

      <div className="cashflow-filter-card">

        <div className="cashflow-filter-heading">
          <div>
            <h2>
              Cash Flow Filters
            </h2>

            <p>
              Narrow the report by activity
              or reporting period.
            </p>
          </div>
        </div>

        <div className="cashflow-filter-grid">

          <div className="cashflow-search-box">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search reference, description, or cash account..."
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

          <div className="cashflow-select-filter">
            <label>
              ACTIVITY
            </label>

            <select
              value={activityFilter}
              onChange={(event) =>
                setActivityFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All Activities
              </option>

              <option value="OPERATING">
                Operating
              </option>

              <option value="INVESTING">
                Investing
              </option>

              <option value="FINANCING">
                Financing
              </option>
            </select>
          </div>

          <div className="cashflow-date-filter">
            <label>
              FROM DATE
            </label>

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

          <div className="cashflow-date-filter">
            <label>
              TO DATE
            </label>

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

          <div className="cashflow-filter-actions">

            <button
              type="button"
              className="cashflow-apply-button"
              onClick={
                applyFilters
              }
              disabled={loading}
            >
              <RefreshCw size={15} />
              Apply
            </button>

            {hasFilters && (
              <button
                type="button"
                className="cashflow-clear-button"
                onClick={
                  clearFilters
                }
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

      <div className="cashflow-report-card">

        <div className="cashflow-report-header">
          <div>
            <div className="cashflow-report-icon">
              <FileBarChart size={20} />
            </div>

            <div>
              <h2>
                Statement of Cash Flows
              </h2>

              <p>
                {displayedActivities} cash
                movement
                {displayedActivities ===
                1
                  ? ""
                  : "s"} displayed
                {totalActivities !==
                  displayedActivities &&
                  ` of ${totalActivities}`}
              </p>
            </div>
          </div>

          <div className="cashflow-report-company">
            {companyName}
          </div>
        </div>

        {loading ? (
          <div className="cashflow-loading">
            <RefreshCw
              size={24}
              className="cashflow-spin"
            />

            <span>
              Loading cash flow statement...
            </span>
          </div>
        ) : !report ? (
          <div className="cashflow-empty">
            <div className="cashflow-empty-icon">
              <FileBarChart size={26} />
            </div>

            <h3>
              Cash flow statement unavailable
            </h3>

            <p>
              The statement could not be
              loaded for the selected
              company.
            </p>
          </div>
        ) : (
          <div className="cashflow-statement-content">

            {/* ==================================================
                OPERATING
                ================================================== */}

            {(activityFilter ===
              "ALL" ||
              activityFilter ===
                "OPERATING") &&
              renderActivitySection({
                number: "01",
                title:
                  "Operating Activities",
                description:
                  "Cash generated or used in the company's ordinary operations",
                items:
                  filteredOperating,
                total:
                  totalOperating,
                typeClass:
                  "operating",
                emptyMessage:
                  "No operating cash activities match the current filters.",
              })}

            {/* ==================================================
                INVESTING
                ================================================== */}

            {(activityFilter ===
              "ALL" ||
              activityFilter ===
                "INVESTING") &&
              renderActivitySection({
                number: "02",
                title:
                  "Investing Activities",
                description:
                  "Cash related to investments and long-term assets",
                items:
                  filteredInvesting,
                total:
                  totalInvesting,
                typeClass:
                  "investing",
                emptyMessage:
                  "No investing cash activities match the current filters.",
              })}

            {/* ==================================================
                FINANCING
                ================================================== */}

            {(activityFilter ===
              "ALL" ||
              activityFilter ===
                "FINANCING") &&
              renderActivitySection({
                number: "03",
                title:
                  "Financing Activities",
                description:
                  "Cash related to capital and financing transactions",
                items:
                  filteredFinancing,
                total:
                  totalFinancing,
                typeClass:
                  "financing",
                emptyMessage:
                  "No financing cash activities match the current filters.",
              })}

            {/* ==================================================
                CASH SUMMARY
                ================================================== */}

            {activityFilter ===
              "ALL" && (
              <div className="cashflow-summary-card">

                <div className="cashflow-summary-row">
                  <span>
                    Net Operating Cash Flow
                  </span>

                  <strong
                    className={
                      totalOperating <
                      0
                        ? "cashflow-negative"
                        : "cashflow-positive"
                    }
                  >
                    {currency}{" "}
                    {formatMoney(
                      totalOperating
                    )}
                  </strong>
                </div>

                <div className="cashflow-summary-row">
                  <span>
                    Net Investing Cash Flow
                  </span>

                  <strong
                    className={
                      totalInvesting <
                      0
                        ? "cashflow-negative"
                        : "cashflow-positive"
                    }
                  >
                    {currency}{" "}
                    {formatMoney(
                      totalInvesting
                    )}
                  </strong>
                </div>

                <div className="cashflow-summary-row">
                  <span>
                    Net Financing Cash Flow
                  </span>

                  <strong
                    className={
                      totalFinancing <
                      0
                        ? "cashflow-negative"
                        : "cashflow-positive"
                    }
                  >
                    {currency}{" "}
                    {formatMoney(
                      totalFinancing
                    )}
                  </strong>
                </div>

                <div className="cashflow-summary-row cashflow-summary-net">
                  <span>
                    Net Change in Cash
                  </span>

                  <strong
                    className={
                      netChange < 0
                        ? "cashflow-negative"
                        : "cashflow-positive"
                    }
                  >
                    {currency}{" "}
                    {formatMoney(
                      netChange
                    )}
                  </strong>
                </div>

                <div className="cashflow-summary-row">
                  <span>
                    Opening Cash Balance
                  </span>

                  <strong>
                    {currency}{" "}
                    {formatMoney(
                      openingCash
                    )}
                  </strong>
                </div>

                <div className="cashflow-summary-row cashflow-summary-closing">
                  <span>
                    Closing Cash Balance
                  </span>

                  <strong>
                    {currency}{" "}
                    {formatMoney(
                      closingCash
                    )}
                  </strong>
                </div>

              </div>
            )}

            {/* ==================================================
                RECONCILIATION
                ================================================== */}

            {activityFilter ===
              "ALL" && (
              <div
                className={`cashflow-reconciliation-card ${
                  isReconciled
                    ? "cashflow-reconciliation-good"
                    : "cashflow-reconciliation-bad"
                }`}
              >

                <div>
                  {isReconciled ? (
                    <CheckCircle2
                      size={21}
                    />
                  ) : (
                    <AlertCircle
                      size={21}
                    />
                  )}

                  <div>
                    <strong>
                      {isReconciled
                        ? "Cash Flow Reconciled"
                        : "Cash Flow Not Reconciled"}
                    </strong>

                    <span>
                      Calculated closing
                      cash is compared
                      with actual ledger
                      cash.
                    </span>
                  </div>
                </div>

                <div className="cashflow-reconciliation-values">

                  <div>
                    <span>
                      Calculated Closing
                    </span>

                    <strong>
                      {currency}{" "}
                      {formatMoney(
                        closingCash
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Actual Ledger Cash
                    </span>

                    <strong>
                      {currency}{" "}
                      {formatMoney(
                        actualClosingCash
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Difference
                    </span>

                    <strong>
                      {currency}{" "}
                      {formatMoney(
                        Math.abs(
                          reconciliationDifference
                        )
                      )}
                    </strong>
                  </div>

                </div>
              </div>
            )}

            {/* ==================================================
                FOOTER
                ================================================== */}

            <div className="cashflow-report-footer">

              <div>
                <FileText size={16} />

                <div>
                  <strong>
                    Cash Flow Statement Summary
                  </strong>

                  <span>
                    Based on posted journal
                    entries and the
                    company's cash and
                    bank accounts.
                  </span>
                </div>
              </div>

              <div className="cashflow-footer-status">
                {isReconciled ? (
                  <>
                    <CheckCircle2
                      size={16}
                    />
                    Reconciled
                  </>
                ) : (
                  <>
                    <AlertCircle
                      size={16}
                    />
                    Check Reconciliation
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