import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  SlidersHorizontal,
  Edit3,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { api } from "../services/api";
import { useCompany } from "../context/CompanyContext";
import PayrollPeriods from "./payroll/PayrollPeriods";
import PayrollProcessing from "./payroll/PayrollProcessing";
import PayrollSetup from "./payroll/PayrollSetup";


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


function formatMoney(value, currency = "USD") {
  return (
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0)) +
    ` ${currency}`
  );
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


function employeeName(employee) {
  if (!employee) {
    return "Unknown Employee";
  }

  if (employee.full_name) {
    return employee.full_name;
  }

  return [
    employee.first_name,
    employee.middle_name,
    employee.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}


function initials(employee) {
  const name = employeeName(employee);

  const parts = name
    .split(" ")
    .filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0]
      .charAt(0)
      .toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}


function statusLabel(status) {
  const labels = {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    TERMINATED: "Terminated",
  };

  return labels[status] || status || "Unknown";
}


function frequencyLabel(frequency) {
  const labels = {
    MONTHLY: "Monthly",
    BI_WEEKLY: "Bi-weekly",
    WEEKLY: "Weekly",
    DAILY: "Daily",
  };

  return (
    labels[frequency] ||
    frequency ||
    "Monthly"
  );
}


function statusClass(status) {
  switch (status) {
    case "ACTIVE":
      return "payroll-employee-status payroll-employee-status-active";

    case "TERMINATED":
      return "payroll-employee-status payroll-employee-status-terminated";

    case "INACTIVE":
    default:
      return "payroll-employee-status payroll-employee-status-inactive";
  }
}


// ============================================================
// EMPLOYEE FORM DEFAULT
// ============================================================

const emptyEmployee = {
  employee_number: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  phone: "",
  email: "",
  address: "",
  department: "",
  position: "",
  employment_status: "ACTIVE",
  date_employed: "",
  date_terminated: "",
  pay_frequency: "MONTHLY",
  basic_salary: "0.00",
  is_taxable: true,
  notes: "",
};


// ============================================================
// EMPLOYEE FORM MODAL
// ============================================================

