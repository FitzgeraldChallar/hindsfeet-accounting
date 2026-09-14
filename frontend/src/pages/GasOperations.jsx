import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  CircleDollarSign,
  Edit3,
  Fuel,
  Gauge,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { api } from "../services/api";
import { useCompany } from "../context/CompanyContext";


function list(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.results)) return response.results;
  return [];
}

function n(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value, currency) {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n(value))} ${currency}`;
}

function number(value, digits = 3) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(n(value));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function errorText(error) {
  const data = error?.data;

  if (data?.detail) return data.detail;
  if (data?.message) return data.message;

  if (data && typeof data === "object") {
    return Object.entries(data)
      .map(([key, value]) => {
        const message = Array.isArray(value)
          ? value.join(", ")
          : String(value);
        return `${key}: ${message}`;
      })
      .join(" ");
  }

  return error?.message || "The gas station operation could not be completed.";
}

function nameOfAttendant(attendant) {
  return attendant?.full_name || "Unknown Attendant";
}

function productName(product) {
  return product?.name || `Product #${product?.id ?? "—"}`;
}

function pumpName(pump) {
  return pump?.pump_number
    ? `Pump ${pump.pump_number}`
    : `Pump #${pump?.id ?? "—"}`;
}

function paymentLabel(value) {
  const labels = {
    CASH: "Cash",
    BANK: "Bank",
    MOBILE_MONEY: "Mobile Money",
    CARD: "Card",
    CREDIT: "Credit",
  };

  return labels[value] || value || "—";
}

function statusLabel(value) {
  const labels = {
    DRAFT: "Draft",
    COMPLETED: "Completed",
    VOIDED: "Voided",
  };

  return labels[value] || value || "—";
}

function StatCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="gas-stat-card">
      <div className="gas-stat-icon">
        <Icon size={20} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {helper && <small>{helper}</small>}
      </div>
    </div>
  );
}

