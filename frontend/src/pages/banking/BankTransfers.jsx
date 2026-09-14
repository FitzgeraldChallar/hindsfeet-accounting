import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
  Send,
  Wallet,
  X,
} from "lucide-react";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";

const CURRENCIES = ["USD", "LRD"];

const initialForm = {
  source_account: "",
  destination_account: "",
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

export default function BankTransfers() {
  const { currentCompany } = useCompany();

  const [accounts, setAccounts] = useState([]);
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
        transactionsResponse,
      ] = await Promise.all([
        api.get(
          `/api/banking/accounts/?company=${companyId}`
        ),
        api.get(
          `/api/banking/transactions/?company=${companyId}&transaction_type=TRANSFER_OUT`
        ),
      ]);

      const accountList = Array.isArray(
        accountsResponse
      )
        ? accountsResponse
        : accountsResponse?.results || [];

      const transactionList = Array.isArray(
        transactionsResponse
      )
        ? transactionsResponse
        : transactionsResponse?.results || [];

      setAccounts(accountList);
      setTransactions(transactionList);
    } catch (err) {
      setError(
        err?.data?.detail ||
          err?.message ||
          "Unable to load transfer information."
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

  const sourceAccount = useMemo(
    () =>
      activeAccounts.find(
        (account) =>
          String(account.id) ===
          String(form.source_account)
      ),
    [activeAccounts, form.source_account]
  );

  const destinationAccount = useMemo(
    () =>
      activeAccounts.find(
        (account) =>
          String(account.id) ===
          String(form.destination_account)
      ),
    [
      activeAccounts,
      form.destination_account,
    ]
  );

  const transferCurrency =
    sourceAccount?.currency || "";

  const destinationAccounts = useMemo(() => {
    if (!sourceAccount) {
      return activeAccounts;
    }

    return activeAccounts.filter(
      (account) =>
        account.id !== sourceAccount.id &&
        account.currency === sourceAccount.currency
    );
  }, [activeAccounts, sourceAccount]);

  const sourceBalance = Number(
    sourceAccount?.bank_account_balance || 0
  );

  const transferAmount = Number(
    form.amount || 0
  );

  const insufficientFunds =
    sourceAccount &&
    transferAmount > sourceBalance;

  const canSubmit =
    Boolean(companyId) &&
    Boolean(sourceAccount) &&
    Boolean(destinationAccount) &&
    Boolean(form.amount) &&
    transferAmount > 0 &&
    !insufficientFunds &&
    Boolean(form.transaction_date) &&
    !submitting;

  const handleSourceChange = (value) => {
    const selected = activeAccounts.find(
      (account) =>
        String(account.id) === String(value)
    );

    setForm((current) => ({
      ...current,
      source_account: value,
      destination_account:
        selected &&
        current.destination_account
          ? activeAccounts.some(
              (account) =>
                String(account.id) ===
                  String(
                    current.destination_account
                  ) &&
                account.currency ===
                  selected.currency &&
                account.id !== selected.id
            )
            ? current.destination_account
            : ""
          : "",
    }));

    setError("");
    setSuccess("");
  };

  const handleDestinationChange = (value) => {
    const selected = activeAccounts.find(
      (account) =>
        String(account.id) === String(value)
    );

    if (
      sourceAccount &&
      selected &&
      selected.currency !== sourceAccount.currency
    ) {
      setError(
        "Source and destination bank accounts must use the same currency."
      );

      return;
    }

    setForm((current) => ({
      ...current,
      destination_account: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!sourceAccount) {
      setError(
        "Please select a source bank account."
      );
      return;
    }

    if (!destinationAccount) {
      setError(
        "Please select a destination bank account."
      );
      return;
    }

    if (
      sourceAccount.currency !==
      destinationAccount.currency
    ) {
      setError(
        "Source and destination bank accounts must use the same currency."
      );
      return;
    }

    if (!form.amount || transferAmount <= 0) {
      setError(
        "Transfer amount must be greater than zero."
      );
      return;
    }

    if (transferAmount > sourceBalance) {
      setError(
        "Transfer amount cannot exceed the available source account balance."
      );
      return;
    }

    if (!form.transaction_date) {
      setError(
        "Transfer date is required."
      );
      return;
    }

    setShowConfirmation(true);
  };

  const confirmTransfer = async () => {
    if (!canSubmit) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const response = await api.post(
        `/api/banking/transfers/?company=${companyId}`,
        {
          source_account: Number(
            form.source_account
          ),
          destination_account: Number(
            form.destination_account
          ),
          amount: form.amount,
          transaction_date:
            form.transaction_date,
          reference:
            form.reference.trim(),
          description:
            form.description.trim(),
        }
      );

      setShowConfirmation(false);

      setSuccess(
        `Transfer completed successfully. Journal entry #${
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
          "Unable to complete the transfer."
      );

      setShowConfirmation(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentCompany) {
    return (
      <div className="bank-transfer-page">
        <div className="bank-transfer-empty">
          <Building2 size={28} />
          <h2>No Company Selected</h2>
          <p>
            Select a company to manage bank
            transfers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bank-transfer-page">
      {/* ================================================== */}
      {/* HEADER */}
      {/* ================================================== */}

      <div className="bank-transfer-header">
        <div>
          <div className="bank-transfer-eyebrow">
            BANKING
          </div>

          <h1>Bank Transfers</h1>

          <p>
            Move funds between bank accounts
            belonging to{" "}
            <strong>
              {currentCompany.name}
            </strong>
            .
          </p>
        </div>

        <button
          type="button"
          className="bank-transfer-refresh"
          onClick={() => loadData(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={17}
            className={
              refreshing
                ? "bank-transfer-spin"
                : ""
            }
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      {/* ================================================== */}
      {/* COMPANY STRIP */}
      {/* ================================================== */}

      <div className="bank-transfer-company-strip">
        <div className="bank-transfer-company-icon">
          <Building2 size={20} />
        </div>

        <div>
          <span>Current Company</span>
          <strong>
            {currentCompany.name}
          </strong>
        </div>

        <div className="bank-transfer-company-meta">
          <span>Functional Currency</span>
          <strong>
            {currentCompany.currency || "USD"}
          </strong>
        </div>

        <div className="bank-transfer-company-meta">
          <span>Active Bank Accounts</span>
          <strong>
            {activeAccounts.length}
          </strong>
        </div>
      </div>

      {error && (
        <div className="bank-transfer-alert error">
          {error}
        </div>
      )}

      {success && (
        <div className="bank-transfer-alert success">
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

      {/* ================================================== */}
      {/* TRANSFER FORM */}
      {/* ================================================== */}

      <div className="bank-transfer-layout">
        <section className="bank-transfer-form-card">
          <div className="bank-transfer-card-header">
            <div>
              <h2>Create Transfer</h2>
              <p>
                Select the source and destination
                bank accounts.
              </p>
            </div>

            <div className="bank-transfer-header-icon">
              <ArrowRightLeft size={21} />
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bank-transfer-form"
          >
            {/* SOURCE */}

            <div className="bank-transfer-field">
              <label htmlFor="source_account">
                Source Bank Account
              </label>

              <div className="bank-transfer-select-wrap">
                <Wallet size={17} />

                <select
                  id="source_account"
                  name="source_account"
                  value={form.source_account}
                  onChange={(event) =>
                    handleSourceChange(
                      event.target.value
                    )
                  }
                  disabled={
                    loading || submitting
                  }
                >
                  <option value="">
                    Select source account
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

              {sourceAccount && (
                <div className="bank-transfer-account-info">
                  <span>
                    Available Balance
                  </span>

                  <strong>
                    {getCurrencySymbol(
                      sourceAccount.currency
                    )}
                    {formatMoney(
                      sourceAccount.bank_account_balance
                    )}
                  </strong>
                </div>
              )}
            </div>

            {/* TRANSFER ARROW */}

            <div className="bank-transfer-direction">
              <ArrowRight size={20} />
            </div>

            {/* DESTINATION */}

            <div className="bank-transfer-field">
              <label htmlFor="destination_account">
                Destination Bank Account
              </label>

              <div className="bank-transfer-select-wrap">
                <Wallet size={17} />

                <select
                  id="destination_account"
                  name="destination_account"
                  value={
                    form.destination_account
                  }
                  onChange={(event) =>
                    handleDestinationChange(
                      event.target.value
                    )
                  }
                  disabled={
                    loading ||
                    submitting ||
                    !sourceAccount
                  }
                >
                  <option value="">
                    {!sourceAccount
                      ? "Select source first"
                      : destinationAccounts.length ===
                        0
                      ? "No same-currency accounts"
                      : "Select destination account"}
                  </option>

                  {destinationAccounts.map(
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

              {sourceAccount &&
                destinationAccounts.length ===
                  0 && (
                  <div className="bank-transfer-helper">
                    No other active{" "}
                    {sourceAccount.currency} bank
                    account is available for
                    transfer.
                  </div>
                )}
            </div>

            {/* CURRENCY */}

            <div className="bank-transfer-currency-panel">
              <div>
                <span>Transfer Currency</span>

                <strong>
                  {transferCurrency || "—"}
                </strong>
              </div>

              <div>
                <span>Transfer Rule</span>

                <strong>
                  Same currency only
                </strong>
              </div>
            </div>

            {/* AMOUNT */}

            <div className="bank-transfer-field">
              <label htmlFor="amount">
                Transfer Amount
              </label>

              <div className="bank-transfer-amount-input">
                <span>
                  {getCurrencySymbol(
                    transferCurrency
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
                    !sourceAccount
                  }
                />
              </div>

              {sourceAccount && (
                <div
                  className={`bank-transfer-balance-helper ${
                    insufficientFunds
                      ? "insufficient"
                      : ""
                  }`}
                >
                  Available:{" "}
                  {getCurrencySymbol(
                    sourceAccount.currency
                  )}
                  {formatMoney(
                    sourceBalance
                  )}
                </div>
              )}
            </div>

            {/* DATE + REFERENCE */}

            <div className="bank-transfer-two-column">
              <div className="bank-transfer-field">
                <label htmlFor="transaction_date">
                  Transfer Date
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

              <div className="bank-transfer-field">
                <label htmlFor="reference">
                  Reference
                </label>

                <input
                  id="reference"
                  name="reference"
                  type="text"
                  placeholder="e.g. TRF-001"
                  value={form.reference}
                  onChange={handleChange}
                  disabled={submitting}
                />
              </div>
            </div>

            {/* DESCRIPTION */}

            <div className="bank-transfer-field">
              <label htmlFor="description">
                Description
              </label>

              <textarea
                id="description"
                name="description"
                rows="4"
                placeholder="Describe the reason for this transfer..."
                value={form.description}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>

            {/* SUBMIT */}

            <button
              type="submit"
              className="bank-transfer-submit"
              disabled={!canSubmit}
            >
              <Send size={17} />

              Review Transfer
            </button>
          </form>
        </section>

        {/* ================================================== */}
        {/* TRANSFER SUMMARY */}
        {/* ================================================== */}

        <aside className="bank-transfer-summary-card">
          <div className="bank-transfer-summary-icon">
            <ArrowRightLeft size={22} />
          </div>

          <h2>Transfer Summary</h2>

          <p>
            Review the movement before it is
            posted to the accounting ledger.
          </p>

          <div className="bank-transfer-summary-flow">
            <div className="bank-transfer-summary-account">
              <span>FROM</span>

              <strong>
                {sourceAccount
                  ? sourceAccount.account_name
                  : "Source account"}
              </strong>

              {sourceAccount && (
                <small>
                  {sourceAccount.bank_name}
                </small>
              )}
            </div>

            <div className="bank-transfer-summary-arrow">
              <ArrowRight size={18} />
            </div>

            <div className="bank-transfer-summary-account">
              <span>TO</span>

              <strong>
                {destinationAccount
                  ? destinationAccount.account_name
                  : "Destination account"}
              </strong>

              {destinationAccount && (
                <small>
                  {destinationAccount.bank_name}
                </small>
              )}
            </div>
          </div>

          <div className="bank-transfer-summary-amount">
            <span>Amount</span>

            <strong>
              {transferCurrency
                ? getCurrencySymbol(
                    transferCurrency
                  )
                : ""}

              {formatMoney(
                form.amount
              )}
            </strong>
          </div>

          <div className="bank-transfer-summary-rule">
            <CheckCircle2 size={17} />

            <span>
              Transfers are posted as a
              balanced double-entry transaction.
            </span>
          </div>
        </aside>
      </div>

      {/* ================================================== */}
      {/* TRANSFER HISTORY */}
      {/* ================================================== */}

      <section className="bank-transfer-history-card">
        <div className="bank-transfer-history-header">
          <div>
            <h2>Recent Transfers</h2>
            <p>
              Recent outgoing transfer activity
              for this company.
            </p>
          </div>

          <span>
            {transactions.length} Transfer
            {transactions.length !== 1
              ? "s"
              : ""}
          </span>
        </div>

        <div className="bank-transfer-table-wrapper">
          {loading ? (
            <div className="bank-transfer-loading">
              Loading transfer history...
            </div>
          ) : transactions.length === 0 ? (
            <div className="bank-transfer-empty-inline">
              <ArrowRightLeft size={24} />
              <p>
                No transfers have been recorded
                yet.
              </p>
            </div>
          ) : (
            <table className="bank-transfer-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>From</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th>Currency</th>
                  <th className="bank-transfer-amount-column">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {transactions.map(
                  (transaction) => {
                    const account =
                      activeAccounts.find(
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

                        <td className="bank-transfer-description">
                          {transaction.description ||
                            "—"}
                        </td>

                        <td>
                          <span className="bank-transfer-currency-badge">
                            {account?.currency ||
                              "—"}
                          </span>
                        </td>

                        <td className="bank-transfer-amount-column bank-transfer-out-amount">
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

      {/* ================================================== */}
      {/* CONFIRMATION MODAL */}
      {/* ================================================== */}

      {showConfirmation && (
        <div className="bank-transfer-modal-backdrop">
          <div className="bank-transfer-modal">
            <button
              type="button"
              className="bank-transfer-modal-close"
              onClick={() =>
                setShowConfirmation(false)
              }
              disabled={submitting}
            >
              <X size={19} />
            </button>

            <div className="bank-transfer-modal-icon">
              <ArrowRightLeft size={22} />
            </div>

            <h2>Confirm Transfer</h2>

            <p>
              Please review the transfer details
              before posting.
            </p>

            <div className="bank-transfer-confirmation">
              <div>
                <span>From</span>
                <strong>
                  {sourceAccount?.account_name}
                </strong>
              </div>

              <ArrowRight size={18} />

              <div>
                <span>To</span>
                <strong>
                  {destinationAccount?.account_name}
                </strong>
              </div>
            </div>

            <div className="bank-transfer-confirmation-amount">
              <span>
                {transferCurrency}
              </span>

              <strong>
                {getCurrencySymbol(
                  transferCurrency
                )}
                {formatMoney(
                  form.amount
                )}
              </strong>
            </div>

            <div className="bank-transfer-modal-details">
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

            <div className="bank-transfer-modal-actions">
              <button
                type="button"
                className="bank-transfer-cancel"
                onClick={() =>
                  setShowConfirmation(false)
                }
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="bank-transfer-confirm"
                onClick={confirmTransfer}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <RefreshCw
                      size={17}
                      className="bank-transfer-spin"
                    />
                    Posting...
                  </>
                ) : (
                  <>
                    <CheckCircle2
                      size={17}
                    />
                    Confirm Transfer
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