import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  Clock3,
  LockKeyhole,
  Play,
  Printer,
  RefreshCw,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";

import { api, API_BASE_URL } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";


function extractList(response) {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  if (Array.isArray(response?.records)) {
    return response.records;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  return [];
}


function formatMoney(
  value,
  currency = "USD"
) {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))} ${currency}`;
}


function formatDate(value) {
  if (!value) return "—";

  const date =
    new Date(
      `${value}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
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


function employeeName(employee) {
  if (!employee) {
    return "Unknown Employee";
  }

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
      .trim() ||
    "Unknown Employee"
  );
}


function getEmployee(record) {
  if (
    record?.employee &&
    typeof record.employee ===
      "object"
  ) {
    return record.employee;
  }

  return null;
}


function getPeriodId(record) {
  return (
    record?.payroll_period?.id ??
    record?.payroll_period_id ??
    (
      typeof record?.payroll_period ===
        "number" ||
      typeof record?.payroll_period ===
        "string"
        ? record.payroll_period
        : null
    ) ??
    record?.period_id ??
    record?.period?.id ??
    record?.period ??
    null
  );
}


function statusLabel(status) {
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


function statusClass(status) {
  return `pp-status pp-status-${String(
    status || "unknown"
  ).toLowerCase()}`;
}


function initials(record) {
  const name =
    employeeName(
      getEmployee(record)
    );

  const parts =
    name
      .split(" ")
      .filter(Boolean);

  if (!parts.length) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }

  return `${parts[0][0]}${
    parts[parts.length - 1][0]
  }`.toUpperCase();
}


function extractActionError(error) {
  const data =
    error?.data;

  if (
    data &&
    typeof data === "object"
  ) {
    if (data.detail) {
      return data.detail;
    }

    if (data.message) {
      return data.message;
    }

    return Object.entries(
      data
    )
      .map(
        ([field, message]) =>
          `${field}: ${
            Array.isArray(
              message
            )
              ? message.join(
                  ", "
                )
              : message
          }`
      )
      .join(" ");
  }

  return (
    error?.message ||
    "The payroll action could not be completed."
  );
}


const WORKFLOW = [
  {
    key: "DRAFT",
    label: "Draft",
    description:
      "Payroll period created and ready to process.",
    icon: Clock3,
  },
  {
    key: "PROCESSING",
    label: "Processing",
    description:
      "Payroll calculation is being prepared.",
    icon: Play,
  },
  {
    key: "PROCESSED",
    label: "Processed",
    description:
      "Payroll records have been calculated and are ready for review.",
    icon: ClipboardCheck,
  },
  {
    key: "APPROVED",
    label: "Approved",
    description:
      "Payroll has been reviewed and approved and is ready to post to accounting.",
    icon: CheckCircle2,
  },
  {
    key: "LOCKED",
    label: "Locked",
    description:
      "Payroll has been posted to accounting and is ready for payment.",
    icon: LockKeyhole,
  },
];


