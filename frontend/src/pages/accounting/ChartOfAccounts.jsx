import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  FileText,
  Lock,
  Plus,
  RefreshCw,
  Search,
  WalletCards,
  X,
} from "lucide-react";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";

const ACCOUNT_TYPES = [
  { value: "ASSET", label: "Asset" },
  { value: "LIABILITY", label: "Liability" },
  { value: "EQUITY", label: "Equity" },
  { value: "REVENUE", label: "Revenue" },
  { value: "COGS", label: "Cost of Goods Sold" },
  { value: "EXPENSE", label: "Expense" },
];

const emptyForm = {
  code: "",
  name: "",
  account_type: "ASSET",
  description: "",
  parent: "",
  is_active: true,
};

function extractList(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function accountTypeLabel(type) {
  const found = ACCOUNT_TYPES.find(
    (item) => item.value === type
  );

  return found?.label || type || "Unknown";
}

function accountTypeClass(type) {
  return (
    String(type || "unknown")
      .toLowerCase()
      .replace(/_/g, "-")
  );
}

function initials(name) {
  if (!name) {
    return "AC";
  }

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}

export default function ChartOfAccounts() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;
  const companyName =
    currentCompany?.name || "Current Company";
  const companyCurrency =
    currentCompany?.currency || "USD";

  const [accounts, setAccounts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] =
    useState("ALL");
  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] =
    useState(null);

  const [expandedAccounts, setExpandedAccounts] =
    useState({});

  const [form, setForm] = useState(emptyForm);

  const loadAccounts = async () => {
    if (!companyId) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        `/api/accounting/accounts/?company=${companyId}`
      );

      setAccounts(extractList(response));
    } catch (err) {
      setError(
        err?.data?.detail ||
          err?.message ||
          "Unable to load the chart of accounts."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [companyId]);

  const accountMap = useMemo(() => {
    return new Map(
      accounts.map((account) => [
        Number(account.id),
        account,
      ])
    );
  }, [accounts]);

  const childrenMap = useMemo(() => {
    const map = new Map();

    accounts.forEach((account) => {
      if (!account.parent) {
        return;
      }

      const parentId = Number(account.parent);

      if (!map.has(parentId)) {
        map.set(parentId, []);
      }

      map.get(parentId).push(account);
    });

    map.forEach((children) => {
      children.sort((a, b) =>
        String(a.code || "").localeCompare(
          String(b.code || ""),
          undefined,
          { numeric: true }
        )
      );
    });

    return map;
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return accounts.filter((account) => {
      const parent = accountMap.get(
        Number(account.parent)
      );

      const searchableText = [
        account.code,
        account.name,
        account.description,
        account.account_type,
        accountTypeLabel(account.account_type),
        parent?.code,
        parent?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query ||
        searchableText.includes(query);

      const matchesType =
        typeFilter === "ALL" ||
        account.account_type === typeFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE"
          ? account.is_active
          : !account.is_active);

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus
      );
    });
  }, [
    accounts,
    accountMap,
    search,
    typeFilter,
    statusFilter,
  ]);

  const filteredIds = useMemo(() => {
    return new Set(
      filteredAccounts.map((account) =>
        Number(account.id)
      )
    );
  }, [filteredAccounts]);

  const visibleAccounts = useMemo(() => {
    const result = [];

    const sortedAccounts = [
      ...filteredAccounts,
    ].sort((a, b) =>
      String(a.code || "").localeCompare(
        String(b.code || ""),
        undefined,
        { numeric: true }
      )
    );

    const visit = (
      account,
      level = 0
    ) => {
      result.push({
        ...account,
        level,
      });

      const isExpanded =
        expandedAccounts[account.id];

      if (!isExpanded) {
        return;
      }

      const children =
        childrenMap.get(Number(account.id)) ||
        [];

      children.forEach((child) => {
        if (filteredIds.has(Number(child.id))) {
          visit(child, level + 1);
        }
      });
    };

    const roots = sortedAccounts.filter(
      (account) =>
        !account.parent ||
        !filteredIds.has(
          Number(account.parent)
        )
    );

    roots.forEach((root) => visit(root));

    return result;
  }, [
    filteredAccounts,
    filteredIds,
    childrenMap,
    expandedAccounts,
  ]);

  const stats = useMemo(() => {
    const result = {
      total: accounts.length,
      active: 0,
      inactive: 0,
      system: 0,
      custom: 0,
    };

    accounts.forEach((account) => {
      if (account.is_active) {
        result.active += 1;
      } else {
        result.inactive += 1;
      }

      if (account.is_system_account) {
        result.system += 1;
      } else {
        result.custom += 1;
      }
    });

    return result;
  }, [accounts]);

  const openCreateModal = () => {
    setEditingAccount(null);
    setForm({
      ...emptyForm,
    });
    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const openEditModal = (account) => {
    if (account.is_system_account) {
      setError(
        "System accounts cannot be edited from the Chart of Accounts."
      );
      return;
    }

    setEditingAccount(account);

    setForm({
      code: account.code || "",
      name: account.name || "",
      account_type:
        account.account_type || "ASSET",
      description:
        account.description || "",
      parent:
        account.parent
          ? String(account.parent)
          : "",
      is_active:
        account.is_active !== false,
    });

    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setShowModal(false);
    setEditingAccount(null);
    setForm({
      ...emptyForm,
    });
  };

  const handleChange = (event) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

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
      setError(
        "Please select a company before creating an account."
      );
      return;
    }

    if (!form.code.trim()) {
      setError("Account code is required.");
      return;
    }

    if (!form.name.trim()) {
      setError("Account name is required.");
      return;
    }

    if (!form.account_type) {
      setError("Account type is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        company: companyId,
        code: form.code.trim(),
        name: form.name.trim(),
        account_type: form.account_type,
        description:
          form.description.trim(),
        parent:
          form.parent
            ? Number(form.parent)
            : null,
        is_active: form.is_active,
      };

      let response;

      if (editingAccount) {
        response = await api.patch(
          `/api/accounting/accounts/${editingAccount.id}/`,
          payload
        );
      } else {
        response = await api.post(
          `/api/accounting/accounts/?company=${companyId}`,
          payload
        );
      }

      const savedAccount = response;

      setAccounts((current) => {
        if (editingAccount) {
          return current.map((account) =>
            Number(account.id) ===
            Number(savedAccount.id)
              ? savedAccount
              : account
          );
        }

        return [
          ...current,
          savedAccount,
        ];
      });

      setSuccess(
        editingAccount
          ? "Account updated successfully."
          : "Account created successfully."
      );

      setShowModal(false);
      setEditingAccount(null);
      setForm({
        ...emptyForm,
      });

      await loadAccounts();
    } catch (err) {
      const apiError =
        err?.data;

      if (
        apiError &&
        typeof apiError === "object" &&
        !apiError.detail
      ) {
        const firstField =
          Object.keys(apiError)[0];

        if (firstField) {
          const fieldMessage =
            Array.isArray(
              apiError[firstField]
            )
              ? apiError[firstField][0]
              : apiError[firstField];

          setError(
            `${firstField}: ${fieldMessage}`
          );
        } else {
          setError(
            "Unable to save the account."
          );
        }
      } else {
        setError(
          apiError?.detail ||
            err?.message ||
            "Unable to save the account."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleExpanded = (accountId) => {
    setExpandedAccounts((current) => ({
      ...current,
      [accountId]:
        !current[accountId],
    }));
  };

  const expandAll = () => {
    const next = {};

    accounts.forEach((account) => {
      if (
        childrenMap.has(Number(account.id))
      ) {
        next[account.id] = true;
      }
    });

    setExpandedAccounts(next);
  };

  const collapseAll = () => {
    setExpandedAccounts({});
  };

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
  };

  const hasFilters =
    search ||
    typeFilter !== "ALL" ||
    statusFilter !== "ALL";

  return (
    <div className="accounting-coa-page">
      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="coa-page-header">
        <div>
          <div className="coa-eyebrow">
            <WalletCards size={15} />
            ACCOUNTING
          </div>

          <h1>Chart of Accounts</h1>

          <p>
            Manage the accounts that structure
            the financial records for{" "}
            <strong>{companyName}</strong>.
          </p>
        </div>

        <div className="coa-header-actions">
          <button
            type="button"
            className="coa-secondary-button"
            onClick={loadAccounts}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "coa-spin"
                  : ""
              }
            />
            Refresh
          </button>

          <button
            type="button"
            className="coa-primary-button"
            onClick={openCreateModal}
          >
            <Plus size={17} />
            New Account
          </button>
        </div>
      </div>

      {/* ======================================================
          COMPANY STRIP
          ====================================================== */}

      <div className="coa-company-strip">
        <div className="coa-company-icon">
          <Building2 size={20} />
        </div>

        <div>
          <span>Reporting Company</span>
          <strong>{companyName}</strong>
        </div>

        <div className="coa-company-divider" />

        <div>
          <span>Functional Currency</span>
          <strong>
            {companyCurrency}
          </strong>
        </div>

        <div className="coa-company-divider" />

        <div>
          <span>Account Structure</span>
          <strong>
            Double-Entry Accounting
          </strong>
        </div>
      </div>

      {/* ======================================================
          ALERTS
          ====================================================== */}

      {error && (
        <div className="coa-alert coa-alert-error">
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
        <div className="coa-alert coa-alert-success">
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

      <div className="coa-kpi-grid">
        <div className="coa-kpi-card">
          <div className="coa-kpi-icon coa-kpi-icon-blue">
            <FileText size={19} />
          </div>

          <div>
            <span>Total Accounts</span>
            <strong>{stats.total}</strong>
          </div>
        </div>

        <div className="coa-kpi-card">
          <div className="coa-kpi-icon coa-kpi-icon-gold">
            <Activity size={19} />
          </div>

          <div>
            <span>Active Accounts</span>
            <strong>{stats.active}</strong>
          </div>
        </div>

        <div className="coa-kpi-card">
          <div className="coa-kpi-icon coa-kpi-icon-slate">
            <Lock size={19} />
          </div>

          <div>
            <span>System Accounts</span>
            <strong>{stats.system}</strong>
          </div>
        </div>

        <div className="coa-kpi-card">
          <div className="coa-kpi-icon coa-kpi-icon-navy">
            <Plus size={19} />
          </div>

          <div>
            <span>Custom Accounts</span>
            <strong>{stats.custom}</strong>
          </div>
        </div>
      </div>

      {/* ======================================================
          FILTER BAR
          ====================================================== */}

      <div className="coa-filter-card">
        <div className="coa-search-box">
          <Search size={17} />

          <input
            type="text"
            placeholder="Search code, account name, type..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
            >
              <X size={15} />
            </button>
          )}
        </div>

        <select
          value={typeFilter}
          onChange={(event) =>
            setTypeFilter(event.target.value)
          }
        >
          <option value="ALL">
            All Account Types
          </option>

          {ACCOUNT_TYPES.map((type) => (
            <option
              key={type.value}
              value={type.value}
            >
              {type.label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value
            )
          }
        >
          <option value="ALL">
            All Statuses
          </option>
          <option value="ACTIVE">
            Active
          </option>
          <option value="INACTIVE">
            Inactive
          </option>
        </select>

        <div className="coa-filter-actions">
          <button
            type="button"
            onClick={expandAll}
          >
            Expand All
          </button>

          <button
            type="button"
            onClick={collapseAll}
          >
            Collapse All
          </button>

          {hasFilters && (
            <button
              type="button"
              className="coa-clear-button"
              onClick={clearFilters}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ======================================================
          ACCOUNT TABLE
          ====================================================== */}

      <div className="coa-table-card">
        <div className="coa-table-header">
          <div>
            <h2>Accounts</h2>
            <p>
              {filteredAccounts.length}{" "}
              account
              {filteredAccounts.length === 1
                ? ""
                : "s"} displayed
            </p>
          </div>

          <div className="coa-table-count">
            {companyName}
          </div>
        </div>

        {loading ? (
          <div className="coa-loading">
            <RefreshCw
              size={22}
              className="coa-spin"
            />
            <span>
              Loading chart of accounts...
            </span>
          </div>
        ) : visibleAccounts.length === 0 ? (
          <div className="coa-empty">
            <div className="coa-empty-icon">
              <FileText size={25} />
            </div>

            <h3>
              No accounts found
            </h3>

            <p>
              {hasFilters
                ? "Try changing your search or filters."
                : "This company does not have any accounts yet."}
            </p>

            {!hasFilters && (
              <button
                type="button"
                className="coa-primary-button"
                onClick={openCreateModal}
              >
                <Plus size={16} />
                Create First Account
              </button>
            )}
          </div>
        ) : (
          <div className="coa-table-wrapper">
            <table className="coa-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Parent Account</th>
                  <th>Status</th>
                  <th>Structure</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {visibleAccounts.map(
                  (account) => {
                    const children =
                      childrenMap.get(
                        Number(account.id)
                      ) || [];

                    const hasChildren =
                      children.length > 0;

                    const parent =
                      accountMap.get(
                        Number(
                          account.parent
                        )
                      );

                    return (
                      <tr
                        key={account.id}
                      >
                        <td>
                          <div
                            className="coa-account-cell"
                            style={{
                              paddingLeft:
                                `${account.level * 28}px`,
                            }}
                          >
                            {hasChildren ? (
                              <button
                                type="button"
                                className="coa-expand-button"
                                onClick={() =>
                                  toggleExpanded(
                                    account.id
                                  )
                                }
                              >
                                {expandedAccounts[
                                  account.id
                                ] ? (
                                  <ChevronDown
                                    size={16}
                                  />
                                ) : (
                                  <ChevronRight
                                    size={16}
                                  />
                                )}
                              </button>
                            ) : (
                              <span className="coa-tree-spacer" />
                            )}

                            <div className="coa-account-avatar">
                              {initials(
                                account.name
                              )}
                            </div>

                            <div className="coa-account-info">
                              <strong>
                                {account.name}
                              </strong>

                              <span>
                                {account.code}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`coa-type-badge coa-type-${accountTypeClass(
                              account.account_type
                            )}`}
                          >
                            {accountTypeLabel(
                              account.account_type
                            )}
                          </span>
                        </td>

                        <td>
                          {parent ? (
                            <div className="coa-parent-cell">
                              <strong>
                                {parent.code}
                              </strong>
                              <span>
                                {parent.name}
                              </span>
                            </div>
                          ) : (
                            <span className="coa-muted">
                              Top-level account
                            </span>
                          )}
                        </td>

                        <td>
                          <span
                            className={`coa-status-badge ${
                              account.is_active
                                ? "active"
                                : "inactive"
                            }`}
                          >
                            {account.is_active ? (
                              <CheckCircle2
                                size={13}
                              />
                            ) : (
                              <AlertCircle
                                size={13}
                              />
                            )}

                            {account.is_active
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        <td>
                          {account.is_system_account ? (
                            <span className="coa-system-badge">
                              <Lock
                                size={13}
                              />
                              System
                            </span>
                          ) : (
                            <span className="coa-custom-badge">
                              Custom
                            </span>
                          )}
                        </td>

                        <td>
                          <span className="coa-date">
                            {formatDate(
                              account.updated_at ||
                                account.created_at
                            )}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="coa-edit-button"
                            onClick={() =>
                              openEditModal(
                                account
                              )
                            }
                            disabled={
                              account.is_system_account
                            }
                            title={
                              account.is_system_account
                                ? "System accounts cannot be edited"
                                : "Edit account"
                            }
                          >
                            {account.is_system_account ? (
                              <Lock
                                size={15}
                              />
                            ) : (
                              <Edit3
                                size={15}
                              />
                            )}
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
      </div>

      {/* ======================================================
          FOOTER
          ====================================================== */}

      <div className="coa-footer-summary">
        <div>
          <span>Accounting Company</span>
          <strong>
            {companyName}
          </strong>
        </div>

        <div>
          <span>Currency</span>
          <strong>
            {companyCurrency}
          </strong>
        </div>

        <div>
          <span>Account Types</span>
          <strong>6 Core Types</strong>
        </div>

        <div>
          <span>Accounting Basis</span>
          <strong>Double Entry</strong>
        </div>
      </div>

      {/* ======================================================
          CREATE / EDIT MODAL
          ====================================================== */}

      {showModal && (
        <div
          className="coa-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >
          <div className="coa-modal">
            <div className="coa-modal-header">
              <div>
                <div className="coa-modal-icon">
                  {editingAccount ? (
                    <Edit3 size={19} />
                  ) : (
                    <Plus size={19} />
                  )}
                </div>

                <div>
                  <h2>
                    {editingAccount
                      ? "Edit Account"
                      : "Create Account"}
                  </h2>

                  <p>
                    {editingAccount
                      ? "Update the account details."
                      : "Add a new account to the chart of accounts."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="coa-form"
              onSubmit={handleSubmit}
            >
              <div className="coa-form-company">
                <Building2 size={17} />

                <div>
                  <span>Company</span>
                  <strong>
                    {companyName}
                  </strong>
                </div>
              </div>

              <div className="coa-form-grid">
                <div className="coa-form-field">
                  <label>
                    Account Code
                  </label>

                  <input
                    name="code"
                    value={form.code}
                    onChange={handleChange}
                    placeholder="e.g. 1200"
                    disabled={saving}
                  />
                </div>

                <div className="coa-form-field">
                  <label>
                    Account Name
                  </label>

                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Accounts Receivable"
                    disabled={saving}
                  />
                </div>

                <div className="coa-form-field">
                  <label>
                    Account Type
                  </label>

                  <select
                    name="account_type"
                    value={
                      form.account_type
                    }
                    onChange={handleChange}
                    disabled={saving}
                  >
                    {ACCOUNT_TYPES.map(
                      (type) => (
                        <option
                          key={type.value}
                          value={
                            type.value
                          }
                        >
                          {type.label}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="coa-form-field">
                  <label>
                    Parent Account
                  </label>

                  <select
                    name="parent"
                    value={form.parent}
                    onChange={handleChange}
                    disabled={saving}
                  >
                    <option value="">
                      No Parent — Top Level
                    </option>

                    {accounts
                      .filter(
                        (account) =>
                          Number(
                            account.id
                          ) !==
                            Number(
                              editingAccount?.id
                            ) &&
                          account.is_active
                      )
                      .sort((a, b) =>
                        String(
                          a.code || ""
                        ).localeCompare(
                          String(
                            b.code || ""
                          ),
                          undefined,
                          {
                            numeric: true,
                          }
                        )
                      )
                      .map(
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
                </div>

                <div className="coa-form-field coa-form-field-full">
                  <label>
                    Description
                  </label>

                  <textarea
                    name="description"
                    value={
                      form.description
                    }
                    onChange={handleChange}
                    placeholder="Optional account description..."
                    rows={4}
                    disabled={saving}
                  />
                </div>

                <div className="coa-form-field-full">
                  <label className="coa-checkbox-label">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={
                        form.is_active
                      }
                      onChange={handleChange}
                      disabled={saving}
                    />

                    <span>
                      Account is active
                    </span>
                  </label>
                </div>
              </div>

              <div className="coa-form-note">
                <Lock size={15} />

                <span>
                  System accounts are protected
                  and cannot be edited from this
                  interface.
                </span>
              </div>

              <div className="coa-modal-actions">
                <button
                  type="button"
                  className="coa-cancel-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="coa-primary-button"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="coa-spin"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        size={16}
                      />
                      {editingAccount
                        ? "Save Changes"
                        : "Create Account"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}