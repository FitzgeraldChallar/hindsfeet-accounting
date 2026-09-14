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
  Download,
  FileBarChart,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";

function list(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.accounts)) return response.accounts;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value, currency = "USD") {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number(value))} ${currency}`;
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

function extractError(error) {
  if (error?.data?.detail) {
    return error.data.detail;
  }

  if (error?.data?.message) {
    return error.data.message;
  }

  if (
    error?.data &&
    typeof error.data === "object"
  ) {
    return Object.entries(error.data)
      .map(([key, value]) => {
        const message = Array.isArray(value)
          ? value.join(", ")
          : value;

        return `${key}: ${message}`;
      })
      .join(" ");
  }

  return (
    error?.message ||
    "Unable to load expense report."
  );
}

function accountTypeLabel(value) {
  const labels = {
    EXPENSE: "Expense",
    COST_OF_SALES: "Cost of Sales",
  };

  return labels[value] || value || "Expense";
}

export default function ExpenseReports() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;
  const companyName =
    currentCompany?.name || "No company selected";

  const companyCurrency =
    currentCompany?.currency || "USD";

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [currencyFilter, setCurrencyFilter] =
    useState("ALL");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadReport = useCallback(
    async (refresh = false) => {
      if (!companyId) {
        setAccounts([]);
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

        const response =
          await api.get(
            `/api/accounting/reports/general-ledger/?company=${companyId}`
          );

        setAccounts(
          list(response)
        );
      } catch (err) {
        setError(
          extractError(err)
        );
        setAccounts([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId]
  );

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  /*
   * The General Ledger response contains the
   * account-level transactions used by the
   * existing Expenses module.
   *
   * We only include actual EXPENSE accounts here.
   */
  const expenseAccounts = useMemo(() => {
    return accounts.filter(
      (account) =>
        account.account_type ===
          "EXPENSE" &&
        account.is_active !== false
    );
  }, [accounts]);

  /*
   * Flatten expense account transactions into
   * report rows.
   */
  const transactions = useMemo(() => {
    const rows = [];

    expenseAccounts.forEach(
      (account) => {
        const accountTransactions =
          Array.isArray(
            account.transactions
          )
            ? account.transactions
            : [];

        accountTransactions.forEach(
          (transaction) => {
            const debit =
              number(transaction.debit);

            const credit =
              number(transaction.credit);

            const amount =
              debit - credit;

            if (amount === 0) {
              return;
            }

            rows.push({
              id:
                `${account.id}-${transaction.id || Math.random()}`,
              accountId: account.id,
              accountCode:
                account.account_code ||
                account.code ||
                "—",
              accountName:
                account.account_name ||
                account.name ||
                "Expense",
              accountType:
                account.account_type ||
                "EXPENSE",

              date:
                transaction.transaction_date ||
                transaction.date ||
                transaction.journal_date ||
                "",

              reference:
                transaction.reference ||
                transaction.journal_reference ||
                "—",

              description:
                transaction.description ||
                transaction.journal_description ||
                "Expense transaction",

              debit,
              credit,
              amount,
            });
          }
        );
      }
    );

    return rows.sort((a, b) => {
      return (
        new Date(
          `${b.date || "1900-01-01"}T00:00:00`
        ) -
        new Date(
          `${a.date || "1900-01-01"}T00:00:00`
        )
      );
    });
  }, [expenseAccounts]);

  /*
   * This report is company-currency based by
   * default. The existing accounting ledger does
   * not expose a transaction currency on every
   * transaction, so we do not invent one here.
   */
  const filteredTransactions =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return transactions.filter(
        (transaction) => {
          const matchesSearch =
            !query ||
            [
              transaction.accountCode,
              transaction.accountName,
              transaction.reference,
              transaction.description,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(query);

          const matchesFrom =
            !dateFrom ||
            transaction.date >= dateFrom;

          const matchesTo =
            !dateTo ||
            transaction.date <= dateTo;

          return (
            matchesSearch &&
            matchesFrom &&
            matchesTo
          );
        }
      );
    }, [
      transactions,
      search,
      dateFrom,
      dateTo,
    ]);

  const totals = useMemo(() => {
    return filteredTransactions.reduce(
      (total, transaction) => ({
        expenses:
          total.expenses +
          transaction.debit,

        credits:
          total.credits +
          transaction.credit,

        net:
          total.net +
          transaction.amount,
      }),
      {
        expenses: 0,
        credits: 0,
        net: 0,
      }
    );
  }, [filteredTransactions]);

  const accountSummary = useMemo(() => {
    const grouped = {};

    filteredTransactions.forEach(
      (transaction) => {
        const key =
          transaction.accountId;

        if (!grouped[key]) {
          grouped[key] = {
            id: key,
            code:
              transaction.accountCode,
            name:
              transaction.accountName,
            amount: 0,
            transactions: 0,
          };
        }

        grouped[key].amount +=
          transaction.amount;

        grouped[key].transactions += 1;
      }
    );

    return Object.values(grouped).sort(
      (a, b) => b.amount - a.amount
    );
  }, [filteredTransactions]);

  const exportCsv = () => {
    if (!filteredTransactions.length) {
      return;
    }

    const headers = [
      "Date",
      "Account Code",
      "Expense Account",
      "Reference",
      "Description",
      "Debit",
      "Credit",
      "Net Expense",
    ];

    const rows =
      filteredTransactions.map(
        (transaction) => [
          transaction.date,
          transaction.accountCode,
          transaction.accountName,
          transaction.reference,
          transaction.description,
          transaction.debit.toFixed(2),
          transaction.credit.toFixed(2),
          transaction.amount.toFixed(2),
        ]
      );

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) => {
            const text =
              String(value ?? "");

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
      `expense-report-${companyId}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearch("");
    setCurrencyFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  if (!companyId) {
    return (
      <div className="expense-reports-page">
        <div className="expense-reports-empty-company">
          <div className="expense-reports-empty-icon">
            <Wallet size={26} />
          </div>

          <h2>
            No Company Selected
          </h2>

          <p>
            Select a company before viewing
            expense reports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="expense-reports-page">
      {/* HEADER */}
      <div className="expense-reports-header">
        <div>
          <div className="expense-reports-eyebrow">
            REPORTS / EXPENSES
          </div>

          <h1>
            Expense Reports
          </h1>

          <p>
            Review expense activity and
            spending by account for{" "}
            <strong>
              {companyName}
            </strong>
            .
          </p>
        </div>

        <div className="expense-reports-header-actions">
          <button
            type="button"
            className="expense-reports-secondary-btn"
            onClick={() =>
              loadReport(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "expense-reports-spin"
                  : ""
              }
            />

            Refresh
          </button>

          <button
            type="button"
            className="expense-reports-primary-btn"
            onClick={exportCsv}
            disabled={
              !filteredTransactions.length
            }
          >
            <Download size={16} />

            Export CSV
          </button>
        </div>
      </div>

      {/* COMPANY STRIP */}
      <div className="expense-reports-company-strip">
        <div className="expense-reports-company-mark">
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

        <div className="expense-reports-currency">
          <span>
            Reporting Currency
          </span>

          <strong>
            {companyCurrency}
          </strong>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="expense-reports-alert">
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

      {/* SUMMARY */}
      <div className="expense-reports-stat-grid">
        <div className="expense-reports-stat-card">
          <div className="expense-reports-stat-icon blue">
            <FileBarChart size={19} />
          </div>

          <div>
            <span>
              Expense Accounts
            </span>

            <strong>
              {expenseAccounts.length}
            </strong>

            <small>
              Active accounts
            </small>
          </div>
        </div>

        <div className="expense-reports-stat-card">
          <div className="expense-reports-stat-icon gold">
            <Wallet size={19} />
          </div>

          <div>
            <span>
              Total Expenses
            </span>

            <strong>
              {money(
                totals.expenses,
                companyCurrency
              )}
            </strong>

            <small>
              Reported debits
            </small>
          </div>
        </div>

        <div className="expense-reports-stat-card">
          <div className="expense-reports-stat-icon navy">
            <BarChart3 size={19} />
          </div>

          <div>
            <span>
              Net Expense
            </span>

            <strong>
              {money(
                totals.net,
                companyCurrency
              )}
            </strong>

            <small>
              Debit less credits
            </small>
          </div>
        </div>

        <div className="expense-reports-stat-card">
          <div className="expense-reports-stat-icon dark">
            <CalendarDays size={19} />
          </div>

          <div>
            <span>
              Transactions
            </span>

            <strong>
              {filteredTransactions.length}
            </strong>

            <small>
              Matching records
            </small>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <section className="expense-reports-filter-card">
        <div className="expense-reports-filter-heading">
          <div>
            <span>
              REPORT FILTERS
            </span>

            <h2>
              Expense activity
            </h2>
          </div>

          {(search ||
            dateFrom ||
            dateTo ||
            currencyFilter !==
              "ALL") && (
            <button
              type="button"
              className="expense-reports-clear-btn"
              onClick={clearFilters}
            >
              <X size={14} />
              Clear Filters
            </button>
          )}
        </div>

        <div className="expense-reports-filters">
          <label className="expense-reports-search">
            <span>Search</span>

            <div>
              <Search size={16} />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Search account, reference or description..."
              />
            </div>
          </label>

          <label>
            <span>
              Currency
            </span>

            <select
              value={currencyFilter}
              onChange={(e) =>
                setCurrencyFilter(
                  e.target.value
                )
              }
            >
              <option value="ALL">
                All Currencies
              </option>

              <option value="USD">
                USD
              </option>

              <option value="LRD">
                LRD
              </option>
            </select>
          </label>

          <label>
            <span>
              From Date
            </span>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) =>
                setDateFrom(
                  e.target.value
                )
              }
            />
          </label>

          <label>
            <span>
              To Date
            </span>

            <input
              type="date"
              value={dateTo}
              onChange={(e) =>
                setDateTo(
                  e.target.value
                )
              }
            />
          </label>
        </div>
      </section>

      {/* REPORT BODY */}
      <div className="expense-reports-content-grid">
        {/* ACCOUNT SUMMARY */}
        <section className="expense-reports-summary-card">
          <div className="expense-reports-section-header">
            <div>
              <span>
                EXPENSE BREAKDOWN
              </span>

              <h2>
                By Account
              </h2>

              <p>
                Expense activity grouped by
                expense account.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="expense-reports-loading">
              <RefreshCw
                size={20}
                className="expense-reports-spin"
              />

              Loading expense report...
            </div>
          ) : accountSummary.length ===
            0 ? (
            <div className="expense-reports-empty">
              <Wallet size={27} />

              <strong>
                No expense activity
              </strong>

              <span>
                No expense transactions match
                the selected filters.
              </span>
            </div>
          ) : (
            <div className="expense-reports-account-list">
              {accountSummary.map(
                (account) => {
                  const percentage =
                    totals.net > 0
                      ? Math.min(
                          100,
                          Math.max(
                            0,
                            (account.amount /
                              totals.net) *
                              100
                          )
                        )
                      : 0;

                  return (
                    <div
                      key={account.id}
                      className="expense-reports-account-row"
                    >
                      <div className="expense-reports-account-main">
                        <div className="expense-reports-account-code">
                          {account.code}
                        </div>

                        <div>
                          <strong>
                            {account.name}
                          </strong>

                          <span>
                            {
                              account.transactions
                            }{" "}
                            transaction
                            {account.transactions ===
                            1
                              ? ""
                              : "s"}
                          </span>
                        </div>
                      </div>

                      <div className="expense-reports-account-amount">
                        <strong>
                          {money(
                            account.amount,
                            companyCurrency
                          )}
                        </strong>

                        <div className="expense-reports-progress">
                          <span
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* REPORT TABLE */}
        <section className="expense-reports-table-card">
          <div className="expense-reports-section-header">
            <div>
              <span>
                TRANSACTION DETAIL
              </span>

              <h2>
                Expense Transactions
              </h2>

              <p>
                Detailed expense activity from
                the general ledger.
              </p>
            </div>

            <span className="expense-reports-count">
              {filteredTransactions.length}{" "}
              record
              {filteredTransactions.length ===
              1
                ? ""
                : "s"}
            </span>
          </div>

          {loading ? (
            <div className="expense-reports-loading">
              <RefreshCw
                size={20}
                className="expense-reports-spin"
              />

              Loading transactions...
            </div>
          ) : filteredTransactions.length ===
            0 ? (
            <div className="expense-reports-empty">
              <FileBarChart size={27} />

              <strong>
                No transactions found
              </strong>

              <span>
                Try changing the report
                filters.
              </span>
            </div>
          ) : (
            <div className="expense-reports-table-wrapper">
              <table className="expense-reports-table">
                <thead>
                  <tr>
                    <th>
                      Date
                    </th>

                    <th>
                      Account
                    </th>

                    <th>
                      Reference
                    </th>

                    <th>
                      Description
                    </th>

                    <th className="amount">
                      Debit
                    </th>

                    <th className="amount">
                      Credit
                    </th>

                    <th className="amount">
                      Net Expense
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTransactions.map(
                    (transaction) => (
                      <tr
                        key={
                          transaction.id
                        }
                      >
                        <td>
                          {dateLabel(
                            transaction.date
                          )}
                        </td>

                        <td>
                          <div className="expense-reports-account-cell">
                            <strong>
                              {
                                transaction.accountName
                              }
                            </strong>

                            <span>
                              {
                                transaction.accountCode
                              }
                            </span>
                          </div>
                        </td>

                        <td>
                          <span className="expense-reports-reference">
                            {
                              transaction.reference
                            }
                          </span>
                        </td>

                        <td className="expense-reports-description">
                          {
                            transaction.description
                          }
                        </td>

                        <td className="amount">
                          {money(
                            transaction.debit,
                            companyCurrency
                          )}
                        </td>

                        <td className="amount">
                          {money(
                            transaction.credit,
                            companyCurrency
                          )}
                        </td>

                        <td className="amount net">
                          <strong>
                            {money(
                              transaction.amount,
                              companyCurrency
                            )}
                          </strong>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>

                <tfoot>
                  <tr>
                    <td
                      colSpan="4"
                    >
                      Total
                    </td>

                    <td className="amount">
                      {money(
                        totals.expenses,
                        companyCurrency
                      )}
                    </td>

                    <td className="amount">
                      {money(
                        totals.credits,
                        companyCurrency
                      )}
                    </td>

                    <td className="amount">
                      <strong>
                        {money(
                          totals.net,
                          companyCurrency
                        )}
                      </strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}