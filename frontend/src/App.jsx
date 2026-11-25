import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";


import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import FeatureRoute from "./components/auth/FeatureRoute";


import Login from "./pages/Login";
import Welcome from "./pages/Welcome";

import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import Sales from "./pages/Sales";
import Invoicing from "./pages/Invoicing";
import AccountsReceivable from "./pages/AccountsReceivable";
import Purchases from "./pages/Purchases";
import AccountsPayable from "./pages/AccountsPayable";
import Expenses from "./pages/Expenses";
import Inventory from "./pages/Inventory";
import Banking from "./pages/Banking";
import Accounting from "./pages/Accounting";
import Payroll from "./pages/Payroll";
import GasOperations from "./pages/GasOperations";


import Reports from "./pages/Reports";
import FinancialReports from "./pages/reports/FinancialReports";
import ARReports from "./pages/reports/ARReports";
import APReports from "./pages/reports/APReports";
import SalesReports from "./pages/reports/SalesReports";
import PurchaseReports from "./pages/reports/PurchaseReports";
import ExpenseReports from "./pages/reports/ExpenseReports";


import AuditActivity from "./pages/AuditActivity";
import Settings from "./pages/Settings";
import Subscription from "./pages/Subscription";
import Support from "./pages/Support";
import Team from "./pages/Team";


// ============================================================
// APP
// ============================================================

export default function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* ==================================================
            PUBLIC ROUTES
        ================================================== */}

        <Route
          path="/login"
          element={
            <Login />
          }
        />


        {/* ==================================================
            PROTECTED APPLICATION
        ================================================== */}

        <Route
          element={
            <ProtectedRoute />
          }
        >

          <Route
            element={
              <AppLayout />
            }
          >

            {/* ==================================================
                WELCOME / COVER
            ================================================== */}

            <Route
              path="/"
              element={
                <Welcome />
              }
            />


            {/* ==================================================
                DASHBOARD
            ================================================== */}

            <Route
              path="/dashboard"
              element={
                <Dashboard />
              }
            />


            {/* ==================================================
                COMPANIES
            ================================================== */}

            <Route
              path="/companies"
              element={
                <Companies />
              }
            />


            {/* ==================================================
                SALES
            ================================================== */}

            <Route
              path="/sales/*"
              element={
                <FeatureRoute feature="sales_invoicing"><Sales /></FeatureRoute>
              }
            />


            {/* ==================================================
                INVOICING
            ================================================== */}

            <Route
              path="/invoicing/*"
              element={
                <FeatureRoute feature="sales_invoicing"><Invoicing /></FeatureRoute>
              }
            />


            {/* ==================================================
                ACCOUNTS RECEIVABLE
            ================================================== */}

            <Route
              path="/accounts-receivable/*"
              element={
                <FeatureRoute feature="accounts_receivable"><AccountsReceivable /></FeatureRoute>
              }
            />


            {/* ==================================================
                PURCHASES
            ================================================== */}

            <Route
              path="/purchases/*"
              element={
                <FeatureRoute feature="purchases_expenses"><Purchases /></FeatureRoute>
              }
            />


            {/* ==================================================
                ACCOUNTS PAYABLE
            ================================================== */}

            <Route
              path="/accounts-payable/*"
              element={
                <FeatureRoute feature="accounts_payable"><AccountsPayable /></FeatureRoute>
              }
            />


            {/* ==================================================
                EXPENSES
            ================================================== */}

            <Route
              path="/expenses"
              element={
                <FeatureRoute feature="purchases_expenses"><Expenses /></FeatureRoute>
              }
            />

            <Route
              path="/expenses/*"
              element={
                <FeatureRoute feature="purchases_expenses"><ExpenseReports /></FeatureRoute>
              }
            />


            {/* ==================================================
                INVENTORY
            ================================================== */}

            <Route
              path="/inventory"
              element={
                <FeatureRoute feature="inventory"><Inventory /></FeatureRoute>
              }
            />


            {/* ==================================================
                BANKING
            ================================================== */}

            <Route
              path="/banking/*"
              element={
                <FeatureRoute feature="banking"><Banking /></FeatureRoute>
              }
            />


            {/* ==================================================
                ACCOUNTING
            ================================================== */}

            <Route
              path="/accounting/*"
              element={
                <FeatureRoute feature="core_accounting"><Accounting /></FeatureRoute>
              }
            />


            {/* ==================================================
                PAYROLL
            ================================================== */}

            <Route
              path="/payroll"
              element={
                <FeatureRoute feature="payroll"><Payroll /></FeatureRoute>
              }
            />


            {/* ==================================================
                GAS OPERATIONS
            ================================================== */}

            <Route
              path="/gas-operations"
              element={
                <FeatureRoute feature="gas_operations"><GasOperations /></FeatureRoute>
              }
            />


            {/* ==================================================
                REPORTS
            ================================================== */}

            <Route
              path="/reports"
              element={
                <FeatureRoute feature="standard_reports"><Reports /></FeatureRoute>
              }
            />

            <Route
              path="/reports/financial"
              element={
                <FeatureRoute feature="standard_reports"><FinancialReports /></FeatureRoute>
              }
            />

            <Route
              path="/reports/ar"
              element={
                <FeatureRoute feature="accounts_receivable"><ARReports /></FeatureRoute>
              }
            />

            <Route
              path="/reports/ap"
              element={
                <FeatureRoute feature="accounts_payable"><APReports /></FeatureRoute>
              }
            />

            <Route
              path="/reports/sales"
              element={
                <FeatureRoute feature="sales_invoicing"><SalesReports /></FeatureRoute>
              }
            />

            <Route
              path="/reports/purchases"
              element={
                <FeatureRoute feature="accounts_payable"><PurchaseReports /></FeatureRoute>
              }
            />

            <Route
              path="/reports/expenses"
              element={
                <FeatureRoute feature="purchases_expenses"><ExpenseReports /></FeatureRoute>
              }
            />


            {/* ==================================================
                AUDIT / ACTIVITY
            ================================================== */}

            <Route
              path="/audit"
              element={
                <FeatureRoute feature="core_accounting"><AuditActivity /></FeatureRoute>
              }
            />


            {/* ==================================================
                SETTINGS
            ================================================== */}

            <Route
              path="/subscription"
              element={<Subscription />}
            />

            <Route
              path="/team"
              element={<Team />}
            />

            <Route
              path="/support"
              element={<Support />}
            />

            <Route
              path="/settings"
              element={
                <Settings />
              }
            />

          </Route>

        </Route>


        {/* ==================================================
            FALLBACK
        ================================================== */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>

    </BrowserRouter>
  );
}