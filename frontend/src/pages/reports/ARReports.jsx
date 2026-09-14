import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  FileBarChart,
  FileText,
  HandCoins,
  Receipt,
  Users,
} from "lucide-react";

import { useCompany } from "../../context/CompanyContext";
import { useNavigate } from "react-router-dom";

const reports = [
  {
    title: "Customer Balances",
    description:
      "Review the outstanding receivable balance for each customer and identify your largest customer exposures.",
    icon: Users,
    path: "/accounts-receivable/customer-balances",
    label: "Open Customer Balances",
  },
  {
    title: "Outstanding Invoices",
    description:
      "View invoices that still have an unpaid balance, including due dates, amounts paid and amounts outstanding.",
    icon: Receipt,
    path: "/accounts-receivable/outstanding",
    label: "View Outstanding Invoices",
  },
  {
    title: "Receivables Aging",
    description:
      "Analyze outstanding customer balances by age to identify current and overdue receivables.",
    icon: CalendarClock,
    path: "/accounts-receivable/aging",
    label: "Open Aging Report",
  },
  {
    title: "Customer Statements",
    description:
      "Review individual customer activity, invoices, payments and running receivable balances.",
    icon: BookOpen,
    path: "/accounts-receivable/statements",
    label: "Open Customer Statements",
  },
  {
    title: "Receivable Transactions",
    description:
      "Review invoices, customer payments and other posted transactions affecting Accounts Receivable.",
    icon: FileText,
    path: "/accounts-receivable/transactions",
    label: "View Receivable Transactions",
  },
];

export default function ARReports() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();

  const companyName =
    currentCompany?.name || "Current Company";

  const currency =
    currentCompany?.currency || "USD";

  return (
    <div className="ar-reports-page">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="ar-reports-header">
        <div>
          <div className="ar-reports-eyebrow">
            REPORTING CENTER
          </div>

          <h1>Accounts Receivable Reports</h1>

          <p>
            Review customer balances, outstanding invoices,
            aging exposure and receivable activity for{" "}
            <strong>{companyName}</strong>.
          </p>
        </div>

        <div className="ar-reports-header-icon">
          <FileBarChart size={28} />
        </div>
      </div>

      {/* ======================================================
          COMPANY CONTEXT
      ====================================================== */}

      <div className="ar-reports-company-strip">
        <div className="ar-reports-company-icon">
          <HandCoins size={19} />
        </div>

        <div>
          <span>Reporting Company</span>
          <strong>{companyName}</strong>
        </div>

        <div className="ar-reports-company-meta">
          <span>Functional Currency</span>
          <strong>{currency}</strong>
        </div>

        <div className="ar-reports-company-meta">
          <span>Report Group</span>
          <strong>Accounts Receivable</strong>
        </div>
      </div>

      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <section className="ar-reports-summary">
        <div className="ar-reports-summary-card ar-reports-summary-primary">
          <div className="ar-reports-summary-icon">
            <BarChart3 size={21} />
          </div>

          <div>
            <span>Available Reports</span>
            <strong>{reports.length}</strong>
            <small>
              Customer receivable reporting views
            </small>
          </div>
        </div>

        <div className="ar-reports-summary-card">
          <div className="ar-reports-summary-icon">
            <Receipt size={21} />
          </div>

          <div>
            <span>Invoice Reporting</span>
            <strong>2</strong>
            <small>
              Balances and outstanding invoices
            </small>
          </div>
        </div>

        <div className="ar-reports-summary-card">
          <div className="ar-reports-summary-icon">
            <CalendarClock size={21} />
          </div>

          <div>
            <span>Aging Analysis</span>
            <strong>1</strong>
            <small>
              Outstanding exposure by age
            </small>
          </div>
        </div>

        <div className="ar-reports-summary-card">
          <div className="ar-reports-summary-icon">
            <FileText size={21} />
          </div>

          <div>
            <span>Activity Reports</span>
            <strong>2</strong>
            <small>
              Statements and transactions
            </small>
          </div>
        </div>
      </section>

      {/* ======================================================
          REPORT GRID
      ====================================================== */}

      <section className="ar-reports-section">
        <div className="ar-reports-section-header">
          <div>
            <div className="ar-reports-section-label">
              RECEIVABLE REPORTS
            </div>

            <h2>Accounts Receivable Reporting</h2>

            <p>
              Select a report below to open the detailed
              reporting interface.
            </p>
          </div>
        </div>

        <div className="ar-reports-grid">
          {reports.map((report) => {
            const Icon = report.icon;

            return (
              <article
                key={report.path}
                className="ar-report-card"
              >
                <div className="ar-report-card-top">
                  <div className="ar-report-card-icon">
                    <Icon size={21} />
                  </div>

                  <span className="ar-report-card-type">
                    AR REPORT
                  </span>
                </div>

                <h3>{report.title}</h3>

                <p>{report.description}</p>

                <div className="ar-report-card-footer">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(report.path)
                    }
                  >
                    {report.label}

                    <ArrowUpRight size={16} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ======================================================
          REPORTING NOTE
      ====================================================== */}

      <div className="ar-reports-note">
        <div className="ar-reports-note-icon">
          <FileBarChart size={18} />
        </div>

        <div>
          <strong>
            Accounts Receivable Reporting Center
          </strong>

          <span>
            These reports use the existing Accounts
            Receivable records for the selected company.
            Detailed filtering, customer analysis, aging
            and transaction review are handled by their
            respective reporting screens.
          </span>
        </div>
      </div>
    </div>
  );
}