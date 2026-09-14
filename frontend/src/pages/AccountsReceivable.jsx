import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  FileText,
  Filter,
  History,
  Loader2,
  Receipt,
  RefreshCw,
  Search,
  UserRound,
  Wallet,
} from "lucide-react";

import { api } from "../services/api";
import { useCompany } from "../context/CompanyContext";


const AR_ROUTES = {
  dashboard: "/accounts-receivable",
  balances: "/accounts-receivable/customer-balances",
  outstanding: "/accounts-receivable/outstanding",
  aging: "/accounts-receivable/aging",
  statements: "/accounts-receivable/statements",
  transactions: "/accounts-receivable/transactions",
};


const STATUS_LABELS = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  VOIDED: "Voided",
};


const PAYMENT_METHOD_LABELS = {
  CASH: "Cash",
  BANK: "Bank",
  MOBILE_MONEY: "Mobile Money",
  CARD: "Card",
};


function getList(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
}


function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}


function formatMoney(
  value,
  currency = "USD"
) {
  const amount = toNumber(value);

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(amount);
}


function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  ).format(date);
}


function getToday() {
  const date = new Date();

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}


function getDueDate(invoice) {
  if (!invoice?.due_date) {
    return null;
  }

  const date = new Date(
    `${invoice.due_date}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}


function isOpenInvoice(invoice) {
  return (
    invoice?.status !== "DRAFT" &&
    invoice?.status !== "VOIDED" &&
    toNumber(invoice?.balance_due) > 0
  );
}


function isOverdue(invoice) {
  const dueDate = getDueDate(invoice);

  if (!dueDate) {
    return false;
  }

  return (
    isOpenInvoice(invoice) &&
    dueDate < getToday()
  );
}


function getAgingBucket(invoice) {
  if (!isOpenInvoice(invoice)) {
    return "current";
  }

  const dueDate = getDueDate(invoice);

  if (!dueDate) {
    return "current";
  }

  const today = getToday();

  if (dueDate >= today) {
    return "current";
  }

  const millisecondsPerDay =
    1000 * 60 * 60 * 24;

  const daysOverdue = Math.floor(
    (today.getTime() - dueDate.getTime()) /
      millisecondsPerDay
  );

  if (daysOverdue <= 30) {
    return "1-30";
  }

  if (daysOverdue <= 60) {
    return "31-60";
  }

  if (daysOverdue <= 90) {
    return "61-90";
  }

  return "90+";
}


function getAgingLabel(bucket) {
  const labels = {
    current: "Current",
    "1-30": "1–30 Days",
    "31-60": "31–60 Days",
    "61-90": "61–90 Days",
    "90+": "90+ Days",
  };

  return labels[bucket] || bucket;
}


function getStatusClass(invoice) {
  if (isOverdue(invoice)) {
    return "ar-status-overdue";
  }

  return {
    DRAFT: "ar-status-draft",
    ISSUED: "ar-status-issued",
    PARTIALLY_PAID: "ar-status-partial",
    PAID: "ar-status-paid",
    OVERDUE: "ar-status-overdue",
    VOIDED: "ar-status-voided",
  }[invoice?.status] || "ar-status-default";
}


function getCustomerName(
  invoice,
  customers
) {
  if (
    invoice?.customer &&
    typeof invoice.customer === "object"
  ) {
    return (
      invoice.customer.name ||
      "Unknown customer"
    );
  }

  const customer = customers.find(
    (item) =>
      String(item.id) ===
      String(invoice?.customer)
  );

  return (
    customer?.name ||
    `Customer #${invoice?.customer ?? "—"}`
  );
}


function getInvoiceNumber(
  payment,
  invoices
) {
  if (
    payment?.invoice &&
    typeof payment.invoice === "object"
  ) {
    return (
      payment.invoice.invoice_number ||
      `Invoice #${payment.invoice.id}`
    );
  }

  const invoice = invoices.find(
    (item) =>
      String(item.id) ===
      String(payment?.invoice)
  );

  return (
    invoice?.invoice_number ||
    `Invoice #${payment?.invoice ?? "—"}`
  );
}


function getPaymentCustomer(
  payment,
  invoices,
  customers
) {
  const invoice = invoices.find(
    (item) =>
      String(item.id) ===
      String(payment?.invoice)
  );

  if (!invoice) {
    return "Unknown customer";
  }

  return getCustomerName(
    invoice,
    customers
  );
}


function getCurrency(
  invoice,
  currentCompany
) {
  return (
    invoice?.currency ||
    currentCompany?.currency ||
    "USD"
  );
}


function StatCard({
  icon: Icon,
  label,
  value,
  helper,
  className = "",
}) {
  return (
    <div className={`ar-stat-card ${className}`}>
      <div className="ar-stat-icon">
        <Icon size={21} strokeWidth={2} />
      </div>

      <div className="ar-stat-content">
        <span className="ar-stat-label">
          {label}
        </span>

        <strong className="ar-stat-value">
          {value}
        </strong>

        <span className="ar-stat-helper">
          {helper}
        </span>
      </div>
    </div>
  );
}


