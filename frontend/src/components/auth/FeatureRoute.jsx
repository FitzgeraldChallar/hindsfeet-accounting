import { Link, Navigate } from "react-router-dom";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";

const FEATURE_LABELS = {
  core_accounting: "Core Accounting",
  sales_invoicing: "Sales and Invoicing",
  purchases_expenses: "Purchases and Expenses",
  banking: "Banking",
  standard_reports: "Standard Reports",
  accounts_receivable: "Accounts Receivable",
  accounts_payable: "Accounts Payable",
  inventory: "Inventory Management",
  payroll: "Payroll",
  expanded_reports: "Expanded Reports",
  gas_operations: "Gas Operations",
  lra_tax_automation: "LRA Tax Automation",
};

export default function FeatureRoute({ feature, children }) {
  const { loading, currentCompany, subscription, subscriptionFeatures, workspaceLoading } = useCompany();

  if (loading || workspaceLoading) {
    return <div className="page-loading">Checking your subscription access...</div>;
  }

  if (!currentCompany) {
    return <Navigate to="/companies" replace />;
  }

  const active = Boolean(subscription?.is_currently_active);
  const allowed = active && Boolean(subscriptionFeatures?.[feature]);

  if (allowed) return children;

  const featureName = FEATURE_LABELS[feature] || "this feature";
  const status = subscription?.status || "PENDING";

  return (
    <section className="subscription-lock-page">
      <div className="subscription-lock-card">
        <div className="subscription-lock-icon"><LockKeyhole size={25} /></div>
        <span className="subscription-eyebrow">PLAN ACCESS</span>
        <h1>{featureName} is not included in your current plan</h1>
        <p>
          Your organization is currently on <strong>{subscription?.plan_name || "no active plan"}</strong>.
          {status === "PENDING"
            ? " Your subscription is awaiting activation by Hindsfeet."
            : " Contact Hindsfeet to upgrade your subscription and unlock this module."}
        </p>
        <div className="subscription-lock-actions">
          <Link to="/subscription" className="primary-action-link">
            View subscription <ArrowUpRight size={16} />
          </Link>
          <Link to="/support" className="secondary-action-link">Contact support</Link>
        </div>
      </div>
    </section>
  );
}
