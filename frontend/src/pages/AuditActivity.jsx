import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertCircle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileBarChart,
  FileText,
  Fuel,
  Landmark,
  Package,
  Receipt,
  RefreshCw,
  Search,
  ShoppingCart,
  UserRound,
  Wallet,
  X,
} from "lucide-react";

import { api } from "../services/api";
import { useCompany } from "../context/CompanyContext";


// ============================================================
// HELPERS
// ============================================================

function extractList(response) {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  if (Array.isArray(response?.records)) {
    return response.records;
  }

  if (Array.isArray(response?.accounts)) {
    return response.accounts;
  }

  return [];
}


function number(value) {
  return Number(value || 0);
}


function formatMoney(value, currency = "USD") {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number(value))} ${currency}`;
}


function formatDate(value) {
  if (!value) return "—";

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


function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}


function getCreatedByName(item) {
  const user =
    item?.created_by ||
    item?.user ||
    item?.createdBy;

  if (user && typeof user === "object") {
    return (
      user.full_name ||
      user.username ||
      [
        user.first_name,
        user.last_name,
      ]
        .filter(Boolean)
        .join(" ") ||
      "System User"
    );
  }

  return (
    item?.created_by_name ||
    item?.username ||
    "System User"
  );
}


function getActivityDate(item) {
  return (
    item?.created_at ||
    item?.updated_at ||
    item?.transaction_date ||
    item?.sale_date ||
    item?.payment_date ||
    item?.bill_date ||
    item?.invoice_date ||
    item?.date ||
    null
  );
}


function getActivityType(item) {
  return (
    item?.activity_type ||
    item?.transaction_type ||
    item?.status ||
    ""
  );
}


function getStatusClass(status) {
  const value = String(status || "")
    .toLowerCase()
    .replace(/_/g, "-");

  return `audit-status audit-status-${value}`;
}


function errorMessage(error) {
  const data = error?.data;

  if (data?.detail) {
    return data.detail;
  }

  if (data?.message) {
    return data.message;
  }

  return (
    error?.message ||
    "Unable to load activity."
  );
}


// ============================================================
// ACTIVITY BUILDERS
// ============================================================

function buildJournalActivities(items) {
  return items.map((item) => ({
    id: `journal-${item.id}`,
    sourceId: item.id,
    module: "Accounting",
    category: "Journal Entry",
    title:
      item.description ||
      item.reference ||
      `Journal Entry #${item.id}`,
    description: item.reference
      ? `Reference: ${item.reference}`
      : "Accounting journal entry",
    status: item.status || "POSTED",
    date: getActivityDate(item),
    user: getCreatedByName(item),
    icon: FileText,
    tone: "accounting",
    amount: item.total_debit,
    currency: null,
    raw: item,
  }));
}


function buildSalesActivities(items) {
  return items.map((item) => ({
    id: `sale-${item.id}`,
    sourceId: item.id,
    module: "Sales",
    category: "Sale",
    title:
      item.sale_number ||
      `Sale #${item.id}`,
    description:
      item.customer_name ||
      item.customer?.name ||
      "Sales transaction",
    status: item.status || "COMPLETED",
    date: getActivityDate(item),
    user: getCreatedByName(item),
    icon: ShoppingCart,
    tone: "sales",
    amount:
      item.total_amount ??
      item.amount ??
      0,
    currency: null,
    raw: item,
  }));
}


function buildInvoiceActivities(items) {
  return items.map((item) => ({
    id: `invoice-${item.id}`,
    sourceId: item.id,
    module: "Invoicing",
    category: "Invoice",
    title:
      item.invoice_number ||
      `Invoice #${item.id}`,
    description:
      item.customer_name ||
      item.customer?.name ||
      "Customer invoice",
    status: item.status || "ISSUED",
    date: getActivityDate(item),
    user: getCreatedByName(item),
    icon: Receipt,
    tone: "invoicing",
    amount:
      item.total_amount ??
      item.amount ??
      0,
    currency: null,
    raw: item,
  }));
}


function buildCustomerPaymentActivities(items) {
  return items.map((item) => ({
    id: `customer-payment-${item.id}`,
    sourceId: item.id,
    module: "Accounts Receivable",
    category: "Customer Payment",
    title:
      item.invoice_number ||
      item.invoice?.invoice_number ||
      `Customer Payment #${item.id}`,
    description:
      item.payment_method
        ? `${item.payment_method.replace(
            /_/g,
            " "
          )} payment received`
        : "Customer payment received",
    status: "POSTED",
    date: getActivityDate(item),
    user: getCreatedByName(item),
    icon: Wallet,
    tone: "receivable",
    amount: item.amount,
    currency: null,
    raw: item,
  }));
}


