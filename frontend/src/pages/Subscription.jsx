import "./AccountPages.css";
import { useMemo } from "react";
import { CalendarDays, CheckCircle2, Clock3, CreditCard, ShieldCheck, RefreshCw } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import { useCompany } from "../context/CompanyContext";

const FEATURE_LABELS = {
  core_accounting: "Core accounting",
  sales_invoicing: "Sales and invoicing",
  purchases_expenses: "Purchases and expenses",
  banking: "Banking",
  standard_reports: "Standard financial reports",
  multi_currency: "USD and LRD transactions",
  email_support: "Email support",
  company_users: "Multiple organization users",
  accounts_receivable: "Accounts receivable",
  accounts_payable: "Accounts payable",
  inventory: "Inventory management",
  payroll: "Payroll management",
  expanded_reports: "Expanded management reports",
  advanced_bi: "Advanced business intelligence",
  gas_operations: "Gas operations",
  lra_tax_automation: "LRA payroll tax automation",
  enhanced_support: "Enhanced support",
};

function formatDate(value) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
}

export default function Subscription() {
  const { currentCompany, subscription, subscriptionFeatures, refreshWorkspace, workspaceLoading } = useCompany();
  const features = useMemo(
    () => Object.entries(subscriptionFeatures || {}).filter(([, enabled]) => enabled),
    [subscriptionFeatures]
  );

  const isActive = Boolean(subscription?.is_currently_active);
  const effectiveStatus = subscription?.access_status || subscription?.status;
  const statusLabel = effectiveStatus === "PENDING"
    ? "Awaiting activation"
    : effectiveStatus || "No subscription";

  return (
    <div className="page-stack subscription-page">
      <PageHeader
        title="Subscription"
        description="View your organization's Hindsfeet plan and feature access."
        action={<button className="secondary-action-link" type="button" onClick={refreshWorkspace} disabled={workspaceLoading}><RefreshCw size={15} /> Refresh status</button>}
      />

      <div className="subscription-overview-grid">
        <section className="subscription-plan-card">
          <div className="subscription-plan-topline">
            <span className="subscription-eyebrow">CURRENT PLAN</span>
            <span className={`subscription-status ${isActive ? "is-active" : "is-pending"}`}>
              {isActive ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
              {statusLabel}
            </span>
          </div>
          <h2>{subscription?.plan_name || "No subscription"}</h2>
          <div className="subscription-price">
            {subscription?.monthly_price != null ? `$${Number(subscription.monthly_price).toLocaleString("en-US")}` : "—"}
            <span>/ month</span>
          </div>
          <p className="subscription-company-name">{currentCompany?.name}</p>
          <div className="subscription-meta-grid">
            <div><CalendarDays size={16} /><span>Starts</span><strong>{formatDate(subscription?.starts_at)}</strong></div>
            <div><CalendarDays size={16} /><span>Expires</span><strong>{formatDate(subscription?.ends_at)}</strong></div>
            <div><CreditCard size={16} /><span>Payment reference</span><strong>{subscription?.payment_reference || "Not recorded"}</strong></div>
          </div>
          {!isActive && (
            <div className="subscription-notice">
              Your organization's subscription is not active yet. Hindsfeet will activate it after manually verifying payment.
            </div>
          )}
        </section>

        <section className="subscription-side-card">
          <div className="subscription-side-icon"><ShieldCheck size={22} /></div>
          <h3>Need to change your plan?</h3>
          <p>Plan upgrades, renewals and payment verification are handled by the Hindsfeet administration team.</p>
          <a href="/support" className="primary-action-link">Contact Hindsfeet</a>
        </section>
      </div>

      <section className="subscription-features-card">
        <div className="subscription-section-heading">
          <div><h3>Included features</h3><p>Features currently assigned to this subscription plan.</p></div>
          <span>{features.length} enabled</span>
        </div>
        {features.length ? (
          <div className="subscription-feature-grid">
            {features.map(([key]) => (
              <div className="subscription-feature-item" key={key}>
                <CheckCircle2 size={17} />
                <span>{FEATURE_LABELS[key] || key.replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="subscription-empty">No features are currently enabled. Please contact Hindsfeet support.</p>
        )}
      </section>
    </div>
  );
}
