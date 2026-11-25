import {
  Activity,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Calculator,
  ChevronDown,
  CreditCard,
  FileBarChart,
  HandCoins,
  Landmark,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  Fuel,
  Gauge,
  LifeBuoy,
  UserRoundCog,
} from "lucide-react";

import { useState } from "react";
import { NavLink } from "react-router-dom";

import { useCompany } from "../../context/CompanyContext";
import logoImage from "../../assets/hindsfeet-logo.png";

const navigation = [
  {
    label: "Dashboard",
    icon: Gauge,
    path: "/dashboard",
  },
  {
    label: "Companies",
    icon: BriefcaseBusiness,
    path: "/companies",
  },
  {
    label: "Sales",
    feature: "sales_invoicing",
    icon: ShoppingCart,
    children: [
      { label: "Customers", path: "/sales/customers" },
      { label: "Products / Services", path: "/sales/products" },
      { label: "Sales Transactions", path: "/sales/transactions" },
    ],
  },
  {
    label: "Invoicing",
    feature: "sales_invoicing",
    icon: Receipt,
    children: [
      { label: "Invoices", path: "/invoicing/invoices" },
      { label: "Create Invoice", path: "/invoicing/create" },
      { label: "Payments", path: "/invoicing/payments" },
      { label: "Invoice Statements", path: "/invoicing/statements" },
    ],
  },
  {
    label: "Accounts Receivable",
    feature: "accounts_receivable",
    icon: HandCoins,
    children: [
      { label: "AR Dashboard", path: "/accounts-receivable" },
      { label: "Customer Balances", path: "/accounts-receivable/customer-balances" },
      { label: "Outstanding Invoices", path: "/accounts-receivable/outstanding" },
      { label: "Aging Report", path: "/accounts-receivable/aging" },
      { label: "Customer Statements", path: "/accounts-receivable/statements" },
      { label: "Receivable Transactions", path: "/accounts-receivable/transactions" },
    ],
  },
  {
    label: "Purchases",
    feature: "purchases_expenses",
    icon: ShoppingCart,
    children: [
      { label: "Suppliers", path: "/purchases/suppliers" },
      { label: "Bills", path: "/purchases/bills" },
      { label: "Purchase Transactions", path: "/purchases/transactions" },
    ],
  },
  {
    label: "Accounts Payable",
    feature: "accounts_payable",
    icon: CreditCard,
    children: [
      { label: "AP Dashboard", path: "/accounts-payable" },
      { label: "Supplier Balances", path: "/accounts-payable/supplier-balances" },
      { label: "Outstanding Bills", path: "/accounts-payable/outstanding" },
      { label: "Aging Report", path: "/accounts-payable/aging" },
      { label: "Supplier Statements", path: "/accounts-payable/statements" },
      { label: "Payable Transactions", path: "/accounts-payable/transactions" },
    ],
  },
  {
    label: "Expenses",
    feature: "purchases_expenses",
    icon: Wallet,
    path: "/expenses",
  },
  {
    label: "Inventory",
    feature: "inventory",
    icon: Package,
    path: "/inventory",
  },
  {
  label: "Banking",
  feature: "banking",
  icon: Landmark,
  children: [
    {
      label: "Banking Dashboard",
      path: "/banking",
    },
    {
      label: "Bank Accounts",
      path: "/banking/accounts",
    },
    {
      label: "Deposits",
      path: "/banking/deposits",
    },
    {
      label: "Withdrawals",
      path: "/banking/withdrawals",
    },
    {
      label: "Transfers",
      path: "/banking/transfers",
    },
    {
      label: "Bank Fees",
      path: "/banking/fees",
    },
    {
      label: "Interest",
      path: "/banking/interest",
    },
    {
      label: "Adjustments",
      path: "/banking/adjustments",
    },
    {
      label: "Transactions",
      path: "/banking/transactions",
    },
  ],
},
  {
    label: "Accounting",
    feature: "core_accounting",
    icon: Calculator,
    children: [
      { label: "Chart of Accounts", path: "/accounting/chart-of-accounts" },
      { label: "Journal Entries", path: "/accounting/journal-entries" },
      { label: "General Ledger", path: "/accounting/general-ledger" },
      { label: "Trial Balance", path: "/accounting/trial-balance" },
      { label: "Income Statement", path: "/accounting/income-statement" },
      { label: "Balance Sheet", path: "/accounting/balance-sheet" },
      { label: "Cash Flow Statement", path: "/accounting/cash-flow" },
    ],
  },
  {
    label: "Payroll",
    feature: "payroll",
    icon: Users,
    path: "/payroll",
  },
  {
    label: "Gas Operations",
    feature: "gas_operations",
    icon: Fuel,
    path: "/gas-operations",
    gasOnly: true,
  },
  {
    label: "Reports",
    feature: "standard_reports",
    icon: FileBarChart,
    children: [
      { label: "Financial Reports", path: "/reports/financial" },
      { label: "AR Reports", path: "/reports/ar", feature: "accounts_receivable" },
      { label: "AP Reports", path: "/reports/ap", feature: "accounts_payable" },
      { label: "Sales Reports", path: "/reports/sales", feature: "sales_invoicing" },
      { label: "Purchase Reports", path: "/reports/purchases", feature: "accounts_payable" },
      { label: "Expense Reports", path: "/reports/expenses", feature: "purchases_expenses" },
      { label: "Inventory Reports", path: "/reports/inventory", feature: "inventory" },
      { label: "Payroll Reports", path: "/reports/payroll", feature: "payroll" },
      { label: "Gas Reports", path: "/reports/gas", gasOnly: true, feature: "gas_operations" },
    ],
  },
  {
    label: "Audit / Activity",
    feature: "core_accounting",
    icon: Activity,
    path: "/audit",
  },
  {
    label: "Team Members",
    icon: UserRoundCog,
    path: "/team",
  },
  {
    label: "Email Support",
    icon: LifeBuoy,
    path: "/support",
  },
  {
    label: "Subscription",
    icon: CreditCard,
    path: "/subscription",
  },
  {
    label: "Settings",
    icon: Settings,
    path: "/settings",
  },
];

