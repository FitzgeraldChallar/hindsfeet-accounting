import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  FileText,
  RefreshCw,
  Search,
  UserRound,
  Wallet,
  X,
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


function dateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function startOfDay(value = new Date()) {
  const date = new Date(value);

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}


function daysUntilDue(value) {
  if (!value) return null;

  const due = startOfDay(value);
  const today = startOfDay();

  return Math.ceil(
    (due.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}


function billState(bill) {
  const balance = Number(bill?.balance_due || 0);

  if (balance <= 0) {
    return "PAID";
  }

  const days = daysUntilDue(bill?.due_date);

  if (days !== null && days < 0) {
    return "OVERDUE";
  }

  if (days !== null && days <= 7) {
    return "DUE_SOON";
  }

  return "CURRENT";
}


function stateLabel(state) {
  if (state === "OVERDUE") return "Overdue";
  if (state === "DUE_SOON") return "Due Soon";
  if (state === "CURRENT") return "Current";
  if (state === "PAID") return "Paid";

  return state || "Open";
}


function stateClass(state) {
  if (state === "OVERDUE") {
    return "ap-ob-status ap-ob-status-overdue";
  }

  if (state === "DUE_SOON") {
    return "ap-ob-status ap-ob-status-due-soon";
  }

  return "ap-ob-status ap-ob-status-current";
}


function dueText(bill) {
  const days = daysUntilDue(bill?.due_date);

  if (days === null) return "No due date";

  if (days < 0) {
    const count = Math.abs(days);
    return `${count} day${count === 1 ? "" : "s"} overdue`;
  }

  if (days === 0) return "Due today";

  if (days === 1) return "Due tomorrow";

  return `Due in ${days} days`;
}


function todayOrPast(value) {
  if (!value) return true;

  return startOfDay(value) <= startOfDay();
}


function getPaymentMethods() {
  return [
    ["CASH", "Cash"],
    ["BANK", "Bank"],
    ["MOBILE_MONEY", "Mobile Money"],
    ["CARD", "Card"],
  ];
}


function BillDetailsModal({
  bill,
  supplier,
  currency,
  onClose,
  onRecordPayment,
  onViewStatement,
}) {
  if (!bill) return null;

  const state = billState(bill);
  const balance = Number(bill.balance_due || 0);
  const items = Array.isArray(bill.items)
    ? bill.items
    : [];

  return (
    <div
      className="ap-ob-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="ap-ob-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Supplier bill details"
      >
        <div className="ap-ob-modal-header">
          <div>
            <span className="ap-ob-modal-eyebrow">
              SUPPLIER BILL
            </span>

            <h2>
              {bill.bill_number || `Bill #${bill.id}`}
            </h2>

            <p>
              {supplier?.name || "Unknown supplier"}
            </p>
          </div>

          <button
            type="button"
            className="ap-ob-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="ap-ob-detail-grid">
          <div>
            <span>Bill Date</span>
            <strong>{formatDate(bill.bill_date)}</strong>
          </div>

          <div>
            <span>Due Date</span>
            <strong>{formatDate(bill.due_date)}</strong>
          </div>

          <div>
            <span>Total Amount</span>
            <strong>
              {money(bill.total_amount, currency)}
            </strong>
          </div>

          <div>
            <span>Amount Paid</span>
            <strong>
              {money(bill.amount_paid, currency)}
            </strong>
          </div>

          <div className="ap-ob-detail-balance">
            <span>Balance Due</span>
            <strong>
              {money(balance, currency)}
            </strong>
          </div>

          <div>
            <span>Status</span>
            <strong className={stateClass(state)}>
              {stateLabel(state)}
            </strong>
          </div>
        </div>

        <div className="ap-ob-due-banner">
          {state === "OVERDUE" ? (
            <AlertCircle size={17} />
          ) : (
            <CalendarClock size={17} />
          )}

          <div>
            <strong>{dueText(bill)}</strong>
            <span>
              {state === "OVERDUE"
                ? "This supplier balance requires attention."
                : "Keep this bill on your payment schedule."}
            </span>
          </div>
        </div>

        {items.length > 0 && (
          <div className="ap-ob-detail-section">
            <div className="ap-ob-detail-section-title">
              <FileText size={16} />
              Bill Items
            </div>

            <div className="ap-ob-items">
              {items.map((item, index) => (
                <div
                  className="ap-ob-item"
                  key={item.id || index}
                >
                  <div>
                    <strong>
                      {item.description ||
                        item.product ||
                        "Item"}
                    </strong>

                    <span>
                      Qty: {item.quantity || "—"}
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
          <div className="ap-ob-notes">
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

        <div className="ap-ob-modal-actions">
          <button
            type="button"
            className="ap-ob-secondary-btn"
            onClick={() =>
              onViewStatement(supplier?.id)
            }
          >
            <Eye size={16} />
            Supplier Statement
          </button>

          {balance > 0 && (
            <button
              type="button"
              className="ap-ob-primary-btn"
              onClick={() => onRecordPayment(bill)}
            >
              <CreditCard size={16} />
              Record Payment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


function PaymentModal({
  bill,
  supplier,
  currency,
  paymentForm,
  setPaymentForm,
  saving,
  onClose,
  onSubmit,
}) {
  if (!bill) return null;

  const balance = Number(bill.balance_due || 0);

  return (
    <div
      className="ap-ob-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        className="ap-ob-modal ap-ob-payment-modal"
        onSubmit={onSubmit}
      >
        <div className="ap-ob-modal-header">
          <div>
            <span className="ap-ob-modal-eyebrow">
              ACCOUNTS PAYABLE
            </span>

            <h2>Record Payment</h2>

            <p>
              {supplier?.name || "Supplier"} ·{" "}
              {bill.bill_number || `Bill #${bill.id}`}
            </p>
          </div>

          <button
            type="button"
            className="ap-ob-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="ap-ob-payment-summary">
          <div>
            <span>Outstanding Balance</span>
            <strong>
              {money(balance, currency)}
            </strong>
          </div>

          <div>
            <span>Supplier</span>
            <strong>
              {supplier?.name || "Unknown supplier"}
            </strong>
          </div>
        </div>

        <div className="ap-ob-form-grid">
          <label>
            <span>Payment Amount *</span>

            <div className="ap-ob-money-input">
              <span>{currency}</span>

              <input
                type="number"
                min="0.01"
                max={balance}
                step="0.01"
                value={paymentForm.amount}
                onChange={(event) =>
                  setPaymentForm((previous) => ({
                    ...previous,
                    amount: event.target.value,
                  }))
                }
                required
              />
            </div>
          </label>

          <label>
            <span>Payment Date *</span>

            <input
              type="date"
              value={paymentForm.payment_date}
              onChange={(event) =>
                setPaymentForm((previous) => ({
                  ...previous,
                  payment_date: event.target.value,
                }))
              }
              required
            />
          </label>

          <label>
            <span>Payment Method *</span>

            <select
              value={paymentForm.payment_method}
              onChange={(event) =>
                setPaymentForm((previous) => ({
                  ...previous,
                  payment_method: event.target.value,
                }))
              }
              required
            >
              {getPaymentMethods().map(
                ([value, label]) => (
                  <option
                    value={value}
                    key={value}
                  >
                    {label}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            <span>Reference</span>

            <input
              type="text"
              value={paymentForm.reference}
              onChange={(event) =>
                setPaymentForm((previous) => ({
                  ...previous,
                  reference: event.target.value,
                }))
              }
              placeholder="Receipt, transfer or transaction reference"
            />
          </label>

          <label className="ap-ob-form-full">
            <span>Notes</span>

            <textarea
              rows="3"
              value={paymentForm.notes}
              onChange={(event) =>
                setPaymentForm((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }))
              }
              placeholder="Optional payment notes..."
            />
          </label>
        </div>

        <div className="ap-ob-modal-actions">
          <button
            type="button"
            className="ap-ob-secondary-btn"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="ap-ob-primary-btn"
            disabled={saving}
          >
            {saving ? (
              <>
                <RefreshCw
                  size={16}
                  className="ap-spin"
                />
                Recording...
              </>
            ) : (
              <>
                <CreditCard size={16} />
                Record Payment
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}


export default function APOutstandingBills() {
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
  const [savingPayment, setSavingPayment] =
    useState(false);
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] =
    useState("");

  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] =
    useState("ALL");
  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [selectedBill, setSelectedBill] =
    useState(null);
  const [paymentBill, setPaymentBill] =
    useState(null);

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: dateInputValue(),
    payment_method: "BANK",
    reference: "",
    notes: "",
  });


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
            "Unable to load outstanding bills."
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
    return bills
      .filter((bill) => {
        const balance = Number(
          bill.balance_due || 0
        );

        return (
          balance > 0 &&
          bill.status !== "DRAFT" &&
          bill.status !== "VOIDED"
        );
      })
      .sort((a, b) => {
        const aDate = a.due_date
          ? new Date(a.due_date).getTime()
          : Number.MAX_SAFE_INTEGER;

        const bDate = b.due_date
          ? new Date(b.due_date).getTime()
          : Number.MAX_SAFE_INTEGER;

        return aDate - bDate;
      });
  }, [bills]);


  const stats = useMemo(() => {
    const overdue = outstandingBills.filter(
      (bill) =>
        billState(bill) === "OVERDUE"
    );

    const dueSoon = outstandingBills.filter(
      (bill) =>
        billState(bill) === "DUE_SOON"
    );

    const current = outstandingBills.filter(
      (bill) =>
        billState(bill) === "CURRENT"
    );

    return {
      count: outstandingBills.length,
      outstanding: outstandingBills.reduce(
        (sum, bill) =>
          sum + Number(bill.balance_due || 0),
        0
      ),
      overdueAmount: overdue.reduce(
        (sum, bill) =>
          sum + Number(bill.balance_due || 0),
        0
      ),
      dueSoonAmount: dueSoon.reduce(
        (sum, bill) =>
          sum + Number(bill.balance_due || 0),
        0
      ),
      overdueCount: overdue.length,
      dueSoonCount: dueSoon.length,
      currentCount: current.length,
    };
  }, [outstandingBills]);


  const filteredBills = useMemo(() => {
    const query = search.trim().toLowerCase();

    return outstandingBills.filter((bill) => {
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

      const state = billState(bill);

      const matchesStatus =
        statusFilter === "ALL" ||
        state === statusFilter;

      return (
        matchesSearch &&
        matchesSupplier &&
        matchesStatus
      );
    });
  }, [
    outstandingBills,
    supplierById,
    search,
    supplierFilter,
    statusFilter,
  ]);


  const openPayment = (bill) => {
    setSelectedBill(null);
    setPaymentError("");

    setPaymentBill(bill);

    setPaymentForm({
      amount: Number(
        bill.balance_due || 0
      ).toFixed(2),
      payment_date: dateInputValue(),
      payment_method: "BANK",
      reference: "",
      notes: "",
    });
  };


  const handlePayment = async (event) => {
    event.preventDefault();

    if (!paymentBill) return;

    const amount = Number(
      paymentForm.amount
    );

    const balance = Number(
      paymentBill.balance_due || 0
    );

    if (!amount || amount <= 0) {
      setPaymentError(
        "Enter a payment amount greater than zero."
      );
      return;
    }

    if (amount > balance) {
      setPaymentError(
        "Payment cannot be greater than the outstanding balance."
      );
      return;
    }

    setSavingPayment(true);
    setPaymentError("");

    try {
      await api.post(
        "/api/invoicing/supplier-payments/create/",
        {
          bill: paymentBill.id,
          amount: amount.toFixed(2),
          payment_date:
            paymentForm.payment_date,
          payment_method:
            paymentForm.payment_method,
          reference:
            paymentForm.reference.trim(),
          notes: paymentForm.notes.trim(),
        }
      );

      setPaymentBill(null);
      setSelectedBill(null);

      await loadData(true);
    } catch (err) {
      const data = err?.data;

      if (data && typeof data === "object") {
        const firstError =
          Object.values(data)
            .flat()
            .find(Boolean);

        setPaymentError(
          firstError ||
            err?.message ||
            "Unable to record payment."
        );
      } else {
        setPaymentError(
          err?.message ||
            "Unable to record payment."
        );
      }
    } finally {
      setSavingPayment(false);
    }
  };


  const viewStatement = (supplierId) => {
    if (!supplierId) return;

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
            Select a company to view outstanding
            supplier bills.
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

          <h1>Outstanding Bills</h1>

          <p>
            Track unpaid supplier bills, upcoming
            due dates and overdue balances.
          </p>
        </div>

        <div className="ap-header-actions">
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


      {/* =====================================================
          KPI CARDS
      ====================================================== */}

      <div className="ap-kpi-grid ap-ob-kpi-grid">

        <div className="ap-kpi-card">
          <div className="ap-kpi-icon">
            <FileText size={22} />
          </div>

          <div className="ap-kpi-content">
            <span>Outstanding Bills</span>

            <strong>
              {loading
                ? "—"
                : stats.count}
            </strong>

            <small>
              Unpaid posted bills
            </small>
          </div>
        </div>


        <div className="ap-kpi-card">
          <div className="ap-kpi-icon">
            <Wallet size={22} />
          </div>

          <div className="ap-kpi-content">
            <span>Total Outstanding</span>

            <strong>
              {loading
                ? "—"
                : money(
                    stats.outstanding,
                    currency
                  )}
            </strong>

            <small>
              Remaining supplier liability
            </small>
          </div>
        </div>


        <div className="ap-kpi-card">
          <div className="ap-kpi-icon">
            <AlertCircle size={22} />
          </div>

          <div className="ap-kpi-content">
            <span>Overdue</span>

            <strong>
              {loading
                ? "—"
                : money(
                    stats.overdueAmount,
                    currency
                  )}
            </strong>

            <small>
              {stats.overdueCount} bill
              {stats.overdueCount === 1
                ? ""
                : "s"} overdue
            </small>
          </div>
        </div>


        <div className="ap-kpi-card ap-kpi-primary">
          <div className="ap-kpi-icon">
            <Clock3 size={22} />
          </div>

          <div className="ap-kpi-content">
            <span>Due Within 7 Days</span>

            <strong>
              {loading
                ? "—"
                : money(
                    stats.dueSoonAmount,
                    currency
                  )}
            </strong>

            <small>
              {stats.dueSoonCount} bill
              {stats.dueSoonCount === 1
                ? ""
                : "s"} due soon
            </small>
          </div>
        </div>

      </div>


      {/* =====================================================
          MAIN PANEL
      ====================================================== */}

      <section className="ap-panel ap-ob-panel">

        <div className="ap-ob-panel-header">
          <div>
            <h2>Open Supplier Bills</h2>

            <p>
              Review balances and take action on
              unpaid supplier obligations.
            </p>
          </div>

          <div className="ap-ob-header-summary">
            <span>Open Balance</span>

            <strong>
              {money(
                stats.outstanding,
                currency
              )}
            </strong>
          </div>
        </div>


        {/* =================================================
            TOOLBAR
        ================================================== */}

        <div className="ap-ob-toolbar">

          <div className="ap-ob-search">
            <Search size={17} />

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


          <div className="ap-ob-select-wrap">
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


          <div className="ap-ob-select-wrap">
            <CalendarClock size={15} />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All Open Bills
              </option>

              <option value="OVERDUE">
                Overdue
              </option>

              <option value="DUE_SOON">
                Due Within 7 Days
              </option>

              <option value="CURRENT">
                Current
              </option>
            </select>
          </div>

          <span className="ap-ob-result-count">
            {filteredBills.length} bill
            {filteredBills.length === 1
              ? ""
              : "s"}
          </span>

        </div>


        {/* =================================================
            TABLE
        ================================================== */}

        {loading ? (
          <div className="ap-table-loading">
            Loading outstanding bills...
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="ap-ob-empty">
            <CheckCircle2 size={38} />

            <strong>
              No outstanding bills found
            </strong>

            <span>
              There are no unpaid posted supplier
              bills matching your current filters.
            </span>
          </div>
        ) : (
          <div className="ap-table-wrapper">
            <table className="ap-table ap-ob-table">
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Supplier</th>
                  <th>Bill Date</th>
                  <th>Due Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance Due</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredBills.map((bill) => {
                  const supplier =
                    supplierById[
                      bill.supplier
                    ];

                  const state =
                    billState(bill);

                  return (
                    <tr key={bill.id}>

                      <td>
                        <div className="ap-ob-bill-cell">
                          <div className="ap-ob-bill-icon">
                            <FileText size={16} />
                          </div>

                          <div>
                            <strong>
                              {bill.bill_number ||
                                `Bill #${bill.id}`}
                            </strong>

                            <span>
                              {bill.status ||
                                "OPEN"}
                            </span>
                          </div>
                        </div>
                      </td>


                      <td>
                        <div className="ap-ob-supplier-cell">
                          <div className="ap-ob-avatar">
                            {String(
                              supplier?.name ||
                                "S"
                            )
                              .split(" ")
                              .filter(Boolean)
                              .slice(0, 2)
                              .map(
                                (part) =>
                                  part
                                    .charAt(0)
                                    .toUpperCase()
                              )
                              .join("")}
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
                        {formatDate(
                          bill.bill_date
                        )}
                      </td>


                      <td>
                        <div className="ap-ob-due-cell">
                          <strong>
                            {formatDate(
                              bill.due_date
                            )}
                          </strong>

                          <span
                            className={
                              state ===
                              "OVERDUE"
                                ? "ap-ob-due-overdue"
                                : ""
                            }
                          >
                            {dueText(bill)}
                          </span>
                        </div>
                      </td>


                      <td>
                        <strong>
                          {money(
                            bill.total_amount,
                            currency
                          )}
                        </strong>
                      </td>


                      <td>
                        <span className="ap-ob-paid">
                          {money(
                            bill.amount_paid,
                            currency
                          )}
                        </span>
                      </td>


                      <td>
                        <strong className="ap-ob-balance">
                          {money(
                            bill.balance_due,
                            currency
                          )}
                        </strong>
                      </td>


                      <td>
                        <span
                          className={stateClass(
                            state
                          )}
                        >
                          {state ===
                          "OVERDUE" ? (
                            <AlertCircle
                              size={12}
                            />
                          ) : state ===
                            "DUE_SOON" ? (
                            <Clock3 size={12} />
                          ) : (
                            <CheckCircle2
                              size={12}
                            />
                          )}

                          {stateLabel(state)}
                        </span>
                      </td>


                      <td>
                        <div className="ap-ob-action-group">

                          <button
                            type="button"
                            className="ap-ob-icon-button"
                            title="View bill"
                            onClick={() =>
                              setSelectedBill(
                                bill
                              )
                            }
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            type="button"
                            className="ap-ob-pay-button"
                            onClick={() =>
                              openPayment(bill)
                            }
                          >
                            <CreditCard
                              size={14}
                            />
                            Pay
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </section>


      {/* =====================================================
          SUMMARY STRIP
      ====================================================== */}

      {!loading && outstandingBills.length > 0 && (
        <div className="ap-ob-summary-strip">

          <div>
            <div className="ap-ob-summary-icon">
              <AlertCircle size={17} />
            </div>

            <div>
              <span>Overdue Bills</span>
              <strong>
                {stats.overdueCount}
              </strong>
            </div>
          </div>


          <div>
            <div className="ap-ob-summary-icon">
              <Clock3 size={17} />
            </div>

            <div>
              <span>Due Within 7 Days</span>
              <strong>
                {stats.dueSoonCount}
              </strong>
            </div>
          </div>


          <div>
            <div className="ap-ob-summary-icon">
              <CheckCircle2 size={17} />
            </div>

            <div>
              <span>Current Bills</span>
              <strong>
                {stats.currentCount}
              </strong>
            </div>
          </div>

        </div>
      )}


      {selectedBill && (
        <BillDetailsModal
          bill={selectedBill}
          supplier={
            supplierById[
              selectedBill.supplier
            ]
          }
          currency={currency}
          onClose={() =>
            setSelectedBill(null)
          }
          onRecordPayment={openPayment}
          onViewStatement={viewStatement}
        />
      )}


      {paymentBill && (
        <PaymentModal
          bill={paymentBill}
          supplier={
            supplierById[
              paymentBill.supplier
            ]
          }
          currency={currency}
          paymentForm={paymentForm}
          setPaymentForm={setPaymentForm}
          saving={savingPayment}
          onClose={() => {
            if (!savingPayment) {
              setPaymentBill(null);
              setPaymentError("");
            }
          }}
          onSubmit={handlePayment}
        />
      )}

      {paymentError && paymentBill && (
        <div className="ap-ob-payment-error">
          <AlertCircle size={16} />
          <span>{paymentError}</span>
        </div>
      )}

    </div>
  );
}
