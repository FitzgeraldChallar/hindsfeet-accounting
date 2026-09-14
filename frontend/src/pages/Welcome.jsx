import {
  ArrowRight,
  BarChart3,
  Banknote,
  BriefcaseBusiness,
  Calculator,
  CreditCard,
  FileBarChart,
  HandCoins,
  Landmark,
  Package,
  Receipt,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useCompany } from "../context/CompanyContext";

import "./Welcome.css";


const quickLinks = [
  {
    title: "Sales",
    description: "Manage customers, products and sales activity.",
    icon: ShoppingCart,
    path: "/sales/customers",
  },
  {
    title: "Invoicing",
    description: "Create invoices, record payments and manage statements.",
    icon: Receipt,
    path: "/invoicing/invoices",
  },
  {
    title: "Accounts Receivable",
    description: "Stay on top of customer balances and receivables.",
    icon: HandCoins,
    path: "/accounts-receivable",
  },
  {
    title: "Purchases",
    description: "Manage suppliers, bills and purchase activity.",
    icon: ShoppingCart,
    path: "/purchases/suppliers",
  },
  {
    title: "Accounts Payable",
    description: "Manage supplier balances, bills and payments.",
    icon: CreditCard,
    path: "/accounts-payable",
  },
  {
    title: "Expenses",
    description: "Record and organize your business expenses.",
    icon: Wallet,
    path: "/expenses",
  },
  {
    title: "Inventory",
    description: "Keep products, stock and inventory activity organized.",
    icon: Package,
    path: "/inventory",
  },
  {
    title: "Banking",
    description: "Manage bank accounts and banking transactions.",
    icon: Landmark,
    path: "/banking",
  },
  {
    title: "Accounting",
    description: "Access accounts, journals and core accounting tools.",
    icon: Calculator,
    path: "/accounting/chart-of-accounts",
  },
  {
    title: "Payroll",
    description: "Manage employees and your payroll workflow.",
    icon: Users,
    path: "/payroll",
  },
  {
    title: "Reports",
    description: "Access financial and operational reports.",
    icon: FileBarChart,
    path: "/reports/financial",
  },
  {
    title: "Companies",
    description: "Manage your companies and business workspaces.",
    icon: BriefcaseBusiness,
    path: "/companies",
  },
];


function getUserName(user) {
  if (!user) {
    return "there";
  }

  const firstName =
    user.first_name ||
    user.firstName ||
    user.firstname;

  if (firstName) {
    return firstName;
  }

  if (user.full_name) {
    return user.full_name.split(" ")[0];
  }

  if (user.name) {
    return user.name.split(" ")[0];
  }

  if (user.username) {
    return user.username;
  }

  return "there";
}


function getInitials(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "H";
  }

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}


export default function Welcome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentCompany } = useCompany();

  const userName = getUserName(user);

  const companyName =
    currentCompany?.name ||
    "your company";

  const companyLegalName =
    currentCompany?.legal_name ||
    "";

  const companyDisplayName =
    companyLegalName &&
    companyLegalName !== companyName
      ? `${companyName} - ${companyLegalName}`
      : companyName;

  return (
    <div className="welcome-page">
      <div className="welcome-background welcome-background-one" />
      <div className="welcome-background welcome-background-two" />

      <div className="welcome-content">
        <section className="welcome-hero">
          <div className="welcome-hero-copy">
            <div className="welcome-eyebrow">
              <span className="welcome-eyebrow-dot" />
              HINDSFEET ACCOUNTING
            </div>

            <h1>
              Welcome back,{" "}
              <span>{userName}</span>
              <span className="welcome-wave">
                👋
              </span>
            </h1>

            <p className="welcome-lead">
              Everything you need to manage your
              business is right here. Take a moment,
              get comfortable, and let's get started.
            </p>

            <div className="welcome-company-card">
              <div className="welcome-company-icon">
                <BuildingIcon />
              </div>

              <div className="welcome-company-info">
                <span>YOU ARE WORKING WITH</span>
                <strong>{companyDisplayName}</strong>
              </div>
            </div>

            <button
              type="button"
              className="welcome-primary-button"
              onClick={() =>
                navigate("/dashboard")
              }
            >
              <span>Let's Get Started</span>
              <span className="welcome-primary-icon">
                <ArrowRight size={18} />
              </span>
            </button>

            <p className="welcome-helper">
              Your financial dashboard is waiting for you.
            </p>
          </div>

          <div className="welcome-hero-visual">
            <div className="welcome-orbit welcome-orbit-one" />
            <div className="welcome-orbit welcome-orbit-two" />

            <div className="welcome-visual-card welcome-visual-main">
              <div className="welcome-visual-logo">
                <BarChart3 size={32} strokeWidth={2.2} />
              </div>

              <div>
                <span>YOUR BUSINESS</span>
                <strong>All in one place.</strong>
              </div>
            </div>

            <div className="welcome-floating-card welcome-floating-top">
              <div className="welcome-floating-icon">
                <Banknote size={18} />
              </div>
              <div>
                <strong>Stay organized</strong>
                <span>Manage with confidence</span>
              </div>
            </div>

            <div className="welcome-floating-card welcome-floating-bottom">
              <div className="welcome-floating-icon">
                <Calculator size={18} />
              </div>
              <div>
                <strong>Work smarter</strong>
                <span>Everything connected</span>
              </div>
            </div>
          </div>
        </section>


        <section className="welcome-quick-section">
          <div className="welcome-section-heading">
            <div>
              <span className="welcome-section-label">
                QUICK ACCESS
              </span>

              <h2>
                Where would you like to go?
              </h2>

              <p>
                Jump directly into the area you
                need to work on.
              </p>
            </div>
          </div>


          <div className="welcome-module-grid">
            {quickLinks.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.title}
                  type="button"
                  className="welcome-module-card"
                  onClick={() =>
                    navigate(item.path)
                  }
                >
                  <div className="welcome-module-icon">
                    <Icon
                      size={20}
                      strokeWidth={2}
                    />
                  </div>

                  <div className="welcome-module-content">
                    <strong>{item.title}</strong>
                    <span>
                      {item.description}
                    </span>
                  </div>

                  <ArrowRight
                    className="welcome-module-arrow"
                    size={17}
                  />
                </button>
              );
            })}
          </div>
        </section>


        <footer className="welcome-footer">
          <div>
            <strong>Hindsfeet Accounting</strong>
            <span>
              Financial management made simple.
            </span>
          </div>

          <span>
            {companyName}
          </span>
        </footer>
      </div>
    </div>
  );
}


function BuildingIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 21V5.5L12 2l8 3.5V21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 21v-3h8v3M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
