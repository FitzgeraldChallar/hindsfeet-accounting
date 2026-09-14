import React from "react";
import {
  BarChart3,
  FileBarChart,
  FileText,
  Receipt,
  ShoppingCart,
  Wallet,
  Package,
  Users,
  Fuel,
  ArrowRight,
} from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";

export default function Reports() {
  const location = useLocation();

  const reportSections = [
    {
      title: "Financial Reports",
      description:
        "View core financial statements and accounting reports for the selected company.",
      icon: FileBarChart,
      path: "/reports/financial",
    },
    {
      title: "AR Reports",
      description:
        "Review customer receivables, outstanding invoices, aging and customer balances.",
      icon: Receipt,
      path: "/reports/ar",
    },
    {
      title: "AP Reports",
      description:
        "Review supplier payables, outstanding bills, aging and supplier balances.",
      icon: Wallet,
      path: "/reports/ap",
    },
    {
      title: "Sales Reports",
      description:
        "Analyze sales activity, revenue, customers and sales transactions.",
      icon: ShoppingCart,
      path: "/reports/sales",
    },
    {
      title: "Purchase Reports",
      description:
        "Review purchasing activity, supplier bills and purchase transactions.",
      icon: FileText,
      path: "/reports/purchases",
    },
    {
      title: "Expense Reports",
      description:
        "Review business expenses and expense activity across the company.",
      icon: Wallet,
      path: "/reports/expenses",
    },
    {
      title: "Inventory Reports",
      description:
        "Review stock levels, inventory movements and inventory valuation.",
      icon: Package,
      path: "/reports/inventory",
    },
    {
      title: "Payroll Reports",
      description:
        "Review payroll costs, employee payroll and payroll summaries.",
      icon: Users,
      path: "/reports/payroll",
    },
    {
      title: "Gas Reports",
      description:
        "Review fuel sales, pump activity and gas station operational reports.",
      icon: Fuel,
      path: "/reports/gas",
      gasOnly: true,
    },
  ];

  const isReportHome =
    location.pathname === "/reports" ||
    location.pathname === "/reports/";

  return (
    <div className="reports-page">
      {isReportHome ? (
        <>
          {/* PAGE HEADER */}
          <div className="reports-page-header">
            <div>
              <div className="reports-eyebrow">
                BUSINESS INTELLIGENCE
              </div>

              <h1>Reports</h1>

              <p>
                Access financial, operational and
                management reports for your company.
              </p>
            </div>

            <div className="reports-header-icon">
              <BarChart3 size={24} />
            </div>
          </div>

          {/* INTRO */}
          <div className="reports-intro-card">
            <div className="reports-intro-icon">
              <FileBarChart size={22} />
            </div>

            <div>
              <h2>Reporting Center</h2>

              <p>
                Select a reporting area below to
                access detailed reports and analysis.
                All reports are automatically scoped
                to the currently selected company.
              </p>
            </div>
          </div>

          {/* REPORT CARDS */}
          <div className="reports-grid">
            {reportSections.map((report) => {
              const Icon = report.icon;

              return (
                <Link
                  key={report.path}
                  to={report.path}
                  className="reports-card"
                >
                  <div className="reports-card-top">
                    <div className="reports-card-icon">
                      <Icon size={21} />
                    </div>

                    <ArrowRight
                      size={18}
                      className="reports-card-arrow"
                    />
                  </div>

                  <div className="reports-card-content">
                    <h3>{report.title}</h3>

                    <p>{report.description}</p>
                  </div>

                  <div className="reports-card-footer">
                    <span>Open Reports</span>
                    <ArrowRight size={15} />
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        <Outlet />
      )}
    </div>
  );
}