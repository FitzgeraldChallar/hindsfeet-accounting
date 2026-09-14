import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  ChevronRight,
  Edit3,
  Landmark,
  Plus,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";


const ACCOUNT_TYPES = [
  {
    value: "CHECKING",
    label: "Checking",
  },
  {
    value: "SAVINGS",
    label: "Savings",
  },
  {
    value: "MOBILE_MONEY",
    label: "Mobile Money",
  },
  {
    value: "OTHER",
    label: "Other",
  },
];


const CURRENCIES = [
  {
    value: "USD",
    label: "USD — US Dollar",
  },
  {
    value: "LRD",
    label: "LRD — Liberian Dollar",
  },
];


const emptyForm = {
  bank_name: "",
  account_name: "",
  account_number: "",
  account_type: "CHECKING",
  currency: "USD",
  opening_balance: "0.00",
  notes: "",
  is_active: true,
};


export default function BankAccounts() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;
  const companyCurrency =
    currentCompany?.currency || "USD";

  const [accounts, setAccounts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] =
    useState(null);

  const [saving, setSaving] = useState(false);

  const [selectedAccount, setSelectedAccount] =
    useState(null);

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] =
    useState(false);


  const [form, setForm] = useState({
    ...emptyForm,
    currency: companyCurrency,
  });


  const formatMoney = useCallback((value) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  }, []);


  const loadAccounts = useCallback(
    async ({ silent = false } = {}) => {
      if (!companyId) {
        setAccounts([]);
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

        const response = await api.get(
          `/api/banking/accounts/?company=${companyId}`
        );

        const data = Array.isArray(response)
          ? response
          : response?.results || [];

        setAccounts(data);
      } catch (err) {
        console.error(
          "Bank accounts loading error:",
          err
        );

        setError(
          err?.data?.detail ||
            err?.message ||
            "Unable to load bank accounts."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId]
  );


  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);


  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return accounts;
    }

    return accounts.filter((account) => {
      return [
        account.bank_name,
        account.account_name,
        account.account_number,
        account.account_type_display,
        account.account_type,
        account.currency,
        account.accounting_account_code,
        account.accounting_account_name,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query)
        );
    });
  }, [accounts, search]);


  const activeAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.is_active !== false
      ),
    [accounts]
  );


  const currencyBalances = useMemo(() => {
    return activeAccounts.reduce(
      (balances, account) => {
        const currency =
          account.currency || "USD";

        const balance = Number(
          account.bank_account_balance || 0
        );

        if (
          Object.prototype.hasOwnProperty.call(
            balances,
            currency
          )
        ) {
          balances[currency] += balance;
        } else {
          balances[currency] = balance;
        }

        return balances;
      },
      {
        USD: 0,
        LRD: 0,
      }
    );
  }, [activeAccounts]);


  const openCreateModal = () => {
    setEditingAccount(null);

    setForm({
      ...emptyForm,
      currency: companyCurrency,
    });

    setFormError("");
    setShowModal(true);
  };


  const openEditModal = (account) => {
    setEditingAccount(account);

    setForm({
      bank_name: account.bank_name || "",
      account_name:
        account.account_name || "",
      account_number:
        account.account_number || "",
      account_type:
        account.account_type || "CHECKING",
      currency:
        account.currency || companyCurrency,
      opening_balance: String(
        account.opening_balance ?? "0.00"
      ),
      notes: account.notes || "",
      is_active:
        account.is_active !== false,
    });

    setFormError("");
    setShowModal(true);
  };


  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingAccount(null);
    setFormError("");
  };


  const handleChange = (event) => {
    const { name, value, type, checked } =
      event.target;

    setForm((current) => ({
      ...current,
      [name]:
        type === "checkbox"
          ? checked
          : value,
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

    if (!form.bank_name.trim()) {
      setFormError(
        "Bank name is required."
      );
      return;
    }

    if (!form.account_name.trim()) {
      setFormError(
        "Account name is required."
      );
      return;
    }

    if (!form.account_number.trim()) {
      setFormError(
        "Account number is required."
      );
      return;
    }

    if (
      !["USD", "LRD"].includes(
        form.currency
      )
    ) {
      setFormError(
        "Please select a valid currency."
      );
      return;
    }

    if (
      Number(form.opening_balance || 0) <
      0
    ) {
      setFormError(
        "Opening balance cannot be negative."
      );
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const payload = {
        company: companyId,
        bank_name: form.bank_name.trim(),
        account_name:
          form.account_name.trim(),
        account_number:
          form.account_number.trim(),
        account_type: form.account_type,
        currency: form.currency,
        opening_balance:
          form.opening_balance || "0.00",
        notes: form.notes.trim(),
        is_active: form.is_active,
      };

      let savedAccount;

      if (editingAccount) {
        savedAccount = await api.patch(
          `/api/banking/accounts/${editingAccount.id}/`,
          payload
        );
      } else {
        savedAccount = await api.post(
          "/api/banking/accounts/",
          payload
        );
      }

      await loadAccounts({
        silent: true,
      });

      if (
        selectedAccount?.id ===
        savedAccount?.id
      ) {
        setSelectedAccount(savedAccount);
      }

      setShowModal(false);
      setEditingAccount(null);
      setFormError("");
    } catch (err) {
      console.error(
        "Bank account save error:",
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
            "Unable to save the bank account."
        );
      } else {
        setFormError(
          err?.message ||
            "Unable to save the bank account."
        );
      }
    } finally {
      setSaving(false);
    }
  };


  const openAccountDetails = async (
    account
  ) => {
    setSelectedAccount(account);
    setSummary(null);
    setSummaryLoading(true);

    try {
      const response = await api.get(
        `/api/banking/accounts/${account.id}/summary/`
      );

      setSummary(response);
    } catch (err) {
      console.error(
        "Bank account summary error:",
        err
      );

      setSummary({
        ...account,
        balance:
          account.bank_account_balance || 0,
      });
    } finally {
      setSummaryLoading(false);
    }
  };


  const closeAccountDetails = () => {
    setSelectedAccount(null);
    setSummary(null);
  };


  const getAccountTypeLabel = (
    account
  ) => {
    return (
      account.account_type_display ||
      ACCOUNT_TYPES.find(
        (item) =>
          item.value === account.account_type
      )?.label ||
      account.account_type ||
      "Other"
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
            bank accounts.
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
            Loading bank accounts...
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
            BANK ACCOUNTS
          </div>

          <h1>Bank Accounts</h1>

          <p>
            Manage the bank accounts and
            financial institutions belonging to{" "}
            <strong>
              {currentCompany?.name}
            </strong>
            .
          </p>
        </div>

        <div className="banking-header-actions">
          <button
            type="button"
            className="banking-refresh-button"
            onClick={() =>
              loadAccounts({
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
          >
            <Plus size={17} />
            Add Bank Account
          </button>
        </div>
      </div>


      {/* Error */}

      {error && (
        <div className="banking-error">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => loadAccounts()}
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
            {companyCurrency}
          </strong>
        </div>
      </div>


      {/* Summary */}

      <section className="banking-kpi-grid">
        <div className="banking-kpi-card banking-kpi-primary">
          <div className="banking-kpi-icon">
            <Wallet size={21} />
          </div>

          <div>
            <span>USD Bank Balance</span>

            <strong>
              USD{" "}
              {formatMoney(
                currencyBalances.USD
              )}
            </strong>

            <small>
              Across USD bank accounts
            </small>
          </div>
        </div>


        <div className="banking-kpi-card">
          <div className="banking-kpi-icon">
            <Wallet size={21} />
          </div>

          <div>
            <span>LRD Bank Balance</span>

            <strong>
              LRD{" "}
              {formatMoney(
                currencyBalances.LRD
              )}
            </strong>

            <small>
              Across LRD bank accounts
            </small>
          </div>
        </div>


        <div className="banking-kpi-card">
          <div className="banking-kpi-icon banking-kpi-in">
            <Check size={21} />
          </div>

          <div>
            <span>Active Accounts</span>

            <strong>
              {activeAccounts.length}
            </strong>

            <small>
              Currently available for use
            </small>
          </div>
        </div>


        <div className="banking-kpi-card">
          <div className="banking-kpi-icon">
            <Building2 size={21} />
          </div>

          <div>
            <span>Total Accounts</span>

            <strong>
              {accounts.length}
            </strong>

            <small>
              Bank accounts registered
            </small>
          </div>
        </div>
      </section>


      {/* Toolbar */}

      <section className="banking-panel banking-accounts-panel">
        <div className="banking-panel-header">
          <div>
            <h2>Company Bank Accounts</h2>

            <p>
              Every account is linked to its
              dedicated accounting ledger.
            </p>
          </div>

          <span className="banking-panel-count">
            {filteredAccounts.length}
          </span>
        </div>


        <div className="banking-accounts-toolbar">
          <div className="banking-search-box">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search bank accounts..."
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
          >
            <Plus size={16} />
            Add Account
          </button>
        </div>


        {/* Account cards */}

        {filteredAccounts.length === 0 ? (
          <div className="banking-accounts-empty">
            <div className="banking-empty-icon">
              <Landmark size={27} />
            </div>

            <h3>
              {search
                ? "No accounts found"
                : "No bank accounts yet"}
            </h3>

            <p>
              {search
                ? "Try a different search term."
                : `Create the first bank account for ${currentCompany?.name}.`}
            </p>

            {!search && (
              <button
                type="button"
                className="banking-primary-button"
                onClick={openCreateModal}
              >
                <Plus size={16} />
                Create Bank Account
              </button>
            )}
          </div>
        ) : (
          <div className="banking-account-grid">
            {filteredAccounts.map(
              (account) => {
                const balance = Number(
                  account.bank_account_balance ||
                    0
                );

                return (
                  <div
                    className={`banking-full-account-card ${
                      account.is_active === false
                        ? "banking-account-inactive"
                        : ""
                    }`}
                    key={account.id}
                  >
                    <div className="banking-full-account-top">
                      <div className="banking-full-account-brand">
                        <div className="banking-account-icon">
                          <Landmark size={19} />
                        </div>

                        <div>
                          <strong>
                            {account.bank_name}
                          </strong>

                          <span>
                            {account.account_name}
                          </span>
                        </div>
                      </div>

                      <span
                        className={
                          account.is_active === false
                            ? "banking-status banking-status-inactive"
                            : "banking-status"
                        }
                      >
                        {account.is_active === false
                          ? "Inactive"
                          : "Active"}
                      </span>
                    </div>


                    <div className="banking-full-account-number">
                      <span>
                        ACCOUNT NUMBER
                      </span>

                      <strong>
                        {account.account_number}
                      </strong>
                    </div>


                    <div className="banking-full-account-balance">
                      <span>
                        CURRENT BALANCE
                      </span>

                      <strong>
                        {account.currency ||
                          "USD"}{" "}
                        {formatMoney(balance)}
                      </strong>
                    </div>


                    <div className="banking-full-account-meta">
                      <div>
                        <span>Account Type</span>

                        <strong>
                          {getAccountTypeLabel(
                            account
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Currency</span>

                        <strong>
                          {account.currency ||
                            "USD"}
                        </strong>
                      </div>

                      <div>
                        <span>Ledger</span>

                        <strong>
                          {account.accounting_account_code ||
                            "—"}
                        </strong>
                      </div>
                    </div>


                    <div className="banking-full-account-actions">
                      <button
                        type="button"
                        className="banking-account-view-button"
                        onClick={() =>
                          openAccountDetails(
                            account
                          )
                        }
                      >
                        View Details
                        <ChevronRight
                          size={15}
                        />
                      </button>

                      <button
                        type="button"
                        className="banking-account-edit-button"
                        onClick={() =>
                          openEditModal(
                            account
                          )
                        }
                      >
                        <Edit3 size={15} />
                        Edit
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>


      {/* Account detail drawer/modal */}

      {selectedAccount && (
        <div
          className="banking-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeAccountDetails();
            }
          }}
        >
          <div className="banking-detail-modal">
            <div className="banking-detail-header">
              <div>
                <div className="banking-eyebrow">
                  ACCOUNT DETAILS
                </div>

                <h2>
                  {selectedAccount.bank_name}
                </h2>

                <p>
                  {selectedAccount.account_name}
                </p>
              </div>

              <button
                type="button"
                className="banking-modal-close"
                onClick={
                  closeAccountDetails
                }
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>


            {summaryLoading ? (
              <div className="banking-detail-loading">
                <RefreshCw
                  size={22}
                  className="banking-spin"
                />

                <span>
                  Loading account summary...
                </span>
              </div>
            ) : (
              <div className="banking-detail-body">
                <div className="banking-detail-balance">
                  <span>
                    CURRENT BALANCE
                  </span>

                  <strong>
                    {summary?.currency ||
                      selectedAccount.currency ||
                      "USD"}{" "}
                    {formatMoney(
                      summary?.balance ??
                        selectedAccount.bank_account_balance
                    )}
                  </strong>
                </div>


                <div className="banking-detail-grid">
                  <div>
                    <span>Bank</span>

                    <strong>
                      {summary?.bank_name ||
                        selectedAccount.bank_name}
                    </strong>
                  </div>

                  <div>
                    <span>Account Name</span>

                    <strong>
                      {summary?.account_name ||
                        selectedAccount.account_name}
                    </strong>
                  </div>

                  <div>
                    <span>Account Number</span>

                    <strong>
                      {summary?.account_number ||
                        selectedAccount.account_number}
                    </strong>
                  </div>

                  <div>
                    <span>Account Type</span>

                    <strong>
                      {getAccountTypeLabel(
                        summary ||
                          selectedAccount
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Currency</span>

                    <strong>
                      {summary?.currency ||
                        selectedAccount.currency ||
                        "USD"}
                    </strong>
                  </div>

                  <div>
                    <span>Opening Balance</span>

                    <strong>
                      {summary?.currency ||
                        selectedAccount.currency ||
                        "USD"}{" "}
                      {formatMoney(
                        summary?.opening_balance ??
                          selectedAccount.opening_balance
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Accounting Ledger</span>

                    <strong>
                      {summary?.accounting_account_code ||
                        selectedAccount.accounting_account_code ||
                        "—"}
                    </strong>
                  </div>
                </div>


                {(summary?.accounting_account_name ||
                  selectedAccount.accounting_account_name) && (
                  <div className="banking-ledger-note">
                    <Landmark size={17} />

                    <div>
                      <span>
                        Dedicated Accounting Ledger
                      </span>

                      <strong>
                        {summary?.accounting_account_name ||
                          selectedAccount.accounting_account_name}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            )}


            <div className="banking-detail-footer">
              <button
                type="button"
                className="banking-account-edit-button"
                onClick={() => {
                  closeAccountDetails();

                  openEditModal(
                    selectedAccount
                  );
                }}
              >
                <Edit3 size={15} />
                Edit Account
              </button>

              <button
                type="button"
                className="banking-primary-button"
                onClick={
                  closeAccountDetails
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Create / Edit modal */}

      {showModal && (
        <div
          className="banking-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              closeModal();
            }
          }}
        >
          <form
            className="banking-form-modal"
            onSubmit={handleSubmit}
          >
            <div className="banking-modal-header">
              <div>
                <div className="banking-eyebrow">
                  {editingAccount
                    ? "BANK ACCOUNT"
                    : "NEW BANK ACCOUNT"}
                </div>

                <h2>
                  {editingAccount
                    ? "Edit Bank Account"
                    : "Create Bank Account"}
                </h2>

                <p>
                  {editingAccount
                    ? "Update the details for this company bank account."
                    : `Add a bank account for ${currentCompany?.name}.`}
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
                Bank Information
              </div>


              <div className="banking-form-grid">
                <label className="banking-form-field">
                  <span>
                    Bank Name
                    <b>*</b>
                  </span>

                  <input
                    type="text"
                    name="bank_name"
                    value={form.bank_name}
                    onChange={handleChange}
                    placeholder="e.g. LBDI Bank"
                    required
                  />
                </label>


                <label className="banking-form-field">
                  <span>
                    Account Name
                    <b>*</b>
                  </span>

                  <input
                    type="text"
                    name="account_name"
                    value={form.account_name}
                    onChange={handleChange}
                    placeholder="e.g. Main Operating Account"
                    required
                  />
                </label>


                <label className="banking-form-field">
                  <span>
                    Account Number
                    <b>*</b>
                  </span>

                  <input
                    type="text"
                    name="account_number"
                    value={
                      form.account_number
                    }
                    onChange={handleChange}
                    placeholder="Enter account number"
                    required
                  />
                </label>


                <label className="banking-form-field">
                  <span>
                    Account Type
                    <b>*</b>
                  </span>

                  <select
                    name="account_type"
                    value={form.account_type}
                    onChange={handleChange}
                  >
                    {ACCOUNT_TYPES.map(
                      (type) => (
                        <option
                          key={type.value}
                          value={type.value}
                        >
                          {type.label}
                        </option>
                      )
                    )}
                  </select>
                </label>


                <label className="banking-form-field">
                  <span>
                    Currency
                    <b>*</b>
                  </span>

                  <select
                    name="currency"
                    value={form.currency}
                    onChange={handleChange}
                    required
                  >
                    {CURRENCIES.map(
                      (currency) => (
                        <option
                          key={currency.value}
                          value={currency.value}
                        >
                          {currency.label}
                        </option>
                      )
                    )}
                  </select>

                  <small>
                    Select the currency used by
                    this bank account.
                  </small>
                </label>


                <label className="banking-form-field">
                  <span>
                    Opening Balance
                  </span>

                  <input
                    type="number"
                    name="opening_balance"
                    value={
                      form.opening_balance
                    }
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />

                  <small>
                    Starting balance for this
                    account.
                  </small>
                </label>
              </div>


              <div className="banking-form-section-title banking-form-section-spaced">
                Additional Information
              </div>


              <label className="banking-form-field">
                <span>Notes</span>

                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Optional notes about this bank account..."
                />
              </label>


              <label className="banking-checkbox-field">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={handleChange}
                />

                <span>
                  <strong>
                    Account is active
                  </strong>

                  <small>
                    Active accounts can be used
                    for banking transactions.
                  </small>
                </span>
              </label>


              {!editingAccount && (
                <div className="banking-ledger-info">
                  <Landmark size={18} />

                  <div>
                    <strong>
                      Dedicated accounting ledger
                    </strong>

                    <span>
                      When this account is created,
                      the system automatically
                      creates and links its own
                      company-specific bank ledger.
                    </span>
                  </div>
                </div>
              )}
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

                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={16} />

                    {editingAccount
                      ? "Save Changes"
                      : "Create Bank Account"}
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