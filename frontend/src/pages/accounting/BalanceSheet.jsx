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

export default function BalanceSheet() {
  const { currentCompany } = useCompany();

  const [report, setReport] = useState(null);

  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("ALL");
  const [asOfDate, setAsOfDate] = useState("");

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

      if (asOfDate) {
        params.set("as_of_date", asOfDate);
      }

      const response = await api.get(
        `/api/accounting/reports/balance-sheet/?${params.toString()}`
      );

      setReport(response);
    } catch (err) {
      setReport(null);

      setError(
        err?.data?.detail ||
          err?.message ||
          "Unable to load the balance sheet."
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

  const assets = Array.isArray(report?.assets)
    ? report.assets
    : [];

  const liabilities = Array.isArray(
    report?.liabilities
  )
    ? report.liabilities
    : [];

  const equity = Array.isArray(report?.equity)
    ? report.equity
    : [];

  const totalAssets = Number(
    report?.total_assets || 0
  );

  const totalLiabilities = Number(
    report?.total_liabilities || 0
  );

  const totalEquity = Number(
    report?.total_equity || 0
  );

  const currentProfit = Number(
    report?.current_profit || 0
  );

  const totalEquityWithProfit = Number(
    report?.total_equity_with_profit || 0
  );

  const totalLiabilitiesAndEquity =
    Number(
      report?.total_liabilities_and_equity || 0
    );

  const difference = Number(
    report?.difference || 0
  );

  const isBalanced =
    Boolean(report?.is_balanced) ||
    Math.abs(difference) < 0.005;

  /* ============================================================
     FILTERING
     ============================================================ */

  const filterItems = (items, section) => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      if (
        sectionFilter !== "ALL" &&
        sectionFilter !== section
      ) {
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
  };

  const filteredAssets = useMemo(
    () => filterItems(assets, "ASSETS"),
    [assets, search, sectionFilter]
  );

  const filteredLiabilities = useMemo(
    () => filterItems(liabilities, "LIABILITIES"),
    [liabilities, search, sectionFilter]
  );

  const filteredEquity = useMemo(
    () => filterItems(equity, "EQUITY"),
    [equity, search, sectionFilter]
  );

  const displayedAccountCount =
    filteredAssets.length +
    filteredLiabilities.length +
    filteredEquity.length;

  const hasFilters =
    Boolean(search) ||
    sectionFilter !== "ALL" ||
    Boolean(asOfDate);

  /* ============================================================
     APPLY DATE
     ============================================================ */

  const applyDateFilter = async () => {
    await loadReport();
  };

  /* ============================================================
     CLEAR FILTERS
     ============================================================ */

  const clearFilters = () => {
    setSearch("");
    setSectionFilter("ALL");
    setAsOfDate("");
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

    assets.forEach((item) => {
      rows.push([
        "Assets",
        item.code || "",
        item.name || "",
        Number(item.amount || 0).toFixed(2),
      ]);
    });

    liabilities.forEach((item) => {
      rows.push([
        "Liabilities",
        item.code || "",
        item.name || "",
        Number(item.amount || 0).toFixed(2),
      ]);
    });

    equity.forEach((item) => {
      rows.push([
        "Equity",
        item.code || "",
        item.name || "",
        Number(item.amount || 0).toFixed(2),
      ]);
    });

    rows.push([]);

    rows.push([
      "SUMMARY",
      "",
      "Total Assets",
      totalAssets.toFixed(2),
    ]);

    rows.push([
      "",
      "",
      "Total Liabilities",
      totalLiabilities.toFixed(2),
    ]);

    rows.push([
      "",
      "",
      "Total Equity",
      totalEquity.toFixed(2),
    ]);

    rows.push([
      "",
      "",
      "Current Profit / Loss",
      currentProfit.toFixed(2),
    ]);

    rows.push([
      "",
      "",
      "Equity Including Current Profit / Loss",
      totalEquityWithProfit.toFixed(2),
    ]);

    rows.push([
      "",
      "",
      "Total Liabilities + Equity",
      totalLiabilitiesAndEquity.toFixed(2),
    ]);

    rows.push([
      "",
      "",
      "Difference",
      difference.toFixed(2),
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

    link.download =
      `balance-sheet-${companyName
        .replace(/\s+/g, "-")
        .toLowerCase()}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    setSuccess(
      "Balance Sheet CSV exported successfully."
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

      if (asOfDate) {
        params.set("as_of_date", asOfDate);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/accounting/reports/balance-sheet/pdf/?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        let message =
          "Unable to download the Balance Sheet PDF.";

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
        `balance-sheet-${companyName
          .replace(/\s+/g, "-")
          .toLowerCase()}.pdf`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      setSuccess(
        "Balance Sheet PDF downloaded successfully."
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to download the Balance Sheet PDF."
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  /* ============================================================
     ACCOUNT SECTION
     ============================================================ */

  const renderAccountSection = ({
    number,
    title,
    description,
    items,
    total,
    sectionClass,
    emptyMessage,
  }) => (
    <section className="balance-section">
      <div className="balance-section-heading">
        <div>
          <span className="balance-section-number">
            {number}
          </span>

          <div>
            <h3>{title}</h3>

            <p>{description}</p>
          </div>
        </div>

        <strong>
          {currency}{" "}
          {formatMoney(total)}
        </strong>
      </div>

      {items.length > 0 ? (
        <div className="balance-table-wrapper">
          <table className="balance-table">
            <thead>
              <tr>
                <th>Account Code</th>
                <th>Account</th>
                <th>Classification</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => (
                <tr key={item.account}>
                  <td>
                    <span className="balance-account-code">
                      {item.code}
                    </span>
                  </td>

                  <td>
                    <strong>
                      {item.name}
                    </strong>
                  </td>

                  <td>
                    <span
                      className={`balance-type-badge ${sectionClass}`}
                    >
                      {title}
                    </span>
                  </td>

                  <td className="balance-amount">
                    {currency}{" "}
                    {formatMoney(
                      item.amount
                    )}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr>
                <td colSpan={3}>
                  Total {title}
                </td>

                <td>
                  {currency}{" "}
                  {formatMoney(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="balance-section-empty">
          {emptyMessage}
        </div>
      )}
    </section>
  );

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div className="accounting-balance-page">

      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="balance-page-header">
        <div>
          <div className="balance-eyebrow">
            <FileBarChart size={15} />
            ACCOUNTING
          </div>

          <h1>Balance Sheet</h1>

          <p>
            Review the company&apos;s assets,
            liabilities, equity, and financial
            position.
          </p>
        </div>

        <div className="balance-header-actions">
          <button
            type="button"
            className="balance-secondary-button"
            onClick={exportCsv}
            disabled={!report || loading}
          >
            <Download size={16} />
            Export CSV
          </button>

          <button
            type="button"
            className="balance-primary-button"
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
                className="balance-spin"
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

      <div className="balance-company-strip">
        <div>
          <span>REPORTING ENTITY</span>

          <strong>{companyName}</strong>
        </div>

        <div>
          <span>CURRENCY</span>

          <strong>{currency}</strong>
        </div>

        <div>
          <span>STATEMENT DATE</span>

          <strong>
            {asOfDate
              ? formatDate(asOfDate)
              : "Current posted position"}
          </strong>
        </div>
      </div>

      {/* ======================================================
          ALERTS
          ====================================================== */}

      {error && (
        <div className="balance-alert balance-alert-error">
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
        <div className="balance-alert balance-alert-success">
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

      <div className="balance-kpi-grid">

        <div className="balance-kpi-card">
          <div className="balance-kpi-icon balance-kpi-blue">
            <FileBarChart size={19} />
          </div>

          <div>
            <span>Total Assets</span>

            <strong>
              {currency}{" "}
              {formatMoney(totalAssets)}
            </strong>

            <small>
              {assets.length} asset account
              {assets.length === 1
                ? ""
                : "s"}
            </small>
          </div>
        </div>

        <div className="balance-kpi-card">
          <div className="balance-kpi-icon balance-kpi-gold">
            <FileText size={19} />
          </div>

          <div>
            <span>Total Liabilities</span>

            <strong>
              {currency}{" "}
              {formatMoney(
                totalLiabilities
              )}
            </strong>

            <small>
              {liabilities.length} liability
              account
              {liabilities.length === 1
                ? ""
                : "s"}
            </small>
          </div>
        </div>

        <div className="balance-kpi-card">
          <div className="balance-kpi-icon balance-kpi-slate">
            <FileBarChart size={19} />
          </div>

          <div>
            <span>Equity + Current Profit</span>

            <strong>
              {currency}{" "}
              {formatMoney(
                totalEquityWithProfit
              )}
            </strong>

            <small>
              Owner equity plus current result
            </small>
          </div>
        </div>

        <div
          className={`balance-kpi-card ${
            isBalanced
              ? "balance-kpi-balanced"
              : "balance-kpi-unbalanced"
          }`}
        >
          <div className="balance-kpi-icon balance-kpi-status">
            {isBalanced ? (
              <CheckCircle2 size={19} />
            ) : (
              <AlertCircle size={19} />
            )}
          </div>

          <div>
            <span>Balance Status</span>

            <strong>
              {isBalanced
                ? "Balanced"
                : "Out of Balance"}
            </strong>

            <small>
              {isBalanced
                ? "Assets = Liabilities + Equity"
                : `Difference: ${currency} ${formatMoney(
                    Math.abs(difference)
                  )}`}
            </small>
          </div>
        </div>
      </div>

      {/* ======================================================
          FILTERS
          ====================================================== */}

      <div className="balance-filter-card">

        <div className="balance-filter-heading">
          <div>
            <h2>Balance Sheet Filters</h2>

            <p>
              Narrow the statement by account
              or statement date.
            </p>
          </div>
        </div>

        <div className="balance-filter-grid">

          <div className="balance-search-box">
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

          <div className="balance-select-filter">
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

              <option value="ASSETS">
                Assets
              </option>

              <option value="LIABILITIES">
                Liabilities
              </option>

              <option value="EQUITY">
                Equity
              </option>
            </select>
          </div>

          <div className="balance-date-filter">
            <label>AS OF DATE</label>

            <input
              type="date"
              value={asOfDate}
              onChange={(event) =>
                setAsOfDate(
                  event.target.value
                )
              }
            />
          </div>

          <div className="balance-filter-actions">

            <button
              type="button"
              className="balance-apply-button"
              onClick={applyDateFilter}
              disabled={loading}
            >
              <RefreshCw size={15} />
              Apply
            </button>

            {hasFilters && (
              <button
                type="button"
                className="balance-clear-button"
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

      <div className="balance-report-card">

        <div className="balance-report-header">
          <div>
            <div className="balance-report-icon">
              <FileBarChart size={20} />
            </div>

            <div>
              <h2>Statement of Financial Position</h2>

              <p>
                {displayedAccountCount} account
                {displayedAccountCount === 1
                  ? ""
                  : "s"} displayed
              </p>
            </div>
          </div>

          <div className="balance-report-company">
            {companyName}
          </div>
        </div>

        {loading ? (
          <div className="balance-loading">
            <RefreshCw
              size={24}
              className="balance-spin"
            />

            <span>
              Loading balance sheet...
            </span>
          </div>
        ) : !report ? (
          <div className="balance-empty">
            <div className="balance-empty-icon">
              <FileBarChart size={26} />
            </div>

            <h3>
              Balance sheet unavailable
            </h3>

            <p>
              The statement could not be loaded
              for the selected company.
            </p>
          </div>
        ) : (
          <div className="balance-statement-content">

            {/* ==================================================
                ASSETS
                ================================================== */}

            {(sectionFilter === "ALL" ||
              sectionFilter === "ASSETS") &&
              renderAccountSection({
                number: "01",
                title: "Assets",
                description:
                  "Resources controlled by the company",
                items: filteredAssets,
                total: totalAssets,
                sectionClass:
                  "balance-type-assets",
                emptyMessage:
                  "No asset accounts match the current filters.",
              })}

            {/* ==================================================
                LIABILITIES
                ================================================== */}

            {(sectionFilter === "ALL" ||
              sectionFilter === "LIABILITIES") &&
              renderAccountSection({
                number: "02",
                title: "Liabilities",
                description:
                  "Obligations owed by the company",
                items: filteredLiabilities,
                total: totalLiabilities,
                sectionClass:
                  "balance-type-liabilities",
                emptyMessage:
                  "No liability accounts match the current filters.",
              })}

            {/* ==================================================
                EQUITY
                ================================================== */}

            {(sectionFilter === "ALL" ||
              sectionFilter === "EQUITY") &&
              renderAccountSection({
                number: "03",
                title: "Equity",
                description:
                  "Owners' interest in the company",
                items: filteredEquity,
                total: totalEquity,
                sectionClass:
                  "balance-type-equity",
                emptyMessage:
                  "No equity accounts match the current filters.",
              })}

            {/* ==================================================
                CURRENT PROFIT / LOSS
                ================================================== */}

            {sectionFilter === "ALL" && (
              <div className="balance-profit-card">

                <div>
                  <span>
                    Current Period Profit / Loss
                  </span>

                  <small>
                    Included in equity for the
                    balance-sheet position
                  </small>
                </div>

                <strong
                  className={
                    currentProfit >= 0
                      ? "balance-profit-positive"
                      : "balance-profit-negative"
                  }
                >
                  {currency}{" "}
                  {formatMoney(
                    Math.abs(currentProfit)
                  )}
                </strong>

              </div>
            )}

            {/* ==================================================
                LIABILITIES + EQUITY
                ================================================== */}

            {sectionFilter === "ALL" && (
              <div className="balance-total-card">

                <div>
                  <span>
                    Total Liabilities + Equity
                  </span>

                  <small>
                    Liabilities + Equity +
                    Current Profit / Loss
                  </small>
                </div>

                <strong>
                  {currency}{" "}
                  {formatMoney(
                    totalLiabilitiesAndEquity
                  )}
                </strong>

              </div>
            )}

            {/* ==================================================
                BALANCE CHECK
                ================================================== */}

            {sectionFilter === "ALL" && (
              <div
                className={`balance-check-card ${
                  isBalanced
                    ? "balance-check-balanced"
                    : "balance-check-unbalanced"
                }`}
              >
                <div>
                  {isBalanced ? (
                    <CheckCircle2 size={21} />
                  ) : (
                    <AlertCircle size={21} />
                  )}

                  <div>
                    <strong>
                      {isBalanced
                        ? "Balance Sheet is Balanced"
                        : "Balance Sheet is Out of Balance"}
                    </strong>

                    <span>
                      Assets {isBalanced ? "=" : "≠"}{" "}
                      Liabilities + Equity
                    </span>
                  </div>
                </div>

                <div className="balance-difference">
                  <span>Difference</span>

                  <strong>
                    {currency}{" "}
                    {formatMoney(
                      Math.abs(difference)
                    )}
                  </strong>
                </div>
              </div>
            )}

            {/* ==================================================
                REPORT FOOTER
                ================================================== */}

            <div className="balance-report-footer">

              <div>
                <FileText size={16} />

                <div>
                  <strong>
                    Balance Sheet Summary
                  </strong>

                  <span>
                    Based on posted accounting
                    journal entries for the
                    selected company and statement
                    date.
                  </span>
                </div>
              </div>

              <div className="balance-footer-status">
                {isBalanced ? (
                  <>
                    <CheckCircle2 size={16} />
                    Balanced
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} />
                    Check Balance
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