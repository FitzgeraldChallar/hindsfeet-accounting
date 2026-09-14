import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  FileText,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";


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


function money(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}


function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}


function daysBetween(from, to) {
  const milliseconds = 24 * 60 * 60 * 1000;

  return Math.floor(
    (startOfDay(to) - startOfDay(from)) /
      milliseconds
  );
}


function monthKey(date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}


function monthLabel(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
  });
}


function getBillStatus(bill) {
  const balance = Number(bill.balance_due || 0);

  if (balance <= 0) {
    return "PAID";
  }

  if (bill.status === "DRAFT") {
    return "DRAFT";
  }

  if (bill.status === "VOIDED") {
    return "VOIDED";
  }

  const dueDate = new Date(bill.due_date);

  if (!Number.isNaN(dueDate.getTime())) {
    const today = startOfDay(new Date());

    if (dueDate < today) {
      return "OVERDUE";
    }
  }

  if (bill.status === "PARTIALLY_PAID") {
    return "PARTIALLY_PAID";
  }

  return bill.status || "POSTED";
}


function statusLabel(status) {
  const labels = {
    POSTED: "Posted",
    PARTIALLY_PAID: "Partially Paid",
    PAID: "Paid",
    OVERDUE: "Overdue",
    DRAFT: "Draft",
    VOIDED: "Voided",
  };

  return labels[status] || status;
}


function statusClass(status) {
  const classes = {
    POSTED: "ap-status-posted",
    PARTIALLY_PAID: "ap-status-partial",
    PAID: "ap-status-paid",
    OVERDUE: "ap-status-overdue",
    DRAFT: "ap-status-draft",
    VOIDED: "ap-status-voided",
  };

  return classes[status] || "ap-status-posted";
}


