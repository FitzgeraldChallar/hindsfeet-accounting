import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Edit3,
  FileText,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import { api } from "../services/api";
import { useCompany } from "../context/CompanyContext";


// ============================================================
// HELPERS
// ============================================================

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


function currencyCode(value) {
  return String(value || "").trim().toUpperCase();
}

function formatMoney(value, currency = "USD") {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}


function today() {
  return new Date()
    .toISOString()
    .split("T")[0];
}


function createBillNumber() {
  const now = new Date();

  const datePart =
    `${now.getFullYear()}`
    + `${String(now.getMonth() + 1).padStart(2, "0")}`
    + `${String(now.getDate()).padStart(2, "0")}`;

  const timePart =
    `${String(now.getHours()).padStart(2, "0")}`
    + `${String(now.getMinutes()).padStart(2, "0")}`
    + `${String(now.getSeconds()).padStart(2, "0")}`;

  return `BILL-${datePart}-${timePart}`;
}


function getStatusLabel(status) {
  const labels = {
    DRAFT: "Draft",
    POSTED: "Posted",
    PARTIALLY_PAID: "Partially Paid",
    PAID: "Paid",
    OVERDUE: "Overdue",
    VOIDED: "Voided",
  };

  return labels[status] || status || "Unknown";
}


function getStatusClass(status) {
  return (
    String(status || "unknown")
      .toLowerCase()
      .replace(/_/g, "-")
  );
}


// ============================================================
// MAIN PAGE
// ============================================================