function SidebarItem({ item, isGasStation, features, subscriptionActive }) {
  const [open, setOpen] = useState(false);

  if (item.gasOnly && !isGasStation) {
    return null;
  }

  if (item.feature && (!subscriptionActive || !features?.[item.feature])) {
    return null;
  }

  const visibleChildren = item.children?.filter(
    (child) =>
      (!child.gasOnly || isGasStation) &&
      (!child.feature || (subscriptionActive && features?.[child.feature]))
  );

  const Icon = item.icon;

  if (item.children && visibleChildren.length === 0) {
    return null;
  }

  if (!visibleChildren) {
    return (
      <NavLink
        to={item.path}
        className={({ isActive }) =>
          `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
        }
      >
        <Icon size={18} strokeWidth={2} />
        <span>{item.label}</span>
      </NavLink>
    );
  }

  return (
    <div className="sidebar-group">
      <button
        type="button"
        className={`sidebar-group-button ${
          open ? "sidebar-group-button-open" : ""
        }`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="sidebar-group-label">
          <Icon size={18} strokeWidth={2} />
          <span>{item.label}</span>
        </span>

        <ChevronDown
          size={15}
          className={
            open
              ? "sidebar-chevron sidebar-chevron-open"
              : "sidebar-chevron"
          }
        />
      </button>

      {open && (
        <div className="sidebar-submenu">
          {visibleChildren.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              className={({ isActive }) =>
                `sidebar-submenu-link ${
                  isActive ? "sidebar-submenu-link-active" : ""
                }`
              }
            >
              <span className="sidebar-submenu-dot" />
              <span>{child.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { currentCompany, subscription, subscriptionFeatures } = useCompany();

  const subscriptionActive = Boolean(subscription?.is_currently_active);
  const isGasStation =
    String(currentCompany?.business_type || "").toUpperCase() ===
    "GAS_STATION";

  const visibleNavigation = navigation.filter(
    (item) => !item.gasOnly || isGasStation
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark" style={{ backgroundColor: "#ffffff" }}>
          <img src={logoImage} alt="Logo" style={{ mixBlendMode: "multiply" }} />
        </div>

        <div>
          <div className="sidebar-brand-name">Hindsfeet</div>
          <div className="sidebar-brand-subtitle">ACCOUNTING</div>
        </div>
      </div>

      <nav className="sidebar-navigation">
        <div className="sidebar-section-label">WORKSPACE</div>

        {visibleNavigation.map((item) => (
          <SidebarItem
            key={item.label}
            item={item}
            isGasStation={isGasStation}
            features={subscriptionFeatures}
            subscriptionActive={subscriptionActive}
          />
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-icon">
          <BookOpen size={16} />
        </div>

        <div>
          <div className="sidebar-footer-title">Hindsfeet Accounting</div>
          <div className="sidebar-footer-text">
            Financial management made simple.
          </div>
        </div>
      </div>
    </aside>
  );
}