function Modal({ open, title, subtitle, onClose, children, width = "760px" }) {
  if (!open) return null;

  return (
    <div
      className="gas-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="gas-modal" style={{ maxWidth: width }}>
        <div className="gas-modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>

          <button
            type="button"
            className="gas-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>

        <div className="gas-modal-body">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, required = false, children, hint }) {
  return (
    <label className="gas-field">
      <span>
        {label}
        {required && <em>*</em>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export default function GasOperations() {
  const { currentCompany } = useCompany();

  const companyId = currentCompany?.id;
  const companyName = currentCompany?.name || "No company selected";
  const currency = currentCompany?.currency || "USD";
  const isGasStation =
    String(currentCompany?.business_type || "").toUpperCase() ===
    "GAS_STATION";

  const [activeTab, setActiveTab] = useState("dashboard");

  const [attendants, setAttendants] = useState([]);
  const [pumps, setPumps] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [salesDate, setSalesDate] = useState(today());

  const [showAttendantModal, setShowAttendantModal] = useState(false);
  const [showPumpModal, setShowPumpModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);

  const [attendantForm, setAttendantForm] = useState({
    employee_code: "",
    full_name: "",
    phone: "",
    is_active: true,
  });

  const [pumpForm, setPumpForm] = useState({
    pump_number: "",
    description: "",
    is_active: true,
  });

  const [saleForm, setSaleForm] = useState({
    attendant: "",
    pump: "",
    fuel_product: "",
    sale_date: today(),
    opening_meter: "",
    closing_meter: "",
    price_per_litre: "",
    payment_method: "CASH",
    reference: "",
    notes: "",
  });

  const load = useCallback(
    async (silent = false) => {
      if (!companyId || !isGasStation) {
        setLoading(false);
        setAttendants([]);
        setPumps([]);
        setProducts([]);
        setSales([]);
        return;
      }

      try {
        if (!silent) setLoading(true);
        setError("");

        const [
          attendantsResponse,
          pumpsResponse,
          productsResponse,
          salesResponse,
        ] = await Promise.all([
          api.get(
            `/api/operations/pump-attendants/?company=${companyId}`
          ),
          api.get(`/api/operations/fuel-pumps/?company=${companyId}`),
          api.get(`/api/operations/products/?company=${companyId}`),
          api.get(`/api/operations/pump-sales/?company=${companyId}`),
        ]);

        setAttendants(list(attendantsResponse));
        setPumps(list(pumpsResponse));
        setProducts(
          list(productsResponse).filter(
            (product) =>
              product.product_type === "FUEL" &&
              product.is_active !== false
          )
        );
        setSales(list(salesResponse));
      } catch (err) {
        console.error("Gas operations load error:", err);
        setError(errorText(err));
      } finally {
        setLoading(false);
      }
    },
    [companyId, isGasStation]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!saleForm.attendant && attendants.length) {
      setSaleForm((current) => ({
        ...current,
        attendant: String(attendants[0].id),
      }));
    }
  }, [attendants, saleForm.attendant]);

  useEffect(() => {
    if (!saleForm.pump && pumps.length) {
      setSaleForm((current) => ({
        ...current,
        pump: String(pumps[0].id),
      }));
    }
  }, [pumps, saleForm.pump]);

  useEffect(() => {
    if (!saleForm.fuel_product && products.length) {
      setSaleForm((current) => ({
        ...current,
        fuel_product: String(products[0].id),
        price_per_litre:
          products[0].selling_price != null
            ? String(products[0].selling_price)
            : "",
      }));
    }
  }, [products, saleForm.fuel_product]);

  const activeAttendants = useMemo(
    () => attendants.filter((item) => item.is_active !== false),
    [attendants]
  );

  const activePumps = useMemo(
    () => pumps.filter((item) => item.is_active !== false),
    [pumps]
  );

  const saleSetup = useMemo(
    () => ({
      attendantsReady: activeAttendants.length > 0,
      pumpsReady: activePumps.length > 0,
      productsReady: products.length > 0,
    }),
    [activeAttendants, activePumps, products]
  );

  const saleReady =
    saleSetup.attendantsReady &&
    saleSetup.pumpsReady &&
    saleSetup.productsReady;

  const missingSaleSetup = useMemo(() => {
    const missing = [];

    if (!saleSetup.pumpsReady) {
      missing.push({
        key: "pumps",
        label: "Active fuel pump",
        description:
          "At least one active pump is required to record meter readings.",
        action: "setup",
      });
    }

    if (!saleSetup.attendantsReady) {
      missing.push({
        key: "attendants",
        label: "Active pump attendant",
        description:
          "At least one active attendant is required to assign the sale.",
        action: "setup",
      });
    }

    if (!saleSetup.productsReady) {
      missing.push({
        key: "products",
        label: "Active fuel product",
        description:
          "At least one active fuel product is required to price the sale.",
        action: "products",
      });
    }

    return missing;
  }, [saleSetup]);

  const selectedProduct = useMemo(
    () =>
      products.find(
        (item) => String(item.id) === String(saleForm.fuel_product)
      ) || null,
    [products, saleForm.fuel_product]
  );

  const calculatedLitres = useMemo(() => {
    if (
      saleForm.opening_meter === "" ||
      saleForm.closing_meter === ""
    ) {
      return 0;
    }

    return Math.max(
      0,
      n(saleForm.closing_meter) - n(saleForm.opening_meter)
    );
  }, [saleForm.opening_meter, saleForm.closing_meter]);

  const calculatedAmount = useMemo(
    () =>
      calculatedLitres *
      n(
        saleForm.price_per_litre ||
          selectedProduct?.selling_price ||
          0
      ),
    [calculatedLitres, saleForm.price_per_litre, selectedProduct]
  );

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...sales]
      .filter((sale) => {
        if (!query) return true;

        const attendant = attendants.find(
          (item) => Number(item.id) === Number(sale.attendant)
        );
        const pump = pumps.find(
          (item) => Number(item.id) === Number(sale.pump)
        );
        const product = products.find(
          (item) => Number(item.id) === Number(sale.fuel_product)
        );

        return [
          sale.reference,
          sale.payment_method,
          sale.status,
          sale.sale_date,
          attendant?.full_name,
          attendant?.employee_code,
          pump?.pump_number,
          product?.name,
          product?.code,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(
        (a, b) =>
          new Date(`${b.sale_date || "1900-01-01"}T00:00:00`) -
          new Date(`${a.sale_date || "1900-01-01"}T00:00:00`)
      );
  }, [sales, attendants, pumps, products, search]);

  const dailySales = useMemo(
    () =>
      sales.filter(
        (sale) => String(sale.sale_date) === String(salesDate)
      ),
    [sales, salesDate]
  );

  const stats = useMemo(() => {
    const todaySales = sales.filter(
      (sale) => String(sale.sale_date) === today()
    );

    return {
      totalSales: sales.length,
      todayTransactions: todaySales.length,
      todayAmount: todaySales.reduce(
        (sum, sale) => sum + n(sale.total_amount),
        0
      ),
      todayLitres: todaySales.reduce(
        (sum, sale) => sum + n(sale.litres_sold),
        0
      ),
      activePumps: activePumps.length,
      activeAttendants: activeAttendants.length,
    };
  }, [sales, activePumps, activeAttendants]);

  const dailyReconciliation = useMemo(() => {
    const grouped = {};

    dailySales.forEach((sale) => {
      const pump = pumps.find(
        (item) => Number(item.id) === Number(sale.pump)
      );
      const product = products.find(
        (item) => Number(item.id) === Number(sale.fuel_product)
      );

      const key = `${sale.pump}-${sale.fuel_product}`;

      if (!grouped[key]) {
        grouped[key] = {
          pump: pumpName(pump),
          fuel: productName(product),
          litres: 0,
          amount: 0,
          transactions: 0,
        };
      }

      grouped[key].litres += n(sale.litres_sold);
      grouped[key].amount += n(sale.total_amount);
      grouped[key].transactions += 1;
    });

    return Object.values(grouped);
  }, [dailySales, pumps, products]);

  const dailyTotals = useMemo(
    () => ({
      transactions: dailySales.length,
      litres: dailySales.reduce(
        (sum, sale) => sum + n(sale.litres_sold),
        0
      ),
      amount: dailySales.reduce(
        (sum, sale) => sum + n(sale.total_amount),
        0
      ),
    }),
    [dailySales]
  );

  function resetSaleForm() {
    setSaleForm({
      attendant: activeAttendants[0]?.id
        ? String(activeAttendants[0].id)
        : "",
      pump: activePumps[0]?.id ? String(activePumps[0].id) : "",
      fuel_product: products[0]?.id ? String(products[0].id) : "",
      sale_date: today(),
      opening_meter: "",
      closing_meter: "",
      price_per_litre:
        products[0]?.selling_price != null
          ? String(products[0].selling_price)
          : "",
      payment_method: "CASH",
      reference: "",
      notes: "",
    });
  }

  function openSaleModal() {
    setError("");
    setNotice("");
    resetSaleForm();
    setShowSaleModal(true);
  }

  function openAttendantModal(attendant = null) {
    setError("");
    setNotice("");
    setEditing(attendant);

    setAttendantForm(
      attendant
        ? {
            employee_code: attendant.employee_code || "",
            full_name: attendant.full_name || "",
            phone: attendant.phone || "",
            is_active: attendant.is_active !== false,
          }
        : {
            employee_code: "",
            full_name: "",
            phone: "",
            is_active: true,
          }
    );

    setShowAttendantModal(true);
  }

  function openPumpModal(pump = null) {
    setError("");
    setNotice("");
    setEditing(pump);

    setPumpForm(
      pump
        ? {
            pump_number: pump.pump_number || "",
            description: pump.description || "",
            is_active: pump.is_active !== false,
          }
        : {
            pump_number: "",
            description: "",
            is_active: true,
          }
    );

    setShowPumpModal(true);
  }

  async function saveAttendant(event) {
    event.preventDefault();

    if (!attendantForm.employee_code.trim()) {
      setError("Employee code is required.");
      return;
    }

    if (!attendantForm.full_name.trim()) {
      setError("Attendant name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const payload = {
        company: Number(companyId),
        employee_code: attendantForm.employee_code.trim(),
        full_name: attendantForm.full_name.trim(),
        phone: attendantForm.phone.trim(),
        is_active: Boolean(attendantForm.is_active),
      };

      const saved = editing
        ? await api.patch(
            `/api/operations/pump-attendants/${editing.id}/`,
            payload
          )
        : await api.post(
            "/api/operations/pump-attendants/",
            payload
          );

      setAttendants((current) =>
        editing
          ? current.map((item) =>
              Number(item.id) === Number(saved.id) ? saved : item
            )
          : [saved, ...current]
      );

      setShowAttendantModal(false);
      setEditing(null);
      setNotice(
        editing
          ? "Pump attendant updated successfully."
          : "Pump attendant created successfully."
      );
    } catch (err) {
      console.error("Attendant save error:", err);
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function savePump(event) {
    event.preventDefault();

    if (!pumpForm.pump_number.trim()) {
      setError("Pump number is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const payload = {
        company: Number(companyId),
        pump_number: pumpForm.pump_number.trim(),
        description: pumpForm.description.trim(),
        is_active: Boolean(pumpForm.is_active),
      };

      const saved = editing
        ? await api.patch(
            `/api/operations/fuel-pumps/${editing.id}/`,
            payload
          )
        : await api.post("/api/operations/fuel-pumps/", payload);

      setPumps((current) =>
        editing
          ? current.map((item) =>
              Number(item.id) === Number(saved.id) ? saved : item
            )
          : [saved, ...current]
      );

      setShowPumpModal(false);
      setEditing(null);
      setNotice(
        editing
          ? "Fuel pump updated successfully."
          : "Fuel pump created successfully."
      );
    } catch (err) {
      console.error("Pump save error:", err);
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveSale(event) {
    event.preventDefault();

    if (!saleForm.attendant) {
      setError("Select a pump attendant.");
      return;
    }

    if (!saleForm.pump) {
      setError("Select a fuel pump.");
      return;
    }

    if (!saleForm.fuel_product) {
      setError("Select a fuel product.");
      return;
    }

    if (saleForm.opening_meter === "" || saleForm.closing_meter === "") {
      setError("Enter both opening and closing meter readings.");
      return;
    }

    if (n(saleForm.closing_meter) < n(saleForm.opening_meter)) {
      setError("Closing meter cannot be less than opening meter.");
      return;
    }

    if (n(saleForm.price_per_litre) <= 0) {
      setError("Price per litre must be greater than zero.");
      return;
    }

    if (calculatedLitres <= 0) {
      setError("The meter readings must produce litres sold greater than zero.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const payload = {
        company: Number(companyId),
        attendant: Number(saleForm.attendant),
        pump: Number(saleForm.pump),
        fuel_product: Number(saleForm.fuel_product),
        sale_date: saleForm.sale_date,
        opening_meter: saleForm.opening_meter,
        closing_meter: saleForm.closing_meter,
        price_per_litre: saleForm.price_per_litre,
        payment_method: saleForm.payment_method,
        reference: saleForm.reference.trim(),
        notes: saleForm.notes.trim(),
        complete: true,
      };

      const saved = await api.post(
        "/api/operations/pump-sales/create/",
        payload
      );

      setSales((current) => [saved, ...current]);
      setShowSaleModal(false);
      setSelectedSale(null);
      setNotice(
        "Fuel sale recorded successfully. Inventory and accounting were updated by the gas station service."
      );
      setActiveTab("sales");
    } catch (err) {
      console.error("Pump sale save error:", err);
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  function openSaleSetup() {
    clearMessages();
    setActiveTab("setup");
  }

  function clearMessages() {
    setError("");
    setNotice("");
  }

  if (!companyId) {
    return (
      <div className="gas-page">
        <div className="gas-empty-page">
          <div className="gas-empty-icon">
            <Fuel size={28} />
          </div>
          <h2>No Company Selected</h2>
          <p>Select a company before opening Gas Operations.</p>
        </div>
      </div>
    );
  }

  if (!isGasStation) {
    return (
      <div className="gas-page">
        <div className="gas-access-card">
          <div className="gas-access-icon">
            <Fuel size={27} />
          </div>
          <div>
            <div className="gas-eyebrow">GAS OPERATIONS</div>
            <h1>Not Available for This Company</h1>
            <p>
              Gas Operations is only available when the selected company is
              configured as a gas station.
            </p>
            <strong>{companyName}</strong>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gas-page">
      <div className="gas-page-header">
        <div>
          <div className="gas-eyebrow">GAS STATION OPERATIONS</div>
          <h1>Gas Operations</h1>
          <p>
            Manage pumps, attendants, fuel sales and daily pump reconciliation
            for {companyName}.
          </p>
        </div>

        <div className="gas-header-actions">
          <button
            type="button"
            className="gas-btn gas-btn-secondary"
            onClick={() => load(true)}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "gas-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            className="gas-btn gas-btn-primary"
            onClick={openSaleModal}
            disabled={!saleReady}
            title={
              saleReady
                ? "Record a fuel sale"
                : "Complete the station setup before recording a fuel sale"
            }
          >
            <Plus size={16} />
            Record Fuel Sale
          </button>
        </div>
      </div>

      <div className="gas-company-strip">
        <div>
          <span>Company</span>
          <strong>{companyName}</strong>
        </div>
        <div>
          <span>Business Type</span>
          <strong>Gas Station</strong>
        </div>
        <div>
          <span>Currency</span>
          <strong>{currency}</strong>
        </div>
      </div>

      {!saleReady && (
        <section className="gas-sale-readiness" aria-label="Fuel sale setup status">
          <div className="gas-sale-readiness-header">
            <div className="gas-sale-readiness-icon">
              <Activity size={19} />
            </div>
            <div className="gas-sale-readiness-copy">
              <div className="gas-section-label">SALE READINESS</div>
              <h2>Complete station setup before recording sales</h2>
              <p>
                This {currency} workspace needs the required station resources
                before a fuel sale can be recorded.
              </p>
            </div>
            <button
              type="button"
              className="gas-btn gas-btn-secondary gas-readiness-action"
              onClick={openSaleSetup}
            >
              Review Station Setup
            </button>
          </div>

          <div className="gas-sale-readiness-list">
            <div
              className={`gas-readiness-item ${
                saleSetup.pumpsReady ? "is-ready" : "is-missing"
              }`}
            >
              <div className="gas-readiness-status">
                {saleSetup.pumpsReady ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <Activity size={17} />
                )}
              </div>
              <div>
                <strong>Fuel Pumps</strong>
                <span>
                  {saleSetup.pumpsReady
                    ? `${activePumps.length} active pump${
                        activePumps.length === 1 ? "" : "s"
                      } available`
                    : "No active fuel pump is configured"}
                </span>
              </div>
            </div>

            <div
              className={`gas-readiness-item ${
                saleSetup.attendantsReady ? "is-ready" : "is-missing"
              }`}
            >
              <div className="gas-readiness-status">
                {saleSetup.attendantsReady ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <Activity size={17} />
                )}
              </div>
              <div>
                <strong>Pump Attendants</strong>
                <span>
                  {saleSetup.attendantsReady
                    ? `${activeAttendants.length} active attendant${
                        activeAttendants.length === 1 ? "" : "s"
                      } available`
                    : "No active pump attendant is configured"}
                </span>
              </div>
            </div>

            <div
              className={`gas-readiness-item ${
                saleSetup.productsReady ? "is-ready" : "is-missing"
              }`}
            >
              <div className="gas-readiness-status">
                {saleSetup.productsReady ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <Activity size={17} />
                )}
              </div>
              <div>
                <strong>Fuel Products</strong>
                <span>
                  {saleSetup.productsReady
                    ? `${products.length} active fuel product${
                        products.length === 1 ? "" : "s"
                      } available`
                    : "No active fuel product is configured"}
                </span>
              </div>
            </div>
          </div>

          {missingSaleSetup.length > 0 && (
            <div className="gas-sale-readiness-footer">
              <span>
                {missingSaleSetup.length === 1
                  ? "1 requirement is still missing."
                  : `${missingSaleSetup.length} requirements are still missing.`}
              </span>
              <span>
                Configure the missing resources for this company workspace,
                then use Refresh.
              </span>
            </div>
          )}
        </section>
      )}

      {error && (
        <div className="gas-alert gas-alert-error">
          <Activity size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}

      {notice && (
        <div className="gas-alert gas-alert-success">
          <CheckCircle2 size={17} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}

      <div className="gas-tabs">
        <button
          type="button"
          className={activeTab === "dashboard" ? "gas-tab-active" : ""}
          onClick={() => {
            clearMessages();
            setActiveTab("dashboard");
          }}
        >
          <Gauge size={16} />
          Dashboard
        </button>

        <button
          type="button"
          className={activeTab === "sales" ? "gas-tab-active" : ""}
          onClick={() => {
            clearMessages();
            setActiveTab("sales");
          }}
        >
          <CircleDollarSign size={16} />
          Fuel Sales
        </button>

        <button
          type="button"
          className={activeTab === "setup" ? "gas-tab-active" : ""}
          onClick={() => {
            clearMessages();
            setActiveTab("setup");
          }}
        >
          <Fuel size={16} />
          Pumps & Attendants
        </button>

        <button
          type="button"
          className={activeTab === "reconciliation" ? "gas-tab-active" : ""}
          onClick={() => {
            clearMessages();
            setActiveTab("reconciliation");
          }}
        >
          <CheckCircle2 size={16} />
          Daily Reconciliation
        </button>
      </div>

      {loading ? (
        <div className="gas-loading">
          <RefreshCw size={23} className="gas-spin" />
          Loading gas station operations...
        </div>
      ) : (
        <>
          {activeTab === "dashboard" && (
            <>
              <div className="gas-stat-grid">
                <StatCard
                  icon={CircleDollarSign}
                  label="Today's Fuel Sales"
                  value={money(stats.todayAmount, currency)}
                  helper={`${stats.todayTransactions} transactions`}
                />
                <StatCard
                  icon={Fuel}
                  label="Gallons Sold Today"
                  value={`${number(stats.todayLitres)} Gal`}
                  helper="Based on pump meter readings"
                />
                <StatCard
                  icon={Gauge}
                  label="Active Pumps"
                  value={stats.activePumps}
                  helper={`${pumps.length} pumps configured`}
                />
                <StatCard
                  icon={Users}
                  label="Active Attendants"
                  value={stats.activeAttendants}
                  helper={`${attendants.length} attendants configured`}
                />
              </div>

              <div className="gas-dashboard-grid">
                <section className="gas-panel">
                  <div className="gas-panel-header">
                    <div>
                      <div className="gas-section-label">OPERATING STATUS</div>
                      <h2>Station Overview</h2>
                    </div>
                    <span className="gas-live-badge">
                      <span />
                      Operational
                    </span>
                  </div>

                  <div className="gas-overview-grid">
                    <div className="gas-overview-item">
                      <Fuel size={18} />
                      <div>
                        <span>Fuel Products</span>
                        <strong>{products.length}</strong>
                      </div>
                    </div>

                    <div className="gas-overview-item">
                      <Gauge size={18} />
                      <div>
                        <span>Active Pumps</span>
                        <strong>{activePumps.length}</strong>
                      </div>
                    </div>

                    <div className="gas-overview-item">
                      <Users size={18} />
                      <div>
                        <span>Active Attendants</span>
                        <strong>{activeAttendants.length}</strong>
                      </div>
                    </div>

                    <div className="gas-overview-item">
                      <CircleDollarSign size={18} />
                      <div>
                        <span>Recorded Sales</span>
                        <strong>{stats.totalSales}</strong>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="gas-panel">
                  <div className="gas-panel-header">
                    <div>
                      <div className="gas-section-label">FUEL CATALOGUE</div>
                      <h2>Fuel Products</h2>
                    </div>
                  </div>

                  {products.length === 0 ? (
                    <div className="gas-mini-empty">
                      No active fuel products are configured.
                    </div>
                  ) : (
                    <div className="gas-product-list">
                      {products.map((product) => (
                        <div className="gas-product-row" key={product.id}>
                          <div className="gas-product-mark">
                            <Fuel size={16} />
                          </div>
                          <div>
                            <strong>{product.name}</strong>
                            <span>
                              {product.code || "No product code"} ·{" "}
                              {product.unit || "litre"}
                            </span>
                          </div>
                          <strong>
                            {money(product.selling_price, currency)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <section className="gas-panel">
                <div className="gas-panel-header">
                  <div>
                    <div className="gas-section-label">RECENT ACTIVITY</div>
                    <h2>Recent Fuel Sales</h2>
                    <p>Latest pump transactions recorded by the station.</p>
                  </div>

                  <button
                    type="button"
                    className="gas-link-button"
                    onClick={() => setActiveTab("sales")}
                  >
                    View all
                  </button>
                </div>

                {sales.length === 0 ? (
                  <div className="gas-empty-table">
                    <CircleDollarSign size={25} />
                    <h3>No fuel sales recorded</h3>
                    <p>Record the first pump sale to begin station activity.</p>
                  </div>
                ) : (
                  <div className="gas-table-wrap">
                    <table className="gas-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Pump</th>
                          <th>Fuel</th>
                          <th>Gallons</th>
                          <th>Amount</th>
                          <th>Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...sales]
                          .sort(
                            (a, b) =>
                              new Date(`${b.sale_date}T00:00:00`) -
                              new Date(`${a.sale_date}T00:00:00`)
                          )
                          .slice(0, 6)
                          .map((sale) => {
                            const pump = pumps.find(
                              (item) =>
                                Number(item.id) === Number(sale.pump)
                            );
                            const product = products.find(
                              (item) =>
                                Number(item.id) ===
                                Number(sale.fuel_product)
                            );

                            return (
                              <tr key={sale.id}>
                                <td>{formatDate(sale.sale_date)}</td>
                                <td>
                                  <strong>{pumpName(pump)}</strong>
                                </td>
                                <td>{productName(product)}</td>
                                <td>{number(sale.litres_sold)} Gal</td>
                                <td className="gas-money-cell">
                                  {money(sale.total_amount, currency)}
                                </td>
                                <td>{paymentLabel(sale.payment_method)}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {activeTab === "sales" && (
            <section className="gas-panel">
              <div className="gas-panel-header gas-panel-header-stack">
                <div>
                  <div className="gas-section-label">PUMP TRANSACTIONS</div>
                  <h2>Fuel Sales</h2>
                  <p>
                    Every completed pump sale records the meter movement,
                    gallons sold, price and payment method.
                  </p>
                </div>

                <div className="gas-toolbar">
                  <div className="gas-search">
                    <Search size={16} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search sales..."
                    />
                    {search && (
                      <button type="button" onClick={() => setSearch("")}>
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className="gas-btn gas-btn-primary"
                    onClick={openSaleModal}
                    disabled={!saleReady}
                    title={
                      saleReady
                        ? "Record a fuel sale"
                        : "Complete the station setup before recording a fuel sale"
                    }
                  >
                    <Plus size={16} />
                    Record Sale
                  </button>
                </div>
              </div>

              {filteredSales.length === 0 ? (
                <div className="gas-empty-table">
                  <CircleDollarSign size={25} />
                  <h3>No fuel sales found</h3>
                  <p>
                    {search
                      ? "Try a different search."
                      : "Record a fuel sale to begin building the station ledger."}
                  </p>
                </div>
              ) : (
                <div className="gas-table-wrap">
                  <table className="gas-table gas-sales-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Pump</th>
                        <th>Attendant</th>
                        <th>Fuel</th>
                        <th>Meter</th>
                        <th>Gallons</th>
                        <th>Amount</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSales.map((sale) => {
                        const pump = pumps.find(
                          (item) => Number(item.id) === Number(sale.pump)
                        );
                        const attendant = attendants.find(
                          (item) =>
                            Number(item.id) === Number(sale.attendant)
                        );
                        const product = products.find(
                          (item) =>
                            Number(item.id) === Number(sale.fuel_product)
                        );

                        return (
                          <tr key={sale.id}>
                            <td>{formatDate(sale.sale_date)}</td>
                            <td>
                              <strong>{pumpName(pump)}</strong>
                            </td>
                            <td>{nameOfAttendant(attendant)}</td>
                            <td>{productName(product)}</td>
                            <td>
                              {number(sale.opening_meter)} →{" "}
                              {number(sale.closing_meter)}
                            </td>
                            <td>{number(sale.litres_sold)} Gal</td>
                            <td className="gas-money-cell">
                              {money(sale.total_amount, currency)}
                            </td>
                            <td>{paymentLabel(sale.payment_method)}</td>
                            <td>
                              <span
                                className={`gas-status gas-status-${String(
                                  sale.status || ""
                                ).toLowerCase()}`}
                              >
                                {statusLabel(sale.status)}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="gas-icon-btn"
                                title="View sale"
                                onClick={() => setSelectedSale(sale)}
                              >
                                <Activity size={16} />
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
          )}

          {activeTab === "setup" && (
            <div className="gas-setup-grid">
              <section className="gas-panel">
                <div className="gas-panel-header">
                  <div>
                    <div className="gas-section-label">PUMP MANAGEMENT</div>
                    <h2>Fuel Pumps</h2>
                    <p>Configure the physical pumps used for fuel sales.</p>
                  </div>

                  <button
                    type="button"
                    className="gas-btn gas-btn-primary"
                    onClick={() => openPumpModal()}
                  >
                    <Plus size={16} />
                    Add Pump
                  </button>
                </div>

                {pumps.length === 0 ? (
                  <div className="gas-empty-table compact">
                    <Gauge size={24} />
                    <h3>No pumps configured</h3>
                    <p>Add the station's fuel pumps before recording sales.</p>
                  </div>
                ) : (
                  <div className="gas-entity-list">
                    {pumps.map((pump) => (
                      <div className="gas-entity-row" key={pump.id}>
                        <div className="gas-entity-icon">
                          <Gauge size={18} />
                        </div>
                        <div className="gas-entity-main">
                          <strong>{pumpName(pump)}</strong>
                          <span>
                            {pump.description || "No description"}
                          </span>
                        </div>
                        <span
                          className={`gas-status ${
                            pump.is_active
                              ? "gas-status-completed"
                              : "gas-status-voided"
                          }`}
                        >
                          {pump.is_active ? "Active" : "Inactive"}
                        </span>
                        <button
                          type="button"
                          className="gas-icon-btn"
                          title="Edit pump"
                          onClick={() => openPumpModal(pump)}
                        >
                          <Edit3 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="gas-panel">
                <div className="gas-panel-header">
                  <div>
                    <div className="gas-section-label">STAFF MANAGEMENT</div>
                    <h2>Pump Attendants</h2>
                    <p>
                      Maintain the attendants responsible for pump activity.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="gas-btn gas-btn-primary"
                    onClick={() => openAttendantModal()}
                  >
                    <Plus size={16} />
                    Add Attendant
                  </button>
                </div>

                {attendants.length === 0 ? (
                  <div className="gas-empty-table compact">
                    <Users size={24} />
                    <h3>No attendants configured</h3>
                    <p>Add pump attendants before recording fuel sales.</p>
                  </div>
                ) : (
                  <div className="gas-entity-list">
                    {attendants.map((attendant) => (
                      <div className="gas-entity-row" key={attendant.id}>
                        <div className="gas-entity-icon">
                          <UserRound size={18} />
                        </div>
                        <div className="gas-entity-main">
                          <strong>{nameOfAttendant(attendant)}</strong>
                          <span>
                            {attendant.employee_code}
                            {attendant.phone
                              ? ` · ${attendant.phone}`
                              : ""}
                          </span>
                        </div>
                        <span
                          className={`gas-status ${
                            attendant.is_active
                              ? "gas-status-completed"
                              : "gas-status-voided"
                          }`}
                        >
                          {attendant.is_active ? "Active" : "Inactive"}
                        </span>
                        <button
                          type="button"
                          className="gas-icon-btn"
                          title="Edit attendant"
                          onClick={() => openAttendantModal(attendant)}
                        >
                          <Edit3 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === "reconciliation" && (
            <section className="gas-panel">
              <div className="gas-panel-header gas-panel-header-stack">
                <div>
                  <div className="gas-section-label">DAILY CONTROL</div>
                  <h2>Daily Pump Reconciliation</h2>
                  <p>
                    Review litres and system sales value by pump and fuel
                    product for the selected date.
                  </p>
                </div>

                <div className="gas-date-control">
                  <label>Date</label>
                  <input
                    type="date"
                    value={salesDate}
                    onChange={(event) => setSalesDate(event.target.value)}
                  />
                </div>
              </div>

              <div className="gas-recon-kpis">
                <div>
                  <span>Transactions</span>
                  <strong>{dailyTotals.transactions}</strong>
                </div>
                <div>
                  <span>Litres Sold</span>
                  <strong>{number(dailyTotals.litres)} L</strong>
                </div>
                <div>
                  <span>System Sales</span>
                  <strong>{money(dailyTotals.amount, currency)}</strong>
                </div>
              </div>

              {dailyReconciliation.length === 0 ? (
                <div className="gas-empty-table">
                  <CheckCircle2 size={25} />
                  <h3>No sales for {formatDate(salesDate)}</h3>
                  <p>
                    There are no completed pump sales recorded for the selected
                    date.
                  </p>
                </div>
              ) : (
                <div className="gas-table-wrap">
                  <table className="gas-table">
                    <thead>
                      <tr>
                        <th>Pump</th>
                        <th>Fuel</th>
                        <th>Transactions</th>
                        <th>Litres Sold</th>
                        <th>System Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyReconciliation.map((row) => (
                        <tr key={`${row.pump}-${row.fuel}`}>
                          <td>
                            <strong>{row.pump}</strong>
                          </td>
                          <td>{row.fuel}</td>
                          <td>{row.transactions}</td>
                          <td>{number(row.litres)} L</td>
                          <td className="gas-money-cell">
                            {money(row.amount, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th colSpan="2">Daily Total</th>
                        <th>{dailyTotals.transactions}</th>
                        <th>{number(dailyTotals.litres)} L</th>
                        <th>{money(dailyTotals.amount, currency)}</th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <div className="gas-recon-note">
                <CheckCircle2 size={17} />
                <div>
                  <strong>Control note</strong>
                  <p>
                    This reconciliation is based on completed pump sales
                    recorded in the system. Cash or payment-method variance can
                    only be determined when the station's physical collections
                    are compared with these system totals.
                  </p>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      <Modal
        open={showAttendantModal}
        title={editing ? "Edit Pump Attendant" : "Add Pump Attendant"}
        subtitle={`Maintain pump attendant details for ${companyName}.`}
        onClose={() => {
          if (!saving) {
            setShowAttendantModal(false);
            setEditing(null);
          }
        }}
      >
        <form className="gas-form" onSubmit={saveAttendant}>
          <div className="gas-form-grid">
            <Field label="Employee Code" required>
              <input
                value={attendantForm.employee_code}
                onChange={(event) =>
                  setAttendantForm((current) => ({
                    ...current,
                    employee_code: event.target.value,
                  }))
                }
                placeholder="ATT-001"
              />
            </Field>

            <Field label="Full Name" required>
              <input
                value={attendantForm.full_name}
                onChange={(event) =>
                  setAttendantForm((current) => ({
                    ...current,
                    full_name: event.target.value,
                  }))
                }
                placeholder="John Doe"
              />
            </Field>

            <Field label="Phone">
              <input
                value={attendantForm.phone}
                onChange={(event) =>
                  setAttendantForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="077..."
              />
            </Field>

            <label className="gas-checkbox-field">
              <input
                type="checkbox"
                checked={Boolean(attendantForm.is_active)}
                onChange={(event) =>
                  setAttendantForm((current) => ({
                    ...current,
                    is_active: event.target.checked,
                  }))
                }
              />
              <span>Attendant is active</span>
            </label>
          </div>

          <div className="gas-form-actions">
            <button
              type="button"
              className="gas-btn gas-btn-secondary"
              onClick={() => {
                setShowAttendantModal(false);
                setEditing(null);
              }}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="gas-btn gas-btn-primary"
              disabled={saving}
            >
              {saving ? (
                <RefreshCw size={16} className="gas-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              {editing ? "Save Changes" : "Create Attendant"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showPumpModal}
        title={editing ? "Edit Fuel Pump" : "Add Fuel Pump"}
        subtitle={`Maintain pump configuration for ${companyName}.`}
        onClose={() => {
          if (!saving) {
            setShowPumpModal(false);
            setEditing(null);
          }
        }}
      >
        <form className="gas-form" onSubmit={savePump}>
          <div className="gas-form-grid">
            <Field label="Pump Number" required>
              <input
                value={pumpForm.pump_number}
                onChange={(event) =>
                  setPumpForm((current) => ({
                    ...current,
                    pump_number: event.target.value,
                  }))
                }
                placeholder="01"
              />
            </Field>

            <Field label="Description">
              <input
                value={pumpForm.description}
                onChange={(event) =>
                  setPumpForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Main forecourt pump"
              />
            </Field>

            <label className="gas-checkbox-field">
              <input
                type="checkbox"
                checked={Boolean(pumpForm.is_active)}
                onChange={(event) =>
                  setPumpForm((current) => ({
                    ...current,
                    is_active: event.target.checked,
                  }))
                }
              />
              <span>Pump is active</span>
            </label>
          </div>

          <div className="gas-form-actions">
            <button
              type="button"
              className="gas-btn gas-btn-secondary"
              onClick={() => {
                setShowPumpModal(false);
                setEditing(null);
              }}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="gas-btn gas-btn-primary"
              disabled={saving}
            >
              {saving ? (
                <RefreshCw size={16} className="gas-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              {editing ? "Save Changes" : "Create Pump"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showSaleModal}
        title="Record Fuel Sale"
        subtitle={`Record a completed pump sale for ${companyName}.`}
        onClose={() => {
          if (!saving) setShowSaleModal(false);
        }}
        width="860px"
      >
        <form className="gas-form" onSubmit={saveSale}>
          <div className="gas-form-grid">
            <Field label="Pump Attendant" required>
              <select
                value={saleForm.attendant}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    attendant: event.target.value,
                  }))
                }
              >
                <option value="">Select attendant</option>
                {activeAttendants.map((attendant) => (
                  <option key={attendant.id} value={attendant.id}>
                    {nameOfAttendant(attendant)} — {attendant.employee_code}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Fuel Pump" required>
              <select
                value={saleForm.pump}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    pump: event.target.value,
                  }))
                }
              >
                <option value="">Select pump</option>
                {activePumps.map((pump) => (
                  <option key={pump.id} value={pump.id}>
                    {pumpName(pump)}
                    {pump.description ? ` — ${pump.description}` : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Fuel Product" required>
              <select
                value={saleForm.fuel_product}
                onChange={(event) => {
                  const product = products.find(
                    (item) => String(item.id) === event.target.value
                  );

                  setSaleForm((current) => ({
                    ...current,
                    fuel_product: event.target.value,
                    price_per_litre:
                      product?.selling_price != null
                        ? String(product.selling_price)
                        : current.price_per_litre,
                  }));
                }}
              >
                <option value="">Select fuel</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                    {product.code ? ` — ${product.code}` : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Sale Date" required>
              <input
                type="date"
                value={saleForm.sale_date}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    sale_date: event.target.value,
                  }))
                }
              />
            </Field>

            <Field label="Opening Meter" required hint="Enter the opening pump reading.">
              <input
                type="number"
                min="0"
                step="0.001"
                value={saleForm.opening_meter}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    opening_meter: event.target.value,
                  }))
                }
                placeholder="10000.000"
              />
            </Field>

            <Field label="Closing Meter" required hint="Must be equal to or greater than opening meter.">
              <input
                type="number"
                min="0"
                step="0.001"
                value={saleForm.closing_meter}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    closing_meter: event.target.value,
                  }))
                }
                placeholder="10035.500"
              />
            </Field>

            <Field label={`Price Per Gallon (${currency})`} required>
              <input
                type="number"
                min="0"
                step="0.01"
                value={saleForm.price_per_litre}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    price_per_litre: event.target.value,
                  }))
                }
                placeholder="5.50"
              />
            </Field>

            <Field label="Payment Method" required>
              <select
                value={saleForm.payment_method}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    payment_method: event.target.value,
                  }))
                }
              >
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="CARD">Card</option>
                <option value="CREDIT">Credit</option>
              </select>
            </Field>

            <Field label="Reference">
              <input
                value={saleForm.reference}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    reference: event.target.value,
                  }))
                }
                placeholder="Receipt or transaction reference"
              />
            </Field>

            <Field label="Notes">
              <textarea
                rows="3"
                value={saleForm.notes}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Optional sale notes"
              />
            </Field>
          </div>

          <div className="gas-sale-preview">
            <div>
              <span>Gallons Sold</span>
              <strong>{number(calculatedLitres)} Gal</strong>
            </div>
            <div>
              <span>Unit Price</span>
              <strong>
                {money(
                  saleForm.price_per_litre ||
                    selectedProduct?.selling_price ||
                    0,
                  currency
                )}
              </strong>
            </div>
            <div className="gas-sale-preview-total">
              <span>Calculated Sale Value</span>
              <strong>{money(calculatedAmount, currency)}</strong>
            </div>
          </div>

          <div className="gas-form-note">
            <Fuel size={16} />
            <span>
              Litres sold and total amount are calculated by the backend from
              the meter readings and price per litre. The completed sale is
              then connected to the station's inventory and accounting records.
            </span>
          </div>

          <div className="gas-form-actions">
            <button
              type="button"
              className="gas-btn gas-btn-secondary"
              onClick={() => setShowSaleModal(false)}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="gas-btn gas-btn-primary"
              disabled={saving || !saleReady}
            >
              {saving ? (
                <RefreshCw size={16} className="gas-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Record Fuel Sale
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(selectedSale)}
        title={selectedSale ? `Fuel Sale #${selectedSale.id}` : "Fuel Sale"}
        subtitle={
          selectedSale
            ? `Recorded ${formatDate(selectedSale.sale_date)}`
            : ""
        }
        onClose={() => setSelectedSale(null)}
        width="700px"
      >
        {selectedSale && (
          <div className="gas-sale-detail">
            <div className="gas-detail-grid">
              <div>
                <span>Pump</span>
                <strong>
                  {pumpName(
                    pumps.find(
                      (item) =>
                        Number(item.id) === Number(selectedSale.pump)
                    )
                  )}
                </strong>
              </div>

              <div>
                <span>Attendant</span>
                <strong>
                  {nameOfAttendant(
                    attendants.find(
                      (item) =>
                        Number(item.id) === Number(selectedSale.attendant)
                    )
                  )}
                </strong>
              </div>

              <div>
                <span>Fuel</span>
                <strong>
                  {productName(
                    products.find(
                      (item) =>
                        Number(item.id) === Number(selectedSale.fuel_product)
                    )
                  )}
                </strong>
              </div>

              <div>
                <span>Payment</span>
                <strong>
                  {paymentLabel(selectedSale.payment_method)}
                </strong>
              </div>

              <div>
                <span>Opening Meter</span>
                <strong>{number(selectedSale.opening_meter)}</strong>
              </div>

              <div>
                <span>Closing Meter</span>
                <strong>{number(selectedSale.closing_meter)}</strong>
              </div>

              <div>
                <span>Litres Sold</span>
                <strong>{number(selectedSale.litres_sold)} L</strong>
              </div>

              <div className="gas-detail-highlight">
                <span>Total Amount</span>
                <strong>
                  {money(selectedSale.total_amount, currency)}
                </strong>
              </div>
            </div>

            {selectedSale.reference && (
              <div className="gas-detail-note">
                <span>Reference</span>
                <strong>{selectedSale.reference}</strong>
              </div>
            )}

            {selectedSale.notes && (
              <div className="gas-detail-note">
                <span>Notes</span>
                <strong>{selectedSale.notes}</strong>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