function buildSupplierBillActivities(items) {
  return items.map((item) => ({
    id: `supplier-bill-${item.id}`,
    sourceId: item.id,
    module: "Accounts Payable",
    category: "Supplier Bill",
    title:
      item.bill_number ||
      `Supplier Bill #${item.id}`,
    description:
      item.supplier_name ||
      item.supplier?.name ||
      "Supplier bill",
    status: item.status || "POSTED",
    date: getActivityDate(item),
    user: getCreatedByName(item),
    icon: ClipboardList,
    tone: "payable",
    amount:
      item.total_amount ??
      item.amount ??
      0,
    currency: null,
    raw: item,
  }));
}


function buildSupplierPaymentActivities(items) {
  return items.map((item) => ({
    id: `supplier-payment-${item.id}`,
    sourceId: item.id,
    module: "Accounts Payable",
    category: "Supplier Payment",
    title:
      item.bill_number ||
      item.supplier_name ||
      `Supplier Payment #${item.id}`,
    description:
      item.payment_method
        ? `${item.payment_method.replace(
            /_/g,
            " "
          )} supplier payment`
        : "Supplier payment",
    status: "POSTED",
    date: getActivityDate(item),
    user: getCreatedByName(item),
    icon: Banknote,
    tone: "payable",
    amount: item.amount,
    currency: null,
    raw: item,
  }));
}


function buildInventoryActivities(items) {
  return items.map((item) => ({
    id: `inventory-${item.id}`,
    sourceId: item.id,
    module: "Inventory",
    category: "Inventory Movement",
    title:
      item.product_name ||
      item.product?.name ||
      `Inventory Transaction #${item.id}`,
    description:
      item.transaction_type
        ? item.transaction_type.replace(
            /_/g,
            " "
          )
        : "Inventory movement",
    status: item.transaction_type || "COMPLETED",
    date: getActivityDate(item),
    user: getCreatedByName(item),
    icon: Package,
    tone: "inventory",
    amount:
      item.quantity ??
      0,
    currency: null,
    raw: item,
  }));
}


function buildBankingActivities(items) {
  return items.map((item) => ({
    id: `banking-${item.id}`,
    sourceId: item.id,
    module: "Banking",
    category: "Bank Transaction",
    title:
      item.transaction_type
        ? item.transaction_type.replace(
            /_/g,
            " "
          )
        : `Bank Transaction #${item.id}`,
    description:
      item.description ||
      item.reference ||
      item.bank_account_name ||
      item.bank_account?.account_name ||
      "Banking transaction",
    status: "POSTED",
    date: getActivityDate(item),
    user: getCreatedByName(item),
    icon: Landmark,
    tone: "banking",
    amount: item.amount,
    currency:
      item.currency ||
      item.bank_account?.currency ||
      null,
    raw: item,
  }));
}


function buildPayrollActivities(items) {
  return items.map((item) => ({
    id: `payroll-${item.id}`,
    sourceId: item.id,
    module: "Payroll",
    category: "Payroll Period",
    title:
      item.name ||
      `Payroll Period #${item.id}`,
    description:
      item.pay_date
        ? `Pay date: ${formatDate(
            item.pay_date
          )}`
        : "Payroll period activity",
    status: item.status || "DRAFT",
    date:
      item.updated_at ||
      item.created_at ||
      item.pay_date,
    user: getCreatedByName(item),
    icon: CalendarDays,
    tone: "payroll",
    amount: null,
    currency: null,
    raw: item,
  }));
}


function buildGasActivities(items) {
  return items.map((item) => ({
    id: `gas-${item.id}`,
    sourceId: item.id,
    module: "Gas Operations",
    category: "Pump Sale",
    title:
      item.fuel_product_name ||
      item.fuel_product?.name ||
      `Pump Sale #${item.id}`,
    description:
      item.pump_number ||
      item.pump?.pump_number
        ? `Pump ${
            item.pump_number ||
            item.pump?.pump_number
          }`
        : "Fuel pump transaction",
    status: item.status || "COMPLETED",
    date: getActivityDate(item),
    user: getCreatedByName(item),
    icon: Fuel,
    tone: "gas",
    amount:
      item.total_amount ??
      item.amount ??
      0,
    currency: null,
    raw: item,
  }));
}


