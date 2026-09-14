import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Building2,
  CreditCard,
  RefreshCw,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";

const CURRENCIES = ["USD", "LRD"];

function formatMoney(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getCurrencySymbol(currency) {
  if (currency === "USD") return "$";
  if (currency === "LRD") return "L$";
  return currency || "";
}

function getTransactionDirection(type) {
  if (
    type === "DEPOSIT" ||
    type === "TRANSFER_IN" ||
    type === "INTEREST"
  ) {
    return "in";
  }

  return "out";
}

function getTransactionCurrency(transaction, accounts) {
  const account = accounts.find(
    (item) => item.id === transaction.bank_account
  );

  return account?.currency || "USD";
}

export default function BankingDashboard() {
  const { currentCompany } = useCompany();

  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [chartCurrency, setChartCurrency] = useState("USD");

  const companyId = currentCompany?.id;

  const loadBankingData = async (showRefresh = false) => {
    if (!companyId) {
      setAccounts([]);
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      setError("");

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [accountsResponse, transactionsResponse] =
        await Promise.all([
          api.get(
            `/api/banking/accounts/?company=${companyId}`
          ),
          api.get(
            `/api/banking/transactions/?company=${companyId}`
          ),
        ]);

      setAccounts(
        Array.isArray(accountsResponse)
          ? accountsResponse
          : accountsResponse?.results || []
      );

      setTransactions(
        Array.isArray(transactionsResponse)
          ? transactionsResponse
          : transactionsResponse?.results || []
      );
    } catch (err) {
      setError(
        err?.data?.detail ||
          err?.message ||
          "Unable to load banking information."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBankingData();
  }, [companyId]);

  const activeAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.is_active !== false
      ),
    [accounts]
  );

  const currencyBalances = useMemo(() => {
    return CURRENCIES.reduce(
      (result, currency) => {
        result[currency] = activeAccounts
          .filter(
            (account) => account.currency === currency
          )
          .reduce(
            (total, account) =>
              total +
              Number(
                account.bank_account_balance || 0
              ),
            0
          );

        return result;
      },
      {
        USD: 0,
        LRD: 0,
      }
    );
  }, [activeAccounts]);

  const transactionCurrencyData = useMemo(() => {
    return transactions.map((transaction) => ({
      ...transaction,
      currency: getTransactionCurrency(
        transaction,
        accounts
      ),
      direction: getTransactionDirection(
        transaction.transaction_type
      ),
    }));
  }, [transactions, accounts]);

  const currencyInflows = useMemo(() => {
    return CURRENCIES.reduce(
      (result, currency) => {
        result[currency] = transactionCurrencyData
          .filter(
            (transaction) =>
              transaction.currency === currency &&
              transaction.direction === "in"
          )
          .reduce(
            (total, transaction) =>
              total + Number(transaction.amount || 0),
            0
          );

        return result;
      },
      {
        USD: 0,
        LRD: 0,
      }
    );
  }, [transactionCurrencyData]);

  const currencyOutflows = useMemo(() => {
    return CURRENCIES.reduce(
      (result, currency) => {
        result[currency] = transactionCurrencyData
          .filter(
            (transaction) =>
              transaction.currency === currency &&
              transaction.direction === "out"
          )
          .reduce(
            (total, transaction) =>
              total + Number(transaction.amount || 0),
            0
          );

        return result;
      },
      {
        USD: 0,
        LRD: 0,
      }
    );
  }, [transactionCurrencyData]);

  const chartData = useMemo(() => {
    const currencyTransactions =
      transactionCurrencyData.filter(
        (transaction) =>
          transaction.currency === chartCurrency
      );

    const grouped = {};

    currencyTransactions.forEach((transaction) => {
      const date = transaction.transaction_date;

      if (!grouped[date]) {
        grouped[date] = {
          date,
          inflows: 0,
          outflows: 0,
        };
      }

      if (transaction.direction === "in") {
        grouped[date].inflows += Number(
          transaction.amount || 0
        );
      } else {
        grouped[date].outflows += Number(
          transaction.amount || 0
        );
      }
    });

    return Object.values(grouped)
      .sort(
        (a, b) =>
          new Date(a.date) - new Date(b.date)
      )
      .slice(-10)
      .map((item) => ({
        ...item,
        label: formatDate(item.date),
      }));
  }, [
    transactionCurrencyData,
    chartCurrency,
  ]);

  const recentTransactions = useMemo(
    () =>
      [...transactionCurrencyData]
        .sort((a, b) => {
          const first = new Date(
            a.transaction_date
          ).getTime();

          const second = new Date(
            b.transaction_date
          ).getTime();

          return second - first;
        })
        .slice(0, 8),
    [transactionCurrencyData]
  );

  const getAccountName = (accountId) => {
    const account = accounts.find(
      (item) => item.id === accountId
    );

    return (
      account?.account_name ||
      account?.bank_account_name ||
      "Bank Account"
    );
  };

  if (!currentCompany) {
    return (
      <div className="bank-dashboard-page">
        <div className="bank-dashboard-empty">
          <Building2 size={28} />
          <h2>No Company Selected</h2>
          <p>
            Select a company to view its banking
            dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bank-dashboard-page">
      {/* ================================================== */}
      {/* HEADER */}
      {/* ================================================== */}

      <div className="bank-dashboard-header">
        <div>
          <div className="bank-dashboard-eyebrow">
            BANKING
          </div>

          <h1>Banking Dashboard</h1>

          <p>
            Monitor bank balances, cash movements,
            transfers, fees, and interest for{" "}
            <strong>
              {currentCompany.name}
            </strong>
            .
          </p>
        </div>

        <button
          type="button"
          className="bank-dashboard-refresh"
          onClick={() => loadBankingData(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={17}
            className={
              refreshing
                ? "bank-dashboard-spin"
                : ""
            }
          />

          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* ================================================== */}
      {/* COMPANY STRIP */}
      {/* ================================================== */}

      <div className="bank-dashboard-company-strip">
        <div className="bank-company-icon">
          <Building2 size={20} />
        </div>

        <div>
          <span>Current Company</span>
          <strong>{currentCompany.name}</strong>
        </div>

        <div className="bank-company-meta">
          <span>Functional Currency</span>
          <strong>
            {currentCompany.currency || "USD"}
          </strong>
        </div>

        <div className="bank-company-meta">
          <span>Active Accounts</span>
          <strong>{activeAccounts.length}</strong>
        </div>
      </div>

      {error && (
        <div className="bank-dashboard-error">
          {error}
        </div>
      )}

      {/* ================================================== */}
      {/* BALANCE CARDS */}
      {/* ================================================== */}

      <div className="bank-dashboard-balance-grid">
        {CURRENCIES.map((currency) => (
          <div
            key={currency}
            className="bank-dashboard-balance-card"
          >
            <div className="bank-dashboard-card-top">
              <div>
                <span>
                  {currency} Bank Balance
                </span>

                <h2>
                  {getCurrencySymbol(currency)}
                  {formatMoney(
                    currencyBalances[currency]
                  )}
                </h2>
              </div>

              <div className="bank-dashboard-card-icon">
                <Wallet size={21} />
              </div>
            </div>

            <div className="bank-dashboard-card-footer">
              <span>
                {
                  activeAccounts.filter(
                    (account) =>
                      account.currency === currency
                  ).length
                }{" "}
                active{" "}
                {currency} account
                {activeAccounts.filter(
                  (account) =>
                    account.currency === currency
                ).length !== 1
                  ? "s"
                  : ""}
              </span>
            </div>
          </div>
        ))}

        <div className="bank-dashboard-stat-card">
          <div className="bank-dashboard-stat-icon">
            <ArrowDownLeft size={20} />
          </div>

          <div>
            <span>USD Inflows</span>
            <strong>
              $
              {formatMoney(
                currencyInflows.USD
              )}
            </strong>
          </div>
        </div>

        <div className="bank-dashboard-stat-card">
          <div className="bank-dashboard-stat-icon">
            <ArrowUpRight size={20} />
          </div>

          <div>
            <span>LRD Inflows</span>
            <strong>
              L$
              {formatMoney(
                currencyInflows.LRD
              )}
            </strong>
          </div>
        </div>

        <div className="bank-dashboard-stat-card">
          <div className="bank-dashboard-stat-icon">
            <ArrowUpRight size={20} />
          </div>

          <div>
            <span>USD Outflows</span>
            <strong>
              $
              {formatMoney(
                currencyOutflows.USD
              )}
            </strong>
          </div>
        </div>

        <div className="bank-dashboard-stat-card">
          <div className="bank-dashboard-stat-icon">
            <ArrowDownLeft size={20} />
          </div>

          <div>
            <span>LRD Outflows</span>
            <strong>
              L$
              {formatMoney(
                currencyOutflows.LRD
              )}
            </strong>
          </div>
        </div>
      </div>

      {/* ================================================== */}
      {/* ACCOUNT OVERVIEW */}
      {/* ================================================== */}

      <section className="bank-dashboard-section">
        <div className="bank-dashboard-section-header">
          <div>
            <h2>Bank Accounts</h2>
            <p>
              Current balances by physical bank
              account.
            </p>
          </div>

          <span className="bank-dashboard-count">
            {activeAccounts.length} Active
          </span>
        </div>

        {loading ? (
          <div className="bank-dashboard-loading">
            Loading bank accounts...
          </div>
        ) : activeAccounts.length === 0 ? (
          <div className="bank-dashboard-empty-inline">
            <CreditCard size={24} />
            <p>
              No active bank accounts found for
              this company.
            </p>
          </div>
        ) : (
          <div className="bank-dashboard-account-grid">
            {activeAccounts.map((account) => (
              <div
                key={account.id}
                className="bank-dashboard-account-card"
              >
                <div className="bank-account-card-header">
                  <div className="bank-account-card-icon">
                    <CreditCard size={18} />
                  </div>

                  <span className="bank-account-currency">
                    {account.currency}
                  </span>
                </div>

                <div className="bank-account-card-name">
                  <strong>
                    {account.account_name}
                  </strong>

                  <span>
                    {account.bank_name}
                  </span>
                </div>

                <div className="bank-account-card-number">
                  ••••{" "}
                  {String(
                    account.account_number || ""
                  ).slice(-4)}
                </div>

                <div className="bank-account-card-balance">
                  <span>Current Balance</span>

                  <strong>
                    {getCurrencySymbol(
                      account.currency
                    )}
                    {formatMoney(
                      account.bank_account_balance
                    )}
                  </strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ================================================== */}
      {/* MOVEMENT CHART */}
      {/* ================================================== */}

      <section className="bank-dashboard-section">
        <div className="bank-dashboard-section-header bank-chart-header">
          <div>
            <h2>Cash Movement</h2>
            <p>
              Inflows and outflows by transaction
              date.
            </p>
          </div>

          <div className="bank-currency-switcher">
            {CURRENCIES.map((currency) => (
              <button
                key={currency}
                type="button"
                className={
                  chartCurrency === currency
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setChartCurrency(currency)
                }
              >
                {currency}
              </button>
            ))}
          </div>
        </div>

        <div className="bank-dashboard-chart-card">
          {chartData.length === 0 ? (
            <div className="bank-dashboard-chart-empty">
              <ArrowRightLeft size={24} />
              <p>
                No {chartCurrency} banking
                activity available yet.
              </p>
            </div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={330}
            >
              <BarChart
                data={chartData}
                margin={{
                  top: 10,
                  right: 10,
                  left: 10,
                  bottom: 10,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="label"
                  tick={{
                    fontSize: 12,
                  }}
                  tickLine={false}
                  axisLine={false}
                />

                <YAxis
                  tick={{
                    fontSize: 12,
                  }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    `${getCurrencySymbol(
                      chartCurrency
                    )}${Number(
                      value
                    ).toLocaleString()}`
                  }
                />

                <Tooltip
                  formatter={(value, name) => [
                    `${getCurrencySymbol(
                      chartCurrency
                    )}${formatMoney(value)}`,
                    name === "inflows"
                      ? "Inflows"
                      : "Outflows",
                  ]}
                  labelFormatter={(label) =>
                    label
                  }
                />

                <Bar
                  dataKey="inflows"
                  name="inflows"
                  fill="#123C78"
                  radius={[
                    5,
                    5,
                    0,
                    0,
                  ]}
                />

                <Bar
                  dataKey="outflows"
                  name="outflows"
                  fill="#D99A00"
                  radius={[
                    5,
                    5,
                    0,
                    0,
                  ]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ================================================== */}
      {/* RECENT TRANSACTIONS */}
      {/* ================================================== */}

      <section className="bank-dashboard-section">
        <div className="bank-dashboard-section-header">
          <div>
            <h2>Recent Transactions</h2>
            <p>
              Latest banking movements for this
              company.
            </p>
          </div>

          <span className="bank-dashboard-count">
            {transactions.length} Total
          </span>
        </div>

        <div className="bank-dashboard-table-wrapper">
          {loading ? (
            <div className="bank-dashboard-loading">
              Loading transactions...
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="bank-dashboard-empty-inline">
              <ArrowRightLeft size={24} />
              <p>
                No banking transactions found.
              </p>
            </div>
          ) : (
            <table className="bank-dashboard-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Bank Account</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th className="amount-column">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {recentTransactions.map(
                  (transaction) => {
                    const isInflow =
                      transaction.direction ===
                      "in";

                    return (
                      <tr
                        key={transaction.id}
                      >
                        <td>
                          {formatDate(
                            transaction.transaction_date
                          )}
                        </td>

                        <td>
                          <span
                            className={`bank-transaction-badge ${
                              isInflow
                                ? "inflow"
                                : "outflow"
                            }`}
                          >
                            {transaction.transaction_type_display ||
                              transaction.transaction_type}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {getAccountName(
                              transaction.bank_account
                            )}
                          </strong>
                        </td>

                        <td>
                          {transaction.reference ||
                            "—"}
                        </td>

                        <td className="description-cell">
                          {transaction.description ||
                            "—"}
                        </td>

                        <td
                          className={`amount-column ${
                            isInflow
                              ? "amount-in"
                              : "amount-out"
                          }`}
                        >
                          {isInflow
                            ? "+"
                            : "-"}
                          {getCurrencySymbol(
                            transaction.currency
                          )}
                          {formatMoney(
                            transaction.amount
                          )}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}