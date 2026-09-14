import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  RefreshCw,
  Search,
  UserRound,
  Wallet,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import { api } from "../../services/api";
import { useCompany } from "../../context/CompanyContext";


function extractList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
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
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}


function startOfDay(value = new Date()) {
  const date = new Date(value);

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}


function daysPastDue(value) {
  if (!value) return null;

  const due = startOfDay(value);
  const today = startOfDay();

  return Math.floor(
    (today.getTime() - due.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}


function getAgingBucket(bill) {
  const balance = Number(bill?.balance_due || 0);

  if (balance <= 0) {
    return "SETTLED";
  }

  if (!bill?.due_date) {
    return "CURRENT";
  }

  const days = daysPastDue(bill.due_date);

  if (days <= 0) return "CURRENT";
  if (days <= 30) return "DAYS_1_30";
  if (days <= 60) return "DAYS_31_60";
  if (days <= 90) return "DAYS_61_90";

  return "OVER_90";
}


function bucketLabel(bucket) {
  const labels = {
    CURRENT: "Current",
    DAYS_1_30: "1–30 Days",
    DAYS_31_60: "31–60 Days",
    DAYS_61_90: "61–90 Days",
    OVER_90: "90+ Days",
  };

  return labels[bucket] || bucket;
}


function bucketClass(bucket) {
  if (bucket === "CURRENT") {
    return "ap-aging-bucket-current";
  }

  if (bucket === "DAYS_1_30") {
    return "ap-aging-bucket-1-30";
  }

  if (bucket === "DAYS_31_60") {
    return "ap-aging-bucket-31-60";
  }

  if (bucket === "DAYS_61_90") {
    return "ap-aging-bucket-61-90";
  }

  return "ap-aging-bucket-over-90";
}


function dueText(bill) {
  if (!bill?.due_date) {
    return "No due date";
  }

  const days = daysPastDue(bill.due_date);

  if (days <= 0) {
    if (days === 0) return "Due today";
    if (days === -1) return "Due tomorrow";

    return `Due in ${Math.abs(days)} days`;
  }

  return `${days} day${days === 1 ? "" : "s"} overdue`;
}


function initials(name = "Supplier") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");
}


function exportCsv(filename, headers, rows) {
  const quote = (value) =>
    `"${String(value ?? "").replaceAll(
      '"',
      '""'
    )}"`;

  const csvText = [
    headers.map(quote).join(","),
    ...rows.map((row) =>
      row.map(quote).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvText], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}


export default function APAgingReport() {
  const { currentCompany } = useCompany();
  const navigate = useNavigate();

  const companyId = currentCompany?.id;
  const currency =
    currentCompany?.currency || "USD";

  const [bills, setBills] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] =
    useState("ALL");
  const [bucketFilter, setBucketFilter] =
    useState("ALL");


  const loadData = useCallback(
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
            "Unable to load the accounts payable aging report."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId]
  );


  useEffect(() => {
    loadData();
  }, [loadData]);


  const supplierById = useMemo(() => {
    const map = {};

    suppliers.forEach((supplier) => {
      map[supplier.id] = supplier;
    });

    return map;
  }, [suppliers]);


  const outstandingBills = useMemo(() => {
    return bills.filter((bill) => {
      const balance = Number(
        bill.balance_due || 0
      );

      return (
        balance > 0 &&
        bill.status !== "DRAFT" &&
        bill.status !== "VOIDED"
      );
    });
  }, [bills]);


  const agingTotals = useMemo(() => {
    const totals = {
      CURRENT: 0,
      DAYS_1_30: 0,
      DAYS_31_60: 0,
      DAYS_61_90: 0,
      OVER_90: 0,
    };

    outstandingBills.forEach((bill) => {
      const bucket = getAgingBucket(bill);

      if (totals[bucket] !== undefined) {
        totals[bucket] += Number(
          bill.balance_due || 0
        );
      }
    });

    return totals;
  }, [outstandingBills]);


  const totalOutstanding = useMemo(
    () =>
      Object.values(agingTotals).reduce(
        (sum, amount) => sum + amount,
        0
      ),
    [agingTotals]
  );


  const overdueTotal = useMemo(
    () =>
      agingTotals.DAYS_1_30 +
      agingTotals.DAYS_31_60 +
      agingTotals.DAYS_61_90 +
      agingTotals.OVER_90,
    [agingTotals]
  );


  const overdueCount = useMemo(
    () =>
      outstandingBills.filter((bill) => {
        const bucket = getAgingBucket(bill);

        return bucket !== "CURRENT";
      }).length,
    [outstandingBills]
  );


  const oldestDays = useMemo(() => {
    const values = outstandingBills
      .map((bill) => daysPastDue(bill.due_date))
      .filter(
        (days) =>
          days !== null && days > 0
      );

    return values.length
      ? Math.max(...values)
      : 0;
  }, [outstandingBills]);


  const supplierAging = useMemo(() => {
    const map = {};

    outstandingBills.forEach((bill) => {
      const supplierId = bill.supplier;
      const supplier =
        supplierById[supplierId];

      if (!map[supplierId]) {
        map[supplierId] = {
          id: supplierId,
          name:
            supplier?.name ||
            "Unknown Supplier",
          email:
            supplier?.email || "",
          total: 0,
          current: 0,
          days1to30: 0,
          days31to60: 0,
          days61to90: 0,
          over90: 0,
        };
      }

      const amount = Number(
        bill.balance_due || 0
      );

      const bucket = getAgingBucket(bill);

      map[supplierId].total += amount;

      if (bucket === "CURRENT") {
        map[supplierId].current += amount;
      } else if (bucket === "DAYS_1_30") {
        map[supplierId].days1to30 += amount;
      } else if (bucket === "DAYS_31_60") {
        map[supplierId].days31to60 += amount;
      } else if (bucket === "DAYS_61_90") {
        map[supplierId].days61to90 += amount;
      } else if (bucket === "OVER_90") {
        map[supplierId].over90 += amount;
      }
    });

    return Object.values(map).sort(
      (a, b) => b.total - a.total
    );
  }, [outstandingBills, supplierById]);


  const filteredBills = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return outstandingBills
      .filter((bill) => {
        const supplier =
          supplierById[bill.supplier];

        const matchesSearch =
          !query ||
          String(
            bill.bill_number || ""
          )
            .toLowerCase()
            .includes(query) ||
          String(
            supplier?.name || ""
          )
            .toLowerCase()
            .includes(query) ||
          String(
            bill.notes || ""
          )
            .toLowerCase()
            .includes(query);

        const matchesSupplier =
          supplierFilter === "ALL" ||
          String(bill.supplier) ===
            String(supplierFilter);

        const matchesBucket =
          bucketFilter === "ALL" ||
          getAgingBucket(bill) ===
            bucketFilter;

        return (
          matchesSearch &&
          matchesSupplier &&
          matchesBucket
        );
      })
      .sort((a, b) => {
        const aDays =
          daysPastDue(a.due_date) ?? -999999;
        const bDays =
          daysPastDue(b.due_date) ?? -999999;

        return bDays - aDays;
      });
  }, [
    outstandingBills,
    supplierById,
    search,
    supplierFilter,
    bucketFilter,
  ]);


  const handleExport = () => {
    exportCsv(
      "accounts-payable-aging-report.csv",
      [
        "Supplier",
        "Bill Number",
        "Due Date",
        "Balance Due",
        "Aging Bucket",
        "Days Past Due",
      ],
      filteredBills.map((bill) => {
        const supplier =
          supplierById[bill.supplier];

        const days =
          daysPastDue(bill.due_date);

        return [
          supplier?.name ||
            "Unknown Supplier",
          bill.bill_number ||
            `Bill #${bill.id}`,
          bill.due_date || "",
          Number(
            bill.balance_due || 0
          ).toFixed(2),
          bucketLabel(
            getAgingBucket(bill)
          ),
          days > 0 ? days : 0,
        ];
      })
    );
  };


  const viewBill = () => {
    navigate("/accounts-payable/outstanding");
  };


  if (!companyId) {
    return (
      <div className="ap-page">
        <div className="ap-empty-state">
          <Wallet size={42} />
          <h2>Select a company</h2>
          <p>
            Select a company to view the
            accounts payable aging report.
          </p>
        </div>
      </div>
    );
  }


  const bucketCards = [
    {
      key: "CURRENT",
      label: "Current",
      amount: agingTotals.CURRENT,
      note: "Not yet overdue",
      icon: CalendarDays,
    },
    {
      key: "DAYS_1_30",
      label: "1–30 Days",
      amount: agingTotals.DAYS_1_30,
      note: "Recently overdue",
      icon: Clock3,
    },
    {
      key: "DAYS_31_60",
      label: "31–60 Days",
      amount: agingTotals.DAYS_31_60,
      note: "Requires attention",
      icon: AlertCircle,
    },
    {
      key: "DAYS_61_90",
      label: "61–90 Days",
      amount: agingTotals.DAYS_61_90,
      note: "High aging exposure",
      icon: AlertCircle,
    },
    {
      key: "OVER_90",
      label: "90+ Days",
      amount: agingTotals.OVER_90,
      note: "Critical aging exposure",
      icon: AlertCircle,
    },
  ];


  return (
    <div className="ap-page">

      <div className="ap-page-header">
        <div>
          <div className="ap-eyebrow">
            ACCOUNTS PAYABLE
          </div>

          <h1>Aging Report</h1>

          <p>
            Analyze outstanding supplier balances
            by how long they have remained unpaid.
          </p>
        </div>

        <div className="ap-header-actions">
          <button
            type="button"
            className="ap-header-button ap-aging-export"
            onClick={handleExport}
            disabled={filteredBills.length === 0}
          >
            <Download size={16} />
            Export
          </button>

          <button
            type="button"
            className="ap-refresh-button"
            onClick={() => loadData(true)}
            disabled={refreshing}
          >
            <RefreshCw
              size={17}
              className={
                refreshing ? "ap-spin" : ""
              }
            />

            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>
      </div>


      {error && (
        <div className="ap-alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}


      <div className="ap-aging-overview">

        <div className="ap-aging-overview-card">
          <div className="ap-aging-overview-icon">
            <Wallet size={22} />
          </div>

          <div>
            <span>Total Outstanding</span>

            <strong>
              {loading
                ? "—"
                : money(
                    totalOutstanding,
                    currency
                  )}
            </strong>

            <small>
              Open supplier liability
            </small>
          </div>
        </div>


        <div className="ap-aging-overview-card">
          <div className="ap-aging-overview-icon">
            <AlertCircle size={22} />
          </div>

          <div>
            <span>Overdue Exposure</span>

            <strong>
              {loading
                ? "—"
                : money(
                    overdueTotal,
                    currency
                  )}
            </strong>

            <small>
              {overdueCount} overdue bill
              {overdueCount === 1
                ? ""
                : "s"}
            </small>
          </div>
        </div>


        <div className="ap-aging-overview-card">
          <div className="ap-aging-overview-icon">
            <Clock3 size={22} />
          </div>

          <div>
            <span>Oldest Overdue</span>

            <strong>
              {loading
                ? "—"
                : oldestDays > 0
                  ? `${oldestDays} days`
                  : "None"}
            </strong>

            <small>
              Based on due date
            </small>
          </div>
        </div>

      </div>


      <section className="ap-panel ap-aging-panel">

        <div className="ap-aging-panel-header">
          <div>
            <h2>Payables Aging</h2>

            <p>
              Outstanding balances grouped by
              days past the supplier bill due date.
            </p>
          </div>

          <div className="ap-aging-asof">
            <span>As of</span>
            <strong>
              {formatDate(new Date())}
            </strong>
          </div>
        </div>


        <div className="ap-aging-buckets">
          {bucketCards.map((bucket) => {
            const Icon = bucket.icon;

            const percentage =
              totalOutstanding > 0
                ? (bucket.amount /
                    totalOutstanding) *
                  100
                : 0;

            return (
              <button
                type="button"
                key={bucket.key}
                className={`ap-aging-bucket-card ${
                  bucketFilter === bucket.key
                    ? "is-selected"
                    : ""
                }`}
                onClick={() =>
                  setBucketFilter(
                    bucketFilter === bucket.key
                      ? "ALL"
                      : bucket.key
                  )
                }
              >
                <div className="ap-aging-bucket-top">
                  <div
                    className={`ap-aging-bucket-icon ${bucketClass(
                      bucket.key
                    )}`}
                  >
                    <Icon size={18} />
                  </div>

                  <span>
                    {percentage.toFixed(1)}%
                  </span>
                </div>

                <strong>
                  {money(
                    bucket.amount,
                    currency
                  )}
                </strong>

                <label>
                  {bucket.label}
                </label>

                <small>
                  {bucket.note}
                </small>

                <div className="ap-aging-progress">
                  <span
                    style={{
                      width: `${Math.min(
                        percentage,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>


        <div className="ap-aging-total-bar">
          <div>
            <span>Open Payables</span>
            <strong>
              {outstandingBills.length} bill
              {outstandingBills.length === 1
                ? ""
                : "s"}
            </strong>
          </div>

          <div>
            <span>Overdue</span>
            <strong>
              {overdueCount} bill
              {overdueCount === 1
                ? ""
                : "s"}
            </strong>
          </div>

          <div>
            <span>Overdue Share</span>
            <strong>
              {totalOutstanding > 0
                ? `${(
                    (overdueTotal /
                      totalOutstanding) *
                    100
                  ).toFixed(1)}%`
                : "0.0%"}
            </strong>
          </div>
        </div>

      </section>


      <section className="ap-panel ap-aging-supplier-panel">

        <div className="ap-aging-section-header">
          <div>
            <h2>Supplier Aging Exposure</h2>

            <p>
              See which suppliers carry the largest
              outstanding and overdue balances.
            </p>
          </div>
        </div>

        <div className="ap-table-wrapper">
          {loading ? (
            <div className="ap-table-loading">
              Loading supplier aging...
            </div>
          ) : supplierAging.length === 0 ? (
            <div className="ap-aging-empty">
              <CheckCircle2Fallback />
              <strong>
                No outstanding supplier balances
              </strong>
              <span>
                Aging exposure will appear when
                posted supplier bills have balances.
              </span>
            </div>
          ) : (
            <table className="ap-table ap-aging-supplier-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Current</th>
                  <th>1–30</th>
                  <th>31–60</th>
                  <th>61–90</th>
                  <th>90+</th>
                  <th>Total Due</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {supplierAging.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <div className="ap-aging-supplier-cell">
                        <div className="ap-aging-avatar">
                          {initials(
                            supplier.name
                          )}
                        </div>

                        <div>
                          <strong>
                            {supplier.name}
                          </strong>

                          <span>
                            {supplier.email ||
                              "Supplier account"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      {money(
                        supplier.current,
                        currency
                      )}
                    </td>

                    <td>
                      {money(
                        supplier.days1to30,
                        currency
                      )}
                    </td>

                    <td>
                      {money(
                        supplier.days31to60,
                        currency
                      )}
                    </td>

                    <td>
                      {money(
                        supplier.days61to90,
                        currency
                      )}
                    </td>

                    <td>
                      <strong className="ap-aging-danger-amount">
                        {money(
                          supplier.over90,
                          currency
                        )}
                      </strong>
                    </td>

                    <td>
                      <strong className="ap-aging-total-amount">
                        {money(
                          supplier.total,
                          currency
                        )}
                      </strong>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="ap-aging-view-button"
                        onClick={() =>
                          navigate(
                            "/accounts-payable/statements",
                            {
                              state: {
                                supplierId:
                                  String(
                                    supplier.id
                                  ),
                              },
                            }
                          )
                        }
                      >
                        Statement
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </section>


      <section className="ap-panel ap-aging-bills-panel">

        <div className="ap-aging-section-header">
          <div>
            <h2>Aging Detail</h2>

            <p>
              Review individual open bills behind
              the aging totals.
            </p>
          </div>
        </div>


        <div className="ap-aging-toolbar">

          <div className="ap-aging-search">
            <Search size={16} />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search bill number, supplier or notes..."
            />
          </div>


          <div className="ap-aging-filter">
            <UserRound size={15} />

            <select
              value={supplierFilter}
              onChange={(event) =>
                setSupplierFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All Suppliers
              </option>

              {suppliers
                .filter((supplier) =>
                  outstandingBills.some(
                    (bill) =>
                      String(
                        bill.supplier
                      ) ===
                      String(
                        supplier.id
                      )
                  )
                )
                .sort((a, b) =>
                  String(a.name || "")
                    .localeCompare(
                      String(b.name || "")
                    )
                )
                .map((supplier) => (
                  <option
                    value={supplier.id}
                    key={supplier.id}
                  >
                    {supplier.name}
                  </option>
                ))}
            </select>
          </div>


          <div className="ap-aging-filter">
            <CalendarDays size={15} />

            <select
              value={bucketFilter}
              onChange={(event) =>
                setBucketFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All Aging Buckets
              </option>

              <option value="CURRENT">
                Current
              </option>

              <option value="DAYS_1_30">
                1–30 Days
              </option>

              <option value="DAYS_31_60">
                31–60 Days
              </option>

              <option value="DAYS_61_90">
                61–90 Days
              </option>

              <option value="OVER_90">
                90+ Days
              </option>
            </select>
          </div>

          <span className="ap-aging-result-count">
            {filteredBills.length} bill
            {filteredBills.length === 1
              ? ""
              : "s"}
          </span>

        </div>


        {loading ? (
          <div className="ap-table-loading">
            Loading aging detail...
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="ap-aging-empty">
            <FileText size={38} />
            <strong>
              No bills match the current filters
            </strong>
            <span>
              Try clearing a filter or changing
              your search.
            </span>
          </div>
        ) : (
          <div className="ap-table-wrapper">
            <table className="ap-table ap-aging-detail-table">
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Supplier</th>
                  <th>Due Date</th>
                  <th>Balance Due</th>
                  <th>Aging</th>
                  <th>Days</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredBills.map((bill) => {
                  const supplier =
                    supplierById[
                      bill.supplier
                    ];

                  const bucket =
                    getAgingBucket(bill);

                  const days =
                    daysPastDue(
                      bill.due_date
                    );

                  return (
                    <tr key={bill.id}>
                      <td>
                        <div className="ap-aging-bill-cell">
                          <div className="ap-aging-bill-icon">
                            <FileText size={15} />
                          </div>

                          <div>
                            <strong>
                              {bill.bill_number ||
                                `Bill #${bill.id}`}
                            </strong>

                            <span>
                              {formatDate(
                                bill.bill_date
                              )}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="ap-aging-supplier-mini">
                          <strong>
                            {supplier?.name ||
                              "Unknown Supplier"}
                          </strong>
                          <span>
                            {supplier?.email ||
                              supplier?.phone ||
                              "Supplier account"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="ap-aging-due">
                          <strong>
                            {formatDate(
                              bill.due_date
                            )}
                          </strong>

                          <span
                            className={
                              days > 0
                                ? "ap-aging-overdue-text"
                                : ""
                            }
                          >
                            {dueText(bill)}
                          </span>
                        </div>
                      </td>

                      <td>
                        <strong className="ap-aging-total-amount">
                          {money(
                            bill.balance_due,
                            currency
                          )}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={`ap-aging-status ${bucketClass(
                            bucket
                          )}`}
                        >
                          {bucketLabel(bucket)}
                        </span>
                      </td>

                      <td>
                        <span className="ap-aging-days">
                          {days > 0
                            ? `${days}d`
                            : "—"}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="ap-aging-view-button"
                          onClick={() =>
                            viewBill(bill)
                          }
                        >
                          View
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </section>

    </div>
  );
}


/*
  Small local fallback so the empty state does not
  introduce another dependency.
*/
function CheckCircle2Fallback() {
  return (
    <div className="ap-aging-empty-icon">
      <FileText size={26} />
    </div>
  );
}