function SectionNavigation({
  currentSection,
  navigate,
}) {
  const items = [
    {
      key: "dashboard",
      label: "AR Dashboard",
      helper: "Receivables overview",
      icon: Wallet,
      path: AR_ROUTES.dashboard,
    },
    {
      key: "balances",
      label: "Customer Balances",
      helper: "What each customer owes",
      icon: UserRound,
      path: AR_ROUTES.balances,
    },
    {
      key: "outstanding",
      label: "Outstanding Invoices",
      helper: "Open receivables",
      icon: Receipt,
      path: AR_ROUTES.outstanding,
    },
    {
      key: "aging",
      label: "Aging Report",
      helper: "Receivables by age",
      icon: Clock3,
      path: AR_ROUTES.aging,
    },
    {
      key: "statements",
      label: "Customer Statements",
      helper: "Customer account history",
      icon: FileText,
      path: AR_ROUTES.statements,
    },
    {
      key: "transactions",
      label: "Receivable Transactions",
      helper: "Invoices and payments",
      icon: History,
      path: AR_ROUTES.transactions,
    },
  ];

  return (
    <div className="ar-section-nav">
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          currentSection === item.key;

        return (
          <button
            key={item.key}
            type="button"
            className={`ar-section-nav-card ${
              active
                ? "ar-section-nav-card-active"
                : ""
            }`}
            onClick={() =>
              navigate(item.path)
            }
          >
            <div className="ar-section-nav-icon">
              <Icon
                size={20}
                strokeWidth={2}
              />
            </div>

            <div>
              <strong>{item.label}</strong>
              <span>{item.helper}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}


function PageHeader({
  title,
  description,
  onRefresh,
  loading,
}) {
  return (
    <div className="ar-page-header">
      <div>
        <div className="ar-eyebrow">
          ACCOUNTS RECEIVABLE
        </div>

        <h1>{title}</h1>

        <p>{description}</p>
      </div>

      <button
        type="button"
        className="ar-button ar-button-secondary"
        onClick={onRefresh}
        disabled={loading}
      >
        <RefreshCw
          size={17}
          className={
            loading
              ? "ar-spin"
              : ""
          }
        />

        Refresh
      </button>
    </div>
  );
}


function CompanyStrip({
  currentCompany,
}) {
  return (
    <div className="ar-company-strip">
      <div className="ar-company-item">
        <span>COMPANY</span>
        <strong>
          {currentCompany?.name ||
            "No company selected"}
        </strong>
      </div>

      <div className="ar-company-divider" />

      <div className="ar-company-item">
        <span>FUNCTIONAL CURRENCY</span>
        <strong>
          {currentCompany?.currency ||
            "USD"}
        </strong>
      </div>

      <div className="ar-company-divider" />

      <div className="ar-company-item">
        <span>CUSTOMERS</span>
        <strong>
          {currentCompany?.__arCustomerCount ?? "—"}
        </strong>
      </div>
    </div>
  );
}


function Dashboard({
  invoices,
  payments,
  customers,
  currentCompany,
  navigate,
}) {
  const metrics = useMemo(() => {
    const totalInvoiced =
      invoices.reduce(
        (sum, invoice) =>
          sum +
          toNumber(invoice.total_amount),
        0
      );

    const totalCollected =
      payments.reduce(
        (sum, payment) =>
          sum +
          toNumber(payment.amount),
        0
      );

    const outstanding =
      invoices.reduce(
        (sum, invoice) =>
          isOpenInvoice(invoice)
            ? sum +
              toNumber(invoice.balance_due)
            : sum,
        0
      );

    const overdue =
      invoices.reduce(
        (sum, invoice) =>
          isOverdue(invoice)
            ? sum +
              toNumber(invoice.balance_due)
            : sum,
        0
      );

    const openInvoices =
      invoices.filter(
        isOpenInvoice
      ).length;

    const overdueInvoices =
      invoices.filter(
        isOverdue
      ).length;

    const paidInvoices =
      invoices.filter(
        (invoice) =>
          invoice.status === "PAID"
      ).length;

    return {
      totalInvoiced,
      totalCollected,
      outstanding,
      overdue,
      openInvoices,
      overdueInvoices,
      paidInvoices,
    };
  }, [invoices, payments]);

  const currency =
    currentCompany?.currency ||
    "USD";

  const recentInvoices =
    [...invoices]
      .sort(
        (a, b) =>
          new Date(
            b.invoice_date || b.created_at
          ) -
          new Date(
            a.invoice_date || a.created_at
          )
      )
      .slice(0, 6);

  const recentPayments =
    [...payments]
      .sort(
        (a, b) =>
          new Date(
            b.payment_date || b.created_at
          ) -
          new Date(
            a.payment_date || a.created_at
          )
      )
      .slice(0, 6);

  return (
    <div className="ar-content">
      <div className="ar-dashboard-stats">
        <StatCard
          icon={Receipt}
          label="Total Invoiced"
          value={formatMoney(
            metrics.totalInvoiced,
            currency
          )}
          helper={`${invoices.length} invoice records`}
        />

        <StatCard
          icon={Wallet}
          label="Amount Collected"
          value={formatMoney(
            metrics.totalCollected,
            currency
          )}
          helper={`${payments.length} payment records`}
          className="ar-stat-positive"
        />

        <StatCard
          icon={Clock3}
          label="Outstanding"
          value={formatMoney(
            metrics.outstanding,
            currency
          )}
          helper={`${metrics.openInvoices} open invoices`}
        />

        <StatCard
          icon={AlertCircle}
          label="Overdue"
          value={formatMoney(
            metrics.overdue,
            currency
          )}
          helper={`${metrics.overdueInvoices} overdue invoices`}
          className="ar-stat-warning"
        />
      </div>

      <div className="ar-dashboard-grid">
        <div className="ar-panel">
          <div className="ar-panel-header">
            <div>
              <h2>Receivables Position</h2>
              <p>
                Current customer receivables
                for the selected company.
              </p>
            </div>

            <button
              type="button"
              className="ar-link-button"
              onClick={() =>
                navigate(
                  AR_ROUTES.aging
                )
              }
            >
              View aging
              <ArrowUpRight
                size={15}
              />
            </button>
          </div>

          <div className="ar-position">
            <div className="ar-position-main">
              <span>Total outstanding</span>

              <strong>
                {formatMoney(
                  metrics.outstanding,
                  currency
                )}
              </strong>
            </div>

            <div className="ar-position-row">
              <span>Current</span>

              <strong>
                {formatMoney(
                  Math.max(
                    0,
                    metrics.outstanding -
                      metrics.overdue
                  ),
                  currency
                )}
              </strong>
            </div>

            <div className="ar-position-row ar-position-row-warning">
              <span>Overdue</span>

              <strong>
                {formatMoney(
                  metrics.overdue,
                  currency
                )}
              </strong>
            </div>

            <div className="ar-position-row">
              <span>Paid invoices</span>

              <strong>
                {metrics.paidInvoices}
              </strong>
            </div>
          </div>
        </div>

        <div className="ar-panel">
          <div className="ar-panel-header">
            <div>
              <h2>Recent Payments</h2>
              <p>
                Latest customer receipts.
              </p>
            </div>

            <button
              type="button"
              className="ar-link-button"
              onClick={() =>
                navigate(
                  AR_ROUTES.transactions
                )
              }
            >
              View transactions
              <ArrowUpRight
                size={15}
              />
            </button>
          </div>

          {recentPayments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payments recorded"
              description="Customer payments will appear here once recorded."
            />
          ) : (
            <div className="ar-mini-list">
              {recentPayments.map(
                (payment) => (
                  <div
                    className="ar-mini-row"
                    key={payment.id}
                  >
                    <div className="ar-mini-icon ar-mini-icon-payment">
                      <ArrowDownLeft
                        size={16}
                      />
                    </div>

                    <div className="ar-mini-main">
                      <strong>
                        {getPaymentCustomer(
                          payment,
                          invoices,
                          customers
                        )}
                      </strong>

                      <span>
                        {getInvoiceNumber(
                          payment,
                          invoices
                        )}{" "}
                        ·{" "}
                        {formatDate(
                          payment.payment_date
                        )}
                      </span>
                    </div>

                    <strong className="ar-mini-amount">
                      +
                      {formatMoney(
                        payment.amount,
                        payment.invoice_currency ||
                          currency
                      )}
                    </strong>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      <div className="ar-panel">
        <div className="ar-panel-header">
          <div>
            <h2>Recent Invoices</h2>
            <p>
              Latest invoices contributing to
              receivables.
            </p>
          </div>

          <button
            type="button"
            className="ar-link-button"
            onClick={() =>
              navigate(
                AR_ROUTES.outstanding
              )
            }
          >
            View outstanding
            <ArrowUpRight
              size={15}
            />
          </button>
        </div>

        <InvoiceTable
          invoices={recentInvoices}
          customers={customers}
          currentCompany={currentCompany}
          emptyTitle="No invoices available"
          emptyDescription="Invoices will appear here after they are created."
        />
      </div>
    </div>
  );
}


function CustomerBalances({
  invoices,
  customers,
  currentCompany,
}) {
  const [search, setSearch] =
    useState("");

  const currency =
    currentCompany?.currency ||
    "USD";

  const balances = useMemo(() => {
    const map = new Map();

    invoices.forEach(
      (invoice) => {
        if (
          invoice.status === "VOIDED"
        ) {
          return;
        }

        const customerId =
          invoice.customer;

        const customer =
          customers.find(
            (item) =>
              String(item.id) ===
              String(customerId)
          );

        const key =
          customerId ||
          customer?.id ||
          invoice.customer;

        if (!map.has(key)) {
          map.set(key, {
            id: key,
            name:
              customer?.name ||
              getCustomerName(
                invoice,
                customers
              ),
            email:
              customer?.email ||
              "",
            phone:
              customer?.phone ||
              "",
            invoiceCount: 0,
            totalInvoiced: 0,
            amountPaid: 0,
            balanceDue: 0,
          });
        }

        const row =
          map.get(key);

        row.invoiceCount += 1;

        row.totalInvoiced +=
          toNumber(
            invoice.total_amount
          );

        row.amountPaid +=
          toNumber(
            invoice.amount_paid
          );

        row.balanceDue +=
          toNumber(
            invoice.balance_due
          );
      }
    );

    return Array.from(
      map.values()
    )
      .filter((item) =>
        item.name
          .toLowerCase()
          .includes(
            search.toLowerCase()
          )
      )
      .sort(
        (a, b) =>
          b.balanceDue -
          a.balanceDue
      );
  }, [
    invoices,
    customers,
    search,
  ]);

  return (
    <div className="ar-content">
      <div className="ar-panel">
        <div className="ar-panel-header ar-panel-header-stack-mobile">
          <div>
            <h2>Customer Balances</h2>
            <p>
              Summary of invoices, payments
              and balances for each customer.
            </p>
          </div>

          <div className="ar-search">
            <Search size={17} />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search customers..."
            />
          </div>
        </div>

        <div className="ar-table-wrap">
          <table className="ar-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Invoices</th>
                <th>Total Invoiced</th>
                <th>Paid</th>
                <th>Balance Due</th>
                <th>Position</th>
              </tr>
            </thead>

            <tbody>
              {balances.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="ar-table-empty"
                  >
                    <EmptyState
                      icon={UserRound}
                      title="No customer balances"
                      description="Customer receivable balances will appear here."
                    />
                  </td>
                </tr>
              ) : (
                balances.map(
                  (customer) => (
                    <tr
                      key={customer.id}
                    >
                      <td>
                        <div className="ar-customer-cell">
                          <div className="ar-avatar">
                            {customer.name
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {
                                customer.name
                              }
                            </strong>

                            <span>
                              {
                                customer.email ||
                                customer.phone ||
                                "Customer account"
                              }
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        {
                          customer.invoiceCount
                        }
                      </td>

                      <td>
                        {formatMoney(
                          customer.totalInvoiced,
                          currency
                        )}
                      </td>

                      <td>
                        {formatMoney(
                          customer.amountPaid,
                          currency
                        )}
                      </td>

                      <td>
                        <strong>
                          {formatMoney(
                            customer.balanceDue,
                            currency
                          )}
                        </strong>
                      </td>

                      <td>
                        {customer.balanceDue >
                        0 ? (
                          <span className="ar-badge ar-status-partial">
                            Outstanding
                          </span>
                        ) : (
                          <span className="ar-badge ar-status-paid">
                            Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


function OutstandingInvoices({
  invoices,
  customers,
  currentCompany,
}) {
  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState("all");

  const currency =
    currentCompany?.currency ||
    "USD";

  const outstanding = useMemo(() => {
    return invoices
      .filter(isOpenInvoice)
      .filter((invoice) => {
        if (filter === "overdue") {
          return isOverdue(invoice);
        }

        if (filter === "current") {
          return !isOverdue(invoice);
        }

        return true;
      })
      .filter((invoice) => {
        const customer =
          getCustomerName(
            invoice,
            customers
          );

        const term =
          search.toLowerCase();

        return (
          invoice.invoice_number
            ?.toLowerCase()
            .includes(term) ||
          customer
            .toLowerCase()
            .includes(term)
        );
      })
      .sort(
        (a, b) =>
          new Date(
            a.due_date
          ) -
          new Date(
            b.due_date
          )
      );
  }, [
    invoices,
    customers,
    search,
    filter,
  ]);

  return (
    <div className="ar-content">
      <div className="ar-panel">
        <div className="ar-panel-header ar-panel-header-stack-mobile">
          <div>
            <h2>Outstanding Invoices</h2>
            <p>
              Invoices with an unpaid customer
              balance.
            </p>
          </div>

          <div className="ar-toolbar">
            <div className="ar-search">
              <Search size={17} />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search invoices..."
              />
            </div>

            <div className="ar-select-wrap">
              <Filter size={16} />

              <select
                value={filter}
                onChange={(event) =>
                  setFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All outstanding
                </option>

                <option value="current">
                  Current
                </option>

                <option value="overdue">
                  Overdue
                </option>
              </select>

              <ChevronDown
                size={15}
              />
            </div>
          </div>
        </div>

        <InvoiceTable
          invoices={outstanding}
          customers={customers}
          currentCompany={currentCompany}
          emptyTitle="No outstanding invoices"
          emptyDescription="There are currently no open customer receivables."
        />
      </div>
    </div>
  );
}


function AgingReport({
  invoices,
  customers,
  currentCompany,
}) {
  const currency =
    currentCompany?.currency ||
    "USD";

  const aging = useMemo(() => {
    const buckets = {
      current: 0,
      "1-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
    };

    const counts = {
      current: 0,
      "1-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
    };

    invoices
      .filter(isOpenInvoice)
      .forEach((invoice) => {
        const bucket =
          getAgingBucket(
            invoice
          );

        buckets[bucket] +=
          toNumber(
            invoice.balance_due
          );

        counts[bucket] += 1;
      });

    const total =
      Object.values(
        buckets
      ).reduce(
        (sum, value) =>
          sum + value,
        0
      );

    return {
      buckets,
      counts,
      total,
    };
  }, [invoices]);

  return (
    <div className="ar-content">
      <div className="ar-aging-summary">
        {[
          "current",
          "1-30",
          "31-60",
          "61-90",
          "90+",
        ].map((bucket) => (
          <div
            className="ar-aging-card"
            key={bucket}
          >
            <div className="ar-aging-card-top">
              <span>
                {getAgingLabel(
                  bucket
                )}
              </span>

              <span className="ar-aging-count">
                {aging.counts[bucket]}
              </span>
            </div>

            <strong>
              {formatMoney(
                aging.buckets[bucket],
                currency
              )}
            </strong>

            <div className="ar-aging-bar">
              <span
                style={{
                  width: `${
                    aging.total > 0
                      ? Math.min(
                          100,
                          (aging.buckets[
                            bucket
                          ] /
                            aging.total) *
                            100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="ar-panel">
        <div className="ar-panel-header">
          <div>
            <h2>Aging Detail</h2>
            <p>
              Open receivables grouped according
              to how long they have been outstanding.
            </p>
          </div>
        </div>

        <div className="ar-table-wrap">
          <table className="ar-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Due Date</th>
                <th>Age</th>
                <th>Balance Due</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {invoices
                .filter(
                  isOpenInvoice
                )
                .sort(
                  (a, b) =>
                    new Date(
                      a.due_date
                    ) -
                    new Date(
                      b.due_date
                    )
                )
                .map((invoice) => {
                  const bucket =
                    getAgingBucket(
                      invoice
                    );

                  return (
                    <tr
                      key={invoice.id}
                    >
                      <td>
                        <strong>
                          {
                            invoice.invoice_number
                          }
                        </strong>
                      </td>

                      <td>
                        {getCustomerName(
                          invoice,
                          customers
                        )}
                      </td>

                      <td>
                        {formatDate(
                          invoice.due_date
                        )}
                      </td>

                      <td>
                        <span
                          className={`ar-badge ${
                            bucket ===
                            "current"
                              ? "ar-status-paid"
                              : "ar-status-overdue"
                          }`}
                        >
                          {getAgingLabel(
                            bucket
                          )}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {formatMoney(
                            invoice.balance_due,
                            getCurrency(
                              invoice,
                              currentCompany
                            )
                          )}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={`ar-badge ${getStatusClass(
                            invoice
                          )}`}
                        >
                          {isOverdue(
                            invoice
                          )
                            ? "Overdue"
                            : STATUS_LABELS[
                                invoice
                                  .status
                              ] ||
                              invoice.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}

              {invoices.filter(
                isOpenInvoice
              ).length === 0 && (
                <tr>
                  <td
                    colSpan="6"
                    className="ar-table-empty"
                  >
                    <EmptyState
                      icon={CheckCircle2}
                      title="No receivables to age"
                      description="There are no outstanding invoices requiring aging analysis."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


function CustomerStatements({
  invoices,
  payments,
  customers,
  currentCompany,
}) {
  const [customerId, setCustomerId] =
    useState("");

  const currency =
    currentCompany?.currency ||
    "USD";

  const selectedCustomer =
    customers.find(
      (customer) =>
        String(customer.id) ===
        String(customerId)
    );

  const customerInvoices =
    useMemo(() => {
      if (!customerId) {
        return [];
      }

      return invoices
        .filter(
          (invoice) =>
            String(
              invoice.customer
            ) ===
            String(customerId)
        )
        .sort(
          (a, b) =>
            new Date(
              a.invoice_date
            ) -
            new Date(
              b.invoice_date
            )
        );
    }, [
      invoices,
      customerId,
    ]);

  const customerPayments =
    useMemo(() => {
      if (!customerId) {
        return [];
      }

      return payments
        .filter((payment) => {
          const invoice =
            invoices.find(
              (item) =>
                String(item.id) ===
                String(
                  payment.invoice
                )
            );

          return (
            String(
              invoice?.customer
            ) ===
            String(customerId)
          );
        })
        .sort(
          (a, b) =>
            new Date(
              a.payment_date
            ) -
            new Date(
              b.payment_date
            )
        );
    }, [
      payments,
      invoices,
      customerId,
    ]);

  const statementTotals =
    useMemo(() => {
      const invoiced =
        customerInvoices.reduce(
          (sum, invoice) =>
            sum +
            toNumber(
              invoice.total_amount
            ),
          0
        );

      const paid =
        customerPayments.reduce(
          (sum, payment) =>
            sum +
            toNumber(
              payment.amount
            ),
          0
        );

      const balance =
        customerInvoices.reduce(
          (sum, invoice) =>
            sum +
            toNumber(
              invoice.balance_due
            ),
          0
        );

      return {
        invoiced,
        paid,
        balance,
      };
    }, [
      customerInvoices,
      customerPayments,
    ]);

  const statementRows =
    useMemo(() => {
      const rows = [];

      customerInvoices.forEach(
        (invoice) => {
          rows.push({
            id: `invoice-${invoice.id}`,
            date: invoice.invoice_date,
            type: "Invoice",
            reference:
              invoice.invoice_number,
            description:
              "Customer invoice",
            debit: toNumber(
              invoice.total_amount
            ),
            credit: 0,
          });
        }
      );

      customerPayments.forEach(
        (payment) => {
          rows.push({
            id: `payment-${payment.id}`,
            date: payment.payment_date,
            type: "Payment",
            reference:
              payment.reference ||
              getInvoiceNumber(
                payment,
                invoices
              ),
            description:
              "Customer payment",
            debit: 0,
            credit: toNumber(
              payment.amount
            ),
          });
        }
      );

      return rows.sort(
        (a, b) =>
          new Date(a.date) -
          new Date(b.date)
      );
    }, [
      customerInvoices,
      customerPayments,
      invoices,
    ]);

  return (
    <div className="ar-content">
      <div className="ar-panel ar-statement-selector">
        <div>
          <span className="ar-field-label">
            CUSTOMER
          </span>

          <h2>
            Customer Statement
          </h2>

          <p>
            Select a customer to view their
            invoice and payment history.
          </p>
        </div>

        <div className="ar-statement-controls">
          <div className="ar-select-large">
            <UserRound size={17} />

            <select
              value={customerId}
              onChange={(event) =>
                setCustomerId(
                  event.target.value
                )
              }
            >
              <option value="">
                Select customer
              </option>

              {customers.map(
                (customer) => (
                  <option
                    key={customer.id}
                    value={customer.id}
                  >
                    {customer.name}
                  </option>
                )
              )}
            </select>

            <ChevronDown
              size={15}
            />
          </div>

          {customerId && (
            <button
              type="button"
              className="ar-button ar-button-secondary"
              onClick={() =>
                window.print()
              }
            >
              <Download size={16} />
              Print Statement
            </button>
          )}
        </div>
      </div>

      {!customerId ? (
        <div className="ar-panel">
          <EmptyState
            icon={FileText}
            title="Select a customer"
            description="Choose a customer above to generate their receivable statement."
          />
        </div>
      ) : (
        <>
          <div className="ar-statement-heading">
            <div>
              <span>
                CUSTOMER STATEMENT
              </span>

              <h2>
                {
                  selectedCustomer?.name
                }
              </h2>

              <p>
                {selectedCustomer?.email ||
                  selectedCustomer?.phone ||
                  selectedCustomer?.address ||
                  "Customer account"}
              </p>
            </div>

            <div className="ar-statement-date">
              <CalendarDays
                size={17}
              />

              <span>
                Statement as of{" "}
                {formatDate(
                  new Date()
                )}
              </span>
            </div>
          </div>

          <div className="ar-dashboard-stats">
            <StatCard
              icon={Receipt}
              label="Total Invoiced"
              value={formatMoney(
                statementTotals.invoiced,
                currency
              )}
              helper={`${customerInvoices.length} invoices`}
            />

            <StatCard
              icon={Wallet}
              label="Total Payments"
              value={formatMoney(
                statementTotals.paid,
                currency
              )}
              helper={`${customerPayments.length} payments`}
            />

            <StatCard
              icon={Clock3}
              label="Balance Due"
              value={formatMoney(
                statementTotals.balance,
                currency
              )}
              helper="Current outstanding balance"
            />

            <StatCard
              icon={UserRound}
              label="Account Status"
              value={
                statementTotals.balance >
                0
                  ? "Outstanding"
                  : "Settled"
              }
              helper={
                statementTotals.balance >
                0
                  ? "Payment required"
                  : "No balance due"
              }
            />
          </div>

          <div className="ar-panel">
            <div className="ar-panel-header">
              <div>
                <h2>Account Activity</h2>
                <p>
                  Invoices and payments for this
                  customer.
                </p>
              </div>
            </div>

            <div className="ar-table-wrap">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Description</th>
                    <th>Debit</th>
                    <th>Credit</th>
                  </tr>
                </thead>

                <tbody>
                  {statementRows.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="ar-table-empty"
                      >
                        <EmptyState
                          icon={History}
                          title="No account activity"
                          description="There are no invoices or payments for this customer."
                        />
                      </td>
                    </tr>
                  ) : (
                    statementRows.map(
                      (row) => (
                        <tr
                          key={row.id}
                        >
                          <td>
                            {formatDate(
                              row.date
                            )}
                          </td>

                          <td>
                            <span
                              className={`ar-badge ${
                                row.type ===
                                "Invoice"
                                  ? "ar-status-issued"
                                  : "ar-status-paid"
                              }`}
                            >
                              {
                                row.type
                              }
                            </span>
                          </td>

                          <td>
                            <strong>
                              {
                                row.reference
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              row.description
                            }
                          </td>

                          <td>
                            {row.debit >
                            0
                              ? formatMoney(
                                  row.debit,
                                  currency
                                )
                              : "—"}
                          </td>

                          <td>
                            {row.credit >
                            0
                              ? formatMoney(
                                  row.credit,
                                  currency
                                )
                              : "—"}
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


function ReceivableTransactions({
  invoices,
  payments,
  customers,
  currentCompany,
}) {
  const [search, setSearch] =
    useState("");

  const [type, setType] =
    useState("all");

  const currency =
    currentCompany?.currency ||
    "USD";

  const transactions =
    useMemo(() => {
      const rows = [];

      if (
        type === "all" ||
        type === "invoice"
      ) {
        invoices.forEach(
          (invoice) => {
            rows.push({
              id: `invoice-${invoice.id}`,
              date:
                invoice.invoice_date ||
                invoice.created_at,
              type: "invoice",
              reference:
                invoice.invoice_number,
              customer:
                getCustomerName(
                  invoice,
                  customers
                ),
              description:
                "Invoice issued",
              amount:
                toNumber(
                  invoice.total_amount
                ),
              currency:
                invoice.currency ||
                currency,
            });
          }
        );
      }

      if (
        type === "all" ||
        type === "payment"
      ) {
        payments.forEach(
          (payment) => {
            rows.push({
              id: `payment-${payment.id}`,
              date:
                payment.payment_date ||
                payment.created_at,
              type: "payment",
              reference:
                payment.reference ||
                getInvoiceNumber(
                  payment,
                  invoices
                ),
              customer:
                getPaymentCustomer(
                  payment,
                  invoices,
                  customers
                ),
              description:
                "Customer payment",
              amount:
                toNumber(
                  payment.amount
                ),
              currency:
                payment.invoice_currency ||
                currency,
            });
          }
        );
      }

      const term =
        search.toLowerCase();

      return rows
        .filter(
          (row) =>
            row.reference
              ?.toLowerCase()
              .includes(term) ||
            row.customer
              ?.toLowerCase()
              .includes(term) ||
            row.description
              ?.toLowerCase()
              .includes(term)
        )
        .sort(
          (a, b) =>
            new Date(b.date) -
            new Date(a.date)
        );
    }, [
      invoices,
      payments,
      customers,
      currency,
      search,
      type,
    ]);

  return (
    <div className="ar-content">
      <div className="ar-panel">
        <div className="ar-panel-header ar-panel-header-stack-mobile">
          <div>
            <h2>
              Receivable Transactions
            </h2>

            <p>
              Complete customer invoice and
              payment activity.
            </p>
          </div>

          <div className="ar-toolbar">
            <div className="ar-search">
              <Search size={17} />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search transactions..."
              />
            </div>

            <div className="ar-select-wrap">
              <Filter size={16} />

              <select
                value={type}
                onChange={(event) =>
                  setType(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All transactions
                </option>

                <option value="invoice">
                  Invoices
                </option>

                <option value="payment">
                  Payments
                </option>
              </select>

              <ChevronDown
                size={15}
              />
            </div>
          </div>
        </div>

        <div className="ar-table-wrap">
          <table className="ar-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Customer</th>
                <th>Description</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              {transactions.length ===
              0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="ar-table-empty"
                  >
                    <EmptyState
                      icon={History}
                      title="No transactions found"
                      description="Receivable transactions will appear here."
                    />
                  </td>
                </tr>
              ) : (
                transactions.map(
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
                          className={`ar-badge ${
                            transaction.type ===
                            "invoice"
                              ? "ar-status-issued"
                              : "ar-status-paid"
                          }`}
                        >
                          {transaction.type ===
                          "invoice"
                            ? "Invoice"
                            : "Payment"}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {
                            transaction.reference
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          transaction.customer
                        }
                      </td>

                      <td>
                        {
                          transaction.description
                        }
                      </td>

                      <td>
                        <strong
                          className={
                            transaction.type ===
                            "payment"
                              ? "ar-amount-credit"
                              : ""
                          }
                        >
                          {transaction.type ===
                          "payment"
                            ? "−"
                            : "+"}
                          {formatMoney(
                            transaction.amount,
                            transaction.currency
                          )}
                        </strong>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


function InvoiceTable({
  invoices,
  customers,
  currentCompany,
  emptyTitle,
  emptyDescription,
}) {
  return (
    <div className="ar-table-wrap">
      <table className="ar-table">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Customer</th>
            <th>Invoice Date</th>
            <th>Due Date</th>
            <th>Total</th>
            <th>Balance</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {invoices.length === 0 ? (
            <tr>
              <td
                colSpan="7"
                className="ar-table-empty"
              >
                <EmptyState
                  icon={Receipt}
                  title={emptyTitle}
                  description={
                    emptyDescription
                  }
                />
              </td>
            </tr>
          ) : (
            invoices.map(
              (invoice) => (
                <tr
                  key={invoice.id}
                >
                  <td>
                    <div className="ar-reference-cell">
                      <strong>
                        {
                          invoice.invoice_number
                        }
                      </strong>

                      {invoice.sale && (
                        <span>
                          From sale #
                          {
                            invoice.sale
                          }
                        </span>
                      )}
                    </div>
                  </td>

                  <td>
                    {getCustomerName(
                      invoice,
                      customers
                    )}
                  </td>

                  <td>
                    {formatDate(
                      invoice.invoice_date
                    )}
                  </td>

                  <td>
                    <div className="ar-due-cell">
                      <span>
                        {formatDate(
                          invoice.due_date
                        )}
                      </span>

                      {isOverdue(
                        invoice
                      ) && (
                        <small>
                          Overdue
                        </small>
                      )}
                    </div>
                  </td>

                  <td>
                    {formatMoney(
                      invoice.total_amount,
                      getCurrency(
                        invoice,
                        currentCompany
                      )
                    )}
                  </td>

                  <td>
                    <strong>
                      {formatMoney(
                        invoice.balance_due,
                        getCurrency(
                          invoice,
                          currentCompany
                        )
                      )}
                    </strong>
                  </td>

                  <td>
                    <span
                      className={`ar-badge ${getStatusClass(
                        invoice
                      )}`}
                    >
                      {isOverdue(
                        invoice
                      )
                        ? "Overdue"
                        : STATUS_LABELS[
                            invoice
                              .status
                          ] ||
                          invoice.status}
                    </span>
                  </td>
                </tr>
              )
            )
          )}
        </tbody>
      </table>
    </div>
  );
}


function EmptyState({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="ar-empty-state">
      <div className="ar-empty-icon">
        <Icon size={24} />
      </div>

      <strong>{title}</strong>

      <p>{description}</p>
    </div>
  );
}


function ErrorState({
  onRetry,
}) {
  return (
    <div className="ar-error-state">
      <div className="ar-error-icon">
        <AlertCircle size={22} />
      </div>

      <div>
        <strong>
          Accounts Receivable error
        </strong>

        <p>
          Something went wrong while
          processing the request.
        </p>
      </div>

      <button
        type="button"
        className="ar-button ar-button-secondary"
        onClick={onRetry}
      >
        <RefreshCw size={16} />
        Try Again
      </button>
    </div>
  );
}


export default function AccountsReceivable() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    currentCompany,
  } = useCompany();

  const [customers, setCustomers] =
    useState([]);

  const [invoices, setInvoices] =
    useState([]);

  const [payments, setPayments] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const currentSection =
    location.pathname ===
      AR_ROUTES.dashboard
      ? "dashboard"
      : location.pathname.includes(
          "/customer-balances"
        )
      ? "balances"
      : location.pathname.includes(
          "/outstanding"
        )
      ? "outstanding"
      : location.pathname.includes(
          "/aging"
        )
      ? "aging"
      : location.pathname.includes(
          "/statements"
        )
      ? "statements"
      : location.pathname.includes(
          "/transactions"
        )
      ? "transactions"
      : "dashboard";

  const loadARData =
    async () => {
      if (!currentCompany?.id) {
        setCustomers([]);
        setInvoices([]);
        setPayments([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const companyId =
          currentCompany.id;

        const [
          customerData,
          invoiceData,
          paymentData,
        ] = await Promise.all([
          api.get(
            `/api/invoicing/customers/?company=${companyId}`
          ),

          api.get(
            `/api/invoicing/invoices/?company=${companyId}`
          ),

          api.get(
            `/api/invoicing/customer-payments/?company=${companyId}`
          ),
        ]);

        setCustomers(
          getList(customerData)
        );

        setInvoices(
          getList(invoiceData)
        );

        setPayments(
          getList(paymentData)
        );
      } catch (err) {
        console.error(
          "Accounts Receivable loading error:",
          err
        );

        setError(
          err?.message ||
            "Something went wrong while loading Accounts Receivable."
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    loadARData();
  }, [currentCompany?.id]);

  const companyForStrip =
    useMemo(
      () => ({
        ...currentCompany,
        __arCustomerCount:
          customers.length,
      }),
      [
        currentCompany,
        customers.length,
      ]
    );

  let pageTitle =
    "Accounts Receivable";

  let pageDescription =
    "Monitor customer balances, outstanding invoices and collections.";

  if (
    currentSection === "balances"
  ) {
    pageTitle =
      "Customer Balances";

    pageDescription =
      "Review what each customer has been invoiced, paid and still owes.";
  }

  if (
    currentSection ===
    "outstanding"
  ) {
    pageTitle =
      "Outstanding Invoices";

    pageDescription =
      "Track open customer invoices and amounts requiring collection.";
  }

  if (
    currentSection === "aging"
  ) {
    pageTitle =
      "Aging Report";

    pageDescription =
      "Analyze outstanding receivables according to their age.";
  }

  if (
    currentSection ===
    "statements"
  ) {
    pageTitle =
      "Customer Statements";

    pageDescription =
      "Review complete customer account activity and balances.";
  }

  if (
    currentSection ===
    "transactions"
  ) {
    pageTitle =
      "Receivable Transactions";

    pageDescription =
      "Review invoice and customer payment activity.";
  }

  return (
    <div className="ar-page">
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        onRefresh={loadARData}
        loading={loading}
      />

      <SectionNavigation
        currentSection={
          currentSection
        }
        navigate={navigate}
      />

      <CompanyStrip
        currentCompany={
          companyForStrip
        }
      />

      {loading ? (
        <div className="ar-loading">
          <Loader2
            size={28}
            className="ar-spin"
          />

          <span>
            Loading receivables...
          </span>
        </div>
      ) : error ? (
        <ErrorState
          onRetry={loadARData}
        />
      ) : (
        <>
          {currentSection ===
            "dashboard" && (
            <Dashboard
              invoices={invoices}
              payments={payments}
              customers={customers}
              currentCompany={
                currentCompany
              }
              navigate={navigate}
            />
          )}

          {currentSection ===
            "balances" && (
            <CustomerBalances
              invoices={invoices}
              customers={customers}
              currentCompany={
                currentCompany
              }
            />
          )}

          {currentSection ===
            "outstanding" && (
            <OutstandingInvoices
              invoices={invoices}
              customers={customers}
              currentCompany={
                currentCompany
              }
            />
          )}

          {currentSection ===
            "aging" && (
            <AgingReport
              invoices={invoices}
              customers={customers}
              currentCompany={
                currentCompany
              }
            />
          )}

          {currentSection ===
            "statements" && (
            <CustomerStatements
              invoices={invoices}
              payments={payments}
              customers={customers}
              currentCompany={
                currentCompany
              }
            />
          )}

          {currentSection ===
            "transactions" && (
            <ReceivableTransactions
              invoices={invoices}
              payments={payments}
              customers={customers}
              currentCompany={
                currentCompany
              }
            />
          )}
        </>
      )}
    </div>
  );
}
