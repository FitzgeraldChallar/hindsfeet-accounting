import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  FileClock,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";


// ============================================================
// HELPERS
// ============================================================

function extractList(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  return [];
}


function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}


function formatNumber(value, decimals = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}


function statusLabel(status) {
  const labels = {
    DRAFT: "Draft",
    PROCESSING: "Processing",
    PROCESSED: "Processed",
    APPROVED: "Approved",
    LOCKED: "Locked",
  };

  return labels[status] || status || "Unknown";
}


function statusClass(status) {
  switch (status) {
    case "PROCESSING":
      return "payroll-period-status payroll-period-status-processing";

    case "PROCESSED":
      return "payroll-period-status payroll-period-status-processed";

    case "APPROVED":
      return "payroll-period-status payroll-period-status-approved";

    case "LOCKED":
      return "payroll-period-status payroll-period-status-locked";

    case "DRAFT":
    default:
      return "payroll-period-status payroll-period-status-draft";
  }
}


function emptyPeriod() {
  return {
    name: "",
    start_date: "",
    end_date: "",
    pay_date: "",
    notes: "",

    // Payroll calculation inputs.
    exchange_rate: "1",
    working_days: "22",
    social_security_employee_rate: "4",
    social_security_employer_rate: "6",
  };
}


// ============================================================
// PERIOD FORM MODAL
// ============================================================

