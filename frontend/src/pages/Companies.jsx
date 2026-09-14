import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Edit3,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api } from "../services/api";
import { useCompany } from "../context/CompanyContext";


const BUSINESS_TYPES = [
  {
    value: "HOLDING",
    label: "Holding / Parent Company",
  },
  {
    value: "RETAIL",
    label: "Retail / Trading",
  },
  {
    value: "GAS_STATION",
    label: "Gas Station",
  },
  {
    value: "PROFESSIONAL_SERVICES",
    label: "Professional Services",
  },
  {
    value: "HR_CONSULTING",
    label: "HR / Consulting",
  },
  {
    value: "HEALTHCARE",
    label: "Laboratory / Healthcare",
  },
  {
    value: "OTHER",
    label: "Other",
  },
];


const CURRENCIES = [
  {
    value: "USD",
    label: "US Dollar (USD)",
  },
  {
    value: "LRD",
    label: "Liberian Dollar (LRD)",
  },
];


const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];


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


function getBusinessTypeLabel(value) {
  return (
    BUSINESS_TYPES.find(
      (item) => item.value === value
    )?.label ||
    value ||
    "Other"
  );
}


function getCurrencyLabel(value) {
  return (
    CURRENCIES.find(
      (item) => item.value === value
    )?.label ||
    value ||
    "USD"
  );
}


function getMonthLabel(value) {
  return (
    MONTHS.find(
      (item) =>
        Number(item.value) === Number(value)
    )?.label ||
    "January"
  );
}


function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}


function getInitials(name) {
  if (!name) {
    return "C";
  }

  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) {
    return words[0]
      .substring(0, 2)
      .toUpperCase();
  }

  return (
    words[0].charAt(0) +
    words[1].charAt(0)
  ).toUpperCase();
}


function getErrorMessage(error) {
  const data = error?.data;

  if (!data) {
    return (
      error?.message ||
      "Something went wrong. Please try again."
    );
  }

  if (typeof data === "string") {
    return data;
  }

  if (data.detail) {
    return data.detail;
  }

  if (data.message) {
    return data.message;
  }

  const firstField = Object.keys(data)[0];

  if (firstField) {
    const value = data[firstField];

    if (Array.isArray(value)) {
      return `${firstField}: ${value.join(", ")}`;
    }

    if (typeof value === "string") {
      return `${firstField}: ${value}`;
    }
  }

  return (
    error?.message ||
    "Something went wrong. Please try again."
  );
}


function emptyForm() {
  return {
    name: "",
    legal_name: "",
    business_type: "OTHER",
    registration_number: "",
    address: "",
    phone: "",
    email: "",
    currency: "USD",
    fiscal_year_start_month: 1,
    is_active: true,
  };
}


function CompanyAvatar({
  company,
  large = false,
}) {
  return (
    <div
      className={
        large
          ? "company-page-avatar company-page-avatar-large"
          : "company-page-avatar"
      }
    >
      {getInitials(company?.name)}
    </div>
  );
}


function StatusBadge({
  active,
}) {
  return (
    <span
      className={
        active
          ? "company-status company-status-active"
          : "company-status company-status-inactive"
      }
    >
      <span className="company-status-dot" />

      {active
        ? "Active"
        : "Inactive"}
    </span>
  );
}


function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = "",
}) {
  return (
    <div
      className={`companies-summary-card ${
        tone
          ? `companies-summary-card-${tone}`
          : ""
      }`}
    >
      <div className="companies-summary-icon">
        <Icon size={19} />
      </div>

      <div>
        <span className="companies-summary-label">
          {label}
        </span>

        <strong className="companies-summary-value">
          {value}
        </strong>
      </div>
    </div>
  );
}


