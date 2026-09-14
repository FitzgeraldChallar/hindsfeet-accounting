import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import BankingDashboard from "./banking/BankingDashboard";
import BankAccounts from "./banking/BankAccounts";
import BankDeposits from "./banking/BankDeposits";
import BankWithdrawals from "./banking/BankWithdrawals";
import BankTransfers from "./banking/BankTransfers";
import BankFees from "./banking/BankFees";
import BankInterest from "./banking/BankInterest";
import BankAdjustments from "./banking/BankAdjustments";
import BankTransactions from "./banking/BankTransactions";

export default function Banking() {
  return (
    <Routes>
      {/* Banking Dashboard */}
      <Route
        index
        element={<BankingDashboard />}
      />

      {/* Bank Accounts */}
      <Route
        path="accounts"
        element={<BankAccounts />}
      />

      {/* Future Banking Screens */}
      <Route
        path="deposits"
        element={<BankDeposits />}
          
      />

      <Route
        path="withdrawals"
        element={<BankWithdrawals />}
        
      />

      <Route
        path="transfers"
        element={<BankTransfers />}
          
      />

      <Route
        path="fees"
        element={<BankFees />}
          
      />

      <Route
        path="interest"
        element={<BankInterest />}
      />

      <Route
        path="adjustments"
        element={<BankAdjustments />}
          
      />

      <Route
        path="transactions"
        element={<BankTransactions />}
      />

      {/* Unknown Banking Route */}
      <Route
        path="*"
        element={
          <Navigate
            to="/banking"
            replace
          />
        }
      />
    </Routes>
  );
}