function PayrollPeriodModal({
  open,
  employeePeriod,
  companyId,
  currency,
  onClose,
  onSaved,
}) {
  const editing = Boolean(employeePeriod);

  const [form, setForm] = useState(emptyPeriod());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");


  useEffect(() => {
    if (!open) {
      return;
    }

    if (employeePeriod) {
      setForm({
        name: employeePeriod.name || "",
        start_date: employeePeriod.start_date || "",
        end_date: employeePeriod.end_date || "",
        pay_date: employeePeriod.pay_date || "",
        notes: employeePeriod.notes || "",

        exchange_rate:
          employeePeriod.exchange_rate ??
          "1",

        working_days:
          employeePeriod.working_days ??
          "22",

        social_security_employee_rate:
          employeePeriod.social_security_employee_rate ??
          "4",

        social_security_employer_rate:
          employeePeriod.social_security_employer_rate ??
          "6",
      });
    } else {
      setForm(emptyPeriod());
    }

    setError("");
  }, [open, employeePeriod]);


  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }


  async function handleSubmit(event) {
    event.preventDefault();

    if (!companyId) {
      setError(
        "No company is currently selected."
      );
      return;
    }

    if (!form.name.trim()) {
      setError(
        "Payroll period name is required."
      );
      return;
    }

    if (!form.start_date) {
      setError(
        "Payroll start date is required."
      );
      return;
    }

    if (!form.end_date) {
      setError(
        "Payroll end date is required."
      );
      return;
    }

    if (!form.pay_date) {
      setError(
        "Pay date is required."
      );
      return;
    }

    if (form.end_date < form.start_date) {
      setError(
        "Payroll end date cannot be earlier than the start date."
      );
      return;
    }

    if (form.pay_date < form.start_date) {
      setError(
        "Pay date cannot be earlier than the payroll start date."
      );
      return;
    }

    const exchangeRate =
      Number(form.exchange_rate);

    const workingDays =
      Number(form.working_days);

    const employeeRate =
      Number(
        form.social_security_employee_rate
      );

    const employerRate =
      Number(
        form.social_security_employer_rate
      );

    if (
      !Number.isFinite(exchangeRate) ||
      exchangeRate <= 0
    ) {
      setError(
        "Enter a valid exchange rate greater than zero."
      );
      return;
    }

    if (
      !Number.isFinite(workingDays) ||
      workingDays <= 0
    ) {
      setError(
        "Working days must be greater than zero."
      );
      return;
    }

    if (
      !Number.isFinite(employeeRate) ||
      employeeRate < 0 ||
      employeeRate > 100
    ) {
      setError(
        "Employee NASSCORP rate must be between 0% and 100%."
      );
      return;
    }

    if (
      !Number.isFinite(employerRate) ||
      employerRate < 0 ||
      employerRate > 100
    ) {
      setError(
        "Employer NASSCORP rate must be between 0% and 100%."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        company: companyId,
        name: form.name.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        pay_date: form.pay_date,
        notes: form.notes.trim(),

        exchange_rate:
          exchangeRate.toFixed(6),

        working_days:
          workingDays.toFixed(2),

        social_security_employee_rate:
          employeeRate.toFixed(2),

        social_security_employer_rate:
          employerRate.toFixed(2),
      };

      let saved;

      if (editing) {
        saved = await api.patch(
          `/api/payroll/periods/${employeePeriod.id}/`,
          payload
        );
      } else {
        saved = await api.post(
          "/api/payroll/periods/",
          payload
        );
      }

      await onSaved(saved);

      onClose();
    } catch (err) {
      const data = err?.data;

      if (
        data &&
        typeof data === "object"
      ) {
        const messages =
          Object.entries(data)
            .map(
              ([field, message]) =>
                `${field}: ${
                  Array.isArray(message)
                    ? message.join(", ")
                    : message
                }`
            )
            .join(" ");

        setError(
          messages ||
            err?.message ||
            "Unable to save payroll period."
        );
      } else {
        setError(
          err?.message ||
            "Unable to save payroll period."
        );
      }
    } finally {
      setSaving(false);
    }
  }


  if (!open) {
    return null;
  }


  return (
    <div className="payroll-period-modal-backdrop">
      <div className="payroll-period-modal">

        <div className="payroll-period-modal-header">
          <div>
            <div className="payroll-period-eyebrow">
              PAYROLL PERIOD MANAGEMENT
            </div>

            <h2>
              {editing
                ? "Edit Payroll Period"
                : "Create Payroll Period"}
            </h2>

            <p>
              Define the payroll cycle and the
              calculation inputs for this period.
            </p>
          </div>

          <button
            type="button"
            className="payroll-period-close"
            onClick={onClose}
            disabled={saving}
          >
            <X size={18} />
          </button>
        </div>


        <form
          className="payroll-period-form"
          onSubmit={handleSubmit}
        >

          {error && (
            <div className="payroll-period-form-error">
              <AlertCircle size={17} />

              <span>{error}</span>
            </div>
          )}


          {/* PERIOD INFORMATION */}

          <div className="payroll-period-form-section">

            <div className="payroll-period-section-heading">
              <CalendarDays size={17} />

              <div>
                <h3>
                  Period Information
                </h3>

                <p>
                  Define the payroll cycle and
                  payment date.
                </p>
              </div>
            </div>


            <div className="payroll-period-form-grid">

              <div className="payroll-period-field payroll-period-field-full">
                <label>
                  Payroll Period Name *
                </label>

                <input
                  value={form.name}
                  onChange={(event) =>
                    updateField(
                      "name",
                      event.target.value
                    )
                  }
                  placeholder="January 2026 Monthly Payroll"
                  required
                />
              </div>


              <div className="payroll-period-field">
                <label>
                  Start Date *
                </label>

                <input
                  type="date"
                  value={form.start_date}
                  onChange={(event) =>
                    updateField(
                      "start_date",
                      event.target.value
                    )
                  }
                  required
                />
              </div>


              <div className="payroll-period-field">
                <label>
                  End Date *
                </label>

                <input
                  type="date"
                  value={form.end_date}
                  min={
                    form.start_date ||
                    undefined
                  }
                  onChange={(event) =>
                    updateField(
                      "end_date",
                      event.target.value
                    )
                  }
                  required
                />
              </div>


              <div className="payroll-period-field">
                <label>
                  Pay Date *
                </label>

                <input
                  type="date"
                  value={form.pay_date}
                  min={
                    form.start_date ||
                    undefined
                  }
                  onChange={(event) =>
                    updateField(
                      "pay_date",
                      event.target.value
                    )
                  }
                  required
                />
              </div>

            </div>
          </div>


          {/* CALCULATION SETTINGS */}

          <div className="payroll-period-form-section">

            <div className="payroll-period-section-heading">
              <CheckCircle2 size={17} />

              <div>
                <h3>
                  Payroll Calculation Settings
                </h3>

                <p>
                  These values are entered by the
                  accountant and used by the payroll
                  engine when the period is processed.
                </p>
              </div>
            </div>


            <div className="payroll-period-form-grid">

              <div className="payroll-period-field">
                <label>
                  Exchange Rate *
                </label>

                <input
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  value={form.exchange_rate}
                  onChange={(event) =>
                    updateField(
                      "exchange_rate",
                      event.target.value
                    )
                  }
                  required
                />

                <small>
                  1 {currency} = this amount in LRD.
                  For LRD payroll, use 1.
                </small>
              </div>


              <div className="payroll-period-field">
                <label>
                  Working Days *
                </label>

                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.working_days}
                  onChange={(event) =>
                    updateField(
                      "working_days",
                      event.target.value
                    )
                  }
                  required
                />

                <small>
                  Used to calculate deductions for
                  days missed.
                </small>
              </div>


              <div className="payroll-period-field">
                <label>
                  Employee NASSCORP Rate (%)
                </label>

                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={
                    form.social_security_employee_rate
                  }
                  onChange={(event) =>
                    updateField(
                      "social_security_employee_rate",
                      event.target.value
                    )
                  }
                />

                <small>
                  Default: 4%.
                </small>
              </div>


              <div className="payroll-period-field">
                <label>
                  Employer NASSCORP Rate (%)
                </label>

                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={
                    form.social_security_employer_rate
                  }
                  onChange={(event) =>
                    updateField(
                      "social_security_employer_rate",
                      event.target.value
                    )
                  }
                />

                <small>
                  Default: 6%.
                </small>
              </div>

            </div>


            <div className="payroll-period-calculation-note">
              <strong>
                Accountant-controlled calculation inputs
              </strong>

              <span>
                The payroll system uses these values
                when payroll is processed. PAYE,
                absence deductions, NASSCORP and net
                pay are calculated automatically by
                the backend.
              </span>
            </div>

          </div>


          {/* NOTES */}

          <div className="payroll-period-form-section">

            <div className="payroll-period-form-grid">

              <div className="payroll-period-field payroll-period-field-full">

                <label>
                  Notes
                </label>

                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) =>
                    updateField(
                      "notes",
                      event.target.value
                    )
                  }
                  placeholder="Optional notes for this payroll period..."
                />

              </div>

            </div>

          </div>


          <div className="payroll-period-modal-footer">

            <button
              type="button"
              className="payroll-period-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="payroll-period-save"
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCw
                    size={15}
                    className="payroll-period-spin"
                  />

                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />

                  {editing
                    ? "Save Changes"
                    : "Create Period"}
                </>
              )}
            </button>

          </div>

        </form>
      </div>
    </div>
  );
}


