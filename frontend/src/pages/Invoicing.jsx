import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Download,
  Edit3,
  Eye,
  FileText,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  User,
  Wallet,
  X,
} from "lucide-react";
import {
  NavLink,
  Navigate,
  useLocation,
} from "react-router-dom";

import {
  API_BASE_URL,
  api,
} from "../services/api";
import { useCompany } from "../context/CompanyContext";


// ============================================================
// HELPERS
// ============================================================

function getList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function getToday() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function generateInvoiceNumber() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `INV-${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function getCurrencyCode(value) {
  const currency = String(value || "").toUpperCase();

  if (currency.includes("LRD")) return "LRD";

  return "USD";
}

function getHistoricalExchangeRate(
  exchangeRates,
  fromCurrency,
  toCurrency,
  effectiveDate
) {
  const from = getCurrencyCode(fromCurrency);
  const to = getCurrencyCode(toCurrency);

  if (!from || !to) return null;
  if (from === to) return 1;

  const targetDate = String(
    effectiveDate || getToday()
  );

  const candidates = (Array.isArray(exchangeRates)
    ? exchangeRates
    : []
  )
    .filter((item) => item?.is_active !== false)
    .filter((item) => {
      if (!item?.effective_date) return true;
      return String(item.effective_date) <= targetDate;
    })
    .sort((a, b) =>
      String(b?.effective_date || "").localeCompare(
        String(a?.effective_date || "")
      )
    );

  const direct = candidates.find(
    (item) =>
      getCurrencyCode(item?.from_currency) === from &&
      getCurrencyCode(item?.to_currency) === to
  );

  if (direct && Number(direct.rate) > 0) {
    return Number(direct.rate);
  }

  const inverse = candidates.find(
    (item) =>
      getCurrencyCode(item?.from_currency) === to &&
      getCurrencyCode(item?.to_currency) === from
  );

  if (inverse && Number(inverse.rate) > 0) {
    return 1 / Number(inverse.rate);
  }

  return null;
}


function getPaymentCurrency(payment, fallbackCurrency = "USD") {
  return getCurrencyCode(
    payment?.currency ||
      payment?.payment_currency ||
      fallbackCurrency
  );
}

function filterInvoicesByCurrency(invoices, currency) {
  const target = getCurrencyCode(currency);

  return (Array.isArray(invoices) ? invoices : []).filter(
    (invoice) =>
      getCurrencyCode(invoice?.currency) === target
  );
}

function filterPaymentsByCurrency(payments, currency) {
  const target = getCurrencyCode(currency);

  return (Array.isArray(payments) ? payments : []).filter(
    (payment) =>
      getPaymentCurrency(payment, target) === target
  );
}


function formatMoney(value, currency = "USD") {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: getCurrencyCode(currency),
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";

  const text = String(value);

  if (text.includes("T")) {
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const parts = text.split("-");

  if (parts.length === 3) {
    return new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2])
    ).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return text;
}

function errorMessage(error) {
  if (!error) return "Something went wrong.";

  if (
    typeof error.message === "string" &&
    error.message !== "Something went wrong."
  ) {
    return error.message;
  }

  const data = error.data;

  if (typeof data === "string") {
    return data;
  }

  if (data && typeof data === "object") {
    const messages = [];

    Object.entries(data).forEach(
      ([field, value]) => {
        if (Array.isArray(value)) {
          value.forEach((message) => {
            if (typeof message === "string") {
              messages.push(
                `${field}: ${message}`
              );
            }
          });
        } else if (
          typeof value === "string"
        ) {
          messages.push(
            `${field}: ${value}`
          );
        }
      }
    );

    if (messages.length) {
      return messages.join(" ");
    }
  }

  return "Something went wrong while processing the request.";
}

function invoiceStatusLabel(status) {
  const labels = {
    DRAFT: "Draft",
    ISSUED: "Issued",
    PARTIALLY_PAID: "Partially Paid",
    PAID: "Paid",
    OVERDUE: "Overdue",
    VOIDED: "Voided",
  };

  return labels[status] || status || "—";
}

function paymentMethodLabel(method) {
  const labels = {
    CASH: "Cash",
    BANK: "Bank",
    MOBILE_MONEY: "Mobile Money",
    CARD: "Card",
  };

  return labels[method] || method || "—";
}

function isInvoiceOverdue(invoice) {
  if (
    !invoice ||
    invoice.status === "PAID" ||
    invoice.status === "VOIDED" ||
    invoice.status === "DRAFT"
  ) {
    return false;
  }

  if (!invoice.due_date) return false;

  return (
    new Date(invoice.due_date) <
    new Date(
      `${getToday()}T00:00:00`
    )
  );
}


// ============================================================
// UI COMPONENTS
// ============================================================

function StatCard({
  icon: Icon,
  label,
  value,
  helper,
}) {
  return (
    <div className="invoicing-stat-card">
      <div className="invoicing-stat-icon">
        <Icon size={21} />
      </div>

      <div className="invoicing-stat-content">
        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>

        {helper && (
          <small>
            {helper}
          </small>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized =
    String(status || "").toUpperCase();

  return (
    <span
      className={`invoicing-status-badge invoicing-status-${normalized.toLowerCase()}`}
    >
      {normalized === "PAID" && (
        <CheckCircle2 size={13} />
      )}

      {normalized === "ISSUED" && (
        <FileText size={13} />
      )}

      {normalized === "PARTIALLY_PAID" && (
        <CreditCard size={13} />
      )}

      {normalized === "OVERDUE" && (
        <AlertCircle size={13} />
      )}

      {normalized === "DRAFT" && (
        <Edit3 size={13} />
      )}

      {normalized === "VOIDED" && (
        <X size={13} />
      )}

      {invoiceStatusLabel(status)}
    </span>
  );
}

function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  width = "760px",
}) {
  if (!open) return null;

  return (
    <div
      className="invoicing-modal-backdrop"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        className="invoicing-modal"
        style={{
          maxWidth: width,
        }}
      >
        <div className="invoicing-modal-header">
          <div>
            <h2>{title}</h2>

            {subtitle && (
              <p>{subtitle}</p>
            )}
          </div>

          <button
            type="button"
            className="invoicing-modal-close"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="invoicing-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
  hint,
}) {
  return (
    <div className="invoicing-field">
      <label>
        {label}

        {required && (
          <span className="invoicing-required">
            *
          </span>
        )}
      </label>

      {children}

      {hint && (
        <small>
          {hint}
        </small>
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}) {
  return (
    <div className="invoicing-empty-state">
      <div className="invoicing-empty-icon">
        <Icon size={28} />
      </div>

      <h3>{title}</h3>

      <p>{description}</p>

      {action}
    </div>
  );
}


// ============================================================
// INVOICE LIST
// ============================================================

function InvoiceListSection({
  invoices,
  customers,
  loading,
  currency,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  onRefresh,
  onCreate,
  onView,
  onIssue,
  onPayment,
  onDownload,
}) {
  const filteredInvoices =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      const currencyInvoices =
        filterInvoicesByCurrency(
          invoices,
          currency
        );

      return currencyInvoices.filter(
        (invoice) => {
          const matchesSearch =
            !query ||
            [
              invoice.invoice_number,
              invoice.customer?.name,
              invoice.status,
              invoice.notes,
            ]
              .filter(Boolean)
              .some((value) =>
                String(value)
                  .toLowerCase()
                  .includes(query)
              );

          const matchesStatus =
            !statusFilter ||
            invoice.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      invoices,
      search,
      statusFilter,
    ]);

  return (
    <>
      <div className="invoicing-stats-grid">
        <StatCard
          icon={Receipt}
          label="Total Invoices"
          value={invoices.length}
          helper="Invoice records"
        />

        <StatCard
          icon={FileText}
          label="Issued"
          value={
            invoices.filter(
              (invoice) =>
                invoice.status ===
                "ISSUED"
            ).length
          }
          helper="Awaiting payment"
        />

        <StatCard
          icon={CreditCard}
          label="Partially Paid"
          value={
            invoices.filter(
              (invoice) =>
                invoice.status ===
                "PARTIALLY_PAID"
            ).length
          }
          helper="Invoices with outstanding balances"
        />

        <StatCard
          icon={Wallet}
          label="Outstanding"
          value={formatMoney(
            invoices.reduce(
              (sum, invoice) =>
                sum +
                Number(
                  invoice.balance_due || 0
                ),
              0
            ),
            currency
          )}
          helper="Current invoice balances"
        />
      </div>

      <div className="invoicing-panel">
        <div className="invoicing-panel-header">
          <div>
            <h2>Invoices</h2>

            <p>
              Create, review and manage{" "}
              {getCurrencyCode(currency)} customer invoices.
            </p>
          </div>

          <div className="invoicing-header-actions">
            <button
              type="button"
              className="invoicing-btn invoicing-btn-secondary"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={
                  loading
                    ? "invoicing-spin"
                    : ""
                }
              />

              Refresh
            </button>

            <button
              type="button"
              className="invoicing-btn invoicing-btn-primary"
              onClick={onCreate}
            >
              <Plus size={17} />

              Create Invoice
            </button>
          </div>
        </div>

        <div className="invoicing-toolbar">
          <div className="invoicing-search">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search invoices..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />
          </div>

          <select
            className="invoicing-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >
            <option value="">
              All statuses
            </option>

            <option value="DRAFT">
              Draft
            </option>

            <option value="ISSUED">
              Issued
            </option>

            <option value="PARTIALLY_PAID">
              Partially Paid
            </option>

            <option value="PAID">
              Paid
            </option>

            <option value="OVERDUE">
              Overdue
            </option>

            <option value="VOIDED">
              Voided
            </option>
          </select>

          <span className="invoicing-record-count">
            {filteredInvoices.length} invoice
            {filteredInvoices.length ===
            1
              ? ""
              : "s"}
          </span>
        </div>

        {loading ? (
          <div className="invoicing-loading">
            <RefreshCw
              size={22}
              className="invoicing-spin"
            />

            <span>
              Loading invoices...
            </span>
          </div>
        ) : filteredInvoices.length ===
          0 ? (
          <EmptyState
            icon={Receipt}
            title={
              search ||
              statusFilter
                ? "No invoices found"
                : "No invoices yet"
            }
            description={
              search ||
              statusFilter
                ? "Try changing your search or status filter."
                : "Create your first customer invoice."
            }
            action={
              !search &&
              !statusFilter && (
                <button
                  type="button"
                  className="invoicing-btn invoicing-btn-primary"
                  onClick={onCreate}
                >
                  <Plus size={16} />
                  Create Invoice
                </button>
              )
            }
          />
        ) : (
          <div className="invoicing-table-wrapper">
            <table className="invoicing-table">
              <thead>
                <tr>
                  <th>
                    Invoice
                  </th>

                  <th>
                    Customer
                  </th>

                  <th>
                    Invoice Date
                  </th>

                  <th>
                    Due Date
                  </th>

                  <th>
                    Total
                  </th>

                  <th>
                    Balance
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredInvoices.map(
                  (invoice) => {
                    const overdue =
                      isInvoiceOverdue(
                        invoice
                      );

                    return (
                      <tr
                        key={
                          invoice.id
                        }
                      >
                        <td>
                          <div className="invoicing-primary-cell">
                            <div className="invoicing-document-icon">
                              <Receipt
                                size={17}
                              />
                            </div>

                            <div>
                              <strong>
                                {
                                  invoice.invoice_number
                                }
                              </strong>

                              {invoice.sale && (
                                <span>
                                  From Sale #
                                  {
                                    invoice.sale
                                  }
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="invoicing-customer-cell">
                            <User
                              size={15}
                            />

                            <span>
                              {invoice.customer
                                ?.name ||
                                customers.find(
                                  (
                                    customer
                                  ) =>
                                    customer.id ===
                                    invoice.customer
                                )
                                  ?.name ||
                                "—"}
                            </span>
                          </div>
                        </td>

                        <td>
                          {formatDate(
                            invoice.invoice_date
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              overdue
                                ? "invoicing-overdue-date"
                                : ""
                            }
                          >
                            {formatDate(
                              invoice.due_date
                            )}
                          </span>
                        </td>

                        <td className="invoicing-money">
                          {formatMoney(
                            invoice.total_amount,
                            invoice.currency ||
                              currency
                          )}
                        </td>

                        <td className="invoicing-money">
                          {formatMoney(
                            invoice.balance_due,
                            invoice.currency ||
                              currency
                          )}
                        </td>

                        <td>
                          <StatusBadge
                            status={
                              overdue
                                ? "OVERDUE"
                                : invoice.status
                            }
                          />
                        </td>

                        <td>
                          <div className="invoicing-action-group">
                            <button
                              type="button"
                              className="invoicing-icon-btn"
                              title="View invoice"
                              onClick={() =>
                                onView(
                                  invoice
                                )
                              }
                            >
                              <Eye
                                size={16}
                              />
                            </button>

                            {invoice.status ===
                              "DRAFT" && (
                              <button
                                type="button"
                                className="invoicing-icon-btn invoicing-icon-primary"
                                title="Issue invoice"
                                onClick={() =>
                                  onIssue(
                                    invoice
                                  )
                                }
                              >
                                <CheckCircle2
                                  size={16}
                                />
                              </button>
                            )}

                            {invoice.status !==
                              "DRAFT" &&
                              invoice.status !==
                                "PAID" &&
                              invoice.status !==
                                "VOIDED" &&
                              Number(
                                invoice.balance_due
                              ) > 0 && (
                                <button
                                  type="button"
                                  className="invoicing-icon-btn"
                                  title="Record payment"
                                  onClick={() =>
                                    onPayment(
                                      invoice
                                    )
                                  }
                                >
                                  <CreditCard
                                    size={16}
                                  />
                                </button>
                              )}

                            <button
                              type="button"
                              className="invoicing-icon-btn"
                              title="Download PDF"
                              onClick={() =>
                                onDownload(
                                  invoice
                                )
                              }
                            >
                              <Download
                                size={16}
                              />
                            </button>
                          </div>
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
  );
}


// ============================================================
// CREATE INVOICE
// ============================================================

function CreateInvoiceSection({
  companyId,
  customers,
  products,
  sales,
  currency,
  activeCurrencies,
  onSaved,
  onCancel,
}) {
  const [form, setForm] =
    useState({
      invoice_number:
        generateInvoiceNumber(),
      invoice_date:
        getToday(),
      due_date:
        getToday(),
      customer:
        "",
      currency:
        currency,
      sale:
        "",
      discount:
        "0",
      tax:
        "0",
      notes:
        "",
      terms:
        "",
      items: [
        {
          product: "",
          description: "",
          quantity: "1",
          unit_price: "",
          discount: "0",
          tax: "0",
        },
      ],
    });

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  function updateField(
    field,
    value
  ) {
    setForm((current) => ({
      ...current,
      [field]:
        field === "currency"
          ? getCurrencyCode(value)
          : value,
    }));
  }

  function updateItem(
    index,
    field,
    value
  ) {
    setForm((current) => ({
      ...current,
      items: current.items.map(
        (item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                [field]: value,
              }
            : item
      ),
    }));
  }

  function selectProduct(
    index,
    productId
  ) {
    const product =
      products.find(
        (item) =>
          String(item.id) ===
          String(productId)
      );

    setForm((current) => ({
      ...current,
      items: current.items.map(
        (item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                product:
                  productId,
                description:
                  product?.name ||
                  "",
                unit_price:
                  product?.selling_price ??
                  "",
              }
            : item
      ),
    }));
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          product: "",
          description: "",
          quantity: "1",
          unit_price: "",
          discount: "0",
          tax: "0",
        },
      ],
    }));
  }

  function removeItem(index) {
    setForm((current) => {
      if (
        current.items.length ===
        1
      ) {
        return current;
      }

      return {
        ...current,
        items:
          current.items.filter(
            (_, itemIndex) =>
              itemIndex !== index
          ),
      };
    });
  }

  function lineTotal(item) {
    const quantity =
      Number(item.quantity || 0);

    const unitPrice =
      Number(
        item.unit_price || 0
      );

    const discount =
      Number(
        item.discount || 0
      );

    const tax =
      Number(item.tax || 0);

    return Math.max(
      quantity *
        unitPrice -
        discount +
        tax,
      0
    );
  }

  const subtotal =
    form.items.reduce(
      (sum, item) =>
        sum + lineTotal(item),
      0
    );

  const discount =
    Number(form.discount || 0);

  const tax =
    Number(form.tax || 0);

  const estimatedTotal =
    Math.max(
      subtotal -
        discount +
        tax,
      0
    );

  function handleSaleChange(
    saleId
  ) {
    if (!saleId) {
      setForm((current) => ({
        ...current,
        sale: "",
      }));

      return;
    }

    const sale =
      sales.find(
        (item) =>
          String(item.id) ===
          String(saleId)
      );

    if (!sale) return;

    const customer =
      customers.find(
        (item) =>
          String(item.name) ===
          String(
            sale.customer_name
          )
      );

    setForm((current) => ({
      ...current,
      sale: saleId,
      customer:
        customer?.id
          ? String(customer.id)
          : current.customer,
      invoice_date:
        sale.sale_date ||
        current.invoice_date,
      discount:
        sale.discount ??
        "0",
      items:
        sale.items?.length
          ? sale.items.map(
              (item) => {
                const product =
                  products.find(
                    (candidate) =>
                      candidate.id ===
                      item.product
                  );

                return {
                  product:
                    item.product
                      ? String(
                          item.product
                        )
                      : "",
                  description:
                    product?.name ||
                    "",
                  quantity:
                    item.quantity ??
                    "1",
                  unit_price:
                    item.unit_price ??
                    "",
                  discount:
                    item.discount ??
                    "0",
                  tax: "0",
                };
              }
            )
          : current.items,
    }));
  }

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (!companyId) {
      setError(
        "No company is currently selected."
      );
      return;
    }

    if (
      !form.invoice_number.trim()
    ) {
      setError(
        "Invoice number is required."
      );
      return;
    }

    if (!form.invoice_date) {
      setError(
        "Invoice date is required."
      );
      return;
    }

    if (!form.due_date) {
      setError(
        "Due date is required."
      );
      return;
    }

    if (!form.customer) {
      setError(
        "Please select a customer."
      );
      return;
    }

    if (
      form.items.length ===
      0
    ) {
      setError(
        "At least one invoice item is required."
      );
      return;
    }

    const invalidItem =
      form.items.some(
        (item) =>
          !item.description.trim() ||
          Number(
            item.quantity
          ) <= 0 ||
          Number(
            item.unit_price
          ) < 0
      );

    if (invalidItem) {
      setError(
        "Please complete every invoice item with a description, valid quantity and valid unit price."
      );
      return;
    }

    if (
      Number(form.discount) <
        0 ||
      Number(form.tax) < 0
    ) {
      setError(
        "Discount and tax cannot be negative."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      let saved;

      if (form.sale) {
        saved =
          await api.post(
            `/api/invoicing/invoices/from-sale/`,
            {
              sale:
                Number(form.sale),
              customer:
                Number(form.customer),
              invoice_number:
                form.invoice_number.trim(),
              due_date:
                form.due_date,
              notes:
                form.notes.trim(),
              terms:
                form.terms.trim(),
              issue: false,
            }
          );
      } else {
        saved =
          await api.post(
            `/api/invoicing/invoices/create/`,
            {
              company:
                companyId,
              customer:
                Number(form.customer),
              invoice_number:
                form.invoice_number.trim(),
              invoice_date:
                form.invoice_date,
              due_date:
                form.due_date,
              currency:
                getCurrencyCode(
                  form.currency ||
                    currency
                ),
              items:
                form.items.map(
                  (item) => ({
                    product:
                      item.product
                        ? Number(
                            item.product
                          )
                        : null,
                    description:
                      item.description.trim(),
                    quantity:
                      item.quantity,
                    unit_price:
                      item.unit_price,
                    discount:
                      item.discount ||
                      "0",
                    tax:
                      item.tax ||
                      "0",
                  })
                ),
              discount:
                form.discount ||
                "0",
              tax:
                form.tax ||
                "0",
              notes:
                form.notes.trim(),
              terms:
                form.terms.trim(),
              issue: false,
            }
          );
      }

      await onSaved(saved);
    } catch (err) {
      setError(
        errorMessage(err)
      );
    } finally {
      setSaving(false);
    }
  }

  const completedSales =
    sales.filter(
      (sale) =>
        sale.status ===
        "COMPLETED"
    );

  return (
    <div className="invoicing-create-page">
      <div className="invoicing-create-header">
        <div>
          <button
            type="button"
            className="invoicing-back-btn"
            onClick={onCancel}
          >
            <ChevronRight
              size={16}
              className="invoicing-back-icon"
            />

            Back to Invoices
          </button>

          <h2>
            Create Invoice
          </h2>

          <p>
            Create a customer invoice manually or generate one from a completed sale.
          </p>
        </div>
      </div>

      {error && (
        <div className="invoicing-form-error">
          <AlertCircle size={18} />
          <span>
            {error}
          </span>
        </div>
      )}

      <form
        className="invoicing-form"
        onSubmit={
          handleSubmit
        }
      >
        <div className="invoicing-form-card">
          <div className="invoicing-card-header">
            <div>
              <h3>
                Invoice Information
              </h3>

              <p>
                Enter the basic details for this invoice.
              </p>
            </div>
          </div>

          <div className="invoicing-form-grid">
            <Field
              label="Invoice Number"
              required
            >
              <input
                type="text"
                value={
                  form.invoice_number
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "invoice_number",
                    event.target.value
                  )
                }
              />
            </Field>

            <Field
              label="Invoice Date"
              required
            >
              <input
                type="date"
                value={
                  form.invoice_date
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "invoice_date",
                    event.target.value
                  )
                }
              />
            </Field>

            <Field
              label="Due Date"
              required
            >
              <input
                type="date"
                value={
                  form.due_date
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "due_date",
                    event.target.value
                  )
                }
              />
            </Field>

            <Field
              label="Customer"
              required
            >
              <select
                value={
                  form.customer
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "customer",
                    event.target.value
                  )
                }
              >
                <option value="">
                  Select customer
                </option>

                {customers
                  .filter(
                    (customer) =>
                      customer.is_active
                  )
                  .map(
                    (customer) => (
                      <option
                        key={
                          customer.id
                        }
                        value={
                          customer.id
                        }
                      >
                        {
                          customer.name
                        }
                      </option>
                    )
                  )}
              </select>
            </Field>

            <Field
              label="Invoice Currency"
              required
            >
              <select
                value={
                  form.currency ||
                  currency
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "currency",
                    event.target.value
                  )
                }
                required
              >
                {(Array.isArray(
                  activeCurrencies
                )
                  ? activeCurrencies
                      .filter(
                        (item) =>
                          item?.is_active !==
                          false
                      )
                      .map((item) =>
                        getCurrencyCode(
                          item?.currency
                        )
                      )
                      .filter(Boolean)
                  : [currency]
                )
                  .filter(
                    (value, index, array) =>
                      array.indexOf(
                        value
                      ) === index
                  )
                  .map((code) => (
                    <option
                      key={code}
                      value={code}
                    >
                      {code}
                    </option>
                  ))}
              </select>
            </Field>
          </div>

          <div className="invoicing-sale-source">
            <div className="invoicing-sale-source-icon">
              <Receipt size={19} />
            </div>

            <div>
              <strong>
                Generate from completed sale
              </strong>

              <p>
                Use an existing completed sale to populate this invoice automatically.
              </p>
            </div>

            <select
              value={
                form.sale
              }
              onChange={(
                event
              ) =>
                handleSaleChange(
                  event.target.value
                )
              }
            >
              <option value="">
                Manual invoice
              </option>

              {completedSales.map(
                (sale) => (
                  <option
                    key={
                      sale.id
                    }
                    value={
                      sale.id
                    }
                  >
                    {sale.sale_number} —{" "}
                    {sale.customer_name ||
                      "Walk-in"}{" "}
                    —{" "}
                    {formatMoney(
                      sale.total_amount,
                      currency
                    )}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div className="invoicing-form-card">
          <div className="invoicing-card-header">
            <div>
              <h3>
                Invoice Items
              </h3>

              <p>
                Add the products, services or custom line items being billed.
              </p>
            </div>

            <button
              type="button"
              className="invoicing-btn invoicing-btn-secondary"
              onClick={
                addItem
              }
            >
              <Plus size={16} />
              Add Item
            </button>
          </div>

          <div className="invoicing-line-items">
            {form.items.map(
              (
                item,
                index
              ) => (
                <div
                  className="invoicing-line-item"
                  key={index}
                >
                  <div className="invoicing-line-number">
                    {index + 1}
                  </div>

                  <div className="invoicing-line-product">
                    <label>
                      Product / Service
                    </label>

                    <select
                      value={
                        item.product
                      }
                      onChange={(
                        event
                      ) =>
                        selectProduct(
                          index,
                          event.target
                            .value
                        )
                      }
                    >
                      <option value="">
                        Custom / Select item
                      </option>

                      {products
                        .filter(
                          (
                            product
                          ) =>
                            product.is_active
                        )
                        .map(
                          (
                            product
                          ) => (
                            <option
                              key={
                                product.id
                              }
                              value={
                                product.id
                              }
                            >
                              {
                                product.code
                              }{" "}
                              —{" "}
                              {
                                product.name
                              }
                            </option>
                          )
                        )}
                    </select>
                  </div>

                  <div className="invoicing-line-description">
                    <label>
                      Description
                    </label>

                    <input
                      type="text"
                      value={
                        item.description
                      }
                      onChange={(
                        event
                      ) =>
                        updateItem(
                          index,
                          "description",
                          event.target
                            .value
                        )
                      }
                      placeholder="Item description"
                    />
                  </div>

                  <div className="invoicing-line-small">
                    <label>
                      Qty
                    </label>

                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={
                        item.quantity
                      }
                      onChange={(
                        event
                      ) =>
                        updateItem(
                          index,
                          "quantity",
                          event.target
                            .value
                        )
                      }
                    />
                  </div>

                  <div className="invoicing-line-small">
                    <label>
                      Unit Price
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        item.unit_price
                      }
                      onChange={(
                        event
                      ) =>
                        updateItem(
                          index,
                          "unit_price",
                          event.target
                            .value
                        )
                      }
                    />
                  </div>

                  <div className="invoicing-line-small">
                    <label>
                      Discount
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        item.discount
                      }
                      onChange={(
                        event
                      ) =>
                        updateItem(
                          index,
                          "discount",
                          event.target
                            .value
                        )
                      }
                    />
                  </div>

                  <div className="invoicing-line-small">
                    <label>
                      Tax
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        item.tax
                      }
                      onChange={(
                        event
                      ) =>
                        updateItem(
                          index,
                          "tax",
                          event.target
                            .value
                        )
                      }
                    />
                  </div>

                  <div className="invoicing-line-total">
                    <label>
                      Total
                    </label>

                    <strong>
                      {formatMoney(
                        lineTotal(
                          item
                        ),
                        form.currency ||
                          currency
                      )}
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="invoicing-line-remove"
                    onClick={() =>
                      removeItem(
                        index
                      )
                    }
                    disabled={
                      form.items
                        .length ===
                      1
                    }
                    title="Remove item"
                  >
                    <X size={16} />
                  </button>
                </div>
              )
            )}
          </div>
        </div>

        <div className="invoicing-bottom-grid">
          <div className="invoicing-form-card">
            <div className="invoicing-card-header">
              <div>
                <h3>
                  Notes & Terms
                </h3>

                <p>
                  Add information that should appear on the invoice.
                </p>
              </div>
            </div>

            <Field label="Notes">
              <textarea
                rows="4"
                value={
                  form.notes
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "notes",
                    event.target.value
                  )
                }
                placeholder="Optional invoice notes"
              />
            </Field>

            <Field label="Terms">
              <textarea
                rows="4"
                value={
                  form.terms
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "terms",
                    event.target.value
                  )
                }
                placeholder="Payment terms, delivery terms, etc."
              />
            </Field>
          </div>

          <div className="invoicing-total-card">
            <div className="invoicing-total-row">
              <span>
                Subtotal
              </span>

              <strong>
                {formatMoney(
                  subtotal,
                  form.currency ||
                    currency
                )}
              </strong>
            </div>

            <div className="invoicing-total-input-row">
              <span>
                Invoice Discount
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  form.discount
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "discount",
                    event.target.value
                  )
                }
              />
            </div>

            <div className="invoicing-total-input-row">
              <span>
                Invoice Tax
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  form.tax
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "tax",
                    event.target.value
                  )
                }
              />
            </div>

            <div className="invoicing-total-grand">
              <span>
                Invoice Total
              </span>

              <strong>
                {formatMoney(
                  estimatedTotal,
                  form.currency ||
                    currency
                )}
              </strong>
            </div>

            <div className="invoicing-currency-note">
              <span>
                Currency
              </span>

              <strong>
                {currency}
              </strong>
            </div>
          </div>
        </div>

        <div className="invoicing-form-actions">
          <button
            type="button"
            className="invoicing-btn invoicing-btn-secondary"
            onClick={
              onCancel
            }
            disabled={
              saving
            }
          >
            Cancel
          </button>

          <button
            type="submit"
            className="invoicing-btn invoicing-btn-primary"
            disabled={
              saving
            }
          >
            {saving ? (
              <>
                <RefreshCw
                  size={16}
                  className="invoicing-spin"
                />

                Creating...
              </>
            ) : (
              <>
                <CheckCircle2
                  size={16}
                />

                Create Draft Invoice
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}


// ============================================================
// INVOICE DETAIL
// ============================================================

function InvoiceDetailModal({
  invoice,
  open,
  currency,
  onClose,
  onIssue,
  onPayment,
  onDownload,
}) {
  if (!invoice) return null;

  const invoiceCurrency =
    invoice.currency ||
    currency;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        invoice.invoice_number
      }
      subtitle={
        `${invoice.customer?.name || "Customer invoice"} • ${formatDate(
          invoice.invoice_date
        )}`
      }
      width="980px"
    >
      <div className="invoicing-detail-header">
        <div className="invoicing-detail-status">
          <span>
            Status
          </span>

          <StatusBadge
            status={
              isInvoiceOverdue(
                invoice
              )
                ? "OVERDUE"
                : invoice.status
            }
          />
        </div>

        <div className="invoicing-detail-actions">
          {invoice.status ===
            "DRAFT" && (
            <button
              type="button"
              className="invoicing-btn invoicing-btn-primary"
              onClick={() =>
                onIssue(
                  invoice
                )
              }
            >
              <CheckCircle2
                size={16}
              />
              Issue Invoice
            </button>
          )}

          {invoice.status !==
            "DRAFT" &&
            invoice.status !==
              "PAID" &&
            invoice.status !==
              "VOIDED" &&
            Number(
              invoice.balance_due
            ) > 0 && (
              <button
                type="button"
                className="invoicing-btn invoicing-btn-secondary"
                onClick={() =>
                  onPayment(
                    invoice
                  )
                }
              >
                <CreditCard
                  size={16}
                />
                Record Payment
              </button>
            )}

          <button
            type="button"
            className="invoicing-btn invoicing-btn-secondary"
            onClick={() =>
              onDownload(
                invoice
              )
            }
          >
            <Download
              size={16}
            />
            PDF
          </button>
        </div>
      </div>

      <div className="invoicing-detail-summary">
        <div>
          <span>
            Customer
          </span>

          <strong>
            {invoice.customer
              ?.name ||
              "—"}
          </strong>
        </div>

        <div>
          <span>
            Invoice Date
          </span>

          <strong>
            {formatDate(
              invoice.invoice_date
            )}
          </strong>
        </div>

        <div>
          <span>
            Due Date
          </span>

          <strong>
            {formatDate(
              invoice.due_date
            )}
          </strong>
        </div>

        <div>
          <span>
            Currency
          </span>

          <strong>
            {
              invoiceCurrency
            }
          </strong>
        </div>
      </div>

      <div className="invoicing-detail-section">
        <div className="invoicing-detail-section-header">
          <div>
            <h3>
              Invoice Items
            </h3>

            {invoice.sale && (
              <p>
                Generated from sale #
                {
                  invoice.sale
                }
              </p>
            )}
          </div>
        </div>

        <div className="invoicing-table-wrapper">
          <table className="invoicing-table">
            <thead>
              <tr>
                <th>
                  Description
                </th>

                <th>
                  Qty
                </th>

                <th>
                  Unit Price
                </th>

                <th>
                  Discount
                </th>

                <th>
                  Tax
                </th>

                <th>
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {(
                invoice.items ||
                []
              ).map(
                (item) => (
                  <tr
                    key={
                      item.id
                    }
                  >
                    <td>
                      <strong>
                        {
                          item.description
                        }
                      </strong>
                    </td>

                    <td>
                      {formatNumber(
                        item.quantity
                      )}
                    </td>

                    <td>
                      {formatMoney(
                        item.unit_price,
                        invoiceCurrency
                      )}
                    </td>

                    <td>
                      {formatMoney(
                        item.discount,
                        invoiceCurrency
                      )}
                    </td>

                    <td>
                      {formatMoney(
                        item.tax,
                        invoiceCurrency
                      )}
                    </td>

                    <td className="invoicing-money">
                      {formatMoney(
                        item.line_total,
                        invoiceCurrency
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="invoicing-detail-total-box">
        <div>
          <span>
            Subtotal
          </span>

          <strong>
            {formatMoney(
              invoice.subtotal,
              invoiceCurrency
            )}
          </strong>
        </div>

        <div>
          <span>
            Discount
          </span>

          <strong>
            {formatMoney(
              invoice.discount,
              invoiceCurrency
            )}
          </strong>
        </div>

        <div>
          <span>
            Tax
          </span>

          <strong>
            {formatMoney(
              invoice.tax,
              invoiceCurrency
            )}
          </strong>
        </div>

        <div className="invoicing-detail-grand-total">
          <span>
            Total
          </span>

          <strong>
            {formatMoney(
              invoice.total_amount,
              invoiceCurrency
            )}
          </strong>
        </div>

        <div>
          <span>
            Amount Paid
          </span>

          <strong>
            {formatMoney(
              invoice.amount_paid,
              invoiceCurrency
            )}
          </strong>
        </div>

        <div className="invoicing-detail-balance">
          <span>
            Balance Due
          </span>

          <strong>
            {formatMoney(
              invoice.balance_due,
              invoiceCurrency
            )}
          </strong>
        </div>
      </div>

      {invoice.notes && (
        <div className="invoicing-detail-note">
          <strong>
            Notes
          </strong>

          <p>
            {invoice.notes}
          </p>
        </div>
      )}

      {invoice.terms && (
        <div className="invoicing-detail-note">
          <strong>
            Terms
          </strong>

          <p>
            {invoice.terms}
          </p>
        </div>
      )}
    </Modal>
  );
}


// ============================================================
// CUSTOMER PAYMENT FORM
// ============================================================

function CustomerPaymentModal({
  invoice,
  open,
  currency,
  workspaceCurrency,
  activeCurrencies,
  exchangeRates,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({
    amount: "",
    payment_date: getToday(),
    payment_method: "BANK",
    reference: "",
    notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const invoiceCurrency = getCurrencyCode(
    invoice?.currency || currency
  );

  const availablePaymentCurrencies = useMemo(() => {
    const codes = (Array.isArray(activeCurrencies)
      ? activeCurrencies
          .filter((item) => item?.is_active !== false)
          .map((item) => getCurrencyCode(item?.currency))
      : []
    ).filter(Boolean);

    const workspaceCode = getCurrencyCode(
      workspaceCurrency || currency
    );

    if (workspaceCode && !codes.includes(workspaceCode)) {
      codes.unshift(workspaceCode);
    }

    if (!codes.length) {
      codes.push(workspaceCode || invoiceCurrency);
    }

    return [...new Set(codes)];
  }, [
    activeCurrencies,
    workspaceCurrency,
    currency,
    invoiceCurrency,
  ]);

  const [paymentCurrency, setPaymentCurrency] =
    useState(
      getCurrencyCode(
        workspaceCurrency || currency
      )
    );

  const paymentToInvoiceRate = getHistoricalExchangeRate(
    exchangeRates,
    paymentCurrency,
    invoiceCurrency,
    form.payment_date
  );

  const invoiceToPaymentRate =
    paymentToInvoiceRate && paymentToInvoiceRate > 0
      ? 1 / paymentToInvoiceRate
      : null;

  const invoiceBalance = Number(
    invoice?.balance_due || 0
  );

  const maxPaymentAmount =
    paymentToInvoiceRate && paymentToInvoiceRate > 0
      ? invoiceBalance / paymentToInvoiceRate
      : null;

  const paymentAmount = Number(form.amount || 0);

  const amountInInvoiceCurrency =
    paymentToInvoiceRate && paymentAmount > 0
      ? paymentAmount * paymentToInvoiceRate
      : 0;

  const remainingInvoiceBalance = Math.max(
    invoiceBalance - amountInInvoiceCurrency,
    0
  );

  useEffect(() => {
    if (!open) return;

    const nextInvoiceCurrency = getCurrencyCode(
      invoice?.currency || currency
    );

    const nextPaymentCurrency = getCurrencyCode(
      workspaceCurrency || currency
    );

    setPaymentCurrency(nextPaymentCurrency);

    const nextRate = getHistoricalExchangeRate(
      exchangeRates,
      nextPaymentCurrency,
      nextInvoiceCurrency,
      getToday()
    );

    const nextBalance = Number(
      invoice?.balance_due || 0
    );

    const fullPayment =
      nextRate && nextRate > 0
        ? nextBalance / nextRate
        : nextBalance;

    setForm({
      amount:
        fullPayment > 0
          ? fullPayment.toFixed(2)
          : "",
      payment_date: getToday(),
      payment_method: "BANK",
      reference: "",
      notes: "",
    });

    setError("");
  }, [
    open,
    invoice?.id,
    invoice?.balance_due,
    invoice?.currency,
    workspaceCurrency,
    currency,
    exchangeRates,
  ]);

  if (!invoice) {
    return null;
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handlePaymentCurrencyChange(nextCurrency) {
    const normalized = getCurrencyCode(nextCurrency);

    if (!availablePaymentCurrencies.includes(normalized)) {
      return;
    }

    setPaymentCurrency(normalized);

    const rate = getHistoricalExchangeRate(
      exchangeRates,
      normalized,
      invoiceCurrency,
      form.payment_date
    );

    const balance = Number(
      invoice?.balance_due || 0
    );

    const fullPayment =
      rate && rate > 0
        ? balance / rate
        : balance;

    setForm((current) => ({
      ...current,
      amount:
        fullPayment > 0
          ? fullPayment.toFixed(2)
          : "",
    }));

    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const amount = Number(form.amount);
    const balance = Number(invoice.balance_due || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(
        `Payment amount must be greater than zero ${paymentCurrency ? `in ${paymentCurrency}` : ""}.`
      );
      return;
    }

    if (!paymentToInvoiceRate || paymentToInvoiceRate <= 0) {
      setError(
        `No historical exchange rate is available for ${paymentCurrency} → ${invoiceCurrency} on ${form.payment_date}. Configure an exchange rate in Settings → Currencies & Rates first.`
      );
      return;
    }

    const convertedAmount =
      amount * paymentToInvoiceRate;

    if (convertedAmount > balance + 0.000001) {
      setError(
        `Payment exceeds the invoice balance. Maximum payment is ${formatMoney(
          maxPaymentAmount,
          paymentCurrency
        )} (${formatMoney(balance, invoiceCurrency)} equivalent).`
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const saved = await api.post(
        `/api/invoicing/customer-payments/create/`,
        {
          invoice: invoice.id,
          amount: form.amount,
          currency: paymentCurrency,
          payment_date: form.payment_date,
          payment_method: form.payment_method,
          reference: form.reference.trim(),
          notes: form.notes.trim(),
        }
      );

      await onSaved(saved);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Customer Payment"
      subtitle={`Payment against ${invoice.invoice_number}`}
      width="650px"
    >
      <div className="invoicing-payment-summary">
        <div>
          <span>Invoice Total</span>
          <strong>
            {formatMoney(
              invoice.total_amount,
              invoiceCurrency
            )}
          </strong>
        </div>

        <div>
          <span>Balance Due</span>
          <strong>
            {formatMoney(
              invoice.balance_due,
              invoiceCurrency
            )}
          </strong>
        </div>
      </div>

      <div className="invoicing-payment-currency-banner">
        <div>
          <span>Payment currency</span>
          <strong>{paymentCurrency}</strong>
        </div>

        <div>
          <span>Invoice currency</span>
          <strong>{invoiceCurrency}</strong>
        </div>

        <div>
          <span>Exchange rate</span>
          <strong>
            {paymentToInvoiceRate
              ? `1 ${paymentCurrency} = ${paymentToInvoiceRate.toFixed(6)} ${invoiceCurrency}`
              : "Rate unavailable"}
          </strong>
        </div>
      </div>

      {error && (
        <div className="invoicing-form-error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      <form
        className="invoicing-form"
        onSubmit={handleSubmit}
      >
        <div className="invoicing-form-grid">
          <Field
            label="Payment Currency"
            required
          >
            <select
              value={paymentCurrency}
              onChange={(event) =>
                handlePaymentCurrencyChange(
                  event.target.value
                )
              }
            >
              {availablePaymentCurrencies.map(
                (code) => (
                  <option
                    key={code}
                    value={code}
                  >
                    {code}
                  </option>
                )
              )}
            </select>
          </Field>

          <Field
            label={`Payment Amount (${paymentCurrency})`}
            required
          >
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={
                maxPaymentAmount !== null
                  ? maxPaymentAmount
                  : undefined
              }
              value={form.amount}
              onChange={(event) =>
                updateField(
                  "amount",
                  event.target.value
                )
              }
              autoFocus
            />
          </Field>

          <Field
            label="Payment Date"
            required
          >
            <input
              type="date"
              value={form.payment_date}
              onChange={(event) =>
                updateField(
                  "payment_date",
                  event.target.value
                )
              }
            />
          </Field>

          <Field
            label="Payment Method"
            required
          >
            <select
              value={form.payment_method}
              onChange={(event) =>
                updateField(
                  "payment_method",
                  event.target.value
                )
              }
            >
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="CARD">Card</option>
            </select>
          </Field>

          <Field label="Reference">
            <input
              type="text"
              value={form.reference}
              onChange={(event) =>
                updateField(
                  "reference",
                  event.target.value
                )
              }
              placeholder="Receipt / transaction reference"
            />
          </Field>
        </div>

        <div className="invoicing-payment-conversion-preview">
          <div>
            <span>Payment entered</span>
            <strong>
              {formatMoney(
                paymentAmount,
                paymentCurrency
              )}
            </strong>
          </div>

          <div>
            <span>Invoice amount covered</span>
            <strong>
              {formatMoney(
                amountInInvoiceCurrency,
                invoiceCurrency
              )}
            </strong>
          </div>

          <div>
            <span>Remaining balance</span>
            <strong>
              {formatMoney(
                remainingInvoiceBalance,
                invoiceCurrency
              )}
            </strong>
          </div>
        </div>

        {invoiceToPaymentRate &&
          paymentCurrency !== invoiceCurrency && (
            <div className="invoicing-payment-rate-note">
              1 {invoiceCurrency} = {invoiceToPaymentRate.toFixed(6)} {paymentCurrency}
            </div>
          )}

        <Field label="Notes">
          <textarea
            rows="3"
            value={form.notes}
            onChange={(event) =>
              updateField(
                "notes",
                event.target.value
              )
            }
            placeholder="Optional payment notes"
          />
        </Field>

        <div className="invoicing-form-actions">
          <button
            type="button"
            className="invoicing-btn invoicing-btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="invoicing-btn invoicing-btn-primary"
            disabled={
              saving ||
              !paymentToInvoiceRate
            }
          >
            {saving ? (
              <>
                <RefreshCw
                  size={16}
                  className="invoicing-spin"
                />
                Recording...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                Record Payment
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// PAYMENTS SECTION
// ============================================================

function PaymentsSection({
  payments,
  invoices,
  loading,
  currency,
  search,
  setSearch,
  onRefresh,
  onRecord,
}) {
  const filteredPayments =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      const workspacePayments =
        filterPaymentsByCurrency(
          payments,
          currency
        );

      if (!query) {
        return workspacePayments;
      }

      return workspacePayments.filter(
        (payment) =>
          [
            payment.reference,
            payment.payment_method,
            payment.invoice?.invoice_number,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(query)
            )
      );
    }, [
      payments,
      currency,
      search,
    ]);

  const totalPayments =
    filteredPayments.reduce(
      (sum, payment) =>
        sum +
        Number(
          payment.amount || 0
        ),
      0
    );

  return (
    <>
      <div className="invoicing-stats-grid">
        <StatCard
          icon={CreditCard}
          label="Payments"
          value={
            payments.length
          }
          helper="Customer payment records"
        />

        <StatCard
          icon={ArrowDownRight}
          label="Total Received"
          value={formatMoney(
            totalPayments,
            currency
          )}
          helper="Recorded customer payments"
        />

        <StatCard
          icon={Wallet}
          label="Invoices"
          value={
            new Set(
              payments.map((payment) =>
                String(
                  payment?.invoice?.id ??
                    payment?.invoice ??
                    ""
                )
              )
            ).size
          }
          helper="Invoices linked to payments"
        />
      </div>

      <div className="invoicing-panel">
        <div className="invoicing-panel-header">
          <div>
            <h2>
              Customer Payments
            </h2>

            <p>
              Record and review payments received against customer invoices.
            </p>
          </div>

          <div className="invoicing-header-actions">
            <button
              type="button"
              className="invoicing-btn invoicing-btn-secondary"
              onClick={
                onRefresh
              }
              disabled={
                loading
              }
            >
              <RefreshCw
                size={16}
                className={
                  loading
                    ? "invoicing-spin"
                    : ""
                }
              />

              Refresh
            </button>

            <button
              type="button"
              className="invoicing-btn invoicing-btn-primary"
              onClick={
                onRecord
              }
            >
              <Plus size={17} />

              Record Payment
            </button>
          </div>
        </div>

        <div className="invoicing-toolbar">
          <div className="invoicing-search">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search payments..."
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
            />
          </div>

          <span className="invoicing-record-count">
            {
              filteredPayments.length
            } payment
            {filteredPayments.length ===
            1
              ? ""
              : "s"}
          </span>
        </div>

        {loading ? (
          <div className="invoicing-loading">
            <RefreshCw
              size={22}
              className="invoicing-spin"
            />

            <span>
              Loading payments...
            </span>
          </div>
        ) : filteredPayments.length ===
          0 ? (
          <EmptyState
            icon={CreditCard}
            title={
              search
                ? "No payments found"
                : "No payments yet"
            }
            description={
              search
                ? "Try changing your search term."
                : "Record a customer payment against an issued invoice."
            }
            action={
              !search && (
                <button
                  type="button"
                  className="invoicing-btn invoicing-btn-primary"
                  onClick={
                    onRecord
                  }
                >
                  <Plus
                    size={16}
                  />
                  Record Payment
                </button>
              )
            }
          />
        ) : (
          <div className="invoicing-table-wrapper">
            <table className="invoicing-table">
              <thead>
                <tr>
                  <th>
                    Invoice
                  </th>

                  <th>
                    Customer
                  </th>

                  <th>
                    Payment Date
                  </th>

                  <th>
                    Method
                  </th>

                  <th>
                    Reference
                  </th>

                  <th>
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredPayments.map(
                  (payment) => (
                    <tr
                      key={
                        payment.id
                      }
                    >
                      <td>
                        <strong>
                          {payment.invoice
                            ?.invoice_number ||
                            `Invoice #${payment.invoice}`}
                        </strong>
                      </td>

                      <td>
                        {payment.invoice
                          ?.customer
                          ?.name ||
                          "—"}
                      </td>

                      <td>
                        {formatDate(
                          payment.payment_date
                        )}
                      </td>

                      <td>
                        {paymentMethodLabel(
                          payment.payment_method
                        )}
                      </td>

                      <td>
                        {
                          payment.reference ||
                          "—"
                        }
                      </td>

                      <td className="invoicing-money">
                        {formatMoney(
                          payment.amount,
                          getPaymentCurrency(
                            payment,
                            currency
                          )
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}


// ============================================================
// STATEMENTS SECTION
// ============================================================

function StatementsSection({
  invoices,
  payments,
  customers,
  currency,
}) {
  const [customerId, setCustomerId] =
    useState("");

  const customerInvoices =
    customerId
      ? invoices.filter(
          (invoice) =>
            String(
              invoice.customer?.id ||
                invoice.customer
            ) ===
            String(customerId)
        )
      : [];

  const customerPayments =
    customerId
      ? payments.filter(
          (payment) =>
            String(
              payment.invoice
                ?.customer
                ?.id ||
                payment.invoice
            ) ===
            String(customerId)
        )
      : [];

  const selectedCustomer =
    customers.find(
      (customer) =>
        String(customer.id) ===
        String(customerId)
    );

  const invoicedTotal =
    customerInvoices.reduce(
      (sum, invoice) =>
        sum +
        Number(
          invoice.total_amount || 0
        ),
      0
    );

  const paidTotal =
    customerInvoices.reduce(
      (sum, invoice) =>
        sum +
        Number(
          invoice.amount_paid || 0
        ),
      0
    );

  const balanceTotal =
    customerInvoices.reduce(
      (sum, invoice) =>
        sum +
        Number(
          invoice.balance_due || 0
        ),
      0
    );

  return (
    <>
      <div className="invoicing-stats-grid">
        <StatCard
          icon={User}
          label="Customers"
          value={
            customers.length
          }
          helper="Available customer records"
        />

        <StatCard
          icon={FileText}
          label="Invoiced"
          value={formatMoney(
            invoicedTotal,
            currency
          )}
          helper={
            selectedCustomer
              ? selectedCustomer.name
              : "Select a customer"
          }
        />

        <StatCard
          icon={ArrowDownRight}
          label="Paid"
          value={formatMoney(
            paidTotal,
            currency
          )}
          helper="Payments received"
        />

        <StatCard
          icon={Wallet}
          label="Balance Due"
          value={formatMoney(
            balanceTotal,
            currency
          )}
          helper="Outstanding customer balance"
        />
      </div>

      <div className="invoicing-panel">
        <div className="invoicing-panel-header">
          <div>
            <h2>
              Invoice Statements
            </h2>

            <p>
              Review a customer's invoice and payment history.
            </p>
          </div>
        </div>

        <div className="invoicing-statement-selector">
          <div className="invoicing-statement-selector-icon">
            <User size={19} />
          </div>

          <div>
            <strong>
              Customer Statement
            </strong>

            <span>
              Select a customer to view their account activity.
            </span>
          </div>

          <select
            value={
              customerId
            }
            onChange={(
              event
            ) =>
              setCustomerId(
                event.target.value
              )
            }
          >
            <option value="">
              Select customer
            </option>

            {customers
              .filter(
                (customer) =>
                  customer.is_active
              )
              .map(
                (customer) => (
                  <option
                    key={
                      customer.id
                    }
                    value={
                      customer.id
                    }
                  >
                    {
                      customer.name
                    }
                  </option>
                )
              )}
          </select>
        </div>

        {!customerId ? (
          <EmptyState
            icon={FileText}
            title="Select a customer"
            description="Choose a customer above to generate their invoice statement."
          />
        ) : (
          <>
            <div className="invoicing-statement-summary">
              <div>
                <span>
                  Customer
                </span>

                <strong>
                  {
                    selectedCustomer?.name
                  }
                </strong>
              </div>

              <div>
                <span>
                  Invoices
                </span>

                <strong>
                  {
                    customerInvoices.length
                  }
                </strong>
              </div>

              <div>
                <span>
                  Payments
                </span>

                <strong>
                  {
                    customerPayments.length
                  }
                </strong>
              </div>

              <div>
                <span>
                  Balance
                </span>

                <strong>
                  {formatMoney(
                    balanceTotal,
                    currency
                  )}
                </strong>
              </div>
            </div>

            <div className="invoicing-detail-section">
              <div className="invoicing-detail-section-header">
                <div>
                  <h3>
                    Invoice History
                  </h3>
                </div>
              </div>

              <div className="invoicing-table-wrapper">
                <table className="invoicing-table">
                  <thead>
                    <tr>
                      <th>
                        Invoice
                      </th>

                      <th>
                        Date
                      </th>

                      <th>
                        Due
                      </th>

                      <th>
                        Total
                      </th>

                      <th>
                        Paid
                      </th>

                      <th>
                        Balance
                      </th>

                      <th>
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {customerInvoices.map(
                      (
                        invoice
                      ) => (
                        <tr
                          key={
                            invoice.id
                          }
                        >
                          <td>
                            <strong>
                              {
                                invoice.invoice_number
                              }
                            </strong>
                          </td>

                          <td>
                            {formatDate(
                              invoice.invoice_date
                            )}
                          </td>

                          <td>
                            {formatDate(
                              invoice.due_date
                            )}
                          </td>

                          <td className="invoicing-money">
                            {formatMoney(
                              invoice.total_amount,
                              invoice.currency ||
                                currency
                            )}
                          </td>

                          <td className="invoicing-money">
                            {formatMoney(
                              invoice.amount_paid,
                              invoice.currency ||
                                currency
                            )}
                          </td>

                          <td className="invoicing-money">
                            {formatMoney(
                              invoice.balance_due,
                              invoice.currency ||
                                currency
                            )}
                          </td>

                          <td>
                            <StatusBadge
                              status={
                                isInvoiceOverdue(
                                  invoice
                                )
                                  ? "OVERDUE"
                                  : invoice.status
                              }
                            />
                          </td>
                        </tr>
                      )
                    )}

                    {customerInvoices.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan="7"
                          className="invoicing-table-empty"
                        >
                          No invoices found for this customer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="invoicing-detail-section">
              <div className="invoicing-detail-section-header">
                <div>
                  <h3>
                    Payment History
                  </h3>
                </div>
              </div>

              <div className="invoicing-table-wrapper">
                <table className="invoicing-table">
                  <thead>
                    <tr>
                      <th>
                        Invoice
                      </th>

                      <th>
                        Date
                      </th>

                      <th>
                        Method
                      </th>

                      <th>
                        Reference
                      </th>

                      <th>
                        Amount
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {customerPayments.map(
                      (
                        payment
                      ) => (
                        <tr
                          key={
                            payment.id
                          }
                        >
                          <td>
                            {payment.invoice
                              ?.invoice_number ||
                              `Invoice #${payment.invoice}`}
                          </td>

                          <td>
                            {formatDate(
                              payment.payment_date
                            )}
                          </td>

                          <td>
                            {paymentMethodLabel(
                              payment.payment_method
                            )}
                          </td>

                          <td>
                            {
                              payment.reference ||
                              "—"
                            }
                          </td>

                          <td className="invoicing-money">
                            {formatMoney(
                              payment.amount,
                              getPaymentCurrency(
                                payment,
                                currency
                              )
                            )}
                          </td>
                        </tr>
                      )
                    )}

                    {customerPayments.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan="5"
                          className="invoicing-table-empty"
                        >
                          No payments recorded for this customer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}


// ============================================================
// MAIN PAGE
// ============================================================

export default function Invoicing() {
  const location =
    useLocation();

  const {
    currentCompany,
    workspaceCurrency,
    activeCurrencies,
    exchangeRates,
  } = useCompany();

  const companyId =
    currentCompany?.id;

  const currency =
    getCurrencyCode(
      workspaceCurrency ||
        currentCompany?.currency
    );

  const pathParts =
    location.pathname
      .split("/")
      .filter(Boolean);

  const currentSection =
    pathParts[1];

  const validSections = [
    "invoices",
    "create",
    "payments",
    "statements",
  ];

  if (
    !currentSection ||
    !validSections.includes(
      currentSection
    )
  ) {
    return (
      <Navigate
        to="/invoicing/invoices"
        replace
      />
    );
  }

  const [
    invoices,
    setInvoices,
  ] = useState([]);

  const [
    customers,
    setCustomers,
  ] = useState([]);

  const [
    products,
    setProducts,
  ] = useState([]);

  const [
    sales,
    setSales,
  ] = useState([]);

  const [
    payments,
    setPayments,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    pageError,
    setPageError,
  ] = useState("");

  const [
    invoiceSearch,
    setInvoiceSearch,
  ] = useState("");

  const [
    invoiceStatusFilter,
    setInvoiceStatusFilter,
  ] = useState("");

  const [
    paymentSearch,
    setPaymentSearch,
  ] = useState("");

  const [
    selectedInvoice,
    setSelectedInvoice,
  ] = useState(null);

  const [
    paymentInvoice,
    setPaymentInvoice,
  ] = useState(null);

  const [
    detailOpen,
    setDetailOpen,
  ] = useState(false);

  const [
    paymentOpen,
    setPaymentOpen,
  ] = useState(false);

  async function loadInvoicingData() {
    if (!companyId) {   
      setInvoices([]);
      setCustomers([]);
      setProducts([]);
      setSales([]);
      setPayments([]);

      return;
    }

    setLoading(true);
    setPageError("");

    try {
      const [
        invoiceResponse,
        customerResponse,
        productResponse,
        salesResponse,
        paymentResponse,
      ] = await Promise.all([
        api.get(
          `/api/invoicing/invoices/?company=${companyId}`
        ),

        api.get(
          `/api/invoicing/customers/?company=${companyId}`
        ),

        api.get(
          `/api/operations/products/?company=${companyId}`
        ),

        api.get(
          `/api/operations/sales/?company=${companyId}`
        ),

        api.get(
          `/api/invoicing/customer-payments/?company=${companyId}`
        ),
      ]);

      setInvoices(
        getList(
          invoiceResponse
        )
      );

      setCustomers(
        getList(
          customerResponse
        )
      );

      setProducts(
        getList(
          productResponse
        )
      );

      setSales(
        getList(
          salesResponse
        )
      );

      setPayments(
        getList(
          paymentResponse
        )
      );
    } catch (error) {
      setPageError(
        errorMessage(error)
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoicingData();
  }, [companyId]);

  async function handleSaved() {
    await loadInvoicingData();
  }

  async function issueInvoice(
    invoice
  ) {
    try {
      await api.post(
        `/api/invoicing/invoices/${invoice.id}/issue/`,
        {}
      );

      await loadInvoicingData();

      const updated =
        await api.get(
          `/api/invoicing/invoices/${invoice.id}/`
        );

      setSelectedInvoice(
        updated
      );
    } catch (error) {
      setPageError(
        errorMessage(error)
      );
    }
  }

  function openInvoice(
    invoice
  ) {
    setSelectedInvoice(
      invoice
    );

    setDetailOpen(
      true
    );
  }

  function closeInvoice() {
    setDetailOpen(
      false
    );

    setSelectedInvoice(
      null
    );
  }

  function openPayment(
    invoice
  ) {
    setPaymentInvoice(
      invoice
    );

    setPaymentOpen(
      true
    );
  }

  function closePayment() {
    setPaymentOpen(
      false
    );

    setPaymentInvoice(
      null
    );
  }

  function handleCreateSaved(
    saved
  ) {
    loadInvoicingData();

    setSelectedInvoice(
      saved
    );

    setDetailOpen(
      true
    );

    window.history.pushState(
      {},
      "",
      "/invoicing/invoices"
    );

    window.dispatchEvent(
      new PopStateEvent(
        "popstate"
      )
    );
  }

  async function downloadInvoicePDF(
    invoice
  ) {
    try {
      const token =
        localStorage.getItem(
          "access_token"
        );

      const response =
        await fetch(
          `${API_BASE_URL}/api/invoicing/invoices/${invoice.id}/pdf/`,
          {
            headers: token
              ? {
                  Authorization:
                    `Bearer ${token}`,
                }
              : {},
          }
        );

      if (!response.ok) {
        let message =
          "Unable to download invoice PDF.";

        try {
          const data =
            await response.json();

          message =
            data?.detail ||
            message;
        } catch {
          // Keep default message.
        }

        throw new Error(
          message
        );
      }

      const blob =
        await response.blob();

      const url =
        window.URL.createObjectURL(
          blob
        );

      const anchor =
        document.createElement(
          "a"
        );

      anchor.href = url;

      anchor.download =
        `${invoice.invoice_number}.pdf`;

      document.body.appendChild(
        anchor
      );

      anchor.click();

      anchor.remove();

      window.URL.revokeObjectURL(
        url
      );
    } catch (error) {
      setPageError(
        errorMessage(error)
      );
    }
  }

  const workspaceInvoices = useMemo(
    () =>
      filterInvoicesByCurrency(
        invoices,
        currency
      ),
    [invoices, currency]
  );

  const workspacePayments = useMemo(
    () =>
      filterPaymentsByCurrency(
        payments,
        currency
      ),
    [payments, currency]
  );

  const outstandingAmount =
    workspaceInvoices.reduce(
      (sum, invoice) =>
        sum +
        Number(
          invoice.balance_due || 0
        ),
      0
    );

  const overdueAmount =
    workspaceInvoices
      .filter(
        (invoice) =>
          isInvoiceOverdue(
            invoice
          )
      )
      .reduce(
        (sum, invoice) =>
          sum +
          Number(
            invoice.balance_due ||
              0
          ),
        0
      );

  const sectionMeta = {
    invoices: {
      title: "Invoices",
      description:
        "Create, issue and manage customer invoices.",
    },

    create: {
      title: "Create Invoice",
      description:
        "Prepare a new customer invoice from a sale or manually.",
    },

    payments: {
      title: "Payments",
      description:
        "Record and review customer payments against invoices.",
    },

    statements: {
      title: "Invoice Statements",
      description:
        "Review customer invoice and payment history.",
    },
  };

  const meta =
    sectionMeta[
      currentSection
    ];

  return (
    <div className="invoicing-page">

      {/* =====================================================
          PAGE HEADER
      ====================================================== */}

      <div className="invoicing-page-header">
        <div>
          <div className="invoicing-breadcrumb">
            <span>
              Invoicing
            </span>

            <ChevronRight
              size={14}
            />

            <strong>
              {meta.title}
            </strong>
          </div>

          <h1>
            {meta.title}
          </h1>

          <p>
            {meta.description}
          </p>
        </div>

        <div className="invoicing-company-context">
          <span>
            Current Company
          </span>

          <strong>
            {currentCompany?.name ||
              "No company selected"}
          </strong>

          <small>
            Workspace currency: {currency}
            {currentCompany?.currency &&
              currentCompany.currency !== currency
              ? ` • Functional: ${currentCompany.currency}`
              : ""}
          </small>
        </div>
      </div>


      {/* =====================================================
          NAVIGATION
      ====================================================== */}

      <div className="invoicing-navigation">
        <NavLink
          to="/invoicing/invoices"
          className={({ isActive }) =>
            `invoicing-nav-item ${
              isActive
                ? "invoicing-nav-item-active"
                : ""
            }`
          }
        >
          <Receipt size={18} />

          <span>
            <strong>
              Invoices
            </strong>

            <small>
              Manage invoices
            </small>
          </span>
        </NavLink>

        <NavLink
          to="/invoicing/create"
          className={({ isActive }) =>
            `invoicing-nav-item ${
              isActive
                ? "invoicing-nav-item-active"
                : ""
            }`
          }
        >
          <Plus size={18} />

          <span>
            <strong>
              Create Invoice
            </strong>

            <small>
              New customer invoice
            </small>
          </span>
        </NavLink>

        <NavLink
          to="/invoicing/payments"
          className={({ isActive }) =>
            `invoicing-nav-item ${
              isActive
                ? "invoicing-nav-item-active"
                : ""
            }`
          }
        >
          <CreditCard size={18} />

          <span>
            <strong>
              Payments
            </strong>

            <small>
              Customer receipts
            </small>
          </span>
        </NavLink>

        <NavLink
          to="/invoicing/statements"
          className={({ isActive }) =>
            `invoicing-nav-item ${
              isActive
                ? "invoicing-nav-item-active"
                : ""
            }`
          }
        >
          <FileText size={18} />

          <span>
            <strong>
              Invoice Statements
            </strong>

            <small>
              Customer history
            </small>
          </span>
        </NavLink>
      </div>


      {/* =====================================================
          CONTEXT STRIP
      ====================================================== */}

      <div className="invoicing-context-strip">
        <div>
          <span>
            Company
          </span>

          <strong>
            {currentCompany?.name ||
              "—"}
          </strong>
        </div>

        <div className="invoicing-context-divider" />

        <div>
          <span>
            Workspace Currency
          </span>

          <strong>
            {currency}
          </strong>
        </div>

        <div className="invoicing-context-divider" />

        <div>
          <span>
            Invoices
          </span>

          <strong>
            {workspaceInvoices.length}
          </strong>
        </div>

        <div className="invoicing-context-divider" />

        <div>
          <span>
            Outstanding
          </span>

          <strong>
            {formatMoney(
              outstandingAmount,
              currency
            )}
          </strong>
        </div>

        <div className="invoicing-context-divider" />

        <div className="invoicing-context-warning">
          <span>
            Overdue
          </span>

          <strong>
            {formatMoney(
              overdueAmount,
              currency
            )}
          </strong>
        </div>
      </div>


      {/* =====================================================
          ERROR
      ====================================================== */}

      {pageError && (
        <div className="invoicing-page-error">
          <div>
            <AlertCircle
              size={19}
            />

            <div>
              <strong>
                Invoicing error
              </strong>

              <p>
                {pageError}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="invoicing-btn invoicing-btn-secondary"
            onClick={
              loadInvoicingData
            }
          >
            <RefreshCw
              size={16}
            />

            Try Again
          </button>
        </div>
      )}


      {/* =====================================================
          NO COMPANY
      ====================================================== */}

      {!companyId ? (
        <div className="invoicing-no-company">
          <div className="invoicing-empty-icon">
            <AlertCircle
              size={28}
            />
          </div>

          <h2>
            No Company Selected
          </h2>

          <p>
            Select a company before using the Invoicing module.
          </p>
        </div>
      ) : (
        <>
          {currentSection ===
            "invoices" && (
            <InvoiceListSection
              invoices={
                workspaceInvoices
              }
              customers={
                customers
              }
              loading={
                loading
              }
              currency={
                currency
              }
              search={
                invoiceSearch
              }
              setSearch={
                setInvoiceSearch
              }
              statusFilter={
                invoiceStatusFilter
              }
              setStatusFilter={
                setInvoiceStatusFilter
              }
              onRefresh={
                loadInvoicingData
              }
              onCreate={() =>
                window.history.pushState(
                  {},
                  "",
                  "/invoicing/create"
                ) ||
                window.dispatchEvent(
                  new PopStateEvent(
                    "popstate"
                  )
                )
              }
              onView={
                openInvoice
              }
              onIssue={
                issueInvoice
              }
              onPayment={
                openPayment
              }
              onDownload={
                downloadInvoicePDF
              }
            />
          )}

          {currentSection ===
            "create" && (
            <CreateInvoiceSection
              companyId={
                companyId
              }
              customers={
                customers
              }
              products={
                products
              }
              sales={
                sales
              }
              currency={
                currency
              }
              activeCurrencies={
                activeCurrencies
              }
              onSaved={
                handleCreateSaved
              }
              onCancel={() => {
                window.history.pushState(
                  {},
                  "",
                  "/invoicing/invoices"
                );

                window.dispatchEvent(
                  new PopStateEvent(
                    "popstate"
                  )
                );
              }}
            />
          )}

          {currentSection ===
            "payments" && (
            <PaymentsSection
              payments={
                workspacePayments
              }
              invoices={
                invoices
              }
              loading={
                loading
              }
              currency={
                currency
              }
              search={
                paymentSearch
              }
              setSearch={
                setPaymentSearch
              }
              onRefresh={
                loadInvoicingData
              }
              onRecord={() => {
                const availableInvoice =
                  invoices.find(
                    (invoice) =>
                      invoice.status !==
                        "DRAFT" &&
                      invoice.status !==
                        "PAID" &&
                      invoice.status !==
                        "VOIDED" &&
                      Number(
                        invoice.balance_due
                      ) > 0
                  );

                if (
                  availableInvoice
                ) {
                  openPayment(
                    availableInvoice
                  );
                } else {
                  setPageError(
                    "There are no invoices with an outstanding balance available for payment."
                  );
                }
              }}
            />
          )}

          {currentSection ===
            "statements" && (
            <StatementsSection
              invoices={
                workspaceInvoices
              }
              payments={
                workspacePayments
              }
              customers={
                customers
              }
              currency={
                currency
              }
            />
          )}
        </>
      )}


      {/* =====================================================
          INVOICE DETAIL
      ====================================================== */}

      <InvoiceDetailModal
        invoice={
          selectedInvoice
        }
        open={
          detailOpen
        }
        currency={
          currency
        }
        onClose={
          closeInvoice
        }
        onIssue={
          issueInvoice
        }
        onPayment={
          openPayment
        }
        onDownload={
          downloadInvoicePDF
        }
      />


      {/* =====================================================
          CUSTOMER PAYMENT
      ====================================================== */}

      <CustomerPaymentModal
        invoice={
          paymentInvoice
        }
        open={
          paymentOpen
        }
        currency={
          currency
        }
        workspaceCurrency={
          workspaceCurrency
        }
        activeCurrencies={
          activeCurrencies
        }
        exchangeRates={
          exchangeRates
        }
        onClose={
          closePayment
        }
        onSaved={
          async () => {
            await loadInvoicingData();

            closePayment();
          }
        }
      />
    </div>
  );
}

