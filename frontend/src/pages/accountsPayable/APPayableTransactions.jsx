import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Download,
  FileText,
  RefreshCw,
  Search,
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


function getPaymentMethodLabel(method) {
  const labels = {
    CASH: "Cash",
    BANK: "Bank",
    MOBILE_MONEY: "Mobile Money",
    CARD: "Card",
  };

  return labels[method] || method || "—";
}


function getBillStatus(bill) {
  const balance = Number(bill?.balance_due || 0);

  if (balance <= 0) return "PAID";

  if (bill?.status === "OVERDUE") {
    return "OVERDUE";
  }

  if (bill?.due_date) {
    const due = new Date(bill.due_date);
    const today = new Date();

    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    if (due < today) return "OVERDUE";
  }

  return bill?.status || "POSTED";
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

  return labels[status] || status || "Posted";
}


function statusClass(status) {
  if (status === "PAID") {
    return "ap-pt-status-paid";
  }

  if (status === "OVERDUE") {
    return "ap-pt-status-overdue";
  }

  if (status === "PARTIALLY_PAID") {
    return "ap-pt-status-partial";
  }

  return "ap-pt-status-posted";
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


export default function APPayableTransactions() {
  const { currentCompany } = useCompany();
  const navigate = useNavigate();

  const companyId = currentCompany?.id;
  const currency =
    currentCompany?.currency || "USD";

  const [bills, setBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] =
    useState("ALL");
  const [supplierFilter, setSupplierFilter] =
    useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadData = useCallback(
    async (showRefresh = false) => {
      if (!companyId) {
        setBills([]);
        setPayments([]);
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
          paymentsResponse,
          suppliersResponse,
        ] = await Promise.all([
          api.get(
            `/api/invoicing/supplier-bills/?company=${companyId}`
          ),
          api.get(
            `/api/invoicing/supplier-payments/?company=${companyId}`
          ),
          api.get(
            `/api/invoicing/suppliers/?company=${companyId}`
          ),
        ]);

        setBills(
          extractList(billsResponse)
        );

        setPayments(
          extractList(paymentsResponse)
        );

        setSuppliers(
          extractList(suppliersResponse)
        );
      } catch (err) {
        setError(
          err?.message ||
            "Unable to load payable transactions."
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


  const transactions = useMemo(() => {
    const rows = [];

    bills
      .filter(
        (bill) =>
          bill.status !== "DRAFT" &&
          bill.status !== "VOIDED"
      )
      .forEach((bill) => {
        rows.push({
          id: `bill-${bill.id}`,
          type: "BILL",
          date:
            bill.bill_date ||
            bill.created_at,
          reference:
            bill.bill_number ||
            `Bill #${bill.id}`,
          supplierId: bill.supplier,
          description: "Supplier bill",
          amount: Number(
            bill.total_amount || 0
          ),
          balanceDue: Number(
            bill.balance_due || 0
          ),
          status: getBillStatus(bill),
          bill,
        });
      });

    payments.forEach((payment) => {
      const bill = bills.find(
        (item) =>
          String(item.id) ===
          String(payment.bill)
      );

      rows.push({
        id: `payment-${payment.id}`,
        type: "PAYMENT",
        date:
          payment.payment_date ||
          payment.created_at,
        reference:
          payment.reference ||
          `Payment #${payment.id}`,
        supplierId: bill?.supplier,
        description:
          `${getPaymentMethodLabel(
            payment.payment_method
          )} supplier payment`,
        amount: -Math.abs(
          Number(payment.amount || 0)
        ),
        balanceDue: null,
        status: "PAID",
        payment,
        bill,
      });
    });

    return rows.sort((a, b) => {
      const aDate = new Date(
        a.date
      ).getTime();

      const bDate = new Date(
        b.date
      ).getTime();

      return bDate - aDate;
    });
  }, [bills, payments]);


  const filteredTransactions = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return transactions.filter(
      (transaction) => {
        const supplier =
          supplierById[
            transaction.supplierId
          ];

        const matchesSearch =
          !query ||
          transaction.reference
            .toLowerCase()
            .includes(query) ||
          transaction.description
            .toLowerCase()
            .includes(query) ||
          String(
            supplier?.name || ""
          )
            .toLowerCase()
            .includes(query);

        const matchesType =
          typeFilter === "ALL" ||
          transaction.type === typeFilter;

        const matchesSupplier =
          supplierFilter === "ALL" ||
          String(
            transaction.supplierId
          ) === String(supplierFilter);

        const transactionDate =
          transaction.date
            ? new Date(transaction.date)
            : null;

        const matchesFrom =
          !dateFrom ||
          (transactionDate &&
            transactionDate >=
              new Date(
                `${dateFrom}T00:00:00`
              ));

        const matchesTo =
          !dateTo ||
          (transactionDate &&
            transactionDate <=
              new Date(
                `${dateTo}T23:59:59`
              ));

        return (
          matchesSearch &&
          matchesType &&
          matchesSupplier &&
          matchesFrom &&
          matchesTo
        );
      }
    );
  }, [
    transactions,
    supplierById,
    search,
    typeFilter,
    supplierFilter,
    dateFrom,
    dateTo,
  ]);


  const totalBills = useMemo(
    () =>
      filteredTransactions
        .filter(
          (transaction) =>
            transaction.type === "BILL"
        )
        .reduce(
          (sum, transaction) =>
            sum + transaction.amount,
          0
        ),
    [filteredTransactions]
  );


  const totalPayments = useMemo(
    () =>
      filteredTransactions
        .filter(
          (transaction) =>
            transaction.type ===
            "PAYMENT"
        )
        .reduce(
          (sum, transaction) =>
            sum +
            Math.abs(transaction.amount),
          0
        ),
    [filteredTransactions]
  );


  const netActivity =
    totalBills - totalPayments;


  const outstandingBalance = useMemo(
    () =>
      bills
        .filter(
          (bill) =>
            bill.status !== "DRAFT" &&
            bill.status !== "VOIDED"
        )
        .reduce(
          (sum, bill) =>
            sum +
            Number(
              bill.balance_due || 0
            ),
          0
        ),
    [bills]
  );


  const handleExport = () => {
    exportCsv(
      "payable-transactions.csv",
      [
        "Date",
        "Type",
        "Reference",
        "Supplier",
        "Description",
        "Debit",
        "Credit",
        "Status",
      ],
      filteredTransactions.map(
        (transaction) => [
          transaction.date
            ? new Date(
                transaction.date
              )
                .toISOString()
                .slice(0, 10)
            : "",
          transaction.type === "BILL"
            ? "Supplier Bill"
            : "Payment",
          transaction.reference,
          supplierById[
            transaction.supplierId
          ]?.name || "Unknown Supplier",
          transaction.description,
          transaction.type === "BILL"
            ? transaction.amount.toFixed(2)
            : "0.00",
          transaction.type === "PAYMENT"
            ? Math.abs(
                transaction.amount
              ).toFixed(2)
            : "0.00",
          statusLabel(
            transaction.status
          ),
        ]
      )
    );
  };


  if (!companyId) {
    return (
      <div className="ap-page">
        <div className="ap-empty-state">
          <Wallet size={42} />
          <h2>Select a company</h2>
          <p>
            Select a company to view payable
            transactions.
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="ap-page">

      <div className="ap-page-header">
        <div>
          <div className="ap-eyebrow">
            ACCOUNTS PAYABLE
          </div>

          <h1>Payable Transactions</h1>

          <p>
            Review supplier bills and payments
            recorded against your company's
            accounts payable.
          </p>
        </div>

        <div className="ap-header-actions">
          <button
            type="button"
            className="ap-header-button ap-pt-export"
            onClick={handleExport}
            disabled={
              filteredTransactions.length ===
              0
            }
          >
            <Download size={16} />
            Export Transactions
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


      {error && (
        <div className="ap-alert">
          <span>{error}</span>
        </div>
      )}


      <div className="ap-pt-kpi-grid">

        <div className="ap-pt-kpi-card">
          <div className="ap-pt-kpi-icon">
            <ArrowUpRight size={19} />
          </div>

          <div>
            <span>Bills</span>

            <strong>
              {loading
                ? "—"
                : money(
                    totalBills,
                    currency
                  )}
            </strong>

            <small>
              Filtered supplier charges
            </small>
          </div>
        </div>


        <div className="ap-pt-kpi-card">
          <div className="ap-pt-kpi-icon">
            <ArrowDownRight size={19} />
          </div>

          <div>
            <span>Payments</span>

            <strong>
              {loading
                ? "—"
                : money(
                    totalPayments,
                    currency
                  )}
            </strong>

            <small>
              Filtered supplier payments
            </small>
          </div>
        </div>


        <div className="ap-pt-kpi-card">
          <div className="ap-pt-kpi-icon">
            <Wallet size={19} />
          </div>

          <div>
            <span>Net Activity</span>

            <strong>
              {loading
                ? "—"
                : money(
                    netActivity,
                    currency
                  )}
            </strong>

            <small>
              Bills less payments
            </small>
          </div>
        </div>


        <div className="ap-pt-kpi-card">
          <div className="ap-pt-kpi-icon">
            <FileText size={19} />
          </div>

          <div>
            <span>Open Payables</span>

            <strong>
              {loading
                ? "—"
                : money(
                    outstandingBalance,
                    currency
                  )}
            </strong>

            <small>
              Current company balance
            </small>
          </div>
        </div>

      </div>


      <section className="ap-panel ap-pt-panel">

        <div className="ap-pt-panel-header">
          <div>
            <h2>Transaction Ledger</h2>

            <p>
              Every posted supplier bill and
              recorded supplier payment for the
              selected company.
            </p>
          </div>

          <div className="ap-pt-count">
            <span>Transactions</span>

            <strong>
              {filteredTransactions.length}
            </strong>
          </div>
        </div>


        <div className="ap-pt-toolbar">

          <div className="ap-pt-search">
            <Search size={16} />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search reference, supplier or description..."
            />
          </div>


          <div className="ap-pt-filter">
            <FileText size={15} />

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All Types
              </option>

              <option value="BILL">
                Supplier Bills
              </option>

              <option value="PAYMENT">
                Payments
              </option>
            </select>
          </div>


          <div className="ap-pt-filter">
            <Wallet size={15} />

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
                .slice()
                .sort((a, b) =>
                  String(a.name || "")
                    .localeCompare(
                      String(
                        b.name || ""
                      )
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


          <label className="ap-pt-date">
            <span>From</span>

            <input
              type="date"
              value={dateFrom}
              onChange={(event) =>
                setDateFrom(
                  event.target.value
                )
              }
            />
          </label>


          <label className="ap-pt-date">
            <span>To</span>

            <input
              type="date"
              value={dateTo}
              onChange={(event) =>
                setDateTo(
                  event.target.value
                )
              }
            />
          </label>

        </div>


        <div className="ap-pt-summary">

          <div>
            <span>
              Supplier Bills
            </span>

            <strong>
              {money(
                totalBills,
                currency
              )}
            </strong>
          </div>

          <div>
            <span>
              Supplier Payments
            </span>

            <strong>
              {money(
                totalPayments,
                currency
              )}
            </strong>
          </div>

          <div>
            <span>
              Net Payable Activity
            </span>

            <strong>
              {money(
                netActivity,
                currency
              )}
            </strong>
          </div>

        </div>


        {loading ? (
          <div className="ap-table-loading">
            Loading payable transactions...
          </div>
        ) : filteredTransactions.length ===
          0 ? (
          <div className="ap-pt-empty">
            <FileText size={38} />

            <strong>
              No payable transactions found
            </strong>

            <span>
              Try changing the filters or search
              criteria.
            </span>
          </div>
        ) : (
          <div className="ap-table-wrapper">
            <table className="ap-table ap-pt-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Supplier</th>
                  <th>Description</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredTransactions.map(
                  (transaction) => {
                    const supplier =
                      supplierById[
                        transaction
                          .supplierId
                      ];

                    return (
                      <tr
                        key={
                          transaction.id
                        }
                      >
                        <td>
                          <div className="ap-pt-date-cell">
                            <CalendarDays
                              size={14}
                            />

                            <span>
                              {formatDate(
                                transaction.date
                              )}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`ap-pt-type ap-pt-type-${transaction.type.toLowerCase()}`}
                          >
                            {transaction.type ===
                            "BILL" ? (
                              <>
                                <ArrowUpRight
                                  size={12}
                                />
                                Bill
                              </>
                            ) : (
                              <>
                                <ArrowDownRight
                                  size={12}
                                />
                                Payment
                              </>
                            )}
                          </span>
                        </td>

                        <td>
                          <strong className="ap-pt-reference">
                            {
                              transaction.reference
                            }
                          </strong>
                        </td>

                        <td>
                          <div className="ap-pt-supplier">
                            <div className="ap-pt-avatar">
                              {initials(
                                supplier?.name ||
                                  "Supplier"
                              )}
                            </div>

                            <div>
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
                          </div>
                        </td>

                        <td>
                          <span className="ap-pt-description">
                            {
                              transaction.description
                            }
                          </span>
                        </td>

                        <td>
                          {transaction.type ===
                          "BILL" ? (
                            <strong className="ap-pt-debit">
                              {money(
                                transaction.amount,
                                currency
                              )}
                            </strong>
                          ) : (
                            <span className="ap-pt-muted">
                              —
                            </span>
                          )}
                        </td>

                        <td>
                          {transaction.type ===
                          "PAYMENT" ? (
                            <strong className="ap-pt-credit">
                              {money(
                                Math.abs(
                                  transaction.amount
                                ),
                                currency
                              )}
                            </strong>
                          ) : (
                            <span className="ap-pt-muted">
                              —
                            </span>
                          )}
                        </td>

                        <td>
                          <span
                            className={`ap-pt-status ${statusClass(
                              transaction.status
                            )}`}
                          >
                            {statusLabel(
                              transaction.status
                            )}
                          </span>
                        </td>

                        <td>
                          {transaction.type ===
                          "BILL" ? (
                            <button
                              type="button"
                              className="ap-pt-action"
                              onClick={() =>
                                navigate(
                                  "/accounts-payable/outstanding"
                                )
                              }
                            >
                              View Bill
                              <ChevronRight
                                size={13}
                              />
                            </button>
                          ) : (
                            <span className="ap-pt-payment-method">
                              {getPaymentMethodLabel(
                                transaction
                                  .payment
                                  ?.payment_method
                              )}
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

      </section>


      <div className="ap-pt-footer">

        <div>
          <span>Posted Bills</span>

          <strong>
            {
              transactions.filter(
                (transaction) =>
                  transaction.type ===
                  "BILL"
              ).length
            }
          </strong>
        </div>

        <div>
          <span>Payments Recorded</span>

          <strong>
            {
              transactions.filter(
                (transaction) =>
                  transaction.type ===
                  "PAYMENT"
              ).length
            }
          </strong>
        </div>

        <div>
          <span>Open Payable Balance</span>

          <strong>
            {money(
              outstandingBalance,
              currency
            )}
          </strong>
        </div>

      </div>

    </div>
  );
}
