import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
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

import { useLocation, useNavigate } from "react-router-dom";

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
  const balance = Number(
    bill?.balance_due || 0
  );

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

  return bill?.status || "OPEN";
}


function statusLabel(status) {
  const labels = {
    POSTED: "Posted",
    PARTIALLY_PAID: "Partially Paid",
    PAID: "Paid",
    OVERDUE: "Overdue",
    DRAFT: "Draft",
    VOIDED: "Voided",
    OPEN: "Open",
  };

  return labels[status] || status || "Open";
}


function statusClass(status) {
  if (status === "PAID") {
    return "ap-ss-status-paid";
  }

  if (status === "OVERDUE") {
    return "ap-ss-status-overdue";
  }

  if (status === "PARTIALLY_PAID") {
    return "ap-ss-status-partial";
  }

  return "ap-ss-status-open";
}


function transactionTypeLabel(transaction) {
  if (transaction.type === "BILL") {
    return "Supplier Bill";
  }

  return "Payment";
}


function transactionAmount(transaction) {
  if (transaction.type === "PAYMENT") {
    return -Math.abs(
      Number(transaction.amount || 0)
    );
  }

  return Number(transaction.amount || 0);
}


function SupplierHeader({
  supplier,
  currency,
  balance,
}) {
  return (
    <div className="ap-ss-supplier-header">
      <div className="ap-ss-supplier-identity">
        <div className="ap-ss-avatar">
          {initials(supplier?.name)}
        </div>

        <div>
          <span className="ap-ss-label">
            SUPPLIER ACCOUNT
          </span>

          <h2>
            {supplier?.name ||
              "Supplier"}
          </h2>

          <p>
            {supplier?.email ||
              supplier?.phone ||
              "No supplier contact information"}
          </p>
        </div>
      </div>

      <div className="ap-ss-balance-box">
        <span>Current Balance Due</span>

        <strong>
          {money(balance, currency)}
        </strong>

        <small>
          {balance > 0
            ? "Outstanding payable"
            : "Account settled"}
        </small>
      </div>
    </div>
  );
}


