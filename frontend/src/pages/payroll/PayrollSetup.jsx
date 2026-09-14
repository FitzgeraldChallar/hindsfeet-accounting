import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  CalendarDays,
  Calculator,
  CheckCircle2,
  Clock3,
  Info,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";

function list(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.results)) return response.results;
  return [];
}

function nameOf(employee) {
  if (!employee) return "Unknown Employee";

  if (employee.full_name) {
    return employee.full_name;
  }

  return (
    [
      employee.first_name,
      employee.middle_name,
      employee.last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || "Unknown Employee"
  );
}

function money(value, currency) {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))} ${currency}`;
}

function numberValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function dateLabel(value) {
  if (!value) return "—";

  const d = new Date(`${value}T00:00:00`);

  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

function errorText(error) {
  const data = error?.data;

  if (data?.detail) return data.detail;
  if (data?.message) return data.message;

  if (data && typeof data === "object") {
    return Object.entries(data)
      .map(([key, value]) => {
        const formatted = Array.isArray(value)
          ? value.join(", ")
          : typeof value === "object"
          ? JSON.stringify(value)
          : value;

        return `${key}: ${formatted}`;
      })
      .join(" ");
  }

  return (
    error?.message ||
    "The payroll setup action could not be completed."
  );
}

function typeName(item, field, resolvedType = null) {
  const value = item?.[field];

  if (value && typeof value === "object") {
    return value.name || value.code || "Unknown";
  }

  return (
    resolvedType?.name ||
    resolvedType?.code ||
    item?.[`${field}_name`] ||
    item?.[`${field}_code`] ||
    "Unknown"
  );
}

function typeId(item, field) {
  const value = item?.[field];

  return value && typeof value === "object"
    ? value.id
    : value;
}

function typeInfo(type) {
  return type?.calculation_type === "PERCENTAGE"
    ? "Percentage of monthly basic salary"
    : "Fixed monetary amount";
}

function statusLabel(status) {
  if (!status) return "Unknown";

  return String(status)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function statusClass(status) {
  switch (status) {
    case "DRAFT":
      return "payroll-setup-status payroll-setup-status-draft";

    case "PROCESSING":
      return "payroll-setup-status payroll-setup-status-processing";

    case "PROCESSED":
      return "payroll-setup-status payroll-setup-status-processed";

    case "APPROVED":
      return "payroll-setup-status payroll-setup-status-approved";

    case "LOCKED":
      return "payroll-setup-status payroll-setup-status-locked";

    default:
      return "payroll-setup-status";
  }
}

function getEmployeeId(item) {
  if (!item) return null;

  return typeof item.employee === "object"
    ? item.employee?.id
    : item.employee;
}

function getPeriodId(item) {
  if (!item) return null;

  return typeof item.payroll_period === "object"
    ? item.payroll_period?.id
    : item.payroll_period;
}

function getAbsenceEmployeeId(absence) {
  if (!absence) return null;

  return typeof absence.employee === "object"
    ? absence.employee?.id
    : absence.employee;
}

function getAbsencePeriodId(absence) {
  if (!absence) return null;

  return typeof absence.payroll_period === "object"
    ? absence.payroll_period?.id
    : absence.payroll_period;
}

function isAutomaticDeduction(type) {
  const code = String(
    type?.code || ""
  ).toUpperCase();

  return (
    code === "PAYE" ||
    code === "NASSCORP" ||
    code === "ABSENCE"
  );
}

export default function PayrollSetup() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;

  const currency =
    currentCompany?.currency ||
    currentCompany?.currency_code ||
    "USD";

  const companyName =
    currentCompany?.name || "No company selected";

  const [employees, setEmployees] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [earningTypes, setEarningTypes] = useState([]);
  const [deductionTypes, setDeductionTypes] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [absences, setAbsences] = useState([]);

  const [periodId, setPeriodId] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  const [kind, setKind] = useState("earning");

  const [form, setForm] = useState({
    earning_type: "",
    deduction_type: "",
    amount: "",
    description: "",
    is_taxable: true,
  });

  const [absenceForm, setAbsenceForm] = useState({
    days_absent: "",
    reason: "",
  });

  const [typeModal, setTypeModal] = useState(false);
  const [typeKind, setTypeKind] = useState("earning");

  const [typeForm, setTypeForm] = useState({
    name: "",
    code: "",
    calculation_type: "FIXED",
    is_taxable: true,
    is_statutory: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [absenceSaving, setAbsenceSaving] =
    useState(false);
  const [typeSaving, setTypeSaving] = useState(false);
  const [deletingItem, setDeletingItem] =
    useState(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(
    async (silent = false) => {
      if (!companyId) {
        setLoading(false);
        return;
      }

      try {
        if (!silent) {
          setLoading(true);
        }

        setError("");

        const [
          employeesRes,
          periodsRes,
          earningTypesRes,
          deductionTypesRes,
          earningsRes,
          deductionsRes,
          absencesRes,
        ] = await Promise.all([
          api.get(
            `/api/payroll/employees/?company=${companyId}`
          ),
          api.get(
            `/api/payroll/periods/?company=${companyId}`
          ),
          api.get(
            `/api/payroll/earning-types/?company=${companyId}`
          ),
          api.get(
            `/api/payroll/deduction-types/?company=${companyId}`
          ),
          api.get(
            `/api/payroll/earnings/?company=${companyId}`
          ),
          api.get(
            `/api/payroll/deductions/?company=${companyId}`
          ),
          api.get(
            `/api/payroll/absences/?company=${companyId}`
          ),
        ]);

        setEmployees(list(employeesRes));
        setPeriods(list(periodsRes));
        setEarningTypes(list(earningTypesRes));
        setDeductionTypes(list(deductionTypesRes));
        setEarnings(list(earningsRes));
        setDeductions(list(deductionsRes));
        setAbsences(list(absencesRes));
      } catch (err) {
        console.error(
          "Payroll setup load error:",
          err
        );

        setError(errorText(err));
      } finally {
        setLoading(false);
      }
    },
    [companyId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const activeEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.employment_status === "ACTIVE" &&
          employee.pay_frequency === "MONTHLY"
      ),
    [employees]
  );

  const sortedPeriods = useMemo(
    () =>
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
      ),
    [periods]
  );

  const draftPeriods = useMemo(
    () =>
      sortedPeriods.filter(
        (period) => period.status === "DRAFT"
      ),
    [sortedPeriods]
  );

  useEffect(() => {
    if (!periodId && sortedPeriods.length) {
      const draft = sortedPeriods.find(
        (period) => period.status === "DRAFT"
      );

      setPeriodId(
        String((draft || sortedPeriods[0]).id)
      );
    }
  }, [periodId, sortedPeriods]);

  useEffect(() => {
    if (!employeeId && activeEmployees.length) {
      setEmployeeId(
        String(activeEmployees[0].id)
      );
    }
  }, [employeeId, activeEmployees]);

  const selectedPeriod = sortedPeriods.find(
    (period) =>
      String(period.id) === String(periodId)
  );

  const selectedEmployee = activeEmployees.find(
    (employee) =>
      String(employee.id) ===
      String(employeeId)
  );

  const isDraft =
    selectedPeriod?.status === "DRAFT";

  const selectedEarnings = useMemo(
    () =>
      earnings.filter(
        (item) =>
          String(getPeriodId(item)) ===
            String(periodId) &&
          String(getEmployeeId(item)) ===
            String(employeeId)
      ),
    [earnings, periodId, employeeId]
  );

  const selectedDeductions = useMemo(
    () =>
      deductions.filter(
        (item) =>
          String(getPeriodId(item)) ===
            String(periodId) &&
          String(getEmployeeId(item)) ===
            String(employeeId)
      ),
    [deductions, periodId, employeeId]
  );

  const selectedAbsence = useMemo(
    () =>
      absences.find(
        (absence) =>
          String(
            getAbsencePeriodId(absence)
          ) === String(periodId) &&
          String(
            getAbsenceEmployeeId(absence)
          ) === String(employeeId)
      ) || null,
    [absences, periodId, employeeId]
  );

  useEffect(() => {
    setAbsenceForm({
      days_absent:
        selectedAbsence?.days_absent ?? "",
      reason: selectedAbsence?.reason || "",
    });
  }, [selectedAbsence]);

  const manualDeductions = useMemo(
    () =>
      selectedDeductions.filter((item) => {
        const type = deductionTypes.find(
          (deductionType) =>
            String(deductionType.id) ===
            String(
              typeId(item, "deduction_type")
            )
        );

        return !isAutomaticDeduction(type);
      }),
    [selectedDeductions, deductionTypes]
  );

  const earningTotal = selectedEarnings.reduce(
    (sum, item) =>
      sum + numberValue(item.amount),
    0
  );

  const manualDeductionTotal =
    manualDeductions.reduce(
      (sum, item) =>
        sum + numberValue(item.amount),
      0
    );

  const absenceDays = numberValue(
    selectedAbsence?.days_absent
  );

  const workingDays = numberValue(
    selectedPeriod?.working_days || 0
  );

  const currentType = useMemo(() => {
    const field =
      kind === "earning"
        ? "earning_type"
        : "deduction_type";

    const types =
      kind === "earning"
        ? earningTypes
        : deductionTypes;

    return (
      types.find(
        (item) =>
          String(item.id) ===
          String(form[field])
      ) || null
    );
  }, [
    kind,
    form,
    earningTypes,
    deductionTypes,
  ]);

  const availableDeductionTypes = useMemo(
    () =>
      deductionTypes.filter(
        (item) =>
          item.is_active !== false &&
          !isAutomaticDeduction(item)
      ),
    [deductionTypes]
  );

  function resetLineForm() {
    setForm({
      earning_type: "",
      deduction_type: "",
      amount: "",
      description: "",
      is_taxable: true,
    });
  }

  function switchKind(nextKind) {
    setKind(nextKind);
    resetLineForm();
    setError("");
    setNotice("");
  }

  async function addLine(event) {
    event.preventDefault();

    if (!selectedPeriod) {
      setError("Select a payroll period.");
      return;
    }

    if (!isDraft) {
      setError(
        "Payroll items can only be configured while the payroll period is Draft."
      );
      return;
    }

    if (!selectedEmployee) {
      setError("Select an employee.");
      return;
    }

    const typeField =
      kind === "earning"
        ? "earning_type"
        : "deduction_type";

    const typeIdValue = form[typeField];

    if (!typeIdValue) {
      setError(`Select a ${kind} type.`);
      return;
    }

    if (
      form.amount === "" ||
      Number(form.amount) < 0
    ) {
      setError(
        "Enter a valid non-negative amount."
      );
      return;
    }

    if (
      kind === "deduction" &&
      isAutomaticDeduction(currentType)
    ) {
      setError(
        "PAYE, NASSCORP, and absence deductions are calculated automatically. They cannot be added manually."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const payload =
        kind === "earning"
          ? {
              payroll_period: Number(periodId),
              employee: Number(employeeId),
              earning_type: Number(
                form.earning_type
              ),
              amount: form.amount,
              description:
                form.description.trim(),
              is_taxable: Boolean(
                form.is_taxable
              ),
            }
          : {
              payroll_period: Number(periodId),
              employee: Number(employeeId),
              deduction_type: Number(
                form.deduction_type
              ),
              amount: form.amount,
              description:
                form.description.trim(),
            };

      const saved = await api.post(
        kind === "earning"
          ? "/api/payroll/earnings/"
          : "/api/payroll/deductions/",
        payload
      );

      if (kind === "earning") {
        setEarnings((current) => [
          saved,
          ...current,
        ]);
      } else {
        setDeductions((current) => [
          saved,
          ...current,
        ]);
      }

      setNotice(
        `${
          kind === "earning"
            ? "Earning"
            : "Deduction"
        } added successfully.`
      );

      resetLineForm();
    } catch (err) {
      console.error(
        "Payroll line save error:",
        err
      );

      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveAbsence(event) {
    event.preventDefault();

    if (!selectedPeriod) {
      setError("Select a payroll period.");
      return;
    }

    if (!isDraft) {
      setError(
        "Absence information can only be changed while the payroll period is Draft."
      );
      return;
    }

    if (!selectedEmployee) {
      setError("Select an employee.");
      return;
    }

    const days =
      absenceForm.days_absent === ""
        ? 0
        : Number(absenceForm.days_absent);

    if (!Number.isFinite(days) || days < 0) {
      setError(
        "Enter a valid non-negative number of absence days."
      );
      return;
    }

    if (
      workingDays > 0 &&
      days > workingDays
    ) {
      setError(
        `Absence days cannot exceed the ${workingDays} working days configured for this payroll period.`
      );
      return;
    }

    try {
      setAbsenceSaving(true);
      setError("");
      setNotice("");

      const payload = {
        payroll_period: Number(periodId),
        employee: Number(employeeId),
        days_absent: days,
        reason:
          absenceForm.reason.trim(),
      };

      let saved;

      if (selectedAbsence?.id) {
        saved = await api.patch(
          `/api/payroll/absences/${selectedAbsence.id}/`,
          payload
        );

        setAbsences((current) =>
          current.map((item) =>
            String(item.id) ===
            String(selectedAbsence.id)
              ? saved
              : item
          )
        );
      } else {
        saved = await api.post(
          "/api/payroll/absences/",
          payload
        );

        setAbsences((current) => [
          saved,
          ...current,
        ]);
      }

      setNotice(
        days > 0
          ? "Employee absence information saved successfully."
          : "Employee absence record cleared for this payroll period."
      );
    } catch (err) {
      console.error(
        "Payroll absence save error:",
        err
      );

      setError(errorText(err));
    } finally {
      setAbsenceSaving(false);
    }
  }

  async function removeLine(item, lineKind) {
    if (!selectedPeriod) {
      setError("Select a payroll period.");
      return;
    }

    if (!isDraft) {
      setError(
        "Payroll items can only be changed while the payroll period is Draft."
      );
      return;
    }

    if (!item?.id) {
      setError(
        "The selected payroll item could not be identified."
      );
      return;
    }

    const confirmed = window.confirm(
      `Remove this ${lineKind} from ${nameOf(
        selectedEmployee
      )}'s payroll setup?`
    );

    if (!confirmed) return;

    try {
      setDeletingItem(
        `${lineKind}-${item.id}`
      );

      setError("");
      setNotice("");

      await api.delete(
        lineKind === "earning"
          ? `/api/payroll/earnings/${item.id}/`
          : `/api/payroll/deductions/${item.id}/`
      );

      if (lineKind === "earning") {
        setEarnings((current) =>
          current.filter(
            (entry) =>
              String(entry.id) !==
              String(item.id)
          )
        );
      } else {
        setDeductions((current) =>
          current.filter(
            (entry) =>
              String(entry.id) !==
              String(item.id)
          )
        );
      }

      setNotice(
        `${
          lineKind === "earning"
            ? "Earning"
            : "Deduction"
        } removed successfully.`
      );
    } catch (err) {
      console.error(
        "Payroll line removal error:",
        err
      );

      setError(errorText(err));
    } finally {
      setDeletingItem(null);
    }
  }

  function openType(kindToCreate) {
    setTypeKind(kindToCreate);

    setTypeForm({
      name: "",
      code: "",
      calculation_type: "FIXED",
      is_taxable: true,
      is_statutory: false,
    });

    setError("");
    setNotice("");
    setTypeModal(true);
  }

  async function createType(event) {
    event.preventDefault();

    if (!companyId) {
      setError("No company is selected.");
      return;
    }

    if (
      !typeForm.name.trim() ||
      !typeForm.code.trim()
    ) {
      setError(
        "Name and code are required for a payroll type."
      );
      return;
    }

    if (
      typeKind === "deduction" &&
      isAutomaticDeduction({
        code: typeForm.code,
      })
    ) {
      setError(
        "PAYE, NASSCORP, and ABSENCE are reserved for automatic payroll calculations. Please use a different code."
      );
      return;
    }

    try {
      setTypeSaving(true);
      setError("");
      setNotice("");

      const payload = {
        company: Number(companyId),
        name: typeForm.name.trim(),
        code: typeForm.code
          .trim()
          .toUpperCase(),
        calculation_type:
          typeForm.calculation_type,
        is_active: true,

        ...(typeKind === "earning"
          ? {
              is_taxable: Boolean(
                typeForm.is_taxable
              ),
            }
          : {
              is_statutory: Boolean(
                typeForm.is_statutory
              ),
            }),
      };

      const created = await api.post(
        typeKind === "earning"
          ? "/api/payroll/earning-types/"
          : "/api/payroll/deduction-types/",
        payload
      );

      if (typeKind === "earning") {
        setEarningTypes((current) => [
          ...current,
          created,
        ]);

        setKind("earning");

        setForm((current) => ({
          ...current,
          earning_type: created?.id
            ? String(created.id)
            : "",
          deduction_type: "",
        }));
      } else {
        setDeductionTypes((current) => [
          ...current,
          created,
        ]);

        setKind("deduction");

        setForm((current) => ({
          ...current,
          earning_type: "",
          deduction_type: created?.id
            ? String(created.id)
            : "",
        }));
      }

      setTypeModal(false);

      setNotice(
        `${
          typeKind === "earning"
            ? "Earning"
            : "Deduction"
        } type created successfully.`
      );
    } catch (err) {
      console.error(
        "Payroll type creation error:",
        err
      );

      setError(errorText(err));
    } finally {
      setTypeSaving(false);
    }
  }

  if (!companyId) {
    return (
      <div className="payroll-setup-page">
        <div className="payroll-setup-empty">
          <div className="payroll-setup-empty-icon">
            <SlidersHorizontal size={24} />
          </div>

          <h2>No Company Selected</h2>

          <p>
            Select a company before configuring
            payroll.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="payroll-setup-page">
      <div className="payroll-setup-header">
        <div>
          <div className="payroll-setup-eyebrow">
            PAYROLL SETUP
          </div>

          <h1>Payroll Setup</h1>

          <p>
            Configure employee-specific payroll
            items and attendance information before
            a payroll period is processed.
          </p>
        </div>

        <button
          type="button"
          className="payroll-setup-refresh"
          onClick={() => load(true)}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="payroll-setup-company-strip">
        <div>
          <span>Company</span>
          <strong>{companyName}</strong>
        </div>

        <div>
          <span>Currency</span>
          <strong>{currency}</strong>
        </div>

        <div>
          <span>Active Monthly Employees</span>
          <strong>
            {activeEmployees.length}
          </strong>
        </div>

        <div>
          <span>Draft Periods</span>
          <strong>
            {draftPeriods.length}
          </strong>
        </div>
      </div>

      {error && (
        <div className="payroll-setup-alert payroll-setup-alert-error">
          <AlertCircle size={17} />

          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {notice && (
        <div className="payroll-setup-alert payroll-setup-alert-success">
          <CheckCircle2 size={17} />

          <span>{notice}</span>

          <button
            type="button"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="payroll-setup-loading">
          <RefreshCw
            size={22}
            className="payroll-setup-spin"
          />
          Loading payroll setup...
        </div>
      ) : (
        <>
          {/* =========================================================
              SETUP SCOPE
          ========================================================= */}
          <section className="payroll-setup-selection-card">
            <div className="payroll-setup-card-heading">
              <div>
                <div className="payroll-setup-section-label">
                  SETUP SCOPE
                </div>

                <h2>
                  Select payroll period and employee
                </h2>

                <p>
                  Payroll setup is maintained
                  separately for each employee and
                  payroll period.
                </p>
              </div>

              <div className="payroll-setup-heading-icon">
                <Users size={20} />
              </div>
            </div>

            <div className="payroll-setup-selection-grid">
              <label className="payroll-setup-field">
                <span>Payroll Period</span>

                <select
                  value={periodId}
                  onChange={(event) => {
                    setPeriodId(
                      event.target.value
                    );
                    setError("");
                    setNotice("");
                  }}
                >
                  <option value="">
                    Select payroll period
                  </option>

                  {sortedPeriods.map(
                    (period) => (
                      <option
                        key={period.id}
                        value={period.id}
                      >
                        {period.name} —{" "}
                        {statusLabel(
                          period.status
                        )}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="payroll-setup-field">
                <span>Employee</span>

                <select
                  value={employeeId}
                  onChange={(event) => {
                    setEmployeeId(
                      event.target.value
                    );
                    setError("");
                    setNotice("");
                  }}
                >
                  <option value="">
                    Select employee
                  </option>

                  {activeEmployees.map(
                    (employee) => (
                      <option
                        key={employee.id}
                        value={employee.id}
                      >
                        {nameOf(employee)} —{" "}
                        {employee.employee_number ||
                          employee.employee_id ||
                          `Employee ${employee.id}`}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            {selectedPeriod && (
              <div className="payroll-setup-period-summary">
                <div>
                  <span>Period</span>

                  <strong>
                    {dateLabel(
                      selectedPeriod.start_date
                    )}{" "}
                    —{" "}
                    {dateLabel(
                      selectedPeriod.end_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>Pay Date</span>

                  <strong>
                    {dateLabel(
                      selectedPeriod.pay_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>Status</span>

                  <strong
                    className={statusClass(
                      selectedPeriod.status
                    )}
                  >
                    {statusLabel(
                      selectedPeriod.status
                    )}
                  </strong>
                </div>

                <div>
                  <span>Basic Salary</span>

                  <strong>
                    {money(
                      selectedEmployee?.basic_salary,
                      currency
                    )}
                  </strong>
                </div>
              </div>
            )}

            {selectedPeriod && (
              <div className="payroll-setup-period-summary">
                <div>
                  <span>Working Days</span>

                  <strong>
                    {numberValue(
                      selectedPeriod.working_days
                    ).toFixed(2)}
                  </strong>
                </div>

                <div>
                  <span>Exchange Rate</span>

                  <strong>
                    {numberValue(
                      selectedPeriod.exchange_rate
                    ).toFixed(6)}
                  </strong>
                </div>

                <div>
                  <span>Employee NASSCORP</span>

                  <strong>
                    {numberValue(
                      selectedPeriod.social_security_employee_rate
                    ).toFixed(2)}
                    %
                  </strong>
                </div>

                <div>
                  <span>Employer NASSCORP</span>

                  <strong>
                    {numberValue(
                      selectedPeriod.social_security_employer_rate
                    ).toFixed(2)}
                    %
                  </strong>
                </div>
              </div>
            )}

            {!isDraft && selectedPeriod && (
              <div className="payroll-setup-alert payroll-setup-alert-error">
                <LockIcon />

                <span>
                  This payroll period is{" "}
                  <strong>
                    {statusLabel(
                      selectedPeriod.status
                    )}
                  </strong>
                  . Employee payroll setup is
                  locked. Return the period to Draft
                  before making configuration changes.
                </span>
              </div>
            )}
          </section>

          {/* =========================================================
              SELECTED EMPLOYEE
          ========================================================= */}
          <section className="payroll-setup-employee-card">
            <div className="payroll-setup-employee-avatar">
              <UserRound size={22} />
            </div>

            <div className="payroll-setup-employee-info">
              <span>SELECTED EMPLOYEE</span>

              <h2>
                {selectedEmployee
                  ? nameOf(selectedEmployee)
                  : "No employee selected"}
              </h2>

              {selectedEmployee && (
                <p>
                  {selectedEmployee.employee_number ||
                    selectedEmployee.employee_id ||
                    `Employee #${selectedEmployee.id}`}
                  {" • "}
                  {selectedEmployee.pay_frequency ||
                    "Monthly"}
                  {" • "}
                  Basic salary{" "}
                  {money(
                    selectedEmployee.basic_salary,
                    currency
                  )}
                </p>
              )}
            </div>

            {selectedPeriod && (
              <div className="payroll-setup-employee-period">
                <span>PAYROLL PERIOD</span>

                <strong>
                  {selectedPeriod.name}
                </strong>

                <small>
                  {statusLabel(
                    selectedPeriod.status
                  )}
                </small>
              </div>
            )}
          </section>

          {/* =========================================================
              ABSENCE / ATTENDANCE
          ========================================================= */}
          <section className="payroll-setup-card payroll-setup-attendance-card">
            <div className="payroll-setup-card-header">
              <div>
                <div className="payroll-setup-section-label">
                  ATTENDANCE & ABSENCE
                </div>

                <h2>
                  Days missed during this payroll
                </h2>

                <p>
                  Record the employee's absence for
                  the selected payroll period. The
                  payroll engine will calculate the
                  resulting absence deduction during
                  processing.
                </p>
              </div>

              <div className="payroll-setup-heading-icon">
                <CalendarDays size={20} />
              </div>
            </div>

            <form
              className="payroll-setup-form"
              onSubmit={saveAbsence}
            >
              <div className="payroll-setup-form-row">
                <label className="payroll-setup-field">
                  <span>Days Absent</span>

                  <input
                    type="number"
                    min="0"
                    max={
                      workingDays > 0
                        ? workingDays
                        : undefined
                    }
                    step="0.01"
                    value={
                      absenceForm.days_absent
                    }
                    onChange={(event) =>
                      setAbsenceForm(
                        (current) => ({
                          ...current,
                          days_absent:
                            event.target.value,
                        })
                      )
                    }
                    disabled={
                      !selectedEmployee ||
                      !selectedPeriod ||
                      !isDraft
                    }
                    placeholder="0"
                  />

                  {workingDays > 0 && (
                    <small>
                      Maximum for this period:{" "}
                      {workingDays.toFixed(2)} working
                      days.
                    </small>
                  )}
                </label>

                <label className="payroll-setup-field">
                  <span>Reason</span>

                  <input
                    type="text"
                    maxLength={200}
                    value={absenceForm.reason}
                    onChange={(event) =>
                      setAbsenceForm(
                        (current) => ({
                          ...current,
                          reason:
                            event.target.value,
                        })
                      )
                    }
                    disabled={
                      !selectedEmployee ||
                      !selectedPeriod ||
                      !isDraft
                    }
                    placeholder="Optional absence reason"
                  />
                </label>
              </div>

              <div className="payroll-setup-attendance-summary">
                <div>
                  <Clock3 size={18} />

                  <div>
                    <span>
                      Recorded absence
                    </span>

                    <strong>
                      {absenceDays.toFixed(2)} days
                    </strong>
                  </div>
                </div>

                <div>
                  <CalendarDays size={18} />

                  <div>
                    <span>
                      Working days
                    </span>

                    <strong>
                      {workingDays > 0
                        ? workingDays.toFixed(2)
                        : "—"}
                    </strong>
                  </div>
                </div>

                <div>
                  <Calculator size={18} />

                  <div>
                    <span>
                      Calculation
                    </span>

                    <strong>
                      Automatic
                    </strong>
                  </div>
                </div>
              </div>

              <div className="payroll-setup-form-actions">
                <button
                  type="submit"
                  className="payroll-setup-primary-button"
                  disabled={
                    absenceSaving ||
                    !selectedEmployee ||
                    !selectedPeriod ||
                    !isDraft
                  }
                >
                  {absenceSaving ? (
                    <RefreshCw
                      size={16}
                      className="payroll-setup-spin"
                    />
                  ) : (
                    <CalendarDays size={16} />
                  )}

                  Save Attendance
                </button>
              </div>
            </form>
          </section>

          {/* =========================================================
              EARNINGS / DEDUCTIONS CONFIGURATION
          ========================================================= */}
          <div className="payroll-setup-main-grid">
            <section className="payroll-setup-card">
              <div className="payroll-setup-card-header">
                <div>
                  <div className="payroll-setup-section-label">
                    PERIOD-SPECIFIC PAY ITEMS
                  </div>

                  <h2>
                    Earnings & Manual Deductions
                  </h2>

                  <p>
                    Configure additional payroll
                    items that apply to this employee
                    for this specific payroll period.
                  </p>
                </div>

                <div className="payroll-setup-kind-toggle">
                  <button
                    type="button"
                    className={
                      kind === "earning"
                        ? "payroll-setup-kind-active"
                        : ""
                    }
                    onClick={() =>
                      switchKind("earning")
                    }
                  >
                    Earnings
                  </button>

                  <button
                    type="button"
                    className={
                      kind === "deduction"
                        ? "payroll-setup-kind-active"
                        : ""
                    }
                    onClick={() =>
                      switchKind("deduction")
                    }
                  >
                    Deductions
                  </button>
                </div>
              </div>

              <form
                className="payroll-setup-form"
                onSubmit={addLine}
              >
                <label className="payroll-setup-field">
                  <span>
                    {kind === "earning"
                      ? "Earning Type"
                      : "Manual Deduction Type"}
                  </span>

                  <select
                    value={
                      kind === "earning"
                        ? form.earning_type
                        : form.deduction_type
                    }
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [kind === "earning"
                          ? "earning_type"
                          : "deduction_type"]:
                          event.target.value,
                      }))
                    }
                    disabled={
                      !selectedEmployee ||
                      !selectedPeriod ||
                      !isDraft
                    }
                  >
                    <option value="">
                      Select{" "}
                      {kind === "earning"
                        ? "earning"
                        : "manual deduction"}
                    </option>

                    {(kind === "earning"
                      ? earningTypes
                      : availableDeductionTypes
                    )
                      .filter(
                        (item) =>
                          item.is_active !== false
                      )
                      .map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.name} —{" "}
                          {typeInfo(item)}
                        </option>
                      ))}
                  </select>
                </label>

                <div className="payroll-setup-form-row">
                  <label className="payroll-setup-field">
                    <span>
                      {currentType?.calculation_type ===
                      "PERCENTAGE"
                        ? "Rate (%)"
                        : `Amount (${currency})`}
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amount}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          amount:
                            event.target.value,
                        }))
                      }
                      disabled={
                        !selectedEmployee ||
                        !selectedPeriod ||
                        !isDraft
                      }
                      placeholder={
                        currentType?.calculation_type ===
                        "PERCENTAGE"
                          ? "e.g. 5"
                          : "e.g. 200.00"
                      }
                    />

                    {currentType?.calculation_type ===
                      "PERCENTAGE" && (
                      <small>
                        The payroll engine applies
                        the configured percentage
                        against monthly basic salary.
                      </small>
                    )}
                  </label>

                  <label className="payroll-setup-field">
                    <span>Description</span>

                    <input
                      type="text"
                      maxLength={200}
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description:
                            event.target.value,
                        }))
                      }
                      disabled={
                        !selectedEmployee ||
                        !selectedPeriod ||
                        !isDraft
                      }
                      placeholder={
                        kind === "earning"
                          ? "Monthly housing allowance"
                          : "Salary advance repayment"
                      }
                    />
                  </label>
                </div>

                {kind === "earning" && (
                  <label className="payroll-setup-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(
                        form.is_taxable
                      )}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          is_taxable:
                            event.target.checked,
                        }))
                      }
                      disabled={
                        !selectedEmployee ||
                        !selectedPeriod ||
                        !isDraft
                      }
                    />

                    <span>
                      This earning is taxable
                    </span>
                  </label>
                )}

                {currentType && (
                  <div className="payroll-setup-type-note">
                    <strong>
                      {currentType.name}
                    </strong>

                    <span>
                      {typeInfo(currentType)}
                    </span>
                  </div>
                )}

                <div className="payroll-setup-form-actions">
                  <button
                    type="submit"
                    className="payroll-setup-primary-button"
                    disabled={
                      saving ||
                      !selectedEmployee ||
                      !selectedPeriod ||
                      !isDraft
                    }
                  >
                    {saving ? (
                      <RefreshCw
                        size={16}
                        className="payroll-setup-spin"
                      />
                    ) : (
                      <Plus size={16} />
                    )}

                    Add{" "}
                    {kind === "earning"
                      ? "Earning"
                      : "Deduction"}
                  </button>

                  <button
                    type="button"
                    className="payroll-setup-secondary-button"
                    onClick={() =>
                      openType(kind)
                    }
                    disabled={!companyId}
                  >
                    <Plus size={16} />

                    New{" "}
                    {kind === "earning"
                      ? "Earning Type"
                      : "Deduction Type"}
                  </button>
                </div>
              </form>
            </section>

            {/* =======================================================
                CURRENT CONFIGURATION
            ======================================================= */}
            <section className="payroll-setup-card">
              <div className="payroll-setup-card-header">
                <div>
                  <div className="payroll-setup-section-label">
                    CURRENT CONFIGURATION
                  </div>

                  <h2>
                    {selectedEmployee
                      ? nameOf(selectedEmployee)
                      : "Select Employee"}
                  </h2>

                  <p>
                    Payroll items configured for this
                    employee and payroll period.
                  </p>
                </div>

                <div className="payroll-setup-items-count">
                  {selectedEarnings.length +
                    manualDeductions.length}{" "}
                  manual items
                </div>
              </div>

              <div className="payroll-setup-item-lists">
                {/* Earnings */}
                <div className="payroll-setup-list-section">
                  <div className="payroll-setup-list-heading">
                    <strong>Earnings</strong>

                    <span>
                      {selectedEarnings.length}
                    </span>
                  </div>

                  {selectedEarnings.length ===
                  0 ? (
                    <div className="payroll-setup-no-items">
                      No earnings configured for
                      this employee in this period.
                    </div>
                  ) : (
                    selectedEarnings.map((item) => {
                      const type =
                        earningTypes.find(
                          (earningType) =>
                            String(
                              earningType.id
                            ) ===
                            String(
                              typeId(
                                item,
                                "earning_type"
                              )
                            )
                        );

                      return (
                        <div
                          className="payroll-setup-item"
                          key={item.id}
                        >
                          <div>
                            <strong>
                              {typeName(
                                item,
                                "earning_type",
                                type
                              )}
                            </strong>

                            <span>
                              {item.description ||
                                typeInfo(type)}

                              {item.is_taxable && (
                                <em>
                                  Taxable
                                </em>
                              )}
                            </span>
                          </div>

                          <div className="payroll-setup-item-value">
                            <strong>
                              {type?.calculation_type ===
                              "PERCENTAGE"
                                ? `${Number(
                                    item.amount ||
                                      0
                                  )}%`
                                : money(
                                    item.amount,
                                    currency
                                  )}
                            </strong>

                            {isDraft && (
                              <button
                                type="button"
                                title="Remove earning"
                                onClick={() =>
                                  removeLine(
                                    item,
                                    "earning"
                                  )
                                }
                                disabled={
                                  deletingItem ===
                                  `earning-${item.id}`
                                }
                              >
                                {deletingItem ===
                                `earning-${item.id}` ? (
                                  <RefreshCw
                                    size={14}
                                    className="payroll-setup-spin"
                                  />
                                ) : (
                                  <Trash2
                                    size={14}
                                  />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Manual deductions */}
                <div className="payroll-setup-list-section">
                  <div className="payroll-setup-list-heading">
                    <strong>
                      Manual Deductions
                    </strong>

                    <span>
                      {manualDeductions.length}
                    </span>
                  </div>

                  {manualDeductions.length ===
                  0 ? (
                    <div className="payroll-setup-no-items">
                      No manual deductions configured
                      for this employee in this
                      period.
                    </div>
                  ) : (
                    manualDeductions.map((item) => {
                      const type =
                        deductionTypes.find(
                          (deductionType) =>
                            String(
                              deductionType.id
                            ) ===
                            String(
                              typeId(
                                item,
                                "deduction_type"
                              )
                            )
                        );

                      return (
                        <div
                          className="payroll-setup-item"
                          key={item.id}
                        >
                          <div>
                            <strong>
                              {typeName(
                                item,
                                "deduction_type",
                                type
                              )}
                            </strong>

                            <span>
                              {item.description ||
                                typeInfo(type)}
                            </span>
                          </div>

                          <div className="payroll-setup-item-value">
                            <strong>
                              {type?.calculation_type ===
                              "PERCENTAGE"
                                ? `${Number(
                                    item.amount ||
                                      0
                                  )}%`
                                : money(
                                    item.amount,
                                    currency
                                  )}
                            </strong>

                            {isDraft && (
                              <button
                                type="button"
                                title="Remove deduction"
                                onClick={() =>
                                  removeLine(
                                    item,
                                    "deduction"
                                  )
                                }
                                disabled={
                                  deletingItem ===
                                  `deduction-${item.id}`
                                }
                              >
                                {deletingItem ===
                                `deduction-${item.id}` ? (
                                  <RefreshCw
                                    size={14}
                                    className="payroll-setup-spin"
                                  />
                                ) : (
                                  <Trash2
                                    size={14}
                                  />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Automatic calculations */}
              <div className="payroll-setup-automatic-box">
                <div className="payroll-setup-automatic-icon">
                  <Calculator size={18} />
                </div>

                <div>
                  <strong>
                    Automatic payroll calculations
                  </strong>

                  <p>
                    PAYE, employee NASSCORP,
                    employer NASSCORP, and the
                    absence deduction are calculated
                    by the payroll engine when this
                    period is processed. They are not
                    entered manually on this screen.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* =========================================================
              SETUP SUMMARY
          ========================================================= */}
          <section className="payroll-setup-summary-card">
            <div className="payroll-setup-card-header">
              <div>
                <div className="payroll-setup-section-label">
                  SETUP SUMMARY
                </div>

                <h2>
                  {selectedEmployee
                    ? `${nameOf(
                        selectedEmployee
                      )}'s payroll configuration`
                    : "Employee payroll configuration"}
                </h2>

                <p>
                  These are configured inputs. Final
                  payroll amounts are generated by
                  Payroll Processing.
                </p>
              </div>

              <div
                className={statusClass(
                  selectedPeriod?.status
                )}
              >
                {selectedPeriod
                  ? statusLabel(
                      selectedPeriod.status
                    )
                  : "No period"}
              </div>
            </div>

            <div className="payroll-setup-summary-grid">
              <div>
                <span>Basic Salary</span>

                <strong>
                  {money(
                    selectedEmployee?.basic_salary,
                    currency
                  )}
                </strong>
              </div>

              <div>
                <span>Configured Earnings</span>

                <strong>
                  {money(
                    earningTotal,
                    currency
                  )}
                </strong>
              </div>

              <div>
                <span>Manual Deductions</span>

                <strong>
                  {money(
                    manualDeductionTotal,
                    currency
                  )}
                </strong>
              </div>

              <div>
                <span>Absence Days</span>

                <strong>
                  {absenceDays.toFixed(2)}
                </strong>
              </div>
            </div>
          </section>

          {/* =========================================================
              WORKFLOW INFORMATION
          ========================================================= */}
          <section className="payroll-setup-explainer">
            <div className="payroll-setup-explainer-icon">
              <Info size={20} />
            </div>

            <div>
              <strong>
                Where this page fits in the payroll
                workflow
              </strong>

              <p>
                Payroll Setup prepares the inputs for
                a payroll period. Once the employee
                records, earnings, deductions, and
                attendance information are ready,
                Payroll Processing calculates the
                final payroll. The workflow then
                moves from{" "}
                <strong>DRAFT</strong> to{" "}
                <strong>PROCESSING</strong>,{" "}
                <strong>PROCESSED</strong>,{" "}
                <strong>APPROVED</strong>, and finally{" "}
                <strong>LOCKED</strong> after posting
                to accounting.
              </p>
            </div>
          </section>
        </>
      )}

      {/* =============================================================
          NEW PAYROLL TYPE MODAL
      ============================================================= */}
      {typeModal && (
        <div className="payroll-setup-modal-backdrop">
          <div className="payroll-setup-modal">
            <div className="payroll-setup-modal-header">
              <div>
                <div className="payroll-setup-section-label">
                  PAYROLL MASTER DATA
                </div>

                <h2>
                  New{" "}
                  {typeKind === "earning"
                    ? "Earning"
                    : "Deduction"}{" "}
                  Type
                </h2>

                <p>
                  Create a reusable payroll type
                  for {companyName}.
                </p>
              </div>

              <button
                type="button"
                className="payroll-setup-modal-close"
                onClick={() =>
                  setTypeModal(false)
                }
                disabled={typeSaving}
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="payroll-setup-modal-form"
              onSubmit={createType}
            >
              <div className="payroll-setup-form-row">
                <label className="payroll-setup-field">
                  <span>Name</span>

                  <input
                    value={typeForm.name}
                    onChange={(event) =>
                      setTypeForm(
                        (current) => ({
                          ...current,
                          name: event.target.value,
                        })
                      )
                    }
                    placeholder={
                      typeKind === "earning"
                        ? "Housing Allowance"
                        : "Salary Advance"
                    }
                    disabled={typeSaving}
                  />
                </label>

                <label className="payroll-setup-field">
                  <span>Code</span>

                  <input
                    value={typeForm.code}
                    onChange={(event) =>
                      setTypeForm(
                        (current) => ({
                          ...current,
                          code: event.target.value,
                        })
                      )
                    }
                    placeholder={
                      typeKind === "earning"
                        ? "HOUSING"
                        : "SALARY_ADVANCE"
                    }
                    disabled={typeSaving}
                  />
                </label>
              </div>

              <label className="payroll-setup-field">
                <span>
                  Calculation Type
                </span>

                <select
                  value={
                    typeForm.calculation_type
                  }
                  onChange={(event) =>
                    setTypeForm(
                      (current) => ({
                        ...current,
                        calculation_type:
                          event.target.value,
                      })
                    )
                  }
                  disabled={typeSaving}
                >
                  <option value="FIXED">
                    Fixed Amount
                  </option>

                  <option value="PERCENTAGE">
                    Percentage
                  </option>
                </select>
              </label>

              <label className="payroll-setup-checkbox">
                <input
                  type="checkbox"
                  checked={
                    typeKind === "earning"
                      ? Boolean(
                          typeForm.is_taxable
                        )
                      : Boolean(
                          typeForm.is_statutory
                        )
                  }
                  onChange={(event) =>
                    setTypeForm(
                      (current) =>
                        typeKind === "earning"
                          ? {
                              ...current,
                              is_taxable:
                                event.target
                                  .checked,
                            }
                          : {
                              ...current,
                              is_statutory:
                                event.target
                                  .checked,
                            }
                    )
                  }
                  disabled={typeSaving}
                />

                <span>
                  {typeKind === "earning"
                    ? "Default this earning as taxable"
                    : "This is a statutory deduction"}
                </span>
              </label>

              {typeKind === "deduction" && (
                <div className="payroll-setup-automatic-box">
                  <div className="payroll-setup-automatic-icon">
                    <Info size={18} />
                  </div>

                  <div>
                    <strong>
                      Statutory deductions
                    </strong>

                    <p>
                      Do not create PAYE, NASSCORP,
                      or ABSENCE as manual deduction
                      types. These are reserved for
                      automatic payroll calculations.
                    </p>
                  </div>
                </div>
              )}

              <div className="payroll-setup-modal-actions">
                <button
                  type="button"
                  className="payroll-setup-secondary-button"
                  onClick={() =>
                    setTypeModal(false)
                  }
                  disabled={typeSaving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="payroll-setup-primary-button"
                  disabled={typeSaving}
                >
                  {typeSaving ? (
                    <RefreshCw
                      size={16}
                      className="payroll-setup-spin"
                    />
                  ) : (
                    <Plus size={16} />
                  )}

                  Create Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect
        width="18"
        height="11"
        x="3"
        y="11"
        rx="2"
      />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}