export default function Purchases() {
  const location = useLocation();
  const navigate = useNavigate();

  const { currentCompany, workspaceCurrency, activeCurrencies } = useCompany();

  const companyId =
    currentCompany?.id;

  const companyCurrency = currencyCode(
    workspaceCurrency || currentCompany?.currency || "USD"
  );

  const currentPath =
    location.pathname;


  // ==========================================================
  // ROUTING
  // ==========================================================

  const activeSection = useMemo(() => {
    if (
      currentPath.includes(
        "/purchases/suppliers"
      )
    ) {
      return "suppliers";
    }

    if (
      currentPath.includes(
        "/purchases/bills"
      )
    ) {
      return "bills";
    }

    if (
      currentPath.includes(
        "/purchases/transactions"
      )
    ) {
      return "transactions";
    }

    return "suppliers";
  }, [currentPath]);


  const navigateTo = (section) => {
    navigate(
      `/purchases/${section}`
    );
  };


  // ==========================================================
  // DATA
  // ==========================================================

  const [suppliers, setSuppliers] =
    useState([]);

  const [bills, setBills] =
    useState([]);

  const [products, setProducts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  // ==========================================================
  // UI STATE
  // ==========================================================

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [showSupplierModal, setShowSupplierModal] =
    useState(false);

  const [showBillModal, setShowBillModal] =
    useState(false);

  const [showBillDetails, setShowBillDetails] =
    useState(false);

  const [editingSupplier, setEditingSupplier] =
    useState(null);

  const [selectedBill, setSelectedBill] =
    useState(null);

  const [saving, setSaving] =
    useState(false);

  const [postingId, setPostingId] =
    useState(null);

  const [billPendingPost, setBillPendingPost] =
    useState(null);


  // ==========================================================
  // SUPPLIER FORM
  // ==========================================================

  const emptySupplierForm = {
    company: companyId || "",
    name: "",
    email: "",
    phone: "",
    address: "",
    tax_number: "",
    is_active: true,
  };

  const [supplierForm, setSupplierForm] =
    useState(emptySupplierForm);


  // ==========================================================
  // BILL FORM
  // ==========================================================

  const emptyBillItem = {
    product: "",
    description: "",
    quantity: "1",
    unit_cost: "",
    discount: "0.00",
    tax: "0.00",
  };

  const emptyBillForm = {
    company: companyId || "",
    supplier: "",
    currency: companyCurrency,
    bill_number: createBillNumber(),
    bill_date: today(),
    due_date: today(),
    discount: "0.00",
    tax: "0.00",
    notes: "",
    terms: "",
    items: [
      {
        ...emptyBillItem,
      },
    ],
  };

  const [billForm, setBillForm] =
    useState(emptyBillForm);


  // ==========================================================
  // LOAD DATA
  // ==========================================================

  const loadData = async () => {
    if (!companyId) {
      setSuppliers([]);
      setBills([]);
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [
        supplierResponse,
        billResponse,
        productResponse,
      ] = await Promise.all([
        api.get(
          `/api/invoicing/suppliers/?company=${companyId}`
        ),

        api.get(
          `/api/invoicing/supplier-bills/?company=${companyId}`
        ),

        api.get(
          `/api/operations/products/?company=${companyId}`
        ),
      ]);

      setSuppliers(
        extractList(supplierResponse)
      );

      setBills(
        extractList(billResponse)
      );

      setProducts(
        extractList(productResponse)
      );
    } catch (err) {
      setError(
        err?.message ||
        "Unable to load purchases data."
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadData();
  }, [companyId, companyCurrency]);


  // ==========================================================
  // SUPPLIER HELPERS
  // ==========================================================

  const openCreateSupplier = () => {
    setEditingSupplier(null);

    setSupplierForm({
      ...emptySupplierForm,
      company: companyId || "",
    });

    setShowSupplierModal(true);
  };


  const openEditSupplier = (supplier) => {
    setEditingSupplier(supplier);

    setSupplierForm({
      company: companyId || supplier.company || "",
      name: supplier.name || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      tax_number: supplier.tax_number || "",
      is_active:
        supplier.is_active !== false,
    });

    setShowSupplierModal(true);
  };


  const handleSupplierChange = (
    event
  ) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setSupplierForm((previous) => ({
      ...previous,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };


  const saveSupplier = async (
    event
  ) => {
    event.preventDefault();

    if (!supplierForm.name.trim()) {
      setError(
        "Supplier name is required."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      let savedSupplier;

      if (editingSupplier) {
        savedSupplier = await api.patch(
          `/api/invoicing/suppliers/${editingSupplier.id}/`,
          supplierForm
        );
      } else {
        savedSupplier = await api.post(
          "/api/invoicing/suppliers/",
          supplierForm
        );
      }

      setSuppliers((previous) => {
        if (editingSupplier) {
          return previous.map((item) =>
            item.id === savedSupplier.id
              ? savedSupplier
              : item
          );
        }

        return [
          ...previous,
          savedSupplier,
        ];
      });

      setShowSupplierModal(false);
      setEditingSupplier(null);
    } catch (err) {
      setError(
        err?.message ||
        "Unable to save supplier."
      );
    } finally {
      setSaving(false);
    }
  };


  // ==========================================================
  // BILL HELPERS
  // ==========================================================

  const openCreateBill = () => {
    setBillForm({
      ...emptyBillForm,
      company: companyId || "",
      currency: companyCurrency,
      bill_number: createBillNumber(),
      bill_date: today(),
      due_date: today(),
      supplier:
        suppliers.find(
          (supplier) =>
            supplier.is_active !== false
        )?.id || "",
      items: [
        {
          ...emptyBillItem,
        },
      ],
    });

    setError("");
    setShowBillModal(true);
  };


  const handleBillFieldChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setBillForm((previous) => ({
      ...previous,
      [name]: name === "currency" ? currencyCode(value) : value,
    }));
  };


  const handleBillItemChange = (
    index,
    field,
    value
  ) => {
    setBillForm((previous) => {
      const items = [
        ...previous.items,
      ];

      items[index] = {
        ...items[index],
        [field]: value,
      };

      if (field === "product" && value) {
        const product =
          products.find(
            (item) =>
              String(item.id) ===
              String(value)
          );

        if (product) {
          items[index].description =
            product.name || "";

          if (!items[index].unit_cost) {
            const prices = Array.isArray(product.prices)
              ? product.prices
              : Array.isArray(product.product_prices)
                ? product.product_prices
                : [];
            const currencyPrice = prices.find(
              (price) =>
                currencyCode(price?.currency) ===
                currencyCode(billForm.currency || companyCurrency)
            );
            if (currencyPrice?.cost_price !== undefined) {
              items[index].unit_cost = currencyPrice.cost_price;
            } else if (product.cost_price !== undefined) {
              items[index].unit_cost = product.cost_price;
            }
          }
        }
      }

      return {
        ...previous,
        items,
      };
    });
  };


  const addBillItem = () => {
    setBillForm((previous) => ({
      ...previous,
      items: [
        ...previous.items,
        {
          ...emptyBillItem,
        },
      ],
    }));
  };


  const removeBillItem = (
    index
  ) => {
    setBillForm((previous) => {
      if (previous.items.length === 1) {
        return previous;
      }

      return {
        ...previous,
        items: previous.items.filter(
          (_, itemIndex) =>
            itemIndex !== index
        ),
      };
    });
  };


  // ==========================================================
  // BILL TOTALS
  // ==========================================================

  const billTotals = useMemo(() => {
    let subtotal = 0;

    billForm.items.forEach((item) => {
      const quantity =
        Number(item.quantity || 0);

      const unitCost =
        Number(item.unit_cost || 0);

      const discount =
        Number(item.discount || 0);

      const tax =
        Number(item.tax || 0);

      const lineTotal =
        quantity * unitCost -
        discount +
        tax;

      subtotal += Math.max(
        lineTotal,
        0
      );
    });

    const billDiscount =
      Number(
        billForm.discount || 0
      );

    const billTax =
      Number(
        billForm.tax || 0
      );

    const total =
      subtotal -
      billDiscount +
      billTax;

    return {
      subtotal,
      discount: billDiscount,
      tax: billTax,
      total: Math.max(total, 0),
    };
  }, [billForm]);


  // ==========================================================
  // CREATE BILL
  // ==========================================================

  const createBill = async (
    event
  ) => {
    event.preventDefault();

    if (!billForm.supplier) {
      setError(
        "Please select a supplier."
      );
      return;
    }

    if (!billForm.bill_number.trim()) {
      setError(
        "Bill number is required."
      );
      return;
    }

    if (
      !billForm.bill_date ||
      !billForm.due_date
    ) {
      setError(
        "Bill date and due date are required."
      );
      return;
    }

    if (!billForm.items.length) {
      setError(
        "A supplier bill must contain at least one item."
      );
      return;
    }

    const invalidItem =
      billForm.items.some(
        (item) =>
          !item.description.trim() ||
          Number(item.quantity) <= 0 ||
          Number(item.unit_cost) < 0
      );

    if (invalidItem) {
      setError(
        "Please complete every bill item with a valid description, quantity and unit cost."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        company: companyId,
        supplier: Number(
          billForm.supplier
        ),
        currency: currencyCode(
          billForm.currency || companyCurrency
        ),
        bill_number:
          billForm.bill_number.trim(),
        bill_date:
          billForm.bill_date,
        due_date:
          billForm.due_date,
        items: billForm.items.map(
          (item) => ({
            product:
              item.product
                ? Number(item.product)
                : null,
            description:
              item.description.trim(),
            quantity:
              item.quantity,
            unit_cost:
              item.unit_cost,
            discount:
              item.discount || "0.00",
            tax:
              item.tax || "0.00",
          })
        ),
        discount:
          billForm.discount || "0.00",
        tax:
          billForm.tax || "0.00",
        notes:
          billForm.notes || "",
        terms:
          billForm.terms || "",
        post: false,
      };

      const createdBill =
        await api.post(
          "/api/invoicing/supplier-bills/create/",
          payload
        );

      setBills((previous) => [
        createdBill,
        ...previous,
      ]);

      setShowBillModal(false);

      navigateTo("bills");
    } catch (err) {
      setError(
        err?.message ||
        "Unable to create supplier bill."
      );
    } finally {
      setSaving(false);
    }
  };


  // ==========================================================
  // POST BILL
  // ==========================================================

  const postBill = async (
    bill
  ) => {
    if (!bill || postingId !== null) {
      return;
    }

    setBillPendingPost(bill);
    setError("");
  };

  const confirmPostBill = async () => {
    if (!billPendingPost || postingId !== null) {
      return;
    }

    const bill = billPendingPost;
    setBillPendingPost(null);
    setPostingId(bill.id);
    setError("");

    try {
      const postedBill =
        await api.post(
          `/api/invoicing/supplier-bills/${bill.id}/post/`,
          {}
        );

      setBills((previous) =>
        previous.map((item) =>
          item.id === postedBill.id
            ? postedBill
            : item
        )
      );

      if (
        selectedBill?.id ===
        postedBill.id
      ) {
        setSelectedBill(
          postedBill
        );
      }
    } catch (err) {
      setError(
        err?.message ||
        "Unable to post supplier bill."
      );
    } finally {
      setPostingId(null);
    }
  };

  const cancelPostBill = () => {
    if (postingId === null) {
      setBillPendingPost(null);
    }
  };


  // ==========================================================
  // BILL DETAILS
  // ==========================================================

  const openBillDetails = (
    bill
  ) => {
    setSelectedBill(bill);
    setShowBillDetails(true);
  };


  // ==========================================================
  // SUPPLIER LOOKUP
  // ==========================================================

  const supplierById = useMemo(() => {
    const map = {};

    suppliers.forEach(
      (supplier) => {
        map[supplier.id] =
          supplier;
      }
    );

    return map;
  }, [suppliers]);


  // ==========================================================
  // FILTERED SUPPLIERS
  // ==========================================================

  const filteredSuppliers =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return suppliers;
      }

      return suppliers.filter(
        (supplier) =>
          supplier.name
            ?.toLowerCase()
            .includes(query) ||
          supplier.email
            ?.toLowerCase()
            .includes(query) ||
          supplier.phone
            ?.toLowerCase()
            .includes(query) ||
          supplier.tax_number
            ?.toLowerCase()
            .includes(query)
      );
    }, [suppliers, search]);


  // ==========================================================
  // CURRENT WORKSPACE CURRENCY
  // ==========================================================

  const workspaceBills = useMemo(
    () =>
      bills.filter(
        (bill) =>
          currencyCode(
            bill?.currency || currentCompany?.currency
          ) === companyCurrency
      ),
    [bills, companyCurrency, currentCompany?.currency]
  );




  // ==========================================================
  // FILTERED BILLS
  // ==========================================================

  const filteredBills =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return workspaceBills.filter(
        (bill) => {
          const supplier =
            supplierById[
              bill.supplier
            ];

          const matchesSearch =
            !query ||
            bill.bill_number
              ?.toLowerCase()
              .includes(query) ||
            supplier?.name
              ?.toLowerCase()
              .includes(query);

          const matchesStatus =
            statusFilter === "ALL" ||
            bill.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      workspaceBills,
      suppliers,
      supplierById,
      search,
      statusFilter,
    ]);


  // ==========================================================
  // POSTED PURCHASE TRANSACTIONS
  // ==========================================================

  const purchaseTransactions =
    useMemo(() => {
      return workspaceBills.filter(
        (bill) =>
          bill.status !== "DRAFT" &&
          bill.status !== "VOIDED"
      );
    }, [workspaceBills]);


  // ==========================================================
  // SUMMARY STATS
  // ==========================================================

  const supplierStats =
    useMemo(() => {
      return {
        total: suppliers.length,
        active:
          suppliers.filter(
            (item) =>
              item.is_active !== false
          ).length,
        inactive:
          suppliers.filter(
            (item) =>
              item.is_active === false
          ).length,
      };
    }, [suppliers]);


  const billStats =
    useMemo(() => {
      const totalValue =
        workspaceBills.reduce(
          (sum, bill) =>
            sum +
            Number(
              bill.total_amount || 0
            ),
          0
        );

      const outstanding =
        workspaceBills.reduce(
          (sum, bill) =>
            sum +
            Number(
              bill.balance_due || 0
            ),
          0
        );

      return {
        total: workspaceBills.length,
        drafts:
          workspaceBills.filter(
            (bill) =>
              bill.status === "DRAFT"
          ).length,
        posted:
          workspaceBills.filter(
            (bill) =>
              bill.status === "POSTED"
          ).length,
        outstanding,
        totalValue,
      };
    }, [workspaceBills]);


  // ==========================================================
  // EMPTY COMPANY
  // ==========================================================

  if (!companyId) {
    return (
      <div className="purchases-page">
        <div className="purchases-empty-state">
          <div className="purchases-empty-icon">
            <Building2 size={28} />
          </div>

          <h2>
            Select a company
          </h2>

          <p>
            Select a company to view
            and manage purchases.
          </p>
        </div>
      </div>
    );
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="purchases-page">

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div className="purchases-page-header">

        <div>
          <div className="purchases-eyebrow">
            Procurement & Payables
          </div>

          <h1>
            Purchases
          </h1>

          <p>
            Manage suppliers, supplier
            bills and purchase activity
            for{" "}
            <strong>
              {currentCompany?.name}
            </strong>.
          </p>
        </div>

        <div className="purchases-header-actions">

          <button
            type="button"
            className="purchases-btn purchases-btn-secondary"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw
              size={17}
              className={
                loading
                  ? "purchases-spin"
                  : ""
              }
            />
            Refresh
          </button>

          {activeSection ===
            "suppliers" && (
            <button
              type="button"
              className="purchases-btn purchases-btn-primary"
              onClick={
                openCreateSupplier
              }
            >
              <Plus size={18} />
              Add Supplier
            </button>
          )}

          {activeSection ===
            "bills" && (
            <button
              type="button"
              className="purchases-btn purchases-btn-primary"
              onClick={openCreateBill}
            >
              <Plus size={18} />
              Create Bill
            </button>
          )}

        </div>
      </div>


      {/* ======================================================
          NAVIGATION
      ====================================================== */}

      <div className="purchases-navigation">

        <button
          type="button"
          className={`purchases-nav-card ${
            activeSection ===
            "suppliers"
              ? "active"
              : ""
          }`}
          onClick={() =>
            navigateTo("suppliers")
          }
        >
          <div className="purchases-nav-icon">
            <Truck size={22} />
          </div>

          <div>
            <strong>
              Suppliers
            </strong>

            <span>
              Supplier directory
            </span>
          </div>

          <ChevronRight
            size={18}
            className="purchases-nav-arrow"
          />
        </button>


        <button
          type="button"
          className={`purchases-nav-card ${
            activeSection ===
            "bills"
              ? "active"
              : ""
          }`}
          onClick={() =>
            navigateTo("bills")
          }
        >
          <div className="purchases-nav-icon">
            <FileText size={22} />
          </div>

          <div>
            <strong>
              Bills
            </strong>

            <span>
              Supplier bills & posting
            </span>
          </div>

          <ChevronRight
            size={18}
            className="purchases-nav-arrow"
          />
        </button>


        <button
          type="button"
          className={`purchases-nav-card ${
            activeSection ===
            "transactions"
              ? "active"
              : ""
          }`}
          onClick={() =>
            navigateTo(
              "transactions"
            )
          }
        >
          <div className="purchases-nav-icon">
            <ClipboardList
              size={22}
            />
          </div>

          <div>
            <strong>
              Purchase Transactions
            </strong>

            <span>
              Posted purchase activity
            </span>
          </div>

          <ChevronRight
            size={18}
            className="purchases-nav-arrow"
          />
        </button>

      </div>


      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="purchases-alert purchases-alert-error">
          <AlertCircle size={18} />

          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            <X size={17} />
          </button>
        </div>
      )}


      {/* ======================================================
          LOADING
      ====================================================== */}

      {loading ? (
        <div className="purchases-loading">
          <RefreshCw
            size={24}
            className="purchases-spin"
          />

          <span>
            Loading purchases...
          </span>
        </div>
      ) : (
        <>
          {/* ==================================================
              SUPPLIERS
          ================================================== */}

          {activeSection ===
            "suppliers" && (
            <section>

              <div className="purchases-stat-grid">

                <div className="purchases-stat-card">
                  <div className="purchases-stat-icon">
                    <Truck size={21} />
                  </div>

                  <div>
                    <span>
                      Total Suppliers
                    </span>

                    <strong>
                      {supplierStats.total}
                    </strong>
                  </div>
                </div>


                <div className="purchases-stat-card">
                  <div className="purchases-stat-icon">
                    <CheckCircle2
                      size={21}
                    />
                  </div>

                  <div>
                    <span>
                      Active Suppliers
                    </span>

                    <strong>
                      {supplierStats.active}
                    </strong>
                  </div>
                </div>


                <div className="purchases-stat-card">
                  <div className="purchases-stat-icon">
                    <Building2
                      size={21}
                    />
                  </div>

                  <div>
                    <span>
                      Inactive Suppliers
                    </span>

                    <strong>
                      {supplierStats.inactive}
                    </strong>
                  </div>
                </div>

              </div>


              <div className="purchases-panel">

                <div className="purchases-panel-header">

                  <div>
                    <h2>
                      Supplier Directory
                    </h2>

                    <p>
                      Manage the suppliers
                      used by this company.
                    </p>
                  </div>

                  <div className="purchases-search">
                    <Search size={17} />

                    <input
                      value={search}
                      onChange={(event) =>
                        setSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search suppliers..."
                    />
                  </div>

                </div>


                {filteredSuppliers.length ===
                0 ? (
                  <div className="purchases-empty-state compact">
                    <div className="purchases-empty-icon">
                      <Truck size={25} />
                    </div>

                    <h3>
                      No suppliers found
                    </h3>

                    <p>
                      Add your first
                      supplier to begin
                      recording purchases.
                    </p>

                    <button
                      type="button"
                      className="purchases-btn purchases-btn-primary"
                      onClick={
                        openCreateSupplier
                      }
                    >
                      <Plus size={17} />
                      Add Supplier
                    </button>
                  </div>
                ) : (
                  <div className="purchases-table-wrap">
                    <table className="purchases-table">

                      <thead>
                        <tr>
                          <th>
                            Supplier
                          </th>

                          <th>
                            Contact
                          </th>

                          <th>
                            Tax Number
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
                        {filteredSuppliers.map(
                          (supplier) => (
                            <tr
                              key={
                                supplier.id
                              }
                            >

                              <td>
                                <div className="purchases-primary-cell">
                                  <div className="purchases-avatar">
                                    {supplier.name
                                      ?.charAt(
                                        0
                                      )
                                      ?.toUpperCase()}
                                  </div>

                                  <div>
                                    <strong>
                                      {
                                        supplier.name
                                      }
                                    </strong>

                                    <span>
                                      {
                                        supplier.email ||
                                        "No email"
                                      }
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <div className="purchases-contact-cell">
                                  <strong>
                                    {
                                      supplier.phone ||
                                      "—"
                                    }
                                  </strong>

                                  <span>
                                    {
                                      supplier.address ||
                                      "No address"
                                    }
                                  </span>
                                </div>
                              </td>

                              <td>
                                {supplier.tax_number ||
                                  "—"}
                              </td>

                              <td>
                                <span
                                  className={`purchases-status purchases-status-${
                                    supplier.is_active
                                      ? "active"
                                      : "inactive"
                                  }`}
                                >
                                  {supplier.is_active
                                    ? "Active"
                                    : "Inactive"}
                                </span>
                              </td>

                              <td>
                                <button
                                  type="button"
                                  className="purchases-icon-btn"
                                  title="Edit supplier"
                                  onClick={() =>
                                    openEditSupplier(
                                      supplier
                                    )
                                  }
                                >
                                  <Edit3
                                    size={17}
                                  />
                                </button>
                              </td>

                            </tr>
                          )
                        )}
                      </tbody>

                    </table>
                  </div>
                )}

              </div>

            </section>
          )}


          {/* ==================================================
              BILLS
          ================================================== */}

          {activeSection ===
            "bills" && (
            <section>

              <div className="purchases-stat-grid">

                <div className="purchases-stat-card">
                  <div className="purchases-stat-icon">
                    <FileText size={21} />
                  </div>

                  <div>
                    <span>
                      Total Bills
                    </span>

                    <strong>
                      {billStats.total}
                    </strong>
                  </div>
                </div>


                <div className="purchases-stat-card">
                  <div className="purchases-stat-icon">
                    <ClipboardList
                      size={21}
                    />
                  </div>

                  <div>
                    <span>
                      Draft Bills
                    </span>

                    <strong>
                      {billStats.drafts}
                    </strong>
                  </div>
                </div>


                <div className="purchases-stat-card">
                  <div className="purchases-stat-icon">
                    <CheckCircle2
                      size={21}
                    />
                  </div>

                  <div>
                    <span>
                      Posted Bills
                    </span>

                    <strong>
                      {billStats.posted}
                    </strong>
                  </div>
                </div>


                <div className="purchases-stat-card purchases-stat-card-wide">
                  <div className="purchases-stat-icon">
                    <ShoppingCart
                      size={21}
                    />
                  </div>

                  <div>
                    <span>
                      Outstanding Payables
                    </span>

                    <strong>
                      {formatMoney(
                        billStats.outstanding,
                        companyCurrency
                      )}
                    </strong>
                  </div>
                </div>

              </div>


              <div className="purchases-panel">

                <div className="purchases-panel-header">

                  <div>
                    <h2>
                      Supplier Bills
                    </h2>

                    <p>
                      Record purchases and
                      post supplier liabilities.
                    </p>
                  </div>

                  <div className="purchases-toolbar">

                    <div className="purchases-search">
                      <Search
                        size={17}
                      />

                      <input
                        value={search}
                        onChange={(
                          event
                        ) =>
                          setSearch(
                            event.target.value
                          )
                        }
                        placeholder="Search bills..."
                      />
                    </div>

                    <select
                      value={
                        statusFilter
                      }
                      onChange={(
                        event
                      ) =>
                        setStatusFilter(
                          event.target.value
                        )
                      }
                      className="purchases-select"
                    >
                      <option value="ALL">
                        All Statuses
                      </option>

                      <option value="DRAFT">
                        Draft
                      </option>

                      <option value="POSTED">
                        Posted
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

                  </div>

                </div>


                {filteredBills.length ===
                0 ? (
                  <div className="purchases-empty-state compact">
                    <div className="purchases-empty-icon">
                      <FileText size={25} />
                    </div>

                    <h3>
                      No supplier bills found
                    </h3>

                    <p>
                      Create a supplier bill
                      to start recording
                      purchases.
                    </p>

                    <button
                      type="button"
                      className="purchases-btn purchases-btn-primary"
                      onClick={
                        openCreateBill
                      }
                    >
                      <Plus size={17} />
                      Create Bill
                    </button>
                  </div>
                ) : (
                  <div className="purchases-table-wrap">
                    <table className="purchases-table">

                      <thead>
                        <tr>
                          <th>
                            Bill
                          </th>

                          <th>
                            Supplier
                          </th>

                          <th>
                            Bill Date
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
                        {filteredBills.map(
                          (bill) => {
                            const supplier =
                              supplierById[
                                bill.supplier
                              ];

                            return (
                              <tr
                                key={
                                  bill.id
                                }
                              >

                                <td>
                                  <div className="purchases-primary-cell">
                                    <div className="purchases-table-icon">
                                      <FileText
                                        size={18}
                                      />
                                    </div>

                                    <div>
                                      <strong>
                                        {
                                          bill.bill_number
                                        }
                                      </strong>

                                      <span>
                                        Purchase Bill
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                <td>
                                  <strong>
                                    {
                                      supplier?.name ||
                                      `Supplier #${bill.supplier}`
                                    }
                                  </strong>
                                </td>

                                <td>
                                  {
                                    formatDate(
                                      bill.bill_date
                                    )
                                  }
                                </td>

                                <td>
                                  {
                                    formatDate(
                                      bill.due_date
                                    )
                                  }
                                </td>

                                <td>
                                  <strong>
                                    {formatMoney(
                                      bill.total_amount,
                                      currencyCode(bill.currency || companyCurrency)
                                    )}
                                  </strong>
                                </td>

                                <td>
                                  {formatMoney(
                                    bill.balance_due,
                                    companyCurrency
                                  )}
                                </td>

                                <td>
                                  <span
                                    className={`purchases-status purchases-status-${getStatusClass(
                                      bill.status
                                    )}`}
                                  >
                                    {getStatusLabel(
                                      bill.status
                                    )}
                                  </span>
                                </td>

                                <td>
                                  <div className="purchases-row-actions">

                                    <button
                                      type="button"
                                      className="purchases-icon-btn"
                                      title="View bill"
                                      onClick={() =>
                                        openBillDetails(
                                          bill
                                        )
                                      }
                                    >
                                      <FileText
                                        size={17}
                                      />
                                    </button>

                                    {bill.status ===
                                      "DRAFT" && (
                                      <button
                                        type="button"
                                        className="purchases-small-btn"
                                        onClick={() =>
                                          postBill(
                                            bill
                                          )
                                        }
                                        disabled={
                                          postingId ===
                                          bill.id
                                        }
                                      >
                                        {postingId ===
                                        bill.id ? (
                                          <RefreshCw
                                            size={
                                              15
                                            }
                                            className="purchases-spin"
                                          />
                                        ) : (
                                          <CheckCircle2
                                            size={
                                              15
                                            }
                                          />
                                        )}

                                        Post
                                      </button>
                                    )}

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

            </section>
          )}


          {/* ==================================================
              PURCHASE TRANSACTIONS
          ================================================== */}

          {activeSection ===
            "transactions" && (
            <section>

              <div className="purchases-stat-grid">

                <div className="purchases-stat-card">
                  <div className="purchases-stat-icon">
                    <ShoppingCart
                      size={21}
                    />
                  </div>

                  <div>
                    <span>
                      Purchase Transactions
                    </span>

                    <strong>
                      {
                        purchaseTransactions.length
                      }
                    </strong>
                  </div>
                </div>


                <div className="purchases-stat-card">
                  <div className="purchases-stat-icon">
                    <CheckCircle2
                      size={21}
                    />
                  </div>

                  <div>
                    <span>
                      Posted Purchases
                    </span>

                    <strong>
                      {
                        workspaceBills.filter(
                          (bill) =>
                            bill.status ===
                            "POSTED"
                        ).length
                      }
                    </strong>
                  </div>
                </div>


                <div className="purchases-stat-card purchases-stat-card-wide">
                  <div className="purchases-stat-icon">
                    <Package size={21} />
                  </div>

                  <div>
                    <span>
                      Total Purchase Value
                    </span>

                    <strong>
                      {formatMoney(
                        purchaseTransactions.reduce(
                          (
                            sum,
                            bill
                          ) =>
                            sum +
                            Number(
                              bill.total_amount ||
                                0
                            ),
                          0
                        ),
                        companyCurrency
                      )}
                    </strong>
                  </div>
                </div>

              </div>


              <div className="purchases-panel">

                <div className="purchases-panel-header">

                  <div>
                    <h2>
                      Purchase Transactions
                    </h2>

                    <p>
                      Posted purchase activity
                      generated from supplier
                      bills.
                    </p>
                  </div>

                  <div className="purchases-toolbar">

                    <div className="purchases-search">
                      <Search
                        size={17}
                      />

                      <input
                        value={search}
                        onChange={(
                          event
                        ) =>
                          setSearch(
                            event.target.value
                          )
                        }
                        placeholder="Search transactions..."
                      />
                    </div>

                  </div>

                </div>


                {purchaseTransactions.filter(
                  (bill) => {
                    const query =
                      search
                        .trim()
                        .toLowerCase();

                    const supplier =
                      supplierById[
                        bill.supplier
                      ];

                    return (
                      !query ||
                      bill.bill_number
                        ?.toLowerCase()
                        .includes(
                          query
                        ) ||
                      supplier?.name
                        ?.toLowerCase()
                        .includes(
                          query
                        )
                    );
                  }
                ).length === 0 ? (
                  <div className="purchases-empty-state compact">
                    <div className="purchases-empty-icon">
                      <ClipboardList
                        size={25}
                      />
                    </div>

                    <h3>
                      No purchase transactions
                    </h3>

                    <p>
                      Posted supplier bills
                      will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="purchases-table-wrap">
                    <table className="purchases-table">

                      <thead>
                        <tr>
                          <th>
                            Transaction
                          </th>

                          <th>
                            Supplier
                          </th>

                          <th>
                            Date
                          </th>

                          <th>
                            Reference
                          </th>

                          <th>
                            Amount
                          </th>

                          <th>
                            Status
                          </th>

                          <th>
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {purchaseTransactions
                          .filter(
                            (bill) => {
                              const query =
                                search
                                  .trim()
                                  .toLowerCase();

                              const supplier =
                                supplierById[
                                  bill.supplier
                                ];

                              return (
                                !query ||
                                bill.bill_number
                                  ?.toLowerCase()
                                  .includes(
                                    query
                                  ) ||
                                supplier?.name
                                  ?.toLowerCase()
                                  .includes(
                                    query
                                  )
                              );
                            }
                          )
                          .map(
                            (bill) => {
                              const supplier =
                                supplierById[
                                  bill.supplier
                                ];

                              return (
                                <tr
                                  key={
                                    bill.id
                                  }
                                >

                                  <td>
                                    <div className="purchases-primary-cell">
                                      <div className="purchases-table-icon">
                                        <ShoppingCart
                                          size={
                                            18
                                          }
                                        />
                                      </div>

                                      <div>
                                        <strong>
                                          {
                                            bill.bill_number
                                          }
                                        </strong>

                                        <span>
                                          Purchase transaction
                                        </span>
                                      </div>
                                    </div>
                                  </td>

                                  <td>
                                    <strong>
                                      {
                                        supplier?.name ||
                                        `Supplier #${bill.supplier}`
                                      }
                                    </strong>
                                  </td>

                                  <td>
                                    {
                                      formatDate(
                                        bill.bill_date
                                      )
                                    }
                                  </td>

                                  <td>
                                    BILL-
                                    {
                                      bill.bill_number
                                    }
                                  </td>

                                  <td>
                                    <strong>
                                      {formatMoney(
                                        bill.total_amount,
                                        currencyCode(bill.currency || companyCurrency)
                                      )}
                                    </strong>
                                  </td>

                                  <td>
                                    <span
                                      className={`purchases-status purchases-status-${getStatusClass(
                                        bill.status
                                      )}`}
                                    >
                                      {getStatusLabel(
                                        bill.status
                                      )}
                                    </span>
                                  </td>

                                  <td>
                                    <button
                                      type="button"
                                      className="purchases-icon-btn"
                                      title="View transaction"
                                      onClick={() =>
                                        openBillDetails(
                                          bill
                                        )
                                      }
                                    >
                                      <FileText
                                        size={
                                          17
                                        }
                                      />
                                    </button>
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

            </section>
          )}
        </>
      )}


      {/* ======================================================
          SUPPLIER MODAL
      ====================================================== */}

      {showSupplierModal && (
        <div className="purchases-modal-backdrop">

          <div className="purchases-modal">

            <div className="purchases-modal-header">

              <div>
                <span className="purchases-modal-eyebrow">
                  Supplier Management
                </span>

                <h2>
                  {editingSupplier
                    ? "Edit Supplier"
                    : "Add Supplier"}
                </h2>

                <p>
                  Maintain supplier
                  information for this company.
                </p>
              </div>

              <button
                type="button"
                className="purchases-modal-close"
                onClick={() =>
                  setShowSupplierModal(
                    false
                  )
                }
              >
                <X size={19} />
              </button>

            </div>


            <form
              onSubmit={
                saveSupplier
              }
              className="purchases-form"
            >

              <div className="purchases-form-grid">

                <div className="purchases-field purchases-field-full">
                  <label>
                    Supplier Name *
                  </label>

                  <input
                    name="name"
                    value={
                      supplierForm.name
                    }
                    onChange={
                      handleSupplierChange
                    }
                    placeholder="Enter supplier name"
                    required
                  />
                </div>


                <div className="purchases-field">
                  <label>
                    Email
                  </label>

                  <input
                    type="email"
                    name="email"
                    value={
                      supplierForm.email
                    }
                    onChange={
                      handleSupplierChange
                    }
                    placeholder="supplier@example.com"
                  />
                </div>


                <div className="purchases-field">
                  <label>
                    Phone
                  </label>

                  <input
                    name="phone"
                    value={
                      supplierForm.phone
                    }
                    onChange={
                      handleSupplierChange
                    }
                    placeholder="077..."
                  />
                </div>


                <div className="purchases-field">
                  <label>
                    Tax Number
                  </label>

                  <input
                    name="tax_number"
                    value={
                      supplierForm.tax_number
                    }
                    onChange={
                      handleSupplierChange
                    }
                    placeholder="Tax identification number"
                  />
                </div>


                <div className="purchases-field">
                  <label>
                    Address
                  </label>

                  <input
                    name="address"
                    value={
                      supplierForm.address
                    }
                    onChange={
                      handleSupplierChange
                    }
                    placeholder="Supplier address"
                  />
                </div>

              </div>


              <label className="purchases-checkbox">

                <input
                  type="checkbox"
                  name="is_active"
                  checked={
                    supplierForm.is_active
                  }
                  onChange={
                    handleSupplierChange
                  }
                />

                <span>
                  Supplier is active
                </span>

              </label>


              <div className="purchases-form-actions">

                <button
                  type="button"
                  className="purchases-btn purchases-btn-secondary"
                  onClick={() =>
                    setShowSupplierModal(
                      false
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="purchases-btn purchases-btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <RefreshCw
                        size={17}
                        className="purchases-spin"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        size={17}
                      />
                      {editingSupplier
                        ? "Save Changes"
                        : "Add Supplier"}
                    </>
                  )}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}


      {/* ======================================================
          CREATE BILL MODAL
      ====================================================== */}

      {showBillModal && (
        <div className="purchases-modal-backdrop">

          <div className="purchases-modal purchases-modal-large">

            <div className="purchases-modal-header">

              <div>
                <span className="purchases-modal-eyebrow">
                  Accounts Payable
                </span>

                <h2>
                  Create Supplier Bill
                </h2>

                <p>
                  Record a purchase from a
                  supplier. The bill will be
                  created as a draft.
                </p>
              </div>

              <button
                type="button"
                className="purchases-modal-close"
                onClick={() =>
                  setShowBillModal(
                    false
                  )
                }
              >
                <X size={19} />
              </button>

            </div>


            <form
              onSubmit={
                createBill
              }
              className="purchases-form"
            >

              {/* BILL HEADER */}

              <div className="purchases-form-section">

                <div className="purchases-form-section-title">
                  <FileText size={18} />

                  <div>
                    <h3>
                      Bill Information
                    </h3>

                    <p>
                      Basic supplier bill
                      details.
                    </p>
                  </div>
                </div>


                <div className="purchases-form-grid">

                  <div className="purchases-field">
                    <label>
                      Supplier *
                    </label>

                    <select
                      name="supplier"
                      value={
                        billForm.supplier
                      }
                      onChange={
                        handleBillFieldChange
                      }
                      required
                    >
                      <option value="">
                        Select supplier
                      </option>

                      {suppliers
                        .filter(
                          (
                            supplier
                          ) =>
                            supplier.is_active !==
                            false
                        )
                        .map(
                          (
                            supplier
                          ) => (
                            <option
                              key={
                                supplier.id
                              }
                              value={
                                supplier.id
                              }
                            >
                              {
                                supplier.name
                              }
                            </option>
                          )
                        )}
                    </select>
                  </div>


                  <div className="purchases-field">
                    <label>
                      Bill Number *
                    </label>

                    <input
                      name="bill_number"
                      value={
                        billForm.bill_number
                      }
                      onChange={
                        handleBillFieldChange
                      }
                      required
                    />
                  </div>


                  <div className="purchases-field">
                    <label>
                      Bill Date *
                    </label>

                    <input
                      type="date"
                      name="bill_date"
                      value={
                        billForm.bill_date
                      }
                      onChange={
                        handleBillFieldChange
                      }
                      required
                    />
                  </div>


                  <div className="purchases-field">
                    <label>
                      Due Date *
                    </label>

                    <input
                      type="date"
                      name="due_date"
                      value={
                        billForm.due_date
                      }
                      onChange={
                        handleBillFieldChange
                      }
                      required
                    />
                  </div>

                  <div className="purchases-field">
                    <label>
                      Bill Currency *
                    </label>

                    <select
                      name="currency"
                      value={
                        billForm.currency ||
                        companyCurrency
                      }
                      onChange={
                        handleBillFieldChange
                      }
                      required
                    >
                      {(Array.isArray(activeCurrencies)
                        ? activeCurrencies
                            .filter((item) => item?.is_active !== false)
                            .map((item) => currencyCode(item?.currency))
                            .filter(Boolean)
                        : [companyCurrency]
                      )
                        .filter((value, index, array) =>
                          array.indexOf(value) === index
                        )
                        .map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                    </select>
                  </div>

                </div>

              </div>


              {/* BILL ITEMS */}

              <div className="purchases-form-section">

                <div className="purchases-form-section-header">

                  <div className="purchases-form-section-title">
                    <Package size={18} />

                    <div>
                      <h3>
                        Purchase Items
                      </h3>

                      <p>
                        Add the products,
                        services or expenses
                        included on this bill.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="purchases-small-btn"
                    onClick={
                      addBillItem
                    }
                  >
                    <Plus size={15} />
                    Add Item
                  </button>

                </div>


                <div className="purchases-line-items">

                  {billForm.items.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        className="purchases-line-item"
                        key={index}
                      >

                        <div className="purchases-line-number">
                          {index + 1}
                        </div>


                        <div className="purchases-line-fields">

                          <div className="purchases-field">
                            <label>
                              Product
                            </label>

                            <select
                              value={
                                item.product
                              }
                              onChange={(
                                event
                              ) =>
                                handleBillItemChange(
                                  index,
                                  "product",
                                  event
                                    .target
                                    .value
                                )
                              }
                            >
                              <option value="">
                                Custom / Expense
                              </option>

                              {products
                                .filter(
                                  (
                                    product
                                  ) =>
                                    product.is_active !==
                                    false
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
                                        product.name
                                      }
                                    </option>
                                  )
                                )}
                            </select>
                          </div>


                          <div className="purchases-field purchases-field-description">
                            <label>
                              Description *
                            </label>

                            <input
                              value={
                                item.description
                              }
                              onChange={(
                                event
                              ) =>
                                handleBillItemChange(
                                  index,
                                  "description",
                                  event
                                    .target
                                    .value
                                )
                              }
                              placeholder="Item description"
                              required
                            />
                          </div>


                          <div className="purchases-field purchases-field-small">
                            <label>
                              Quantity *
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
                                handleBillItemChange(
                                  index,
                                  "quantity",
                                  event
                                    .target
                                    .value
                                )
                              }
                              required
                            />
                          </div>


                          <div className="purchases-field purchases-field-small">
                            <label>
                              Unit Cost *
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
                                handleBillItemChange(
                                  index,
                                  "unit_cost",
                                  event
                                    .target
                                    .value
                                )
                              }
                              placeholder="0.00"
                              required
                            />
                          </div>


                          <div className="purchases-field purchases-field-small">
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
                                handleBillItemChange(
                                  index,
                                  "discount",
                                  event
                                    .target
                                    .value
                                )
                              }
                            />
                          </div>


                          <div className="purchases-field purchases-field-small">
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
                                handleBillItemChange(
                                  index,
                                  "tax",
                                  event
                                    .target
                                    .value
                                )
                              }
                            />
                          </div>

                        </div>


                        <button
                          type="button"
                          className="purchases-line-remove"
                          onClick={() =>
                            removeBillItem(
                              index
                            )
                          }
                          disabled={
                            billForm.items
                              .length ===
                            1
                          }
                          title="Remove item"
                        >
                          <X size={17} />
                        </button>

                      </div>
                    )
                  )}

                </div>

              </div>


              {/* TOTALS */}

              <div className="purchases-form-bottom">

                <div className="purchases-notes">

                  <div className="purchases-field">
                    <label>
                      Notes
                    </label>

                    <textarea
                      name="notes"
                      value={
                        billForm.notes
                      }
                      onChange={
                        handleBillFieldChange
                      }
                      placeholder="Internal notes about this purchase..."
                      rows={3}
                    />
                  </div>


                  <div className="purchases-field">
                    <label>
                      Terms
                    </label>

                    <textarea
                      name="terms"
                      value={
                        billForm.terms
                      }
                      onChange={
                        handleBillFieldChange
                      }
                      placeholder="Payment terms or supplier terms..."
                      rows={3}
                    />
                  </div>

                </div>


                <div className="purchases-totals">

                  <div className="purchases-total-row">
                    <span>
                      Subtotal
                    </span>

                    <strong>
                      {formatMoney(
                        billTotals.subtotal,
                        billForm.currency || companyCurrency
                      )}
                    </strong>
                  </div>


                  <div className="purchases-total-row">

                    <span>
                      Bill Discount
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="discount"
                      value={
                        billForm.discount
                      }
                      onChange={
                        handleBillFieldChange
                      }
                    />

                  </div>


                  <div className="purchases-total-row">

                    <span>
                      Bill Tax
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="tax"
                      value={
                        billForm.tax
                      }
                      onChange={
                        handleBillFieldChange
                      }
                    />

                  </div>


                  <div className="purchases-total-final">

                    <span>
                      Total
                    </span>

                    <strong>
                      {formatMoney(
                        billTotals.total,
                        billForm.currency || companyCurrency
                      )}
                    </strong>

                  </div>

                </div>

              </div>


              <div className="purchases-form-actions">

                <button
                  type="button"
                  className="purchases-btn purchases-btn-secondary"
                  onClick={() =>
                    setShowBillModal(
                      false
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="purchases-btn purchases-btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <RefreshCw
                        size={17}
                        className="purchases-spin"
                      />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        size={17}
                      />
                      Create Draft Bill
                    </>
                  )}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}


      {/* ======================================================
          BILL DETAILS MODAL
      ====================================================== */}

      {showBillDetails &&
        selectedBill && (
          <div className="purchases-modal-backdrop">

            <div className="purchases-modal purchases-modal-large">

              <div className="purchases-modal-header">

                <div>
                  <span className="purchases-modal-eyebrow">
                    Supplier Bill
                  </span>

                  <h2>
                    {
                      selectedBill.bill_number
                    }
                  </h2>

                  <p>
                    {
                      supplierById[
                        selectedBill.supplier
                      ]?.name ||
                      `Supplier #${selectedBill.supplier}`
                    }
                  </p>
                </div>

                <button
                  type="button"
                  className="purchases-modal-close"
                  onClick={() =>
                    setShowBillDetails(
                      false
                    )
                  }
                >
                  <X size={19} />
                </button>

              </div>


              <div className="purchases-detail-grid">

                <div className="purchases-detail-card">
                  <span>
                    Bill Date
                  </span>

                  <strong>
                    {formatDate(
                      selectedBill.bill_date
                    )}
                  </strong>
                </div>


                <div className="purchases-detail-card">
                  <span>
                    Due Date
                  </span>

                  <strong>
                    {formatDate(
                      selectedBill.due_date
                    )}
                  </strong>
                </div>


                <div className="purchases-detail-card">
                  <span>
                    Total
                  </span>

                  <strong>
                    {formatMoney(
                      selectedBill.total_amount,
                      currencyCode(selectedBill.currency || companyCurrency)
                    )}
                  </strong>
                </div>


                <div className="purchases-detail-card">
                  <span>
                    Balance Due
                  </span>

                  <strong>
                    {formatMoney(
                      selectedBill.balance_due,
                      currencyCode(selectedBill.currency || companyCurrency)
                    )}
                  </strong>
                </div>

              </div>


              <div className="purchases-detail-status-row">

                <span
                  className={`purchases-status purchases-status-${getStatusClass(
                    selectedBill.status
                  )}`}
                >
                  {getStatusLabel(
                    selectedBill.status
                  )}
                </span>

                {selectedBill.status ===
                  "DRAFT" && (
                  <button
                    type="button"
                    className="purchases-btn purchases-btn-primary"
                    onClick={() =>
                      postBill(
                        selectedBill
                      )
                    }
                    disabled={
                      postingId ===
                      selectedBill.id
                    }
                  >
                    {postingId ===
                    selectedBill.id ? (
                      <RefreshCw
                        size={17}
                        className="purchases-spin"
                      />
                    ) : (
                      <CheckCircle2
                        size={17}
                      />
                    )}

                    Post Bill
                  </button>
                )}

              </div>


              <div className="purchases-detail-section">

                <div className="purchases-detail-section-header">
                  <h3>
                    Bill Items
                  </h3>

                  <span>
                    {selectedBill.items
                      ?.length || 0}{" "}
                    item(s)
                  </span>
                </div>


                {selectedBill.items?.length ? (
                  <div className="purchases-table-wrap">

                    <table className="purchases-table">

                      <thead>
                        <tr>
                          <th>
                            Description
                          </th>

                          <th>
                            Quantity
                          </th>

                          <th>
                            Unit Cost
                          </th>

                          <th>
                            Discount
                          </th>

                          <th>
                            Tax
                          </th>

                          <th>
                            Line Total
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedBill.items.map(
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
                                {
                                  item.quantity
                                }
                              </td>

                              <td>
                                {formatMoney(
                                  item.unit_cost,
                                  currencyCode(
                                    selectedBill.currency ||
                                    companyCurrency
                                  )
                                )}
                              </td>

                              <td>
                                {formatMoney(
                                  item.discount,
                                  currencyCode(
                                    selectedBill.currency ||
                                    companyCurrency
                                  )
                                )}
                              </td>

                              <td>
                                {formatMoney(
                                  item.tax,
                                  currencyCode(
                                    selectedBill.currency ||
                                    companyCurrency
                                  )
                                )}
                              </td>

                              <td>
                                <strong>
                                  {formatMoney(
                                    item.line_total,
                                    currencyCode(
                                      selectedBill.currency ||
                                      companyCurrency
                                    )
                                  )}
                                </strong>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>

                    </table>

                  </div>
                ) : (
                  <div className="purchases-empty-inline">
                    No bill items available.
                  </div>
                )}

              </div>


              <div className="purchases-detail-total">

                <span>
                  Total Amount
                </span>

                <strong>
                  {formatMoney(
                    selectedBill.total_amount,
                    currencyCode(
                      selectedBill.currency ||
                      companyCurrency
                    )
                  )}
                </strong>

              </div>


              <div className="purchases-detail-notes">

                {selectedBill.notes && (
                  <div>
                    <span>
                      Notes
                    </span>

                    <p>
                      {
                        selectedBill.notes
                      }
                    </p>
                  </div>
                )}

                {selectedBill.terms && (
                  <div>
                    <span>
                      Terms
                    </span>

                    <p>
                      {
                        selectedBill.terms
                      }
                    </p>
                  </div>
                )}

              </div>

            </div>

          </div>
        )}


      {billPendingPost && (
        <div
          className="purchases-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              cancelPostBill();
            }
          }}
        >
          <div
            className="purchases-modal purchases-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-bill-confirm-title"
          >
            <div className="purchases-modal-header">
              <div>
                <span className="purchases-modal-eyebrow">
                  POST SUPPLIER BILL
                </span>

                <h2 id="post-bill-confirm-title">
                  Confirm Bill Posting
                </h2>

                <p>
                  Review this action before creating
                  the Accounts Payable accounting entry.
                </p>
              </div>

              <button
                type="button"
                className="purchases-modal-close"
                onClick={cancelPostBill}
                disabled={postingId !== null}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="purchases-confirm-body">
              <div className="purchases-confirm-icon">
                <AlertCircle size={22} />
              </div>

              <div className="purchases-confirm-copy">
                <h3>
                  Post{" "}
                  {billPendingPost.bill_number ||
                    `Bill #${billPendingPost.id}`}
                  ?
                </h3>

                <p>
                  This will create the Accounts Payable
                  accounting entry and move the bill out
                  of Draft status. The action should only
                  be confirmed when the bill details are
                  correct.
                </p>
              </div>
            </div>

            <div className="purchases-confirm-summary">
              <div>
                <span>Supplier</span>
                <strong>
                  {suppliers.find(
                    (supplier) =>
                      String(supplier.id) ===
                      String(
                        billPendingPost.supplier
                      )
                  )?.name || "Unknown supplier"}
                </strong>
              </div>

              <div>
                <span>Bill Currency</span>
                <strong>
                  {currencyCode(
                    billPendingPost.currency ||
                    companyCurrency
                  )}
                </strong>
              </div>

              <div>
                <span>Total Amount</span>
                <strong>
                  {formatMoney(
                    billPendingPost.total_amount,
                    currencyCode(
                      billPendingPost.currency ||
                      companyCurrency
                    )
                  )}
                </strong>
              </div>
            </div>

            <div className="purchases-confirm-actions">
              <button
                type="button"
                className="purchases-btn purchases-btn-secondary"
                onClick={cancelPostBill}
                disabled={postingId !== null}
              >
                Cancel
              </button>

              <button
                type="button"
                className="purchases-btn purchases-btn-primary"
                onClick={confirmPostBill}
                disabled={postingId !== null}
              >
                {postingId !== null ? (
                  <RefreshCw
                    size={17}
                    className="purchases-spin"
                  />
                ) : (
                  <CheckCircle2 size={17} />
                )}

                {postingId !== null
                  ? "Posting..."
                  : "Post Bill"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
