import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";


import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";


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
                <Sales />
              }
            />


            {/* ==================================================
                INVOICING
            ================================================== */}

            <Route
              path="/invoicing/*"
              element={
                <Invoicing />
              }
            />


            {/* ==================================================
                ACCOUNTS RECEIVABLE
            ================================================== */}

            <Route
              path="/accounts-receivable/*"
              element={
                <AccountsReceivable />
              }
            />


            {/* ==================================================
                PURCHASES
            ================================================== */}

            <Route
              path="/purchases/*"
              element={
                <Purchases />
              }
            />


            {/* ==================================================
                ACCOUNTS PAYABLE
            ================================================== */}

            <Route
              path="/accounts-payable/*"
              element={
                <AccountsPayable />
              }
            />


            {/* ==================================================
                EXPENSES
            ================================================== */}

            <Route
              path="/expenses"
              element={
                <Expenses />
              }
            />

            <Route
              path="/expenses/*"
              element={
                <ExpenseReports />
              }
            />


            {/* ==================================================
                INVENTORY
            ================================================== */}

            <Route
              path="/inventory"
              element={
                <Inventory />
              }
            />


            {/* ==================================================
                BANKING
            ================================================== */}

            <Route
              path="/banking/*"
              element={
                <Banking />
              }
            />


            {/* ==================================================
                ACCOUNTING
            ================================================== */}

            <Route
              path="/accounting/*"
              element={
                <Accounting />
              }
            />


            {/* ==================================================
                PAYROLL
            ================================================== */}

            <Route
              path="/payroll"
              element={
                <Payroll />
              }
            />


            {/* ==================================================
                GAS OPERATIONS
            ================================================== */}

            <Route
              path="/gas-operations"
              element={
                <GasOperations />
              }
            />


            {/* ==================================================
                REPORTS
            ================================================== */}

            <Route
              path="/reports"
              element={
                <Reports />
              }
            />

            <Route
              path="/reports/financial"
              element={
                <FinancialReports />
              }
            />

            <Route
              path="/reports/ar"
              element={
                <ARReports />
              }
            />

            <Route
              path="/reports/ap"
              element={
                <APReports />
              }
            />

            <Route
              path="/reports/sales"
              element={
                <SalesReports />
              }
            />

            <Route
              path="/reports/purchases"
              element={
                <PurchaseReports />
              }
            />

            <Route
              path="/reports/expenses"
              element={
                <ExpenseReports />
              }
            />


            {/* ==================================================
                AUDIT / ACTIVITY
            ================================================== */}

            <Route
              path="/audit"
              element={
                <AuditActivity />
              }
            />


            {/* ==================================================
                SETTINGS
            ================================================== */}

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