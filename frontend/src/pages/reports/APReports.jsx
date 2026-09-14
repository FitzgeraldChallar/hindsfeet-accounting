import React from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ClipboardList,
  FileBarChart,
  FileText,
  Landmark,
  Receipt,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCompany } from "../../context/CompanyContext";

const REPORTS = [
  {
    title: "Supplier Balances",
    description:
      "Review total billed, payments made and outstanding balances for each supplier.",
    path: "/accounts-payable/supplier-balances",
    icon: Users,
  },
  {
    title: "Outstanding Bills",
    description:
      "View supplier bills that still have unpaid balances and monitor upcoming obligations.",
    path: "/accounts-payable/outstanding",
    icon: Receipt,
  },
  {
    title: "Payables Aging",
    description:
      "Analyze outstanding supplier balances by current, 1–30, 31–60, 61–90 and 90+ days.",
    path: "/accounts-payable/aging",
    icon: BarChart3,
  },
  {
    title: "Supplier Statements",
    description:
      "Review supplier bills, payments and running account activity.",
    path: "/accounts-payable/statements",
    icon: FileText,
  },
  {
    title: "Payable Transactions",
    description:
      "Review posted supplier bills and payments affecting Accounts Payable.",
    path: "/accounts-payable/transactions",
    icon: ClipboardList,
  },
];

export default function APReports() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();

  const companyName =
    currentCompany?.name || "No company selected";

  const currency =
    currentCompany?.currency || "USD";

  return (
    <div className="reports-ap-page">
      <div className="reports-ap-header">
        <div>
          <div className="reports-ap-eyebrow">
            REPORTS / ACCOUNTS PAYABLE
          </div>

          <h1>AP Reports</h1>

          <p>
            Centralized Accounts Payable reporting for
            supplier liabilities, outstanding bills,
            aging and payable activity.
          </p>
        </div>

        <div className="reports-ap-company">
          <div className="reports-ap-company-icon">
            <Landmark size={19} />
          </div>

          <div>
            <span>Current Company</span>
            <strong>{companyName}</strong>
            <small>{currency}</small>
          </div>
        </div>
      </div>

      <div className="reports-ap-summary">
        <div>
          <div className="reports-ap-summary-icon">
            <FileBarChart size={19} />
          </div>

          <div>
            <span>Available Reports</span>
            <strong>{REPORTS.length}</strong>
            <small>Accounts Payable reports</small>
          </div>
        </div>

        <div>
          <div className="reports-ap-summary-icon">
            <BookOpen size={19} />
          </div>

          <div>
            <span>Reporting Area</span>
            <strong>AP</strong>
            <small>Supplier liabilities</small>
          </div>
        </div>

        <div>
          <div className="reports-ap-summary-icon">
            <Landmark size={19} />
          </div>

          <div>
            <span>Company Currency</span>
            <strong>{currency}</strong>
            <small>Current company</small>
          </div>
        </div>
      </div>

      <section className="reports-ap-section">
        <div className="reports-ap-section-heading">
          <div>
            <div className="reports-ap-section-label">
              ACCOUNTS PAYABLE REPORTING
            </div>

            <h2>Available AP Reports</h2>

            <p>
              Select a report to open the detailed
              Accounts Payable reporting screen.
            </p>
          </div>
        </div>

        <div className="reports-ap-grid">
          {REPORTS.map((report) => {
            const Icon = report.icon;

            return (
              <button
                key={report.path}
                type="button"
                className="reports-ap-card"
                onClick={() =>
                  navigate(report.path)
                }
              >
                <div className="reports-ap-card-top">
                  <div className="reports-ap-card-icon">
                    <Icon size={21} />
                  </div>

                  <ArrowRight
                    size={18}
                    className="reports-ap-card-arrow"
                  />
                </div>

                <div className="reports-ap-card-body">
                  <h3>{report.title}</h3>

                  <p>{report.description}</p>
                </div>

                <div className="reports-ap-card-footer">
                  <span>Open Report</span>
                  <ArrowRight size={15} />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}