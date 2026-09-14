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
  ClipboardList,
  Download,
  FileBarChart,
  RefreshCw,
  Search,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";

function extractList(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response?.records)) return response.records;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.remittances)) {
    return response.remittances;
  }

  return [];
}

function money(value, currency) {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))} ${currency}`;
}

function number(value) {
  return Number(value || 0);
}

function formatDate(value) {
  if (!value) return "—";

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

function getEmployeeId(record) {
  if (
    typeof record?.employee === "number" ||
    typeof record?.employee === "string"
  ) {
    return record.employee;
  }

  return (
    record?.employee_id ??
    record?.employee?.id ??
    record?.employee?.pk ??
    null
  );
}

function getEmployee(record, employees = []) {
  if (
    record?.employee &&
    typeof record.employee === "object"
  ) {
    return record.employee;
  }

  const employeeId = getEmployeeId(record);

  if (employeeId == null) {
    return null;
  }

  return (
    employees.find(
      (employee) =>
        String(employee.id) ===
        String(employeeId)
    ) || null
  );
}

function getPeriodId(record) {
  return (
    record?.payroll_period?.id ??
    record?.payroll_period_id ??
    (
      typeof record?.payroll_period === "number" ||
      typeof record?.payroll_period === "string"
        ? record.payroll_period
        : null
    ) ??
    record?.period_id ??
    record?.period?.id ??
    record?.period ??
    null
  );
}

function getPeriodName(periods, id) {
  const period = periods.find(
    (item) =>
      String(item.id) === String(id)
  );

  return (
    period?.name ||
    (id
      ? `Payroll Period #${id}`
      : "Unknown Period")
  );
}

