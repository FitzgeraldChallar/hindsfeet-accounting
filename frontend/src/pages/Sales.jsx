import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  DollarSign,
  Edit3,
  FileText,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { NavLink, Navigate, useLocation } from "react-router-dom";

import { api } from "../services/api";
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

function generateSaleNumber() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `SALE-${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function getCurrencyCode(value) {
  const currency = String(value || "").toUpperCase();

  if (currency.includes("LRD")) return "LRD";
  if (currency.includes("USD")) return "USD";

  return "USD";
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

  if (typeof data === "string") return data;

  if (data && typeof data === "object") {
    const messages = [];

    Object.entries(data).forEach(([field, value]) => {
      if (Array.isArray(value)) {
        value.forEach((message) => {
          if (typeof message === "string") {
            messages.push(`${field}: ${message}`);
          }
        });
      } else if (typeof value === "string") {
        messages.push(`${field}: ${value}`);
      }
    });

    if (messages.length) return messages.join(" ");
  }

  return "Something went wrong while processing the request.";
}

function productTypeLabel(type) {
  const labels = {
    PRODUCT: "Product",
    SERVICE: "Service",
    FUEL: "Fuel",
  };

  return labels[type] || type || "—";
}

function paymentMethodLabel(method) {
  const labels = {
    CASH: "Cash",
    BANK: "Bank",
    MOBILE_MONEY: "Mobile Money",
    CARD: "Card",
    CREDIT: "Credit",
  };

  return labels[method] || method || "—";
}


// ============================================================
// SMALL UI COMPONENTS
// ============================================================

function StatCard({
  icon: Icon,
  label,
  value,
  helper,
}) {
  return (
    <div className="sales-stat-card">
      <div className="sales-stat-icon">
        <Icon size={21} strokeWidth={2} />
      </div>

      <div className="sales-stat-content">
        <span className="sales-stat-label">{label}</span>
        <strong className="sales-stat-value">{value}</strong>

        {helper && (
          <span className="sales-stat-helper">
            {helper}
          </span>
        )}
      </div>
    </div>
  );
}

function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  width = "720px",
}) {
  if (!open) return null;

  return (
    <div
      className="sales-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="sales-modal"
        style={{ maxWidth: width }}
      >
        <div className="sales-modal-header">
          <div>
            <h2>{title}</h2>

            {subtitle && (
              <p>{subtitle}</p>
            )}
          </div>

          <button
            type="button"
            className="sales-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="sales-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required = false,
  hint,
}) {
  return (
    <div className="sales-field">
      <label>
        {label}

        {required && (
          <span className="sales-required">*</span>
        )}
      </label>

      {children}

      {hint && (
        <span className="sales-field-hint">
          {hint}
        </span>
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
    <div className="sales-empty-state">
      <div className="sales-empty-icon">
        <Icon size={28} />
      </div>

      <h3>{title}</h3>

      <p>{description}</p>

      {action}
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toUpperCase();

  return (
    <span
      className={`sales-status-badge sales-status-${normalized.toLowerCase()}`}
    >
      {normalized === "COMPLETED" && (
        <CheckCircle2 size={13} />
      )}

      {normalized === "DRAFT" && (
        <FileText size={13} />
      )}

      {normalized === "VOIDED" && (
        <X size={13} />
      )}

      {status || "—"}
    </span>
  );
}


// ============================================================
// CUSTOMER SECTION
// ============================================================

function CustomersSection({
  customers,
  loading,
  search,
  setSearch,
  onRefresh,
  onCreate,
  onEdit,
}) {
  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return customers;

    return customers.filter((customer) =>
      [
        customer.name,
        customer.email,
        customer.phone,
        customer.tax_number,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        )
    );
  }, [customers, search]);

  const activeCustomers = customers.filter(
    (customer) => customer.is_active
  ).length;

  return (
    <>
      <div className="sales-stats-grid">
        <StatCard
          icon={Users}
          label="Total Customers"
          value={customers.length}
          helper="Customers in this company"
        />

        <StatCard
          icon={CheckCircle2}
          label="Active Customers"
          value={activeCustomers}
          helper="Currently available for sales"
        />

        <StatCard
          icon={User}
          label="Inactive Customers"
          value={customers.length - activeCustomers}
          helper="Inactive customer records"
        />
      </div>

      <div className="sales-panel">
        <div className="sales-panel-header">
          <div>
            <h2>Customers</h2>
            <p>
              Manage customers available to the sales and invoicing modules.
            </p>
          </div>

          <div className="sales-header-actions">
            <button
              type="button"
              className="sales-btn sales-btn-secondary"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={loading ? "sales-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              className="sales-btn sales-btn-primary"
              onClick={onCreate}
            >
              <Plus size={17} />
              Add Customer
            </button>
          </div>
        </div>

        <div className="sales-toolbar">
          <div className="sales-search-box">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <span className="sales-record-count">
            {filteredCustomers.length} customer
            {filteredCustomers.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="sales-loading">
            <RefreshCw
              size={22}
              className="sales-spin"
            />
            <span>Loading customers...</span>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={
              search
                ? "No customers found"
                : "No customers yet"
            }
            description={
              search
                ? "Try changing your search term."
                : "Create your first customer to start recording sales."
            }
            action={
              !search && (
                <button
                  type="button"
                  className="sales-btn sales-btn-primary"
                  onClick={onCreate}
                >
                  <Plus size={16} />
                  Add Customer
                </button>
              )
            }
          />
        ) : (
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Tax Number</th>
                  <th>Status</th>
                  <th className="sales-table-action-column">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="sales-primary-cell">
                        <div className="sales-avatar">
                          {String(customer.name || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>{customer.name}</strong>

                          {customer.address && (
                            <span>{customer.address}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>{customer.phone || "—"}</td>

                    <td>{customer.email || "—"}</td>

                    <td>{customer.tax_number || "—"}</td>

                    <td>
                      <span
                        className={
                          customer.is_active
                            ? "sales-active-badge"
                            : "sales-inactive-badge"
                        }
                      >
                        {customer.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="sales-icon-btn"
                        onClick={() => onEdit(customer)}
                        title="Edit customer"
                      >
                        <Edit3 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}


// ============================================================
// PRODUCT SECTION
// ============================================================

function ProductsSection({
  products,
  categories,
  loading,
  search,
  setSearch,
  onRefresh,
  onCreate,
  onEdit,
  onCreateCategory,
}) {
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return products;

    return products.filter((product) =>
      [
        product.code,
        product.name,
        product.product_type,
        product.description,
        product.unit,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        )
    );
  }, [products, search]);

  const activeProducts = products.filter(
    (product) => product.is_active
  ).length;

  const inventoryProducts = products.filter(
    (product) => product.track_inventory
  ).length;

  return (
    <>
      <div className="sales-stats-grid">
        <StatCard
          icon={Package}
          label="Products / Services"
          value={products.length}
          helper="Items available for sale"
        />

        <StatCard
          icon={CheckCircle2}
          label="Active Items"
          value={activeProducts}
          helper="Currently available"
        />

        <StatCard
          icon={ClipboardList}
          label="Inventory Tracked"
          value={inventoryProducts}
          helper="Items connected to inventory"
        />

        <StatCard
          icon={FileText}
          label="Categories"
          value={categories.length}
          helper="Product categories"
        />
      </div>

      <div className="sales-panel">
        <div className="sales-panel-header">
          <div>
            <h2>Products / Services</h2>
            <p>
              Manage products, services, pricing and inventory tracking.
            </p>
          </div>

          <div className="sales-header-actions">
            <button
              type="button"
              className="sales-btn sales-btn-secondary"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={loading ? "sales-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              className="sales-btn sales-btn-secondary"
              onClick={onCreateCategory}
            >
              <Plus size={16} />
              Category
            </button>

            <button
              type="button"
              className="sales-btn sales-btn-primary"
              onClick={onCreate}
            >
              <Plus size={17} />
              Add Product / Service
            </button>
          </div>
        </div>

        <div className="sales-toolbar">
          <div className="sales-search-box">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search products or services..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <span className="sales-record-count">
            {filteredProducts.length} item
            {filteredProducts.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="sales-loading">
            <RefreshCw
              size={22}
              className="sales-spin"
            />
            <span>Loading products...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            icon={Package}
            title={
              search
                ? "No items found"
                : "No products or services yet"
            }
            description={
              search
                ? "Try changing your search term."
                : "Add products or services that your company sells."
            }
            action={
              !search && (
                <button
                  type="button"
                  className="sales-btn sales-btn-primary"
                  onClick={onCreate}
                >
                  <Plus size={16} />
                  Add Product / Service
                </button>
              )
            }
          />
        ) : (
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Selling Price</th>
                  <th>Cost Price</th>
                  <th>Inventory</th>
                  <th>Status</th>
                  <th className="sales-table-action-column">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="sales-product-cell">
                        <div className="sales-product-icon">
                          <Package size={17} />
                        </div>

                        <div>
                          <strong>{product.name}</strong>

                          <span>
                            Code: {product.code || "—"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="sales-type-badge">
                        {productTypeLabel(
                          product.product_type
                        )}
                      </span>
                    </td>

                    <td>
                      {product.category_name ||
                        categories.find(
                          (category) =>
                            category.id === product.category
                        )?.name ||
                        "Uncategorized"}
                    </td>

                    <td>
                      {product.unit || "Unit"}
                    </td>

                    <td className="sales-money-cell">
                      {formatMoney(
                        product.selling_price
                      )}
                    </td>

                    <td className="sales-money-cell">
                      {formatMoney(
                        product.cost_price
                      )}
                    </td>

                    <td>
                      {product.track_inventory ? (
                        <div className="sales-inventory-cell">
                          <strong>
                            {formatNumber(
                              product.inventory
                                ?.quantity_on_hand
                            )}
                          </strong>

                          <span>
                            {product.unit || "units"}
                          </span>
                        </div>
                      ) : (
                        <span className="sales-not-tracked">
                          Not tracked
                        </span>
                      )}
                    </td>

                    <td>
                      <span
                        className={
                          product.is_active
                            ? "sales-active-badge"
                            : "sales-inactive-badge"
                        }
                      >
                        {product.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="sales-icon-btn"
                        onClick={() => onEdit(product)}
                        title="Edit product"
                      >
                        <Edit3 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}


// ============================================================
// SALES TRANSACTIONS SECTION
// ============================================================

function TransactionsSection({
  sales,
  loading,
  currency,
  search,
  setSearch,
  onRefresh,
  onCreate,
  onView,
  onEdit,
}) {
  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return sales;

    return sales.filter((sale) =>
      [
        sale.sale_number,
        sale.customer_name,
        sale.payment_method,
        sale.status,
        sale.notes,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        )
    );
  }, [sales, search]);

  const completedSales = sales.filter(
    (sale) => sale.status === "COMPLETED"
  );

  const totalRevenue = completedSales.reduce(
    (sum, sale) =>
      sum + Number(sale.total_amount || 0),
    0
  );

  const totalProfit = completedSales.reduce(
    (sum, sale) =>
      sum + Number(sale.gross_profit || 0),
    0
  );

  const averageSale =
    completedSales.length > 0
      ? totalRevenue / completedSales.length
      : 0;

  return (
    <>
      <div className="sales-stats-grid">
        <StatCard
          icon={ShoppingCart}
          label="Transactions"
          value={sales.length}
          helper="Recorded sales"
        />

        <StatCard
          icon={DollarSign}
          label="Sales Revenue"
          value={formatMoney(
            totalRevenue,
            currency
          )}
          helper="Completed sales"
        />

        <StatCard
          icon={CreditCard}
          label="Gross Profit"
          value={formatMoney(
            totalProfit,
            currency
          )}
          helper="From completed sales"
        />

        <StatCard
          icon={ClipboardList}
          label="Average Sale"
          value={formatMoney(
            averageSale,
            currency
          )}
          helper="Per completed transaction"
        />
      </div>

      <div className="sales-panel">
        <div className="sales-panel-header">
          <div>
            <h2>Sales Transactions</h2>
            <p>
              Record and review sales transactions for the selected company.
            </p>
          </div>

          <div className="sales-header-actions">
            <button
              type="button"
              className="sales-btn sales-btn-secondary"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={loading ? "sales-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              className="sales-btn sales-btn-primary"
              onClick={onCreate}
            >
              <Plus size={17} />
              New Sale
            </button>
          </div>
        </div>

        <div className="sales-toolbar">
          <div className="sales-search-box">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search sales..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <span className="sales-record-count">
            {filteredSales.length} transaction
            {filteredSales.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="sales-loading">
            <RefreshCw
              size={22}
              className="sales-spin"
            />
            <span>
              Loading sales transactions...
            </span>
          </div>
        ) : filteredSales.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title={
              search
                ? "No transactions found"
                : "No sales yet"
            }
            description={
              search
                ? "Try changing your search term."
                : "Create your first sale transaction."
            }
            action={
              !search && (
                <button
                  type="button"
                  className="sales-btn sales-btn-primary"
                  onClick={onCreate}
                >
                  <Plus size={16} />
                  New Sale
                </button>
              )
            }
          />
        ) : (
          <div className="sales-table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Sale Number</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Payment</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Profit</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <strong className="sales-sale-number">
                        {sale.sale_number}
                      </strong>
                    </td>

                    <td>
                      {formatDate(
                        sale.sale_date
                      )}
                    </td>

                    <td>
                      <div className="sales-customer-inline">
                        <User size={15} />

                        <span>
                          {sale.customer_name ||
                            "Walk-in Customer"}
                        </span>
                      </div>
                    </td>

                    <td>
                      {paymentMethodLabel(
                        sale.payment_method
                      )}
                    </td>

                    <td>
                      {sale.items?.length || 0}
                    </td>

                    <td className="sales-money-cell">
                      {formatMoney(
                        sale.total_amount,
                        currency
                      )}
                    </td>

                    <td className="sales-money-cell">
                      {formatMoney(
                        sale.gross_profit,
                        currency
                      )}
                    </td>

                    <td>
                      <StatusBadge
                        status={sale.status}
                      />
                    </td>

                    <td>
                      <div className="sales-table-actions">
                        <button
                          type="button"
                          className="sales-view-btn"
                          onClick={() =>
                            onView(sale)
                          }
                        >
                          View
                          <ChevronRight size={15} />
                        </button>

                        {sale.status !== "VOIDED" && (
                          <button
                            type="button"
                            className="sales-icon-btn"
                            onClick={() =>
                              onEdit(sale)
                            }
                            title="Edit sale"
                          >
                            <Edit3 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}


// ============================================================
// CUSTOMER FORM
// ============================================================

function CustomerFormModal({
  open,
  onClose,
  companyId,
  customer,
  onSaved,
}) {
  const editing = Boolean(customer);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    tax_number: "",
    is_active: true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setForm({
      name: customer?.name || "",
      email: customer?.email || "",
      phone: customer?.phone || "",
      address: customer?.address || "",
      tax_number: customer?.tax_number || "",
      is_active:
        customer?.is_active !== undefined
          ? customer.is_active
          : true,
    });

    setError("");
  }, [open, customer]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Customer name is required.");
      return;
    }

    if (!companyId) {
      setError(
        "No company is currently selected."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        company: companyId,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        tax_number: form.tax_number.trim(),
        is_active: form.is_active,
      };

      let saved;

      if (editing) {
        saved = await api.patch(
          `/api/invoicing/customers/${customer.id}/`,
          payload
        );
      } else {
        saved = await api.post(
          `/api/invoicing/customers/`,
          payload
        );
      }

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
      title={
        editing
          ? "Edit Customer"
          : "Add Customer"
      }
      subtitle={
        editing
          ? "Update the customer's information."
          : "Create a customer record for this company."
      }
    >
      {error && (
        <div className="sales-form-error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      <form
        className="sales-form"
        onSubmit={handleSubmit}
      >
        <div className="sales-form-grid">
          <Field
            label="Customer Name"
            required
          >
            <input
              type="text"
              value={form.name}
              onChange={(event) =>
                updateField(
                  "name",
                  event.target.value
                )
              }
              placeholder="e.g. John Doe"
              autoFocus
            />
          </Field>

          <Field label="Phone">
            <input
              type="text"
              value={form.phone}
              onChange={(event) =>
                updateField(
                  "phone",
                  event.target.value
                )
              }
              placeholder="e.g. 0777 123 456"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                updateField(
                  "email",
                  event.target.value
                )
              }
              placeholder="customer@example.com"
            />
          </Field>

          <Field label="Tax Number">
            <input
              type="text"
              value={form.tax_number}
              onChange={(event) =>
                updateField(
                  "tax_number",
                  event.target.value
                )
              }
              placeholder="Optional"
            />
          </Field>
        </div>

        <Field label="Address">
          <textarea
            rows="3"
            value={form.address}
            onChange={(event) =>
              updateField(
                "address",
                event.target.value
              )
            }
            placeholder="Customer address"
          />
        </Field>

        <label className="sales-checkbox-row">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) =>
              updateField(
                "is_active",
                event.target.checked
              )
            }
          />

          <span>
            <strong>Active customer</strong>
            <small>
              Keep this customer available for new transactions.
            </small>
          </span>
        </label>

        <div className="sales-form-actions">
          <button
            type="button"
            className="sales-btn sales-btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="sales-btn sales-btn-primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <RefreshCw
                  size={16}
                  className="sales-spin"
                />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                {editing
                  ? "Save Changes"
                  : "Create Customer"}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}


// ============================================================
// CATEGORY FORM
// ============================================================

function CategoryFormModal({
  open,
  onClose,
  companyId,
  onSaved,
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    is_active: true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setForm({
      name: "",
      description: "",
      is_active: true,
    });

    setError("");
  }, [open]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError(
        "Category name is required."
      );
      return;
    }

    if (!companyId) {
      setError(
        "No company is currently selected."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const saved = await api.post(
        `/api/operations/categories/`,
        {
          company: companyId,
          name: form.name.trim(),
          description:
            form.description.trim(),
          is_active: form.is_active,
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
      title="Add Product Category"
      subtitle="Create a category for products and inventory items."
      width="560px"
    >
      {error && (
        <div className="sales-form-error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      <form
        className="sales-form"
        onSubmit={handleSubmit}
      >
        <Field
          label="Category Name"
          required
        >
          <input
            type="text"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            placeholder="e.g. Building Materials"
            autoFocus
          />
        </Field>

        <Field label="Description">
          <textarea
            rows="3"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description:
                  event.target.value,
              }))
            }
            placeholder="Brief category description"
          />
        </Field>

        <label className="sales-checkbox-row">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                is_active:
                  event.target.checked,
              }))
            }
          />

          <span>
            <strong>Active category</strong>
            <small>
              Make this category available when creating products.
            </small>
          </span>
        </label>

        <div className="sales-form-actions">
          <button
            type="button"
            className="sales-btn sales-btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="sales-btn sales-btn-primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <RefreshCw
                  size={16}
                  className="sales-spin"
                />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                Create Category
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}


// ============================================================
// PRODUCT FORM
// ============================================================

function ProductFormModal({
  open,
  onClose,
  companyId,
  categories,
  product,
  onSaved,
  onCreateCategory,
}) {
  const editing = Boolean(product);

  const [form, setForm] = useState({
    category: "",
    code: "",
    name: "",
    product_type: "PRODUCT",
    description: "",
    unit: "Unit",
    selling_price: "",
    cost_price: "",
    inventory_quantity: "0",
    reorder_level: "0",
    track_inventory: true,
    is_active: true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setForm({
      category: product?.category
        ? String(product.category)
        : "",
      code: product?.code || "",
      name: product?.name || "",
      product_type:
        product?.product_type || "PRODUCT",
      description:
        product?.description || "",
      unit: product?.unit || "Unit",
      selling_price:
        product?.selling_price ?? "",
      cost_price:
        product?.cost_price ?? "",
      inventory_quantity:
        product?.inventory?.quantity_on_hand ??
        "0",
      reorder_level:
        product?.inventory?.reorder_level ??
        "0",
      track_inventory:
        product?.track_inventory !== undefined
          ? product.track_inventory
          : true,
      is_active:
        product?.is_active !== undefined
          ? product.is_active
          : true,
    });

    setError("");
  }, [open, product]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleTypeChange(value) {
    setForm((current) => ({
      ...current,
      product_type: value,
      track_inventory:
        value === "SERVICE"
          ? false
          : current.track_inventory,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!companyId) {
      setError(
        "No company is currently selected."
      );
      return;
    }

    if (!form.code.trim()) {
      setError(
        "Product/service code is required."
      );
      return;
    }

    if (!form.name.trim()) {
      setError(
        "Product/service name is required."
      );
      return;
    }

    if (form.selling_price === "") {
      setError(
        "Selling price is required."
      );
      return;
    }

    if (form.cost_price === "") {
      setError(
        "Cost price is required."
      );
      return;
    }

    if (
      form.track_inventory &&
      Number(form.inventory_quantity) < 0
    ) {
      setError(
        "Inventory quantity cannot be negative."
      );
      return;
    }

    if (
      form.track_inventory &&
      Number(form.reorder_level) < 0
    ) {
      setError(
        "Reorder level cannot be negative."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        company: companyId,
        category: form.category
          ? Number(form.category)
          : null,
        code: form.code.trim(),
        name: form.name.trim(),
        product_type: form.product_type,
        description:
          form.description.trim(),
        unit:
          form.unit.trim() || "Unit",
        selling_price:
          form.selling_price,
        cost_price:
          form.cost_price,
        track_inventory:
          form.product_type === "SERVICE"
            ? false
            : form.track_inventory,
        is_active: form.is_active,
      };

      if (form.track_inventory) {
        payload.inventory_quantity =
          form.inventory_quantity || "0";

        payload.reorder_level =
          form.reorder_level || "0";
      }

      let saved;

      if (editing) {
        saved = await api.patch(
          `/api/operations/products/${product.id}/`,
          payload
        );
      } else {
        saved = await api.post(
          `/api/operations/products/`,
          payload
        );
      }

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
      title={
        editing
          ? "Edit Product / Service"
          : "Add Product / Service"
      }
      subtitle={
        editing
          ? "Update item details, pricing and inventory settings."
          : "Create an item that can be used in sales transactions."
      }
      width="900px"
    >
      {error && (
        <div className="sales-form-error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      <form
        className="sales-form"
        onSubmit={handleSubmit}
      >
        <div className="sales-form-grid">
          <Field
            label="Code"
            required
          >
            <input
              type="text"
              value={form.code}
              onChange={(event) =>
                updateField(
                  "code",
                  event.target.value
                )
              }
              placeholder="e.g. CEMENT-001"
              autoFocus
            />
          </Field>

          <Field
            label="Name"
            required
          >
            <input
              type="text"
              value={form.name}
              onChange={(event) =>
                updateField(
                  "name",
                  event.target.value
                )
              }
              placeholder="e.g. 50kg Cement"
            />
          </Field>

          <Field
            label="Type"
            required
          >
            <select
              value={form.product_type}
              onChange={(event) =>
                handleTypeChange(
                  event.target.value
                )
              }
            >
              <option value="PRODUCT">
                Product
              </option>

              <option value="SERVICE">
                Service
              </option>

              <option value="FUEL">
                Fuel
              </option>
            </select>
          </Field>

          <Field label="Category">
            <div className="sales-inline-field">
              <select
                value={form.category}
                onChange={(event) =>
                  updateField(
                    "category",
                    event.target.value
                  )
                }
              >
                <option value="">
                  Uncategorized
                </option>

                {categories
                  .filter(
                    (category) =>
                      category.is_active
                  )
                  .map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
              </select>

              <button
                type="button"
                className="sales-small-btn"
                onClick={onCreateCategory}
                title="Create category"
              >
                <Plus size={15} />
              </button>
            </div>
          </Field>

          <Field label="Unit">
            <input
              type="text"
              value={form.unit}
              onChange={(event) =>
                updateField(
                  "unit",
                  event.target.value
                )
              }
              placeholder="e.g. bag, litre, piece"
            />
          </Field>

          <Field
            label="Selling Price"
            required
          >
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.selling_price}
              onChange={(event) =>
                updateField(
                  "selling_price",
                  event.target.value
                )
              }
              placeholder="0.00"
            />
          </Field>

          <Field
            label="Cost Price"
            required
          >
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.cost_price}
              onChange={(event) =>
                updateField(
                  "cost_price",
                  event.target.value
                )
              }
              placeholder="0.00"
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            rows="3"
            value={form.description}
            onChange={(event) =>
              updateField(
                "description",
                event.target.value
              )
            }
            placeholder="Describe this product or service"
          />
        </Field>

        <div className="sales-inventory-editor">
          <div className="sales-inventory-editor-header">
            <div>
              <h3>Inventory Settings</h3>
              <p>
                Set the quantity currently available and the level that should trigger replenishment.
              </p>
            </div>
          </div>

          <div className="sales-form-grid">
            <Field
              label={
                editing
                  ? "Current Inventory"
                  : "Opening Inventory"
              }
              hint={
                editing
                  ? "Changes are recorded as inventory adjustments."
                  : "Creates an opening inventory record."
              }
            >
              <input
                type="number"
                min="0"
                step="0.001"
                value={
                  form.inventory_quantity
                }
                disabled={
                  form.product_type ===
                  "SERVICE"
                }
                onChange={(event) =>
                  updateField(
                    "inventory_quantity",
                    event.target.value
                  )
                }
                placeholder="0.000"
              />
            </Field>

            <Field
              label="Reorder Level"
              hint="The quantity at which this item should be replenished."
            >
              <input
                type="number"
                min="0"
                step="0.001"
                value={form.reorder_level}
                disabled={
                  form.product_type ===
                  "SERVICE"
                }
                onChange={(event) =>
                  updateField(
                    "reorder_level",
                    event.target.value
                  )
                }
                placeholder="0.000"
              />
            </Field>
          </div>
        </div>

        <div className="sales-options-grid">
          <label className="sales-checkbox-row">
            <input
              type="checkbox"
              checked={form.track_inventory}
              disabled={
                form.product_type ===
                "SERVICE"
              }
              onChange={(event) =>
                updateField(
                  "track_inventory",
                  event.target.checked
                )
              }
            />

            <span>
              <strong>
                Track inventory
              </strong>

              <small>
                Automatically track quantities for this item.
              </small>
            </span>
          </label>

          <label className="sales-checkbox-row">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                updateField(
                  "is_active",
                  event.target.checked
                )
              }
            />

            <span>
              <strong>Active item</strong>

              <small>
                Make this item available for sales.
              </small>
            </span>
          </label>
        </div>

        <div className="sales-form-actions">
          <button
            type="button"
            className="sales-btn sales-btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="sales-btn sales-btn-primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <RefreshCw
                  size={16}
                  className="sales-spin"
                />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                {editing
                  ? "Save Product Changes"
                  : "Create Item"}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}


// ============================================================
// SALE FORM
// ============================================================

function SaleFormModal({
  open,
  onClose,
  companyId,
  customers,
  products,
  currency,
  sale,
  onSaved,
}) {
  const editing = Boolean(sale);

  const emptyItem = {
    product: "",
    quantity: "1",
    unit_price: "",
    unit_cost: "",
    discount: "0",
  };

  const [form, setForm] = useState({
    sale_number: generateSaleNumber(),
    sale_date: getToday(),
    customer_id: "",
    customer_name: "",
    payment_method: "CASH",
    discount: "0",
    notes: "",
    items: [emptyItem],
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    if (sale) {
      const matchingCustomer =
        customers.find(
          (customer) =>
            String(customer.name) ===
            String(sale.customer_name)
        );

      setForm({
        sale_number:
          sale.sale_number || "",
        sale_date:
          sale.sale_date || getToday(),
        customer_id:
          matchingCustomer?.id
            ? String(matchingCustomer.id)
            : "",
        customer_name:
          sale.customer_name || "",
        payment_method:
          sale.payment_method || "CASH",
        discount:
          sale.discount ?? "0",
        notes:
          sale.notes || "",
        items:
          sale.items?.length > 0
            ? sale.items.map((item) => ({
                product:
                  item.product
                    ? String(item.product)
                    : "",
                quantity:
                  item.quantity ?? "1",
                unit_price:
                  item.unit_price ?? "",
                unit_cost:
                  item.unit_cost ?? "",
                discount:
                  item.discount ?? "0",
              }))
            : [emptyItem],
      });
    } else {
      setForm({
        sale_number:
          generateSaleNumber(),
        sale_date: getToday(),
        customer_id: "",
        customer_name: "",
        payment_method: "CASH",
        discount: "0",
        notes: "",
        items: [emptyItem],
      });
    }

    setError("");
  }, [open, sale, customers]);

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateItem(index, field, value) {
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

  function handleProductChange(
    index,
    productId
  ) {
    const product = products.find(
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
                product: productId,
                unit_price:
                  product?.selling_price ??
                  "",
                unit_cost:
                  product?.cost_price ??
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
          quantity: "1",
          unit_price: "",
          unit_cost: "",
          discount: "0",
        },
      ],
    }));
  }

  function removeItem(index) {
    setForm((current) => {
      if (current.items.length === 1) {
        return current;
      }

      return {
        ...current,
        items: current.items.filter(
          (_, itemIndex) =>
            itemIndex !== index
        ),
      };
    });
  }

  function calculateLine(item) {
    const quantity = Number(
      item.quantity || 0
    );

    const unitPrice = Number(
      item.unit_price || 0
    );

    const discount = Number(
      item.discount || 0
    );

    const gross =
      quantity * unitPrice;

    return Math.max(
      gross - discount,
      0
    );
  }

  const itemsSubtotal =
    form.items.reduce(
      (sum, item) =>
        sum + calculateLine(item),
      0
    );

  const saleDiscount = Math.max(
    Number(form.discount || 0),
    0
  );

  const estimatedTotal =
    Math.max(
      itemsSubtotal -
        saleDiscount,
      0
    );

  function handleCustomerChange(
    customerId
  ) {
    const customer =
      customers.find(
        (item) =>
          String(item.id) ===
          String(customerId)
      );

    setForm((current) => ({
      ...current,
      customer_id: customerId,
      customer_name:
        customer?.name || "",
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!companyId) {
      setError(
        "No company is currently selected."
      );
      return;
    }

    if (!form.sale_number.trim()) {
      setError(
        "Sale number is required."
      );
      return;
    }

    if (!form.sale_date) {
      setError(
        "Sale date is required."
      );
      return;
    }

    if (form.items.length === 0) {
      setError(
        "At least one sale item is required."
      );
      return;
    }

    const invalidItem =
      form.items.some(
        (item) =>
          !item.product ||
          Number(item.quantity) <= 0 ||
          Number(item.unit_price) < 0 ||
          Number(item.unit_cost) < 0
      );

    if (invalidItem) {
      setError(
        "Please complete every sale item with a product, valid quantity and valid prices."
      );
      return;
    }

    if (Number(form.discount) < 0) {
      setError(
        "Sale discount cannot be negative."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        sale_number:
          form.sale_number.trim(),
        sale_date:
          form.sale_date,
        customer_name:
          form.customer_name.trim(),
        payment_method:
          form.payment_method,
        discount:
          form.discount || "0",
        notes:
          form.notes.trim(),
        items:
          form.items.map(
            (item) => ({
              product:
                Number(item.product),
              quantity:
                item.quantity,
              unit_price:
                item.unit_price,
              unit_cost:
                item.unit_cost,
              discount:
                item.discount || "0",
            })
          ),
      };

      let saved;

      if (editing) {
        saved = await api.patch(
          `/api/operations/sales/${sale.id}/`,
          payload
        );
      } else {
        saved = await api.post(
          `/api/operations/sales/create/`,
          {
            company: companyId,
            ...payload,
            complete: true,
          }
        );
      }

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
      title={
        editing
          ? "Edit Sale"
          : "Create Sale"
      }
      subtitle={
        editing
          ? "Update this transaction. The backend will reverse and reapply its accounting and inventory effects."
          : "Record a completed sales transaction."
      }
      width="1100px"
    >
      {error && (
        <div className="sales-form-error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {editing &&
        sale?.status ===
          "COMPLETED" && (
          <div className="sales-form-notice">
            <AlertCircle size={17} />
            <span>
              Editing a completed sale will update its inventory and accounting records through the backend.
            </span>
          </div>
        )}

      <form
        className="sales-form"
        onSubmit={handleSubmit}
      >
        <div className="sales-form-grid sales-sale-header-grid">
          <Field
            label="Sale Number"
            required
          >
            <input
              type="text"
              value={form.sale_number}
              onChange={(event) =>
                updateForm(
                  "sale_number",
                  event.target.value
                )
              }
            />
          </Field>

          <Field
            label="Sale Date"
            required
          >
            <input
              type="date"
              value={form.sale_date}
              onChange={(event) =>
                updateForm(
                  "sale_date",
                  event.target.value
                )
              }
            />
          </Field>

          <Field label="Customer">
            <select
              value={form.customer_id}
              onChange={(event) =>
                handleCustomerChange(
                  event.target.value
                )
              }
            >
              <option value="">
                Walk-in / Other Customer
              </option>

              {customers
                .filter(
                  (customer) =>
                    customer.is_active
                )
                .map((customer) => (
                  <option
                    key={customer.id}
                    value={customer.id}
                  >
                    {customer.name}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Payment Method">
            <select
              value={
                form.payment_method
              }
              onChange={(event) =>
                updateForm(
                  "payment_method",
                  event.target.value
                )
              }
            >
              <option value="CASH">
                Cash
              </option>

              <option value="BANK">
                Bank
              </option>

              <option value="MOBILE_MONEY">
                Mobile Money
              </option>

              <option value="CARD">
                Card
              </option>

              <option value="CREDIT">
                Credit
              </option>
            </select>
          </Field>
        </div>

        {!form.customer_id && (
          <Field
            label="Customer Name"
            hint="Leave blank if this is a walk-in customer."
          >
            <input
              type="text"
              value={
                form.customer_name
              }
              onChange={(event) =>
                updateForm(
                  "customer_name",
                  event.target.value
                )
              }
              placeholder="Optional customer name"
            />
          </Field>
        )}

        <div className="sales-items-section">
          <div className="sales-items-header">
            <div>
              <h3>Sale Items</h3>
              <p>
                Add the products or services included in this sale.
              </p>
            </div>

            <button
              type="button"
              className="sales-btn sales-btn-secondary"
              onClick={addItem}
            >
              <Plus size={16} />
              Add Item
            </button>
          </div>

          <div className="sales-line-items">
            {form.items.map(
              (item, index) => {
                const lineTotal =
                  calculateLine(item);

                return (
                  <div
                    className="sales-line-item"
                    key={`${index}-${item.product}`}
                  >
                    <div className="sales-line-number">
                      {index + 1}
                    </div>

                    <div className="sales-line-product">
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
                          handleProductChange(
                            index,
                            event.target.value
                          )
                        }
                      >
                        <option value="">
                          Select item
                        </option>

                        {products
                          .filter(
                            (product) =>
                              product.is_active
                          )
                          .map(
                            (product) => (
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

                    <div className="sales-line-small">
                      <label>Qty</label>

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
                            event.target.value
                          )
                        }
                      />
                    </div>

                    <div className="sales-line-small">
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
                            event.target.value
                          )
                        }
                      />
                    </div>

                    <div className="sales-line-small">
                      <label>
                        Unit Cost
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          item.unit_cost
                        }
                        onChange={(
                          event
                        ) =>
                          updateItem(
                            index,
                            "unit_cost",
                            event.target.value
                          )
                        }
                      />
                    </div>

                    <div className="sales-line-small">
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
                            event.target.value
                          )
                        }
                      />
                    </div>

                    <div className="sales-line-total">
                      <label>Total</label>

                      <strong>
                        {formatMoney(
                          lineTotal,
                          currency
                        )}
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="sales-line-delete"
                      onClick={() =>
                        removeItem(index)
                      }
                      disabled={
                        form.items.length ===
                        1
                      }
                      title="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              }
            )}
          </div>
        </div>

        <div className="sales-sale-bottom-grid">
          <Field label="Notes">
            <textarea
              rows="4"
              value={form.notes}
              onChange={(event) =>
                updateForm(
                  "notes",
                  event.target.value
                )
              }
              placeholder="Optional notes about this sale"
            />
          </Field>

          <div className="sales-summary-box">
            <div>
              <span>
                Items Subtotal
              </span>

              <strong>
                {formatMoney(
                  itemsSubtotal,
                  currency
                )}
              </strong>
            </div>

            <div className="sales-summary-input-row">
              <span>
                Sale Discount
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={form.discount}
                onChange={(event) =>
                  updateForm(
                    "discount",
                    event.target.value
                  )
                }
              />
            </div>

            <div className="sales-summary-total">
              <span>
                Estimated Total
              </span>

              <strong>
                {formatMoney(
                  estimatedTotal,
                  currency
                )}
              </strong>
            </div>

            <small>
              Final accounting totals are calculated by the backend.
            </small>
          </div>
        </div>

        <div className="sales-form-actions">
          <button
            type="button"
            className="sales-btn sales-btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="sales-btn sales-btn-primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <RefreshCw
                  size={16}
                  className="sales-spin"
                />
                {editing
                  ? "Updating Sale..."
                  : "Processing Sale..."}
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                {editing
                  ? "Save Sale Changes"
                  : "Complete Sale"}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}


// ============================================================
// SALE DETAIL MODAL
// ============================================================

function SaleDetailModal({
  sale,
  open,
  onClose,
  currency,
  products,
  onEdit,
}) {
  if (!sale) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Sale ${sale.sale_number}`}
      subtitle={`Recorded ${formatDate(
        sale.sale_date
      )}`}
      width="950px"
    >
      <div className="sales-detail-top">
        <div className="sales-detail-card">
          <span>Customer</span>
          <strong>
            {sale.customer_name ||
              "Walk-in Customer"}
          </strong>
        </div>

        <div className="sales-detail-card">
          <span>Payment</span>
          <strong>
            {paymentMethodLabel(
              sale.payment_method
            )}
          </strong>
        </div>

        <div className="sales-detail-card">
          <span>Status</span>
          <StatusBadge
            status={sale.status}
          />
        </div>

        <div className="sales-detail-card">
          <span>Total</span>
          <strong>
            {formatMoney(
              sale.total_amount,
              currency
            )}
          </strong>
        </div>
      </div>

      <div className="sales-detail-section">
        <div className="sales-detail-section-header">
          <div>
            <h3>Items</h3>
          </div>

          {sale.status !==
            "VOIDED" && (
            <button
              type="button"
              className="sales-btn sales-btn-secondary"
              onClick={() =>
                onEdit(sale)
              }
            >
              <Edit3 size={16} />
              Edit Sale
            </button>
          )}
        </div>

        <div className="sales-table-wrapper">
          <table className="sales-table sales-detail-table">
            <thead>
              <tr>
                <th>
                  Product / Service
                </th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Unit Cost</th>
                <th>Discount</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {(sale.items || []).map(
                (item) => {
                  const product =
                    products.find(
                      (candidate) =>
                        candidate.id ===
                        item.product
                    );

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="sales-primary-cell">
                          <div className="sales-product-icon">
                            <Package
                              size={16}
                            />
                          </div>

                          <div>
                            <strong>
                              {product?.name ||
                                `Product #${item.product}`}
                            </strong>

                            {product?.code && (
                              <span>
                                {
                                  product.code
                                }
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        {formatNumber(
                          item.quantity
                        )}
                      </td>

                      <td>
                        {formatMoney(
                          item.unit_price,
                          currency
                        )}
                      </td>

                      <td>
                        {formatMoney(
                          item.unit_cost,
                          currency
                        )}
                      </td>

                      <td>
                        {formatMoney(
                          item.discount,
                          currency
                        )}
                      </td>

                      <td className="sales-money-cell">
                        {formatMoney(
                          item.line_total,
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
      </div>

      <div className="sales-detail-summary">
        <div>
          <span>Subtotal</span>
          <strong>
            {formatMoney(
              sale.subtotal,
              currency
            )}
          </strong>
        </div>

        <div>
          <span>Discount</span>
          <strong>
            {formatMoney(
              sale.discount,
              currency
            )}
          </strong>
        </div>

        <div>
          <span>Total Cost</span>
          <strong>
            {formatMoney(
              sale.total_cost,
              currency
            )}
          </strong>
        </div>

        <div className="sales-profit-summary">
          <span>Gross Profit</span>
          <strong>
            {formatMoney(
              sale.gross_profit,
              currency
            )}
          </strong>
        </div>

        <div className="sales-grand-total">
          <span>Total Amount</span>
          <strong>
            {formatMoney(
              sale.total_amount,
              currency
            )}
          </strong>
        </div>
      </div>

      {sale.notes && (
        <div className="sales-detail-notes">
          <strong>Notes</strong>
          <p>{sale.notes}</p>
        </div>
      )}
    </Modal>
  );
}


// ============================================================
// MAIN SALES PAGE
// ============================================================

export default function Sales() {
  const location = useLocation();
  const { currentCompany } =
    useCompany();

  const companyId =
    currentCompany?.id;

  const currency =
    getCurrencyCode(
      currentCompany?.currency
    );

  const pathParts =
    location.pathname
      .split("/")
      .filter(Boolean);

  const currentSection =
    pathParts[1];

  const validSections = [
    "customers",
    "products",
    "transactions",
  ];

  if (
    !currentSection ||
    !validSections.includes(
      currentSection
    )
  ) {
    return (
      <Navigate
        to="/sales/customers"
        replace
      />
    );
  }

  const [customers, setCustomers] =
    useState([]);

  const [products, setProducts] =
    useState([]);

  const [categories, setCategories] =
    useState([]);

  const [sales, setSales] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [pageError, setPageError] =
    useState("");

  const [customerSearch, setCustomerSearch] =
    useState("");

  const [productSearch, setProductSearch] =
    useState("");

  const [salesSearch, setSalesSearch] =
    useState("");

  const [
    customerModalOpen,
    setCustomerModalOpen,
  ] = useState(false);

  const [
    selectedCustomer,
    setSelectedCustomer,
  ] = useState(null);

  const [
    categoryModalOpen,
    setCategoryModalOpen,
  ] = useState(false);

  const [
    productModalOpen,
    setProductModalOpen,
  ] = useState(false);

  const [
    selectedProduct,
    setSelectedProduct,
  ] = useState(null);

  const [
    saleModalOpen,
    setSaleModalOpen,
  ] = useState(false);

  const [
    selectedSale,
    setSelectedSale,
  ] = useState(null);

  async function loadSalesData() {
    if (!companyId) {
      setCustomers([]);
      setProducts([]);
      setCategories([]);
      setSales([]);
      return;
    }

    setLoading(true);
    setPageError("");

    try {
      const [
        customerResponse,
        productResponse,
        categoryResponse,
        salesResponse,
      ] = await Promise.all([
        api.get(
          `/api/invoicing/customers/?company=${companyId}`
        ),

        api.get(
          `/api/operations/products/?company=${companyId}`
        ),

        api.get(
          `/api/operations/categories/?company=${companyId}`
        ),

        api.get(
          `/api/operations/sales/?company=${companyId}`
        ),
      ]);

      setCustomers(
        getList(customerResponse)
      );

      setProducts(
        getList(productResponse)
      );

      setCategories(
        getList(categoryResponse)
      );

      setSales(
        getList(salesResponse)
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
    loadSalesData();
  }, [companyId]);

  async function handleCustomerSaved() {
    await loadSalesData();
  }

  async function handleCategorySaved() {
    await loadSalesData();
  }

  async function handleProductSaved() {
    await loadSalesData();
  }

  async function handleSaleSaved() {
    await loadSalesData();
  }

  function openCreateCustomer() {
    setSelectedCustomer(null);
    setCustomerModalOpen(true);
  }

  function openEditCustomer(
    customer
  ) {
    setSelectedCustomer(customer);
    setCustomerModalOpen(true);
  }

  function closeCustomerModal() {
    setCustomerModalOpen(false);
    setSelectedCustomer(null);
  }

  function openCreateProduct() {
    setSelectedProduct(null);
    setProductModalOpen(true);
  }

  function openEditProduct(
    product
  ) {
    setSelectedProduct(product);
    setProductModalOpen(true);
  }

  function closeProductModal() {
    setProductModalOpen(false);
    setSelectedProduct(null);
  }

  function openCategoryModal() {
    setCategoryModalOpen(true);
  }

  function closeCategoryModal() {
    setCategoryModalOpen(false);
  }

  function openCreateSale() {
    setSelectedSale(null);
    setSaleModalOpen(true);
  }

  function openEditSale(sale) {
    setSelectedSale(sale);
    setSaleModalOpen(true);
  }

  function closeSaleModal() {
    setSaleModalOpen(false);
    setSelectedSale(null);
  }

  function openSaleDetail(sale) {
    setSelectedSale(sale);
  }

  function closeSaleDetail() {
    setSelectedSale(null);
  }

  function handleEditFromDetail(
    sale
  ) {
    setSelectedSale(sale);
    setSaleModalOpen(true);
  }

  const activeCustomers =
    customers.filter(
      (customer) =>
        customer.is_active
    ).length;

  const activeProducts =
    products.filter(
      (product) =>
        product.is_active
    ).length;

  const completedSales =
    sales.filter(
      (sale) =>
        sale.status ===
        "COMPLETED"
    );

  const totalRevenue =
    completedSales.reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.total_amount || 0
        ),
      0
    );

  const sectionMeta = {
    customers: {
      title: "Customers",
      description:
        "Manage customers and customer information used throughout sales and invoicing.",
    },

    products: {
      title:
        "Products / Services",
      description:
        "Manage the products, services, pricing and inventory items your company sells.",
    },

    transactions: {
      title:
        "Sales Transactions",
      description:
        "Record, review and manage completed sales transactions.",
    },
  };

  const meta =
    sectionMeta[
      currentSection
    ];

  return (
    <div className="sales-page">

      {/* =====================================================
          PAGE HEADER
      ====================================================== */}

      <div className="sales-page-header">
        <div>
          <div className="sales-breadcrumb">
            <span>Sales</span>
            <ChevronRight size={14} />
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

        <div className="sales-company-context">
          <span>
            Current Company
          </span>

          <strong>
            {currentCompany?.name ||
              "No company selected"}
          </strong>
        </div>
      </div>


      {/* =====================================================
          SALES NAVIGATION
      ====================================================== */}

      <div className="sales-navigation">
        <NavLink
          to="/sales/customers"
          className={({ isActive }) =>
            `sales-nav-item ${
              isActive
                ? "sales-nav-item-active"
                : ""
            }`
          }
        >
          <Users size={18} />

          <span>
            <strong>
              Customers
            </strong>

            <small>
              Customer records
            </small>
          </span>
        </NavLink>

        <NavLink
          to="/sales/products"
          className={({ isActive }) =>
            `sales-nav-item ${
              isActive
                ? "sales-nav-item-active"
                : ""
            }`
          }
        >
          <Package size={18} />

          <span>
            <strong>
              Products / Services
            </strong>

            <small>
              Items and pricing
            </small>
          </span>
        </NavLink>

        <NavLink
          to="/sales/transactions"
          className={({ isActive }) =>
            `sales-nav-item ${
              isActive
                ? "sales-nav-item-active"
                : ""
            }`
          }
        >
          <ShoppingCart size={18} />

          <span>
            <strong>
              Sales Transactions
            </strong>

            <small>
              Record and review sales
            </small>
          </span>
        </NavLink>
      </div>


      {/* =====================================================
          COMPANY SUMMARY
      ====================================================== */}

      <div className="sales-context-strip">
        <div className="sales-context-item">
          <span>Company</span>

          <strong>
            {currentCompany?.name ||
              "—"}
          </strong>
        </div>

        <div className="sales-context-divider" />

        <div className="sales-context-item">
          <span>Currency</span>

          <strong>
            {currency}
          </strong>
        </div>

        <div className="sales-context-divider" />

        <div className="sales-context-item">
          <span>Customers</span>

          <strong>
            {activeCustomers}
          </strong>
        </div>

        <div className="sales-context-divider" />

        <div className="sales-context-item">
          <span>Active Items</span>

          <strong>
            {activeProducts}
          </strong>
        </div>

        <div className="sales-context-divider" />

        <div className="sales-context-item">
          <span>
            Completed Sales
          </span>

          <strong>
            {completedSales.length}
          </strong>
        </div>

        <div className="sales-context-divider" />

        <div className="sales-context-item sales-context-revenue">
          <span>Revenue</span>

          <strong>
            {formatMoney(
              totalRevenue,
              currency
            )}
          </strong>
        </div>
      </div>


      {/* =====================================================
          ERROR
      ====================================================== */}

      {pageError && (
        <div className="sales-page-error">
          <div>
            <AlertCircle size={19} />

            <div>
              <strong>
                Unable to load Sales data
              </strong>

              <p>
                {pageError}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="sales-btn sales-btn-secondary"
            onClick={
              loadSalesData
            }
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      )}


      {/* =====================================================
          CONTENT
      ====================================================== */}

      {!companyId ? (
        <div className="sales-no-company">
          <div className="sales-empty-icon">
            <AlertCircle size={28} />
          </div>

          <h2>
            No Company Selected
          </h2>

          <p>
            Select a company before using the Sales module.
          </p>
        </div>
      ) : (
        <>
          {currentSection ===
            "customers" && (
            <CustomersSection
              customers={customers}
              loading={loading}
              search={
                customerSearch
              }
              setSearch={
                setCustomerSearch
              }
              onRefresh={
                loadSalesData
              }
              onCreate={
                openCreateCustomer
              }
              onEdit={
                openEditCustomer
              }
            />
          )}

          {currentSection ===
            "products" && (
            <ProductsSection
              products={products}
              categories={categories}
              loading={loading}
              search={
                productSearch
              }
              setSearch={
                setProductSearch
              }
              onRefresh={
                loadSalesData
              }
              onCreate={
                openCreateProduct
              }
              onEdit={
                openEditProduct
              }
              onCreateCategory={
                openCategoryModal
              }
            />
          )}

          {currentSection ===
            "transactions" && (
            <TransactionsSection
              sales={sales}
              loading={loading}
              currency={currency}
              search={
                salesSearch
              }
              setSearch={
                setSalesSearch
              }
              onRefresh={
                loadSalesData
              }
              onCreate={
                openCreateSale
              }
              onView={
                openSaleDetail
              }
              onEdit={
                openEditSale
              }
            />
          )}
        </>
      )}


      {/* =====================================================
          CUSTOMER MODAL
      ====================================================== */}

      <CustomerFormModal
        open={
          customerModalOpen
        }
        onClose={
          closeCustomerModal
        }
        companyId={
          companyId
        }
        customer={
          selectedCustomer
        }
        onSaved={
          handleCustomerSaved
        }
      />


      {/* =====================================================
          CATEGORY MODAL
      ====================================================== */}

      <CategoryFormModal
        open={
          categoryModalOpen
        }
        onClose={
          closeCategoryModal
        }
        companyId={
          companyId
        }
        onSaved={
          handleCategorySaved
        }
      />


      {/* =====================================================
          PRODUCT MODAL
      ====================================================== */}

      <ProductFormModal
        open={
          productModalOpen
        }
        onClose={
          closeProductModal
        }
        companyId={
          companyId
        }
        categories={
          categories
        }
        product={
          selectedProduct
        }
        onSaved={
          handleProductSaved
        }
        onCreateCategory={
          openCategoryModal
        }
      />


      {/* =====================================================
          SALE MODAL
      ====================================================== */}

      <SaleFormModal
        open={
          saleModalOpen
        }
        onClose={
          closeSaleModal
        }
        companyId={
          companyId
        }
        customers={
          customers
        }
        products={
          products
        }
        currency={
          currency
        }
        sale={
          selectedSale
        }
        onSaved={
          handleSaleSaved
        }
      />


      {/* =====================================================
          SALE DETAIL
      ====================================================== */}

      {!saleModalOpen && (
        <SaleDetailModal
          sale={
            selectedSale
          }
          open={
            Boolean(
              selectedSale
            )
          }
          onClose={
            closeSaleDetail
          }
          currency={
            currency
          }
          products={
            products
          }
          onEdit={
            handleEditFromDetail
          }
        />
      )}
    </div>
  );
}

