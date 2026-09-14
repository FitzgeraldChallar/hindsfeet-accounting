import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "../services/api";
import { useCompany } from "../context/CompanyContext";

/* ============================================================
   HELPERS
   ============================================================ */

const list = (data) =>
  Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data?.data)
    ? data.data
    : [];

const n = (v) => Number(v || 0);

const money = (v, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n(v));

const today = () =>
  new Date().toISOString().slice(0, 10);

const dateLabel = (v) => {
  if (!v) return "—";

  const d = new Date(`${v}T00:00:00`);

  return Number.isNaN(d.getTime())
    ? v
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(d);
};

const monthKey = (v) =>
  String(v || "").slice(0, 7);

const sixMonths = () => {
  const result = [];
  const now = new Date();

  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(
      now.getFullYear(),
      now.getMonth() - i,
      1
    );

    result.push({
      key: `${d.getFullYear()}-${String(
        d.getMonth() + 1
      ).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat(
        "en-US",
        {
          month: "short",
        }
      ).format(d),
    });
  }

  return result;
};

const getCurrencySymbol = (currency) => {
  if (currency === "USD") return "$";
  if (currency === "LRD") return "L$";
  return currency || "";
};

/* ============================================================
   KPI
   ============================================================ */

function Kpi({
  icon: Icon,
  label,
  value,
  note,
}) {
  return (
    <div className="expenses-kpi">
      <div className="expenses-kpi-icon">
        <Icon size={20} />
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  );
}

/* ============================================================
   EMPTY
   ============================================================ */

function Empty({ title, text }) {
  return (
    <div className="expenses-empty">
      <div className="expenses-empty-icon">
        <FileText size={21} />
      </div>

      <strong>{title}</strong>

      <span>{text}</span>
    </div>
  );
}

/* ============================================================
   STATUS
   ============================================================ */

function Status() {
  return (
    <span className="expenses-status">
      Posted
    </span>
  );
}

/* ============================================================
   RECORD EXPENSE MODAL
   ============================================================ */

function RecordExpenseModal({
  open,
  onClose,
  accounts,
  bankAccounts,
  companyId,
  currency,
  onSaved,
}) {
  const [form, setForm] = useState({
    expense_account: "",
    payment_account: "",
    amount: "",
    transaction_date: today(),
    reference: "",
    description: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const expenseAccounts = accounts.filter(
    (a) =>
      a.account_type === "EXPENSE" &&
      a.is_active !== false
  );

  const paymentAccounts = accounts.filter(
    (a) =>
      a.account_type === "ASSET" &&
      a.is_active !== false
  );

  /*
   * Determine the currency of a payment/accounting
   * account when it represents a dedicated physical
   * bank account.
   */
  const getPaymentAccountCurrency = (
    accountId
  ) => {
    const bankAccount = bankAccounts.find(
      (bank) =>
        Number(bank.accounting_account) ===
        Number(accountId)
    );

    return (
      bankAccount?.currency ||
      currency ||
      "USD"
    );
  };

  const selectedPaymentCurrency =
    getPaymentAccountCurrency(
      form.payment_account
    );

  const selectedExpenseAccount =
    expenseAccounts.find(
      (a) =>
        String(a.id) ===
        String(form.expense_account)
    );

  const selectedPaymentAccount =
    paymentAccounts.find(
      (a) =>
        String(a.id) ===
        String(form.payment_account)
    );

  useEffect(() => {
    if (!open) return;

    setForm({
      expense_account: expenseAccounts[0]?.id
        ? String(expenseAccounts[0].id)
        : "",
      payment_account: paymentAccounts[0]?.id
        ? String(paymentAccounts[0].id)
        : "",
      amount: "",
      transaction_date: today(),
      reference: "",
      description: "",
    });

    setError("");
  }, [
    open,
    accounts.length,
    bankAccounts.length,
  ]);

  if (!open) return null;

  const change = (e) => {
    setForm((p) => ({
      ...p,
      [e.target.name]: e.target.value,
    }));

    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!companyId) {
      setError(
        "Please select a company first."
      );
      return;
    }

    if (
      !form.expense_account ||
      !form.payment_account
    ) {
      setError(
        "Select both accounts."
      );
      return;
    }

    if (n(form.amount) <= 0) {
      setError(
        "Amount must be greater than zero."
      );
      return;
    }

    if (!form.description.trim()) {
      setError(
        "Description is required."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const entry = await api.post(
        "/api/accounting/journal-entries/",
        {
          company: Number(companyId),

          reference:
            form.reference.trim() ||
            `EXP-${Date.now()}`,

          description:
            form.description.trim(),

          transaction_date:
            form.transaction_date,

          lines: [
            {
              account: Number(
                form.expense_account
              ),
              description:
                form.description.trim(),
              debit: form.amount,
              credit: "0.00",
            },
            {
              account: Number(
                form.payment_account
              ),
              description:
                form.description.trim(),
              debit: "0.00",
              credit: form.amount,
            },
          ],
        }
      );

      await api.post(
        `/api/accounting/journal-entries/${entry.id}/post/`,
        {}
      );

      onSaved();
      onClose();
    } catch (err) {
      setError(
        err?.message ||
          "Unable to record expense."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="expenses-modal-backdrop">
      <div className="expenses-modal">
        <div className="expenses-modal-header">
          <div>
            <span className="expenses-eyebrow">
              New transaction
            </span>

            <h2>Record Expense</h2>

            <p>
              Record and post a business
              expense to the company ledger.
            </p>
          </div>

          <button
            className="expenses-modal-close"
            onClick={onClose}
            disabled={saving}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="expenses-alert">
            {error}
          </div>
        )}

        <form
          onSubmit={submit}
          className="expenses-form"
        >
          <div className="expenses-form-grid">
            <label className="expenses-field">
              <span>
                Expense Account *
              </span>

              <select
                name="expense_account"
                value={
                  form.expense_account
                }
                onChange={change}
                required
              >
                <option value="">
                  Select expense account
                </option>

                {expenseAccounts.map(
                  (a) => (
                    <option
                      key={a.id}
                      value={a.id}
                    >
                      {a.code} — {a.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="expenses-field">
              <span>
                Paid From *
              </span>

              <select
                name="payment_account"
                value={
                  form.payment_account
                }
                onChange={change}
                required
              >
                <option value="">
                  Select cash / bank account
                </option>

                {paymentAccounts.map(
                  (a) => {
                    const accountCurrency =
                      getPaymentAccountCurrency(
                        a.id
                      );

                    return (
                      <option
                        key={a.id}
                        value={a.id}
                      >
                        {a.code} — {a.name} (
                        {accountCurrency})
                      </option>
                    );
                  }
                )}
              </select>
            </label>

            <label className="expenses-field">
              <span>
                Amount ({selectedPaymentCurrency}) *
              </span>

              <div className="expenses-currency-input">
                <span>
                  {getCurrencySymbol(
                    selectedPaymentCurrency
                  )}
                </span>

                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={change}
                  placeholder="0.00"
                  required
                />
              </div>
            </label>

            <label className="expenses-field">
              <span>
                Transaction Date *
              </span>

              <input
                name="transaction_date"
                type="date"
                value={
                  form.transaction_date
                }
                onChange={change}
                required
              />
            </label>

            <label className="expenses-field">
              <span>
                Reference
              </span>

              <input
                name="reference"
                value={form.reference}
                onChange={change}
                placeholder="Receipt, cheque or reference"
              />
            </label>

            <label className="expenses-field expenses-field-full">
              <span>
                Description *
              </span>

              <textarea
                name="description"
                rows="3"
                value={form.description}
                onChange={change}
                placeholder="What was this expense for?"
                required
              />
            </label>
          </div>

          <div className="expenses-entry-preview">
            <div>
              <span>Debit</span>

              <strong>
                {money(
                  form.amount,
                  selectedPaymentCurrency
                )}
              </strong>

              <small>
                {selectedExpenseAccount?.name ||
                  "Expense account"}
              </small>
            </div>

            <div className="expenses-entry-arrow">
              →
            </div>

            <div>
              <span>Credit</span>

              <strong>
                {money(
                  form.amount,
                  selectedPaymentCurrency
                )}
              </strong>

              <small>
                {selectedPaymentAccount?.name ||
                  "Payment account"}
              </small>
            </div>
          </div>

          <div className="expenses-entry-currency-note">
            Transaction currency:{" "}
            <strong>
              {selectedPaymentCurrency}
            </strong>
          </div>

          <div className="expenses-modal-actions">
            <button
              type="button"
              className="expenses-secondary-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="expenses-primary-btn"
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCw
                    size={16}
                    className="expenses-spin"
                  />
                  Posting...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  Record &amp; Post Expense
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   EXPENSES PAGE
   ============================================================ */

export default function Expenses() {
  const { currentCompany } =
    useCompany();

  const companyId =
    currentCompany?.id;

  const companyCurrency =
    currentCompany?.currency ||
    "USD";

  const [accounts, setAccounts] =
    useState([]);

  const [bankAccounts, setBankAccounts] =
    useState([]);

  const [ledger, setLedger] =
    useState([]);

  const [bankTransactions, setBankTransactions] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [accountFilter, setAccountFilter] =
    useState("ALL");

  const [currencyFilter, setCurrencyFilter] =
    useState("ALL");

  const [chartCurrency, setChartCurrency] =
    useState(
      companyCurrency === "LRD"
        ? "LRD"
        : "USD"
    );

  const [showModal, setShowModal] =
    useState(false);

  const [selected, setSelected] =
    useState(null);

  /* ==========================================================
     LOAD
     ========================================================== */

  const load = useCallback(
    async (refresh = false) => {
      if (!companyId) {
        setAccounts([]);
        setBankAccounts([]);
        setLedger([]);
        setBankTransactions([]);
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
          accountsResponse,
          ledgerResponse,
          bankAccountsResponse,
          bankTransactionsResponse,
        ] = await Promise.all([
          api.get(
            `/api/accounting/accounts/?company=${companyId}`
          ),

          api.get(
            `/api/accounting/reports/general-ledger/?company=${companyId}`
          ),

          api.get(
            `/api/banking/accounts/?company=${companyId}`
          ),

          api.get(
            `/api/banking/transactions/?company=${companyId}`
          ),
        ]);

        setAccounts(
          list(accountsResponse)
        );

        setLedger(
          list(ledgerResponse?.accounts)
        );

        setBankAccounts(
          list(bankAccountsResponse)
        );

        setBankTransactions(
          list(
            bankTransactionsResponse
          )
        );
      } catch (err) {
        setError(
          err?.message ||
            "Unable to load expenses."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId]
  );

  useEffect(() => {
    load();
  }, [load]);

  /* ==========================================================
     EXPENSE ACCOUNTS
     ========================================================== */

  const expenseAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.account_type ===
            "EXPENSE" &&
          a.is_active !== false
      ),
    [accounts]
  );

  /* ==========================================================
     BANK CURRENCY MAP
     ========================================================== */

  const bankCurrencyByAccountingAccount =
    useMemo(() => {
      const map = {};

      bankAccounts.forEach(
        (bankAccount) => {
          if (
            bankAccount.accounting_account
          ) {
            map[
              Number(
                bankAccount.accounting_account
              )
            ] =
              bankAccount.currency ||
              companyCurrency;
          }
        }
      );

      return map;
    }, [
      bankAccounts,
      companyCurrency,
    ]);

  /*
   * Map journal entry -> actual bank
   * transaction currency.
   *
   * This is what fixes the existing
   * bank-fee problem.
   *
   * Example:
   *
   * JE 26 -> LRD bank fee -> LRD
   * JE 27 -> USD bank fee -> USD
   */
  const journalCurrencyMap =
    useMemo(() => {
      const map = {};

      bankTransactions.forEach(
        (transaction) => {
          const journalId =
            transaction.journal_entry;

          const currency =
            bankAccounts.find(
              (bankAccount) =>
                Number(bankAccount.id) ===
                Number(
                  transaction.bank_account
                )
            )?.currency;

          if (
            journalId &&
            currency
          ) {
            map[
              Number(journalId)
            ] = currency;
          }
        }
      );

      return map;
    }, [
      bankTransactions,
      bankAccounts,
    ]);

  /* ==========================================================
     DETERMINE TRANSACTION CURRENCY
     ========================================================== */

  const getTransactionCurrency =
    useCallback(
      (transaction) => {
        /*
         * 1. Bank transaction currency
         * has highest priority.
         */
        if (
          transaction.journal_entry_id &&
          journalCurrencyMap[
            Number(
              transaction.journal_entry_id
            )
          ]
        ) {
          return journalCurrencyMap[
            Number(
              transaction.journal_entry_id
            )
          ];
        }

        /*
         * 2. If the expense journal's
         * payment account is itself a
         * dedicated bank accounting
         * account, use that currency.
         */
        if (
          transaction.payment_account_id &&
          bankCurrencyByAccountingAccount[
            Number(
              transaction.payment_account_id
            )
          ]
        ) {
          return bankCurrencyByAccountingAccount[
            Number(
              transaction.payment_account_id
            )
          ];
        }

        /*
         * 3. Fall back to company
         * functional currency.
         */
        return companyCurrency;
      },
      [
        journalCurrencyMap,
        bankCurrencyByAccountingAccount,
        companyCurrency,
      ]
    );

  /* ==========================================================
     TRANSACTIONS
     ========================================================== */

  const transactions = useMemo(() => {
    const rows = [];

    const ids = new Set(
      expenseAccounts.map(
        (a) => Number(a.id)
      )
    );

    ledger
      .filter((a) =>
        ids.has(Number(a.account))
      )
      .forEach((account) => {
        (account.transactions || []).forEach(
          (t) => {
            const amount =
              n(t.debit) -
              n(t.credit);

            if (amount > 0) {
              const currency =
                journalCurrencyMap[
                  Number(
                    t.journal_entry_id
                  )
                ] ||
                companyCurrency;

              rows.push({
                id: `${account.account}-${t.journal_entry_id}`,

                journal_entry_id:
                  t.journal_entry_id,

                account_id:
                  account.account,

                account_code:
                  account.account_code,

                account_name:
                  account.account_name,

                date: t.date,

                reference:
                  t.reference ||
                  `JE-${t.journal_entry_id}`,

                description:
                  t.description ||
                  "Expense transaction",

                amount,

                debit: n(t.debit),

                credit: n(t.credit),

                currency,
              });
            }
          }
        );
      });

    return rows.sort(
      (a, b) =>
        new Date(b.date) -
        new Date(a.date)
    );
  }, [
    ledger,
    expenseAccounts,
    journalCurrencyMap,
    companyCurrency,
  ]);

  /* ==========================================================
     CURRENCY TOTALS
     ========================================================== */

  const currencyTotals =
    useMemo(() => {
      return {
        USD: transactions
          .filter(
            (t) => t.currency === "USD"
          )
          .reduce(
            (sum, t) =>
              sum + t.amount,
            0
          ),

        LRD: transactions
          .filter(
            (t) => t.currency === "LRD"
          )
          .reduce(
            (sum, t) =>
              sum + t.amount,
            0
          ),
      };
    }, [transactions]);

  /* ==========================================================
     PERIOD TOTALS
     ========================================================== */

  const periodTotals =
    useMemo(() => {
      const currentMonth =
        monthKey(today());

      const currentYear =
        String(
          new Date().getFullYear()
        );

      const result = {
        USD: {
          month: 0,
          year: 0,
        },

        LRD: {
          month: 0,
          year: 0,
        },
      };

      transactions.forEach(
        (transaction) => {
          const currency =
            transaction.currency;

          if (!result[currency]) {
            return;
          }

          if (
            monthKey(
              transaction.date
            ) === currentMonth
          ) {
            result[currency].month +=
              transaction.amount;
          }

          if (
            String(
              transaction.date
            ).startsWith(currentYear)
          ) {
            result[currency].year +=
              transaction.amount;
          }
        }
      );

      return result;
    }, [transactions]);

  /* ==========================================================
   CATEGORY DATA
   ========================================================== */

const categoryData = useMemo(() => {
  const grouped = {};

  transactions.forEach((transaction) => {
    const accountId = Number(transaction.account_id);

    if (!accountId) return;

    if (!grouped[accountId]) {
      grouped[accountId] = {
        id: accountId,
        name:
          transaction.account_name ||
          "Unknown Expense Account",
        code:
          transaction.account_code ||
          "—",
        usd: 0,
        lrd: 0,
        total: 0,
      };
    }

    if (transaction.currency === "USD") {
      grouped[accountId].usd += transaction.amount;
    }

    if (transaction.currency === "LRD") {
      grouped[accountId].lrd += transaction.amount;
    }

    grouped[accountId].total += transaction.amount;
  });

  return Object.values(grouped)
    .filter((account) => account.total > 0)
    .sort((a, b) => b.total - a.total);
}, [transactions]);

  /* ==========================================================
     LARGEST EXPENSE
     ========================================================== */

  const largestExpenses =
    useMemo(() => {
      return {
        USD: transactions
          .filter(
            (t) => t.currency === "USD"
          )
          .reduce(
            (max, t) =>
              Math.max(
                max,
                t.amount
              ),
            0
          ),

        LRD: transactions
          .filter(
            (t) => t.currency === "LRD"
          )
          .reduce(
            (max, t) =>
              Math.max(
                max,
                t.amount
              ),
            0
          ),
      };
    }, [transactions]);

  /* ==========================================================
     TREND
     ========================================================== */

  const trend = useMemo(() => {
    return sixMonths().map(
      (month) => ({
        month: month.label,

        amount: transactions
          .filter(
            (t) =>
              t.currency ===
                chartCurrency &&
              monthKey(t.date) ===
                month.key
          )
          .reduce(
            (sum, t) =>
              sum + t.amount,
            0
          ),
      })
    );
  }, [
    transactions,
    chartCurrency,
  ]);

  /* ==========================================================
     FILTERED
     ========================================================== */

  const filtered =
    useMemo(() => {
      return transactions.filter(
        (t) => {
          const q =
            search
              .trim()
              .toLowerCase();

          const matchesSearch =
            !q ||
            [
              t.reference,
              t.description,
              t.account_name,
              t.account_code,
              t.currency,
            ].some((v) =>
              String(v || "")
                .toLowerCase()
                .includes(q)
            );

          const matchesAccount =
            accountFilter ===
              "ALL" ||
            String(t.account_id) ===
              String(accountFilter);

          const matchesCurrency =
            currencyFilter ===
              "ALL" ||
            t.currency ===
              currencyFilter;

          return (
            matchesSearch &&
            matchesAccount &&
            matchesCurrency
          );
        }
      );
    }, [
      transactions,
      search,
      accountFilter,
      currencyFilter,
    ]);

  const filteredTotals =
    useMemo(() => {
      return {
        USD: filtered
          .filter(
            (t) => t.currency === "USD"
          )
          .reduce(
            (sum, t) =>
              sum + t.amount,
            0
          ),

        LRD: filtered
          .filter(
            (t) => t.currency === "LRD"
          )
          .reduce(
            (sum, t) =>
              sum + t.amount,
            0
          ),
      };
    }, [filtered]);

  /* ==========================================================
     EXPORT
     ========================================================== */

  const exportCsv = () => {
    const quote = (v) =>
      `"${String(v ?? "").replaceAll(
        '"',
        '""'
      )}"`;

    const rows = [
      [
        "Date",
        "Reference",
        "Expense Account",
        "Code",
        "Description",
        "Currency",
        "Amount",
      ]
        .map(quote)
        .join(","),
      ...filtered.map((t) =>
        [
          t.date,
          t.reference,
          t.account_name,
          t.account_code,
          t.description,
          t.currency,
          t.amount.toFixed(2),
        ]
          .map(quote)
          .join(",")
      ),
    ];

    const text =
      rows.join("\n");

    const url =
      URL.createObjectURL(
        new Blob([text], {
          type: "text/csv",
        })
      );

    const a =
      document.createElement(
        "a"
      );

    a.href = url;

    a.download = `expenses-${companyId}.csv`;

    a.click();

    URL.revokeObjectURL(url);
  };

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <div className="expenses-page">
      {/* HEADER */}
      <div className="expenses-page-header">
        <div>
          <div className="expenses-breadcrumb">
            <span>
              Operations
            </span>

            <span>/</span>

            <strong>
              Expenses
            </strong>
          </div>

          <h1>
            Expenses
          </h1>

          <p>
            Track, record and analyse
            operating expenses for{" "}
            <strong>
              {currentCompany?.name ||
                "the selected company"}
            </strong>
            .
          </p>
        </div>

        <div className="expenses-header-actions">
          <button
            className="expenses-secondary-btn"
            onClick={() =>
              load(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "expenses-spin"
                  : ""
              }
            />

            Refresh
          </button>

          <button
            className="expenses-primary-btn"
            onClick={() =>
              setShowModal(true)
            }
            disabled={!companyId}
          >
            <Plus size={17} />

            Record Expense
          </button>
        </div>
      </div>

      {error && (
        <div className="expenses-alert">
          {error}
        </div>
      )}

      {!companyId ? (
        <div className="expenses-no-company">
          <Wallet size={25} />

          <h2>
            Select a company
          </h2>

          <p>
            Choose a company before
            viewing or recording
            expenses.
          </p>
        </div>
      ) : loading ? (
        <div className="expenses-loading">
          <RefreshCw
            size={21}
            className="expenses-spin"
          />

          Loading expense
          information...
        </div>
      ) : (
        <>
          {/* ==================================================
              KPI CARDS
              ================================================== */}

          <div className="expenses-kpi-grid">
            <Kpi
              icon={Wallet}
              label="USD Expenses"
              value={money(
                currencyTotals.USD,
                "USD"
              )}
              note="Posted USD expense activity"
            />

            <Kpi
              icon={Wallet}
              label="LRD Expenses"
              value={money(
                currencyTotals.LRD,
                "LRD"
              )}
              note="Posted LRD expense activity"
            />

            <Kpi
              icon={CalendarDays}
              label="This Month"
              value={
                <>
                  <span className="expenses-kpi-multi-value">
                    USD{" "}
                    {money(
                      periodTotals.USD
                        .month,
                      "USD"
                    )}
                  </span>

                  <span className="expenses-kpi-multi-value">
                    LRD{" "}
                    {money(
                      periodTotals.LRD
                        .month,
                      "LRD"
                    )}
                  </span>
                </>
              }
              note="Posted expenses this month"
            />

            <Kpi
              icon={Activity}
              label="Transactions"
              value={
                transactions.length
              }
              note="Expense journal activity"
            />
          </div>

          {/* ==================================================
              SUMMARY STRIP
              ================================================== */}

          <div className="expenses-summary-strip">
            <div>
              <span>
                Expense Accounts
              </span>

              <strong>
                {expenseAccounts.length}
              </strong>
            </div>

            <div>
              <span>
                Top Category
              </span>

              <strong>
                {categoryData[0]?.name ||
                  "No activity"}
              </strong>
            </div>

            <div>
              <span>
                Largest Expense
              </span>

              <strong className="expenses-summary-multi">
                <span>
                  USD{" "}
                  {money(
                    largestExpenses.USD,
                    "USD"
                  )}
                </span>

                <span>
                  LRD{" "}
                  {money(
                    largestExpenses.LRD,
                    "LRD"
                  )}
                </span>
              </strong>
            </div>

            <div>
              <span>
                Company Currency
              </span>

              <strong>
                {companyCurrency}
              </strong>
            </div>
          </div>

          {/* ==================================================
              DASHBOARD
              ================================================== */}

          <div className="expenses-dashboard-grid">
            {/* TREND */}
            <section className="expenses-panel">
              <div className="expenses-panel-header">
                <div>
                  <span className="expenses-eyebrow">
                    Spending trend
                  </span>

                  <h2>
                    Expense Activity
                  </h2>
                </div>

                <div className="expenses-chart-controls">
                  <button
                    type="button"
                    className={
                      chartCurrency ===
                      "USD"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setChartCurrency(
                        "USD"
                      )
                    }
                  >
                    USD
                  </button>

                  <button
                    type="button"
                    className={
                      chartCurrency ===
                      "LRD"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setChartCurrency(
                        "LRD"
                      )
                    }
                  >
                    LRD
                  </button>
                </div>
              </div>

              <div className="expenses-chart-currency-label">
                Showing{" "}
                <strong>
                  {chartCurrency}
                </strong>{" "}
                expenses
              </div>

              {trend.some(
                (x) =>
                  x.amount > 0
              ) ? (
                <div className="expenses-chart">
                  <ResponsiveContainer
                    width="100%"
                    height={285}
                  >
                    <AreaChart
                      data={trend}
                    >
                      <defs>
                        <linearGradient
                          id="expenseFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#123C78"
                            stopOpacity={
                              0.24
                            }
                          />

                          <stop
                            offset="100%"
                            stopColor="#123C78"
                            stopOpacity={
                              0.02
                            }
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        stroke="#E2E7EF"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "#71809A",
                          fontSize: 11,
                        }}
                      />

                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "#71809A",
                          fontSize: 11,
                        }}
                      />

                      <Tooltip
                        formatter={(value) =>
                          money(
                            value,
                            chartCurrency
                          )
                        }
                      />

                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="#123C78"
                        strokeWidth={3}
                        fill="url(#expenseFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty
                  title={`No ${chartCurrency} expense activity yet`}
                  text={`Posted ${chartCurrency} expenses will appear here.`}
                />
              )}
            </section>

            {/* CATEGORIES */}
            <section className="expenses-panel">
              <div className="expenses-panel-header">
                <div>
                  <span className="expenses-eyebrow">
                    Account exposure
                  </span>

                  <h2>
                    Top Expense Categories
                  </h2>
                </div>
              </div>

              {categoryData.length ? (
                <div className="expenses-category-list">
                  {categoryData
                    .slice(0, 6)
                    .map(
                      (
                        account,
                        index
                      ) => (
                        <div
                          className="expenses-category-row"
                          key={
                            account.id
                          }
                        >
                          <div className="expenses-category-top">
                            <div>
                              <b>
                                {String(
                                  index +
                                    1
                                ).padStart(
                                  2,
                                  "0"
                                )}
                              </b>

                              <div>
                                <strong>
                                  {
                                    account.name
                                  }
                                </strong>

                                <small>
                                  {
                                    account.code
                                  }
                                </small>
                              </div>
                            </div>

                            <div className="expenses-category-values">
                              {account.usd >
                                0 && (
                                <strong>
                                  USD{" "}
                                  {money(
                                    account.usd,
                                    "USD"
                                  )}
                                </strong>
                              )}

                              {account.lrd >
                                0 && (
                                <strong>
                                  LRD{" "}
                                  {money(
                                    account.lrd,
                                    "LRD"
                                  )}
                                </strong>
                              )}
                            </div>
                          </div>

                          <div className="expenses-progress">
                            <span
                              style={{
                                width: `${
                                  transactions.length
                                    ? Math.min(
                                        100,
                                        ((account.usd +
                                          account.lrd) /
                                          (currencyTotals.USD +
                                            currencyTotals.LRD)) *
                                          100
                                      )
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      )
                    )}
                </div>
              ) : (
                <Empty
                  title="No categories with activity"
                  text="Posted expense accounts will be ranked here."
                />
              )}
            </section>
          </div>

          {/* ==================================================
              HISTORY
              ================================================== */}

          <section className="expenses-panel expenses-history-panel">
            <div className="expenses-panel-header">
              <div>
                <span className="expenses-eyebrow">
                  Posted ledger activity
                </span>

                <h2>
                  Expense History
                </h2>
              </div>

              <button
                className="expenses-outline-btn"
                onClick={exportCsv}
                disabled={
                  !filtered.length
                }
              >
                <Download size={15} />

                Export CSV
              </button>
            </div>

            <div className="expenses-toolbar">
              <div className="expenses-search">
                <Search size={16} />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Search reference, description or account..."
                />
              </div>

              <div className="expenses-filter">
                <Filter size={15} />

                <select
                  value={
                    accountFilter
                  }
                  onChange={(e) =>
                    setAccountFilter(
                      e.target.value
                    )
                  }
                >
                  <option value="ALL">
                    All Expense Accounts
                  </option>

                  {expenseAccounts.map(
                    (a) => (
                      <option
                        key={a.id}
                        value={a.id}
                      >
                        {a.code} —{" "}
                        {a.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="expenses-filter">
                <Wallet size={15} />

                <select
                  value={
                    currencyFilter
                  }
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
              </div>
            </div>

            {!filtered.length ? (
              <Empty
                title={
                  transactions.length
                    ? "No matching expenses"
                    : "No expenses recorded"
                }
                text={
                  transactions.length
                    ? "Try a different search, account or currency filter."
                    : "Use Record Expense to create the first expense."
                }
              />
            ) : (
              <div className="expenses-table-wrapper">
                <table className="expenses-table">
                  <thead>
                    <tr>
                      <th>
                        Date
                      </th>

                      <th>
                        Reference
                      </th>

                      <th>
                        Expense Account
                      </th>

                      <th>
                        Description
                      </th>

                      <th>
                        Currency
                      </th>

                      <th>
                        Status
                      </th>

                      <th className="expenses-money-head">
                        Amount
                      </th>

                      <th>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map(
                      (t) => (
                        <tr
                          key={t.id}
                        >
                          <td>
                            {dateLabel(
                              t.date
                            )}
                          </td>

                          <td>
                            <strong>
                              {
                                t.reference
                              }
                            </strong>
                          </td>

                          <td>
                            <div className="expenses-account-cell">
                              <strong>
                                {
                                  t.account_name
                                }
                              </strong>

                              <span>
                                {
                                  t.account_code
                                }
                              </span>
                            </div>
                          </td>

                          <td>
                            <span className="expenses-description-cell">
                              {
                                t.description
                              }
                            </span>
                          </td>

                          <td>
                            <span className="expenses-currency-badge">
                              {
                                t.currency
                              }
                            </span>
                          </td>

                          <td>
                            <Status />
                          </td>

                          <td className="expenses-money-cell">
                            {money(
                              t.amount,
                              t.currency
                            )}
                          </td>

                          <td>
                            <button
                              className="expenses-view-btn"
                              onClick={() =>
                                setSelected(
                                  t
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

            {/* TABLE FOOTER */}
            <div className="expenses-table-footer">
              <span>
                Showing{" "}
                <strong>
                  {
                    filtered.length
                  }
                </strong>{" "}
                of{" "}
                <strong>
                  {
                    transactions.length
                  }
                </strong>{" "}
                transactions
              </span>

              <div className="expenses-footer-totals">
                {filteredTotals.USD >
                  0 && (
                  <strong>
                    USD{" "}
                    {money(
                      filteredTotals.USD,
                      "USD"
                    )}
                  </strong>
                )}

                {filteredTotals.LRD >
                  0 && (
                  <strong>
                    LRD{" "}
                    {money(
                      filteredTotals.LRD,
                      "LRD"
                    )}
                  </strong>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* ======================================================
          RECORD EXPENSE MODAL
          ====================================================== */}

      <RecordExpenseModal
        open={showModal}
        onClose={() =>
          setShowModal(false)
        }
        accounts={accounts}
        bankAccounts={
          bankAccounts
        }
        companyId={companyId}
        currency={
          companyCurrency
        }
        onSaved={() =>
          load(true)
        }
      />

      {/* ======================================================
          DETAIL MODAL
          ====================================================== */}

      {selected && (
        <div
          className="expenses-modal-backdrop"
          onMouseDown={(e) =>
            e.target ===
              e.currentTarget &&
            setSelected(null)
          }
        >
          <div className="expenses-detail-modal">
            <div className="expenses-modal-header">
              <div>
                <span className="expenses-eyebrow">
                  Journal transaction
                </span>

                <h2>
                  {
                    selected.reference
                  }
                </h2>

                <p>
                  Posted expense
                  transaction.
                </p>
              </div>

              <button
                className="expenses-modal-close"
                onClick={() =>
                  setSelected(
                    null
                  )
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="expenses-detail-grid">
              <div>
                <span>
                  Date
                </span>

                <strong>
                  {dateLabel(
                    selected.date
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Status
                </span>

                <Status />
              </div>

              <div>
                <span>
                  Expense Account
                </span>

                <strong>
                  {
                    selected.account_name
                  }
                </strong>
              </div>

              <div>
                <span>
                  Account Code
                </span>

                <strong>
                  {
                    selected.account_code
                  }
                </strong>
              </div>

              <div>
                <span>
                  Currency
                </span>

                <strong className="expenses-detail-currency">
                  {
                    selected.currency
                  }
                </strong>
              </div>

              <div className="expenses-detail-full">
                <span>
                  Description
                </span>

                <strong>
                  {
                    selected.description
                  }
                </strong>
              </div>

              <div className="expenses-detail-full expenses-detail-amount">
                <span>
                  Amount
                </span>

                <strong>
                  {money(
                    selected.amount,
                    selected.currency
                  )}
                </strong>
              </div>
            </div>

            <div className="expenses-journal-preview">
              <div>
                <span>
                  Debit
                </span>

                <strong>
                  {money(
                    selected.debit,
                    selected.currency
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Credit
                </span>

                <strong>
                  {money(
                    selected.credit,
                    selected.currency
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Journal Entry
                </span>

                <strong>
                  JE-
                  {
                    selected.journal_entry_id
                  }
                </strong>
              </div>
            </div>

            <div className="expenses-modal-actions">
              <button
                className="expenses-secondary-btn"
                onClick={() =>
                  setSelected(
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