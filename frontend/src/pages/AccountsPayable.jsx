import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import APDashboard from "./accountsPayable/APDashboard";
import APSupplierBalances from "./accountsPayable/APSupplierBalances";
import APOutstandingBills from "./accountsPayable/APOutstandingBills";
import APAgingReport from "./accountsPayable/APAgingReport";
import APSupplierStatements from "./accountsPayable/APSupplierStatements";
import APPayableTransactions from "./accountsPayable/APPayableTransactions";

export default function AccountsPayable() {
  return (
    <Routes>
      <Route
        index
        element={<APDashboard />}
      />

      <Route
        path="supplier-balances"
        element={<APSupplierBalances />}
      />

      <Route
        path="outstanding"
        element={<APOutstandingBills />}
      />

      <Route
        path="aging"
        element={<APAgingReport />}
      />

      <Route
        path="statements"
        element={<APSupplierStatements />}
      />

      <Route
        path="transactions"
        element={<APPayableTransactions />}
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/accounts-payable"
            replace
          />
        }
      />
    </Routes>
  );
}