// ============================================================
// PERIOD DETAILS MODAL
// ============================================================

function PayrollPeriodDetails({
  period,
  currency,
  onClose,
  onEdit,
}) {
  if (!period) {
    return null;
  }

  return (
    <div className="payroll-period-modal-backdrop">

      <div className="payroll-period-details-modal">

        <div className="payroll-period-modal-header">

          <div>
            <div className="payroll-period-eyebrow">
              PAYROLL PERIOD
            </div>

            <h2>
              {period.name}
            </h2>

            <p>
              Payroll Period #{period.id}
            </p>
          </div>

          <button
            type="button"
            className="payroll-period-close"
            onClick={onClose}
          >
            <X size={18} />
          </button>

        </div>


        <div className="payroll-period-details-body">

          <div className="payroll-period-details-status">
            <span
              className={statusClass(
                period.status
              )}
            >
              {statusLabel(
                period.status
              )}
            </span>
          </div>


          <div className="payroll-period-date-grid">

            <div className="payroll-period-date-card">
              <div className="payroll-period-date-icon">
                <CalendarDays size={17} />
              </div>

              <span>Start Date</span>

              <strong>
                {formatDate(
                  period.start_date
                )}
              </strong>
            </div>


            <div className="payroll-period-date-card">
              <div className="payroll-period-date-icon">
                <CalendarDays size={17} />
              </div>

              <span>End Date</span>

              <strong>
                {formatDate(
                  period.end_date
                )}
              </strong>
            </div>


            <div className="payroll-period-date-card payroll-period-pay-date-card">
              <div className="payroll-period-date-icon">
                <Clock3 size={17} />
              </div>

              <span>Pay Date</span>

              <strong>
                {formatDate(
                  period.pay_date
                )}
              </strong>
            </div>

          </div>


          {/* CALCULATION SETTINGS */}

          <div className="payroll-period-detail-settings">

            <div className="payroll-period-detail-setting">
              <span>Currency</span>

              <strong>
                {currency}
              </strong>
            </div>


            <div className="payroll-period-detail-setting">
              <span>Exchange Rate</span>

              <strong>
                {formatNumber(
                  period.exchange_rate,
                  6
                )}
              </strong>

              <small>
                1 {currency} ={" "}
                {formatNumber(
                  period.exchange_rate,
                  6
                )} LRD
              </small>
            </div>


            <div className="payroll-period-detail-setting">
              <span>Working Days</span>

              <strong>
                {formatNumber(
                  period.working_days,
                  2
                )}
              </strong>
            </div>


            <div className="payroll-period-detail-setting">
              <span>
                Employee NASSCORP
              </span>

              <strong>
                {formatNumber(
                  period.social_security_employee_rate,
                  2
                )}
                %
              </strong>
            </div>


            <div className="payroll-period-detail-setting">
              <span>
                Employer NASSCORP
              </span>

              <strong>
                {formatNumber(
                  period.social_security_employer_rate,
                  2
                )}
                %
              </strong>
            </div>

          </div>


          <div className="payroll-period-detail-row">

            <span>
              Period Status
            </span>

            <strong>
              {statusLabel(
                period.status
              )}
            </strong>

          </div>


          {period.notes && (
            <div className="payroll-period-notes">

              <span>Notes</span>

              <p>
                {period.notes}
              </p>

            </div>
          )}

        </div>


        <div className="payroll-period-modal-footer">

          <button
            type="button"
            className="payroll-period-cancel"
            onClick={onClose}
          >
            Close
          </button>

          {period.status === "DRAFT" && (
            <button
              type="button"
              className="payroll-period-save"
              onClick={() =>
                onEdit(period)
              }
            >
              <Edit3 size={15} />
              Edit Period
            </button>
          )}

        </div>

      </div>

    </div>
  );
}


