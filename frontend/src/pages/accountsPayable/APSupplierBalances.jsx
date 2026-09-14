import {
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Download,
  Eye,
  FileText,
  RefreshCw,
  Search,
  Users,
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


function PositionBadge({ balance }) {
  const open = Number(balance || 0) > 0;

  return (
    <span
      className={`ap-sb-position ${
        open ? "open" : "settled"
      }`}
    >
      {open ? (
        <>
          <ArrowUpRight size={12} />
          Open
        </>
      ) : (
        <>
          <CheckCircle2 size={12} />
          Settled
        </>
      )}
    </span>
  );
}


function EmptyState() {
  return (
    <div className="ap-sb-empty">
      <Users size={38} />
      <strong>No supplier balances found</strong>
      <span>
        Supplier activity will appear here once
        supplier bills have been posted.
      </span>
    </div>
  );
}


export default function APSupplierBalances() {
  const { currentCompany } = useCompany();
  const navigate = useNavigate();

  const companyId = currentCompany?.id;
  const companyCurrency =
    currentCompany?.currency || "USD";

  const [suppliers, setSuppliers] = useState([]);
  const [bills, setBills] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] =
    useState("ALL");


  const loadData = useCallback(
    async (showRefresh = false) => {
      if (!companyId) {
        setSuppliers([]);
        setBills([]);
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
          suppliersResponse,
          billsResponse,
        ] = await Promise.all([
          api.get(
            `/api/invoicing/suppliers/?company=${companyId}`
          ),
          api.get(
            `/api/invoicing/supplier-bills/?company=${companyId}`
          ),
        ]);

        setSuppliers(
          extractList(suppliersResponse)
        );

        setBills(
          extractList(billsResponse)
        );
      } catch (err) {
        setError(
          err?.message ||
            "Unable to load supplier balances."
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


  const activeBills = useMemo(() => {
    return bills.filter(
      (bill) =>
        bill.status !== "DRAFT" &&
        bill.status !== "VOIDED"
    );
  }, [bills]);


  const supplierBalances = useMemo(() => {
    const map = {};

    suppliers.forEach((supplier) => {
      map[supplier.id] = {
        id: supplier.id,
        name: supplier.name || "Unnamed Supplier",
        email: supplier.email || "",
        phone: supplier.phone || "",
        bills: 0,
        billed: 0,
        paid: 0,
        balance: 0,
      };
    });

    activeBills.forEach((bill) => {
      const supplierId = bill.supplier;

      if (!map[supplierId]) {
        map[supplierId] = {
          id: supplierId,
          name:
            supplierById[supplierId]?.name ||
            "Unknown Supplier",
          email:
            supplierById[supplierId]?.email ||
            "",
          phone:
            supplierById[supplierId]?.phone ||
            "",
          bills: 0,
          billed: 0,
          paid: 0,
          balance: 0,
        };
      }

      map[supplierId].bills += 1;
      map[supplierId].billed += Number(
        bill.total_amount || 0
      );
      map[supplierId].paid += Number(
        bill.amount_paid || 0
      );
      map[supplierId].balance += Number(
        bill.balance_due || 0
      );
    });

    return Object.values(map).sort(
      (a, b) => b.balance - a.balance
    );
  }, [
    suppliers,
    activeBills,
    supplierById,
  ]);


  const totalBilled = useMemo(
    () =>
      supplierBalances.reduce(
        (sum, supplier) =>
          sum + supplier.billed,
        0
      ),
    [supplierBalances]
  );


  const totalPaid = useMemo(
    () =>
      supplierBalances.reduce(
        (sum, supplier) =>
          sum + supplier.paid,
        0
      ),
    [supplierBalances]
  );


  const totalOutstanding = useMemo(
    () =>
      supplierBalances.reduce(
        (sum, supplier) =>
          sum + supplier.balance,
        0
      ),
    [supplierBalances]
  );


  const openSuppliers = useMemo(
    () =>
      supplierBalances.filter(
        (supplier) =>
          supplier.balance > 0
      ).length,
    [supplierBalances]
  );


  const filteredSuppliers = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return supplierBalances.filter(
      (supplier) => {
        const matchesSearch =
          !query ||
          supplier.name
            .toLowerCase()
            .includes(query) ||
          supplier.email
            .toLowerCase()
            .includes(query) ||
          supplier.phone
            .toLowerCase()
            .includes(query);

        const matchesPosition =
          positionFilter === "ALL" ||
          (positionFilter === "OPEN" &&
            supplier.balance > 0) ||
          (positionFilter === "SETTLED" &&
            supplier.balance <= 0);

        return (
          matchesSearch &&
          matchesPosition
        );
      }
    );
  }, [
    supplierBalances,
    search,
    positionFilter,
  ]);


  const handleExport = () => {
    exportCsv(
      "supplier-balances.csv",
      [
        "Supplier",
        "Email",
        "Phone",
        "Posted Bills",
        "Total Billed",
        "Total Paid",
        "Balance Due",
        "Position",
      ],
      filteredSuppliers.map(
        (supplier) => [
          supplier.name,
          supplier.email,
          supplier.phone,
          supplier.bills,
          supplier.billed.toFixed(2),
          supplier.paid.toFixed(2),
          supplier.balance.toFixed(2),
          supplier.balance > 0
            ? "Open"
            : "Settled",
        ]
      )
    );
  };


  const openStatement = (supplierId) => {
    navigate(
      "/accounts-payable/statements",
      {
        state: {
          supplierId: String(
            supplierId
          ),
        },
      }
    );
  };


  if (!companyId) {
    return (
      <div className="ap-page">
        <div className="ap-empty-state">
          <Wallet size={42} />
          <h2>Select a company</h2>
          <p>
            Select a company to view supplier
            balances.
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="ap-page">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="ap-page-header">
        <div>
          <div className="ap-eyebrow">
            ACCOUNTS PAYABLE
          </div>

          <h1>Supplier Balances</h1>

          <p>
            Review what your company owes each
            supplier and track settled accounts.
          </p>
        </div>

        <div className="ap-header-actions">
          <button
            type="button"
            className="ap-header-button"
            onClick={handleExport}
            disabled={
              filteredSuppliers.length === 0
            }
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
      </div>


      {/* =====================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="ap-alert">
          <span>{error}</span>
        </div>
      )}


      {/* =====================================================
          SUMMARY CARDS
      ====================================================== */}

      <div className="ap-kpi-grid ap-sb-kpi-grid">

        <div className="ap-kpi-card">
          <div className="ap-kpi-icon">
            <Users size={22} />
          </div>

          <div className="ap-kpi-content">
            <span>Total Suppliers</span>

            <strong>
              {loading
                ? "—"
                : supplierBalances.length}
            </strong>

            <small>
              Supplier accounts
            </small>
          </div>
        </div>


        <div className="ap-kpi-card">
          <div className="ap-kpi-icon">
            <CircleDollarSign size={22} />
          </div>

          <div className="ap-kpi-content">
            <span>Total Billed</span>

            <strong>
              {loading
                ? "—"
                : money(
                    totalBilled,
                    companyCurrency
                  )}
            </strong>

            <small>
              Posted supplier bills
            </small>
          </div>
        </div>


        <div className="ap-kpi-card">
          <div className="ap-kpi-icon">
            <ArrowUpRight size={22} />
          </div>

          <div className="ap-kpi-content">
            <span>Total Paid</span>

            <strong>
              {loading
                ? "—"
                : money(
                    totalPaid,
                    companyCurrency
                  )}
            </strong>

            <small>
              Payments recorded
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
                    totalOutstanding,
                    companyCurrency
                  )}
            </strong>

            <small>
              {openSuppliers} supplier
              {openSuppliers === 1
                ? ""
                : "s"} with balance
            </small>
          </div>
        </div>

      </div>


      {/* =====================================================
          MAIN PANEL
      ====================================================== */}

      <section className="ap-panel ap-table-panel">

        <div className="ap-sb-panel-heading">
          <div>
            <h2>Supplier Account Balances</h2>

            <p>
              Each supplier's posted bills,
              payments and remaining payable
              balance.
            </p>
          </div>

          <div className="ap-sb-heading-total">
            <span>Total Outstanding</span>

            <strong>
              {money(
                totalOutstanding,
                companyCurrency
              )}
            </strong>
          </div>
        </div>


        {/* =================================================
            TOOLBAR
        ================================================== */}

        <div className="ap-toolbar ap-toolbar-wrap">

          <div className="ap-search">
            <Search size={16} />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search supplier, email or phone..."
            />
          </div>


          <div className="ap-filter-control">
            <select
              value={positionFilter}
              onChange={(event) =>
                setPositionFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All Suppliers
              </option>

              <option value="OPEN">
                Open Balances
              </option>

              <option value="SETTLED">
                Settled
              </option>
            </select>
          </div>


          <div className="ap-toolbar-meta">
            {filteredSuppliers.length}{" "}
            supplier
            {filteredSuppliers.length === 1
              ? ""
              : "s"}
          </div>

        </div>


        {/* =================================================
            TABLE
        ================================================== */}

        {loading ? (
          <div className="ap-table-loading">
            Loading supplier balances...
          </div>
        ) : filteredSuppliers.length ===
          0 ? (
          <EmptyState />
        ) : (
          <div className="ap-table-wrapper">
            <table className="ap-table ap-sb-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Posted Bills</th>
                  <th>Total Billed</th>
                  <th>Total Paid</th>
                  <th>Balance Due</th>
                  <th>Position</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredSuppliers.map(
                  (supplier) => (
                    <tr
                      key={supplier.id}
                    >
                      <td>
                        <div className="ap-table-supplier">
                          <div className="ap-table-avatar ap-sb-avatar">
                            {initials(
                              supplier.name
                            )}
                          </div>

                          <div className="ap-sb-supplier-copy">
                            <strong>
                              {supplier.name}
                            </strong>

                            <span>
                              {supplier.email ||
                                supplier.phone ||
                                "Supplier account"}
                            </span>
                          </div>
                        </div>
                      </td>


                      <td>
                        <span className="ap-sb-bill-count">
                          {supplier.bills}
                        </span>
                      </td>


                      <td>
                        <strong>
                          {money(
                            supplier.billed,
                            companyCurrency
                          )}
                        </strong>
                      </td>


                      <td>
                        {money(
                          supplier.paid,
                          companyCurrency
                        )}
                      </td>


                      <td>
                        <strong
                          className={
                            supplier.balance >
                            0
                              ? "ap-sb-balance-open"
                              : "ap-sb-balance-settled"
                          }
                        >
                          {money(
                            supplier.balance,
                            companyCurrency
                          )}
                        </strong>
                      </td>


                      <td>
                        <PositionBadge
                          balance={
                            supplier.balance
                          }
                        />
                      </td>


                      <td>
                        <button
                          type="button"
                          className="ap-sb-statement-button"
                          onClick={() =>
                            openStatement(
                              supplier.id
                            )
                          }
                        >
                          <Eye size={14} />
                          Statement
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


      {/* =====================================================
          FOOT SUMMARY
      ====================================================== */}

      {!loading &&
        supplierBalances.length > 0 && (
          <div className="ap-sb-foot-summary">

            <div>
              <FileText size={17} />

              <span>
                Posted Bills
              </span>

              <strong>
                {activeBills.length}
              </strong>
            </div>


            <div>
              <Wallet size={17} />

              <span>
                Open Supplier Accounts
              </span>

              <strong>
                {openSuppliers}
              </strong>
            </div>


            <div>
              <CircleDollarSign
                size={17}
              />

              <span>
                Settlement Rate
              </span>

              <strong>
                {totalBilled > 0
                  ? `${(
                      (totalPaid /
                        totalBilled) *
                      100
                    ).toFixed(1)}%`
                  : "0.0%"}
              </strong>
            </div>

          </div>
        )}

    </div>
  );
}