function EmployeeFormModal({
  open,
  onClose,
  employee,
  companyId,
  userId,
  onSaved,
}) {
  const editing = Boolean(employee);

  const [form, setForm] =
    useState(emptyEmployee);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    if (employee) {
      setForm({
        employee_number:
          employee.employee_number || "",
        first_name:
          employee.first_name || "",
        middle_name:
          employee.middle_name || "",
        last_name:
          employee.last_name || "",
        phone:
          employee.phone || "",
        email:
          employee.email || "",
        address:
          employee.address || "",
        department:
          employee.department || "",
        position:
          employee.position || "",
        employment_status:
          employee.employment_status ||
          "ACTIVE",
        date_employed:
          employee.date_employed || "",
        date_terminated:
          employee.date_terminated || "",
        pay_frequency:
          employee.pay_frequency ||
          "MONTHLY",
        basic_salary:
          employee.basic_salary ??
          "0.00",
        is_taxable:
          employee.is_taxable !== false,
        notes:
          employee.notes || "",
      });
    } else {
      setForm({
        ...emptyEmployee,
      });
    }

    setError("");
  }, [open, employee]);


  function updateField(
    field,
    value
  ) {
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

    if (!form.employee_number.trim()) {
      setError(
        "Employee number is required."
      );
      return;
    }

    if (!form.first_name.trim()) {
      setError(
        "First name is required."
      );
      return;
    }

    if (!form.last_name.trim()) {
      setError(
        "Last name is required."
      );
      return;
    }

    if (
      form.employment_status ===
        "TERMINATED" &&
      !form.date_terminated
    ) {
      setError(
        "A terminated employee must have a termination date."
      );
      return;
    }

    if (
      form.date_employed &&
      form.date_terminated &&
      form.date_terminated <
        form.date_employed
    ) {
      setError(
        "Termination date cannot be earlier than employment date."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        company: companyId,
        employee_number:
          form.employee_number.trim(),
        first_name:
          form.first_name.trim(),
        middle_name:
          form.middle_name.trim(),
        last_name:
          form.last_name.trim(),
        phone:
          form.phone.trim(),
        email:
          form.email.trim(),
        address:
          form.address.trim(),
        department:
          form.department.trim(),
        position:
          form.position.trim(),
        employment_status:
          form.employment_status,
        date_employed:
          form.date_employed || null,
        date_terminated:
          form.date_terminated || null,
        pay_frequency:
          form.pay_frequency,
        basic_salary:
          form.basic_salary || "0.00",
        is_taxable:
          form.is_taxable,
        notes:
          form.notes.trim(),

        // Included for compatibility if the
        // serializer accepts it. If created_by
        // is read-only, DRF will ignore it.
        ...(userId
          ? { created_by: userId }
          : {}),
      };

      let saved;

      if (editing) {
        saved = await api.patch(
          `/api/payroll/employees/${employee.id}/`,
          payload
        );
      } else {
        saved = await api.post(
          "/api/payroll/employees/",
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
        const messages = Object.entries(
          data
        )
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
            "Unable to save employee."
        );
      } else {
        setError(
          err?.message ||
            "Unable to save employee."
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
    <div className="payroll-employee-modal-backdrop">

      <div className="payroll-employee-modal">

        {/* HEADER */}

        <div className="payroll-employee-modal-header">

          <div>
            <div className="payroll-employee-modal-eyebrow">
              EMPLOYEE MANAGEMENT
            </div>

            <h2>
              {editing
                ? "Edit Employee"
                : "Add Employee"}
            </h2>

            <p>
              {editing
                ? "Update the employee's payroll profile."
                : "Create a new employee payroll profile."}
            </p>
          </div>

          <button
            type="button"
            className="payroll-employee-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <X size={18} />
          </button>

        </div>


        {/* FORM */}

        <form
          onSubmit={handleSubmit}
          className="payroll-employee-form"
        >

          {error && (
            <div className="payroll-employee-form-error">
              <AlertCircle size={17} />

              <span>{error}</span>
            </div>
          )}


          {/* PERSONAL INFORMATION */}

          <div className="payroll-employee-form-section">

            <div className="payroll-employee-form-section-heading">

              <UserRound size={17} />

              <div>
                <h3>
                  Personal Information
                </h3>

                <p>
                  Basic employee identification
                  and contact information.
                </p>
              </div>

            </div>


            <div className="payroll-employee-form-grid">

              <div className="payroll-employee-field">
                <label>
                  Employee Number *
                </label>

                <input
                  value={
                    form.employee_number
                  }
                  onChange={(event) =>
                    updateField(
                      "employee_number",
                      event.target.value
                    )
                  }
                  placeholder="EMP-001"
                  required
                />
              </div>


              <div className="payroll-employee-field">
                <label>
                  First Name *
                </label>

                <input
                  value={
                    form.first_name
                  }
                  onChange={(event) =>
                    updateField(
                      "first_name",
                      event.target.value
                    )
                  }
                  placeholder="First name"
                  required
                />
              </div>


              <div className="payroll-employee-field">
                <label>
                  Middle Name
                </label>

                <input
                  value={
                    form.middle_name
                  }
                  onChange={(event) =>
                    updateField(
                      "middle_name",
                      event.target.value
                    )
                  }
                  placeholder="Middle name"
                />
              </div>


              <div className="payroll-employee-field">
                <label>
                  Last Name *
                </label>

                <input
                  value={
                    form.last_name
                  }
                  onChange={(event) =>
                    updateField(
                      "last_name",
                      event.target.value
                    )
                  }
                  placeholder="Last name"
                  required
                />
              </div>


              <div className="payroll-employee-field">
                <label>
                  Phone
                </label>

                <input
                  type="tel"
                  value={
                    form.phone
                  }
                  onChange={(event) =>
                    updateField(
                      "phone",
                      event.target.value
                    )
                  }
                  placeholder="077..."
                />
              </div>


              <div className="payroll-employee-field">
                <label>
                  Email
                </label>

                <input
                  type="email"
                  value={
                    form.email
                  }
                  onChange={(event) =>
                    updateField(
                      "email",
                      event.target.value
                    )
                  }
                  placeholder="employee@example.com"
                />
              </div>


              <div className="payroll-employee-field payroll-employee-field-full">
                <label>
                  Address
                </label>

                <textarea
                  value={
                    form.address
                  }
                  onChange={(event) =>
                    updateField(
                      "address",
                      event.target.value
                    )
                  }
                  rows={2}
                  placeholder="Residential address"
                />
              </div>

            </div>

          </div>


          {/* EMPLOYMENT INFORMATION */}

          <div className="payroll-employee-form-section">

            <div className="payroll-employee-form-section-heading">

              <BriefcaseBusiness
                size={17}
              />

              <div>
                <h3>
                  Employment Information
                </h3>

                <p>
                  Role, department and employment
                  status.
                </p>
              </div>

            </div>


            <div className="payroll-employee-form-grid">

              <div className="payroll-employee-field">
                <label>
                  Department
                </label>

                <input
                  value={
                    form.department
                  }
                  onChange={(event) =>
                    updateField(
                      "department",
                      event.target.value
                    )
                  }
                  placeholder="Finance"
                />
              </div>


              <div className="payroll-employee-field">
                <label>
                  Position
                </label>

                <input
                  value={
                    form.position
                  }
                  onChange={(event) =>
                    updateField(
                      "position",
                      event.target.value
                    )
                  }
                  placeholder="Accountant"
                />
              </div>


              <div className="payroll-employee-field">
                <label>
                  Employment Status
                </label>

                <select
                  value={
                    form.employment_status
                  }
                  onChange={(event) =>
                    updateField(
                      "employment_status",
                      event.target.value
                    )
                  }
                >
                  <option value="ACTIVE">
                    Active
                  </option>

                  <option value="INACTIVE">
                    Inactive
                  </option>

                  <option value="TERMINATED">
                    Terminated
                  </option>
                </select>
              </div>


              <div className="payroll-employee-field">
                <label>
                  Date Employed
                </label>

                <input
                  type="date"
                  value={
                    form.date_employed
                  }
                  onChange={(event) =>
                    updateField(
                      "date_employed",
                      event.target.value
                    )
                  }
                />
              </div>


              <div className="payroll-employee-field">
                <label>
                  Date Terminated
                </label>

                <input
                  type="date"
                  value={
                    form.date_terminated
                  }
                  onChange={(event) =>
                    updateField(
                      "date_terminated",
                      event.target.value
                    )
                  }
                  disabled={
                    form.employment_status !==
                    "TERMINATED"
                  }
                />
              </div>

            </div>

          </div>


          {/* PAYROLL INFORMATION */}

          <div className="payroll-employee-form-section">

            <div className="payroll-employee-form-section-heading">

              <CalendarDays
                size={17}
              />

              <div>
                <h3>
                  Payroll Information
                </h3>

                <p>
                  Salary, pay frequency and
                  tax treatment.
                </p>
              </div>

            </div>


            <div className="payroll-employee-form-grid">

              <div className="payroll-employee-field">
                <label>
                  Pay Frequency
                </label>

                <select
                  value={
                    form.pay_frequency
                  }
                  onChange={(event) =>
                    updateField(
                      "pay_frequency",
                      event.target.value
                    )
                  }
                >
                  <option value="MONTHLY">
                    Monthly
                  </option>

                  <option value="BI_WEEKLY">
                    Bi-weekly
                  </option>

                  <option value="WEEKLY">
                    Weekly
                  </option>

                  <option value="DAILY">
                    Daily
                  </option>
                </select>
              </div>


              <div className="payroll-employee-field">
                <label>
                  Basic Salary
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    form.basic_salary
                  }
                  onChange={(event) =>
                    updateField(
                      "basic_salary",
                      event.target.value
                    )
                  }
                  placeholder="0.00"
                />
              </div>


              <div className="payroll-employee-taxable-field">

                <label>
                  Tax Treatment
                </label>

                <label className="payroll-employee-checkbox">

                  <input
                    type="checkbox"
                    checked={
                      form.is_taxable
                    }
                    onChange={(event) =>
                      updateField(
                        "is_taxable",
                        event.target.checked
                      )
                    }
                  />

                  <span>
                    Employee is taxable
                  </span>

                </label>

              </div>


              <div className="payroll-employee-field payroll-employee-field-full">
                <label>
                  Notes
                </label>

                <textarea
                  value={
                    form.notes
                  }
                  onChange={(event) =>
                    updateField(
                      "notes",
                      event.target.value
                    )
                  }
                  rows={3}
                  placeholder="Additional employee or payroll notes..."
                />
              </div>

            </div>

          </div>


          {/* FOOTER */}

          <div className="payroll-employee-modal-footer">

            <button
              type="button"
              className="payroll-employee-cancel-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="payroll-employee-save-button"
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCw
                    size={15}
                    className="payroll-spin"
                  />

                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />

                  {editing
                    ? "Save Changes"
                    : "Create Employee"}
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
// EMPLOYEE DETAILS MODAL
// ============================================================

function EmployeeDetailsModal({
  employee,
  currency,
  onClose,
  onEdit,
}) {
  if (!employee) {
    return null;
  }

  return (
    <div className="payroll-employee-modal-backdrop">

      <div className="payroll-employee-details-modal">

        <div className="payroll-employee-details-header">

          <div className="payroll-employee-profile">

            <div className="payroll-employee-large-avatar">
              {initials(employee)}
            </div>

            <div>
              <div className="payroll-employee-number">
                {employee.employee_number}
              </div>

              <h2>
                {employeeName(employee)}
              </h2>

              <p>
                {employee.position ||
                  "Employee"}
                {employee.department
                  ? ` · ${employee.department}`
                  : ""}
              </p>
            </div>

          </div>

          <button
            type="button"
            className="payroll-employee-modal-close"
            onClick={onClose}
          >
            <X size={18} />
          </button>

        </div>


        <div className="payroll-employee-details-body">

          <div className="payroll-employee-detail-status-row">

            <span
              className={statusClass(
                employee.employment_status
              )}
            >
              {statusLabel(
                employee.employment_status
              )}
            </span>

            <span className="payroll-employee-frequency-badge">
              {frequencyLabel(
                employee.pay_frequency
              )}
            </span>

            <span className="payroll-employee-tax-badge">
              {employee.is_taxable
                ? "Taxable"
                : "Non-taxable"}
            </span>

          </div>


          <div className="payroll-employee-detail-grid">

            <div className="payroll-employee-detail-card">
              <span>
                Basic Salary
              </span>

              <strong>
                {formatMoney(
                  employee.basic_salary,
                  currency
                )}
              </strong>
            </div>

            <div className="payroll-employee-detail-card">
              <span>
                Date Employed
              </span>

              <strong>
                {formatDate(
                  employee.date_employed
                )}
              </strong>
            </div>

            <div className="payroll-employee-detail-card">
              <span>
                Phone
              </span>

              <strong>
                {employee.phone ||
                  "—"}
              </strong>
            </div>

            <div className="payroll-employee-detail-card">
              <span>
                Email
              </span>

              <strong>
                {employee.email ||
                  "—"}
              </strong>
            </div>

          </div>


          <div className="payroll-employee-contact-grid">

            <div>
              <span>
                <Phone size={14} />
                Phone
              </span>

              <strong>
                {employee.phone ||
                  "No phone number"}
              </strong>
            </div>

            <div>
              <span>
                <Mail size={14} />
                Email
              </span>

              <strong>
                {employee.email ||
                  "No email address"}
              </strong>
            </div>

            <div>
              <span>
                <BriefcaseBusiness
                  size={14}
                />
                Department
              </span>

              <strong>
                {employee.department ||
                  "Not specified"}
              </strong>
            </div>

            <div>
              <span>
                <CalendarDays
                  size={14}
                />
                Employment Date
              </span>

              <strong>
                {formatDate(
                  employee.date_employed
                )}
              </strong>
            </div>

          </div>


          {employee.address && (
            <div className="payroll-employee-notes-block">

              <span>
                Address
              </span>

              <p>
                {employee.address}
              </p>

            </div>
          )}


          {employee.notes && (
            <div className="payroll-employee-notes-block">

              <span>
                Notes
              </span>

              <p>
                {employee.notes}
              </p>

            </div>
          )}

        </div>


        <div className="payroll-employee-modal-footer">

          <button
            type="button"
            className="payroll-employee-cancel-button"
            onClick={onClose}
          >
            Close
          </button>

          <button
            type="button"
            className="payroll-employee-save-button"
            onClick={() =>
              onEdit(employee)
            }
          >
            <Edit3 size={15} />
            Edit Employee
          </button>

        </div>

      </div>

    </div>
  );
}


// ============================================================
// EMPLOYEES PAGE
// ============================================================

function EmployeesPage({
  employees,
  loading,
  currency,
  companyName,
  onRefresh,
  onCreate,
  onEdit,
  onView,
}) {
  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [frequencyFilter, setFrequencyFilter] =
    useState("ALL");


  const filteredEmployees = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return employees.filter(
      (employee) => {
        const matchesSearch =
          !query ||
          [
            employee.employee_number,
            employee.first_name,
            employee.middle_name,
            employee.last_name,
            employee.full_name,
            employee.department,
            employee.position,
            employee.phone,
            employee.email,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(query)
            );

        const matchesStatus =
          statusFilter === "ALL" ||
          employee.employment_status ===
            statusFilter;

        const matchesFrequency =
          frequencyFilter === "ALL" ||
          employee.pay_frequency ===
            frequencyFilter;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesFrequency
        );
      }
    );
  }, [
    employees,
    search,
    statusFilter,
    frequencyFilter,
  ]);


  const activeCount =
    employees.filter(
      (employee) =>
        employee.employment_status ===
        "ACTIVE"
    ).length;

  const inactiveCount =
    employees.filter(
      (employee) =>
        employee.employment_status ===
        "INACTIVE"
    ).length;

  const terminatedCount =
    employees.filter(
      (employee) =>
        employee.employment_status ===
        "TERMINATED"
    ).length;


  const totalPayroll =
    employees
      .filter(
        (employee) =>
          employee.employment_status ===
          "ACTIVE"
      )
      .reduce(
        (total, employee) =>
          total +
          Number(
            employee.basic_salary || 0
          ),
        0
      );


  return (
    <div className="payroll-page">

      {/* HEADER */}

      <div className="payroll-page-header">

        <div>

          <div className="payroll-eyebrow">
            PAYROLL MANAGEMENT
          </div>

          <h1>
            Employees
          </h1>

          <p>
            Manage employee profiles, employment
            status and payroll information for{" "}
            {companyName}.
          </p>

        </div>


        <div className="payroll-header-actions">

          <button
            type="button"
            className="payroll-btn payroll-btn-secondary"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "payroll-spin"
                  : ""
              }
            />

            Refresh
          </button>

          <button
            type="button"
            className="payroll-btn payroll-btn-primary"
            onClick={onCreate}
          >
            <Plus size={16} />

            Add Employee
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

        <div className="payroll-company-currency">
          <span>
            Currency
          </span>

          <strong>
            {currency}
          </strong>
        </div>

      </div>


      {/* SUMMARY */}

      <div className="payroll-stat-grid">

        <div className="payroll-stat-card">

          <div className="payroll-stat-icon payroll-stat-icon-blue">
            <Users size={19} />
          </div>

          <div className="payroll-stat-content">
            <span className="payroll-stat-label">
              Total Employees
            </span>

            <strong className="payroll-stat-value">
              {employees.length}
            </strong>

            <span className="payroll-stat-helper">
              Employee records
            </span>
          </div>

        </div>


        <div className="payroll-stat-card">

          <div className="payroll-stat-icon payroll-stat-icon-gold">
            <CheckCircle2 size={19} />
          </div>

          <div className="payroll-stat-content">
            <span className="payroll-stat-label">
              Active Employees
            </span>

            <strong className="payroll-stat-value">
              {activeCount}
            </strong>

            <span className="payroll-stat-helper">
              Currently employed
            </span>
          </div>

        </div>


        <div className="payroll-stat-card">

          <div className="payroll-stat-icon payroll-stat-icon-navy">
            <BriefcaseBusiness size={19} />
          </div>

          <div className="payroll-stat-content">
            <span className="payroll-stat-label">
              Active Basic Payroll
            </span>

            <strong className="payroll-stat-value">
              {formatMoney(
                totalPayroll,
                currency
              )}
            </strong>

            <span className="payroll-stat-helper">
              Monthly equivalent of active salaries
            </span>
          </div>

        </div>


        <div className="payroll-stat-card">

          <div className="payroll-stat-icon payroll-stat-icon-blue">
            <UserRound size={19} />
          </div>

          <div className="payroll-stat-content">
            <span className="payroll-stat-label">
              Other Statuses
            </span>

            <strong className="payroll-stat-value">
              {inactiveCount +
                terminatedCount}
            </strong>

            <span className="payroll-stat-helper">
              {inactiveCount} inactive ·{" "}
              {terminatedCount} terminated
            </span>
          </div>

        </div>

      </div>


      {/* EMPLOYEE TABLE */}

      <section className="payroll-panel payroll-employees-panel">

        <div className="payroll-panel-header">

          <div>
            <div className="payroll-section-label">
              EMPLOYEE DIRECTORY
            </div>

            <h2>
              Employee Records
            </h2>

            <p>
              Search and manage employees assigned
              to this company.
            </p>
          </div>

          <div className="payroll-record-count">
            {filteredEmployees.length} of{" "}
            {employees.length}
          </div>

        </div>


        {/* FILTER BAR */}

        <div className="payroll-employee-filter-bar">

          <div className="payroll-employee-search">

            <Search size={16} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search employee, department, position..."
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                aria-label="Clear search"
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
            className="payroll-employee-filter-select"
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

            <option value="TERMINATED">
              Terminated
            </option>
          </select>


          <select
            value={frequencyFilter}
            onChange={(event) =>
              setFrequencyFilter(
                event.target.value
              )
            }
            className="payroll-employee-filter-select"
          >
            <option value="ALL">
              All Frequencies
            </option>

            <option value="MONTHLY">
              Monthly
            </option>

            <option value="BI_WEEKLY">
              Bi-weekly
            </option>

            <option value="WEEKLY">
              Weekly
            </option>

            <option value="DAILY">
              Daily
            </option>
          </select>

        </div>


        {/* TABLE */}

        {loading ? (
          <div className="payroll-loading">
            <RefreshCw
              size={22}
              className="payroll-spin"
            />

            <span>
              Loading employees...
            </span>
          </div>
        ) : filteredEmployees.length ===
          0 ? (
          <div className="payroll-empty-state">
            <div className="payroll-empty-icon">
              <Users size={24} />
            </div>

            <h3>
              No employees found
            </h3>

            <p>
              {employees.length === 0
                ? "No employee records have been created for this company yet."
                : "No employees match the current search or filters."}
            </p>

            {employees.length ===
              0 && (
              <button
                type="button"
                className="payroll-btn payroll-btn-primary"
                onClick={onCreate}
              >
                <Plus size={15} />
                Add First Employee
              </button>
            )}
          </div>
        ) : (
          <div className="payroll-table-wrapper">

            <table className="payroll-table payroll-employees-table">

              <thead>
                <tr>
                  <th>
                    Employee
                  </th>

                  <th>
                    Department
                  </th>

                  <th>
                    Position
                  </th>

                  <th>
                    Pay Frequency
                  </th>

                  <th>
                    Basic Salary
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

                {filteredEmployees.map(
                  (employee) => (
                    <tr
                      key={
                        employee.id
                      }
                    >

                      <td>

                        <button
                          type="button"
                          className="payroll-employee-primary-cell"
                          onClick={() =>
                            onView(employee)
                          }
                        >

                          <div className="payroll-employee-avatar">
                            {initials(
                              employee
                            )}
                          </div>

                          <div>

                            <strong>
                              {employeeName(
                                employee
                              )}
                            </strong>

                            <span>
                              {
                                employee.employee_number
                              }
                            </span>

                          </div>

                        </button>

                      </td>


                      <td>
                        {employee.department ||
                          "—"}
                      </td>


                      <td>
                        {employee.position ||
                          "—"}
                      </td>


                      <td>
                        <span className="payroll-employee-frequency">
                          {frequencyLabel(
                            employee.pay_frequency
                          )}
                        </span>
                      </td>


                      <td>
                        <strong className="payroll-employee-money">
                          {formatMoney(
                            employee.basic_salary,
                            currency
                          )}
                        </strong>
                      </td>


                      <td>
                        <span
                          className={statusClass(
                            employee.employment_status
                          )}
                        >
                          {statusLabel(
                            employee.employment_status
                          )}
                        </span>
                      </td>


                      <td>

                        <div className="payroll-employee-actions">

                          <button
                            type="button"
                            className="payroll-employee-action-button"
                            onClick={() =>
                              onView(
                                employee
                              )
                            }
                            title="View employee"
                          >
                            <MoreHorizontal
                              size={16}
                            />
                          </button>

                          <button
                            type="button"
                            className="payroll-employee-action-button"
                            onClick={() =>
                              onEdit(
                                employee
                              )
                            }
                            title="Edit employee"
                          >
                            <Edit3
                              size={15}
                            />
                          </button>

                        </div>

                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>
        )}

      </section>

    </div>
  );
}


// ============================================================
// MAIN PAYROLL COMPONENT
// ============================================================

export default function Payroll() {
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


  const [employees, setEmployees] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [userId, setUserId] =
    useState(null);

  const [activeView, setActiveView] =
    useState("dashboard");

  const [editingEmployee, setEditingEmployee] =
    useState(null);

  const [viewingEmployee, setViewingEmployee] =
    useState(null);

  const [showEmployeeModal, setShowEmployeeModal] =
    useState(false);


  // ==========================================================
  // LOAD USER
  // ==========================================================

  useEffect(() => {
    async function loadUser() {
      try {
        const response =
          await api.get(
            "/api/accounts/me/"
          );

        setUserId(
          response?.id || null
        );
      } catch {
        setUserId(null);
      }
    }

    loadUser();
  }, []);


  // ==========================================================
  // LOAD EMPLOYEES
  // ==========================================================

  const loadEmployees =
    useCallback(
      async (silent = false) => {
        if (!companyId) {
          setEmployees([]);
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
              `/api/payroll/employees/?company=${companyId}`
            );

          setEmployees(
            extractList(response)
          );
        } catch (err) {
          console.error(
            "Payroll employees error:",
            err
          );

          setError(
            err?.data?.detail ||
              err?.message ||
              "Unable to load employees."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [companyId]
    );


  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);


  // ==========================================================
  // SAVE EMPLOYEE
  // ==========================================================

  async function handleSaved(saved) {
    if (!saved) {
      await loadEmployees(true);
      return;
    }

    setEmployees(
      (current) => {
        const exists =
          current.some(
            (employee) =>
              employee.id ===
              saved.id
          );

        if (exists) {
          return current.map(
            (employee) =>
              employee.id ===
              saved.id
                ? saved
                : employee
          );
        }

        return [
          saved,
          ...current,
        ];
      }
    );

    setError("");
  }


  // ==========================================================
  // OPEN CREATE
  // ==========================================================

  function openCreateEmployee() {
    setEditingEmployee(null);
    setShowEmployeeModal(true);
  }


  // ==========================================================
  // OPEN EDIT
  // ==========================================================

  function openEditEmployee(
    employee
  ) {
    setViewingEmployee(null);
    setEditingEmployee(employee);
    setShowEmployeeModal(true);
  }


  // ==========================================================
  // OPEN VIEW
  // ==========================================================

  function openViewEmployee(
    employee
  ) {
    setViewingEmployee(employee);
  }


  // ==========================================================
  // CLOSE FORM
  // ==========================================================

  function closeEmployeeModal() {
    setShowEmployeeModal(false);
    setEditingEmployee(null);
  }


  // ==========================================================
  // NO COMPANY
  // ==========================================================

  if (!companyId) {
    return (
      <div className="payroll-page">

        <div className="payroll-empty-company">

          <div className="payroll-empty-icon">
            <Users size={26} />
          </div>

          <h2>
            No Company Selected
          </h2>

          <p>
            Select a company to manage
            payroll employees.
          </p>

        </div>

      </div>
    );
  }


  return (
    <>

      {/* ====================================================
          PAYROLL NAVIGATION
      ==================================================== */}

      <div className="payroll-module-tabs">

        <button
          type="button"
          className={
            activeView === "dashboard"
              ? "payroll-module-tab payroll-module-tab-active"
              : "payroll-module-tab"
          }
          onClick={() =>
            setActiveView(
              "dashboard"
            )
          }
        >
          <BriefcaseBusiness
            size={15}
          />

          Payroll Dashboard
        </button>


        <button
          type="button"
          className={
            activeView === "employees"
              ? "payroll-module-tab payroll-module-tab-active"
              : "payroll-module-tab"
          }
          onClick={() =>
            setActiveView(
              "employees"
            )
          }
        >
          <Users size={15} />

          Employees

          <span className="payroll-module-tab-count">
            {employees.length}
          </span>
        </button>


        
        <button
          type="button"
          className={
            activeView === "setup"
              ? "payroll-module-tab payroll-module-tab-active"
              : "payroll-module-tab"
          }
          onClick={() => setActiveView("setup")}
        >
          <SlidersHorizontal size={15} />
          Payroll Setup
        </button>

<button
          type="button"
          className={
            activeView === "periods"
              ? "payroll-module-tab payroll-module-tab-active"
              : "payroll-module-tab"
          }
          onClick={() =>
            setActiveView(
              "periods"
            )
          }
        >
          <CalendarDays size={15} />

          Payroll Periods

        </button>


        <button
          type="button"
          className={
            activeView === "processing"
              ? "payroll-module-tab payroll-module-tab-active"
              : "payroll-module-tab"
          }
          onClick={() =>
            setActiveView(
              "processing"
            )
          }
        >
          <ClipboardCheck size={15} />

          Payroll Processing

        </button>

      </div>


      {/* ====================================================
          EMPLOYEE VIEW
      ==================================================== */}

      {activeView ===
        "processing" ? (
        <PayrollProcessing />
      ) : activeView ===
        "setup" ? (
        <PayrollSetup />
      ) : activeView ===
        "periods" ? (
        <PayrollPeriods />
      ) : activeView ===
        "employees" ? (
        <EmployeesPage
          employees={employees}
          loading={
            loading || refreshing
          }
          currency={currency}
          companyName={
            companyName
          }
          onRefresh={() =>
            loadEmployees(true)
          }
          onCreate={
            openCreateEmployee
          }
          onEdit={
            openEditEmployee
          }
          onView={
            openViewEmployee
          }
        />
      ) : (
        /* ==================================================
           EXISTING DASHBOARD
           ================================================== */

        <PayrollDashboard
          employees={employees}
          companyId={companyId}
          companyName={companyName}
          currency={currency}
        />
      )}


      {/* ====================================================
          ERROR
      ==================================================== */}

      {error && (
        <div className="payroll-global-error">

          <AlertCircle size={17} />

          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            <X size={15} />
          </button>

        </div>
      )}


      {/* ====================================================
          FORM MODAL
      ==================================================== */}

      <EmployeeFormModal
        open={
          showEmployeeModal
        }
        onClose={
          closeEmployeeModal
        }
        employee={
          editingEmployee
        }
        companyId={
          companyId
        }
        userId={userId}
        onSaved={
          handleSaved
        }
      />


      {/* ====================================================
          DETAILS MODAL
      ==================================================== */}

      <EmployeeDetailsModal
        employee={
          viewingEmployee
        }
        currency={
          currency
        }
        onClose={() =>
          setViewingEmployee(
            null
          )
        }
        onEdit={
          openEditEmployee
        }
      />

    </>
  );
}


// ============================================================
// DASHBOARD
// ============================================================
// This keeps the Payroll dashboard from Step 1 intact while
// allowing the Employees directory to live inside the same
// Payroll sidebar module.
// ============================================================

function PayrollDashboard({
  employees,
  companyId,
  companyName,
  currency,
}) {
  const [periods, setPeriods] =
    useState([]);

  const [records, setRecords] =
    useState([]);

  const [remittances, setRemittances] =
    useState([]);

  const [loading, setLoading] =
    useState(true);


  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);

        const [
          periodsResponse,
          recordsResponse,
          remittancesResponse,
        ] = await Promise.all([
          api.get(
            `/api/payroll/periods/?company=${companyId}`
          ),

          api.get(
            `/api/payroll/records/?company=${companyId}`
          ),

          api.get(
            `/api/payroll/remittances/?company=${companyId}`
          ),
        ]);

        setPeriods(
          extractList(
            periodsResponse
          )
        );

        setRecords(
          extractList(
            recordsResponse
          )
        );

        setRemittances(
          extractList(
            remittancesResponse
          )
        );
      } catch {
        setPeriods([]);
        setRecords([]);
        setRemittances([]);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [companyId]);


  const activeEmployees =
    employees.filter(
      (employee) =>
        employee.employment_status ===
          "ACTIVE" &&
        employee.is_active !==
          false
    );


  const sortedPeriods =
    [...periods].sort(
      (a, b) =>
        new Date(
          b.end_date ||
            b.pay_date ||
            b.start_date ||
            0
        ) -
        new Date(
          a.end_date ||
            a.pay_date ||
            a.start_date ||
            0
        )
    );


  const latestPeriod =
    sortedPeriods[0] || null;


  const latestRecords =
    latestPeriod
      ? records.filter(
          (record) => {
            const periodId =
              record.payroll_period
                ?.id ||
              record.payroll_period_id ||
              record.period_id;

            return (
              String(
                periodId
              ) ===
              String(
                latestPeriod.id
              )
            );
          }
        )
      : [];


  const totals =
    latestRecords.reduce(
      (total, record) => ({
        basic:
          total.basic +
          Number(
            record.basic_salary ||
              0
          ),
        earnings:
          total.earnings +
          Number(
            record.total_earnings ||
              0
          ),
        gross:
          total.gross +
          Number(
            record.gross_pay ||
              0
          ),
        deductions:
          total.deductions +
          Number(
            record.total_deductions ||
              0
          ),
        net:
          total.net +
          Number(
            record.net_pay ||
              0
          ),
        employer:
          total.employer +
          Number(
            record.employer_cost ||
              0
          ),
      }),
      {
        basic: 0,
        earnings: 0,
        gross: 0,
        deductions: 0,
        net: 0,
        employer: 0,
      }
    );


  const statuses = periods.reduce(
    (counts, period) => {
      if (
        period.status ===
        "DRAFT"
      )
        counts.draft += 1;

      if (
        period.status ===
        "PROCESSING"
      )
        counts.processing += 1;

      if (
        period.status ===
        "PROCESSED"
      )
        counts.processed += 1;

      if (
        period.status ===
        "APPROVED"
      )
        counts.approved += 1;

      if (
        period.status ===
        "LOCKED"
      )
        counts.locked += 1;

      return counts;
    },
    {
      draft: 0,
      processing: 0,
      processed: 0,
      approved: 0,
      locked: 0,
    }
  );


  const recentPeriods =
    sortedPeriods.slice(
      0,
      5
    );


  const totalRemittances =
    remittances.reduce(
      (total, remittance) =>
        total +
        Number(
          remittance.amount || 0
        ),
      0
    );


  return (
    <div className="payroll-page">

      {/* HEADER */}

      <div className="payroll-page-header">

        <div>

          <div className="payroll-eyebrow">
            PAYROLL MANAGEMENT
          </div>

          <h1>
            Payroll
          </h1>

          <p>
            Manage employees, payroll
            periods, earnings, deductions
            and payroll processing for your
            company.
          </p>

        </div>

      </div>


      {/* COMPANY */}

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

        <div className="payroll-company-currency">
          <span>
            Currency
          </span>

          <strong>
            {currency}
          </strong>
        </div>

      </div>


      {/* KPIs */}

      <div className="payroll-stat-grid">

        <div className="payroll-stat-card">
          <div className="payroll-stat-icon payroll-stat-icon-blue">
            <Users size={19} />
          </div>

          <div className="payroll-stat-content">
            <span className="payroll-stat-label">
              Active Employees
            </span>

            <strong className="payroll-stat-value">
              {activeEmployees.length}
            </strong>

            <span className="payroll-stat-helper">
              of {employees.length} employee records
            </span>
          </div>
        </div>


        <div className="payroll-stat-card">
          <div className="payroll-stat-icon payroll-stat-icon-gold">
            <CalendarDays size={19} />
          </div>

          <div className="payroll-stat-content">
            <span className="payroll-stat-label">
              Payroll Periods
            </span>

            <strong className="payroll-stat-value">
              {periods.length}
            </strong>

            <span className="payroll-stat-helper">
              {statuses.draft} draft periods
            </span>
          </div>
        </div>


        <div className="payroll-stat-card">
          <div className="payroll-stat-icon payroll-stat-icon-navy">
            <BriefcaseBusiness size={19} />
          </div>

          <div className="payroll-stat-content">
            <span className="payroll-stat-label">
              Latest Gross Payroll
            </span>

            <strong className="payroll-stat-value">
              {formatMoney(
                totals.gross,
                currency
              )}
            </strong>

            <span className="payroll-stat-helper">
              {latestPeriod?.name ||
                "No payroll period"}
            </span>
          </div>
        </div>


        <div className="payroll-stat-card">
          <div className="payroll-stat-icon payroll-stat-icon-blue">
            <UserRound size={19} />
          </div>

          <div className="payroll-stat-content">
            <span className="payroll-stat-label">
              Latest Net Payroll
            </span>

            <strong className="payroll-stat-value">
              {formatMoney(
                totals.net,
                currency
              )}
            </strong>

            <span className="payroll-stat-helper">
              {latestRecords.length} payroll records
            </span>
          </div>
        </div>

      </div>


      {/* MAIN GRID */}

      <div className="payroll-dashboard-grid">

        <section className="payroll-panel payroll-latest-panel">

          <div className="payroll-panel-header">

            <div>

              <div className="payroll-section-label">
                CURRENT PAYROLL
              </div>

              <h2>
                {latestPeriod?.name ||
                  "No Payroll Period"}
              </h2>

              {latestPeriod && (
                <p>
                  {formatDate(
                    latestPeriod.start_date
                  )}{" "}
                  —{" "}
                  {formatDate(
                    latestPeriod.end_date
                  )}
                </p>
              )}

            </div>

            {latestPeriod && (
              <span
                className={getDashboardStatusClass(
                  latestPeriod.status
                )}
              >
                {getDashboardStatusLabel(
                  latestPeriod.status
                )}
              </span>
            )}

          </div>


          {loading ? (
            <div className="payroll-loading">
              <RefreshCw
                size={22}
                className="payroll-spin"
              />

              <span>
                Loading payroll information...
              </span>
            </div>
          ) : !latestPeriod ? (
            <div className="payroll-empty-state">
              <div className="payroll-empty-icon">
                <CalendarDays size={24} />
              </div>

              <h3>
                No payroll periods yet
              </h3>

              <p>
                Create a payroll period to begin
                processing employee payroll.
              </p>
            </div>
          ) : (
            <>
              <div className="payroll-financial-grid">

                <div>
                  <span>
                    Basic Salary
                  </span>

                  <strong>
                    {formatMoney(
                      totals.basic,
                      currency
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Total Earnings
                  </span>

                  <strong>
                    {formatMoney(
                      totals.earnings,
                      currency
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Gross Pay
                  </span>

                  <strong>
                    {formatMoney(
                      totals.gross,
                      currency
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Total Deductions
                  </span>

                  <strong>
                    {formatMoney(
                      totals.deductions,
                      currency
                    )}
                  </strong>
                </div>

                <div className="payroll-financial-highlight">
                  <span>
                    Net Pay
                  </span>

                  <strong>
                    {formatMoney(
                      totals.net,
                      currency
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Employer Cost
                  </span>

                  <strong>
                    {formatMoney(
                      totals.employer,
                      currency
                    )}
                  </strong>
                </div>

              </div>


              <div className="payroll-period-meta">

                <div>
                  <span>
                    Pay Date
                  </span>

                  <strong>
                    {formatDate(
                      latestPeriod.pay_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Employees Processed
                  </span>

                  <strong>
                    {latestRecords.length}
                  </strong>
                </div>

                <div>
                  <span>
                    Period Status
                  </span>

                  <strong>
                    {getDashboardStatusLabel(
                      latestPeriod.status
                    )}
                  </strong>
                </div>

              </div>
            </>
          )}

        </section>


        <section className="payroll-panel">

          <div className="payroll-panel-header">

            <div>

              <div className="payroll-section-label">
                PAYROLL PIPELINE
              </div>

              <h2>
                Processing Status
              </h2>

              <p>
                Overview of payroll periods by
                workflow status.
              </p>

            </div>

          </div>


          <div className="payroll-status-list">

            {[
              ["DRAFT", "Draft", statuses.draft],
              [
                "PROCESSING",
                "Processing",
                statuses.processing,
              ],
              [
                "PROCESSED",
                "Processed",
                statuses.processed,
              ],
              [
                "APPROVED",
                "Approved",
                statuses.approved,
              ],
              [
                "LOCKED",
                "Locked",
                statuses.locked,
              ],
            ].map(
              (item) => (
                <div
                  className="payroll-status-row"
                  key={item[0]}
                >

                  <div>
                    <span
                      className={`payroll-status-dot payroll-dot-${item[0].toLowerCase()}`}
                    />

                    <strong>
                      {item[1]}
                    </strong>
                  </div>

                  <b>
                    {item[2]}
                  </b>

                </div>
              )
            )}

          </div>

        </section>

      </div>


      {/* RECENT PERIODS */}

      <section className="payroll-panel payroll-periods-panel">

        <div className="payroll-panel-header">

          <div>

            <div className="payroll-section-label">
              PAYROLL HISTORY
            </div>

            <h2>
              Recent Payroll Periods
            </h2>

            <p>
              Recent payroll runs and their
              current processing status.
            </p>

          </div>

          <div className="payroll-record-count">
            {periods.length} period
            {periods.length === 1
              ? ""
              : "s"}
          </div>

        </div>


        {recentPeriods.length ===
        0 ? (
          <div className="payroll-empty-state">
            <div className="payroll-empty-icon">
              <CalendarDays size={24} />
            </div>

            <h3>
              No payroll history
            </h3>

            <p>
              Payroll periods will appear here
              once they are created.
            </p>
          </div>
        ) : (
          <div className="payroll-table-wrapper">

            <table className="payroll-table">

              <thead>
                <tr>
                  <th>
                    Payroll Period
                  </th>

                  <th>
                    Period
                  </th>

                  <th>
                    Pay Date
                  </th>

                  <th>
                    Employees
                  </th>

                  <th>
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>

                {recentPeriods.map(
                  (period) => {

                    const periodRecords =
                      records.filter(
                        (record) => {
                          const periodId =
                            record.payroll_period
                              ?.id ||
                            record.payroll_period_id ||
                            record.period_id;

                          return (
                            String(
                              periodId
                            ) ===
                            String(
                              period.id
                            )
                          );
                        }
                      );

                    return (
                      <tr
                        key={
                          period.id
                        }
                      >

                        <td>

                          <div className="payroll-period-name">

                            <div className="payroll-period-icon">
                              <CalendarDays
                                size={16}
                              />
                            </div>

                            <div>

                              <strong>
                                {period.name ||
                                  `Payroll Period #${period.id}`}
                              </strong>

                              <span>
                                Payroll #
                                {
                                  period.id
                                }
                              </span>

                            </div>

                          </div>

                        </td>

                        <td>
                          {formatDate(
                            period.start_date
                          )}{" "}
                          —{" "}
                          {formatDate(
                            period.end_date
                          )}
                        </td>

                        <td>
                          {formatDate(
                            period.pay_date
                          )}
                        </td>

                        <td>
                          {
                            periodRecords.length
                          }
                        </td>

                        <td>
                          <span
                            className={getDashboardStatusClass(
                              period.status
                            )}
                          >
                            {getDashboardStatusLabel(
                              period.status
                            )}
                          </span>
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


      {/* SUMMARY */}

      <div className="payroll-summary-grid">

        <div className="payroll-summary-card">

          <div className="payroll-summary-icon">
            <Users size={18} />
          </div>

          <div>
            <span>
              Employee Records
            </span>

            <strong>
              {employees.length}
            </strong>

            <p>
              {activeEmployees.length} currently active
            </p>
          </div>

        </div>


        <div className="payroll-summary-card">

          <div className="payroll-summary-icon">
            <BriefcaseBusiness size={18} />
          </div>

          <div>
            <span>
              Payroll Records
            </span>

            <strong>
              {records.length}
            </strong>

            <p>
              Calculated employee payroll records
            </p>
          </div>

        </div>


        <div className="payroll-summary-card">

          <div className="payroll-summary-icon">
            <CheckCircle2 size={18} />
          </div>

          <div>
            <span>
              Approved Periods
            </span>

            <strong>
              {statuses.approved}
            </strong>

            <p>
              Ready for payroll locking
            </p>
          </div>

        </div>


        <div className="payroll-summary-card">

          <div className="payroll-summary-icon">
            <CalendarDays size={18} />
          </div>

          <div>
            <span>
              Locked Periods
            </span>

            <strong>
              {statuses.locked}
            </strong>

            <p>
              Finalized payroll periods
            </p>
          </div>

        </div>

      </div>


      {/* REMITTANCES */}

      <div className="payroll-remittance-strip">

        <div className="payroll-remittance-icon">
          <BriefcaseBusiness size={19} />
        </div>

        <div>
          <span>
            PAYROLL REMITTANCES
          </span>

          <strong>
            {formatMoney(
              totalRemittances,
              currency
            )}
          </strong>
        </div>

        <div className="payroll-remittance-meta">
          {remittances.length} remittance
          {remittances.length === 1
            ? ""
            : "s"} recorded
        </div>

      </div>

    </div>
  );
}


// ============================================================
// DASHBOARD STATUS HELPERS
// ============================================================

function getDashboardStatusLabel(
  status
) {
  const labels = {
    DRAFT: "Draft",
    PROCESSING: "Processing",
    PROCESSED: "Processed",
    APPROVED: "Approved",
    LOCKED: "Locked",
  };

  return (
    labels[status] ||
    status ||
    "Unknown"
  );
}


function getDashboardStatusClass(
  status
) {
  switch (status) {
    case "LOCKED":
      return "payroll-status payroll-status-locked";

    case "APPROVED":
      return "payroll-status payroll-status-approved";

    case "PROCESSED":
      return "payroll-status payroll-status-processed";

    case "PROCESSING":
      return "payroll-status payroll-status-processing";

    case "DRAFT":
    default:
      return "payroll-status payroll-status-draft";
  }
}