// ============================================================
// PAYROLL PERIODS PAGE
// ============================================================

export default function PayrollPeriods() {
  const { currentCompany } =
    useCompany();

  const companyId =
    currentCompany?.id;

  const companyName =
    currentCompany?.name ||
    "No company selected";

  const currency =
    currentCompany?.currency ||
    "USD";


  const [periods, setPeriods] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [showModal, setShowModal] =
    useState(false);

  const [editingPeriod, setEditingPeriod] =
    useState(null);

  const [selectedPeriod, setSelectedPeriod] =
    useState(null);


  // ==========================================================
  // LOAD PERIODS
  // ==========================================================

  const loadPeriods =
    useCallback(
      async (silent = false) => {
        if (!companyId) {
          setPeriods([]);
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

          const response =
            await api.get(
              `/api/payroll/periods/?company=${companyId}`
            );

          setPeriods(
            extractList(response)
          );
        } catch (err) {
          setError(
            err?.data?.detail ||
              err?.message ||
              "Unable to load payroll periods."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [companyId]
    );


  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);


  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredPeriods =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return periods.filter(
        (period) => {
          const matchesSearch =
            !query ||
            [
              period.name,
              period.status,
              period.id,
              period.notes,
            ]
              .filter(Boolean)
              .some((value) =>
                String(value)
                  .toLowerCase()
                  .includes(query)
              );

          const matchesStatus =
            statusFilter === "ALL" ||
            period.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      periods,
      search,
      statusFilter,
    ]);


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const draftCount =
    periods.filter(
      (period) =>
        period.status === "DRAFT"
    ).length;

  const processingCount =
    periods.filter(
      (period) =>
        period.status ===
        "PROCESSING"
    ).length;

  const approvedCount =
    periods.filter(
      (period) =>
        period.status ===
        "APPROVED"
    ).length;

  const lockedCount =
    periods.filter(
      (period) =>
        period.status ===
        "LOCKED"
    ).length;


  // ==========================================================
  // SAVE
  // ==========================================================

  function handleSaved(saved) {
    setPeriods((current) => {
      const exists =
        current.some(
          (period) =>
            period.id ===
            saved?.id
        );

      if (exists) {
        return current.map(
          (period) =>
            period.id ===
            saved.id
              ? saved
              : period
        );
      }

      return [
        saved,
        ...current,
      ];
    });

    setError("");
  }


  function openCreate() {
    setEditingPeriod(null);
    setShowModal(true);
  }


  function openEdit(period) {
    setSelectedPeriod(null);
    setEditingPeriod(period);
    setShowModal(true);
  }


  function openDetails(period) {
    setSelectedPeriod(period);
  }


  function closeModal() {
    setShowModal(false);
    setEditingPeriod(null);
  }


  if (!companyId) {
    return (
      <div className="payroll-page">

        <div className="payroll-empty-company">

          <div className="payroll-empty-icon">
            <CalendarDays size={26} />
          </div>

          <h2>
            No Company Selected
          </h2>

          <p>
            Select a company to manage
            payroll periods.
          </p>

        </div>

      </div>
    );
  }


  return (
    <div className="payroll-page">

      {/* HEADER */}

      <div className="payroll-page-header">

        <div>

          <div className="payroll-eyebrow">
            PAYROLL MANAGEMENT
          </div>

          <h1>
            Payroll Periods
          </h1>

          <p>
            Define and manage payroll cycles
            and their calculation inputs for{" "}
            {companyName}.
          </p>

        </div>


        <div className="payroll-header-actions">

          <button
            type="button"
            className="payroll-btn payroll-btn-secondary"
            onClick={() =>
              loadPeriods(true)
            }
            disabled={
              loading ||
              refreshing
            }
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "payroll-period-spin"
                  : ""
              }
            />

            Refresh
          </button>


          <button
            type="button"
            className="payroll-btn payroll-btn-primary"
            onClick={openCreate}
          >
            <Plus size={16} />

            New Payroll Period
          </button>

        </div>

      </div>


      {/* COMPANY STRIP */}

      <div className="payroll-company-strip">

        <div className="payroll-company-mark">
          {companyName
            .slice(0, 1)
            .toUpperCase()}
        </div>

        <div>
          <span>
            Current Company
          </span>

          <strong>
            {companyName}
          </strong>
        </div>

      </div>


      {/* STATS */}

      <div className="payroll-stat-grid">

        <div className="payroll-stat-card">

          <div className="payroll-stat-icon payroll-stat-icon-blue">
            <CalendarDays size={19} />
          </div>

          <div className="payroll-stat-content">

            <span className="payroll-stat-label">
              Total Periods
            </span>

            <strong className="payroll-stat-value">
              {periods.length}
            </strong>

            <span className="payroll-stat-helper">
              Payroll cycles
            </span>

          </div>

        </div>


        <div className="payroll-stat-card">

          <div className="payroll-stat-icon payroll-stat-icon-gold">
            <FileClock size={19} />
          </div>

          <div className="payroll-stat-content">

            <span className="payroll-stat-label">
              Draft Periods
            </span>

            <strong className="payroll-stat-value">
              {draftCount}
            </strong>

            <span className="payroll-stat-helper">
              Awaiting processing
            </span>

          </div>

        </div>


        <div className="payroll-stat-card">

          <div className="payroll-stat-icon payroll-stat-icon-navy">
            <CheckCircle2 size={19} />
          </div>

          <div className="payroll-stat-content">

            <span className="payroll-stat-label">
              Approved
            </span>

            <strong className="payroll-stat-value">
              {approvedCount}
            </strong>

            <span className="payroll-stat-helper">
              Approved payroll periods
            </span>

          </div>

        </div>


        <div className="payroll-stat-card">

          <div className="payroll-stat-icon payroll-stat-icon-blue">
            <Clock3 size={19} />
          </div>

          <div className="payroll-stat-content">

            <span className="payroll-stat-label">
              Locked
            </span>

            <strong className="payroll-stat-value">
              {lockedCount}
            </strong>

            <span className="payroll-stat-helper">
              Finalized periods
            </span>

          </div>

        </div>

      </div>


      {/* PERIOD TABLE */}

      <section className="payroll-panel payroll-periods-management-panel">

        <div className="payroll-panel-header">

          <div>

            <div className="payroll-section-label">
              PAYROLL CYCLES
            </div>

            <h2>
              Payroll Period Records
            </h2>

            <p>
              Manage payroll periods and the
              inputs used by the payroll engine.
            </p>

          </div>

          <div className="payroll-record-count">
            {filteredPeriods.length} of{" "}
            {periods.length}
          </div>

        </div>


        {/* FILTERS */}

        <div className="payroll-period-filter-bar">

          <div className="payroll-period-search">

            <Search size={16} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search payroll periods..."
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
              >
                <X size={14} />
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
            className="payroll-period-filter-select"
          >
            <option value="ALL">
              All Statuses
            </option>

            <option value="DRAFT">
              Draft
            </option>

            <option value="PROCESSING">
              Processing
            </option>

            <option value="PROCESSED">
              Processed
            </option>

            <option value="APPROVED">
              Approved
            </option>

            <option value="LOCKED">
              Locked
            </option>
          </select>

        </div>


        {/* ERROR */}

        {error && (
          <div className="payroll-period-inline-error">

            <AlertCircle size={16} />

            <span>
              {error}
            </span>

          </div>
        )}


        {/* CONTENT */}

        {loading ? (
          <div className="payroll-loading">

            <RefreshCw
              size={22}
              className="payroll-period-spin"
            />

            <span>
              Loading payroll periods...
            </span>

          </div>
        ) : filteredPeriods.length === 0 ? (
          <div className="payroll-empty-state">

            <div className="payroll-empty-icon">
              <CalendarDays size={24} />
            </div>

            <h3>
              No payroll periods found
            </h3>

            <p>
              {periods.length === 0
                ? "Create your first payroll period to begin the payroll workflow."
                : "No periods match the current search or status filter."}
            </p>

            {periods.length === 0 && (
              <button
                type="button"
                className="payroll-btn payroll-btn-primary"
                onClick={openCreate}
              >
                <Plus size={15} />
                Create First Period
              </button>
            )}

          </div>
        ) : (
          <div className="payroll-table-wrapper">

            <table className="payroll-table payroll-period-management-table">

              <thead>
                <tr>

                  <th>
                    Payroll Period
                  </th>

                  <th>
                    Start Date
                  </th>

                  <th>
                    End Date
                  </th>

                  <th>
                    Pay Date
                  </th>

                  <th>
                    Exchange Rate
                  </th>

                  <th>
                    Working Days
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Action
                  </th>

                </tr>
              </thead>


              <tbody>

                {filteredPeriods.map(
                  (period) => (
                    <tr
                      key={period.id}
                    >

                      <td>
                        <button
                          type="button"
                          className="payroll-period-name-cell"
                          onClick={() =>
                            openDetails(
                              period
                            )
                          }
                        >

                          <div className="payroll-period-row-icon">
                            <CalendarDays
                              size={16}
                            />
                          </div>

                          <div>

                            <strong>
                              {period.name}
                            </strong>

                            <span>
                              Period #
                              {period.id}
                            </span>

                          </div>

                        </button>
                      </td>


                      <td>
                        {formatDate(
                          period.start_date
                        )}
                      </td>


                      <td>
                        {formatDate(
                          period.end_date
                        )}
                      </td>


                      <td>
                        <strong className="payroll-period-pay-date">
                          {formatDate(
                            period.pay_date
                          )}
                        </strong>
                      </td>


                      <td>
                        {formatNumber(
                          period.exchange_rate,
                          4
                        )}
                      </td>


                      <td>
                        {formatNumber(
                          period.working_days,
                          2
                        )}
                      </td>


                      <td>
                        <span
                          className={statusClass(
                            period.status
                          )}
                        >
                          {statusLabel(
                            period.status
                          )}
                        </span>
                      </td>


                      <td>
                        <button
                          type="button"
                          className="payroll-period-action-button"
                          onClick={() =>
                            openEdit(
                              period
                            )
                          }
                          disabled={
                            period.status !==
                            "DRAFT"
                          }
                          title={
                            period.status ===
                            "DRAFT"
                              ? "Edit payroll period"
                              : "Only draft periods can be edited"
                          }
                        >
                          <Edit3 size={15} />
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


      {/* MODALS */}

      <PayrollPeriodModal
        open={showModal}
        employeePeriod={editingPeriod}
        companyId={companyId}
        currency={currency}
        onClose={closeModal}
        onSaved={handleSaved}
      />


      <PayrollPeriodDetails
        period={selectedPeriod}
        currency={currency}
        onClose={() =>
          setSelectedPeriod(null)
        }
        onEdit={openEdit}
      />

    </div>
  );
}