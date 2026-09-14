import React, { useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Download,
  FileBarChart,
  FileText,
  Landmark,
  RefreshCw,
  Scale,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  API_BASE_URL,
} from "../../services/api";
import { useCompany } from "../../context/CompanyContext";

const REPORTS = [
  {
    key: "general-ledger",
    title: "General Ledger",
    description:
      "Detailed account activity, debits, credits and running balances from posted journal entries.",
    icon: BookOpen,
    path: "/accounting/general-ledger",
    pdfPath:
      "/api/accounting/reports/general-ledger/pdf/",
    color: "blue",
    periodType: "range",
  },
  {
    key: "trial-balance",
    title: "Trial Balance",
    description:
      "Review account debit and credit balances and verify that the ledger remains balanced.",
    icon: Scale,
    path: "/accounting/trial-balance",
    pdfPath:
      "/api/accounting/reports/trial-balance/pdf/",
    color: "gold",
    periodType: "range",
  },
  {
    key: "income-statement",
    title: "Income Statement",
    description:
      "Review revenue, cost of goods sold, expenses, gross profit and net profit or loss.",
    icon: TrendingUp,
    path: "/accounting/income-statement",
    pdfPath:
      "/api/accounting/reports/income-statement/pdf/",
    color: "navy",
    periodType: "range",
  },
  {
    key: "balance-sheet",
    title: "Balance Sheet",
    description:
      "Review assets, liabilities, equity and the company's financial position at a selected date.",
    icon: Landmark,
    path: "/accounting/balance-sheet",
    pdfPath:
      "/api/accounting/reports/balance-sheet/pdf/",
    color: "dark",
    periodType: "asOf",
  },
  {
    key: "cash-flow",
    title: "Cash Flow Statement",
    description:
      "Review operating, investing and financing cash movements during the selected period.",
    icon: Wallet,
    path: "/accounting/cash-flow",
    pdfPath:
      "/api/accounting/reports/cash-flow/pdf/",
    color: "blue",
    periodType: "range",
  },
];

