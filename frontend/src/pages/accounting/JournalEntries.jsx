import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "POSTED", label: "Posted" },
];

const emptyLine = {
  account: "",
  description: "",
  debit: "",
  credit: "",
};

const today = () =>
  new Date().toISOString().slice(0, 10);

const formatMoney = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) => {
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
};

const statusLabel = (status) => {
  switch (status) {
    case "DRAFT":
      return "Draft";

    case "POSTED":
      return "Posted";

    default:
      return status || "Unknown";
  }
};

const statusClass = (status) =>
  String(status || "unknown").toLowerCase();

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

export default function JournalEntries() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;

  const companyName =
    currentCompany?.name ||
    "Current Company";

  const companyCurrency =
    currentCompany?.currency ||
    "USD";

  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [postingId, setPostingId] =
    useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [selectedEntry, setSelectedEntry] =
    useState(null);

  const [entryToPost, setEntryToPost] =
    useState(null);

  const [loadingDetail, setLoadingDetail] =
    useState(false);

  const [form, setForm] = useState({
    reference: "",
    description: "",
    transaction_date: today(),
    lines: [
      {
        ...emptyLine,
      },
      {
        ...emptyLine,
      },
    ],
  });

  /* ============================================================
     LOAD DATA
     ============================================================ */

  const loadData = async () => {
    if (!companyId) {
      setAccounts([]);
      setEntries([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [
        accountsResponse,
        entriesResponse,
      ] = await Promise.all([
        api.get(
          `/api/accounting/accounts/?company=${companyId}`
        ),
        api.get(
          `/api/accounting/journal-entries/?company=${companyId}`
        ),
      ]);

      setAccounts(
        extractList(accountsResponse)
      );

      setEntries(
        extractList(entriesResponse)
      );
    } catch (err) {
      setError(
        err?.data?.detail ||
          err?.message ||
          "Unable to load journal entries."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  /* ============================================================
     ACCOUNT LOOKUP
     ============================================================ */

  const accountMap = useMemo(() => {
    return new Map(
      accounts.map((account) => [
        Number(account.id),
        account,
      ])
    );
  }, [accounts]);

  const activeAccounts = useMemo(() => {
    return accounts
      .filter(
        (account) => account.is_active
      )
      .sort((a, b) =>
        String(a.code || "").localeCompare(
          String(b.code || ""),
          undefined,
          {
            numeric: true,
          }
        )
      );
  }, [accounts]);

  /* ============================================================
     FILTERED ENTRIES
     ============================================================ */

  const filteredEntries = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return entries
      .filter((entry) => {
        const searchableText = [
          entry.reference,
          entry.description,
          entry.status,
          statusLabel(entry.status),
          entry.id,
          entry.created_by,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !query ||
          searchableText.includes(query);

        const matchesStatus =
          statusFilter === "ALL" ||
          entry.status === statusFilter;

        const matchesFrom =
          !dateFrom ||
          entry.transaction_date >=
            dateFrom;

        const matchesTo =
          !dateTo ||
          entry.transaction_date <=
            dateTo;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesFrom &&
          matchesTo
        );
      })
      .sort((a, b) => {
        const dateA =
          new Date(
            a.transaction_date || ""
          ).getTime() || 0;

        const dateB =
          new Date(
            b.transaction_date || ""
          ).getTime() || 0;

        if (dateA !== dateB) {
          return dateB - dateA;
        }

        return (
          Number(b.id || 0) -
          Number(a.id || 0)
        );
      });
  }, [
    entries,
    search,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  /* ============================================================
     STATISTICS
     ============================================================ */

  const stats = useMemo(() => {
    const result = {
      total: entries.length,
      draft: 0,
      posted: 0,
      totalDebit: 0,
      totalCredit: 0,
    };

    entries.forEach((entry) => {
      if (entry.status === "DRAFT") {
        result.draft += 1;
      }

      if (entry.status === "POSTED") {
        result.posted += 1;
      }

      result.totalDebit += Number(
        entry.total_debit || 0
      );

      result.totalCredit += Number(
        entry.total_credit || 0
      );
    });

    return result;
  }, [entries]);

  /* ============================================================
     FORM TOTALS
     ============================================================ */

  const formTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;

    form.lines.forEach((line) => {
      debit += Number(line.debit || 0);
      credit += Number(line.credit || 0);
    });

    return {
      debit,
      credit,
      difference: debit - credit,
      balanced:
        debit > 0 &&
        debit === credit,
    };
  }, [form.lines]);

  /* ============================================================
     FORM ACTIONS
     ============================================================ */

  const openCreateModal = () => {
    setForm({
      reference: "",
      description: "",
      transaction_date: today(),
      lines: [
        {
          ...emptyLine,
        },
        {
          ...emptyLine,
        },
      ],
    });

    setError("");
    setSuccess("");
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (saving) {
      return;
    }

    setShowCreateModal(false);
  };

  const handleHeaderChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleLineChange = (
    index,
    field,
    value
  ) => {
    setForm((current) => {
      const lines = [
        ...current.lines,
      ];

      lines[index] = {
        ...lines[index],
        [field]: value,
      };

      /*
       * A journal line can only contain
       * either debit or credit.
       */
      if (
        field === "debit" &&
        value
      ) {
        lines[index].credit = "";
      }

      if (
        field === "credit" &&
        value
      ) {
        lines[index].debit = "";
      }

      return {
        ...current,
        lines,
      };
    });
  };

  const addLine = () => {
    setForm((current) => ({
      ...current,
      lines: [
        ...current.lines,
        {
          ...emptyLine,
        },
      ],
    }));
  };

  const removeLine = (index) => {
    setForm((current) => {
      if (current.lines.length <= 2) {
        return current;
      }

      return {
        ...current,
        lines: current.lines.filter(
          (_, lineIndex) =>
            lineIndex !== index
        ),
      };
    });
  };

  /* ============================================================
     CREATE JOURNAL ENTRY
     ============================================================ */

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    if (!companyId) {
      setError(
        "Please select a company before creating a journal entry."
      );
      return;
    }

    if (
      !form.transaction_date
    ) {
      setError(
        "Transaction date is required."
      );
      return;
    }

    if (
      !form.description.trim()
    ) {
      setError(
        "Journal entry description is required."
      );
      return;
    }

    if (
      form.lines.length < 2
    ) {
      setError(
        "A journal entry must contain at least two lines."
      );
      return;
    }

    for (
      let index = 0;
      index < form.lines.length;
      index += 1
    ) {
      const line =
        form.lines[index];

      if (!line.account) {
        setError(
          `Please select an account for line ${
            index + 1
          }.`
        );
        return;
      }

      const debit = Number(
        line.debit || 0
      );

      const credit = Number(
        line.credit || 0
      );

      if (
        debit <= 0 &&
        credit <= 0
      ) {
        setError(
          `Line ${
            index + 1
          } must contain a debit or credit amount.`
        );
        return;
      }

      if (
        debit > 0 &&
        credit > 0
      ) {
        setError(
          `Line ${
            index + 1
          } cannot contain both debit and credit.`
        );
        return;
      }
    }

    if (!formTotals.balanced) {
      setError(
        `Journal entry is not balanced. Debit: ${formatMoney(
          formTotals.debit
        )}, Credit: ${formatMoney(
          formTotals.credit
        )}.`
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        company: companyId,
        reference:
          form.reference.trim(),
        description:
          form.description.trim(),
        transaction_date:
          form.transaction_date,
        lines: form.lines.map(
          (line) => ({
            account: Number(
              line.account
            ),
            description:
              line.description.trim(),
            debit:
              line.debit || "0.00",
            credit:
              line.credit || "0.00",
          })
        ),
      };

      const created = await api.post(
        `/api/accounting/journal-entries/?company=${companyId}`,
        payload
      );

      setEntries((current) => [
        created,
        ...current,
      ]);

      setSuccess(
        "Journal entry created successfully as a draft."
      );

      setShowCreateModal(false);

      setForm({
        reference: "",
        description: "",
        transaction_date: today(),
        lines: [
          {
            ...emptyLine,
          },
          {
            ...emptyLine,
          },
        ],
      });

      await loadData();
    } catch (err) {
      const apiError =
        err?.data;

      if (
        apiError &&
        typeof apiError ===
          "object" &&
        !apiError.detail
      ) {
        const firstField =
          Object.keys(apiError)[0];

        if (firstField) {
          const message =
            Array.isArray(
              apiError[firstField]
            )
              ? apiError[firstField][0]
              : apiError[firstField];

          setError(
            `${firstField}: ${message}`
          );
        } else {
          setError(
            "Unable to create journal entry."
          );
        }
      } else {
        setError(
          apiError?.detail ||
            err?.message ||
            "Unable to create journal entry."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  /* ============================================================
     VIEW ENTRY
     ============================================================ */

  const openEntryDetail = async (
    entry
  ) => {
    try {
      setLoadingDetail(true);
      setError("");

      const detail =
        await api.get(
          `/api/accounting/journal-entries/${entry.id}/`
        );

      setSelectedEntry(detail);
    } catch (err) {
      setError(
        err?.data?.detail ||
          err?.message ||
          "Unable to load journal entry details."
      );
    } finally {
      setLoadingDetail(false);
    }
  };

  /* ============================================================
     POST ENTRY
     ============================================================ */

  const openPostConfirmation = (
    entry
  ) => {
    if (
      entry.status !== "DRAFT"
    ) {
      return;
    }

    setError("");
    setEntryToPost(entry);
  };

  const closePostConfirmation = () => {
    if (postingId) {
      return;
    }

    setEntryToPost(null);
  };

  const postEntry = async (
    entry
  ) => {
    if (
      entry.status !== "DRAFT"
    ) {
      return;
    }

    try {
      setPostingId(entry.id);
      setError("");
      setSuccess("");

      const posted =
        await api.post(
          `/api/accounting/journal-entries/${entry.id}/post/`
        );

      setEntries((current) =>
        current.map(
          (item) =>
            Number(item.id) ===
            Number(entry.id)
              ? posted
              : item
        )
      );

      setSelectedEntry((current) =>
        current &&
        Number(current.id) ===
          Number(entry.id)
          ? posted
          : current
      );

      setSuccess(
        `Journal entry #${entry.id} posted successfully.`
      );

      setEntryToPost(null);

      await loadData();
    } catch (err) {
      setError(
        err?.data?.detail ||
          err?.message ||
          "Unable to post journal entry."
      );
    } finally {
      setPostingId(null);
    }
  };

  /* ============================================================
     FILTERS
     ============================================================ */

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters =
    search ||
    statusFilter !== "ALL" ||
    dateFrom ||
    dateTo;

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div className="accounting-journal-page">
      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="journal-page-header">
        <div>
          <div className="journal-eyebrow">
            <FileText size={15} />
            ACCOUNTING
          </div>

          <h1>Journal Entries</h1>

          <p>
            Record, review, and post
            double-entry accounting
            transactions for{" "}
            <strong>
              {companyName}
            </strong>
            .
          </p>
        </div>

        <div className="journal-header-actions">
          <button
            type="button"
            className="journal-secondary-button"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "journal-spin"
                  : ""
              }
            />
            Refresh
          </button>

          <button
            type="button"
            className="journal-primary-button"
            onClick={
              openCreateModal
            }
          >
            <Plus size={17} />
            New Journal Entry
          </button>
        </div>
      </div>

      {/* ======================================================
          COMPANY STRIP
          ====================================================== */}

      <div className="journal-company-strip">
        <div className="journal-company-icon">
          <Building2 size={20} />
        </div>

        <div>
          <span>
            Reporting Company
          </span>
          <strong>
            {companyName}
          </strong>
        </div>

        <div className="journal-company-divider" />

        <div>
          <span>
            Functional Currency
          </span>
          <strong>
            {companyCurrency}
          </strong>
        </div>

        <div className="journal-company-divider" />

        <div>
          <span>
            Accounting Method
          </span>
          <strong>
            Double Entry
          </strong>
        </div>
      </div>

      {/* ======================================================
          ALERTS
          ====================================================== */}

      {error && (
        <div className="journal-alert journal-alert-error">
          <AlertCircle size={18} />

          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="journal-alert journal-alert-success">
          <CheckCircle2 size={18} />

          <span>
            {success}
          </span>

          <button
            type="button"
            onClick={() =>
              setSuccess("")
            }
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ======================================================
          KPI CARDS
          ====================================================== */}

      <div className="journal-kpi-grid">
        <div className="journal-kpi-card">
          <div className="journal-kpi-icon journal-kpi-blue">
            <FileText size={19} />
          </div>

          <div>
            <span>
              Total Entries
            </span>

            <strong>
              {stats.total}
            </strong>
          </div>
        </div>

        <div className="journal-kpi-card">
          <div className="journal-kpi-icon journal-kpi-gold">
            <RefreshCw size={19} />
          </div>

          <div>
            <span>
              Draft Entries
            </span>

            <strong>
              {stats.draft}
            </strong>
          </div>
        </div>

        <div className="journal-kpi-card">
          <div className="journal-kpi-icon journal-kpi-navy">
            <CheckCircle2 size={19} />
          </div>

          <div>
            <span>
              Posted Entries
            </span>

            <strong>
              {stats.posted}
            </strong>
          </div>
        </div>

        <div className="journal-kpi-card">
          <div className="journal-kpi-icon journal-kpi-slate">
            <ArrowDownRight size={19} />
          </div>

          <div>
            <span>
              Posted Through Ledger
            </span>

            <strong>
              {stats.posted}
            </strong>
          </div>
        </div>
      </div>

      {/* ======================================================
          FILTERS
          ====================================================== */}

      <div className="journal-filter-card">
        <div className="journal-search-box">
          <Search size={17} />

          <input
            type="text"
            placeholder="Search reference, description, entry..."
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
            >
              <X size={15} />
            </button>
          )}
        </div>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value
            )
          }
        >
          {STATUS_OPTIONS.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            )
          )}
        </select>

        <div className="journal-date-filter">
          <label>
            From
          </label>

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

        <div className="journal-date-filter">
          <label>
            To
          </label>

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
            className="journal-clear-button"
            onClick={
              clearFilters
            }
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* ======================================================
          JOURNAL TABLE
          ====================================================== */}

      <div className="journal-table-card">
        <div className="journal-table-header">
          <div>
            <h2>
              Journal Register
            </h2>

            <p>
              {filteredEntries.length}{" "}
              entr
              {filteredEntries.length ===
              1
                ? "y"
                : "ies"}{" "}
              displayed
            </p>
          </div>

          <div className="journal-register-badge">
            {companyName}
          </div>
        </div>

        {loading ? (
          <div className="journal-loading">
            <RefreshCw
              size={22}
              className="journal-spin"
            />

            <span>
              Loading journal entries...
            </span>
          </div>
        ) : filteredEntries.length ===
          0 ? (
          <div className="journal-empty">
            <div className="journal-empty-icon">
              <FileText size={25} />
            </div>

            <h3>
              No journal entries found
            </h3>

            <p>
              {hasFilters
                ? "Try changing your search or filters."
                : "Create your first journal entry to begin recording accounting activity."}
            </p>

            {!hasFilters && (
              <button
                type="button"
                className="journal-primary-button"
                onClick={
                  openCreateModal
                }
              >
                <Plus size={16} />
                Create Journal Entry
              </button>
            )}
          </div>
        ) : (
          <div className="journal-table-wrapper">
            <table className="journal-table">
              <thead>
                <tr>
                  <th>
                    Entry
                  </th>

                  <th>
                    Date
                  </th>

                  <th>
                    Description
                  </th>

                  <th>
                    Debit
                  </th>

                  <th>
                    Credit
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Created
                  </th>

                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredEntries.map(
                  (entry) => (
                    <tr
                      key={
                        entry.id
                      }
                    >
                      <td>
                        <div className="journal-entry-cell">
                          <div className="journal-entry-number">
                            JE-
                            {String(
                              entry.id
                            ).padStart(
                              5,
                              "0"
                            )}
                          </div>

                          <div>
                            <strong>
                              {entry.reference ||
                                "No reference"}
                            </strong>

                            <span>
                              Entry #
                              {
                                entry.id
                              }
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="journal-date">
                          {formatDate(
                            entry.transaction_date
                          )}
                        </span>
                      </td>

                      <td>
                        <div className="journal-description-cell">
                          <span>
                            {entry.description ||
                              "—"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className="journal-amount">
                          {companyCurrency}{" "}
                          {formatMoney(
                            entry.total_debit
                          )}
                        </span>
                      </td>

                      <td>
                        <span className="journal-amount">
                          {companyCurrency}{" "}
                          {formatMoney(
                            entry.total_credit
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`journal-status-badge ${statusClass(
                            entry.status
                          )}`}
                        >
                          {entry.status ===
                          "POSTED" ? (
                            <CheckCircle2
                              size={13}
                            />
                          ) : (
                            <RefreshCw
                              size={13}
                            />
                          )}

                          {statusLabel(
                            entry.status
                          )}
                        </span>
                      </td>

                      <td>
                        <span className="journal-date">
                          {formatDate(
                            entry.created_at
                          )}
                        </span>
                      </td>

                      <td>
                        <div className="journal-row-actions">
                          <button
                            type="button"
                            className="journal-view-button"
                            onClick={() =>
                              openEntryDetail(
                                entry
                              )
                            }
                            title="View journal entry"
                          >
                            <Eye
                              size={15}
                            />
                          </button>

                          {entry.status ===
                            "DRAFT" && (
                            <button
                              type="button"
                              className="journal-post-button"
                              onClick={() =>
                                openPostConfirmation(
                                  entry
                                )
                              }
                              disabled={
                                postingId ===
                                entry.id
                              }
                              title="Post journal entry"
                            >
                              {postingId ===
                              entry.id ? (
                                <RefreshCw
                                  size={15}
                                  className="journal-spin"
                                />
                              ) : (
                                <Send
                                  size={15}
                                />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================
          CREATE MODAL
          ====================================================== */}

      {showCreateModal && (
        <div
          className="journal-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCreateModal();
            }
          }}
        >
          <div className="journal-create-modal">
            <div className="journal-modal-header">
              <div>
                <div className="journal-modal-icon">
                  <Plus size={19} />
                </div>

                <div>
                  <h2>
                    New Journal Entry
                  </h2>

                  <p>
                    Record a balanced
                    double-entry
                    transaction.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  closeCreateModal
                }
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="journal-create-form"
              onSubmit={
                handleSubmit
              }
            >
              {/* Company */}

              <div className="journal-form-company">
                <Building2
                  size={17}
                />

                <div>
                  <span>
                    Company
                  </span>

                  <strong>
                    {companyName}
                  </strong>
                </div>

                <div className="journal-form-company-currency">
                  {companyCurrency}
                </div>
              </div>

              {/* Header fields */}

              <div className="journal-form-grid">
                <div className="journal-form-field">
                  <label>
                    Reference
                  </label>

                  <input
                    name="reference"
                    value={
                      form.reference
                    }
                    onChange={
                      handleHeaderChange
                    }
                    placeholder="e.g. JV-001"
                    disabled={saving}
                  />
                </div>

                <div className="journal-form-field">
                  <label>
                    Transaction Date
                  </label>

                  <input
                    type="date"
                    name="transaction_date"
                    value={
                      form.transaction_date
                    }
                    onChange={
                      handleHeaderChange
                    }
                    disabled={saving}
                  />
                </div>

                <div className="journal-form-field journal-form-field-full">
                  <label>
                    Description
                  </label>

                  <input
                    name="description"
                    value={
                      form.description
                    }
                    onChange={
                      handleHeaderChange
                    }
                    placeholder="Describe the accounting transaction..."
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Lines */}

              <div className="journal-lines-section">
                <div className="journal-lines-header">
                  <div>
                    <h3>
                      Journal Lines
                    </h3>

                    <p>
                      Select the accounts
                      and enter either a
                      debit or credit for
                      each line.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="journal-add-line-button"
                    onClick={addLine}
                    disabled={saving}
                  >
                    <Plus size={15} />
                    Add Line
                  </button>
                </div>

                <div className="journal-line-table-wrapper">
                  <table className="journal-line-table">
                    <thead>
                      <tr>
                        <th>
                          Account
                        </th>

                        <th>
                          Line Description
                        </th>

                        <th>
                          Debit
                        </th>

                        <th>
                          Credit
                        </th>

                        <th />
                      </tr>
                    </thead>

                    <tbody>
                      {form.lines.map(
                        (
                          line,
                          index
                        ) => (
                          <tr
                            key={
                              index
                            }
                          >
                            <td>
                              <select
                                value={
                                  line.account
                                }
                                onChange={(
                                  event
                                ) =>
                                  handleLineChange(
                                    index,
                                    "account",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                disabled={
                                  saving
                                }
                              >
                                <option value="">
                                  Select account
                                </option>

                                {activeAccounts.map(
                                  (
                                    account
                                  ) => (
                                    <option
                                      key={
                                        account.id
                                      }
                                      value={
                                        account.id
                                      }
                                    >
                                      {
                                        account.code
                                      }{" "}
                                      —{" "}
                                      {
                                        account.name
                                      }
                                    </option>
                                  )
                                )}
                              </select>
                            </td>

                            <td>
                              <input
                                type="text"
                                value={
                                  line.description
                                }
                                onChange={(
                                  event
                                ) =>
                                  handleLineChange(
                                    index,
                                    "description",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder="Optional"
                                disabled={
                                  saving
                                }
                              />
                            </td>

                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  line.debit
                                }
                                onChange={(
                                  event
                                ) =>
                                  handleLineChange(
                                    index,
                                    "debit",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder="0.00"
                                disabled={
                                  saving
                                }
                              />
                            </td>

                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  line.credit
                                }
                                onChange={(
                                  event
                                ) =>
                                  handleLineChange(
                                    index,
                                    "credit",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder="0.00"
                                disabled={
                                  saving
                                }
                              />
                            </td>

                            <td>
                              <button
                                type="button"
                                className="journal-remove-line-button"
                                onClick={() =>
                                  removeLine(
                                    index
                                  )
                                }
                                disabled={
                                  saving ||
                                  form.lines
                                    .length <=
                                    2
                                }
                                title="Remove line"
                              >
                                <X
                                  size={
                                    15
                                  }
                                />
                              </button>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>

                    <tfoot>
                      <tr>
                        <td
                          colSpan={
                            2
                          }
                        >
                          <strong>
                            Entry Totals
                          </strong>
                        </td>

                        <td>
                          <strong>
                            {companyCurrency}{" "}
                            {formatMoney(
                              formTotals.debit
                            )}
                          </strong>
                        </td>

                        <td>
                          <strong>
                            {companyCurrency}{" "}
                            {formatMoney(
                              formTotals.credit
                            )}
                          </strong>
                        </td>

                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div
                  className={`journal-balance-indicator ${
                    formTotals.balanced
                      ? "balanced"
                      : "unbalanced"
                  }`}
                >
                  {formTotals.balanced ? (
                    <>
                      <CheckCircle2
                        size={17}
                      />

                      <div>
                        <strong>
                          Entry is balanced
                        </strong>

                        <span>
                          Total debit equals
                          total credit.
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle
                        size={17}
                      />

                      <div>
                        <strong>
                          Entry is not balanced
                        </strong>

                        <span>
                          Difference:{" "}
                          {
                            companyCurrency
                          }{" "}
                          {formatMoney(
                            Math.abs(
                              formTotals.difference
                            )
                          )}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Form note */}

              <div className="journal-form-note">
                <ArrowUpRight
                  size={15}
                />

                <span>
                  New journal entries are
                  created as <strong>Draft</strong>.
                  Post the entry after reviewing
                  it to make it part of the official
                  accounting ledger.
                </span>
              </div>

              {/* Actions */}

              <div className="journal-modal-actions">
                <button
                  type="button"
                  className="journal-cancel-button"
                  onClick={
                    closeCreateModal
                  }
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="journal-primary-button"
                  disabled={
                    saving ||
                    !formTotals.balanced
                  }
                >
                  {saving ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="journal-spin"
                      />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        size={16}
                      />
                      Create Draft
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================
          POST CONFIRMATION MODAL
          ====================================================== */}

      {entryToPost && (
        <div
          className="journal-confirm-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !postingId
            ) {
              closePostConfirmation();
            }
          }}
        >
          <div
            className="journal-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="journal-post-confirm-title"
          >
            <div className="journal-confirm-icon">
              <Send size={21} />
            </div>

            <div className="journal-confirm-content">
              <h2 id="journal-post-confirm-title">
                Post Journal Entry?
              </h2>

              <p>
                You are about to post{" "}
                <strong>
                  JE-
                  {String(
                    entryToPost.id
                  ).padStart(5, "0")}
                </strong>
                {entryToPost.reference
                  ? ` (${entryToPost.reference})`
                  : ""}
                .
              </p>

              <div className="journal-confirm-warning">
                <AlertCircle size={16} />

                <span>
                  Once posted, this journal entry
                  becomes part of the official
                  accounting ledger and should only
                  be posted after you have reviewed
                  the entry.
                </span>
              </div>

              <div className="journal-confirm-summary">
                <div>
                  <span>Description</span>
                  <strong>
                    {entryToPost.description ||
                      "No description provided."}
                  </strong>
                </div>

                <div>
                  <span>Transaction Date</span>
                  <strong>
                    {formatDate(
                      entryToPost.transaction_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>Total Debit</span>
                  <strong>
                    {companyCurrency}{" "}
                    {formatMoney(
                      entryToPost.total_debit
                    )}
                  </strong>
                </div>

                <div>
                  <span>Total Credit</span>
                  <strong>
                    {companyCurrency}{" "}
                    {formatMoney(
                      entryToPost.total_credit
                    )}
                  </strong>
                </div>
              </div>
            </div>

            <div className="journal-confirm-actions">
              <button
                type="button"
                className="journal-cancel-button"
                onClick={
                  closePostConfirmation
                }
                disabled={Boolean(postingId)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="journal-primary-button journal-confirm-post-button"
                onClick={() =>
                  postEntry(entryToPost)
                }
                disabled={
                  postingId ===
                  entryToPost.id
                }
              >
                {postingId ===
                entryToPost.id ? (
                  <>
                    <RefreshCw
                      size={16}
                      className="journal-spin"
                    />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Confirm & Post
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          DETAIL MODAL
          ====================================================== */}

      {(selectedEntry ||
        loadingDetail) && (
        <div
          className="journal-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !loadingDetail
            ) {
              setSelectedEntry(
                null
              );
            }
          }}
        >
          <div className="journal-detail-modal">
            {loadingDetail ? (
              <div className="journal-detail-loading">
                <RefreshCw
                  size={23}
                  className="journal-spin"
                />

                <span>
                  Loading journal entry...
                </span>
              </div>
            ) : (
              <>
                <div className="journal-modal-header">
                  <div>
                    <div className="journal-modal-icon">
                      <Eye size={19} />
                    </div>

                    <div>
                      <h2>
                        Journal Entry #
                        {
                          selectedEntry.id
                        }
                      </h2>

                      <p>
                        {selectedEntry.reference ||
                          "No reference"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedEntry(
                        null
                      )
                    }
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="journal-detail-body">
                  <div className="journal-detail-summary">
                    <div>
                      <span>
                        Transaction Date
                      </span>

                      <strong>
                        {formatDate(
                          selectedEntry.transaction_date
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Status
                      </span>

                      <strong>
                        {statusLabel(
                          selectedEntry.status
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Total Debit
                      </span>

                      <strong>
                        {
                          companyCurrency
                        }{" "}
                        {formatMoney(
                          selectedEntry.total_debit
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Total Credit
                      </span>

                      <strong>
                        {
                          companyCurrency
                        }{" "}
                        {formatMoney(
                          selectedEntry.total_credit
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="journal-detail-description">
                    <span>
                      Description
                    </span>

                    <p>
                      {selectedEntry.description ||
                        "No description provided."}
                    </p>
                  </div>

                  <div className="journal-detail-lines">
                    <div className="journal-detail-lines-header">
                      <div>
                        <h3>
                          Journal Lines
                        </h3>

                        <p>
                          Double-entry distribution
                        </p>
                      </div>

                      {selectedEntry.is_balanced && (
                        <span className="journal-balanced-tag">
                          <CheckCircle2
                            size={13}
                          />
                          Balanced
                        </span>
                      )}
                    </div>

                    {selectedEntry.lines &&
                    selectedEntry.lines.length >
                      0 ? (
                      <div className="journal-detail-table-wrapper">
                        <table className="journal-detail-table">
                          <thead>
                            <tr>
                              <th>
                                Account
                              </th>

                              <th>
                                Description
                              </th>

                              <th>
                                Debit
                              </th>

                              <th>
                                Credit
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {selectedEntry.lines.map(
                              (line) => (
                                <tr
                                  key={
                                    line.id
                                  }
                                >
                                  <td>
                                    <div className="journal-detail-account">
                                      <strong>
                                        {line.account_code ||
                                          accountMap.get(
                                            Number(
                                              line.account
                                            )
                                          )
                                            ?.code ||
                                          "—"}
                                      </strong>

                                      <span>
                                        {line.account_name ||
                                          accountMap.get(
                                            Number(
                                              line.account
                                            )
                                          )
                                            ?.name ||
                                          "Account"}
                                      </span>
                                    </div>
                                  </td>

                                  <td>
                                    {
                                      line.description
                                    }
                                  </td>

                                  <td>
                                    {Number(
                                      line.debit ||
                                        0
                                    ) >
                                    0
                                      ? `${companyCurrency} ${formatMoney(
                                          line.debit
                                        )}`
                                      : "—"}
                                  </td>

                                  <td>
                                    {Number(
                                      line.credit ||
                                        0
                                    ) >
                                    0
                                      ? `${companyCurrency} ${formatMoney(
                                          line.credit
                                        )}`
                                      : "—"}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>

                          <tfoot>
                            <tr>
                              <td
                                colSpan={
                                  2
                                }
                              >
                                Total
                              </td>

                              <td>
                                {
                                  companyCurrency
                                }{" "}
                                {formatMoney(
                                  selectedEntry.total_debit
                                )}
                              </td>

                              <td>
                                {
                                  companyCurrency
                                }{" "}
                                {formatMoney(
                                  selectedEntry.total_credit
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <div className="journal-detail-no-lines">
                        Journal lines are not
                        available for this entry.
                      </div>
                    )}
                  </div>

                  <div className="journal-detail-meta">
                    <div>
                      <span>
                        Created
                      </span>

                      <strong>
                        {formatDate(
                          selectedEntry.created_at
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Posted
                      </span>

                      <strong>
                        {formatDate(
                          selectedEntry.posted_at
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Entry ID
                      </span>

                      <strong>
                        JE-
                        {String(
                          selectedEntry.id
                        ).padStart(
                          5,
                          "0"
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="journal-detail-actions">
                  <button
                    type="button"
                    className="journal-cancel-button"
                    onClick={() =>
                      setSelectedEntry(
                        null
                      )
                    }
                  >
                    Close
                  </button>

                  {selectedEntry.status ===
                    "DRAFT" && (
                    <button
                      type="button"
                      className="journal-primary-button"
                      onClick={() =>
                        openPostConfirmation(
                          selectedEntry
                        )
                      }
                      disabled={
                        postingId ===
                        selectedEntry.id
                      }
                    >
                      {postingId ===
                      selectedEntry.id ? (
                        <>
                          <RefreshCw
                            size={16}
                            className="journal-spin"
                          />
                          Posting...
                        </>
                      ) : (
                        <>
                          <Send
                            size={16}
                          />
                          Post Entry
                        </>
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}