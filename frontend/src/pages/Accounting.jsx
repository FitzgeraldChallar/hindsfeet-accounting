import { Navigate, Route, Routes } from "react-router-dom";

import ChartOfAccounts from "./accounting/ChartOfAccounts";
import JournalEntries from "./accounting/JournalEntries";
import GeneralLedger from "./accounting/GeneralLedger";
import TrialBalance from "./accounting/TrialBalance";
import IncomeStatement from "./accounting/IncomeStatement";
import BalanceSheet from "./accounting/BalanceSheet";
import CashFlowStatement from "./accounting/CashFlowStatement";

function AccountingPlaceholder({
  title,
  description,
}) {
  return (
    <div className="accounting-placeholder-page">
      <div className="accounting-placeholder-icon">
        <span>•</span>
      </div>

      <h1>{title}</h1>

      <p>{description}</p>

      <span className="accounting-placeholder-label">
        Accounting module
      </span>
    </div>
  );
}

export default function Accounting() {
  return (
    <Routes>
      <Route
        index
        element={
          <Navigate
            to="/accounting/chart-of-accounts"
            replace
          />
        }
      />

      <Route
        path="chart-of-accounts"
        element={<ChartOfAccounts />}
      />

      <Route
        path="journal-entries"
        element={<JournalEntries />}
      />

      <Route
        path="general-ledger"
        element={
          <GeneralLedger />
        }
      />

      <Route
        path="trial-balance"
        element={
          <TrialBalance />
        }
      />

      <Route
        path="income-statement"
        element={
          <IncomeStatement />
        }
      />

      <Route
        path="balance-sheet"
        element={
          <BalanceSheet />
        }
      />

      <Route
        path="cash-flow"
        element={
          <CashFlowStatement />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/accounting/chart-of-accounts"
            replace
          />
        }
      />
    </Routes>
  );
}