export default function PayrollProcessing() {
  const {
    currentCompany,
  } = useCompany();

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

  const [records, setRecords] =
    useState([]);

  const [
    selectedPeriodId,
    setSelectedPeriodId,
  ] = useState(null);


  const [loading, setLoading] =
    useState(true);

  const [
    recordsLoading,
    setRecordsLoading,
  ] = useState(false);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);

  const [
    exportLoading,
    setExportLoading,
  ] = useState(false);

  const [
    payslipLoadingId,
    setPayslipLoadingId,
  ] = useState(null);

  const [
    bulkPayslipLoading,
    setBulkPayslipLoading,
  ] = useState(false);


  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");


  const [search, setSearch] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("ALL");


  const [
    actionModal,
    setActionModal,
  ] = useState(null);


  // ==========================================================
  // LOAD PERIODS
  // ==========================================================

  const loadPeriods =
    useCallback(
      async (silent = false) => {
        if (!companyId) {
          setPeriods([]);
          setSelectedPeriodId(
            null
          );
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

          const list =
            extractList(
              response
            );

          setPeriods(list);

          setSelectedPeriodId(
            (current) => {
              if (
                current &&
                list.some(
                  (period) =>
                    String(
                      period.id
                    ) ===
                    String(
                      current
                    )
                )
              ) {
                return current;
              }

              return (
                list[0]?.id ??
                null
              );
            }
          );
        } catch (err) {
          setError(
            extractActionError(
              err
            ) ||
              "Unable to load payroll periods."
          );

          setPeriods([]);
          setSelectedPeriodId(
            null
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [companyId]
    );


  // ==========================================================
  // LOAD RECORDS
  // ==========================================================

  const loadRecords =
    useCallback(
      async () => {
        if (
          !companyId ||
          !selectedPeriodId
        ) {
          setRecords([]);
          return;
        }

        try {
          setRecordsLoading(
            true
          );

          const response =
            await api.get(
              `/api/payroll/records/?company=${companyId}`
            );

          const allRecords =
            extractList(
              response
            );

          const matchingRecords =
            allRecords.filter(
              (record) =>
                String(
                  getPeriodId(
                    record
                  )
                ) ===
                String(
                  selectedPeriodId
                )
            );

          setRecords(
            matchingRecords
          );

        } catch (err) {
          setRecords([]);

          setError(
            extractActionError(
              err
            ) ||
              "Unable to load payroll records."
          );
        } finally {
          setRecordsLoading(
            false
          );
        }
      },
      [
        companyId,
        selectedPeriodId,
      ]
    );


  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);


  useEffect(() => {
    loadRecords();
  }, [loadRecords]);


  // ==========================================================
  // SELECTED PERIOD
  // ==========================================================

  const selectedPeriod =
    useMemo(
      () =>
        periods.find(
          (period) =>
            String(
              period.id
            ) ===
            String(
              selectedPeriodId
            )
        ) || null,
      [
        periods,
        selectedPeriodId,
      ]
    );


  // ==========================================================
  // TOTALS
  //
  // IMPORTANT:
  // These are ONLY totals of values returned by
  // the backend payroll records.
  // ==========================================================

  const totals =
    useMemo(() => {
      return records.reduce(
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

          absence:
            total.absence +
            Number(
              record.absence_deduction ||
                0
            ),

          gross:
            total.gross +
            Number(
              record.gross_pay ||
                0
            ),

          taxable:
            total.taxable +
            Number(
              record.taxable_income ||
                0
            ),

          paye:
            total.paye +
            Number(
              record.paye_tax ||
                0
            ),

          employeeNasscorp:
            total.employeeNasscorp +
            Number(
              record.social_security_employee ||
                0
            ),

          employerNasscorp:
            total.employerNasscorp +
            Number(
              record.social_security_employer ||
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

          employerCost:
            total.employerCost +
            Number(
              record.employer_cost ||
                0
            ),
        }),
        {
          basic: 0,
          earnings: 0,
          absence: 0,
          gross: 0,
          taxable: 0,
          paye: 0,
          employeeNasscorp: 0,
          employerNasscorp: 0,
          deductions: 0,
          net: 0,
          employerCost: 0,
        }
      );
    }, [records]);


  // ==========================================================
  // FILTER RECORDS
  // ==========================================================

  const filteredRecords =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return records.filter(
        (record) => {
          const employee =
            getEmployee(
              record
            );

          const employeeText =
            [
              employeeName(
                employee
              ),
              employee?.employee_number,
              employee?.department,
              employee?.position,
              record.employee_name,
              record.employee_number,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          return (
            !query ||
            employeeText.includes(
              query
            )
          );
        }
      );
    }, [
      records,
      search,
    ]);


  // ==========================================================
  // STATUS COUNTS
  // ==========================================================

  const statusCounts =
    useMemo(() => {
      return periods.reduce(
        (counts, period) => {
          if (
            counts[
              period.status
            ] !== undefined
          ) {
            counts[
              period.status
            ] += 1;
          }

          return counts;
        },
        {
          DRAFT: 0,
          PROCESSING: 0,
          PROCESSED: 0,
          APPROVED: 0,
          LOCKED: 0,
        }
      );
    }, [periods]);


  const filteredPeriods =
    useMemo(() => {
      return periods.filter(
        (period) =>
          statusFilter ===
            "ALL" ||
          period.status ===
            statusFilter
      );
    }, [
      periods,
      statusFilter,
    ]);


  const currentStep =
    Math.max(
      0,
      WORKFLOW.findIndex(
        (step) =>
          step.key ===
          selectedPeriod?.status
      )
    );


  // ==========================================================
  // WORKFLOW ACTION
  // ==========================================================

  const actionConfig =
    useMemo(() => {
      if (!selectedPeriod) {
        return null;
      }

      switch (
        selectedPeriod.status
      ) {
        case "DRAFT":
          return {
            endpoint:
              `/api/payroll/periods/${selectedPeriod.id}/process/`,

            label:
              "Process Payroll",

            title:
              "Process Payroll",

            description:
              "This will calculate the payroll for every eligible employee using the exchange rate, working days, days missed, earnings and deductions configured for this payroll period.",

            icon: Play,

            tone: "primary",
          };


        case "PROCESSED":
          return {
            endpoint:
              `/api/payroll/periods/${selectedPeriod.id}/approve/`,

            label:
              "Approve Payroll",

            title:
              "Approve Payroll",

            description:
              "Review the calculated payroll records and totals before approving this payroll period.",

            icon:
              CheckCircle2,

            tone: "primary",
          };


        case "APPROVED":
          return {
            endpoint:
              `/api/payroll/periods/${selectedPeriod.id}/post-to-accounting/`,

            label:
              "Post to Accounting",

            title:
              "Post Payroll to Accounting",

            description:
              "This will recognize the payroll expense, create the payroll liability entry and finalize the payroll period for payment.",

            icon: Send,

            tone: "primary",
          };


        case "LOCKED":
          return {
            endpoint:
              `/api/payroll/periods/${selectedPeriod.id}/pay/`,

            label:
              "Pay Payroll",

            title:
              "Pay Payroll",

            description:
              "This will settle the payroll liability by recording payment of employee net salaries through the configured payment method.",

            icon:
              CircleDollarSign,

            tone: "dark",

            payload: {
              payment_method:
                "BANK",
            },
          };


        default:
          return null;
      }
    }, [
      selectedPeriod,
    ]);


  function openAction() {
    if (!actionConfig) {
      return;
    }

    setNotice("");
    setError("");

    setActionModal(
      actionConfig
    );
  }


  async function executeAction() {
    if (
      !actionModal ||
      !selectedPeriod
    ) {
      return;
    }

    try {
      setActionLoading(
        true
      );

      setError("");
      setNotice("");


      await api.post(
        actionModal.endpoint,
        actionModal.payload ||
          {}
      );


      setActionModal(
        null
      );


      setNotice(
        `${actionModal.label} completed successfully.`
      );


      await loadPeriods(
        true
      );

      await loadRecords();

    } catch (err) {
      setError(
        extractActionError(
          err
        )
      );

      setActionModal(
        null
      );

    } finally {
      setActionLoading(
        false
      );
    }
  }


  // ==========================================================
  // EXPORT APPROVED PAYROLL REGISTER
  // ==========================================================

  async function exportPayrollCsv() {
    if (
      !companyId ||
      !selectedPeriod ||
      !["APPROVED", "LOCKED"].includes(
        selectedPeriod.status
      )
    ) {
      return;
    }

    try {
      setExportLoading(true);
      setError("");
      setNotice("");

      const token =
        localStorage.getItem("access_token");

      const response = await fetch(
        `${API_BASE_URL}/api/payroll/periods/${selectedPeriod.id}/export-csv/`,
        {
          method: "GET",
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        }
      );

      if (!response.ok) {
        let message =
          "Unable to export the payroll register.";

        try {
          const data = await response.json();
          message =
            data?.detail ||
            data?.message ||
            message;
        } catch {
          // Keep the default error message.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const contentDisposition =
        response.headers.get(
          "Content-Disposition"
        );

      let filename =
        `payroll-register-${selectedPeriod.id}.csv`;

      const filenameMatch =
        contentDisposition?.match(
          /filename="?([^";]+)"?/i
        );

      if (filenameMatch?.[1]) {
        filename = filenameMatch[1];
      }

      const url =
        URL.createObjectURL(blob);
      const link =
        document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setNotice(
        "Payroll register CSV exported successfully."
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to export the payroll register."
      );
    } finally {
      setExportLoading(false);
    }
  }


  // ==========================================================
  // GENERATE EMPLOYEE PAYSLIP
  // ==========================================================

  async function generatePayslip(record) {
    if (
      !companyId ||
      !selectedPeriod ||
      !record?.id ||
      !["APPROVED", "LOCKED"].includes(
        selectedPeriod.status
      )
    ) {
      return;
    }

    try {
      setPayslipLoadingId(record.id);
      setError("");
      setNotice("");

      const token =
        localStorage.getItem("access_token");

      const response = await fetch(
        `${API_BASE_URL}/api/payroll/periods/${selectedPeriod.id}/records/${record.id}/payslip/`,
        {
          method: "GET",
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        }
      );

      if (!response.ok) {
        let message =
          "Unable to generate the payslip.";

        try {
          const data = await response.json();
          message =
            data?.detail ||
            data?.message ||
            message;
        } catch {
          // Keep the default error message.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const contentDisposition =
        response.headers.get(
          "Content-Disposition"
        );

      let filename =
        `payslip-${record.id}.pdf`;

      const filenameMatch =
        contentDisposition?.match(
          /filename="?([^";]+)"?/i
        );

      if (filenameMatch?.[1]) {
        filename = filenameMatch[1];
      }

      const url =
        URL.createObjectURL(blob);
      const link =
        document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setNotice(
        `Payslip generated successfully for ${
          employeeName(getEmployee(record))
        }.`
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to generate the payslip."
      );
    } finally {
      setPayslipLoadingId(null);
    }
  }


  // ==========================================================
  // GENERATE BULK PAYSLIPS
  // ==========================================================

  async function generateBulkPayslips() {
    if (
      !companyId ||
      !selectedPeriod ||
      !["APPROVED", "LOCKED"].includes(
        selectedPeriod.status
      ) ||
      records.length === 0
    ) {
      return;
    }

    try {
      setBulkPayslipLoading(true);
      setError("");
      setNotice("");

      const token =
        localStorage.getItem("access_token");

      const response = await fetch(
        `${API_BASE_URL}/api/payroll/periods/${selectedPeriod.id}/bulk-payslips/`,
        {
          method: "GET",
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        }
      );

      if (!response.ok) {
        let message =
          "Unable to generate bulk payslips.";

        try {
          const data = await response.json();
          message =
            data?.detail ||
            data?.message ||
            message;
        } catch {
          // Keep the default error message.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const contentDisposition =
        response.headers.get(
          "Content-Disposition"
        );

      let filename =
        `bulk-payslips-${selectedPeriod.id}.pdf`;

      const filenameMatch =
        contentDisposition?.match(
          /filename="?([^";]+)"?/i
        );

      if (filenameMatch?.[1]) {
        filename = filenameMatch[1];
      }

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      setNotice(
        `Bulk payslips generated successfully for ${records.length} employee${
          records.length === 1 ? "" : "s"
        }.`
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to generate bulk payslips."
      );
    } finally {
      setBulkPayslipLoading(false);
    }
  }


  // ==========================================================
  // RETURN TO DRAFT
  // ==========================================================

  function returnToDraft() {
    if (
      !selectedPeriod ||
      selectedPeriod.status !==
        "PROCESSED"
    ) {
      return;
    }

    setActionModal({
      endpoint:
        `/api/payroll/periods/${selectedPeriod.id}/return-to-draft/`,

      label:
        "Return to Draft",

      title:
        "Return Payroll to Draft",

      description:
        "This will return the processed payroll to Draft so the accountant can correct the payroll inputs, including days missed, earnings, deductions or period settings, before processing again.",

      icon:
        ArrowLeft,

      tone:
        "secondary",
    });
  }


  // ==========================================================
  // EMPTY COMPANY
  // ==========================================================

  if (!companyId) {
    return (
      <div className="payroll-processing-page">

        <div className="pp-empty-company">

          <div className="pp-empty-icon">
            <Users size={26} />
          </div>

          <h2>
            No Company Selected
          </h2>

          <p>
            Select a company before
            processing payroll.
          </p>

        </div>

      </div>
    );
  }


  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <div className="payroll-processing-page">

      {/* PAGE HEADER */}

      <div className="pp-page-header">

        <div>

          <div className="pp-eyebrow">
            PAYROLL WORKFLOW
          </div>

          <h1>
            Payroll Processing
          </h1>

          <p>
            Calculate, review, approve, post
            and pay payroll for the selected
            company.
          </p>

        </div>


        <div className="pp-header-actions">

          {["APPROVED", "LOCKED"].includes(
            selectedPeriod?.status
          ) && (
            <button
              type="button"
              className="pp-export-button"
              onClick={exportPayrollCsv}
              disabled={
                exportLoading ||
                loading ||
                !selectedPeriod
              }
            >
              {exportLoading ? (
                <RefreshCw
                  size={16}
                  className="pp-spin"
                />
              ) : (
                <Download size={16} />
              )}

              {exportLoading
                ? "Exporting..."
                : "Export Payroll CSV"}
            </button>
          )}

          {["APPROVED", "LOCKED"].includes(
            selectedPeriod?.status
          ) && (
            <button
              type="button"
              className="pp-bulk-payslip-button"
              onClick={generateBulkPayslips}
              disabled={
                bulkPayslipLoading ||
                payslipLoadingId !== null ||
                recordsLoading ||
                records.length === 0 ||
                !selectedPeriod
              }
              title={
                records.length === 0
                  ? "No finalized payroll records are available."
                  : "Generate all employee payslips as one PDF"
              }
            >
              {bulkPayslipLoading ? (
                <RefreshCw
                  size={16}
                  className="pp-spin"
                />
              ) : (
                <Printer size={16} />
              )}

              {bulkPayslipLoading
                ? "Generating Payslips..."
                : "Generate Bulk Payslips"}
            </button>
          )}

          <button
            type="button"
            className="pp-refresh-button"
            onClick={() =>
              loadPeriods(true)
            }
            disabled={
              refreshing ||
              loading
            }
          >

            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "pp-spin"
                  : ""
              }
            />

            Refresh

          </button>

        </div>

      </div>


      {/* COMPANY STRIP */}

      <div className="pp-company-strip">

        <div className="pp-company-mark">
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


        <div className="pp-company-currency">

          <span>
            Currency
          </span>

          <strong>
            {currency}
          </strong>

        </div>

      </div>


      {/* ERROR */}

      {error && (
        <div className="pp-alert pp-alert-error">

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


      {/* NOTICE */}

      {notice && (
        <div className="pp-alert pp-alert-success">

          <CheckCircle2 size={17} />

          <span>
            {notice}
          </span>

          <button
            type="button"
            onClick={() =>
              setNotice("")
            }
          >
            <X size={15} />
          </button>

        </div>
      )}


      {/* STAT CARDS */}

      <div className="pp-stat-grid">

        <div className="pp-stat-card">

          <div className="pp-stat-icon pp-icon-blue">
            <Users size={18} />
          </div>

          <div>

            <span>
              Payroll Periods
            </span>

            <strong>
              {periods.length}
            </strong>

            <small>
              {statusCounts.DRAFT} draft
            </small>

          </div>

        </div>


        <div className="pp-stat-card">

          <div className="pp-stat-icon pp-icon-gold">
            <Clock3 size={18} />
          </div>

          <div>

            <span>
              Processed
            </span>

            <strong>
              {statusCounts.PROCESSED}
            </strong>

            <small>
              Awaiting review
            </small>

          </div>

        </div>


        <div className="pp-stat-card">

          <div className="pp-stat-icon pp-icon-navy">
            <CheckCircle2 size={18} />
          </div>

          <div>

            <span>
              Approved
            </span>

            <strong>
              {statusCounts.APPROVED}
            </strong>

            <small>
              Ready to post
            </small>

          </div>

        </div>


        <div className="pp-stat-card">

          <div className="pp-stat-icon pp-icon-dark">
            <LockKeyhole size={18} />
          </div>

          <div>

            <span>
              Locked
            </span>

            <strong>
              {statusCounts.LOCKED}
            </strong>

            <small>
              Posted & ready for payment
            </small>

          </div>

        </div>

      </div>


      {/* MAIN LAYOUT */}

      <div className="pp-layout">

        {/* PERIOD LIST */}

        <section className="pp-period-list-card">

          <div className="pp-section-header">

            <div>

              <div className="pp-section-label">
                PAYROLL PERIODS
              </div>

              <h2>
                Select a payroll period
              </h2>

              <p>
                Choose the payroll run you
                want to process or review.
              </p>

            </div>

          </div>


          <div className="pp-toolbar">

            <div className="pp-search">

              <Search size={16} />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Search employee records..."
              />

            </div>


            <select
              value={
                statusFilter
              }
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
            >

              <option value="ALL">
                All Statuses
              </option>

              {WORKFLOW.map(
                (step) => (
                  <option
                    key={
                      step.key
                    }
                    value={
                      step.key
                    }
                  >
                    {step.label}
                  </option>
                )
              )}

            </select>

          </div>


          <div className="pp-period-list">

            {loading ? (
              <div className="pp-loading">

                <RefreshCw
                  size={21}
                  className="pp-spin"
                />

                Loading payroll periods...

              </div>
            ) : filteredPeriods.length ===
              0 ? (
              <div className="pp-empty">

                <CalendarDays
                  size={25}
                />

                <strong>
                  No payroll periods found
                </strong>

                <span>
                  Create a payroll period
                  first, then return here
                  to process it.
                </span>

              </div>
            ) : (
              filteredPeriods.map(
                (period) => (
                  <button
                    key={
                      period.id
                    }
                    type="button"
                    className={`pp-period-item ${
                      String(
                        selectedPeriodId
                      ) ===
                      String(
                        period.id
                      )
                        ? "pp-period-item-active"
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedPeriodId(
                        period.id
                      );

                      setNotice("");
                      setError("");
                    }}
                  >

                    <div className="pp-period-item-icon">
                      <Clock3 size={17} />
                    </div>


                    <div className="pp-period-item-content">

                      <strong>
                        {period.name ||
                          `Payroll Period #${period.id}`}
                      </strong>

                      <span>
                        {formatDate(
                          period.start_date
                        )}{" "}
                        —{" "}
                        {formatDate(
                          period.end_date
                        )}
                      </span>

                      <small>
                        Pay date:{" "}
                        {formatDate(
                          period.pay_date
                        )}
                      </small>

                    </div>


                    <span
                      className={statusClass(
                        period.status
                      )}
                    >
                      {statusLabel(
                        period.status
                      )}
                    </span>


                    <ChevronRight
                      size={17}
                    />

                  </button>
                )
              )
            )}

          </div>

        </section>


        {/* WORKSPACE */}

        <section className="pp-workspace-card">

          {!selectedPeriod ? (
            <div className="pp-workspace-empty">

              <ClipboardCheck
                size={34}
              />

              <h2>
                Select a payroll period
              </h2>

              <p>
                The payroll review workspace
                will appear here.
              </p>

            </div>
          ) : (
            <>

              {/* WORKSPACE HEADER */}

              <div className="pp-workspace-header">

                <div>

                  <div className="pp-section-label">
                    SELECTED PAYROLL
                  </div>

                  <h2>
                    {selectedPeriod.name ||
                      `Payroll Period #${selectedPeriod.id}`}
                  </h2>

                  <p>
                    {formatDate(
                      selectedPeriod.start_date
                    )}{" "}
                    —{" "}
                    {formatDate(
                      selectedPeriod.end_date
                    )}{" "}
                    · Pay date{" "}
                    {formatDate(
                      selectedPeriod.pay_date
                    )}
                  </p>

                </div>


                <span
                  className={statusClass(
                    selectedPeriod.status
                  )}
                >
                  {statusLabel(
                    selectedPeriod.status
                  )}
                </span>

              </div>


              {/* PERIOD INPUT SUMMARY */}

              <div className="pp-financial-grid">

                <div>
                  <span>
                    Currency
                  </span>

                  <strong>
                    {currency}
                  </strong>
                </div>


                <div>
                  <span>
                    Exchange Rate
                  </span>

                  <strong>
                    {Number(
                      selectedPeriod.exchange_rate ||
                        1
                    ).toFixed(6)}
                  </strong>
                </div>


                <div>
                  <span>
                    Working Days
                  </span>

                  <strong>
                    {Number(
                      selectedPeriod.working_days ||
                        0
                    ).toFixed(2)}
                  </strong>
                </div>


                <div>
                  <span>
                    Employee NASSCORP
                  </span>

                  <strong>
                    {Number(
                      selectedPeriod.social_security_employee_rate ??
                        4
                    ).toFixed(2)}
                    %
                  </strong>
                </div>


                <div>
                  <span>
                    Employer NASSCORP
                  </span>

                  <strong>
                    {Number(
                      selectedPeriod.social_security_employer_rate ??
                        6
                    ).toFixed(2)}
                    %
                  </strong>
                </div>

              </div>


              {/* WORKFLOW */}

              <div className="pp-workflow">

                {WORKFLOW.map(
                  (
                    step,
                    index
                  ) => {
                    const Icon =
                      step.icon;

                    const active =
                      step.key ===
                      selectedPeriod.status;

                    const complete =
                      index <
                      currentStep;

                    return (
                      <React.Fragment
                        key={
                          step.key
                        }
                      >

                        <div
                          className={`pp-workflow-step ${
                            active
                              ? "pp-workflow-active"
                              : ""
                          } ${
                            complete
                              ? "pp-workflow-complete"
                              : ""
                          }`}
                        >

                          <div className="pp-workflow-icon">
                            <Icon
                              size={16}
                            />
                          </div>


                          <div>

                            <strong>
                              {step.label}
                            </strong>

                            <span>
                              {
                                step.description
                              }
                            </span>

                          </div>

                        </div>


                        {index <
                          WORKFLOW.length -
                            1 && (
                          <div
                            className={`pp-workflow-line ${
                              index <
                              currentStep
                                ? "pp-workflow-line-complete"
                                : ""
                            }`}
                          />
                        )}

                      </React.Fragment>
                    );
                  }
                )}

              </div>


              {/* ACTION BAR */}

              <div className="pp-action-bar">

                <div>

                  <span>
                    Next workflow action
                  </span>

                  <strong>
                    {actionConfig?.label ||
                      (selectedPeriod.status ===
                      "LOCKED"
                        ? "Payroll ready for payment"
                        : "No action available")}
                  </strong>

                </div>


                <div className="pp-action-buttons">

                  {selectedPeriod.status ===
                    "PROCESSED" && (
                    <button
                      type="button"
                      className="pp-secondary-button"
                      onClick={
                        returnToDraft
                      }
                    >

                      <ArrowLeft
                        size={15}
                      />

                      Return to Draft

                    </button>
                  )}


                  {actionConfig && (
                    <button
                      type="button"
                      className={`pp-primary-button ${
                        actionConfig.tone ===
                        "dark"
                          ? "pp-button-dark"
                          : ""
                      }`}
                      onClick={
                        openAction
                      }
                    >

                      {(() => {
                        const ActionIcon =
                          actionConfig.icon;

                        return (
                          <ActionIcon
                            size={15}
                          />
                        );
                      })()}

                      {
                        actionConfig.label
                      }

                    </button>
                  )}

                </div>

              </div>


              {/* FINANCIAL SUMMARY */}

              <div className="pp-financial-grid">

                {[
                  [
                    "Employees",
                    records.length,
                    "count",
                  ],

                  [
                    "Basic Salary",
                    totals.basic,
                  ],

                  [
                    "Total Earnings",
                    totals.earnings,
                  ],

                  [
                    "Absence Deduction",
                    totals.absence,
                  ],

                  [
                    "Gross Pay",
                    totals.gross,
                  ],

                  [
                    "Taxable Income",
                    totals.taxable,
                  ],

                  [
                    "PAYE",
                    totals.paye,
                  ],

                  [
                    "Employee NASSCORP",
                    totals.employeeNasscorp,
                  ],

                  [
                    "Employer NASSCORP",
                    totals.employerNasscorp,
                  ],

                  [
                    "Total Deductions",
                    totals.deductions,
                  ],

                  [
                    "Net Pay",
                    totals.net,
                  ],

                  [
                    "Employer Cost",
                    totals.employerCost,
                  ],
                ].map(
                  ([
                    label,
                    value,
                    type,
                  ]) => (
                    <div
                      key={
                        label
                      }
                      className={
                        label ===
                        "Net Pay"
                          ? "pp-financial-highlight"
                          : ""
                      }
                    >

                      <span>
                        {label}
                      </span>

                      <strong>
                        {type ===
                        "count"
                          ? value
                          : formatMoney(
                              value,
                              currency
                            )}
                      </strong>

                    </div>
                  )
                )}

              </div>


              {/* PAYROLL RECORDS */}

              <div className="pp-records-section">

                <div className="pp-records-header">

                  <div>

                    <h3>
                      Payroll Records
                    </h3>

                    <p>
                      Final payroll calculations
                      returned by the backend.
                    </p>

                  </div>


                  <span>
                    {
                      filteredRecords.length
                    }{" "}
                    record
                    {
                      filteredRecords.length ===
                      1
                        ? ""
                        : "s"
                    }
                  </span>

                </div>


                {recordsLoading ? (
                  <div className="pp-loading">

                    <RefreshCw
                      size={19}
                      className="pp-spin"
                    />

                    Loading payroll
                    records...

                  </div>
                ) : filteredRecords.length ===
                  0 ? (
                  <div className="pp-empty-records">

                    <ClipboardCheck
                      size={28}
                    />

                    <strong>
                      No payroll records yet
                    </strong>

                    <span>
                      {selectedPeriod.status ===
                      "DRAFT"
                        ? "Configure days missed and payroll items, then process this payroll period to calculate employee payroll."
                        : "No employee records were returned for this period."}
                    </span>

                  </div>
                ) : (
                  <div className="pp-table-wrapper">

                    <table className="pp-table">

                      <thead>

                        <tr>

                          <th>
                            Employee
                          </th>

                          <th>
                            Basic Salary
                          </th>

                          <th>
                            Earnings
                          </th>

                          <th>
                            Days Missed
                          </th>

                          <th>
                            Absence Deduction
                          </th>

                          <th>
                            Gross Pay
                          </th>

                          <th>
                            Taxable Income
                          </th>

                          <th>
                            PAYE (LRA)
                          </th>

                          <th>
                            Employee NASSCORP
                          </th>

                          <th>
                            Total Deductions
                          </th>

                          <th>
                            Net Pay
                          </th>

                          <th>
                            Employer NASSCORP
                          </th>

                          <th>
                            Employer Cost
                          </th>

                          <th>
                            Payslip
                          </th>

                        </tr>

                      </thead>


                      <tbody>

                        {filteredRecords.map(
                          (record) => {

                            const employee =
                              getEmployee(
                                record
                              );

                            const resolvedName =
                              employeeName(
                                employee
                              );


                            return (
                              <tr
                                key={
                                  record.id
                                }
                              >

                                <td>

                                  <div className="pp-employee-cell">

                                    <div className="pp-avatar">
                                      {initials(
                                        record
                                      )}
                                    </div>


                                    <div>

                                      <strong>
                                        {resolvedName ===
                                        "Unknown Employee"
                                          ? record.employee_name ||
                                            "Unknown Employee"
                                          : resolvedName}
                                      </strong>

                                      <span>
                                        {employee?.employee_number ||
                                          record.employee_number ||
                                          "Employee record"}
                                      </span>

                                    </div>

                                  </div>

                                </td>


                                <td>
                                  {formatMoney(
                                    record.basic_salary,
                                    currency
                                  )}
                                </td>


                                <td>
                                  {formatMoney(
                                    record.total_earnings,
                                    currency
                                  )}
                                </td>


                                <td>
                                  {Number(
                                    record.absent_days ||
                                      0
                                  ).toFixed(
                                    2
                                  )}
                                </td>


                                <td>
                                  {formatMoney(
                                    record.absence_deduction,
                                    currency
                                  )}
                                </td>


                                <td>
                                  {formatMoney(
                                    record.gross_pay,
                                    currency
                                  )}
                                </td>


                                <td>
                                  {formatMoney(
                                    record.taxable_income,
                                    currency
                                  )}
                                </td>


                                <td>
                                  {formatMoney(
                                    record.paye_tax,
                                    currency
                                  )}
                                </td>


                                <td>
                                  {formatMoney(
                                    record.social_security_employee,
                                    currency
                                  )}
                                </td>


                                <td>
                                  {formatMoney(
                                    record.total_deductions,
                                    currency
                                  )}
                                </td>


                                <td>

                                  <strong>
                                    {formatMoney(
                                      record.net_pay,
                                      currency
                                    )}
                                  </strong>

                                </td>


                                <td>
                                  {formatMoney(
                                    record.social_security_employer,
                                    currency
                                  )}
                                </td>


                                <td>
                                  {formatMoney(
                                    record.employer_cost,
                                    currency
                                  )}
                                </td>

                                <td>
                                  {selectedPeriod.status ===
                                    "APPROVED" ||
                                  selectedPeriod.status ===
                                    "LOCKED" ? (
                                    <button
                                      type="button"
                                      className="pp-payslip-button"
                                      onClick={() =>
                                        generatePayslip(
                                          record
                                        )
                                      }
                                      disabled={
                                        payslipLoadingId ===
                                        record.id
                                      }
                                      title="Generate employee payslip"
                                    >
                                      {payslipLoadingId ===
                                      record.id ? (
                                        <>
                                          <RefreshCw
                                            size={14}
                                            className="pp-spin"
                                          />
                                          Generating...
                                        </>
                                      ) : (
                                        <>
                                          <Download
                                            size={14}
                                          />
                                          Payslip
                                        </>
                                      )}
                                    </button>
                                  ) : (
                                    <span className="pp-payslip-unavailable">
                                      After approval
                                    </span>
                                  )}
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

            </>
          )}

        </section>

      </div>


      {/* ======================================================
          ACTION CONFIRMATION MODAL
      ====================================================== */}

      {actionModal && (
        <div
          className="pp-modal-backdrop"
          role="presentation"
        >

          <div
            className="pp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pp-action-title"
          >

            <div className="pp-modal-icon">

              {(() => {
                const ActionIcon =
                  actionModal.icon;

                return (
                  <ActionIcon
                    size={21}
                  />
                );
              })()}

            </div>


            <div className="pp-modal-body">

              <h2 id="pp-action-title">
                {actionModal.title}
              </h2>

              <p>
                {actionModal.description}
              </p>


              <div className="pp-modal-period">

                <span>
                  Payroll Period
                </span>

                <strong>
                  {
                    selectedPeriod?.name
                  }
                </strong>

                <small>
                  {formatDate(
                    selectedPeriod?.start_date
                  )}{" "}
                  —{" "}
                  {formatDate(
                    selectedPeriod?.end_date
                  )}
                </small>

              </div>


              {/* PROCESSING INPUT REMINDER */}

              {selectedPeriod?.status ===
                "DRAFT" && (
                <div className="pp-modal-period">

                  <span>
                    Calculation Inputs
                  </span>

                  <strong>
                    Exchange Rate:{" "}
                    {Number(
                      selectedPeriod.exchange_rate ||
                        1
                    ).toFixed(6)}
                  </strong>

                  <small>
                    Working Days:{" "}
                    {Number(
                      selectedPeriod.working_days ||
                        0
                    ).toFixed(2)}
                    {" · "}
                    Employee NASSCORP:{" "}
                    {Number(
                      selectedPeriod.social_security_employee_rate ??
                        4
                    ).toFixed(2)}
                    %
                    {" · "}
                    Employer NASSCORP:{" "}
                    {Number(
                      selectedPeriod.social_security_employer_rate ??
                        6
                    ).toFixed(2)}
                    %
                  </small>

                </div>
              )}

            </div>


            <div className="pp-modal-footer">

              <button
                type="button"
                className="pp-secondary-button"
                onClick={() =>
                  setActionModal(
                    null
                  )
                }
                disabled={
                  actionLoading
                }
              >
                Cancel
              </button>


              <button
                type="button"
                className={`pp-primary-button ${
                  actionModal.tone ===
                  "dark"
                    ? "pp-button-dark"
                    : ""
                }`}
                onClick={
                  executeAction
                }
                disabled={
                  actionLoading
                }
              >

                {actionLoading ? (
                  <RefreshCw
                    size={15}
                    className="pp-spin"
                  />
                ) : (
                  (() => {
                    const ActionIcon =
                      actionModal.icon;

                    return (
                      <ActionIcon
                        size={15}
                      />
                    );
                  })()
                )}


                {actionLoading
                  ? "Processing..."
                  : actionModal.label}

              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}