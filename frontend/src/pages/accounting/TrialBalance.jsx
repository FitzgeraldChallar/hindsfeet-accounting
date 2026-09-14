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

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";


function extractList(data) {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}


function number(value) {
  return Number(value || 0);
}


function money(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number(value));
}


function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}


function accountTypeLabel(type) {
  const labels = {
    ASSET: "Asset",
    LIABILITY: "Liability",
    EQUITY: "Equity",
    REVENUE: "Revenue",
    COGS: "Cost of Goods Sold",
    EXPENSE: "Expense",
  };

  return labels[type] || type || "Other";
}


function accountTypeClass(type) {
  return String(type || "other")
    .toLowerCase()
    .replaceAll("_", "-");
}


function exportCsv(filename, headers, rows) {
  const quote = (value) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;

  const csvText = [
    headers.map(quote).join(","),
    ...rows.map((row) =>
      row.map(quote).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvText], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}


export default function TrialBalance() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;
  const companyName =
    currentCompany?.name || "Current Company";

  const currency =
    currentCompany?.currency || "USD";

  const [accounts, setAccounts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] =
    useState("ALL");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");


  /* ============================================================
     LOAD REPORT
     ============================================================ */

  const loadData = async (refresh = false) => {
    if (!companyId) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");
    setSuccess("");

    try {
      const query = new URLSearchParams({
        company: companyId,
      });

      if (dateFrom) {
        query.set("start_date", dateFrom);
      }

      if (dateTo) {
        query.set("end_date", dateTo);
      }

      const response =
        await api.get(
          `/api/accounting/reports/trial-balance/?${query.toString()}`
        );

      setAccounts(
        extractList(response?.accounts)
      );
    } catch (err) {
      setError(
        err?.data?.detail ||
          err?.message ||
          "Unable to load the trial balance."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  useEffect(() => {
    loadData();
  }, [companyId, dateFrom, dateTo]);


  /* ============================================================
     FILTERED ACCOUNTS
     ============================================================ */

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return accounts.filter((account) => {
      const matchesType =
        accountTypeFilter === "ALL" ||
        account.account_type === accountTypeFilter;

      if (!matchesType) {
        return false;
      }

      if (!query) {
        return true;
      }

      const text = [
        account.account_code,
        account.account_name,
        account.account_type,
        accountTypeLabel(
          account.account_type
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(query);
    });
  }, [
    accounts,
    search,
    accountTypeFilter,
  ]);


  /* ============================================================
     TOTALS
     ============================================================ */

  const totals = useMemo(() => {
    return filteredAccounts.reduce(
      (result, account) => {
        result.debit += number(account.debit);
        result.credit += number(account.credit);

        return result;
      },
      {
        debit: 0,
        credit: 0,
      }
    );
  }, [filteredAccounts]);


  const overallTotals = useMemo(() => {
    return accounts.reduce(
      (result, account) => {
        result.debit += number(account.debit);
        result.credit += number(account.credit);

        return result;
      },
      {
        debit: 0,
        credit: 0,
      }
    );
  }, [accounts]);


  const isBalanced =
    Math.abs(
      overallTotals.debit -
        overallTotals.credit
    ) < 0.005;


  const filteredIsBalanced =
    Math.abs(
      totals.debit -
        totals.credit
    ) < 0.005;


  const activeAccounts = accounts.length;

  const accountsWithActivity =
    accounts.filter(
      (account) =>
        number(account.debit) !== 0 ||
        number(account.credit) !== 0
    ).length;


  /* ============================================================
     FILTER HELPERS
     ============================================================ */

  const clearFilters = () => {
    setSearch("");
    setAccountTypeFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };


  const hasFilters =
    search ||
    accountTypeFilter !== "ALL" ||
    dateFrom ||
    dateTo;


  /* ============================================================
     CSV EXPORT
     ============================================================ */

  const exportTrialBalance = () => {
    if (!filteredAccounts.length) {
      setError(
        "There are no trial balance records to export."
      );
      return;
    }

    const headers = [
      "Account Code",
      "Account",
      "Type",
      "Debit",
      "Credit",
    ];

    const rows = filteredAccounts.map(
      (account) => [
        account.account_code,
        account.account_name,
        accountTypeLabel(
          account.account_type
        ),
        number(account.debit).toFixed(2),
        number(account.credit).toFixed(2),
      ]
    );

    rows.push([
      "",
      "",
      "TOTAL",
      totals.debit.toFixed(2),
      totals.credit.toFixed(2),
    ]);

    exportCsv(
      `trial-balance-${companyName
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()}.csv`,
      headers,
      rows
    );

    setSuccess(
      "Trial Balance CSV exported successfully."
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

      const query = new URLSearchParams({
        company: companyId,
      });

      if (dateFrom) {
        query.set(
          "start_date",
          dateFrom
        );
      }

      if (dateTo) {
        query.set(
          "end_date",
          dateTo
        );
      }

      const baseUrl =
        import.meta.env.VITE_API_URL ||
        "http://127.0.0.1:8000";

      const response =
        await fetch(
          `${baseUrl}/api/accounting/reports/trial-balance/pdf/?${query.toString()}`,
          {
            headers: token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {},
          }
        );

      if (!response.ok) {
        let message =
          "Unable to generate the Trial Balance PDF.";

        try {
          const data =
            await response.json();

          message =
            data?.detail ||
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

      const anchor =
        document.createElement("a");

      anchor.href = url;
      anchor.download =
        `trial-balance-${companyName
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase()}.pdf`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);

      setSuccess(
        "Trial Balance PDF downloaded successfully."
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to generate the Trial Balance PDF."
      );
    } finally {
      setDownloadingPdf(false);
    }
  };


  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div className="accounting-trial-page">

      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="trial-page-header">
        <div>
          <div className="trial-eyebrow">
            <FileBarChart size={15} />
            ACCOUNTING
          </div>

          <h1>Trial Balance</h1>

          <p>
            Review account balances and verify
            that total debits equal total credits.
          </p>
        </div>

        <div className="trial-header-actions">
          <button
            type="button"
            className="trial-secondary-button"
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "trial-spin"
                  : ""
              }
            />
            Refresh
          </button>

          <button
            type="button"
            className="trial-secondary-button"
            onClick={exportTrialBalance}
            disabled={!filteredAccounts.length}
          >
            <Download size={16} />
            CSV
          </button>

          <button
            type="button"
            className="trial-primary-button"
            onClick={downloadPdf}
            disabled={
              downloadingPdf ||
              !companyId
            }
          >
            <FileText size={16} />

            {downloadingPdf
              ? "Generating..."
              : "Export PDF"}
          </button>
        </div>
      </div>


      {/* ======================================================
          COMPANY STRIP
          ====================================================== */}

      <div className="trial-company-strip">
        <div className="trial-company-icon">
          <FileBarChart size={18} />
        </div>

        <div>
          <span>Current Company</span>
          <strong>{companyName}</strong>
        </div>

        <div className="trial-company-divider" />

        <div>
          <span>Functional Currency</span>
          <strong>{currency}</strong>
        </div>

        <div className="trial-company-divider" />

        <div>
          <span>Report Period</span>
          <strong>
            {dateFrom || dateTo
              ? `${dateFrom || "Beginning"} — ${
                  dateTo || "Current"
                }`
              : "All Posted Transactions"}
          </strong>
        </div>
      </div>


      {/* ======================================================
          ALERTS
          ====================================================== */}

      {error && (
        <div className="trial-alert trial-alert-error">
          <AlertCircle size={17} />

          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {success && (
        <div className="trial-alert trial-alert-success">
          <CheckCircle2 size={17} />

          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
          >
            <X size={15} />
          </button>
        </div>
      )}


      {/* ======================================================
          KPI CARDS
          ====================================================== */}

      <div className="trial-kpi-grid">

        <div className="trial-kpi-card">
          <div className="trial-kpi-icon trial-kpi-icon-blue">
            <FileBarChart size={19} />
          </div>

          <div>
            <span>Active Accounts</span>
            <strong>
              {activeAccounts}
            </strong>
            <small>
              {accountsWithActivity} with activity
            </small>
          </div>
        </div>


        <div className="trial-kpi-card">
          <div className="trial-kpi-icon trial-kpi-icon-gold">
            <FileText size={19} />
          </div>

          <div>
            <span>Total Debits</span>
            <strong>
              {money(
                overallTotals.debit,
                currency
              )}
            </strong>
            <small>
              Across all accounts
            </small>
          </div>
        </div>


        <div className="trial-kpi-card">
          <div className="trial-kpi-icon trial-kpi-icon-navy">
            <FileText size={19} />
          </div>

          <div>
            <span>Total Credits</span>
            <strong>
              {money(
                overallTotals.credit,
                currency
              )}
            </strong>
            <small>
              Across all accounts
            </small>
          </div>
        </div>


        <div
          className={`trial-kpi-card ${
            isBalanced
              ? "trial-kpi-balanced"
              : "trial-kpi-unbalanced"
          }`}
        >
          <div
            className={`trial-kpi-icon ${
              isBalanced
                ? "trial-kpi-icon-balanced"
                : "trial-kpi-icon-danger"
            }`}
          >
            {isBalanced ? (
              <CheckCircle2 size={19} />
            ) : (
              <AlertCircle size={19} />
            )}
          </div>

          <div>
            <span>Trial Balance Status</span>

            <strong>
              {loading
                ? "Checking..."
                : isBalanced
                ? "Balanced"
                : "Not Balanced"}
            </strong>

            <small>
              Debit = Credit
            </small>
          </div>
        </div>

      </div>


      {/* ======================================================
          FILTERS
          ====================================================== */}

      <div className="trial-filter-card">

        <div className="trial-filter-heading">
          <div>
            <strong>Trial Balance Filters</strong>
            <span>
              Narrow the report by account or period.
            </span>
          </div>

          {hasFilters && (
            <button
              type="button"
              className="trial-clear-button"
              onClick={clearFilters}
            >
              <X size={15} />
              Clear Filters
            </button>
          )}
        </div>


        <div className="trial-filter-grid">

          <div className="trial-field trial-search-field">
            <label>Search</label>

            <div className="trial-input-with-icon">
              <Search size={16} />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search account code or name..."
              />
            </div>
          </div>


          <div className="trial-field">
            <label>Account Type</label>

            <select
              value={accountTypeFilter}
              onChange={(event) =>
                setAccountTypeFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All Account Types
              </option>

              <option value="ASSET">
                Assets
              </option>

              <option value="LIABILITY">
                Liabilities
              </option>

              <option value="EQUITY">
                Equity
              </option>

              <option value="REVENUE">
                Revenue
              </option>

              <option value="COGS">
                Cost of Goods Sold
              </option>

              <option value="EXPENSE">
                Expenses
              </option>
            </select>
          </div>


          <div className="trial-field">
            <label>From Date</label>

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


          <div className="trial-field">
            <label>To Date</label>

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

        </div>

      </div>


      {/* ======================================================
          REPORT TABLE
          ====================================================== */}

      <div className="trial-table-card">

        <div className="trial-table-header">
          <div>
            <div className="trial-table-title">
              <FileBarChart size={18} />
              <strong>Trial Balance</strong>
            </div>

            <span>
              {filteredAccounts.length} account
              {filteredAccounts.length === 1
                ? ""
                : "s"} displayed
            </span>
          </div>

          <div
            className={`trial-balance-badge ${
              filteredIsBalanced
                ? "trial-balance-badge-balanced"
                : "trial-balance-badge-danger"
            }`}
          >
            {filteredIsBalanced ? (
              <CheckCircle2 size={15} />
            ) : (
              <AlertCircle size={15} />
            )}

            {filteredIsBalanced
              ? "Balanced"
              : "Check Balance"}
          </div>
        </div>


        {loading ? (
          <div className="trial-loading-state">
            <RefreshCw
              size={22}
              className="trial-spin"
            />

            <span>
              Loading trial balance...
            </span>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="trial-empty-state">
            <div className="trial-empty-icon">
              <FileBarChart size={25} />
            </div>

            <strong>
              No trial balance records found
            </strong>

            <span>
              Try changing your filters or
              select a different reporting period.
            </span>
          </div>
        ) : (
          <div className="trial-table-wrapper">

            <table className="trial-table">

              <thead>
                <tr>
                  <th>Account Code</th>
                  <th>Account</th>
                  <th>Type</th>
                  <th className="trial-amount-column">
                    Debit
                  </th>
                  <th className="trial-amount-column">
                    Credit
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredAccounts.map(
                  (account) => (
                    <tr
                      key={account.account}
                    >
                      <td>
                        <span className="trial-account-code">
                          {account.account_code}
                        </span>
                      </td>

                      <td>
                        <div className="trial-account-name">
                          {account.account_name}
                        </div>
                      </td>

                      <td>
                        <span
                          className={`trial-type-badge trial-type-${accountTypeClass(
                            account.account_type
                          )}`}
                        >
                          {accountTypeLabel(
                            account.account_type
                          )}
                        </span>
                      </td>

                      <td className="trial-amount-column">
                        {money(
                          account.debit,
                          currency
                        )}
                      </td>

                      <td className="trial-amount-column">
                        {money(
                          account.credit,
                          currency
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>

              <tfoot>
                <tr>
                  <td />
                  <td />
                  <td>
                    <strong>TOTAL</strong>
                  </td>
                  <td className="trial-amount-column">
                    <strong>
                      {money(
                        totals.debit,
                        currency
                      )}
                    </strong>
                  </td>
                  <td className="trial-amount-column">
                    <strong>
                      {money(
                        totals.credit,
                        currency
                      )}
                    </strong>
                  </td>
                </tr>
              </tfoot>

            </table>

          </div>
        )}

      </div>


      {/* ======================================================
          REPORT FOOTER
          ====================================================== */}

      {!loading &&
        filteredAccounts.length > 0 && (
          <div className="trial-report-footer">

            <div>
              <span>Displayed Debit</span>
              <strong>
                {money(
                  totals.debit,
                  currency
                )}
              </strong>
            </div>

            <div>
              <span>Displayed Credit</span>
              <strong>
                {money(
                  totals.credit,
                  currency
                )}
              </strong>
            </div>

            <div
              className={
                filteredIsBalanced
                  ? "trial-footer-balanced"
                  : "trial-footer-danger"
              }
            >
              <span>Difference</span>

              <strong>
                {money(
                  totals.debit -
                    totals.credit,
                  currency
                )}
              </strong>
            </div>

          </div>
        )}

    </div>
  );
}