function BillDetailModal({
  bill,
  supplier,
  currency,
  onClose,
}) {
  if (!bill) return null;

  const items = Array.isArray(bill.items)
    ? bill.items
    : [];

  return (
    <div
      className="ap-ss-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="ap-ss-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Supplier bill details"
      >
        <div className="ap-ss-modal-header">
          <div>
            <span>
              SUPPLIER BILL
            </span>

            <h2>
              {bill.bill_number ||
                `Bill #${bill.id}`}
            </h2>

            <p>
              {supplier?.name ||
                "Unknown Supplier"}
            </p>
          </div>

          <button
            type="button"
            className="ap-ss-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="ap-ss-detail-grid">
          <div>
            <span>Bill Date</span>
            <strong>
              {formatDate(bill.bill_date)}
            </strong>
          </div>

          <div>
            <span>Due Date</span>
            <strong>
              {formatDate(bill.due_date)}
            </strong>
          </div>

          <div>
            <span>Total</span>
            <strong>
              {money(
                bill.total_amount,
                currency
              )}
            </strong>
          </div>

          <div>
            <span>Paid</span>
            <strong>
              {money(
                bill.amount_paid,
                currency
              )}
            </strong>
          </div>

          <div>
            <span>Balance Due</span>
            <strong className="ap-ss-detail-balance">
              {money(
                bill.balance_due,
                currency
              )}
            </strong>
          </div>

          <div>
            <span>Status</span>
            <strong
              className={`ap-ss-status ${statusClass(
                getBillStatus(bill)
              )}`}
            >
              {statusLabel(
                getBillStatus(bill)
              )}
            </strong>
          </div>
        </div>

        {items.length > 0 && (
          <div className="ap-ss-modal-section">
            <div className="ap-ss-section-title">
              <FileText size={16} />
              Bill Items
            </div>

            <div className="ap-ss-items">
              {items.map((item, index) => (
                <div
                  className="ap-ss-item"
                  key={item.id || index}
                >
                  <div>
                    <strong>
                      {item.description ||
                        item.product ||
                        "Item"}
                    </strong>

                    <span>
                      Qty:{" "}
                      {item.quantity || "—"}
                    </span>
                  </div>

                  <strong>
                    {money(
                      item.line_total,
                      currency
                    )}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {(bill.notes || bill.terms) && (
          <div className="ap-ss-notes">
            {bill.notes && (
              <div>
                <span>Notes</span>
                <p>{bill.notes}</p>
              </div>
            )}

            {bill.terms && (
              <div>
                <span>Terms</span>
                <p>{bill.terms}</p>
              </div>
            )}
          </div>
        )}

        <div className="ap-ss-modal-footer">
          <button
            type="button"
            className="ap-ss-secondary-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


export default function APSupplierStatements() {
  const { currentCompany } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();

  const companyId = currentCompany?.id;
  const currency =
    currentCompany?.currency || "USD";

  const [suppliers, setSuppliers] = useState([]);
  const [bills, setBills] = useState([]);
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState("");

  const [selectedSupplierId, setSelectedSupplierId] =
    useState("");

  const [search, setSearch] = useState("");
  const [transactionFilter, setTransactionFilter] =
    useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedBill, setSelectedBill] =
    useState(null);


  const loadData = useCallback(
    async (showRefresh = false) => {
      if (!companyId) {
        setSuppliers([]);
        setBills([]);
        setPayments([]);
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
          paymentsResponse,
        ] = await Promise.all([
          api.get(
            `/api/invoicing/suppliers/?company=${companyId}`
          ),
          api.get(
            `/api/invoicing/supplier-bills/?company=${companyId}`
          ),
          api.get(
            `/api/invoicing/supplier-payments/?company=${companyId}`
          ),
        ]);

        const supplierList =
          extractList(suppliersResponse);
        const billList =
          extractList(billsResponse);
        const paymentList =
          extractList(paymentsResponse);

        setSuppliers(supplierList);
        setBills(billList);
        setPayments(paymentList);

        if (!selectedSupplierId) {
          const stateSupplierId =
            location.state?.supplierId;

          if (stateSupplierId) {
            const exists =
              supplierList.some(
                (supplier) =>
                  String(supplier.id) ===
                  String(stateSupplierId)
              );

            if (exists) {
              setSelectedSupplierId(
                String(stateSupplierId)
              );
              return;
            }
          }

          if (supplierList.length > 0) {
            setSelectedSupplierId(
              String(supplierList[0].id)
            );
          }
        }
      } catch (err) {
        setError(
          err?.message ||
            "Unable to load supplier statements."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      companyId,
      selectedSupplierId,
      location.state,
    ]
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


  const selectedSupplier =
    supplierById[selectedSupplierId];


  const supplierBills = useMemo(() => {
    if (!selectedSupplierId) return [];

    return bills
      .filter(
        (bill) =>
          String(bill.supplier) ===
          String(selectedSupplierId)
      )
      .filter(
        (bill) =>
          bill.status !== "VOIDED" &&
          bill.status !== "DRAFT"
      )
      .sort((a, b) => {
        const aDate = new Date(
          a.bill_date || a.created_at
        ).getTime();

        const bDate = new Date(
          b.bill_date || b.created_at
        ).getTime();

        return aDate - bDate;
      });
  }, [bills, selectedSupplierId]);


  const supplierPayments = useMemo(() => {
    if (!selectedSupplierId) return [];

    const supplierBillIds = new Set(
      supplierBills.map((bill) =>
        String(bill.id)
      )
    );

    return payments
      .filter((payment) =>
        supplierBillIds.has(
          String(payment.bill)
        )
      )
      .sort((a, b) => {
        const aDate = new Date(
          a.payment_date ||
            a.created_at
        ).getTime();

        const bDate = new Date(
          b.payment_date ||
            b.created_at
        ).getTime();

        return aDate - bDate;
      });
  }, [payments, supplierBills]);


  const statementTransactions = useMemo(() => {
    const transactions = [];

    supplierBills.forEach((bill) => {
      transactions.push({
        id: `bill-${bill.id}`,
        type: "BILL",
        date:
          bill.bill_date ||
          bill.created_at,
        reference:
          bill.bill_number ||
          `Bill #${bill.id}`,
        description:
          "Supplier bill",
        amount: Number(
          bill.total_amount || 0
        ),
        bill,
      });
    });

    supplierPayments.forEach((payment) => {
      transactions.push({
        id: `payment-${payment.id}`,
        type: "PAYMENT",
        date:
          payment.payment_date ||
          payment.created_at,
        reference:
          payment.reference ||
          `Payment #${payment.id}`,
        description:
          `${getPaymentMethodLabel(
            payment.payment_method
          )} payment`,
        amount: -Math.abs(
          Number(payment.amount || 0)
        ),
        payment,
      });
    });

    return transactions.sort((a, b) => {
      const aDate = new Date(
        a.date
      ).getTime();

      const bDate = new Date(
        b.date
      ).getTime();

      return aDate - bDate;
    });
  }, [
    supplierBills,
    supplierPayments,
  ]);


  const runningTransactions = useMemo(() => {
    let balance = 0;

    return statementTransactions.map(
      (transaction) => {
        balance += transaction.amount;

        return {
          ...transaction,
          balance,
        };
      }
    );
  }, [statementTransactions]);


  const selectedSupplierBalance = useMemo(
    () =>
      supplierBills.reduce(
        (sum, bill) =>
          sum +
          Number(
            bill.balance_due || 0
          ),
        0
      ),
    [supplierBills]
  );


  const totalBilled = useMemo(
    () =>
      supplierBills.reduce(
        (sum, bill) =>
          sum +
          Number(
            bill.total_amount || 0
          ),
        0
      ),
    [supplierBills]
  );


  const totalPaid = useMemo(
    () =>
      supplierPayments.reduce(
        (sum, payment) =>
          sum +
          Number(
            payment.amount || 0
          ),
        0
      ),
    [supplierPayments]
  );


  const openBills = useMemo(
    () =>
      supplierBills.filter(
        (bill) =>
          Number(
            bill.balance_due || 0
          ) > 0
      ).length,
    [supplierBills]
  );


  const filteredTransactions = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return runningTransactions.filter(
      (transaction) => {
        const matchesSearch =
          !query ||
          transaction.reference
            .toLowerCase()
            .includes(query) ||
          transaction.description
            .toLowerCase()
            .includes(query);

        const matchesType =
          transactionFilter === "ALL" ||
          transaction.type ===
            transactionFilter;

        const transactionDate =
          transaction.date
            ? new Date(
                transaction.date
              )
            : null;

        const matchesFrom =
          !dateFrom ||
          (transactionDate &&
            transactionDate >=
              new Date(`${dateFrom}T00:00:00`));

        const matchesTo =
          !dateTo ||
          (transactionDate &&
            transactionDate <=
              new Date(`${dateTo}T23:59:59`));

        return (
          matchesSearch &&
          matchesType &&
          matchesFrom &&
          matchesTo
        );
      }
    );
  }, [
    runningTransactions,
    search,
    transactionFilter,
    dateFrom,
    dateTo,
  ]);


  const statementTotals = useMemo(() => {
    const billsTotal =
      filteredTransactions
        .filter(
          (transaction) =>
            transaction.type === "BILL"
        )
        .reduce(
          (sum, transaction) =>
            sum +
            transaction.amount,
          0
        );

    const paymentsTotal =
      filteredTransactions
        .filter(
          (transaction) =>
            transaction.type ===
            "PAYMENT"
        )
        .reduce(
          (sum, transaction) =>
            sum +
            Math.abs(
              transaction.amount
            ),
          0
        );

    return {
      bills: billsTotal,
      payments: paymentsTotal,
      net: billsTotal - paymentsTotal,
    };
  }, [filteredTransactions]);


  const handleExport = () => {
    exportCsv(
      "supplier-statement.csv",
      [
        "Date",
        "Type",
        "Reference",
        "Description",
        "Debit",
        "Credit",
        "Running Balance",
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
          transactionTypeLabel(
            transaction
          ),
          transaction.reference,
          transaction.description,
          transaction.type === "BILL"
            ? transaction.amount.toFixed(2)
            : "0.00",
          transaction.type === "PAYMENT"
            ? Math.abs(
                transaction.amount
              ).toFixed(2)
            : "0.00",
          transaction.balance.toFixed(2),
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
            Select a company to view supplier
            statements.
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

          <h1>Supplier Statements</h1>

          <p>
            Review each supplier's billing,
            payments and outstanding account
            balance.
          </p>
        </div>

        <div className="ap-header-actions">
          <button
            type="button"
            className="ap-header-button ap-ss-export"
            onClick={handleExport}
            disabled={
              !selectedSupplier ||
              filteredTransactions.length === 0
            }
          >
            <Download size={16} />
            Export Statement
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


      <section className="ap-panel ap-ss-selector-panel">

        <div className="ap-ss-selector-header">
          <div>
            <span>
              SUPPLIER ACCOUNT
            </span>

            <h2>
              Select Supplier
            </h2>

            <p>
              Choose a supplier to generate a
              complete account statement.
            </p>
          </div>

          <div className="ap-ss-selector-control">
            <UserRound size={17} />

            <select
              value={selectedSupplierId}
              onChange={(event) =>
                setSelectedSupplierId(
                  event.target.value
                )
              }
              disabled={
                loading ||
                suppliers.length === 0
              }
            >
              {suppliers.length === 0 ? (
                <option value="">
                  No suppliers available
                </option>
              ) : (
                suppliers
                  .slice()
                  .sort((a, b) =>
                    String(
                      a.name || ""
                    ).localeCompare(
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
                  ))
              )}
            </select>
          </div>
        </div>

        {selectedSupplier && (
          <SupplierHeader
            supplier={selectedSupplier}
            currency={currency}
            balance={
              selectedSupplierBalance
            }
          />
        )}

      </section>


      {selectedSupplier && (
        <>
          <div className="ap-ss-kpi-grid">

            <div className="ap-ss-kpi-card">
              <div className="ap-ss-kpi-icon">
                <ArrowUpRight size={19} />
              </div>

              <div>
                <span>Total Billed</span>
                <strong>
                  {money(
                    totalBilled,
                    currency
                  )}
                </strong>
                <small>
                  Supplier bills
                </small>
              </div>
            </div>


            <div className="ap-ss-kpi-card">
              <div className="ap-ss-kpi-icon">
                <ArrowDownRight size={19} />
              </div>

              <div>
                <span>Total Paid</span>
                <strong>
                  {money(
                    totalPaid,
                    currency
                  )}
                </strong>
                <small>
                  Recorded payments
                </small>
              </div>
            </div>


            <div className="ap-ss-kpi-card">
              <div className="ap-ss-kpi-icon">
                <Wallet size={19} />
              </div>

              <div>
                <span>Balance Due</span>
                <strong>
                  {money(
                    selectedSupplierBalance,
                    currency
                  )}
                </strong>
                <small>
                  Current payable
                </small>
              </div>
            </div>


            <div className="ap-ss-kpi-card">
              <div className="ap-ss-kpi-icon">
                <FileText size={19} />
              </div>

              <div>
                <span>Open Bills</span>
                <strong>
                  {openBills}
                </strong>
                <small>
                  Unsettled supplier bills
                </small>
              </div>
            </div>

          </div>


          <section className="ap-panel ap-ss-statement-panel">

            <div className="ap-ss-statement-header">
              <div>
                <h2>
                  Account Statement
                </h2>

                <p>
                  Bill and payment activity for{" "}
                  <strong>
                    {selectedSupplier.name}
                  </strong>
                  .
                </p>
              </div>

              <div className="ap-ss-statement-date">
                <CalendarDays size={15} />
                <span>
                  As of{" "}
                  {formatDate(new Date())}
                </span>
              </div>
            </div>


            <div className="ap-ss-toolbar">

              <div className="ap-ss-search">
                <Search size={16} />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search reference or description..."
                />
              </div>


              <div className="ap-ss-filter">
                <FileText size={15} />

                <select
                  value={transactionFilter}
                  onChange={(event) =>
                    setTransactionFilter(
                      event.target.value
                    )
                  }
                >
                  <option value="ALL">
                    All Transactions
                  </option>

                  <option value="BILL">
                    Supplier Bills
                  </option>

                  <option value="PAYMENT">
                    Payments
                  </option>
                </select>
              </div>


              <label className="ap-ss-date-filter">
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


              <label className="ap-ss-date-filter">
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


            <div className="ap-ss-summary-strip">

              <div>
                <span>Statement Bills</span>
                <strong>
                  {money(
                    statementTotals.bills,
                    currency
                  )}
                </strong>
              </div>

              <div>
                <span>Statement Payments</span>
                <strong>
                  {money(
                    statementTotals.payments,
                    currency
                  )}
                </strong>
              </div>

              <div>
                <span>Net Activity</span>
                <strong>
                  {money(
                    statementTotals.net,
                    currency
                  )}
                </strong>
              </div>

            </div>


            {loading ? (
              <div className="ap-table-loading">
                Loading supplier statement...
              </div>
            ) : filteredTransactions.length ===
              0 ? (
              <div className="ap-ss-empty">
                <CheckCircle2 size={38} />

                <strong>
                  No statement activity found
                </strong>

                <span>
                  This supplier has no transactions
                  matching the current filters.
                </span>
              </div>
            ) : (
              <div className="ap-table-wrapper">
                <table className="ap-table ap-ss-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Reference</th>
                      <th>Description</th>
                      <th>Debit</th>
                      <th>Credit</th>
                      <th>Running Balance</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredTransactions.map(
                      (transaction) => (
                        <tr
                          key={
                            transaction.id
                          }
                        >
                          <td>
                            {formatDate(
                              transaction.date
                            )}
                          </td>

                          <td>
                            <span
                              className={`ap-ss-type ap-ss-type-${transaction.type.toLowerCase()}`}
                            >
                              {transactionTypeLabel(
                                transaction
                              )}
                            </span>
                          </td>

                          <td>
                            <strong className="ap-ss-reference">
                              {
                                transaction.reference
                              }
                            </strong>
                          </td>

                          <td>
                            <span className="ap-ss-description">
                              {
                                transaction.description
                              }
                            </span>
                          </td>

                          <td>
                            {transaction.type ===
                            "BILL" ? (
                              <strong className="ap-ss-debit">
                                {money(
                                  transaction.amount,
                                  currency
                                )}
                              </strong>
                            ) : (
                              <span className="ap-ss-muted">
                                —
                              </span>
                            )}
                          </td>

                          <td>
                            {transaction.type ===
                            "PAYMENT" ? (
                              <strong className="ap-ss-credit">
                                {money(
                                  Math.abs(
                                    transaction.amount
                                  ),
                                  currency
                                )}
                              </strong>
                            ) : (
                              <span className="ap-ss-muted">
                                —
                              </span>
                            )}
                          </td>

                          <td>
                            <strong className="ap-ss-running">
                              {money(
                                transaction.balance,
                                currency
                              )}
                            </strong>
                          </td>

                          <td>
                            {transaction.type ===
                            "BILL" ? (
                              <button
                                type="button"
                                className="ap-ss-view-button"
                                onClick={() =>
                                  setSelectedBill(
                                    transaction.bill
                                  )
                                }
                              >
                                <Eye size={14} />
                                View
                              </button>
                            ) : (
                              <span className="ap-ss-payment-method">
                                {getPaymentMethodLabel(
                                  transaction
                                    .payment
                                    ?.payment_method
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}

          </section>


          <div className="ap-ss-footer-summary">

            <div>
              <span>Supplier</span>
              <strong>
                {selectedSupplier.name}
              </strong>
            </div>

            <div>
              <span>Transactions</span>
              <strong>
                {filteredTransactions.length}
              </strong>
            </div>

            <div>
              <span>Current Balance</span>
              <strong>
                {money(
                  selectedSupplierBalance,
                  currency
                )}
              </strong>
            </div>

          </div>
        </>
      )}


      {selectedBill && (
        <BillDetailModal
          bill={selectedBill}
          supplier={selectedSupplier}
          currency={currency}
          onClose={() =>
            setSelectedBill(null)
          }
        />
      )}

    </div>
  );
}