function formatDate(value) {
  if (!value) {
    return "Not selected";
  }

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

function buildQuery(report, companyId, filters) {
  const query = new URLSearchParams();

  query.set("company", companyId);

  if (report.periodType === "range") {
    if (filters.startDate) {
      query.set("start_date", filters.startDate);
    }

    if (filters.endDate) {
      query.set("end_date", filters.endDate);
    }
  }

  if (report.periodType === "asOf") {
    if (filters.asOfDate) {
      query.set("as_of_date", filters.asOfDate);
    }
  }

  return query;
}

function reportPeriodText(report, filters) {
  if (report.periodType === "asOf") {
    return filters.asOfDate
      ? `As of ${formatDate(filters.asOfDate)}`
      : "Current financial position";
  }

  if (filters.startDate && filters.endDate) {
    return `${formatDate(filters.startDate)} — ${formatDate(
      filters.endDate
    )}`;
  }

  if (filters.startDate) {
    return `From ${formatDate(filters.startDate)}`;
  }

  if (filters.endDate) {
    return `Through ${formatDate(filters.endDate)}`;
  }

  return "All available posted activity";
}

export default function FinancialReports() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;
  const companyName =
    currentCompany?.name || "No company selected";
  const currency =
    currentCompany?.currency || "USD";

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [asOfDate, setAsOfDate] = useState("");

  const [downloading, setDownloading] =
    useState(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setAsOfDate("");
    setError("");
    setNotice("");
  };

  const downloadPdf = async (report) => {
    if (!companyId) {
      setError(
        "Select a company before downloading a financial report."
      );
      return;
    }

    if (
      report.periodType === "range" &&
      startDate &&
      endDate &&
      startDate > endDate
    ) {
      setError(
        "The start date cannot be later than the end date."
      );
      return;
    }

    setDownloading(report.key);
    setError("");
    setNotice("");

    try {
      const query = buildQuery(
        report,
        companyId,
        {
          startDate,
          endDate,
          asOfDate,
        }
      );

      const token =
        localStorage.getItem(
          "access_token"
        );

      const response = await fetch(
        `${API_BASE_URL}${report.pdfPath}?${query.toString()}`,
        {
          method: "GET",
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        }
      );

      if (!response.ok) {
        let message =
          `Unable to generate the ${report.title} PDF.`;

        try {
          const data =
            await response.json();

          message =
            data?.detail || message;
        } catch {
          // Keep default error.
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
      link.download = `${report.key}-${companyId}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      setNotice(
        `${report.title} PDF generated successfully.`
      );
    } catch (err) {
      setError(
        err?.message ||
          `Unable to generate the ${report.title} PDF.`
      );
    } finally {
      setDownloading(null);
    }
  };

  if (!companyId) {
    return (
      <div className="financial-reports-page">
        <div className="fr-empty-company">
          <div className="fr-empty-company-icon">
            <FileBarChart size={28} />
          </div>

          <h2>No Company Selected</h2>

          <p>
            Select a company before viewing
            financial reports.
          </p>
        </div>
      </div>
    );
  }

  const hasFilters =
    Boolean(startDate) ||
    Boolean(endDate) ||
    Boolean(asOfDate);

  return (
    <div className="financial-reports-page">
      {/* ======================================================
          HEADER
          ====================================================== */}
      <div className="fr-page-header">
        <div>
          <div className="fr-eyebrow">
            REPORTS · FINANCIAL
          </div>

          <h1>Financial Reports</h1>

          <p>
            Access the company's core financial
            statements and download official PDF
            reports.
          </p>
        </div>

        <div className="fr-header-icon">
          <FileBarChart size={24} />
        </div>
      </div>

      {/* ======================================================
          COMPANY STRIP
          ====================================================== */}
      <div className="fr-company-strip">
        <div className="fr-company-mark">
          {companyName
            .slice(0, 1)
            .toUpperCase()}
        </div>

        <div className="fr-company-info">
          <span>Reporting Company</span>
          <strong>{companyName}</strong>
        </div>

        <div className="fr-company-meta">
          <span>Currency</span>
          <strong>{currency}</strong>
        </div>

        <div className="fr-company-meta">
          <span>Reports Available</span>
          <strong>{REPORTS.length}</strong>
        </div>
      </div>

      {/* ======================================================
          ALERTS
          ====================================================== */}
      {error && (
        <div className="fr-alert fr-alert-error">
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

      {notice && (
        <div className="fr-alert fr-alert-success">
          <CheckCircle2 size={17} />

          <span>{notice}</span>

          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss notice"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ======================================================
          FILTERS
          ====================================================== */}
      <section className="fr-filter-card">
        <div className="fr-filter-heading">
          <div>
            <div className="fr-section-label">
              REPORT PERIOD
            </div>

            <h2>
              Choose reporting dates
            </h2>

            <p>
              These dates will be used when
              generating applicable financial
              report PDFs.
            </p>
          </div>

          {hasFilters && (
            <button
              type="button"
              className="fr-clear-button"
              onClick={clearFilters}
            >
              <X size={14} />
              Clear Filters
            </button>
          )}
        </div>

        <div className="fr-filter-grid">
          <label className="fr-field">
            <span>From Date</span>

            <input
              type="date"
              value={startDate}
              onChange={(event) =>
                setStartDate(
                  event.target.value
                )
              }
            />

            <small>
              Used by General Ledger, Trial
              Balance, Income Statement and
              Cash Flow.
            </small>
          </label>

          <label className="fr-field">
            <span>To Date</span>

            <input
              type="date"
              value={endDate}
              onChange={(event) =>
                setEndDate(
                  event.target.value
                )
              }
            />

            <small>
              Defines the end of the reporting
              period.
            </small>
          </label>

          <label className="fr-field">
            <span>Balance Sheet As Of</span>

            <input
              type="date"
              value={asOfDate}
              onChange={(event) =>
                setAsOfDate(
                  event.target.value
                )
              }
            />

            <small>
              Used specifically for the
              Balance Sheet.
            </small>
          </label>
        </div>
      </section>

      {/* ======================================================
          REPORT GRID
          ====================================================== */}
      <section className="fr-reports-section">
        <div className="fr-section-header">
          <div>
            <div className="fr-section-label">
              FINANCIAL STATEMENTS
            </div>

            <h2>
              Available financial reports
            </h2>

            <p>
              Open the detailed report or
              generate a PDF using the selected
              reporting period.
            </p>
          </div>
        </div>

        <div className="fr-report-grid">
          {REPORTS.map((report) => {
            const Icon = report.icon;

            const isDownloading =
              downloading === report.key;

            return (
              <article
                key={report.key}
                className={`fr-report-card fr-report-card-${report.color}`}
              >
                <div className="fr-report-card-top">
                  <div className="fr-report-icon">
                    <Icon size={21} />
                  </div>

                  <span className="fr-report-number">
                    {String(
                      REPORTS.indexOf(
                        report
                      ) + 1
                    ).padStart(2, "0")}
                  </span>
                </div>

                <div className="fr-report-content">
                  <h3>{report.title}</h3>

                  <p>
                    {report.description}
                  </p>
                </div>

                <div className="fr-report-period">
                  <FileText size={14} />

                  <span>
                    {reportPeriodText(
                      report,
                      {
                        startDate,
                        endDate,
                        asOfDate,
                      }
                    )}
                  </span>
                </div>

                <div className="fr-report-actions">
                  <Link
                    to={report.path}
                    className="fr-open-button"
                  >
                    Open Report
                    <ArrowUpRight
                      size={14}
                    />
                  </Link>

                  <button
                    type="button"
                    className="fr-pdf-button"
                    onClick={() =>
                      downloadPdf(report)
                    }
                    disabled={
                      isDownloading
                    }
                  >
                    {isDownloading ? (
                      <RefreshCw
                        size={14}
                        className="fr-spin"
                      />
                    ) : (
                      <Download
                        size={14}
                      />
                    )}

                    {isDownloading
                      ? "Generating..."
                      : "Download PDF"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ======================================================
          REPORTING NOTE
          ====================================================== */}
      <div className="fr-report-note">
        <div className="fr-report-note-icon">
          <BarChart3 size={17} />
        </div>

        <div>
          <strong>
            Financial Reporting Basis
          </strong>

          <span>
            Financial reports are generated from
            the selected company's accounting data.
            Report PDFs use the same authenticated
            financial reporting endpoints as the
            detailed accounting report pages.
          </span>
        </div>
      </div>
    </div>
  );
}