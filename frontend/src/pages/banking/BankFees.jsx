import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  ReceiptText,
  RefreshCw,
  Wallet,
  X,
} from "lucide-react";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";

const CURRENCIES = ["USD", "LRD"];

const initialForm = {
  bank_account: "",
  expense_account: "",
  amount: "",
  transaction_date: new Date()
    .toISOString()
    .split("T")[0],
  reference: "",
  description: "",
};

function formatMoney(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getCurrencySymbol(currency) {
  if (currency === "USD") return "$";
  if (currency === "LRD") return "L$";
  return currency || "";
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

export default function BankFees() {
  const { currentCompany } = useCompany();

  const [accounts, setAccounts] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [form, setForm] = useState(initialForm);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showConfirmation, setShowConfirmation] =
    useState(false);

  const companyId = currentCompany?.id;

  const loadData = async (showRefresh = false) => {
    if (!companyId) {
      setAccounts([]);
      setExpenseAccounts([]);
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

      const [
        accountsResponse,
        accountingResponse,
        transactionsResponse,
      ] = await Promise.all([
        api.get(
          `/api/banking/accounts/?company=${companyId}`
        ),
        api.get(
          `/api/accounting/accounts/?company=${companyId}`
        ),
        api.get(
          `/api/banking/transactions/?company=${companyId}&transaction_type=BANK_FEE`
        ),
      ]);

      const accountList = Array.isArray(
        accountsResponse
      )
        ? accountsResponse
        : accountsResponse?.results || [];

      const accountingList = Array.isArray(
        accountingResponse
      )
        ? accountingResponse
        : accountingResponse?.results || [];

      const transactionList = Array.isArray(
        transactionsResponse
      )
        ? transactionsResponse
        : transactionsResponse?.results || [];

      setAccounts(accountList);
      setExpenseAccounts(
        accountingList.filter(
          (account) =>
            account.account_type === "EXPENSE" &&
            account.is_active !== false
        )
      );
      setTransactions(transactionList);
    } catch (err) {
      setError(
        err?.data?.detail ||
          err?.message ||
          "Unable to load bank fee information."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  const activeAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.is_active !== false
      ),
    [accounts]
  );

  const selectedBankAccount = useMemo(
    () =>
      activeAccounts.find(
        (account) =>
          String(account.id) ===
          String(form.bank_account)
      ),
    [activeAccounts, form.bank_account]
  );

  const selectedExpenseAccount = useMemo(
    () =>
      expenseAccounts.find(
        (account) =>
          String(account.id) ===
          String(form.expense_account)
      ),
    [expenseAccounts, form.expense_account]
  );

  const feeCurrency =
    selectedBankAccount?.currency || "";

  const availableBalance = Number(
    selectedBankAccount?.bank_account_balance || 0
  );

  const feeAmount = Number(form.amount || 0);

  const insufficientFunds =
    selectedBankAccount &&
    feeAmount > availableBalance;

  const currencyTotals = useMemo(() => {
    return CURRENCIES.reduce(
      (result, currency) => {
        result[currency] = transactions
          .filter((transaction) => {
            const account =
              accounts.find(
                (item) =>
                  item.id ===
                  transaction.bank_account
              );

            return account?.currency === currency;
          })
          .reduce(
            (total, transaction) =>
              total +
              Number(transaction.amount || 0),
            0
          );

        return result;
      },
      {
        USD: 0,
        LRD: 0,
      }
    );
  }, [transactions, accounts]);

  const canSubmit =
    Boolean(companyId) &&
    Boolean(selectedBankAccount) &&
    Boolean(selectedExpenseAccount) &&
    feeAmount > 0 &&
    !insufficientFunds &&
    Boolean(form.transaction_date) &&
    !submitting;

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleBankAccountChange = (value) => {
    setForm((current) => ({
      ...current,
      bank_account: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!selectedBankAccount) {
      setError(
        "Please select a bank account."
      );
      return;
    }

    if (!selectedExpenseAccount) {
      setError(
        "Please select an expense account."
      );
      return;
    }

    if (!form.amount || feeAmount <= 0) {
      setError(
        "Bank fee amount must be greater than zero."
      );
      return;
    }

    if (feeAmount > availableBalance) {
      setError(
        "Bank fee cannot exceed the available bank account balance."
      );
      return;
    }

    if (!form.transaction_date) {
      setError(
        "Transaction date is required."
      );
      return;
    }

    setShowConfirmation(true);
  };

  const confirmFee = async () => {
    if (!canSubmit) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const response = await api.post(
        `/api/banking/fees/?company=${companyId}`,
        {
          bank_account: Number(
            form.bank_account
          ),
          expense_account: Number(
            form.expense_account
          ),
          amount: form.amount,
          transaction_date:
            form.transaction_date,
          reference:
            form.reference.trim(),
          description:
            form.description.trim() ||
            "Bank fee",
        }
      );

      setShowConfirmation(false);

      setSuccess(
        `Bank fee recorded successfully. Journal entry #${
          response?.journal_entry || "created"
        } was posted.`
      );

      setForm({
        ...initialForm,
        transaction_date: new Date()
          .toISOString()
          .split("T")[0],
      });

      await loadData(true);
    } catch (err) {
      setError(
        err?.data?.detail ||
          err?.message ||
          "Unable to record the bank fee."
      );

      setShowConfirmation(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentCompany) {
    return (
      <div className="bank-fees-page">
        <div className="bank-fees-empty">
          <Building2 size={28} />
          <h2>No Company Selected</h2>
          <p>
            Select a company to manage bank fees.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bank-fees-page">
      {/* HEADER */}
      <div className="bank-fees-header">
        <div>
          <div className="bank-fees-eyebrow">
            BANKING
          </div>

          <h1>Bank Fees</h1>

          <p>
            Record bank charges and post them
            directly to the accounting ledger for{" "}
            <strong>
              {currentCompany.name}
            </strong>
            .
          </p>
        </div>

        <button
          type="button"
          className="bank-fees-refresh"
          onClick={() => loadData(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={17}
            className={
              refreshing
                ? "bank-fees-spin"
                : ""
            }
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      {/* COMPANY STRIP */}
      <div className="bank-fees-company-strip">
        <div className="bank-fees-company-icon">
          <Building2 size={20} />
        </div>

        <div>
          <span>Current Company</span>
          <strong>
            {currentCompany.name}
          </strong>
        </div>

        <div className="bank-fees-company-meta">
          <span>Functional Currency</span>
          <strong>
            {currentCompany.currency || "USD"}
          </strong>
        </div>

        <div className="bank-fees-company-meta">
          <span>Recorded Fees</span>
          <strong>
            {transactions.length}
          </strong>
        </div>
      </div>

      {error && (
        <div className="bank-fees-alert error">
          {error}
        </div>
      )}

      {success && (
        <div className="bank-fees-alert success">
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

      {/* CURRENCY SUMMARY */}
      <div className="bank-fees-summary-grid">
        <div className="bank-fees-summary-card">
          <div className="bank-fees-summary-icon">
            <ReceiptText size={20} />
          </div>

          <div>
            <span>USD Bank Fees</span>
            <strong>
              $
              {formatMoney(
                currencyTotals.USD
              )}
            </strong>
          </div>
        </div>

        <div className="bank-fees-summary-card">
          <div className="bank-fees-summary-icon">
            <ReceiptText size={20} />
          </div>

          <div>
            <span>LRD Bank Fees</span>
            <strong>
              L$
              {formatMoney(
                currencyTotals.LRD
              )}
            </strong>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="bank-fees-layout">
        {/* FORM */}
        <section className="bank-fees-form-card">
          <div className="bank-fees-card-header">
            <div>
              <h2>Record Bank Fee</h2>
              <p>
                Record a bank charge against an
                expense account.
              </p>
            </div>

            <div className="bank-fees-header-icon">
              <ReceiptText size={21} />
            </div>
          </div>

          <form
            className="bank-fees-form"
            onSubmit={handleSubmit}
          >
            {/* BANK ACCOUNT */}
            <div className="bank-fees-field">
              <label htmlFor="bank_account">
                Bank Account
              </label>

              <div className="bank-fees-select-wrap">
                <CreditCard size={17} />

                <select
                  id="bank_account"
                  name="bank_account"
                  value={form.bank_account}
                  onChange={(event) =>
                    handleBankAccountChange(
                      event.target.value
                    )
                  }
                  disabled={
                    loading || submitting
                  }
                >
                  <option value="">
                    Select bank account
                  </option>

                  {activeAccounts.map(
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

                <ChevronDown size={16} />
              </div>

              {selectedBankAccount && (
                <div className="bank-fees-account-info">
                  <span>
                    Available Balance
                  </span>

                  <strong>
                    {getCurrencySymbol(
                      selectedBankAccount.currency
                    )}
                    {formatMoney(
                      selectedBankAccount.bank_account_balance
                    )}
                  </strong>
                </div>
              )}
            </div>

            {/* EXPENSE ACCOUNT */}
            <div className="bank-fees-field">
              <label htmlFor="expense_account">
                Expense Account
              </label>

              <div className="bank-fees-select-wrap">
                <ReceiptText size={17} />

                <select
                  id="expense_account"
                  name="expense_account"
                  value={
                    form.expense_account
                  }
                  onChange={handleChange}
                  disabled={
                    loading || submitting
                  }
                >
                  <option value="">
                    Select expense account
                  </option>

                  {expenseAccounts.map(
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

                <ChevronDown size={16} />
              </div>

              {selectedExpenseAccount && (
                <div className="bank-fees-selected-account">
                  Account{" "}
                  <strong>
                    {selectedExpenseAccount.code}
                  </strong>
                </div>
              )}
            </div>

            {/* CURRENCY */}
            <div className="bank-fees-currency-panel">
              <div>
                <span>Fee Currency</span>
                <strong>
                  {feeCurrency || "—"}
                </strong>
              </div>

              <div>
                <span>Posting</span>
                <strong>
                  DR Expense / CR Bank
                </strong>
              </div>
            </div>

            {/* AMOUNT */}
            <div className="bank-fees-field">
              <label htmlFor="amount">
                Fee Amount
              </label>

              <div className="bank-fees-amount-input">
                <span>
                  {getCurrencySymbol(
                    feeCurrency
                  )}
                </span>

                <input
                  id="amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={handleChange}
                  disabled={
                    submitting ||
                    !selectedBankAccount
                  }
                />
              </div>

              {selectedBankAccount && (
                <div
                  className={`bank-fees-balance-helper ${
                    insufficientFunds
                      ? "insufficient"
                      : ""
                  }`}
                >
                  Available:{" "}
                  {getCurrencySymbol(
                    feeCurrency
                  )}
                  {formatMoney(
                    availableBalance
                  )}
                </div>
              )}
            </div>

            {/* DATE + REFERENCE */}
            <div className="bank-fees-two-column">
              <div className="bank-fees-field">
                <label htmlFor="transaction_date">
                  Transaction Date
                </label>

                <input
                  id="transaction_date"
                  name="transaction_date"
                  type="date"
                  value={
                    form.transaction_date
                  }
                  onChange={handleChange}
                  disabled={submitting}
                />
              </div>

              <div className="bank-fees-field">
                <label htmlFor="reference">
                  Reference
                </label>

                <input
                  id="reference"
                  name="reference"
                  type="text"
                  placeholder="e.g. BANK-FEE-001"
                  value={form.reference}
                  onChange={handleChange}
                  disabled={submitting}
                />
              </div>
            </div>

            {/* DESCRIPTION */}
            <div className="bank-fees-field">
              <label htmlFor="description">
                Description
              </label>

              <textarea
                id="description"
                name="description"
                rows="4"
                placeholder="Describe the bank charge..."
                value={form.description}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>

            <button
              type="submit"
              className="bank-fees-submit"
              disabled={!canSubmit}
            >
              <ReceiptText size={17} />
              Review Bank Fee
            </button>
          </form>
        </section>

        {/* SIDE SUMMARY */}
        <aside className="bank-fees-preview-card">
          <div className="bank-fees-preview-icon">
            <Wallet size={22} />
          </div>

          <h2>Fee Summary</h2>

          <p>
            Review the bank account and expense
            posting before recording the charge.
          </p>

          <div className="bank-fees-preview-row">
            <span>Bank Account</span>
            <strong>
              {selectedBankAccount
                ? selectedBankAccount.account_name
                : "Not selected"}
            </strong>
          </div>

          <div className="bank-fees-preview-row">
            <span>Expense Account</span>
            <strong>
              {selectedExpenseAccount
                ? `${selectedExpenseAccount.code} — ${selectedExpenseAccount.name}`
                : "Not selected"}
            </strong>
          </div>

          <div className="bank-fees-preview-amount">
            <span>
              {feeCurrency || "Currency"}
            </span>

            <strong>
              {getCurrencySymbol(
                feeCurrency
              )}
              {formatMoney(form.amount)}
            </strong>
          </div>

          <div className="bank-fees-preview-rule">
            <CheckCircle2 size={17} />

            <span>
              The transaction will post as
              a balanced double-entry entry.
            </span>
          </div>
        </aside>
      </div>

      {/* HISTORY */}
      <section className="bank-fees-history-card">
        <div className="bank-fees-history-header">
          <div>
            <h2>Recent Bank Fees</h2>
            <p>
              Recent bank charges recorded for
              this company.
            </p>
          </div>

          <span>
            {transactions.length} Fee
            {transactions.length !== 1
              ? "s"
              : ""}
          </span>
        </div>

        <div className="bank-fees-table-wrapper">
          {loading ? (
            <div className="bank-fees-loading">
              Loading bank fees...
            </div>
          ) : transactions.length === 0 ? (
            <div className="bank-fees-empty-inline">
              <ReceiptText size={24} />
              <p>
                No bank fees have been recorded
                yet.
              </p>
            </div>
          ) : (
            <table className="bank-fees-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bank Account</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th>Currency</th>
                  <th className="bank-fees-amount-column">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {transactions.map(
                  (transaction) => {
                    const account =
                      accounts.find(
                        (item) =>
                          item.id ===
                          transaction.bank_account
                      );

                    return (
                      <tr
                        key={
                          transaction.id
                        }
                      >
                        <td>
                          {formatDate(
                            transaction.transaction_date
                          )}
                        </td>

                        <td>
                          <strong>
                            {account
                              ?.account_name ||
                              "Bank Account"}
                          </strong>
                        </td>

                        <td>
                          {transaction.reference ||
                            "—"}
                        </td>

                        <td className="bank-fees-description">
                          {transaction.description ||
                            "—"}
                        </td>

                        <td>
                          <span className="bank-fees-currency-badge">
                            {account?.currency ||
                              "—"}
                          </span>
                        </td>

                        <td className="bank-fees-amount-column bank-fees-out-amount">
                          -
                          {getCurrencySymbol(
                            account?.currency
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

      {/* CONFIRMATION MODAL */}
      {showConfirmation && (
        <div className="bank-fees-modal-backdrop">
          <div className="bank-fees-modal">
            <button
              type="button"
              className="bank-fees-modal-close"
              onClick={() =>
                setShowConfirmation(false)
              }
              disabled={submitting}
            >
              <X size={19} />
            </button>

            <div className="bank-fees-modal-icon">
              <ReceiptText size={22} />
            </div>

            <h2>Confirm Bank Fee</h2>

            <p>
              Please review the details before
              posting this bank charge.
            </p>

            <div className="bank-fees-confirmation-row">
              <span>Bank Account</span>
              <strong>
                {selectedBankAccount?.account_name}
              </strong>
            </div>

            <div className="bank-fees-confirmation-row">
              <span>Expense Account</span>
              <strong>
                {selectedExpenseAccount?.code} —{" "}
                {selectedExpenseAccount?.name}
              </strong>
            </div>

            <div className="bank-fees-confirmation-amount">
              <span>{feeCurrency}</span>

              <strong>
                {getCurrencySymbol(
                  feeCurrency
                )}
                {formatMoney(form.amount)}
              </strong>
            </div>

            <div className="bank-fees-modal-details">
              <div>
                <span>Date</span>
                <strong>
                  {formatDate(
                    form.transaction_date
                  )}
                </strong>
              </div>

              <div>
                <span>Reference</span>
                <strong>
                  {form.reference ||
                    "No reference"}
                </strong>
              </div>
            </div>

            <div className="bank-fees-modal-actions">
              <button
                type="button"
                className="bank-fees-cancel"
                onClick={() =>
                  setShowConfirmation(false)
                }
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="bank-fees-confirm"
                onClick={confirmFee}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <RefreshCw
                      size={17}
                      className="bank-fees-spin"
                    />
                    Posting...
                  </>
                ) : (
                  <>
                    <CheckCircle2
                      size={17}
                    />
                    Confirm Bank Fee
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}