// ============================================================
// COMPONENT
// ============================================================

export default function AuditActivity() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;
  const companyName =
    currentCompany?.name ||
    "No company selected";
  const currency =
    currentCompany?.currency ||
    "USD";

  const [activities, setActivities] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [moduleFilter, setModuleFilter] =
    useState("ALL");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [selectedActivity, setSelectedActivity] =
    useState(null);


  // ============================================================
  // LOAD ACTIVITY
  // ============================================================

  const loadActivity = useCallback(
    async (refresh = false) => {
      if (!companyId) {
        setActivities([]);
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

        /*
         * Promise.allSettled is intentional.
         *
         * One optional module should not prevent
         * the rest of the activity feed from loading.
         */
        const results =
          await Promise.allSettled([
            api.get(
              `/api/accounting/journal-entries/?company=${companyId}`
            ),

            api.get(
              `/api/operations/sales/?company=${companyId}`
            ),

            api.get(
              `/api/invoicing/invoices/?company=${companyId}`
            ),

            api.get(
              `/api/invoicing/customer-payments/?company=${companyId}`
            ),

            api.get(
              `/api/invoicing/supplier-bills/?company=${companyId}`
            ),

            api.get(
              `/api/invoicing/supplier-payments/?company=${companyId}`
            ),

            api.get(
              `/api/operations/inventory/?company=${companyId}`
            ),

            api.get(
              `/api/banking/transactions/?company=${companyId}`
            ),

            api.get(
              `/api/payroll/periods/?company=${companyId}`
            ),

            api.get(
              `/api/operations/pump-sales/?company=${companyId}`
            ),
          ]);


        const [
          journalResult,
          salesResult,
          invoiceResult,
          customerPaymentResult,
          supplierBillResult,
          supplierPaymentResult,
          inventoryResult,
          bankingResult,
          payrollResult,
          gasResult,
        ] = results;


        const nextActivities = [];


        if (
          journalResult.status ===
          "fulfilled"
        ) {
          nextActivities.push(
            ...buildJournalActivities(
              extractList(
                journalResult.value
              )
            )
          );
        }


        if (
          salesResult.status ===
          "fulfilled"
        ) {
          nextActivities.push(
            ...buildSalesActivities(
              extractList(
                salesResult.value
              )
            )
          );
        }


        if (
          invoiceResult.status ===
          "fulfilled"
        ) {
          nextActivities.push(
            ...buildInvoiceActivities(
              extractList(
                invoiceResult.value
              )
            )
          );
        }


        if (
          customerPaymentResult.status ===
          "fulfilled"
        ) {
          nextActivities.push(
            ...buildCustomerPaymentActivities(
              extractList(
                customerPaymentResult.value
              )
            )
          );
        }


        if (
          supplierBillResult.status ===
          "fulfilled"
        ) {
          nextActivities.push(
            ...buildSupplierBillActivities(
              extractList(
                supplierBillResult.value
              )
            )
          );
        }


        if (
          supplierPaymentResult.status ===
          "fulfilled"
        ) {
          nextActivities.push(
            ...buildSupplierPaymentActivities(
              extractList(
                supplierPaymentResult.value
              )
            )
          );
        }


        if (
          inventoryResult.status ===
          "fulfilled"
        ) {
          nextActivities.push(
            ...buildInventoryActivities(
              extractList(
                inventoryResult.value
              )
            )
          );
        }


        if (
          bankingResult.status ===
          "fulfilled"
        ) {
          nextActivities.push(
            ...buildBankingActivities(
              extractList(
                bankingResult.value
              )
            )
          );
        }


        if (
          payrollResult.status ===
          "fulfilled"
        ) {
          nextActivities.push(
            ...buildPayrollActivities(
              extractList(
                payrollResult.value
              )
            )
          );
        }


        if (
          gasResult.status ===
          "fulfilled"
        ) {
          nextActivities.push(
            ...buildGasActivities(
              extractList(
                gasResult.value
              )
            )
          );
        }


        nextActivities.sort(
          (a, b) => {
            const first = new Date(
              a.date || 0
            ).getTime();

            const second = new Date(
              b.date || 0
            ).getTime();

            return second - first;
          }
        );


        setActivities(
          nextActivities
        );


        /*
         * Only surface an error when all
         * activity sources failed.
         */
        const failedCount =
          results.filter(
            (result) =>
              result.status ===
              "rejected"
          ).length;

        if (
          failedCount ===
          results.length
        ) {
          throw new Error(
            "Unable to load activity from the available modules."
          );
        }
      } catch (err) {
        setActivities([]);

        setError(
          errorMessage(err)
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [companyId]
  );


  useEffect(() => {
    loadActivity();
  }, [loadActivity]);


  // ============================================================
  // FILTERS
  // ============================================================

  const modules = useMemo(() => {
    return [
      "Accounting",
      "Sales",
      "Invoicing",
      "Accounts Receivable",
      "Accounts Payable",
      "Inventory",
      "Banking",
      "Payroll",
      "Gas Operations",
    ].filter((module) =>
      activities.some(
        (activity) =>
          activity.module === module
      )
    );
  }, [activities]);


  const filteredActivities =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return activities.filter(
        (activity) => {
          const searchText = [
            activity.module,
            activity.category,
            activity.title,
            activity.description,
            activity.user,
            activity.status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !query ||
            searchText.includes(query);

          const matchesModule =
            moduleFilter === "ALL" ||
            activity.module ===
              moduleFilter;

          const matchesStatus =
            statusFilter === "ALL" ||
            String(activity.status)
              .toUpperCase() ===
              String(statusFilter)
                .toUpperCase();

          return (
            matchesSearch &&
            matchesModule &&
            matchesStatus
          );
        }
      );
    }, [
      activities,
      search,
      moduleFilter,
      statusFilter,
    ]);


  // ============================================================
  // STATISTICS
  // ============================================================

  const statistics =
    useMemo(() => {
      const today = new Date();

      const todayCount =
        activities.filter(
          (activity) => {
            if (!activity.date) {
              return false;
            }

            const date = new Date(
              activity.date
            );

            return (
              date.toDateString() ===
              today.toDateString()
            );
          }
        ).length;


      const postedCount =
        activities.filter(
          (activity) =>
            [
              "POSTED",
              "COMPLETED",
              "PAID",
              "ISSUED",
              "APPROVED",
              "LOCKED",
            ].includes(
              String(
                activity.status
              ).toUpperCase()
            )
        ).length;


      const modulesCount =
        new Set(
          activities.map(
            (activity) =>
              activity.module
          )
        ).size;


      return {
        total: activities.length,
        today: todayCount,
        posted: postedCount,
        modules: modulesCount,
      };
    }, [activities]);


  // ============================================================
  // EMPTY COMPANY
  // ============================================================

  if (!companyId) {
    return (
      <div className="audit-page">
        <div className="audit-empty-company">
          <div className="audit-empty-icon">
            <Activity size={28} />
          </div>

          <h2>
            No Company Selected
          </h2>

          <p>
            Select a company to view
            its activity and audit
            information.
          </p>
        </div>
      </div>
    );
  }


  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="audit-page">

      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="audit-page-header">
        <div>
          <div className="audit-eyebrow">
            AUDIT / ACTIVITY
          </div>

          <h1>
            Audit & Activity
          </h1>

          <p>
            Review recent financial and
            operational activity for
            the selected company.
          </p>
        </div>

        <button
          type="button"
          className="audit-refresh-button"
          onClick={() =>
            loadActivity(true)
          }
          disabled={refreshing}
        >
          <RefreshCw
            size={16}
            className={
              refreshing
                ? "audit-spin"
                : ""
            }
          />

          Refresh Activity
        </button>
      </div>


      {/* ======================================================
          COMPANY STRIP
          ====================================================== */}

      <div className="audit-company-strip">
        <div className="audit-company-mark">
          {companyName
            .slice(0, 1)
            .toUpperCase()}
        </div>

        <div className="audit-company-info">
          <span>
            Current Company
          </span>

          <strong>
            {companyName}
          </strong>
        </div>

        <div className="audit-company-meta">
          <span>Currency</span>
          <strong>
            {currency}
          </strong>
        </div>
      </div>


      {/* ======================================================
          ERROR
          ====================================================== */}

      {error && (
        <div className="audit-alert audit-alert-error">
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


      {/* ======================================================
          KPI CARDS
          ====================================================== */}

      <div className="audit-kpi-grid">

        <div className="audit-kpi-card">
          <div className="audit-kpi-icon audit-kpi-blue">
            <Activity size={19} />
          </div>

          <div>
            <span>
              Total Activities
            </span>

            <strong>
              {statistics.total}
            </strong>

            <small>
              Across available modules
            </small>
          </div>
        </div>


        <div className="audit-kpi-card">
          <div className="audit-kpi-icon audit-kpi-gold">
            <CalendarDays size={19} />
          </div>

          <div>
            <span>
              Today's Activity
            </span>

            <strong>
              {statistics.today}
            </strong>

            <small>
              Recorded today
            </small>
          </div>
        </div>


        <div className="audit-kpi-card">
          <div className="audit-kpi-icon audit-kpi-navy">
            <CheckCircle2 size={19} />
          </div>

          <div>
            <span>
              Completed / Posted
            </span>

            <strong>
              {statistics.posted}
            </strong>

            <small>
              Finalized transactions
            </small>
          </div>
        </div>


        <div className="audit-kpi-card">
          <div className="audit-kpi-icon audit-kpi-dark">
            <FileBarChart size={19} />
          </div>

          <div>
            <span>
              Active Modules
            </span>

            <strong>
              {statistics.modules}
            </strong>

            <small>
              Reporting activity
            </small>
          </div>
        </div>

      </div>


      {/* ======================================================
          ACTIVITY PANEL
          ====================================================== */}

      <section className="audit-panel">

        <div className="audit-panel-header">
          <div>
            <div className="audit-section-label">
              ACTIVITY REGISTER
            </div>

            <h2>
              Recent Activity
            </h2>

            <p>
              Financial and operational
              events recorded across
              the company.
            </p>
          </div>

          <div className="audit-panel-count">
            {filteredActivities.length}{" "}
            record
            {filteredActivities.length ===
            1
              ? ""
              : "s"}
          </div>
        </div>


        {/* ====================================================
            FILTER TOOLBAR
            ==================================================== */}

        <div className="audit-toolbar">

          <div className="audit-search">
            <Search size={16} />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search activity, reference, module or user..."
            />
          </div>


          <select
            value={moduleFilter}
            onChange={(event) =>
              setModuleFilter(
                event.target.value
              )
            }
          >
            <option value="ALL">
              All Modules
            </option>

            {modules.map(
              (module) => (
                <option
                  key={module}
                  value={module}
                >
                  {module}
                </option>
              )
            )}
          </select>


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

            <option value="POSTED">
              Posted
            </option>

            <option value="COMPLETED">
              Completed
            </option>

            <option value="ISSUED">
              Issued
            </option>

            <option value="PAID">
              Paid
            </option>

            <option value="APPROVED">
              Approved
            </option>

            <option value="LOCKED">
              Locked
            </option>

            <option value="DRAFT">
              Draft
            </option>
          </select>

        </div>


        {/* ====================================================
            ACTIVITY TABLE
            ==================================================== */}

        <div className="audit-table-wrapper">

          {loading ? (
            <div className="audit-loading">
              <RefreshCw
                size={23}
                className="audit-spin"
              />

              <span>
                Loading activity...
              </span>
            </div>
          ) : filteredActivities.length ===
            0 ? (
            <div className="audit-empty">
              <div className="audit-empty-icon">
                <Activity size={25} />
              </div>

              <h3>
                No activity found
              </h3>

              <p>
                {search ||
                moduleFilter !==
                  "ALL" ||
                statusFilter !==
                  "ALL"
                  ? "Try changing your search or filters."
                  : "Activity will appear here as transactions and operations are recorded."}
              </p>
            </div>
          ) : (
            <table className="audit-table">

              <thead>
                <tr>
                  <th>
                    Activity
                  </th>

                  <th>
                    Module
                  </th>

                  <th>
                    User
                  </th>

                  <th>
                    Date & Time
                  </th>

                  <th>
                    Amount
                  </th>

                  <th>
                    Status
                  </th>

                  <th />
                </tr>
              </thead>


              <tbody>

                {filteredActivities.map(
                  (activity) => {
                    const Icon =
                      activity.icon;

                    return (
                      <tr
                        key={
                          activity.id
                        }
                      >

                        <td>
                          <div className="audit-activity-cell">

                            <div
                              className={`audit-activity-icon audit-tone-${activity.tone}`}
                            >
                              <Icon
                                size={16}
                              />
                            </div>

                            <div>
                              <strong>
                                {
                                  activity.title
                                }
                              </strong>

                              <span>
                                {
                                  activity.description
                                }
                              </span>
                            </div>

                          </div>
                        </td>


                        <td>
                          <div className="audit-module-cell">
                            <strong>
                              {
                                activity.category
                              }
                            </strong>

                            <span>
                              {
                                activity.module
                              }
                            </span>
                          </div>
                        </td>


                        <td>
                          <div className="audit-user-cell">
                            <div className="audit-user-avatar">
                              <UserRound
                                size={14}
                              />
                            </div>

                            <span>
                              {
                                activity.user
                              }
                            </span>
                          </div>
                        </td>


                        <td>
                          <div className="audit-date-cell">
                            <strong>
                              {formatDate(
                                activity.date
                              )}
                            </strong>

                            <span>
                              {formatDateTime(
                                activity.date
                              )}
                            </span>
                          </div>
                        </td>


                        <td>
                          {activity.amount !==
                          null &&
                          activity.amount !==
                          undefined ? (
                            <strong className="audit-amount">
                              {formatMoney(
                                activity.amount,
                                activity.currency ||
                                  currency
                              )}
                            </strong>
                          ) : (
                            <span className="audit-muted">
                              —
                            </span>
                          )}
                        </td>


                        <td>
                          <span
                            className={getStatusClass(
                              activity.status
                            )}
                          >
                            {String(
                              activity.status ||
                                "Activity"
                            ).replace(
                              /_/g,
                              " "
                            )}
                          </span>
                        </td>


                        <td>
                          <button
                            type="button"
                            className="audit-view-button"
                            onClick={() =>
                              setSelectedActivity(
                                activity
                              )
                            }
                          >
                            View
                          </button>
                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>
          )}

        </div>

      </section>


      {/* ======================================================
          ACTIVITY DETAIL MODAL
          ====================================================== */}

      {selectedActivity && (
        <div
          className="audit-modal-backdrop"
          role="presentation"
        >
          <div
            className="audit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-detail-title"
          >

            <div className="audit-modal-header">

              <div>
                <div className="audit-section-label">
                  ACTIVITY DETAIL
                </div>

                <h2 id="audit-detail-title">
                  Activity Record
                </h2>
              </div>

              <button
                type="button"
                className="audit-modal-close"
                onClick={() =>
                  setSelectedActivity(
                    null
                  )
                }
              >
                <X size={18} />
              </button>

            </div>


            <div className="audit-detail-icon">
              {React.createElement(
                selectedActivity.icon,
                { size: 22 }
              )}
            </div>


            <div className="audit-detail-title">
              <h3>
                {
                  selectedActivity.title
                }
              </h3>

              <span>
                {
                  selectedActivity.description
                }
              </span>
            </div>


            <div className="audit-detail-grid">

              <div>
                <span>
                  Module
                </span>

                <strong>
                  {
                    selectedActivity.module
                  }
                </strong>
              </div>


              <div>
                <span>
                  Activity Type
                </span>

                <strong>
                  {
                    selectedActivity.category
                  }
                </strong>
              </div>


              <div>
                <span>
                  User
                </span>

                <strong>
                  {
                    selectedActivity.user
                  }
                </strong>
              </div>


              <div>
                <span>
                  Status
                </span>

                <strong>
                  {String(
                    selectedActivity.status ||
                      "Activity"
                  ).replace(
                    /_/g,
                    " "
                  )}
                </strong>
              </div>


              <div>
                <span>
                  Date
                </span>

                <strong>
                  {formatDate(
                    selectedActivity.date
                  )}
                </strong>
              </div>


              <div>
                <span>
                  Time
                </span>

                <strong>
                  {formatDateTime(
                    selectedActivity.date
                  )}
                </strong>
              </div>


              {selectedActivity.amount !==
                null &&
                selectedActivity.amount !==
                  undefined && (
                  <div>
                    <span>
                      Amount
                    </span>

                    <strong>
                      {formatMoney(
                        selectedActivity.amount,
                        selectedActivity.currency ||
                          currency
                      )}
                    </strong>
                  </div>
                )}

            </div>


            <div className="audit-detail-reference">
              <span>
                Record ID
              </span>

              <strong>
                {selectedActivity.sourceId}
              </strong>
            </div>


            <div className="audit-modal-footer">
              <button
                type="button"
                className="audit-close-button"
                onClick={() =>
                  setSelectedActivity(
                    null
                  )
                }
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}