function CompanyModal({
  open,
  mode,
  form,
  saving,
  error,
  onClose,
  onChange,
  onSubmit,
}) {
  if (!open) {
    return null;
  }

  const isEdit = mode === "edit";

  return (
    <div
      className="company-modal-overlay"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving
        ) {
          onClose();
        }
      }}
    >
      <div className="company-modal">

        <div className="company-modal-header">

          <div>
            <div className="company-modal-eyebrow">
              {isEdit
                ? "COMPANY SETTINGS"
                : "NEW COMPANY"}
            </div>

            <h2>
              {isEdit
                ? "Edit company"
                : "Create a company"}
            </h2>

            <p>
              {isEdit
                ? "Update the company information used throughout Hindsfeet Accounting."
                : "Set up a company and its accounting profile."}
            </p>
          </div>

          <button
            type="button"
            className="company-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <X size={20} />
          </button>

        </div>


        {error && (
          <div className="company-form-error">
            <CircleAlert size={17} />
            <span>{error}</span>
          </div>
        )}


        <form
          className="company-form"
          onSubmit={onSubmit}
        >

          {/* ==================================================
              BASIC INFORMATION
              ================================================== */}

          <div className="company-form-section">

            <div className="company-form-section-heading">
              <Building2 size={17} />

              <div>
                <h3>
                  Basic information
                </h3>

                <p>
                  Identify the company and its business activity.
                </p>
              </div>
            </div>


            <div className="company-form-grid">

              <label className="company-form-field company-form-field-full">

                <span>
                  Company name
                  <b>*</b>
                </span>

                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    onChange(
                      "name",
                      event.target.value
                    )
                  }
                  placeholder="e.g. Conex Gas Station - Tarr Town"
                  required
                  disabled={saving}
                />

              </label>


              <label className="company-form-field">

                <span>
                  Legal name
                </span>

                <input
                  type="text"
                  value={form.legal_name}
                  onChange={(event) =>
                    onChange(
                      "legal_name",
                      event.target.value
                    )
                  }
                  placeholder="Registered legal name"
                  disabled={saving}
                />

              </label>


              <label className="company-form-field">

                <span>
                  Business type
                  <b>*</b>
                </span>

                <div className="company-select-wrapper">

                  <select
                    value={form.business_type}
                    onChange={(event) =>
                      onChange(
                        "business_type",
                        event.target.value
                      )
                    }
                    required
                    disabled={saving}
                  >
                    {BUSINESS_TYPES.map(
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

                  <ChevronDown
                    size={16}
                  />

                </div>

              </label>


              <label className="company-form-field">

                <span>
                  Registration number
                </span>

                <input
                  type="text"
                  value={
                    form.registration_number
                  }
                  onChange={(event) =>
                    onChange(
                      "registration_number",
                      event.target.value
                    )
                  }
                  placeholder="Business registration number"
                  disabled={saving}
                />

              </label>

            </div>

          </div>


          {/* ==================================================
              CONTACT INFORMATION
              ================================================== */}

          <div className="company-form-section">

            <div className="company-form-section-heading">
              <MapPin size={17} />

              <div>
                <h3>
                  Contact information
                </h3>

                <p>
                  Contact details for this company.
                </p>
              </div>
            </div>


            <div className="company-form-grid">

              <label className="company-form-field company-form-field-full">

                <span>
                  Address
                </span>

                <textarea
                  value={form.address}
                  onChange={(event) =>
                    onChange(
                      "address",
                      event.target.value
                    )
                  }
                  placeholder="Company address"
                  rows={3}
                  disabled={saving}
                />

              </label>


              <label className="company-form-field">

                <span>
                  Phone
                </span>

                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) =>
                    onChange(
                      "phone",
                      event.target.value
                    )
                  }
                  placeholder="+231 ..."
                  disabled={saving}
                />

              </label>


              <label className="company-form-field">

                <span>
                  Email
                </span>

                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    onChange(
                      "email",
                      event.target.value
                    )
                  }
                  placeholder="company@example.com"
                  disabled={saving}
                />

              </label>

            </div>

          </div>


          {/* ==================================================
              ACCOUNTING SETTINGS
              ================================================== */}

          <div className="company-form-section">

            <div className="company-form-section-heading">
              <ShieldCheck size={17} />

              <div>
                <h3>
                  Accounting settings
                </h3>

                <p>
                  These settings affect the company's financial records and reporting.
                </p>
              </div>
            </div>


            <div className="company-form-grid">

              <label className="company-form-field">

                <span>
                  Currency
                  <b>*</b>
                </span>

                <div className="company-select-wrapper">

                  <select
                    value={form.currency}
                    onChange={(event) =>
                      onChange(
                        "currency",
                        event.target.value
                      )
                    }
                    required
                    disabled={saving}
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

                  <ChevronDown
                    size={16}
                  />

                </div>

              </label>


              <label className="company-form-field">

                <span>
                  Fiscal year starts
                  <b>*</b>
                </span>

                <div className="company-select-wrapper">

                  <select
                    value={
                      form.fiscal_year_start_month
                    }
                    onChange={(event) =>
                      onChange(
                        "fiscal_year_start_month",
                        Number(
                          event.target.value
                        )
                      )
                    }
                    required
                    disabled={saving}
                  >
                    {MONTHS.map(
                      (month) => (
                        <option
                          key={month.value}
                          value={month.value}
                        >
                          {month.label}
                        </option>
                      )
                    )}
                  </select>

                  <ChevronDown
                    size={16}
                  />

                </div>

              </label>


              <div className="company-active-setting">

                <div>
                  <strong>
                    Company status
                  </strong>

                  <span>
                    Inactive companies are not shown in the company selector.
                  </span>
                </div>

                <button
                  type="button"
                  className={
                    form.is_active
                      ? "company-toggle company-toggle-active"
                      : "company-toggle"
                  }
                  onClick={() =>
                    onChange(
                      "is_active",
                      !form.is_active
                    )
                  }
                  disabled={saving}
                  aria-pressed={
                    form.is_active
                  }
                >
                  <span />

                  {form.is_active
                    ? "Active"
                    : "Inactive"}
                </button>

              </div>

            </div>

          </div>


          {/* ==================================================
              FOOTER
              ================================================== */}

          <div className="company-modal-footer">

            <button
              type="button"
              className="company-secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="company-primary-button"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="company-button-spinner" />
                  Saving...
                </>
              ) : (
                <>
                  {isEdit ? (
                    <CheckCircle2
                      size={17}
                    />
                  ) : (
                    <Plus size={18} />
                  )}

                  {isEdit
                    ? "Save changes"
                    : "Create company"}
                </>
              )}
            </button>

          </div>

        </form>

      </div>
    </div>
  );
}


