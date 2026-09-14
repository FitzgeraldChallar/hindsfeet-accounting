import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
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

const EMPTY_FORM = {
  bank_account: "",
  counter_account: "",
  amount: "",
  adjustment_direction: "INCREASE",
  transaction_date: new Date().toISOString().slice(0, 10),
  reference: "",
  description: "",
};

const formatMoney = (value, currency = "USD") => {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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

const getCurrencySymbol = (currency) => {
  return currency === "LRD" ? "L$" : "$";
};

const getAccountLabel = (account) => {
  if (!account) return "—";

  return `${account.code || ""} — ${account.name || ""}`.trim();
};

export default function BankAdjustments() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;

  const [bankAccounts, setBankAccounts] = useState([]);
  const [accountingAccounts, setAccountingAccounts] = useState([]);
  const [adjustments, setAdjustments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);

  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState("ALL");
  const [currencyFilter, setCurrencyFilter] = useState("ALL");

  const [selectedAdjustment, setSelectedAdjustment] = useState(null);

  // ============================================================
  // LOAD DATA
  // ============================================================

  const loadData = async () => {
    if (!companyId) {
      setBankAccounts([]);
      setAccountingAccounts([]);
      setAdjustments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

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
          `/api/banking/transactions/?company=${companyId}&transaction_type=ADJUSTMENT`
        ),
      ]);

      const bankData = Array.isArray(bankAccountsResponse)
        ? bankAccountsResponse
        : bankAccountsResponse?.results || [];

      const accountingData = Array.isArray(
        accountingAccountsResponse
      )
        ? accountingAccountsResponse
        : accountingAccountsResponse?.results || [];

      const transactionData = Array.isArray(
        transactionsResponse
      )
        ? transactionsResponse
        : transactionsResponse?.results || [];

      setBankAccounts(bankData);
      setAccountingAccounts(accountingData);
      setAdjustments(transactionData);
    } catch (err) {
      setError(
        err?.data?.detail ||
          err?.message ||
          "Unable to load bank adjustments."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  // ============================================================
  // ACCOUNT FILTERS
  // ============================================================

  const activeBankAccounts = useMemo(() => {
    return bankAccounts.filter(
      (account) => account.is_active !== false
    );
  }, [bankAccounts]);

  const activeAccountingAccounts = useMemo(() => {
    return accountingAccounts.filter(
      (account) => account.is_active !== false
    );
  }, [accountingAccounts]);

  // ============================================================
  // SELECTED BANK ACCOUNT
  // ============================================================

  const selectedBankAccount = useMemo(() => {
    return activeBankAccounts.find(
      (account) =>
        String(account.id) === String(form.bank_account)
    );
  }, [activeBankAccounts, form.bank_account]);

  const selectedCurrency =
    selectedBankAccount?.currency || "USD";

  // ============================================================
  // FORM HANDLERS
  // ============================================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleBankAccountChange = (event) => {
    const value = event.target.value;

    const account = activeBankAccounts.find(
      (item) => String(item.id) === String(value)
    );

    setForm((previous) => ({
      ...previous,
      bank_account: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleDirectionChange = (direction) => {
    setForm((previous) => ({
      ...previous,
      adjustment_direction: direction,
    }));

    setError("");
    setSuccess("");
  };

  // ============================================================
  // SUBMIT
  // ============================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!companyId) {
      setError("Please select a company first.");
      return;
    }

    if (!form.bank_account) {
      setError("Please select a bank account.");
      return;
    }

    if (!form.counter_account) {
      setError("Please select a counter account.");
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      setError("Adjustment amount must be greater than zero.");
      return;
    }

    if (!form.transaction_date) {
      setError("Transaction date is required.");
      return;
    }

    if (
      !["INCREASE", "DECREASE"].includes(
        form.adjustment_direction
      )
    ) {
      setError("Please select an adjustment direction.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        bank_account: Number(form.bank_account),
        counter_account: Number(form.counter_account),
        amount: form.amount,
        adjustment_direction:
          form.adjustment_direction,
        transaction_date: form.transaction_date,
        reference: form.reference.trim(),
        description: form.description.trim(),
      };

      await api.post(
        `/api/banking/adjustments/?company=${companyId}`,
        payload
      );

      setSuccess(
        form.adjustment_direction === "INCREASE"
          ? "Bank balance increased successfully."
          : "Bank balance decreased successfully."
      );

      setForm({
        ...EMPTY_FORM,
        transaction_date: new Date()
          .toISOString()
          .slice(0, 10),
      });

      await loadData();
    } catch (err) {
      setError(
        err?.data?.detail ||
          err?.message ||
          "Unable to record the adjustment."
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // FILTERED HISTORY
  // ============================================================

  const filteredAdjustments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return adjustments.filter((transaction) => {
      const bankAccount = bankAccounts.find(
        (account) =>
          Number(account.id) ===
          Number(transaction.bank_account)
      );

      const currency =
        bankAccount?.currency || "USD";

      const text = [
        transaction.reference,
        transaction.description,
        transaction.bank_name,
        transaction.bank_account_name,
        transaction.account_number,
        transaction.transaction_type_display,
        currency,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || text.includes(query);

      const matchesCurrency =
        currencyFilter === "ALL" ||
        currency === currencyFilter;

      /*
       * The current BankTransaction model does not store
       * adjustment_direction. The transaction history therefore
       * remains neutral here and direction is shown when the
       * transaction is created or selected from the current
       * session.
       *
       * We keep the direction filter available for future
       * persisted direction support.
       */
      const matchesDirection =
        directionFilter === "ALL";

      return (
        matchesSearch &&
        matchesCurrency &&
        matchesDirection
      );
    });
  }, [
    adjustments,
    bankAccounts,
    search,
    directionFilter,
    currencyFilter,
  ]);

  // ============================================================
  // CURRENCY TOTALS
  // ============================================================

  const currencyTotals = useMemo(() => {
    const totals = {
      USD: {
        increases: 0,
        decreases: 0,
        net: 0,
        count: 0,
      },
      LRD: {
        increases: 0,
        decreases: 0,
        net: 0,
        count: 0,
      },
    };

    adjustments.forEach((transaction) => {
      const bankAccount = bankAccounts.find(
        (account) =>
          Number(account.id) ===
          Number(transaction.bank_account)
      );

      const currency =
        bankAccount?.currency || "USD";

      if (!totals[currency]) {
        totals[currency] = {
          increases: 0,
          decreases: 0,
          net: 0,
          count: 0,
        };
      }

      /*
       * Because the existing transaction record does not persist
       * direction, totals cannot safely classify historical
       * adjustments as increases/decreases.
       *
       * We therefore only count the transaction volume here.
       */
      totals[currency].count += 1;
    });

    return totals;
  }, [adjustments, bankAccounts]);

  // ============================================================
  // EXPORT
  // ============================================================

  const exportCSV = () => {
    if (!filteredAdjustments.length) {
      setError("There are no adjustments to export.");
      return;
    }

    const rows = filteredAdjustments.map(
      (transaction) => {
        const bankAccount = bankAccounts.find(
          (account) =>
            Number(account.id) ===
            Number(transaction.bank_account)
        );

        const currency =
          bankAccount?.currency || "USD";

        return {
          Date: transaction.transaction_date || "",
          Bank: transaction.bank_name || "",
          Account:
            transaction.bank_account_name || "",
          Currency: currency,
          Amount: transaction.amount || "",
          Reference: transaction.reference || "",
          Description:
            transaction.description || "",
        };
      }
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
            )}"`
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
    link.download = `bank-adjustments-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  // ============================================================
  // CLEAR FILTERS
  // ============================================================

  const clearFilters = () => {
    setSearch("");
    setDirectionFilter("ALL");
    setCurrencyFilter("ALL");
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="bank-adjustments-page">
      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div className="bank-adjustments-header">
        <div>
          <div className="bank-adjustments-eyebrow">
            BANKING
          </div>

          <h1>Bank Adjustments</h1>

          <p>
            Correct bank balances while maintaining
            proper double-entry accounting.
          </p>
        </div>

        <button
          type="button"
          className="bank-adjustments-refresh-btn"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw
            size={17}
            className={
              loading
                ? "bank-adjustments-spin"
                : ""
            }
          />
          Refresh
        </button>
      </div>

      {/* ======================================================
          COMPANY STRIP
      ====================================================== */}

      <div className="bank-adjustments-company-strip">
        <div className="bank-adjustments-company-icon">
          <Landmark size={20} />
        </div>

        <div>
          <span>Current Company</span>
          <strong>
            {currentCompany?.name ||
              "No company selected"}
          </strong>
        </div>

        <div className="bank-adjustments-company-divider" />

        <div>
          <span>Functional Currency</span>
          <strong>
            {currentCompany?.currency || "USD"}
          </strong>
        </div>

        <div className="bank-adjustments-company-divider" />

        <div>
          <span>Bank Accounts</span>
          <strong>
            {activeBankAccounts.length}
          </strong>
        </div>
      </div>

      {/* ======================================================
          ALERTS
      ====================================================== */}

      {error && (
        <div className="bank-adjustments-alert error">
          <AlertCircle size={18} />
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="bank-adjustments-alert success">
          <CheckCircle2 size={18} />
          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ======================================================
          KPI CARDS
      ====================================================== */}

      <div className="bank-adjustments-kpis">
        <div className="bank-adjustments-kpi-card">
          <div className="bank-adjustments-kpi-icon blue">
            <FileText size={19} />
          </div>

          <div>
            <span>Total Adjustments</span>
            <strong>
              {adjustments.length}
            </strong>
            <small>All currencies</small>
          </div>
        </div>

        <div className="bank-adjustments-kpi-card">
          <div className="bank-adjustments-kpi-icon gold">
            <Landmark size={19} />
          </div>

          <div>
            <span>USD Adjustments</span>
            <strong>
              {currencyTotals.USD.count}
            </strong>
            <small>USD bank accounts</small>
          </div>
        </div>

        <div className="bank-adjustments-kpi-card">
          <div className="bank-adjustments-kpi-icon navy">
            <Landmark size={19} />
          </div>

          <div>
            <span>LRD Adjustments</span>
            <strong>
              {currencyTotals.LRD.count}
            </strong>
            <small>LRD bank accounts</small>
          </div>
        </div>

        <div className="bank-adjustments-kpi-card">
          <div className="bank-adjustments-kpi-icon slate">
            <RefreshCw size={19} />
          </div>

          <div>
            <span>Available Accounts</span>
            <strong>
              {activeBankAccounts.length}
            </strong>
            <small>Active bank accounts</small>
          </div>
        </div>
      </div>

      {/* ======================================================
          ADJUSTMENT FORM
      ====================================================== */}

      <section className="bank-adjustments-form-card">
        <div className="bank-adjustments-section-heading">
          <div>
            <span>NEW ADJUSTMENT</span>
            <h2>Record Bank Adjustment</h2>
          </div>

          {selectedBankAccount && (
            <div className="bank-adjustments-selected-account">
              <Landmark size={16} />

              <div>
                <strong>
                  {selectedBankAccount.bank_name}
                </strong>

                <span>
                  {selectedBankAccount.account_name}
                  {" · "}
                  {selectedCurrency}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Direction */}
        <div className="bank-adjustments-direction-grid">
          <button
            type="button"
            className={`bank-adjustment-direction-card ${
              form.adjustment_direction ===
              "INCREASE"
                ? "active increase"
                : ""
            }`}
            onClick={() =>
              handleDirectionChange("INCREASE")
            }
          >
            <div className="bank-adjustment-direction-icon">
              <ArrowUpRight size={21} />
            </div>

            <div>
              <strong>
                Increase Bank Balance
              </strong>

              <span>
                Debit the bank account and credit
                the counter account.
              </span>
            </div>

            {form.adjustment_direction ===
              "INCREASE" && (
              <CheckCircle2
                size={20}
                className="bank-adjustment-selected-check"
              />
            )}
          </button>

          <button
            type="button"
            className={`bank-adjustment-direction-card ${
              form.adjustment_direction ===
              "DECREASE"
                ? "active decrease"
                : ""
            }`}
            onClick={() =>
              handleDirectionChange("DECREASE")
            }
          >
            <div className="bank-adjustment-direction-icon">
              <ArrowDownLeft size={21} />
            </div>

            <div>
              <strong>
                Decrease Bank Balance
              </strong>

              <span>
                Debit the counter account and credit
                the bank account.
              </span>
            </div>

            {form.adjustment_direction ===
              "DECREASE" && (
              <CheckCircle2
                size={20}
                className="bank-adjustment-selected-check"
              />
            )}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bank-adjustments-form-grid">
            {/* Bank Account */}
            <div className="bank-adjustments-field">
              <label>
                Bank Account
                <span>*</span>
              </label>

              <div className="bank-adjustments-select-wrap">
                <select
                  name="bank_account"
                  value={form.bank_account}
                  onChange={handleBankAccountChange}
                  required
                >
                  <option value="">
                    Select bank account
                  </option>

                  {activeBankAccounts.map(
                    (account) => (
                      <option
                        key={account.id}
                        value={account.id}
                      >
                        {account.bank_name} —{" "}
                        {account.account_name} (
                        {account.currency})
                      </option>
                    )
                  )}
                </select>

                <ChevronDown size={17} />
              </div>
            </div>

            {/* Counter Account */}
            <div className="bank-adjustments-field">
              <label>
                Counter Account
                <span>*</span>
              </label>

              <div className="bank-adjustments-select-wrap">
                <select
                  name="counter_account"
                  value={form.counter_account}
                  onChange={handleChange}
                  required
                >
                  <option value="">
                    Select accounting account
                  </option>

                  {activeAccountingAccounts.map(
                    (account) => (
                      <option
                        key={account.id}
                        value={account.id}
                      >
                        {getAccountLabel(account)}
                      </option>
                    )
                  )}
                </select>

                <ChevronDown size={17} />
              </div>
            </div>

            {/* Amount */}
            <div className="bank-adjustments-field">
              <label>
                Adjustment Amount
                <span>*</span>
              </label>

              <div className="bank-adjustments-money-input">
                <span>
                  {getCurrencySymbol(
                    selectedCurrency
                  )}
                </span>

                <input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </div>

              <small>
                Currency follows the selected bank
                account: {selectedCurrency}
              </small>
            </div>

            {/* Date */}
            <div className="bank-adjustments-field">
              <label>
                Transaction Date
                <span>*</span>
              </label>

              <input
                type="date"
                name="transaction_date"
                value={form.transaction_date}
                onChange={handleChange}
                required
              />
            </div>

            {/* Reference */}
            <div className="bank-adjustments-field">
              <label>Reference</label>

              <input
                type="text"
                name="reference"
                value={form.reference}
                onChange={handleChange}
                placeholder="e.g. ADJ-001"
              />
            </div>

            {/* Description */}
            <div className="bank-adjustments-field full">
              <label>Description</label>

              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Explain why the bank balance is being adjusted..."
                rows={3}
              />
            </div>
          </div>

          {/* Accounting Preview */}
          <div className="bank-adjustments-preview">
            <div className="bank-adjustments-preview-heading">
              <FileText size={17} />
              <strong>Accounting Preview</strong>
            </div>

            {form.adjustment_direction ===
            "INCREASE" ? (
              <div className="bank-adjustments-preview-grid">
                <div>
                  <span>Debit</span>
                  <strong>
                    {selectedBankAccount
                      ? `${selectedBankAccount.bank_name} — ${selectedBankAccount.account_name}`
                      : "Bank Account"}
                  </strong>
                </div>

                <div>
                  <span>Credit</span>
                  <strong>
                    Counter Account
                  </strong>
                </div>
              </div>
            ) : (
              <div className="bank-adjustments-preview-grid">
                <div>
                  <span>Debit</span>
                  <strong>
                    Counter Account
                  </strong>
                </div>

                <div>
                  <span>Credit</span>
                  <strong>
                    {selectedBankAccount
                      ? `${selectedBankAccount.bank_name} — ${selectedBankAccount.account_name}`
                      : "Bank Account"}
                  </strong>
                </div>
              </div>
            )}

            <div className="bank-adjustments-preview-amount">
              {getCurrencySymbol(
                selectedCurrency
              )}{" "}
              {formatMoney(
                form.amount,
                selectedCurrency
              )}
            </div>
          </div>

          <div className="bank-adjustments-form-actions">
            <button
              type="button"
              className="bank-adjustments-secondary-btn"
              onClick={() =>
                setForm({
                  ...EMPTY_FORM,
                  transaction_date:
                    new Date()
                      .toISOString()
                      .slice(0, 10),
                })
              }
              disabled={saving}
            >
              Clear
            </button>

            <button
              type="submit"
              className="bank-adjustments-primary-btn"
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCw
                    size={17}
                    className="bank-adjustments-spin"
                  />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 size={17} />
                  Record Adjustment
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* ======================================================
          HISTORY
      ====================================================== */}

      <section className="bank-adjustments-history-card">
        <div className="bank-adjustments-history-header">
          <div>
            <span>TRANSACTION HISTORY</span>
            <h2>Bank Adjustments</h2>
          </div>

          <button
            type="button"
            className="bank-adjustments-export-btn"
            onClick={exportCSV}
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>

        <div className="bank-adjustments-filters">
          <div className="bank-adjustments-search">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search adjustments..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <div className="bank-adjustments-filter">
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
              <option value="USD">USD</option>
              <option value="LRD">LRD</option>
            </select>

            <ChevronDown size={16} />
          </div>

          <div className="bank-adjustments-filter">
            <select
              value={directionFilter}
              onChange={(event) =>
                setDirectionFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All directions
              </option>
              <option value="INCREASE">
                Increases
              </option>
              <option value="DECREASE">
                Decreases
              </option>
            </select>

            <ChevronDown size={16} />
          </div>

          {(search ||
            currencyFilter !== "ALL" ||
            directionFilter !== "ALL") && (
            <button
              type="button"
              className="bank-adjustments-clear-filter"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="bank-adjustments-empty">
            <RefreshCw
              size={24}
              className="bank-adjustments-spin"
            />

            <strong>
              Loading adjustments...
            </strong>
          </div>
        ) : filteredAdjustments.length === 0 ? (
          <div className="bank-adjustments-empty">
            <FileText size={30} />

            <strong>
              No bank adjustments found
            </strong>

            <span>
              Recorded adjustments will appear here.
            </span>
          </div>
        ) : (
          <div className="bank-adjustments-table-wrap">
            <table className="bank-adjustments-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bank Account</th>
                  <th>Direction</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filteredAdjustments.map(
                  (transaction) => {
                    const bankAccount =
                      bankAccounts.find(
                        (account) =>
                          Number(account.id) ===
                          Number(
                            transaction.bank_account
                          )
                      );

                    const currency =
                      bankAccount?.currency ||
                      "USD";

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
                          <div className="bank-adjustments-account-cell">
                            <div className="bank-adjustments-mini-icon">
                              <Landmark size={15} />
                            </div>

                            <div>
                              <strong>
                                {transaction.bank_name ||
                                  bankAccount?.bank_name ||
                                  "Bank"}
                              </strong>

                              <span>
                                {transaction.bank_account_name ||
                                  bankAccount?.account_name ||
                                  "Account"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="bank-adjustments-type-badge">
                            Adjustment
                          </span>
                        </td>

                        <td>
                          <strong className="bank-adjustments-amount">
                            {getCurrencySymbol(
                              currency
                            )}{" "}
                            {formatMoney(
                              transaction.amount,
                              currency
                            )}
                          </strong>
                        </td>

                        <td>
                          {transaction.reference ||
                            "—"}
                        </td>

                        <td className="bank-adjustments-description-cell">
                          {transaction.description ||
                            "—"}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="bank-adjustments-view-btn"
                            onClick={() =>
                              setSelectedAdjustment({
                                ...transaction,
                                currency,
                              })
                            }
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ======================================================
          DETAIL MODAL
      ====================================================== */}

      {selectedAdjustment && (
        <div
          className="bank-adjustments-modal-backdrop"
          onClick={() =>
            setSelectedAdjustment(null)
          }
        >
          <div
            className="bank-adjustments-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="bank-adjustments-modal-header">
              <div>
                <span>ADJUSTMENT DETAILS</span>
                <h2>
                  Bank Adjustment #
                  {selectedAdjustment.id}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedAdjustment(null)
                }
              >
                <X size={19} />
              </button>
            </div>

            <div className="bank-adjustments-modal-body">
              <div className="bank-adjustments-detail-grid">
                <div>
                  <span>Date</span>
                  <strong>
                    {formatDate(
                      selectedAdjustment.transaction_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>Currency</span>
                  <strong>
                    {selectedAdjustment.currency}
                  </strong>
                </div>

                <div>
                  <span>Amount</span>
                  <strong>
                    {getCurrencySymbol(
                      selectedAdjustment.currency
                    )}{" "}
                    {formatMoney(
                      selectedAdjustment.amount,
                      selectedAdjustment.currency
                    )}
                  </strong>
                </div>

                <div>
                  <span>Transaction Type</span>
                  <strong>
                    Adjustment
                  </strong>
                </div>
              </div>

              <div className="bank-adjustments-modal-account">
                <div className="bank-adjustments-mini-icon">
                  <Landmark size={17} />
                </div>

                <div>
                  <span>Bank Account</span>

                  <strong>
                    {selectedAdjustment.bank_name ||
                      "Bank"}
                    {" — "}
                    {selectedAdjustment.bank_account_name ||
                      "Account"}
                  </strong>

                  {selectedAdjustment.account_number && (
                    <small>
                      Account #
                      {
                        selectedAdjustment.account_number
                      }
                    </small>
                  )}
                </div>
              </div>

              <div className="bank-adjustments-detail-block">
                <span>Reference</span>
                <strong>
                  {selectedAdjustment.reference ||
                    "No reference provided"}
                </strong>
              </div>

              <div className="bank-adjustments-detail-block">
                <span>Description</span>
                <p>
                  {selectedAdjustment.description ||
                    "No description provided."}
                </p>
              </div>

              {selectedAdjustment.journal_entry && (
                <div className="bank-adjustments-journal-reference">
                  <FileText size={16} />

                  <span>
                    Journal Entry
                  </span>

                  <strong>
                    #
                    {
                      selectedAdjustment.journal_entry
                    }
                  </strong>
                </div>
              )}
            </div>

            <div className="bank-adjustments-modal-footer">
              <button
                type="button"
                onClick={() =>
                  setSelectedAdjustment(null)
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