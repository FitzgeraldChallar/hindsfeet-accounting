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

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";

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
        { month: "short" }
      ).format(d),
    });
  }

  return result;
};

const currencySymbol = (currency) => {
  if (currency === "LRD") return "L$";
  return "$";
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
    <div className="interest-kpi">
      <div className="interest-kpi-icon">
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
    <div className="interest-empty">
      <div className="interest-empty-icon">
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
    <span className="interest-status">
      Posted
    </span>
  );
}

/* ============================================================
   RECORD INTEREST MODAL
   ============================================================ */

function RecordInterestModal({
  open,
  onClose,
  bankAccounts,
  revenueAccounts,
  companyId,
  onSaved,
}) {
  const [form, setForm] = useState({
    bank_account: "",
    revenue_account: "",
    amount: "",
    transaction_date: today(),
    reference: "",
    description: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedBankAccount =
    bankAccounts.find(
      (account) =>
        String(account.id) ===
        String(form.bank_account)
    );

  const selectedCurrency =
    selectedBankAccount?.currency ||
    "USD";

  useEffect(() => {
    if (!open) return;

    setForm({
      bank_account: bankAccounts[0]?.id
        ? String(bankAccounts[0].id)
        : "",

      revenue_account:
        revenueAccounts[0]?.id
          ? String(
              revenueAccounts[0].id
            )
          : "",

      amount: "",
      transaction_date: today(),
      reference: "",
      description: "",
    });

    setError("");
  }, [
    open,
    bankAccounts.length,
    revenueAccounts.length,
  ]);

  if (!open) return null;

  const change = (e) => {
    setForm((previous) => ({
      ...previous,
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

    if (!form.bank_account) {
      setError(
        "Select a bank account."
      );
      return;
    }

    if (!form.revenue_account) {
      setError(
        "Select an interest revenue account."
      );
      return;
    }

    if (n(form.amount) <= 0) {
      setError(
        "Interest amount must be greater than zero."
      );
      return;
    }

    if (!form.transaction_date) {
      setError(
        "Transaction date is required."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      await api.post(
        `/api/banking/interest/?company=${companyId}`,
        {
          bank_account: Number(
            form.bank_account
          ),

          revenue_account: Number(
            form.revenue_account
          ),

          amount: form.amount,

          transaction_date:
            form.transaction_date,

          reference:
            form.reference.trim(),

          description:
            form.description.trim() ||
            "Bank interest",
        }
      );

      onSaved();
      onClose();
    } catch (err) {
      setError(
        err?.message ||
          "Unable to record bank interest."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="interest-modal-backdrop">
      <div className="interest-modal">
        <div className="interest-modal-header">
          <div>
            <span className="interest-eyebrow">
              New transaction
            </span>

            <h2>
              Record Bank Interest
            </h2>

            <p>
              Record interest received on a
              company bank account.
            </p>
          </div>

          <button
            className="interest-modal-close"
            onClick={onClose}
            disabled={saving}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="interest-alert">
            {error}
          </div>
        )}

        <form
          onSubmit={submit}
          className="interest-form"
        >
          <div className="interest-form-grid">
            <label className="interest-field">
              <span>
                Bank Account *
              </span>

              <select
                name="bank_account"
                value={
                  form.bank_account
                }
                onChange={change}
                required
              >
                <option value="">
                  Select bank account
                </option>

                {bankAccounts.map(
                  (account) => (
                    <option
                      key={account.id}
                      value={account.id}
                    >
                      {account.bank_name} —{" "}
                      {account.account_name}{" "}
                      ({account.currency})
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="interest-field">
              <span>
                Interest Revenue Account *
              </span>

              <select
                name="revenue_account"
                value={
                  form.revenue_account
                }
                onChange={change}
                required
              >
                <option value="">
                  Select revenue account
                </option>

                {revenueAccounts.map(
                  (account) => (
                    <option
                      key={account.id}
                      value={account.id}
                    >
                      {account.code} —{" "}
                      {account.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="interest-field">
              <span>
                Interest Amount (
                {selectedCurrency}
                ) *
              </span>

              <div className="interest-currency-input">
                <span>
                  {currencySymbol(
                    selectedCurrency
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

            <label className="interest-field">
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

            <label className="interest-field">
              <span>
                Reference
              </span>

              <input
                name="reference"
                value={form.reference}
                onChange={change}
                placeholder="Bank advice, statement or reference"
              />
            </label>

            <label className="interest-field interest-field-full">
              <span>
                Description
              </span>

              <textarea
                name="description"
                rows="3"
                value={form.description}
                onChange={change}
                placeholder="Describe the interest received..."
              />
            </label>
          </div>

          <div className="interest-entry-preview">
            <div>
              <span>
                Debit
              </span>

              <strong>
                {money(
                  form.amount,
                  selectedCurrency
                )}
              </strong>

              <small>
                {selectedBankAccount
                  ? selectedBankAccount
                      .account_name
                  : "Bank account"}
              </small>
            </div>

            <div className="interest-entry-arrow">
              →
            </div>

            <div>
              <span>
                Credit
              </span>

              <strong>
                {money(
                  form.amount,
                  selectedCurrency
                )}
              </strong>

              <small>
                {revenueAccounts.find(
                  (account) =>
                    String(
                      account.id
                    ) ===
                    String(
                      form.revenue_account
                    )
                )?.name ||
                  "Interest revenue"}
              </small>
            </div>
          </div>

          <div className="interest-entry-note">
            Transaction currency:{" "}
            <strong>
              {selectedCurrency}
            </strong>
          </div>

          <div className="interest-modal-actions">
            <button
              type="button"
              className="interest-secondary-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="interest-primary-btn"
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCw
                    size={16}
                    className="interest-spin"
                  />
                  Posting...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  Record &amp; Post Interest
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
   MAIN PAGE
   ============================================================ */

export default function BankInterest() {
  const { currentCompany } =
    useCompany();

  const companyId =
    currentCompany?.id;

  const companyCurrency =
    currentCompany?.currency ||
    "USD";

  const [bankAccounts, setBankAccounts] =
    useState([]);

  const [revenueAccounts, setRevenueAccounts] =
    useState([]);

  const [transactions, setTransactions] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [currencyFilter, setCurrencyFilter] =
    useState("ALL");

  const [bankFilter, setBankFilter] =
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
        setBankAccounts([]);
        setRevenueAccounts([]);
        setTransactions([]);
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
          bankAccountsResponse,
          accountingAccountsResponse,
          transactionsResponse,
        ] = await Promise.all([
          api.get(
            `/api/banking/accounts/?company=${companyId}`
          ),

          api.get(
            `/api/accounting/accounts/?company=${companyId}`
          ),

          api.get(
            `/api/banking/transactions/?company=${companyId}&transaction_type=INTEREST`
          ),
        ]);

        setBankAccounts(
          list(
            bankAccountsResponse
          )
        );

        setRevenueAccounts(
          list(
            accountingAccountsResponse
          ).filter(
            (account) =>
              account.account_type ===
                "REVENUE" &&
              account.is_active !==
                false
          )
        );

        setTransactions(
          list(
            transactionsResponse
          )
        );
      } catch (err) {
        setError(
          err?.message ||
            "Unable to load bank interest."
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
     ENRICH TRANSACTIONS WITH BANK ACCOUNT
     ========================================================== */

  const enrichedTransactions =
    useMemo(() => {
      return transactions.map(
        (transaction) => {
          const bankAccount =
            bankAccounts.find(
              (account) =>
                Number(account.id) ===
                Number(
                  transaction.bank_account
                )
            );

          return {
            ...transaction,

            bankAccount,

            currency:
              bankAccount?.currency ||
              companyCurrency,

            bankName:
              bankAccount?.bank_name ||
              "Bank account",

            bankAccountName:
              bankAccount?.account_name ||
              "Bank account",

            accountNumber:
              bankAccount?.account_number ||
              "",
          };
        }
      );
    }, [
      transactions,
      bankAccounts,
      companyCurrency,
    ]);

  /* ==========================================================
     CURRENCY TOTALS
     ========================================================== */

  const currencyTotals =
    useMemo(() => {
      return {
        USD: enrichedTransactions
          .filter(
            (transaction) =>
              transaction.currency ===
              "USD"
          )
          .reduce(
            (sum, transaction) =>
              sum +
              n(transaction.amount),
            0
          ),

        LRD: enrichedTransactions
          .filter(
            (transaction) =>
              transaction.currency ===
              "LRD"
          )
          .reduce(
            (sum, transaction) =>
              sum +
              n(transaction.amount),
            0
          ),
      };
    }, [enrichedTransactions]);

  /* ==========================================================
     THIS MONTH
     ========================================================== */

  const monthTotals =
    useMemo(() => {
      const currentMonth =
        monthKey(today());

      return {
        USD: enrichedTransactions
          .filter(
            (transaction) =>
              transaction.currency ===
                "USD" &&
              monthKey(
                transaction.transaction_date
              ) === currentMonth
          )
          .reduce(
            (sum, transaction) =>
              sum +
              n(transaction.amount),
            0
          ),

        LRD: enrichedTransactions
          .filter(
            (transaction) =>
              transaction.currency ===
                "LRD" &&
              monthKey(
                transaction.transaction_date
              ) === currentMonth
          )
          .reduce(
            (sum, transaction) =>
              sum +
              n(transaction.amount),
            0
          ),
      };
    }, [enrichedTransactions]);

  /* ==========================================================
     TREND
     ========================================================== */

  const trend = useMemo(() => {
    return sixMonths().map(
      (month) => ({
        month: month.label,

        amount: enrichedTransactions
          .filter(
            (transaction) =>
              transaction.currency ===
                chartCurrency &&
              monthKey(
                transaction.transaction_date
              ) === month.key
          )
          .reduce(
            (sum, transaction) =>
              sum +
              n(transaction.amount),
            0
          ),
      })
    );
  }, [
    enrichedTransactions,
    chartCurrency,
  ]);

  /* ==========================================================
     FILTER
     ========================================================== */

  const filtered =
    useMemo(() => {
      return enrichedTransactions
        .filter((transaction) => {
          const q =
            search
              .trim()
              .toLowerCase();

          const matchesSearch =
            !q ||
            [
              transaction.reference,
              transaction.description,
              transaction.bankName,
              transaction.bankAccountName,
              transaction.accountNumber,
              transaction.currency,
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(q)
            );

          const matchesCurrency =
            currencyFilter ===
              "ALL" ||
            transaction.currency ===
              currencyFilter;

          const matchesBank =
            bankFilter === "ALL" ||
            String(
              transaction.bank_account
            ) ===
              String(bankFilter);

          return (
            matchesSearch &&
            matchesCurrency &&
            matchesBank
          );
        })
        .sort(
          (a, b) =>
            new Date(
              b.transaction_date
            ) -
            new Date(
              a.transaction_date
            )
        );
    }, [
      enrichedTransactions,
      search,
      currencyFilter,
      bankFilter,
    ]);

  /* ==========================================================
     FILTER TOTALS
     ========================================================== */

  const filteredTotals =
    useMemo(() => {
      return {
        USD: filtered
          .filter(
            (transaction) =>
              transaction.currency ===
              "USD"
          )
          .reduce(
            (sum, transaction) =>
              sum +
              n(transaction.amount),
            0
          ),

        LRD: filtered
          .filter(
            (transaction) =>
              transaction.currency ===
              "LRD"
          )
          .reduce(
            (sum, transaction) =>
              sum +
              n(transaction.amount),
            0
          ),
      };
    }, [filtered]);

  /* ==========================================================
     EXPORT CSV
     ========================================================== */

  const exportCsv = () => {
    const quote = (value) =>
      `"${String(
        value ?? ""
      ).replaceAll(
        '"',
        '""'
      )}"`;

    const rows = [
      [
        "Date",
        "Reference",
        "Bank",
        "Account",
        "Currency",
        "Amount",
        "Description",
        "Status",
      ]
        .map(quote)
        .join(","),

      ...filtered.map(
        (transaction) =>
          [
            transaction.transaction_date,
            transaction.reference ||
              "",
            transaction.bankName,
            transaction.bankAccountName,
            transaction.currency,
            n(
              transaction.amount
            ).toFixed(2),
            transaction.description ||
              "",
            "Posted",
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

    a.download = `bank-interest-${companyId}.csv`;

    a.click();

    URL.revokeObjectURL(url);
  };

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <div className="interest-page">
      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="interest-page-header">
        <div>
          <div className="interest-breadcrumb">
            <span>
              Banking
            </span>

            <span>/</span>

            <strong>
              Interest
            </strong>
          </div>

          <h1>
            Bank Interest
          </h1>

          <p>
            Record and monitor interest
            income received across company
            bank accounts.
          </p>
        </div>

        <div className="interest-header-actions">
          <button
            className="interest-secondary-btn"
            onClick={() =>
              load(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "interest-spin"
                  : ""
              }
            />

            Refresh
          </button>

          <button
            className="interest-primary-btn"
            onClick={() =>
              setShowModal(true)
            }
            disabled={!companyId}
          >
            <Plus size={17} />

            Record Interest
          </button>
        </div>
      </div>

      {error && (
        <div className="interest-alert">
          {error}
        </div>
      )}

      {!companyId ? (
        <div className="interest-no-company">
          <Wallet size={25} />

          <h2>
            Select a company
          </h2>

          <p>
            Choose a company before
            viewing or recording bank
            interest.
          </p>
        </div>
      ) : loading ? (
        <div className="interest-loading">
          <RefreshCw
            size={21}
            className="interest-spin"
          />

          Loading bank interest...
        </div>
      ) : (
        <>
          {/* ==================================================
              KPI
              ================================================== */}

          <div className="interest-kpi-grid">
            <Kpi
              icon={Wallet}
              label="USD Interest"
              value={money(
                currencyTotals.USD,
                "USD"
              )}
              note="Posted USD interest income"
            />

            <Kpi
              icon={Wallet}
              label="LRD Interest"
              value={money(
                currencyTotals.LRD,
                "LRD"
              )}
              note="Posted LRD interest income"
            />

            <Kpi
              icon={CalendarDays}
              label="This Month"
              value={
                <span className="interest-kpi-multi">
                  USD{" "}
                  {money(
                    monthTotals.USD,
                    "USD"
                  )}
                  <br />
                  LRD{" "}
                  {money(
                    monthTotals.LRD,
                    "LRD"
                  )}
                </span>
              }
              note="Posted interest this month"
            />

            <Kpi
              icon={Activity}
              label="Transactions"
              value={
                enrichedTransactions.length
              }
              note="Posted interest transactions"
            />
          </div>

          {/* ==================================================
              SUMMARY
              ================================================== */}

          <div className="interest-summary-strip">
            <div>
              <span>
                Bank Accounts
              </span>

              <strong>
                {
                  bankAccounts.filter(
                    (account) =>
                      account.is_active !==
                      false
                  ).length
                }
              </strong>
            </div>

            <div>
              <span>
                Interest Transactions
              </span>

              <strong>
                {
                  enrichedTransactions.length
                }
              </strong>
            </div>

            <div>
              <span>
                USD Interest
              </span>

              <strong>
                {money(
                  currencyTotals.USD,
                  "USD"
                )}
              </strong>
            </div>

            <div>
              <span>
                LRD Interest
              </span>

              <strong>
                {money(
                  currencyTotals.LRD,
                  "LRD"
                )}
              </strong>
            </div>
          </div>

          {/* ==================================================
              DASHBOARD
              ================================================== */}

          <div className="interest-dashboard-grid">
            <section className="interest-panel">
              <div className="interest-panel-header">
                <div>
                  <span className="interest-eyebrow">
                    Interest income trend
                  </span>

                  <h2>
                    Interest Activity
                  </h2>
                </div>

                <div className="interest-chart-controls">
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

              <div className="interest-chart-label">
                Showing{" "}
                <strong>
                  {chartCurrency}
                </strong>{" "}
                interest income
              </div>

              {trend.some(
                (item) =>
                  item.amount > 0
              ) ? (
                <div className="interest-chart">
                  <ResponsiveContainer
                    width="100%"
                    height={285}
                  >
                    <AreaChart
                      data={trend}
                    >
                      <defs>
                        <linearGradient
                          id="interestFill"
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
                        fill="url(#interestFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty
                  title={`No ${chartCurrency} interest activity yet`}
                  text={`Posted ${chartCurrency} interest will appear here.`}
                />
              )}
            </section>

            <section className="interest-panel">
              <div className="interest-panel-header">
                <div>
                  <span className="interest-eyebrow">
                    Bank income
                  </span>

                  <h2>
                    Interest by Account
                  </h2>
                </div>
              </div>

              {bankAccounts.length ? (
                <div className="interest-account-list">
                  {bankAccounts
                    .map(
                      (account) => {
                        const total =
                          enrichedTransactions
                            .filter(
                              (
                                transaction
                              ) =>
                                Number(
                                  transaction.bank_account
                                ) ===
                                Number(
                                  account.id
                                )
                            )
                            .reduce(
                              (
                                sum,
                                transaction
                              ) =>
                                sum +
                                n(
                                  transaction.amount
                                ),
                              0
                            );

                        return {
                          ...account,
                          interestTotal:
                            total,
                        };
                      }
                    )
                    .filter(
                      (account) =>
                        account.interestTotal >
                        0
                    )
                    .sort(
                      (a, b) =>
                        b.interestTotal -
                        a.interestTotal
                    )
                    .slice(0, 6)
                    .map(
                      (
                        account,
                        index
                      ) => (
                        <div
                          className="interest-account-row"
                          key={
                            account.id
                          }
                        >
                          <div className="interest-account-row-top">
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
                                    account.account_name
                                  }
                                </strong>

                                <small>
                                  {
                                    account.bank_name
                                  }{" "}
                                  •{" "}
                                  {
                                    account.currency
                                  }
                                </small>
                              </div>
                            </div>

                            <strong>
                              {money(
                                account.interestTotal,
                                account.currency
                              )}
                            </strong>
                          </div>
                        </div>
                      )
                    )}
                </div>
              ) : (
                <Empty
                  title="No bank accounts"
                  text="Create a bank account before recording interest."
                />
              )}
            </section>
          </div>

          {/* ==================================================
              HISTORY
              ================================================== */}

          <section className="interest-panel interest-history-panel">
            <div className="interest-panel-header">
              <div>
                <span className="interest-eyebrow">
                  Posted banking activity
                </span>

                <h2>
                  Interest History
                </h2>
              </div>

              <button
                className="interest-outline-btn"
                onClick={exportCsv}
                disabled={
                  !filtered.length
                }
              >
                <Download size={15} />

                Export CSV
              </button>
            </div>

            <div className="interest-toolbar">
              <div className="interest-search">
                <Search size={16} />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Search reference, bank or description..."
                />
              </div>

              <div className="interest-filter">
                <Filter size={15} />

                <select
                  value={
                    bankFilter
                  }
                  onChange={(e) =>
                    setBankFilter(
                      e.target.value
                    )
                  }
                >
                  <option value="ALL">
                    All Bank Accounts
                  </option>

                  {bankAccounts.map(
                    (account) => (
                      <option
                        key={account.id}
                        value={account.id}
                      >
                        {
                          account.account_name
                        }
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="interest-filter">
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
                  enrichedTransactions.length
                    ? "No matching interest"
                    : "No interest recorded"
                }
                text={
                  enrichedTransactions.length
                    ? "Try a different search, bank account or currency filter."
                    : "Use Record Interest to create the first interest transaction."
                }
              />
            ) : (
              <div className="interest-table-wrapper">
                <table className="interest-table">
                  <thead>
                    <tr>
                      <th>
                        Date
                      </th>

                      <th>
                        Reference
                      </th>

                      <th>
                        Bank Account
                      </th>

                      <th>
                        Currency
                      </th>

                      <th>
                        Description
                      </th>

                      <th>
                        Status
                      </th>

                      <th className="interest-money-head">
                        Amount
                      </th>

                      <th>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map(
                      (
                        transaction
                      ) => (
                        <tr
                          key={
                            transaction.id
                          }
                        >
                          <td>
                            {dateLabel(
                              transaction.transaction_date
                            )}
                          </td>

                          <td>
                            <strong>
                              {
                                transaction.reference ||
                                `BANK-${transaction.id}`
                              }
                            </strong>
                          </td>

                          <td>
                            <div className="interest-account-cell">
                              <strong>
                                {
                                  transaction.bankAccountName
                                }
                              </strong>

                              <span>
                                {
                                  transaction.bankName
                                }
                              </span>
                            </div>
                          </td>

                          <td>
                            <span className="interest-currency-badge">
                              {
                                transaction.currency
                              }
                            </span>
                          </td>

                          <td>
                            <span className="interest-description-cell">
                              {
                                transaction.description ||
                                "Bank interest"
                              }
                            </span>
                          </td>

                          <td>
                            <Status />
                          </td>

                          <td className="interest-money-cell">
                            {money(
                              transaction.amount,
                              transaction.currency
                            )}
                          </td>

                          <td>
                            <button
                              className="interest-view-btn"
                              onClick={() =>
                                setSelected(
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

            <div className="interest-table-footer">
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
                    enrichedTransactions.length
                  }
                </strong>{" "}
                transactions
              </span>

              <div className="interest-footer-totals">
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
          RECORD INTEREST MODAL
          ====================================================== */}

      <RecordInterestModal
        open={showModal}
        onClose={() =>
          setShowModal(false)
        }
        bankAccounts={
          bankAccounts.filter(
            (account) =>
              account.is_active !==
              false
          )
        }
        revenueAccounts={
          revenueAccounts
        }
        companyId={companyId}
        onSaved={() =>
          load(true)
        }
      />

      {/* ======================================================
          DETAIL MODAL
          ====================================================== */}

      {selected && (
        <div
          className="interest-modal-backdrop"
          onMouseDown={(e) =>
            e.target ===
              e.currentTarget &&
            setSelected(null)
          }
        >
          <div className="interest-detail-modal">
            <div className="interest-modal-header">
              <div>
                <span className="interest-eyebrow">
                  Banking transaction
                </span>

                <h2>
                  {selected.reference ||
                    `Interest #${selected.id}`}
                </h2>

                <p>
                  Posted bank interest
                  transaction.
                </p>
              </div>

              <button
                className="interest-modal-close"
                onClick={() =>
                  setSelected(null)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="interest-detail-grid">
              <div>
                <span>
                  Date
                </span>

                <strong>
                  {dateLabel(
                    selected.transaction_date
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
                  Bank
                </span>

                <strong>
                  {
                    selected.bankName
                  }
                </strong>
              </div>

              <div>
                <span>
                  Bank Account
                </span>

                <strong>
                  {
                    selected.bankAccountName
                  }
                </strong>
              </div>

              <div>
                <span>
                  Currency
                </span>

                <strong className="interest-detail-currency">
                  {
                    selected.currency
                  }
                </strong>
              </div>

              <div>
                <span>
                  Account Number
                </span>

                <strong>
                  {
                    selected.accountNumber ||
                    "—"
                  }
                </strong>
              </div>

              <div className="interest-detail-full">
                <span>
                  Description
                </span>

                <strong>
                  {
                    selected.description ||
                    "Bank interest"
                  }
                </strong>
              </div>

              <div className="interest-detail-full interest-detail-amount">
                <span>
                  Interest Received
                </span>

                <strong>
                  {money(
                    selected.amount,
                    selected.currency
                  )}
                </strong>
              </div>
            </div>

            <div className="interest-journal-preview">
              <div>
                <span>
                  Debit
                </span>

                <strong>
                  {money(
                    selected.amount,
                    selected.currency
                  )}
                </strong>

                <small>
                  Bank Account
                </small>
              </div>

              <div>
                <span>
                  Credit
                </span>

                <strong>
                  {money(
                    selected.amount,
                    selected.currency
                  )}
                </strong>

                <small>
                  Interest Revenue
                </small>
              </div>

              <div>
                <span>
                  Journal Entry
                </span>

                <strong>
                  JE-
                  {
                    selected.journal_entry
                  }
                </strong>
              </div>
            </div>

            <div className="interest-modal-actions">
              <button
                className="interest-secondary-btn"
                onClick={() =>
                  setSelected(null)
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