export default function Companies() {

  const {
    currentCompany,
    selectCompany,
  } = useCompany();


  const [companies, setCompanies] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState(null);

  const [formError, setFormError] =
    useState(null);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [businessFilter, setBusinessFilter] =
    useState("all");

  const [modalOpen, setModalOpen] =
    useState(false);

  const [modalMode, setModalMode] =
    useState("create");

  const [editingCompany, setEditingCompany] =
    useState(null);

  const [form, setForm] =
    useState(emptyForm);


  // ==========================================================
  // LOAD COMPANIES
  // ==========================================================

  const loadCompanies = useCallback(
    async () => {

      setLoading(true);
      setError(null);

      try {

        const data =
          await api.get(
            "/api/companies/"
          );

        setCompanies(
          extractList(data)
        );

      } catch (err) {

        console.error(
          "Companies loading error:",
          err
        );

        setError(
          getErrorMessage(err)
        );

      } finally {

        setLoading(false);

      }

    },
    []
  );


  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);


  // ==========================================================
  // FILTERED COMPANIES
  // ==========================================================

  const filteredCompanies =
    useMemo(() => {

      const searchTerm =
        search.trim().toLowerCase();

      return companies.filter(
        (company) => {

          const matchesSearch =
            !searchTerm ||
            [
              company.name,
              company.legal_name,
              company.business_type,
              company.registration_number,
              company.email,
              company.phone,
            ]
              .filter(Boolean)
              .some((value) =>
                String(value)
                  .toLowerCase()
                  .includes(searchTerm)
              );


          const matchesStatus =
            statusFilter === "all" ||
            (
              statusFilter === "active" &&
              company.is_active
            ) ||
            (
              statusFilter === "inactive" &&
              !company.is_active
            );


          const matchesBusiness =
            businessFilter === "all" ||
            company.business_type ===
              businessFilter;


          return (
            matchesSearch &&
            matchesStatus &&
            matchesBusiness
          );

        }
      );

    }, [
      companies,
      search,
      statusFilter,
      businessFilter,
    ]);


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const activeCompanies =
    companies.filter(
      (company) =>
        company.is_active
    ).length;


  const inactiveCompanies =
    companies.filter(
      (company) =>
        !company.is_active
    ).length;


  const gasStationCount =
    companies.filter(
      (company) =>
        company.business_type ===
        "GAS_STATION"
    ).length;


  // ==========================================================
  // FORM
  // ==========================================================

  function openCreateModal() {

    setModalMode("create");
    setEditingCompany(null);
    setForm(emptyForm());
    setFormError(null);
    setModalOpen(true);

  }


  function openEditModal(company) {

    setModalMode("edit");
    setEditingCompany(company);

    setForm({
      name:
        company.name || "",

      legal_name:
        company.legal_name || "",

      business_type:
        company.business_type ||
        "OTHER",

      registration_number:
        company.registration_number ||
        "",

      address:
        company.address || "",

      phone:
        company.phone || "",

      email:
        company.email || "",

      currency:
        company.currency || "USD",

      fiscal_year_start_month:
        Number(
          company.fiscal_year_start_month ||
          1
        ),

      is_active:
        Boolean(
          company.is_active
        ),
    });

    setFormError(null);
    setModalOpen(true);

  }


  function closeModal() {

    if (saving) {
      return;
    }

    setModalOpen(false);
    setEditingCompany(null);
    setFormError(null);

  }


  function handleFormChange(
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

    setSaving(true);
    setFormError(null);


    const payload = {
      name:
        form.name.trim(),

      legal_name:
        form.legal_name.trim(),

      business_type:
        form.business_type,

      registration_number:
        form.registration_number.trim(),

      address:
        form.address.trim(),

      phone:
        form.phone.trim(),

      email:
        form.email.trim(),

      currency:
        form.currency,

      fiscal_year_start_month:
        Number(
          form.fiscal_year_start_month
        ),

      is_active:
        Boolean(
          form.is_active
        ),
    };


    try {

      let savedCompany;


      if (
        modalMode === "edit" &&
        editingCompany
      ) {

        savedCompany =
          await api.patch(
            `/api/companies/${editingCompany.id}/`,
            payload
          );

      } else {

        savedCompany =
          await api.post(
            "/api/companies/",
            payload
          );

      }


      setCompanies(
        (current) => {

          if (
            modalMode === "edit"
          ) {

            return current.map(
              (company) =>
                company.id ===
                savedCompany.id
                  ? savedCompany
                  : company
            );

          }

          return [
            savedCompany,
            ...current,
          ];

        }
      );


      setModalOpen(false);
      setEditingCompany(null);
      setFormError(null);


      /*
       * If the user edited the company that is
       * currently selected, update the company
       * context as well.
       */
      if (
        currentCompany?.id ===
        savedCompany?.id
      ) {
        selectCompany(
          savedCompany
        );
      }


    } catch (err) {

      console.error(
        "Company save error:",
        err
      );

      setFormError(
        getErrorMessage(err)
      );

    } finally {

      setSaving(false);

    }

  }


  // ==========================================================
  // SELECT COMPANY
  // ==========================================================

  function handleSelectCompany(
    company
  ) {

    if (!company?.is_active) {
      return;
    }

    selectCompany(company);

  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="companies-page">

      {/* ====================================================
          PAGE HEADER
          ==================================================== */}

      <div className="companies-page-header">

        <div>

          <div className="companies-eyebrow">
            ORGANIZATION
          </div>

          <h1>
            Companies
          </h1>

          <p>
            Manage your companies and their
            accounting profiles from one place.
          </p>

        </div>


        <button
          type="button"
          className="company-primary-button companies-add-button"
          onClick={openCreateModal}
        >
          <Plus size={18} />
          Add Company
        </button>

      </div>


      {/* ====================================================
          SUMMARY
          ==================================================== */}

      <div className="companies-summary-grid">

        <SummaryCard
          icon={Building2}
          label="Total companies"
          value={companies.length}
        />

        <SummaryCard
          icon={CheckCircle2}
          label="Active companies"
          value={activeCompanies}
          tone="success"
        />

        <SummaryCard
          icon={ShieldCheck}
          label="Inactive companies"
          value={inactiveCompanies}
          tone="neutral"
        />

        <SummaryCard
          icon={BriefcaseBusiness}
          label="Gas station businesses"
          value={gasStationCount}
          tone="gold"
        />

      </div>


      {/* ====================================================
          ERROR
          ==================================================== */}

      {error && (
        <div className="companies-page-error">

          <CircleAlert size={18} />

          <div>
            <strong>
              Unable to load companies
            </strong>

            <span>
              {error}
            </span>
          </div>

          <button
            type="button"
            onClick={loadCompanies}
          >
            Try Again
          </button>

        </div>
      )}


      {/* ====================================================
          FILTERS
          ==================================================== */}

      <div className="companies-toolbar">

        <div className="companies-search">

          <Search size={18} />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search companies..."
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


        <div className="companies-filter-group">

          <div className="companies-filter-select">

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
            >
              <option value="all">
                All statuses
              </option>

              <option value="active">
                Active
              </option>

              <option value="inactive">
                Inactive
              </option>
            </select>

            <ChevronDown size={15} />

          </div>


          <div className="companies-filter-select">

            <select
              value={businessFilter}
              onChange={(event) =>
                setBusinessFilter(
                  event.target.value
                )
              }
            >
              <option value="all">
                All business types
              </option>

              {BUSINESS_TYPES.map(
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

            <ChevronDown size={15} />

          </div>

        </div>

      </div>


      {/* ====================================================
          COMPANY TABLE
          ==================================================== */}

      <section className="companies-table-card">

        <div className="companies-table-header">

          <div>
            <h2>
              Your companies
            </h2>

            <p>
              {filteredCompanies.length}{" "}
              {filteredCompanies.length === 1
                ? "company"
                : "companies"}{" "}
              shown
            </p>
          </div>

        </div>


        {loading ? (

          <div className="companies-loading">

            <div className="companies-loading-spinner" />

            <h3>
              Loading companies...
            </h3>

            <p>
              Retrieving your company information.
            </p>

          </div>

        ) : filteredCompanies.length === 0 ? (

          <div className="companies-empty">

            <div className="companies-empty-icon">
              <Building2 size={25} />
            </div>

            <h3>
              {companies.length === 0
                ? "No companies yet"
                : "No companies found"}
            </h3>

            <p>
              {companies.length === 0
                ? "Create your first company to start managing its financial records."
                : "Try adjusting your search or filters."}
            </p>

            {companies.length === 0 && (
              <button
                type="button"
                className="company-primary-button"
                onClick={openCreateModal}
              >
                <Plus size={17} />
                Create Company
              </button>
            )}

          </div>

        ) : (

          <div className="companies-table-wrapper">

            <table className="companies-table">

              <thead>
                <tr>
                  <th>
                    Company
                  </th>

                  <th>
                    Business type
                  </th>

                  <th>
                    Currency
                  </th>

                  <th>
                    Fiscal year
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Created
                  </th>

                  <th className="companies-action-column">
                    Action
                  </th>
                </tr>
              </thead>


              <tbody>

                {filteredCompanies.map(
                  (company) => {

                    const isCurrent =
                      currentCompany?.id ===
                      company.id;

                    return (
                      <tr
                        key={company.id}
                        className={
                          isCurrent
                            ? "company-row-current"
                            : ""
                        }
                      >

                        <td>

                          <div className="company-table-company">

                            <CompanyAvatar
                              company={
                                company
                              }
                            />

                            <div>

                              <div className="company-table-name-row">

                                <strong>
                                  {company.name}
                                </strong>

                                {isCurrent && (
                                  <span className="company-current-badge">
                                    Current
                                  </span>
                                )}

                              </div>

                              <span>
                                {company.legal_name ||
                                  company.registration_number ||
                                  `Company #${company.id}`}
                              </span>

                            </div>

                          </div>

                        </td>


                        <td>

                          <span className="company-business-type">
                            {getBusinessTypeLabel(
                              company.business_type
                            )}
                          </span>

                        </td>


                        <td>

                          <span className="company-currency-badge">
                            {company.currency ||
                              "USD"}
                          </span>

                        </td>


                        <td>

                          <div className="company-fiscal-year">

                            <CalendarDays
                              size={15}
                            />

                            <span>
                              {getMonthLabel(
                                company.fiscal_year_start_month
                              )}
                            </span>

                          </div>

                        </td>


                        <td>

                          <StatusBadge
                            active={
                              company.is_active
                            }
                          />

                        </td>


                        <td>

                          <span className="company-created-date">
                            {formatDate(
                              company.created_at
                            )}
                          </span>

                        </td>


                        <td>

                          <div className="company-table-actions">

                            {company.is_active && (
                              <button
                                type="button"
                                className={
                                  isCurrent
                                    ? "company-select-current"
                                    : "company-select-button"
                                }
                                onClick={() =>
                                  handleSelectCompany(
                                    company
                                  )
                                }
                              >
                                {isCurrent
                                  ? "Selected"
                                  : "Select"}
                              </button>
                            )}

                            <button
                              type="button"
                              className="company-edit-button"
                              onClick={() =>
                                openEditModal(
                                  company
                                )
                              }
                              aria-label={`Edit ${company.name}`}
                            >
                              <Edit3
                                size={16}
                              />
                            </button>

                          </div>

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


      {/* ====================================================
          COMPANY DETAIL CARDS
          ==================================================== */}

      {filteredCompanies.length > 0 && (
        <div className="companies-detail-grid">

          {filteredCompanies
            .slice(0, 3)
            .map((company) => (

              <div
                key={`detail-${company.id}`}
                className={
                  currentCompany?.id ===
                  company.id
                    ? "company-detail-card company-detail-card-current"
                    : "company-detail-card"
                }
              >

                <div className="company-detail-top">

                  <div className="company-detail-identity">

                    <CompanyAvatar
                      company={company}
                      large
                    />

                    <div>

                      <span className="company-detail-label">
                        Company
                      </span>

                      <h3>
                        {company.name}
                      </h3>

                    </div>

                  </div>

                  <StatusBadge
                    active={
                      company.is_active
                    }
                  />

                </div>


                <div className="company-detail-business">

                  <BriefcaseBusiness
                    size={15}
                  />

                  <span>
                    {getBusinessTypeLabel(
                      company.business_type
                    )}
                  </span>

                </div>


                <div className="company-detail-contact">

                  {company.address && (
                    <div>
                      <MapPin size={15} />
                      <span>
                        {company.address}
                      </span>
                    </div>
                  )}

                  {company.phone && (
                    <div>
                      <Phone size={15} />
                      <span>
                        {company.phone}
                      </span>
                    </div>
                  )}

                  {company.email && (
                    <div>
                      <Mail size={15} />
                      <span>
                        {company.email}
                      </span>
                    </div>
                  )}

                  {!company.address &&
                    !company.phone &&
                    !company.email && (
                      <div>
                        <Globe2 size={15} />
                        <span>
                          No contact information
                        </span>
                      </div>
                    )}

                </div>


                <div className="company-detail-footer">

                  <div>

                    <span>
                      Currency
                    </span>

                    <strong>
                      {getCurrencyLabel(
                        company.currency
                      )}
                    </strong>

                  </div>


                  <div>

                    <span>
                      Fiscal year
                    </span>

                    <strong>
                      {getMonthLabel(
                        company.fiscal_year_start_month
                      )}
                    </strong>

                  </div>


                  <button
                    type="button"
                    className="company-detail-edit"
                    onClick={() =>
                      openEditModal(
                        company
                      )
                    }
                  >
                    <Edit3 size={15} />
                    Edit
                  </button>

                </div>

              </div>

            ))}

        </div>
      )}


      {/* ====================================================
          MODAL
          ==================================================== */}

      <CompanyModal
        open={modalOpen}
        mode={modalMode}
        form={form}
        saving={saving}
        error={formError}
        onClose={closeModal}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
      />

    </div>
  );
}