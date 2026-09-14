import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowUpRight,
  Building2,
  Check,
  Landmark,
  Plus,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";


const emptyForm = {
  bank_account: "",
  counter_account: "",
  amount: "",
  transaction_date: new Date()
    .toISOString()
    .split("T")[0],
  reference: "",
  description: "",
};


export default function BankWithdrawals() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;

  const [accounts, setAccounts] = useState([]);
  const [accountingAccounts, setAccountingAccounts] =
    useState([]);
  const [transactions, setTransactions] =
    useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] =
    useState("");

  const [showModal, setShowModal] =
    useState(false);

  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    ...emptyForm,
  });


  const formatMoney = useCallback((value) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  }, []);


  const formatDate = useCallback((value) => {
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
  }, []);


  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      if (!companyId) {
        setAccounts([]);
        setAccountingAccounts([]);
        setTransactions([]);
        setLoading(false);
        return;
      }

      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

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
            `/api/banking/transactions/?company=${companyId}`
          ),
        ]);

        const bankAccounts =
          Array.isArray(accountsResponse)
            ? accountsResponse
            : accountsResponse?.results || [];

        const ledgerAccounts =
          Array.isArray(accountingResponse)
            ? accountingResponse
            : accountingResponse?.results || [];

        const bankTransactions =
          Array.isArray(transactionsResponse)
            ? transactionsResponse
            : transactionsResponse?.results || [];

        setAccounts(bankAccounts);

        setAccountingAccounts(
          ledgerAccounts
        );

        setTransactions(
          bankTransactions.filter(
            (transaction) =>
              transaction.transaction_type ===
              "WITHDRAWAL"
          )
        );

        setForm((current) => {
          if (
            current.bank_account ||
            !bankAccounts.length
          ) {
            return current;
          }

          return {
            ...current,
            bank_account: String(
              bankAccounts[0].id
            ),
          };
        });
      } catch (err) {
        console.error(
          "Bank withdrawals loading error:",
          err
        );

        setError(
          err?.data?.detail ||
            err?.message ||
            "Unable to load withdrawal information."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId]
  );


  useEffect(() => {
    loadData();
  }, [loadData]);


  const activeAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.is_active !== false
      ),
    [accounts]
  );


  const selectedBankAccount = useMemo(() => {
    return (
      accounts.find(
        (account) =>
          String(account.id) ===
          String(form.bank_account)
      ) || null
    );
  }, [accounts, form.bank_account]);


  const withdrawalCurrency =
    selectedBankAccount?.currency || "USD";


  const filteredCounterAccounts =
    useMemo(() => {
      return accountingAccounts.filter(
        (account) =>
          account.is_active !== false
      );
    }, [accountingAccounts]);


  const filteredTransactions = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) {
      return transactions;
    }

    return transactions.filter(
      (transaction) => {
        return [
          transaction.bank_name,
          transaction.bank_account_name,
          transaction.account_number,
          transaction.reference,
          transaction.description,
          transaction.transaction_type_display,
          transaction.transaction_date,
          transaction.amount,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query)
          );
      }
    );
  }, [transactions, search]);


  const totalsByCurrency = useMemo(() => {
    return transactions.reduce(
      (totals, transaction) => {
        const account = accounts.find(
          (item) =>
            String(item.id) ===
            String(
              transaction.bank_account
            )
        );

        const currency =
          account?.currency || "USD";

        const amount = Number(
          transaction.amount || 0
        );

        if (
          Object.prototype.hasOwnProperty.call(
            totals,
            currency
          )
        ) {
          totals[currency] += amount;
        } else {
          totals[currency] = amount;
        }

        return totals;
      },
      {
        USD: 0,
        LRD: 0,
      }
    );
  }, [transactions, accounts]);


  const today = new Date()
    .toISOString()
    .split("T")[0];


  const todayWithdrawals = useMemo(() => {
    return transactions.filter(
      (transaction) =>
        transaction.transaction_date === today
    );
  }, [transactions, today]);


  const openCreateModal = () => {
    setFormError("");

    setForm({
      ...emptyForm,
      bank_account:
        activeAccounts.length > 0
          ? String(activeAccounts[0].id)
          : "",
      transaction_date: new Date()
        .toISOString()
        .split("T")[0],
    });

    setShowModal(true);
  };


  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setFormError("");
  };


  const handleChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };


  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!companyId) {
      setFormError(
        "Please select a company first."
      );
      return;
    }

    if (!form.bank_account) {
      setFormError(
        "Please select a bank account."
      );
      return;
    }

    if (!form.counter_account) {
      setFormError(
        "Please select the account to which the withdrawal is being posted."
      );
      return;
    }

    if (!form.amount) {
      setFormError(
        "Withdrawal amount is required."
      );
      return;
    }

    if (Number(form.amount) <= 0) {
      setFormError(
        "Withdrawal amount must be greater than zero."
      );
      return;
    }

    if (!form.transaction_date) {
      setFormError(
        "Withdrawal date is required."
      );
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const payload = {
        bank_account: Number(
          form.bank_account
        ),
        counter_account: Number(
          form.counter_account
        ),
        amount: form.amount,
        transaction_date:
          form.transaction_date,
        reference:
          form.reference.trim(),
        description:
          form.description.trim(),
      };

      await api.post(
        `/api/banking/withdrawals/?company=${companyId}`,
        payload
      );

      await loadData({
        silent: true,
      });

      setShowModal(false);
      setFormError("");
    } catch (err) {
      console.error(
        "Bank withdrawal creation error:",
        err
      );

      const data = err?.data;

      if (
        data &&
        typeof data === "object" &&
        !Array.isArray(data)
      ) {
        const firstError = Object.values(data)
          .flat()
          .find(Boolean);

        setFormError(
          firstError ||
            "Unable to create the withdrawal."
        );
      } else {
        setFormError(
          err?.message ||
            "Unable to create the withdrawal."
        );
      }
    } finally {
      setSaving(false);
    }
  };


  const getBankAccount = (
    transaction
  ) => {
    return (
      accounts.find(
        (account) =>
          String(account.id) ===
          String(
            transaction.bank_account
          )
      ) || null
    );
  };


  const getTransactionCurrency = (
    transaction
  ) => {
    return (
      getBankAccount(transaction)
        ?.currency || "USD"
    );
  };


  if (!companyId) {
    return (
      <div className="banking-page">
        <div className="banking-empty-state">
          <div className="banking-empty-icon">
            <Building2 size={28} />
          </div>

          <h2>Select a company</h2>

          <p>
            Select a company to manage its
            bank withdrawals.
          </p>
        </div>
      </div>
    );
  }


  if (loading) {
    return (
      <div className="banking-page">
        <div className="banking-loading">
          <RefreshCw
            size={24}
            className="banking-spin"
          />

          <span>
            Loading withdrawals...
          </span>
        </div>
      </div>
    );
  }


  return (
    <div className="banking-page">
      {/* Header */}

      <div className="banking-header">
        <div>
          <div className="banking-eyebrow">
            BANKING / WITHDRAWALS
          </div>

          <h1>Withdrawals</h1>

          <p>
            Record money withdrawn from the
            company&apos;s bank accounts.
          </p>
        </div>

        <div className="banking-header-actions">
          <button
            type="button"
            className="banking-refresh-button"
            onClick={() =>
              loadData({
                silent: true,
              })
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "banking-spin"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            type="button"
            className="banking-primary-button"
            onClick={openCreateModal}
            disabled={
              activeAccounts.length === 0
            }
          >
            <Plus size={17} />
            Record Withdrawal
          </button>
        </div>
      </div>


      {/* Error */}

      {error && (
        <div className="banking-error">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => loadData()}
          >
            Try again
          </button>
        </div>
      )}


      {/* Company context */}

      <div className="banking-company-strip">
        <div className="banking-company-icon">
          <Building2 size={19} />
        </div>

        <div>
          <span>Current Company</span>

          <strong>
            {currentCompany?.name}
          </strong>
        </div>

        <div className="banking-company-currency">
          <span>Functional Currency</span>

          <strong>
            {currentCompany?.currency ||
              "USD"}
          </strong>
        </div>
      </div>


      {/* Summary */}

      <section className="banking-kpi-grid">
        <div className="banking-kpi-card banking-kpi-primary">
          <div className="banking-kpi-icon banking-withdrawal-icon">
            <ArrowUpRight size={21} />
          </div>

          <div>
            <span>USD Withdrawals</span>

            <strong>
              USD{" "}
              {formatMoney(
                totalsByCurrency.USD
              )}
            </strong>

            <small>
              Total USD withdrawals recorded
            </small>
          </div>
        </div>


        <div className="banking-kpi-card">
          <div className="banking-kpi-icon">
            <ArrowUpRight size={21} />
          </div>

          <div>
            <span>LRD Withdrawals</span>

            <strong>
              LRD{" "}
              {formatMoney(
                totalsByCurrency.LRD
              )}
            </strong>

            <small>
              Total LRD withdrawals recorded
            </small>
          </div>
        </div>


        <div className="banking-kpi-card">
          <div className="banking-kpi-icon">
            <Wallet size={21} />
          </div>

          <div>
            <span>
              Today&apos;s Withdrawals
            </span>

            <strong>
              {todayWithdrawals.length}
            </strong>

            <small>
              Withdrawal transactions today
            </small>
          </div>
        </div>


        <div className="banking-kpi-card">
          <div className="banking-kpi-icon">
            <Landmark size={21} />
          </div>

          <div>
            <span>Active Bank Accounts</span>

            <strong>
              {activeAccounts.length}
            </strong>

            <small>
              Accounts available for withdrawals
            </small>
          </div>
        </div>
      </section>


      {/* Withdrawal transactions */}

      <section className="banking-panel banking-withdrawals-panel">
        <div className="banking-panel-header">
          <div>
            <h2>Withdrawal Transactions</h2>

            <p>
              Money withdrawn from company bank
              accounts.
            </p>
          </div>

          <span className="banking-panel-count">
            {filteredTransactions.length}
          </span>
        </div>


        <div className="banking-withdrawals-toolbar">
          <div className="banking-search-box">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search withdrawals..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="banking-toolbar-add"
            onClick={openCreateModal}
            disabled={
              activeAccounts.length === 0
            }
          >
            <Plus size={16} />
            Record Withdrawal
          </button>
        </div>


        {filteredTransactions.length === 0 ? (
          <div className="banking-accounts-empty">
            <div className="banking-empty-icon">
              <ArrowUpRight size={27} />
            </div>

            <h3>
              {search
                ? "No withdrawals found"
                : "No withdrawals yet"}
            </h3>

            <p>
              {search
                ? "Try a different search term."
                : "Record your first bank withdrawal to see it here."}
            </p>

            {!search &&
              activeAccounts.length > 0 && (
                <button
                  type="button"
                  className="banking-primary-button"
                  onClick={openCreateModal}
                >
                  <Plus size={16} />
                  Record Withdrawal
                </button>
              )}
          </div>
        ) : (
          <div className="banking-withdrawal-table-wrapper">
            <table className="banking-withdrawal-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bank Account</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th>Currency</th>
                  <th>Amount</th>
                </tr>
              </thead>

              <tbody>
                {filteredTransactions.map(
                  (transaction) => {
                    const account =
                      getBankAccount(
                        transaction
                      );

                    const currency =
                      getTransactionCurrency(
                        transaction
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
                          <div className="banking-withdrawal-account">
                            <div className="banking-withdrawal-table-icon">
                              <Landmark
                                size={16}
                              />
                            </div>

                            <div>
                              <strong>
                                {account?.bank_name ||
                                  transaction.bank_name ||
                                  "—"}
                              </strong>

                              <span>
                                {account?.account_name ||
                                  transaction.bank_account_name ||
                                  "—"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          {transaction.reference ||
                            "—"}
                        </td>

                        <td>
                          <span className="banking-withdrawal-description">
                            {transaction.description ||
                              "—"}
                          </span>
                        </td>

                        <td>
                          <span className="banking-currency-badge">
                            {currency}
                          </span>
                        </td>

                        <td>
                          <strong className="banking-withdrawal-amount">
                            {currency}{" "}
                            {formatMoney(
                              transaction.amount
                            )}
                          </strong>
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


      {/* Create Withdrawal Modal */}

      {showModal && (
        <div
          className="banking-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !saving
            ) {
              closeModal();
            }
          }}
        >
          <form
            className="banking-form-modal banking-withdrawal-modal"
            onSubmit={handleSubmit}
          >
            <div className="banking-modal-header">
              <div>
                <div className="banking-eyebrow">
                  NEW WITHDRAWAL
                </div>

                <h2>
                  Record Bank Withdrawal
                </h2>

                <p>
                  Record money withdrawn from a
                  company bank account.
                </p>
              </div>

              <button
                type="button"
                className="banking-modal-close"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>


            {formError && (
              <div className="banking-form-error">
                {formError}
              </div>
            )}


            <div className="banking-form-body">
              <div className="banking-form-section-title">
                Withdrawal Information
              </div>


              <div className="banking-form-grid">
                <label className="banking-form-field">
                  <span>
                    Bank Account
                    <b>*</b>
                  </span>

                  <select
                    name="bank_account"
                    value={
                      form.bank_account
                    }
                    onChange={
                      handleChange
                    }
                    required
                  >
                    <option value="">
                      Select bank account
                    </option>

                    {activeAccounts.map(
                      (account) => (
                        <option
                          key={
                            account.id
                          }
                          value={
                            account.id
                          }
                        >
                          {account.bank_name} —{" "}
                          {
                            account.account_name
                          }{" "}
                          (
                          {
                            account.currency
                          }
                          )
                        </option>
                      )
                    )}
                  </select>

                  <small>
                    The withdrawal currency follows
                    the selected bank account.
                  </small>
                </label>


                <label className="banking-form-field">
                  <span>
                    Withdrawal Currency
                  </span>

                  <div className="banking-readonly-currency">
                    <Wallet size={16} />

                    <strong>
                      {withdrawalCurrency}
                    </strong>

                    <span>
                      {withdrawalCurrency ===
                      "LRD"
                        ? "Liberian Dollar"
                        : "US Dollar"}
                    </span>
                  </div>

                  <small>
                    This is the currency of the
                    selected bank account.
                  </small>
                </label>


                <label className="banking-form-field">
                  <span>
                    Amount
                    <b>*</b>
                  </span>

                  <div className="banking-money-input">
                    <span>
                      {withdrawalCurrency}
                    </span>

                    <input
                      type="number"
                      name="amount"
                      value={form.amount}
                      onChange={
                        handleChange
                      }
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </label>


                <label className="banking-form-field">
                  <span>
                    Expense / Destination Account
                    <b>*</b>
                  </span>

                  <select
                    name="counter_account"
                    value={
                      form.counter_account
                    }
                    onChange={
                      handleChange
                    }
                    required
                  >
                    <option value="">
                      Select accounting account
                    </option>

                    {filteredCounterAccounts.map(
                      (account) => (
                        <option
                          key={
                            account.id
                          }
                          value={
                            account.id
                          }
                        >
                          {account.code} —{" "}
                          {account.name}
                        </option>
                      )
                    )}
                  </select>

                  <small>
                    The accounting account debited
                    for this withdrawal.
                  </small>
                </label>


                <label className="banking-form-field">
                  <span>
                    Withdrawal Date
                    <b>*</b>
                  </span>

                  <input
                    type="date"
                    name="transaction_date"
                    value={
                      form.transaction_date
                    }
                    onChange={
                      handleChange
                    }
                    required
                  />
                </label>


                <label className="banking-form-field">
                  <span>
                    Reference
                  </span>

                  <input
                    type="text"
                    name="reference"
                    value={
                      form.reference
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="e.g. WDL-0001"
                  />
                </label>
              </div>


              <div className="banking-form-section-title banking-form-section-spaced">
                Additional Information
              </div>


              <label className="banking-form-field">
                <span>
                  Description
                </span>

                <textarea
                  name="description"
                  value={
                    form.description
                  }
                  onChange={
                    handleChange
                  }
                  rows={3}
                  placeholder="Describe the purpose of this withdrawal..."
                />
              </label>


              <div className="banking-withdrawal-summary">
                <div className="banking-withdrawal-summary-icon">
                  <ArrowUpRight size={18} />
                </div>

                <div>
                  <span>
                    Withdrawal Summary
                  </span>

                  <strong>
                    {withdrawalCurrency}{" "}
                    {formatMoney(
                      form.amount
                    )}
                  </strong>

                  <small>
                    Withdrawn from{" "}
                    {selectedBankAccount?.bank_name ||
                      "selected bank account"}{" "}
                    —{" "}
                    {selectedBankAccount?.account_name ||
                      "selected account"}
                  </small>
                </div>
              </div>
            </div>


            <div className="banking-modal-footer">
              <button
                type="button"
                className="banking-secondary-button"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="banking-primary-button"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <RefreshCw
                      size={16}
                      className="banking-spin"
                    />

                    Recording...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Record Withdrawal
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}