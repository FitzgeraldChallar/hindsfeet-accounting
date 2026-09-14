import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileBarChart,
  FileText,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { api, API_BASE_URL } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";

const ACCOUNT_TYPES = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expense",
  COGS: "Cost of Goods Sold",
};

const formatMoney = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const extractList = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
};

const accountTypeLabel = (type) =>
  ACCOUNT_TYPES[type] || type || "Other";

const accountTypeClass = (type) =>
  String(type || "other").toLowerCase();

export default function GeneralLedger() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;
  const companyName =
    currentCompany?.name || "Current Company";
  const companyCurrency =
    currentCompany?.currency || "USD";

  const [accounts, setAccounts] = useState([]);
  const [ledger, setLedger] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] =
    useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [expandedAccounts, setExpandedAccounts] =
    useState(new Set());

  const loadData = async (refresh = false) => {
    if (!companyId) {
      setAccounts([]);
      setLedger([]);
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

      if (accountFilter !== "ALL") {
        query.set("account", accountFilter);
      }

      const [
        accountsResponse,
        ledgerResponse,
      ] = await Promise.all([
        api.get(
          `/api/accounting/accounts/?company=${companyId}`
        ),
        api.get(
          `/api/accounting/reports/general-ledger/?${query.toString()}`
        ),
      ]);

      setAccounts(
        extractList(accountsResponse)
      );

      setLedger(
        extractList(ledgerResponse?.accounts)
      );
    } catch (err) {
      setError(
        err?.data?.detail ||
          err?.message ||
          "Unable to load the general ledger."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    companyId,
    dateFrom,
    dateTo,
    accountFilter,
  ]);

  const filteredLedger = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return ledger;
    }

    return ledger.filter((account) => {
      const accountText = [
        account.account_code,
        account.account_name,
        account.account_type,
        accountTypeLabel(account.account_type),
        ...(account.transactions || []).flatMap(
          (transaction) => [
            transaction.reference,
            transaction.description,
            transaction.journal_entry_id,
            transaction.date,
          ]
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return accountText.includes(query);
    });
  }, [ledger, search]);

  const stats = useMemo(() => {
    let debit = 0;
    let credit = 0;
    let transactions = 0;
    let activeAccounts = 0;

    ledger.forEach((account) => {
      activeAccounts += 1;
      debit += Number(account.debits || 0);
      credit += Number(account.credits || 0);
      transactions +=
        account.transactions?.length || 0;
    });

    return {
      activeAccounts,
      transactions,
      debit,
      credit,
      difference: debit - credit,
      balanced:
        Math.abs(debit - credit) < 0.005,
    };
  }, [ledger]);

  const toggleAccount = (accountId) => {
    setExpandedAccounts((current) => {
      const next = new Set(current);

      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }

      return next;
    });
  };

  const expandAll = () => {
    setExpandedAccounts(
      new Set(
        filteredLedger.map((account) =>
          Number(account.account)
        )
      )
    );
  };

  const collapseAll = () => {
    setExpandedAccounts(new Set());
  };

  const clearFilters = () => {
    setSearch("");
    setAccountFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters =
    Boolean(search) ||
    accountFilter !== "ALL" ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const exportCsv = () => {
    const rows = [];

    filteredLedger.forEach((account) => {
      if (!account.transactions?.length) {
        rows.push([
          "",
          "",
          account.account_code,
          account.account_name,
          accountTypeLabel(
            account.account_type
          ),
          "Opening Balance",
          account.opening_balance,
          "",
          "",
          account.closing_balance,
        ]);

        return;
      }

      account.transactions.forEach(
        (transaction) => {
          rows.push([
            transaction.date,
            transaction.journal_entry_id,
            account.account_code,
            account.account_name,
            accountTypeLabel(
              account.account_type
            ),
            transaction.reference ||
              `JE-${transaction.journal_entry_id}`,
            transaction.description || "",
            transaction.debit || 0,
            transaction.credit || 0,
            transaction.balance || 0,
          ]);
        }
      );
    });

    const quote = (value) =>
      `"${String(value ?? "").replaceAll(
        '"',
        '""'
      )}"`;

    const csv = [
      [
        "Date",
        "Journal Entry",
        "Account Code",
        "Account Name",
        "Account Type",
        "Reference / Description",
        "Line Description",
        "Debit",
        "Credit",
        "Running Balance",
      ]
        .map(quote)
        .join(","),
      ...rows.map((row) =>
        row.map(quote).join(",")
      ),
    ].join("\n");

    const url = URL.createObjectURL(
      new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      })
    );

    const link =
      document.createElement("a");

    link.href = url;
    link.download = `general-ledger-${companyId}.csv`;
    link.click();

    URL.revokeObjectURL(url);

    setSuccess(
      "General ledger CSV exported successfully."
    );
  };

  const downloadPdf = async () => {
    if (!companyId) {
      return;
    }

    setDownloadingPdf(true);
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

      if (accountFilter !== "ALL") {
        query.set("account", accountFilter);
      }

      const token =
        localStorage.getItem("access_token");

      const response = await fetch(
        `${API_BASE_URL}/api/accounting/reports/general-ledger/pdf/?${query.toString()}`,
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
          "Unable to generate the General Ledger PDF.";

        try {
          const data = await response.json();
          message =
            data?.detail || message;
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
      link.download = `general-ledger-${companyId}.pdf`;
      link.click();

      URL.revokeObjectURL(url);

      setSuccess(
        "General ledger PDF generated successfully."
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to generate the General Ledger PDF."
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="accounting-gl-page">
      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="gl-page-header">
        <div>
          <div className="gl-eyebrow">
            <FileBarChart size={15} />
            ACCOUNTING REPORTS
          </div>

          <h1>General Ledger</h1>

          <p>
            Review posted accounting activity,
            account balances, and transaction
            history for{" "}
            <strong>{companyName}</strong>.
          </p>
        </div>

        <div className="gl-header-actions">
          <button
            type="button"
            className="gl-secondary-button"
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "gl-spin"
                  : ""
              }
            />
            Refresh
          </button>

          <button
            type="button"
            className="gl-secondary-button"
            onClick={exportCsv}
            disabled={
              loading ||
              !filteredLedger.length
            }
          >
            <Download size={16} />
            Export CSV
          </button>

          <button
            type="button"
            className="gl-primary-button"
            onClick={downloadPdf}
            disabled={
              downloadingPdf || loading
            }
          >
            {downloadingPdf ? (
              <>
                <RefreshCw
                  size={16}
                  className="gl-spin"
                />
                Generating...
              </>
            ) : (
              <>
                <FileText size={16} />
                Export PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* ======================================================
          COMPANY STRIP
          ====================================================== */}

      <div className="gl-company-strip">
        <div className="gl-company-icon">
          <Building2 size={20} />
        </div>

        <div>
          <span>Reporting Company</span>
          <strong>{companyName}</strong>
        </div>

        <div className="gl-company-divider" />

        <div>
          <span>Functional Currency</span>
          <strong>{companyCurrency}</strong>
        </div>

        <div className="gl-company-divider" />

        <div>
          <span>Ledger Basis</span>
          <strong>Posted Entries Only</strong>
        </div>
      </div>

      {/* ======================================================
          ALERTS
          ====================================================== */}

      {error && (
        <div className="gl-alert gl-alert-error">
          <X size={17} />

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
        <div className="gl-alert gl-alert-success">
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

      <div className="gl-kpi-grid">
        <div className="gl-kpi-card">
          <div className="gl-kpi-icon gl-kpi-blue">
            <BarChart3 size={19} />
          </div>

          <div>
            <span>Ledger Accounts</span>

            <strong>
              {stats.activeAccounts}
            </strong>

            <small>
              Active accounts included
            </small>
          </div>
        </div>

        <div className="gl-kpi-card">
          <div className="gl-kpi-icon gl-kpi-gold">
            <ArrowDownRight size={19} />
          </div>

          <div>
            <span>Total Debits</span>

            <strong>
              {companyCurrency}{" "}
              {formatMoney(stats.debit)}
            </strong>

            <small>
              Selected ledger period
            </small>
          </div>
        </div>

        <div className="gl-kpi-card">
          <div className="gl-kpi-icon gl-kpi-navy">
            <ArrowUpRight size={19} />
          </div>

          <div>
            <span>Total Credits</span>

            <strong>
              {companyCurrency}{" "}
              {formatMoney(stats.credit)}
            </strong>

            <small>
              Selected ledger period
            </small>
          </div>
        </div>

        <div className="gl-kpi-card">
          <div className="gl-kpi-icon gl-kpi-slate">
            <CheckCircle2 size={19} />
          </div>

          <div>
            <span>Ledger Status</span>

            <strong>
              {stats.balanced
                ? "Balanced"
                : "Check"}
            </strong>

            <small>
              Difference:{" "}
              {companyCurrency}{" "}
              {formatMoney(
                Math.abs(
                  stats.difference
                )
              )}
            </small>
          </div>
        </div>
      </div>

      {/* ======================================================
          FILTERS
          ====================================================== */}

      <div className="gl-filter-card">
        <div className="gl-search-box">
          <Search size={17} />

          <input
            type="text"
            placeholder="Search account, reference, description..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          {search && (
            <button
              type="button"
              onClick={() =>
                setSearch("")
              }
            >
              <X size={15} />
            </button>
          )}
        </div>

        <select
          value={accountFilter}
          onChange={(event) =>
            setAccountFilter(
              event.target.value
            )
          }
        >
          <option value="ALL">
            All Accounts
          </option>

          {accounts
            .filter(
              (account) =>
                account.is_active !== false
            )
            .sort((a, b) =>
              String(
                a.code || ""
              ).localeCompare(
                String(
                  b.code || ""
                ),
                undefined,
                {
                  numeric: true,
                }
              )
            )
            .map((account) => (
              <option
                key={account.id}
                value={account.id}
              >
                {account.code} —{" "}
                {account.name}
              </option>
            ))}
        </select>

        <div className="gl-date-filter">
          <label>From</label>

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

        <div className="gl-date-filter">
          <label>To</label>

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

        {hasFilters && (
          <button
            type="button"
            className="gl-clear-button"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* ======================================================
          REGISTER CONTROLS
          ====================================================== */}

      <div className="gl-register-toolbar">
        <div>
          <h2>Ledger Register</h2>

          <p>
            {filteredLedger.length} account
            {filteredLedger.length === 1
              ? ""
              : "s"} displayed ·{" "}
            {stats.transactions} posted
            transaction
            {stats.transactions === 1
              ? ""
              : "s"}
          </p>
        </div>

        <div className="gl-register-actions">
          <button
            type="button"
            onClick={expandAll}
            disabled={
              !filteredLedger.length
            }
          >
            <ChevronDown size={15} />
            Expand All
          </button>

          <button
            type="button"
            onClick={collapseAll}
            disabled={
              !expandedAccounts.size
            }
          >
            <ChevronRight size={15} />
            Collapse All
          </button>
        </div>
      </div>

      {/* ======================================================
          LEDGER REGISTER
          ====================================================== */}

      <div className="gl-table-card">
        {loading ? (
          <div className="gl-loading">
            <RefreshCw
              size={23}
              className="gl-spin"
            />

            <span>
              Loading general ledger...
            </span>
          </div>
        ) : filteredLedger.length === 0 ? (
          <div className="gl-empty">
            <div className="gl-empty-icon">
              <FileBarChart size={25} />
            </div>

            <h3>
              No ledger activity found
            </h3>

            <p>
              {hasFilters
                ? "Try changing your search or report filters."
                : "Posted journal activity will appear here once accounting entries are posted."}
            </p>
          </div>
        ) : (
          <div className="gl-register">
            {/* ==================================================
                OUTER REGISTER HEADER
                ================================================== */}

            <div className="gl-register-header">
              <div className="gl-register-heading gl-heading-account">
                Account
              </div>

              <div className="gl-register-heading gl-heading-type">
                Type
              </div>

              <div className="gl-register-heading gl-heading-money">
                Opening Balance
              </div>

              <div className="gl-register-heading gl-heading-money">
                Debits
              </div>

              <div className="gl-register-heading gl-heading-money">
                Credits
              </div>

              <div className="gl-register-heading gl-heading-money">
                Closing Balance
              </div>

              <div className="gl-register-heading gl-heading-action" />
            </div>

            {/* ==================================================
                ACCOUNT ROWS
                ================================================== */}

            <div className="gl-account-list">
              {filteredLedger.map(
                (account) => {
                  const accountId =
                    Number(
                      account.account
                    );

                  const expanded =
                    expandedAccounts.has(
                      accountId
                    );

                  return (
                    <div
                      key={accountId}
                      className={`gl-account-block ${
                        expanded
                          ? "gl-account-block-expanded"
                          : ""
                      }`}
                    >
                      {/* ========================================
                          ACCOUNT SUMMARY
                          ======================================== */}

                      <button
                        type="button"
                        className="gl-account-summary"
                        onClick={() =>
                          toggleAccount(
                            accountId
                          )
                        }
                      >
                        <div className="gl-account-main">
                          <span className="gl-expand-icon">
                            {expanded ? (
                              <ChevronDown
                                size={17}
                              />
                            ) : (
                              <ChevronRight
                                size={17}
                              />
                            )}
                          </span>

                          <div className="gl-account-code">
                            {
                              account.account_code
                            }
                          </div>

                          <div className="gl-account-name">
                            <strong>
                              {
                                account.account_name
                              }
                            </strong>

                            <span>
                              {
                                account
                                  .transactions
                                  ?.length
                              }{" "}
                              posted transaction
                              {account
                                .transactions
                                ?.length ===
                              1
                                ? ""
                                : "s"}
                            </span>
                          </div>
                        </div>

                        <div className="gl-account-type-cell">
                          <span
                            className={`gl-type-badge ${accountTypeClass(
                              account.account_type
                            )}`}
                          >
                            {accountTypeLabel(
                              account.account_type
                            )}
                          </span>
                        </div>

                        <div className="gl-account-number">
                          {companyCurrency}{" "}
                          {formatMoney(
                            account.opening_balance
                          )}
                        </div>

                        <div className="gl-account-number gl-debit">
                          {companyCurrency}{" "}
                          {formatMoney(
                            account.debits
                          )}
                        </div>

                        <div className="gl-account-number gl-credit">
                          {companyCurrency}{" "}
                          {formatMoney(
                            account.credits
                          )}
                        </div>

                        <div className="gl-account-number gl-closing">
                          {companyCurrency}{" "}
                          {formatMoney(
                            account.closing_balance
                          )}
                        </div>

                        <div className="gl-account-open-label">
                          {expanded
                            ? "Hide"
                            : "View"}
                        </div>
                      </button>

                      {/* ========================================
                          ACCOUNT ACTIVITY
                          ======================================== */}

                      {expanded && (
                        <div className="gl-transactions-panel">
                          <div className="gl-transactions-header">
                            <div>
                              <h3>
                                Account Activity
                              </h3>

                              <p>
                                {
                                  account.account_code
                                }{" "}
                                ·{" "}
                                {
                                  account.account_name
                                }
                              </p>
                            </div>

                            <div className="gl-opening-chip">
                              Opening Balance:{" "}
                              <strong>
                                {
                                  companyCurrency
                                }{" "}
                                {formatMoney(
                                  account.opening_balance
                                )}
                              </strong>
                            </div>
                          </div>

                          {account.transactions
                            ?.length ? (
                            <div className="gl-transactions-table-wrapper">
                              <table className="gl-transactions-table">
                                <colgroup>
                                  <col className="gl-col-date" />
                                  <col className="gl-col-entry" />
                                  <col className="gl-col-reference" />
                                  <col className="gl-col-description" />
                                  <col className="gl-col-debit" />
                                  <col className="gl-col-credit" />
                                  <col className="gl-col-balance" />
                                </colgroup>

                                <thead>
                                  <tr>
                                    <th>
                                      Date
                                    </th>

                                    <th>
                                      Entry
                                    </th>

                                    <th>
                                      Reference
                                    </th>

                                    <th>
                                      Description
                                    </th>

                                    <th>
                                      Debit
                                    </th>

                                    <th>
                                      Credit
                                    </th>

                                    <th>
                                      Balance
                                    </th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {account.transactions.map(
                                    (
                                      transaction,
                                      index
                                    ) => (
                                      <tr
                                        key={`${accountId}-${transaction.journal_entry_id}-${index}`}
                                      >
                                        <td>
                                          {formatDate(
                                            transaction.date
                                          )}
                                        </td>

                                        <td>
                                          <span className="gl-entry-number">
                                            JE-
                                            {String(
                                              transaction.journal_entry_id
                                            ).padStart(
                                              5,
                                              "0"
                                            )}
                                          </span>
                                        </td>

                                        <td>
                                          <strong className="gl-reference">
                                            {transaction.reference ||
                                              "No reference"}
                                          </strong>
                                        </td>

                                        <td>
                                          <span className="gl-transaction-description">
                                            {transaction.description ||
                                              "—"}
                                          </span>
                                        </td>

                                        <td className="gl-money-cell">
                                          {Number(
                                            transaction.debit ||
                                              0
                                          ) > 0
                                            ? `${companyCurrency} ${formatMoney(
                                                transaction.debit
                                              )}`
                                            : "—"}
                                        </td>

                                        <td className="gl-money-cell">
                                          {Number(
                                            transaction.credit ||
                                              0
                                          ) > 0
                                            ? `${companyCurrency} ${formatMoney(
                                                transaction.credit
                                              )}`
                                            : "—"}
                                        </td>

                                        <td className="gl-money-cell gl-running-balance">
                                          {
                                            companyCurrency
                                          }{" "}
                                          {formatMoney(
                                            transaction.balance
                                          )}
                                        </td>
                                      </tr>
                                    )
                                  )}
                                </tbody>

                                <tfoot>
                                  <tr>
                                    <td
                                      colSpan={4}
                                    >
                                      Account Totals
                                    </td>

                                    <td>
                                      {
                                        companyCurrency
                                      }{" "}
                                      {formatMoney(
                                        account.debits
                                      )}
                                    </td>

                                    <td>
                                      {
                                        companyCurrency
                                      }{" "}
                                      {formatMoney(
                                        account.credits
                                      )}
                                    </td>

                                    <td>
                                      {
                                        companyCurrency
                                      }{" "}
                                      {formatMoney(
                                        account.closing_balance
                                      )}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          ) : (
                            <div className="gl-no-activity">
                              No posted activity for
                              this account in the
                              selected period.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================
          REPORT NOTE
          ====================================================== */}

      <div className="gl-report-note">
        <FileText size={16} />

        <div>
          <strong>
            General Ledger Reporting Basis
          </strong>

          <span>
            This report is generated from posted
            journal entries only. When a start date
            is selected, opening balances represent
            the account balance immediately before
            that date, while closing balances include
            the selected period activity.
          </span>
        </div>
      </div>
    </div>
  );
}