export default function AccountsPayable() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;
  const companyCurrency =
    currentCompany?.currency || "USD";

  const [bills, setBills] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState("");


  const loadDashboard = useCallback(
    async (showRefresh = false) => {
      if (!companyId) {
        setBills([]);
        setSuppliers([]);
        setLoading(false);
        return;
      }

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const [
          billsResponse,
          suppliersResponse,
        ] = await Promise.all([
          api.get(
            `/api/invoicing/supplier-bills/?company=${companyId}`
          ),
          api.get(
            `/api/invoicing/suppliers/?company=${companyId}`
          ),
        ]);

        setBills(extractList(billsResponse));
        setSuppliers(
          extractList(suppliersResponse)
        );
      } catch (err) {
        setError(
          err?.message ||
            "Unable to load Accounts Payable data."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId]
  );


  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);


  const supplierById = useMemo(() => {
    const map = {};

    suppliers.forEach((supplier) => {
      map[supplier.id] = supplier;
    });

    return map;
  }, [suppliers]);


  const activeBills = useMemo(() => {
    return bills.filter(
      (bill) =>
        bill.status !== "DRAFT" &&
        bill.status !== "VOIDED"
    );
  }, [bills]);


  const outstandingBills = useMemo(() => {
    return activeBills.filter(
      (bill) =>
        Number(bill.balance_due || 0) > 0
    );
  }, [activeBills]);


  const totalPayables = useMemo(() => {
    return activeBills.reduce(
      (sum, bill) =>
        sum + Number(bill.total_amount || 0),
      0
    );
  }, [activeBills]);


  const outstandingAmount = useMemo(() => {
    return outstandingBills.reduce(
      (sum, bill) =>
        sum + Number(bill.balance_due || 0),
      0
    );
  }, [outstandingBills]);


  const totalPaid = useMemo(() => {
    return activeBills.reduce(
      (sum, bill) =>
        sum + Number(bill.amount_paid || 0),
      0
    );
  }, [activeBills]);


  const overdueBills = useMemo(() => {
    const today = startOfDay(new Date());

    return outstandingBills.filter((bill) => {
      const dueDate = new Date(bill.due_date);

      return (
        !Number.isNaN(dueDate.getTime()) &&
        dueDate < today
      );
    });
  }, [outstandingBills]);


  const overdueAmount = useMemo(() => {
    return overdueBills.reduce(
      (sum, bill) =>
        sum + Number(bill.balance_due || 0),
      0
    );
  }, [overdueBills]);


  const dueSoonBills = useMemo(() => {
    const today = startOfDay(new Date());

    return outstandingBills.filter((bill) => {
      const dueDate = new Date(bill.due_date);

      if (Number.isNaN(dueDate.getTime())) {
        return false;
      }

      const difference = daysBetween(
        today,
        dueDate
      );

      return difference >= 0 && difference <= 7;
    });
  }, [outstandingBills]);


  const dueSoonAmount = useMemo(() => {
    return dueSoonBills.reduce(
      (sum, bill) =>
        sum + Number(bill.balance_due || 0),
      0
    );
  }, [dueSoonBills]);


  const paidBills = useMemo(() => {
    return activeBills.filter(
      (bill) =>
        Number(bill.balance_due || 0) <= 0
    );
  }, [activeBills]);


  const statusData = useMemo(() => {
    return [
      {
        name: "Outstanding",
        value: outstandingAmount,
      },
      {
        name: "Paid",
        value: totalPaid,
      },
      {
        name: "Overdue",
        value: overdueAmount,
      },
    ].filter((item) => item.value > 0);
  }, [
    outstandingAmount,
    totalPaid,
    overdueAmount,
  ]);


  const trendData = useMemo(() => {
    const now = new Date();
    const months = [];

    for (let index = 5; index >= 0; index -= 1) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - index,
        1
      );

      months.push({
        key: monthKey(date),
        month: monthLabel(date),
        billed: 0,
        paid: 0,
      });
    }

    activeBills.forEach((bill) => {
      if (!bill.bill_date) {
        return;
      }

      const date = new Date(bill.bill_date);

      if (Number.isNaN(date.getTime())) {
        return;
      }

      const key = monthKey(date);
      const target = months.find(
        (item) => item.key === key
      );

      if (!target) {
        return;
      }

      target.billed += Number(
        bill.total_amount || 0
      );

      target.paid += Number(
        bill.amount_paid || 0
      );
    });

    return months;
  }, [activeBills]);


  const recentOutstanding = useMemo(() => {
    return [...outstandingBills]
      .sort((a, b) => {
        const aDate = new Date(a.due_date);
        const bDate = new Date(b.due_date);

        return aDate - bDate;
      })
      .slice(0, 8);
  }, [outstandingBills]);


  const supplierBalanceData = useMemo(() => {
    const map = {};

    outstandingBills.forEach((bill) => {
      const supplierId = bill.supplier;

      if (!map[supplierId]) {
        map[supplierId] = {
          supplier:
            supplierById[supplierId]?.name ||
            "Unknown Supplier",
          balance: 0,
        };
      }

      map[supplierId].balance += Number(
        bill.balance_due || 0
      );
    });

    return Object.values(map)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);
  }, [
    outstandingBills,
    supplierById,
  ]);


  const handleRefresh = () => {
    loadDashboard(true);
  };


  if (!companyId) {
    return (
      <div className="ap-page">
        <div className="ap-empty-state">
          <Wallet size={42} />
          <h2>Select a company</h2>
          <p>
            Select a company to view its Accounts
            Payable dashboard.
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="ap-page">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="ap-page-header">
        <div>
          <div className="ap-eyebrow">
            ACCOUNTS PAYABLE
          </div>

          <h1>Accounts Payable</h1>

          <p>
            Monitor supplier liabilities,
            outstanding bills, payments and
            upcoming obligations.
          </p>
        </div>

        <button
          type="button"
          className="ap-refresh-button"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw
            size={17}
            className={
              refreshing
                ? "ap-spin"
                : ""
            }
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>


      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="ap-alert">
          <AlertCircle size={18} />

          <span>{error}</span>
        </div>
      )}


      {/* ======================================================
          KPI CARDS
      ====================================================== */}

      <div className="ap-kpi-grid">
        <div className="ap-kpi-card">
          <div className="ap-kpi-icon">
            <CircleDollarSign size={22} />
          </div>

          <div className="ap-kpi-content">
            <span>Total Payables</span>

            <strong>
              {loading
                ? "—"
                : money(
                    totalPayables,
                    companyCurrency
                  )}
            </strong>

            <small>
              Posted supplier bills
            </small>
          </div>
        </div>


        <div className="ap-kpi-card ap-kpi-primary">
          <div className="ap-kpi-icon">
            <Wallet size={22} />
          </div>

          <div className="ap-kpi-content">
            <span>Outstanding</span>

            <strong>
              {loading
                ? "—"
                : money(
                    outstandingAmount,
                    companyCurrency
                  )}
            </strong>

            <small>
              {outstandingBills.length} unpaid bill
              {outstandingBills.length === 1
                ? ""
                : "s"}
            </small>
          </div>
        </div>


        <div className="ap-kpi-card ap-kpi-danger">
          <div className="ap-kpi-icon">
            <TrendingDown size={22} />
          </div>

          <div className="ap-kpi-content">
            <span>Overdue</span>

            <strong>
              {loading
                ? "—"
                : money(
                    overdueAmount,
                    companyCurrency
                  )}
            </strong>

            <small>
              {overdueBills.length} overdue bill
              {overdueBills.length === 1
                ? ""
                : "s"}
            </small>
          </div>
        </div>


        <div className="ap-kpi-card ap-kpi-warning">
          <div className="ap-kpi-icon">
            <CalendarClock size={22} />
          </div>

          <div className="ap-kpi-content">
            <span>Due Within 7 Days</span>

            <strong>
              {loading
                ? "—"
                : money(
                    dueSoonAmount,
                    companyCurrency
                  )}
            </strong>

            <small>
              {dueSoonBills.length} bill
              {dueSoonBills.length === 1
                ? ""
                : "s"} due soon
            </small>
          </div>
        </div>
      </div>


      {/* ======================================================
          SECONDARY SUMMARY
      ====================================================== */}

      <div className="ap-summary-strip">
        <div>
          <span>Total Paid</span>
          <strong>
            {money(
              totalPaid,
              companyCurrency
            )}
          </strong>
        </div>

        <div>
          <span>Posted Bills</span>
          <strong>
            {activeBills.length}
          </strong>
        </div>

        <div>
          <span>Paid Bills</span>
          <strong>
            {paidBills.length}
          </strong>
        </div>

        <div>
          <span>Suppliers</span>
          <strong>
            {suppliers.length}
          </strong>
        </div>
      </div>


      {/* ======================================================
          CHARTS
      ====================================================== */}

      <div className="ap-chart-grid">
        <section className="ap-panel">
          <div className="ap-panel-header">
            <div>
              <h2>Payables Overview</h2>
              <p>
                Supplier bills and payments over
                the last six months.
              </p>
            </div>

            <div className="ap-panel-icon">
              <TrendingUp size={19} />
            </div>
          </div>

          <div className="ap-chart">
            {loading ? (
              <div className="ap-chart-loading">
                Loading chart...
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <AreaChart
                  data={trendData}
                  margin={{
                    top: 10,
                    right: 10,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E2E7EF"
                  />

                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 12,
                      fill: "#71809A",
                    }}
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 11,
                      fill: "#71809A",
                    }}
                    tickFormatter={(value) =>
                      `${Number(value) >= 1000
                        ? `${(
                            Number(value) /
                            1000
                          ).toFixed(0)}k`
                        : value}`
                    }
                  />

                  <Tooltip
                    formatter={(value, name) => [
                      money(
                        value,
                        companyCurrency
                      ),
                      name === "billed"
                        ? "Billed"
                        : "Paid",
                    ]}
                    contentStyle={{
                      border:
                        "1px solid #E2E7EF",
                      borderRadius: "10px",
                      boxShadow:
                        "0 10px 30px rgba(9,25,60,0.10)",
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="billed"
                    stroke="#123C78"
                    fill="#123C78"
                    fillOpacity={0.12}
                    strokeWidth={2.5}
                  />

                  <Area
                    type="monotone"
                    dataKey="paid"
                    stroke="#F4B400"
                    fill="#F4B400"
                    fillOpacity={0.10}
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="ap-chart-legend">
            <span>
              <i className="ap-legend-billed" />
              Billed
            </span>

            <span>
              <i className="ap-legend-paid" />
              Paid
            </span>
          </div>
        </section>


        <section className="ap-panel">
          <div className="ap-panel-header">
            <div>
              <h2>Payable Status</h2>
              <p>
                Current payable distribution.
              </p>
            </div>

            <div className="ap-panel-icon">
              <FileText size={19} />
            </div>
          </div>

          <div className="ap-status-chart">
            {statusData.length === 0 ? (
              <div className="ap-chart-loading">
                No payable data available.
              </div>
            ) : (
              <>
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={3}
                    >
                      {statusData.map(
                        (entry, index) => (
                          <Cell
                            key={`${entry.name}-${index}`}
                            fill={
                              [
                                "#123C78",
                                "#F4B400",
                                "#D84D46",
                              ][index % 3]
                            }
                          />
                        )
                      )}
                    </Pie>

                    <Tooltip
                      formatter={(value) =>
                        money(
                          value,
                          companyCurrency
                        )
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </>
            )}
          </div>

          <div className="ap-status-list">
            <div>
              <span>
                <i className="ap-dot-outstanding" />
                Outstanding
              </span>

              <strong>
                {money(
                  outstandingAmount,
                  companyCurrency
                )}
              </strong>
            </div>

            <div>
              <span>
                <i className="ap-dot-paid" />
                Paid
              </span>

              <strong>
                {money(
                  totalPaid,
                  companyCurrency
                )}
              </strong>
            </div>

            <div>
              <span>
                <i className="ap-dot-overdue" />
                Overdue
              </span>

              <strong>
                {money(
                  overdueAmount,
                  companyCurrency
                )}
              </strong>
            </div>
          </div>
        </section>
      </div>


      {/* ======================================================
          SUPPLIER EXPOSURE + OUTSTANDING
      ====================================================== */}

      <div className="ap-bottom-grid">
        <section className="ap-panel">
          <div className="ap-panel-header">
            <div>
              <h2>Supplier Exposure</h2>
              <p>
                Suppliers with the largest
                outstanding balances.
              </p>
            </div>
          </div>

          {supplierBalanceData.length === 0 ? (
            <div className="ap-empty-table">
              No outstanding supplier balances.
            </div>
          ) : (
            <div className="ap-supplier-list">
              {supplierBalanceData.map(
                (supplier, index) => (
                  <div
                    className="ap-supplier-row"
                    key={`${supplier.supplier}-${index}`}
                  >
                    <div className="ap-supplier-rank">
                      {index + 1}
                    </div>

                    <div className="ap-supplier-info">
                      <strong>
                        {supplier.supplier}
                      </strong>

                      <div className="ap-supplier-bar">
                        <span
                          style={{
                            width: `${Math.min(
                              100,
                              outstandingAmount > 0
                                ? (supplier.balance /
                                    outstandingAmount) *
                                    100
                                : 0
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <strong className="ap-supplier-amount">
                      {money(
                        supplier.balance,
                        companyCurrency
                      )}
                    </strong>
                  </div>
                )
              )}
            </div>
          )}
        </section>


        <section className="ap-panel">
          <div className="ap-panel-header">
            <div>
              <h2>Upcoming & Overdue</h2>
              <p>
                Bills requiring attention.
              </p>
            </div>

            <div className="ap-attention-count">
              {overdueBills.length +
                dueSoonBills.length}
            </div>
          </div>

          {recentOutstanding.length === 0 ? (
            <div className="ap-empty-table">
              No outstanding bills.
            </div>
          ) : (
            <div className="ap-attention-list">
              {recentOutstanding
                .slice(0, 6)
                .map((bill) => {
                  const status =
                    getBillStatus(bill);

                  const supplier =
                    supplierById[
                      bill.supplier
                    ];

                  return (
                    <div
                      className="ap-attention-row"
                      key={bill.id}
                    >
                      <div className="ap-attention-icon">
                        <FileText size={17} />
                      </div>

                      <div className="ap-attention-main">
                        <strong>
                          {supplier?.name ||
                            "Unknown Supplier"}
                        </strong>

                        <span>
                          {bill.bill_number}
                        </span>
                      </div>

                      <div className="ap-attention-right">
                        <strong>
                          {money(
                            bill.balance_due,
                            companyCurrency
                          )}
                        </strong>

                        <span
                          className={`ap-status ${statusClass(
                            status
                          )}`}
                        >
                          {statusLabel(status)}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      </div>


      {/* ======================================================
          OUTSTANDING BILLS TABLE
      ====================================================== */}

      <section className="ap-panel ap-table-panel">
        <div className="ap-panel-header">
          <div>
            <h2>Outstanding Bills</h2>
            <p>
              Supplier bills with an unpaid
              balance.
            </p>
          </div>

          <div className="ap-table-count">
            {outstandingBills.length} outstanding
          </div>
        </div>

        {loading ? (
          <div className="ap-table-loading">
            Loading Accounts Payable...
          </div>
        ) : outstandingBills.length === 0 ? (
          <div className="ap-empty-table">
            <FileText size={34} />

            <strong>
              No outstanding bills
            </strong>

            <span>
              All posted supplier bills are
              currently settled.
            </span>
          </div>
        ) : (
          <div className="ap-table-wrapper">
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Bill Number</th>
                  <th>Bill Date</th>
                  <th>Due Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {recentOutstanding.map(
                  (bill) => {
                    const status =
                      getBillStatus(bill);

                    const supplier =
                      supplierById[
                        bill.supplier
                      ];

                    return (
                      <tr key={bill.id}>
                        <td>
                          <div className="ap-table-supplier">
                            <div className="ap-table-avatar">
                              {(
                                supplier?.name ||
                                "S"
                              )
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <span>
                              {supplier?.name ||
                                "Unknown Supplier"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <strong>
                            {bill.bill_number}
                          </strong>
                        </td>

                        <td>
                          {formatDate(
                            bill.bill_date
                          )}
                        </td>

                        <td>
                          {formatDate(
                            bill.due_date
                          )}
                        </td>

                        <td>
                          {money(
                            bill.total_amount,
                            companyCurrency
                          )}
                        </td>

                        <td>
                          {money(
                            bill.amount_paid,
                            companyCurrency
                          )}
                        </td>

                        <td>
                          <strong>
                            {money(
                              bill.balance_due,
                              companyCurrency
                            )}
                          </strong>
                        </td>

                        <td>
                          <span
                            className={`ap-status ${statusClass(
                              status
                            )}`}
                          >
                            {statusLabel(status)}
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
    </div>
  );
}