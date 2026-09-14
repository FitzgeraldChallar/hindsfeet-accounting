import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpLeft,
  ArrowUpRight,
  ChevronDown,
  Download,
  FileText,
  Landmark,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";

const formatMoney = (value) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
};

const formatDate = (value) => {
  if (!value) return "—";

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

const currencySymbol = (currency) =>
  currency === "LRD" ? "L$" : "$";

const transactionLabel = (transaction) => {
  if (transaction.transaction_type_display) {
    return transaction.transaction_type_display;
  }

  const labels = {
    DEPOSIT: "Deposit",
    WITHDRAWAL: "Withdrawal",
    TRANSFER_IN: "Transfer In",
    TRANSFER_OUT: "Transfer Out",
    BANK_FEE: "Bank Fee",
    INTEREST: "Interest",
    ADJUSTMENT: "Adjustment",
  };

  return (
    labels[transaction.transaction_type] ||
    transaction.transaction_type ||
    "Transaction"
  );
};

const transactionDirection = (type) => {
  switch (type) {
    case "DEPOSIT":
    case "TRANSFER_IN":
    case "INTEREST":
      return "IN";

    case "WITHDRAWAL":
    case "TRANSFER_OUT":
    case "BANK_FEE":
      return "OUT";

    case "ADJUSTMENT":
      return "ADJUSTMENT";

    default:
      return "OTHER";
  }
};

const transactionIcon = (type) => {
  switch (type) {
    case "DEPOSIT":
      return <ArrowDownLeft size={16} />;

    case "WITHDRAWAL":
      return <ArrowUpRight size={16} />;

    case "TRANSFER_IN":
      return <ArrowDownRight size={16} />;

    case "TRANSFER_OUT":
      return <ArrowUpLeft size={16} />;

    case "BANK_FEE":
      return <ArrowUpRight size={16} />;

    case "INTEREST":
      return <ArrowDownLeft size={16} />;

    case "ADJUSTMENT":
      return <RefreshCw size={16} />;

    default:
      return <FileText size={16} />;
  }
};

export default function BankTransactions() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;

  const [bankAccounts, setBankAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [currencyFilter, setCurrencyFilter] =
    useState("ALL");
  const [accountFilter, setAccountFilter] =
    useState("ALL");
  const [directionFilter, setDirectionFilter] =
    useState("ALL");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedTransaction, setSelectedTransaction] =
    useState(null);

  // ============================================================
  // LOAD DATA
  // ============================================================

  const loadData = async () => {
    if (!companyId) {
      setBankAccounts([]);
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [
        bankAccountsResponse,
        transactionsResponse,
      ] = await Promise.all([
        api.get(
          `/api/banking/accounts/?company=${companyId}`
        ),
        api.get(
          `/api/banking/transactions/?company=${companyId}`
        ),
      ]);

      const bankData = Array.isArray(
        bankAccountsResponse
      )
        ? bankAccountsResponse
        : bankAccountsResponse?.results || [];

      const transactionData = Array.isArray(
        transactionsResponse
      )
        ? transactionsResponse
        : transactionsResponse?.results || [];

      setBankAccounts(bankData);
      setTransactions(transactionData);
    } catch (err) {
      setError(
        err?.data?.detail ||
          err?.message ||
          "Unable to load banking transactions."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  // ============================================================
  // ENRICH TRANSACTIONS
  // ============================================================

  const enrichedTransactions = useMemo(() => {
    return transactions.map((transaction) => {
      const bankAccount = bankAccounts.find(
        (account) =>
          Number(account.id) ===
          Number(transaction.bank_account)
      );

      const currency =
        bankAccount?.currency || "USD";

      const direction = transactionDirection(
        transaction.transaction_type
      );

      return {
        ...transaction,
        resolvedBankAccount: bankAccount,
        currency,
        direction,
      };
    });
  }, [transactions, bankAccounts]);

  // ============================================================
  // FILTERED TRANSACTIONS
  // ============================================================

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return enrichedTransactions.filter(
      (transaction) => {
        const text = [
          transaction.reference,
          transaction.description,
          transaction.bank_name,
          transaction.bank_account_name,
          transaction.account_number,
          transaction.transaction_type_display,
          transaction.transaction_type,
          transaction.currency,
          transaction.journal_entry,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !query || text.includes(query);

        const matchesType =
          typeFilter === "ALL" ||
          transaction.transaction_type ===
            typeFilter;

        const matchesCurrency =
          currencyFilter === "ALL" ||
          transaction.currency ===
            currencyFilter;

        const matchesAccount =
          accountFilter === "ALL" ||
          String(transaction.bank_account) ===
            String(accountFilter);

        const matchesDirection =
          directionFilter === "ALL" ||
          transaction.direction ===
            directionFilter;

        const matchesFrom =
          !dateFrom ||
          transaction.transaction_date >=
            dateFrom;

        const matchesTo =
          !dateTo ||
          transaction.transaction_date <=
            dateTo;

        return (
          matchesSearch &&
          matchesType &&
          matchesCurrency &&
          matchesAccount &&
          matchesDirection &&
          matchesFrom &&
          matchesTo
        );
      }
    );
  }, [
    enrichedTransactions,
    search,
    typeFilter,
    currencyFilter,
    accountFilter,
    directionFilter,
    dateFrom,
    dateTo,
  ]);

  // ============================================================
  // CURRENCY TOTALS
  // ============================================================

  const totals = useMemo(() => {
    const result = {
      USD: {
        inflow: 0,
        outflow: 0,
        net: 0,
        count: 0,
      },
      LRD: {
        inflow: 0,
        outflow: 0,
        net: 0,
        count: 0,
      },
    };

    filteredTransactions.forEach(
      (transaction) => {
        const currency = transaction.currency;

        if (!result[currency]) {
          return;
        }

        const amount = Number(
          transaction.amount || 0
        );

        result[currency].count += 1;

        if (transaction.direction === "IN") {
          result[currency].inflow += amount;
          result[currency].net += amount;
        }

        if (transaction.direction === "OUT") {
          result[currency].outflow += amount;
          result[currency].net -= amount;
        }

        /*
         * Adjustments are intentionally excluded from
         * automatic inflow/outflow totals because the
         * existing BankTransaction model does not persist
         * whether an adjustment increased or decreased
         * the bank balance.
         */
      }
    );

    return result;
  }, [filteredTransactions]);

  // ============================================================
  // CLEAR FILTERS
  // ============================================================

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("ALL");
    setCurrencyFilter("ALL");
    setAccountFilter("ALL");
    setDirectionFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters =
    search ||
    typeFilter !== "ALL" ||
    currencyFilter !== "ALL" ||
    accountFilter !== "ALL" ||
    directionFilter !== "ALL" ||
    dateFrom ||
    dateTo;

  // ============================================================
  // CSV EXPORT
  // ============================================================

  const exportCSV = () => {
    if (!filteredTransactions.length) {
      setError(
        "There are no transactions to export."
      );
      return;
    }

    const rows = filteredTransactions.map(
      (transaction) => ({
        Date:
          transaction.transaction_date || "",
        Type:
          transactionLabel(transaction),
        Direction:
          transaction.direction ===
          "ADJUSTMENT"
            ? "Adjustment"
            : transaction.direction,
        Bank:
          transaction.bank_name || "",
        Account:
          transaction.bank_account_name ||
          "",
        AccountNumber:
          transaction.account_number || "",
        Currency:
          transaction.currency || "",
        Amount:
          transaction.amount || "",
        Reference:
          transaction.reference || "",
        Description:
          transaction.description || "",
        JournalEntry:
          transaction.journal_entry || "",
      })
    );

    const headers = Object.keys(rows[0]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = row[header] ?? "";

            return `"${String(value).replace(
              /"/g,
              '""'
            )}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = `bank-transactions-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="bank-transactions-page">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="bank-transactions-header">
        <div>
          <div className="bank-transactions-eyebrow">
            BANKING
          </div>

          <h1>Bank Transactions</h1>

          <p>
            Complete transaction history across all
            company bank accounts.
          </p>
        </div>

        <button
          type="button"
          className="bank-transactions-refresh-btn"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw
            size={17}
            className={
              loading
                ? "bank-transactions-spin"
                : ""
            }
          />
          Refresh
        </button>
      </div>

      {/* ======================================================
          COMPANY STRIP
      ====================================================== */}

      <div className="bank-transactions-company-strip">
        <div className="bank-transactions-company-icon">
          <Landmark size={20} />
        </div>

        <div>
          <span>Current Company</span>

          <strong>
            {currentCompany?.name ||
              "No company selected"}
          </strong>
        </div>

        <div className="bank-transactions-company-divider" />

        <div>
          <span>Functional Currency</span>

          <strong>
            {currentCompany?.currency || "USD"}
          </strong>
        </div>

        <div className="bank-transactions-company-divider" />

        <div>
          <span>Transactions</span>

          <strong>
            {transactions.length}
          </strong>
        </div>

        <div className="bank-transactions-company-divider" />

        <div>
          <span>Bank Accounts</span>

          <strong>
            {bankAccounts.length}
          </strong>
        </div>
      </div>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="bank-transactions-alert">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ======================================================
          KPI CARDS
      ====================================================== */}

      <div className="bank-transactions-kpis">
        <div className="bank-transactions-kpi-card">
          <div className="bank-transactions-kpi-icon blue">
            <FileText size={19} />
          </div>

          <div>
            <span>Transactions</span>

            <strong>
              {filteredTransactions.length}
            </strong>

            <small>
              Current filtered view
            </small>
          </div>
        </div>

        <div className="bank-transactions-kpi-card">
          <div className="bank-transactions-kpi-icon gold">
            <ArrowDownLeft size={19} />
          </div>

          <div>
            <span>USD Inflows</span>

            <strong>
              $ {formatMoney(
                totals.USD.inflow
              )}
            </strong>

            <small>
              Deposits, interest & transfers in
            </small>
          </div>
        </div>

        <div className="bank-transactions-kpi-card">
          <div className="bank-transactions-kpi-icon navy">
            <ArrowUpRight size={19} />
          </div>

          <div>
            <span>USD Outflows</span>

            <strong>
              $ {formatMoney(
                totals.USD.outflow
              )}
            </strong>

            <small>
              Withdrawals, fees & transfers out
            </small>
          </div>
        </div>

        <div className="bank-transactions-kpi-card">
          <div className="bank-transactions-kpi-icon slate">
            <Landmark size={19} />
          </div>

          <div>
            <span>LRD Net Movement</span>

            <strong>
              L$ {formatMoney(
                totals.LRD.net
              )}
            </strong>

            <small>
              Inflows less outflows
            </small>
          </div>
        </div>
      </div>

      {/* ======================================================
          CURRENCY SUMMARY
      ====================================================== */}

      <div className="bank-transactions-summary-grid">
        <div className="bank-transactions-summary-card">
          <div className="bank-transactions-summary-header">
            <div>
              <span>USD ACTIVITY</span>
              <h2>US Dollar</h2>
            </div>

            <div className="bank-transactions-summary-currency">
              USD
            </div>
          </div>

          <div className="bank-transactions-summary-values">
            <div>
              <span>Inflows</span>
              <strong>
                $ {formatMoney(
                  totals.USD.inflow
                )}
              </strong>
            </div>

            <div>
              <span>Outflows</span>
              <strong>
                $ {formatMoney(
                  totals.USD.outflow
                )}
              </strong>
            </div>

            <div>
              <span>Net</span>
              <strong>
                $ {formatMoney(
                  totals.USD.net
                )}
              </strong>
            </div>
          </div>
        </div>

        <div className="bank-transactions-summary-card">
          <div className="bank-transactions-summary-header">
            <div>
              <span>LRD ACTIVITY</span>
              <h2>Liberian Dollar</h2>
            </div>

            <div className="bank-transactions-summary-currency">
              LRD
            </div>
          </div>

          <div className="bank-transactions-summary-values">
            <div>
              <span>Inflows</span>
              <strong>
                L$ {formatMoney(
                  totals.LRD.inflow
                )}
              </strong>
            </div>

            <div>
              <span>Outflows</span>
              <strong>
                L$ {formatMoney(
                  totals.LRD.outflow
                )}
              </strong>
            </div>

            <div>
              <span>Net</span>
              <strong>
                L$ {formatMoney(
                  totals.LRD.net
                )}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================
          TRANSACTION TABLE
      ====================================================== */}

      <section className="bank-transactions-card">
        <div className="bank-transactions-card-header">
          <div>
            <span>GENERAL LEDGER VIEW</span>

            <h2>All Bank Transactions</h2>
          </div>

          <button
            type="button"
            className="bank-transactions-export-btn"
            onClick={exportCSV}
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="bank-transactions-filters">
          <div className="bank-transactions-search">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search transactions..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <div className="bank-transactions-filter">
            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All transaction types
              </option>

              <option value="DEPOSIT">
                Deposits
              </option>

              <option value="WITHDRAWAL">
                Withdrawals
              </option>

              <option value="TRANSFER_IN">
                Transfers In
              </option>

              <option value="TRANSFER_OUT">
                Transfers Out
              </option>

              <option value="BANK_FEE">
                Bank Fees
              </option>

              <option value="INTEREST">
                Interest
              </option>

              <option value="ADJUSTMENT">
                Adjustments
              </option>
            </select>

            <ChevronDown size={15} />
          </div>

          <div className="bank-transactions-filter">
            <select
              value={currencyFilter}
              onChange={(event) =>
                setCurrencyFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All currencies
              </option>

              <option value="USD">
                USD
              </option>

              <option value="LRD">
                LRD
              </option>
            </select>

            <ChevronDown size={15} />
          </div>

          <div className="bank-transactions-filter">
            <select
              value={accountFilter}
              onChange={(event) =>
                setAccountFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All bank accounts
              </option>

              {bankAccounts.map(
                (account) => (
                  <option
                    key={account.id}
                    value={account.id}
                  >
                    {account.bank_name} —{" "}
                    {account.account_name}
                  </option>
                )
              )}
            </select>

            <ChevronDown size={15} />
          </div>

          <div className="bank-transactions-filter">
            <select
              value={directionFilter}
              onChange={(event) =>
                setDirectionFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All movements
              </option>

              <option value="IN">
                Inflows
              </option>

              <option value="OUT">
                Outflows
              </option>

              <option value="ADJUSTMENT">
                Adjustments
              </option>
            </select>

            <ChevronDown size={15} />
          </div>
        </div>

        {/* Date filters */}
        <div className="bank-transactions-date-filters">
          <div>
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

          <div>
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
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="bank-transactions-empty">
            <RefreshCw
              size={26}
              className="bank-transactions-spin"
            />

            <strong>
              Loading transactions...
            </strong>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="bank-transactions-empty">
            <FileText size={30} />

            <strong>
              No transactions found
            </strong>

            <span>
              Try changing your filters or
              search criteria.
            </span>
          </div>
        ) : (
          <div className="bank-transactions-table-wrap">
            <table className="bank-transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Transaction</th>
                  <th>Bank Account</th>
                  <th>Currency</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filteredTransactions.map(
                  (transaction) => (
                    <tr
                      key={transaction.id}
                    >
                      <td>
                        {formatDate(
                          transaction.transaction_date
                        )}
                      </td>

                      <td>
                        <div className="bank-transactions-type-cell">
                          <div
                            className={`bank-transactions-type-icon ${transaction.direction.toLowerCase()}`}
                          >
                            {transactionIcon(
                              transaction.transaction_type
                            )}
                          </div>

                          <div>
                            <strong>
                              {transactionLabel(
                                transaction
                              )}
                            </strong>

                            <span>
                              #
                              {
                                transaction.id
                              }
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="bank-transactions-account-cell">
                          <strong>
                            {transaction.bank_name ||
                              transaction
                                .resolvedBankAccount
                                ?.bank_name ||
                              "Bank"}
                          </strong>

                          <span>
                            {transaction.bank_account_name ||
                              transaction
                                .resolvedBankAccount
                                ?.account_name ||
                              "Account"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className="bank-transactions-currency-badge">
                          {
                            transaction.currency
                          }
                        </span>
                      </td>

                      <td>
                        <strong className="bank-transactions-amount">
                          {currencySymbol(
                            transaction.currency
                          )}{" "}
                          {formatMoney(
                            transaction.amount
                          )}
                        </strong>
                      </td>

                      <td>
                        {transaction.reference ||
                          "—"}
                      </td>

                      <td className="bank-transactions-description">
                        {transaction.description ||
                          "—"}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="bank-transactions-view-btn"
                          onClick={() =>
                            setSelectedTransaction(
                              transaction
                            )
                          }
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ======================================================
          DETAIL MODAL
      ====================================================== */}

      {selectedTransaction && (
        <div
          className="bank-transactions-modal-backdrop"
          onClick={() =>
            setSelectedTransaction(null)
          }
        >
          <div
            className="bank-transactions-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="bank-transactions-modal-header">
              <div>
                <span>
                  TRANSACTION DETAILS
                </span>

                <h2>
                  {transactionLabel(
                    selectedTransaction
                  )}{" "}
                  #
                  {
                    selectedTransaction.id
                  }
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedTransaction(
                    null
                  )
                }
              >
                <X size={19} />
              </button>
            </div>

            <div className="bank-transactions-modal-body">
              <div className="bank-transactions-detail-grid">
                <div>
                  <span>Date</span>

                  <strong>
                    {formatDate(
                      selectedTransaction.transaction_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>Transaction Type</span>

                  <strong>
                    {transactionLabel(
                      selectedTransaction
                    )}
                  </strong>
                </div>

                <div>
                  <span>Currency</span>

                  <strong>
                    {
                      selectedTransaction.currency
                    }
                  </strong>
                </div>

                <div>
                  <span>Amount</span>

                  <strong>
                    {currencySymbol(
                      selectedTransaction.currency
                    )}{" "}
                    {formatMoney(
                      selectedTransaction.amount
                    )}
                  </strong>
                </div>
              </div>

              <div className="bank-transactions-modal-account">
                <div className="bank-transactions-modal-icon">
                  <Landmark size={17} />
                </div>

                <div>
                  <span>
                    Bank Account
                  </span>

                  <strong>
                    {
                      selectedTransaction.bank_name
                    }{" "}
                    —{" "}
                    {
                      selectedTransaction.bank_account_name
                    }
                  </strong>

                  {selectedTransaction.account_number && (
                    <small>
                      Account #
                      {
                        selectedTransaction.account_number
                      }
                    </small>
                  )}
                </div>
              </div>

              <div className="bank-transactions-detail-block">
                <span>Reference</span>

                <strong>
                  {selectedTransaction.reference ||
                    "No reference provided"}
                </strong>
              </div>

              <div className="bank-transactions-detail-block">
                <span>Description</span>

                <p>
                  {selectedTransaction.description ||
                    "No description provided."}
                </p>
              </div>

              <div className="bank-transactions-journal">
                <FileText size={16} />

                <span>
                  Journal Entry
                </span>

                <strong>
                  #
                  {
                    selectedTransaction.journal_entry ||
                    "—"
                  }
                </strong>
              </div>
            </div>

            <div className="bank-transactions-modal-footer">
              <button
                type="button"
                onClick={() =>
                  setSelectedTransaction(
                    null
                  )
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