function getTypeName(item, fields = []) {
  for (const field of fields) {
    const value = item?.[field];

    if (
      value &&
      typeof value === "object"
    ) {
      return (
        value.name ||
        value.code ||
        "Unknown"
      );
    }

    if (value) {
      return String(value);
    }
  }

  return (
    item?.earning_type_name ||
    item?.deduction_type_name ||
    "Unknown"
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
  return `pr-status pr-status-${String(
    status || "unknown"
  ).toLowerCase()}`;
}

function errorMessage(error) {
  const data = error?.data;

  if (data?.detail) {
    return data.detail;
  }

  if (data?.message) {
    return data.message;
  }

  if (
    data &&
    typeof data === "object"
  ) {
    return Object.entries(data)
      .map(
        ([key, value]) =>
          `${key}: ${
            Array.isArray(value)
              ? value.join(", ")
              : value
          }`
      )
      .join(" ");
  }

  return (
    error?.message ||
    "Unable to load payroll reports."
  );
}

export default function PayrollReports() {
  const { currentCompany } = useCompany();

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

  const [employees, setEmployees] =
    useState([]);

  const [remittances, setRemittances] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [periodFilter, setPeriodFilter] =
    useState("ALL");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [activeReport, setActiveReport] =
    useState("register");

  const loadReports = useCallback(
    async (refresh = false) => {
      if (!companyId) {
        setPeriods([]);
        setRecords([]);
        setEmployees([]);
        setRemittances([]);
        setLoading(false);
        return;
      }

      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const [
          periodsResponse,
          recordsResponse,
          employeesResponse,
          remittancesResponse,
        ] = await Promise.all([
          api.get(
            `/api/payroll/periods/?company=${companyId}`
          ),

          api.get(
            `/api/payroll/records/?company=${companyId}`
          ),

          api.get(
            `/api/payroll/employees/?company=${companyId}`
          ),

          api.get(
            `/api/payroll/remittances/?company=${companyId}`
          ),
        ]);

        setPeriods(
          extractList(periodsResponse)
        );

        setRecords(
          extractList(recordsResponse)
        );

        setEmployees(
          extractList(employeesResponse)
        );

        setRemittances(
          extractList(
            remittancesResponse
          )
        );
      } catch (err) {
        setError(
          errorMessage(err)
        );

        setPeriods([]);
        setRecords([]);
        setEmployees([]);
        setRemittances([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId]
  );

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const filteredPeriods = useMemo(() => {
    return periods.filter((period) => {
      const statusMatch =
        statusFilter === "ALL" ||
        period.status === statusFilter;

      return statusMatch;
    });
  }, [
    periods,
    statusFilter,
  ]);

  const filteredRecords = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return records.filter(
      (record) => {
        const periodId =
          getPeriodId(record);

        const periodMatch =
          periodFilter === "ALL" ||
          String(periodId) ===
            String(periodFilter);

        const employee =
          getEmployee(record, employees);

        const text = [
          employeeName(employee),
          employee?.employee_number,
          employee?.department,
          employee?.position,
          record.employee_name,
          record.employee_number,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const searchMatch =
          !query ||
          text.includes(query);

        return (
          periodMatch &&
          searchMatch
        );
      }
    );
  }, [
    records,
    employees,
    search,
    periodFilter,
  ]);

  const filteredRemittances =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return remittances.filter(
        (item) => {
          const periodId =
            item?.payroll_period?.id ??
            item?.payroll_period_id ??
            (
              typeof item?.payroll_period ===
                "number" ||
              typeof item?.payroll_period ===
                "string"
                ? item.payroll_period
                : null
            );

          const periodMatch =
            periodFilter === "ALL" ||
            String(periodId) ===
              String(periodFilter);

          const deductionName =
            getTypeName(item, [
              "deduction_type",
            ]);

          const text = [
            deductionName,
            item.reference,
            item.description,
            item.payment_method,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const searchMatch =
            !query ||
            text.includes(query);

          return (
            periodMatch &&
            searchMatch
          );
        }
      );
    }, [
      remittances,
      search,
      periodFilter,
    ]);

  const totals = useMemo(() => {
    return filteredRecords.reduce(
      (total, record) => ({
        basic:
          total.basic +
          number(
            record.basic_salary
          ),

        earnings:
          total.earnings +
          number(
            record.total_earnings
          ),

        gross:
          total.gross +
          number(
            record.gross_pay
          ),

        deductions:
          total.deductions +
          number(
            record.total_deductions
          ),

        net:
          total.net +
          number(
            record.net_pay
          ),

        employer:
          total.employer +
          number(
            record.employer_cost
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
  }, [filteredRecords]);

  const remittanceTotal =
    useMemo(
      () =>
        filteredRemittances.reduce(
          (total, item) =>
            total +
            number(item.amount),
          0
        ),
      [filteredRemittances]
    );

  const periodStats = useMemo(() => {
    return {
      total: periods.length,

      draft: periods.filter(
        (p) => p.status === "DRAFT"
      ).length,

      processed: periods.filter(
        (p) =>
          p.status === "PROCESSED"
      ).length,

      approved: periods.filter(
        (p) =>
          p.status === "APPROVED"
      ).length,

      locked: periods.filter(
        (p) =>
          p.status === "LOCKED"
      ).length,
    };
  }, [periods]);

  const employeeCount =
    filteredRecords.length;

  const exportCsv = () => {
    let headers = [];
    let rows = [];
    let filename =
      "payroll-report.csv";

    if (
      activeReport ===
      "register"
    ) {
      headers = [
        "Employee",
        "Employee Number",
        "Payroll Period",
        "Basic Salary",
        "Earnings",
        "Gross Pay",
        "Deductions",
        "Net Pay",
        "Employer Cost",
      ];

      rows =
        filteredRecords.map(
          (record) => {
            const employee =
              getEmployee(record, employees);

            return [
              employeeName(
                employee
              ),
              employee?.employee_number ||
                record.employee_number ||
                "",
              getPeriodName(
                periods,
                getPeriodId(record)
              ),
              record.basic_salary ||
                0,
              record.total_earnings ||
                0,
              record.gross_pay ||
                0,
              record.total_deductions ||
                0,
              record.net_pay ||
                0,
              record.employer_cost ||
                0,
            ];
          }
        );

      filename =
        `payroll-register-${companyId}.csv`;
    }

    if (
      activeReport ===
      "remittances"
    ) {
      headers = [
        "Payroll Period",
        "Deduction Type",
        "Amount",
        "Remittance Date",
        "Payment Method",
        "Reference",
        "Description",
      ];

      rows =
        filteredRemittances.map(
          (item) => {
            const periodId =
              item?.payroll_period?.id ??
              item?.payroll_period_id ??
              (
                typeof item?.payroll_period ===
                  "number" ||
                typeof item?.payroll_period ===
                  "string"
                  ? item.payroll_period
                  : null
              );

            return [
              getPeriodName(
                periods,
                periodId
              ),
              getTypeName(item, [
                "deduction_type",
              ]),
              item.amount || 0,
              item.remittance_date ||
                "",
              item.payment_method ||
                "",
              item.reference || "",
              item.description || "",
            ];
          }
        );

      filename =
        `payroll-remittances-${companyId}.csv`;
    }

    if (
      activeReport ===
      "periods"
    ) {
      headers = [
        "Payroll Period",
        "Start Date",
        "End Date",
        "Pay Date",
        "Status",
        "Employee Records",
      ];

      rows =
        filteredPeriods.map(
          (period) => [
            period.name ||
              `Payroll Period #${period.id}`,
            period.start_date || "",
            period.end_date || "",
            period.pay_date || "",
            statusLabel(
              period.status
            ),
            records.filter(
              (record) =>
                String(
                  getPeriodId(
                    record
                  )
                ) ===
                String(period.id)
            ).length,
          ]
        );

      filename =
        `payroll-period-history-${companyId}.csv`;
    }

    if (!headers.length) {
      return;
    }

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) => {
            const text =
              String(
                value ?? ""
              );

            return `"${text.replaceAll(
              '"',
              '""'
            )}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob =
      new Blob(
        [csv],
        {
          type: "text/csv;charset=utf-8;",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;
    link.download = filename;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
  };

  if (!companyId) {
    return (
      <div className="payroll-reports-page">
        <div className="pr-empty-company">
          <Users size={28} />

          <h2>
            No Company Selected
          </h2>

          <p>
            Select a company before
            viewing payroll reports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="payroll-reports-page">
      {/* HEADER */}
      <div className="pr-page-header">
        <div>
          <div className="pr-eyebrow">
            REPORTS / PAYROLL
          </div>

          <h1>
            Payroll Reports
          </h1>

          <p>
            Review payroll registers,
            payroll summaries, deductions,
            remittances and payroll period
            history for {companyName}.
          </p>
        </div>

        <button
          type="button"
          className="pr-refresh-button"
          onClick={() =>
            loadReports(true)
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
                ? "pr-spin"
                : ""
            }
          />

          Refresh
        </button>
      </div>

      {/* COMPANY STRIP */}
      <div className="pr-company-strip">
        <div className="pr-company-mark">
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

        <div className="pr-company-currency">
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
        <div className="pr-alert">
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

      {/* KPI CARDS */}
      <div className="pr-kpi-grid">
        <div className="pr-kpi-card">
          <div className="pr-kpi-icon pr-icon-blue">
            <CalendarDays
              size={19}
            />
          </div>

          <div>
            <span>
              Payroll Periods
            </span>

            <strong>
              {periodStats.total}
            </strong>

            <small>
              {periodStats.draft} draft
            </small>
          </div>
        </div>

        <div className="pr-kpi-card">
          <div className="pr-kpi-icon pr-icon-gold">
            <Users size={19} />
          </div>

          <div>
            <span>
              Payroll Records
            </span>

            <strong>
              {records.length}
            </strong>

            <small>
              Employee payroll records
            </small>
          </div>
        </div>

        <div className="pr-kpi-card">
          <div className="pr-kpi-icon pr-icon-navy">
            <WalletCards
              size={19}
            />
          </div>

          <div>
            <span>
              Total Net Pay
            </span>

            <strong>
              {money(
                totals.net,
                currency
              )}
            </strong>

            <small>
              Current report filter
            </small>
          </div>
        </div>

        <div className="pr-kpi-card">
          <div className="pr-kpi-icon pr-icon-dark">
            <ClipboardList
              size={19}
            />
          </div>

          <div>
            <span>
              Remittances
            </span>

            <strong>
              {money(
                remittanceTotal,
                currency
              )}
            </strong>

            <small>
              {remittances.length} recorded
            </small>
          </div>
        </div>
      </div>

      {/* REPORT NAVIGATION */}
      <div className="pr-report-tabs">
        <button
          type="button"
          className={
            activeReport ===
            "register"
              ? "pr-report-tab pr-report-tab-active"
              : "pr-report-tab"
          }
          onClick={() =>
            setActiveReport(
              "register"
            )
          }
        >
          <ClipboardList
            size={16}
          />

          Payroll Register
        </button>

        <button
          type="button"
          className={
            activeReport ===
            "summary"
              ? "pr-report-tab pr-report-tab-active"
              : "pr-report-tab"
          }
          onClick={() =>
            setActiveReport(
              "summary"
            )
          }
        >
          <FileBarChart
            size={16}
          />

          Payroll Summary
        </button>

        <button
          type="button"
          className={
            activeReport ===
            "remittances"
              ? "pr-report-tab pr-report-tab-active"
              : "pr-report-tab"
          }
          onClick={() =>
            setActiveReport(
              "remittances"
            )
          }
        >
          <WalletCards
            size={16}
          />

          Remittances
        </button>

        <button
          type="button"
          className={
            activeReport ===
            "periods"
              ? "pr-report-tab pr-report-tab-active"
              : "pr-report-tab"
          }
          onClick={() =>
            setActiveReport(
              "periods"
            )
          }
        >
          <CalendarDays
            size={16}
          />

          Period History
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="pr-filter-card">
        <div className="pr-search">
          <Search size={16} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder={
              activeReport ===
              "remittances"
                ? "Search deduction, reference or description..."
                : "Search employee..."
            }
          />
        </div>

        <select
          value={periodFilter}
          onChange={(event) =>
            setPeriodFilter(
              event.target.value
            )
          }
        >
          <option value="ALL">
            All Payroll Periods
          </option>

          {periods.map(
            (period) => (
              <option
                key={period.id}
                value={period.id}
              >
                {period.name ||
                  `Payroll Period #${period.id}`}
              </option>
            )
          )}
        </select>

        {activeReport ===
          "periods" && (
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
        )}

        <button
          type="button"
          className="pr-export-button"
          onClick={exportCsv}
        >
          <Download size={15} />

          Export CSV
        </button>
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className="pr-loading">
          <RefreshCw
            size={22}
            className="pr-spin"
          />

          Loading payroll reports...
        </div>
      ) : (
        <>
          {/* REGISTER */}
          {activeReport ===
            "register" && (
            <section className="pr-report-card">
              <div className="pr-report-header">
                <div>
                  <div className="pr-section-label">
                    PAYROLL REGISTER
                  </div>

                  <h2>
                    Employee Payroll Register
                  </h2>

                  <p>
                    Finalized payroll
                    records calculated
                    for each employee.
                  </p>
                </div>

                <div className="pr-header-total">
                  <span>
                    Total Net Pay
                  </span>

                  <strong>
                    {money(
                      totals.net,
                      currency
                    )}
                  </strong>
                </div>
              </div>

              <div className="pr-summary-strip">
                <div>
                  <span>
                    Employees
                  </span>

                  <strong>
                    {employeeCount}
                  </strong>
                </div>

                <div>
                  <span>
                    Basic Salary
                  </span>

                  <strong>
                    {money(
                      totals.basic,
                      currency
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Earnings
                  </span>

                  <strong>
                    {money(
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
                    {money(
                      totals.gross,
                      currency
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Deductions
                  </span>

                  <strong>
                    {money(
                      totals.deductions,
                      currency
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Employer Cost
                  </span>

                  <strong>
                    {money(
                      totals.employer,
                      currency
                    )}
                  </strong>
                </div>
              </div>

              {filteredRecords.length ===
              0 ? (
                <div className="pr-empty">
                  <ClipboardList
                    size={29}
                  />

                  <strong>
                    No payroll records found
                  </strong>

                  <span>
                    Payroll records will
                    appear here after a
                    payroll period has been
                    processed.
                  </span>
                </div>
              ) : (
                <div className="pr-table-wrapper">
                  <table className="pr-table">
                    <thead>
                      <tr>
                        <th>
                          Employee
                        </th>

                        <th>
                          Payroll Period
                        </th>

                        <th>
                          Basic Salary
                        </th>

                        <th>
                          Earnings
                        </th>

                        <th>
                          Gross Pay
                        </th>

                        <th>
                          Deductions
                        </th>

                        <th>
                          Net Pay
                        </th>

                        <th>
                          Employer Cost
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredRecords.map(
                        (record) => {
                          const employee =
                            getEmployee(
                              record,
                              employees
                            );

                          return (
                            <tr
                              key={
                                record.id
                              }
                            >
                              <td>
                                <div className="pr-employee">
                                  <div className="pr-avatar">
                                    {employeeName(
                                      employee
                                    )
                                      .split(
                                        " "
                                      )
                                      .map(
                                        (
                                          part
                                        ) =>
                                          part[0]
                                      )
                                      .filter(
                                        Boolean
                                      )
                                      .slice(
                                        0,
                                        2
                                      )
                                      .join(
                                        ""
                                      )
                                      .toUpperCase()}
                                  </div>

                                  <div>
                                    <strong>
                                      {employeeName(
                                        employee
                                      )}
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
                                {getPeriodName(
                                  periods,
                                  getPeriodId(
                                    record
                                  )
                                )}
                              </td>

                              <td>
                                {money(
                                  record.basic_salary,
                                  currency
                                )}
                              </td>

                              <td>
                                {money(
                                  record.total_earnings,
                                  currency
                                )}
                              </td>

                              <td>
                                {money(
                                  record.gross_pay,
                                  currency
                                )}
                              </td>

                              <td>
                                {money(
                                  record.total_deductions,
                                  currency
                                )}
                              </td>

                              <td>
                                <strong>
                                  {money(
                                    record.net_pay,
                                    currency
                                  )}
                                </strong>
                              </td>

                              <td>
                                {money(
                                  record.employer_cost,
                                  currency
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
            </section>
          )}

          {/* SUMMARY */}
          {activeReport ===
            "summary" && (
            <section className="pr-report-card">
              <div className="pr-report-header">
                <div>
                  <div className="pr-section-label">
                    PAYROLL SUMMARY
                  </div>

                  <h2>
                    Payroll Financial Summary
                  </h2>

                  <p>
                    Consolidated payroll
                    values based on finalized
                    employee payroll records.
                  </p>
                </div>
              </div>

              <div className="pr-large-summary-grid">
                <div>
                  <span>
                    Employee Records
                  </span>

                  <strong>
                    {employeeCount}
                  </strong>
                </div>

                <div>
                  <span>
                    Basic Salary
                  </span>

                  <strong>
                    {money(
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
                    {money(
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
                    {money(
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
                    {money(
                      totals.deductions,
                      currency
                    )}
                  </strong>
                </div>

                <div className="pr-highlight">
                  <span>
                    Net Pay
                  </span>

                  <strong>
                    {money(
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
                    {money(
                      totals.employer,
                      currency
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Remittances
                  </span>

                  <strong>
                    {money(
                      remittanceTotal,
                      currency
                    )}
                  </strong>
                </div>
              </div>

              <div className="pr-formula">
                <div>
                  <span>
                    Basic Salary
                  </span>

                  <strong>
                    {money(
                      totals.basic,
                      currency
                    )}
                  </strong>
                </div>

                <span>
                  +
                </span>

                <div>
                  <span>
                    Earnings
                  </span>

                  <strong>
                    {money(
                      totals.earnings,
                      currency
                    )}
                  </strong>
                </div>

                <span>
                  =
                </span>

                <div className="pr-formula-result">
                  <span>
                    Gross Pay
                  </span>

                  <strong>
                    {money(
                      totals.gross,
                      currency
                    )}
                  </strong>
                </div>

                <span>
                  −
                </span>

                <div>
                  <span>
                    Deductions
                  </span>

                  <strong>
                    {money(
                      totals.deductions,
                      currency
                    )}
                  </strong>
                </div>

                <span>
                  =
                </span>

                <div className="pr-formula-result">
                  <span>
                    Net Pay
                  </span>

                  <strong>
                    {money(
                      totals.net,
                      currency
                    )}
                  </strong>
                </div>
              </div>
            </section>
          )}

          {/* REMITTANCES */}
          {activeReport ===
            "remittances" && (
            <section className="pr-report-card">
              <div className="pr-report-header">
                <div>
                  <div className="pr-section-label">
                    PAYROLL REMITTANCES
                  </div>

                  <h2>
                    Deduction Remittance Report
                  </h2>

                  <p>
                    Recorded settlement of
                    payroll deductions and
                    related payroll liabilities.
                  </p>
                </div>

                <div className="pr-header-total">
                  <span>
                    Total Remitted
                  </span>

                  <strong>
                    {money(
                      remittanceTotal,
                      currency
                    )}
                  </strong>
                </div>
              </div>

              {filteredRemittances.length ===
              0 ? (
                <div className="pr-empty">
                  <WalletCards
                    size={29}
                  />

                  <strong>
                    No remittances found
                  </strong>

                  <span>
                    Payroll remittances will
                    appear here when recorded.
                  </span>
                </div>
              ) : (
                <div className="pr-table-wrapper">
                  <table className="pr-table">
                    <thead>
                      <tr>
                        <th>
                          Payroll Period
                        </th>

                        <th>
                          Deduction Type
                        </th>

                        <th>
                          Amount
                        </th>

                        <th>
                          Remittance Date
                        </th>

                        <th>
                          Payment Method
                        </th>

                        <th>
                          Reference
                        </th>

                        <th>
                          Description
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredRemittances.map(
                        (item) => {
                          const periodId =
                            item?.payroll_period?.id ??
                            item?.payroll_period_id ??
                            (
                              typeof item?.payroll_period ===
                                "number" ||
                              typeof item?.payroll_period ===
                                "string"
                                ? item.payroll_period
                                : null
                            );

                          return (
                            <tr
                              key={
                                item.id
                              }
                            >
                              <td>
                                {getPeriodName(
                                  periods,
                                  periodId
                                )}
                              </td>

                              <td>
                                <strong>
                                  {getTypeName(
                                    item,
                                    [
                                      "deduction_type",
                                    ]
                                  )}
                                </strong>
                              </td>

                              <td>
                                <strong>
                                  {money(
                                    item.amount,
                                    currency
                                  )}
                                </strong>
                              </td>

                              <td>
                                {formatDate(
                                  item.remittance_date
                                )}
                              </td>

                              <td>
                                <span className="pr-method">
                                  {item.payment_method ||
                                    "—"}
                                </span>
                              </td>

                              <td>
                                {item.reference ||
                                  "—"}
                              </td>

                              <td>
                                {item.description ||
                                  "—"}
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
          )}

          {/* PERIOD HISTORY */}
          {activeReport ===
            "periods" && (
            <section className="pr-report-card">
              <div className="pr-report-header">
                <div>
                  <div className="pr-section-label">
                    PAYROLL HISTORY
                  </div>

                  <h2>
                    Payroll Period History
                  </h2>

                  <p>
                    Historical payroll periods,
                    processing status and
                    employee record counts.
                  </p>
                </div>
              </div>

              {filteredPeriods.length ===
              0 ? (
                <div className="pr-empty">
                  <CalendarDays
                    size={29}
                  />

                  <strong>
                    No payroll periods found
                  </strong>

                  <span>
                    Payroll periods will
                    appear here once created.
                  </span>
                </div>
              ) : (
                <div className="pr-table-wrapper">
                  <table className="pr-table">
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
                          Employees
                        </th>

                        <th>
                          Gross Pay
                        </th>

                        <th>
                          Net Pay
                        </th>

                        <th>
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredPeriods.map(
                        (period) => {
                          const periodRecords =
                            records.filter(
                              (
                                record
                              ) =>
                                String(
                                  getPeriodId(
                                    record
                                  )
                                ) ===
                                String(
                                  period.id
                                )
                            );

                          const periodGross =
                            periodRecords.reduce(
                              (
                                total,
                                record
                              ) =>
                                total +
                                number(
                                  record.gross_pay
                                ),
                              0
                            );

                          const periodNet =
                            periodRecords.reduce(
                              (
                                total,
                                record
                              ) =>
                                total +
                                number(
                                  record.net_pay
                                ),
                              0
                            );

                          return (
                            <tr
                              key={
                                period.id
                              }
                            >
                              <td>
                                <strong>
                                  {period.name ||
                                    `Payroll Period #${period.id}`}
                                </strong>
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
                                {formatDate(
                                  period.pay_date
                                )}
                              </td>

                              <td>
                                {periodRecords.length}
                              </td>

                              <td>
                                {money(
                                  periodGross,
                                  currency
                                )}
                              </td>

                              <td>
                                <strong>
                                  {money(
                                    periodNet,
                                    currency
                                  )}
                                </strong>
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
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}