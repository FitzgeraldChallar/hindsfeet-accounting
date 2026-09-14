import { api } from "./api";


export const accountingApi = {

  // ==========================================================
  // CHART OF ACCOUNTS
  // ==========================================================

  getAccounts(companyId) {
    return api.get(
      `/api/accounting/accounts/?company=${companyId}`
    );
  },

  createAccount(data) {
    return api.post(
      "/api/accounting/accounts/",
      data
    );
  },

  getAccount(id) {
    return api.get(
      `/api/accounting/accounts/${id}/`
    );
  },

  updateAccount(id, data) {
    return api.patch(
      `/api/accounting/accounts/${id}/`,
      data
    );
  },


  // ==========================================================
  // JOURNAL ENTRIES
  // ==========================================================

  getJournalEntries(companyId) {
    return api.get(
      `/api/accounting/journal-entries/?company=${companyId}`
    );
  },

  getJournalEntry(id) {
    return api.get(
      `/api/accounting/journal-entries/${id}/`
    );
  },

  createJournalEntry(data) {
    return api.post(
      "/api/accounting/journal-entries/",
      data
    );
  },

  postJournalEntry(id) {
    return api.post(
      `/api/accounting/journal-entries/${id}/post/`,
      {}
    );
  },


  // ==========================================================
  // REPORTS
  // ==========================================================

  getGeneralLedger({
    companyId,
    startDate,
    endDate,
    accountId,
  }) {
    const params = new URLSearchParams();

    params.set("company", companyId);

    if (startDate) {
      params.set("start_date", startDate);
    }

    if (endDate) {
      params.set("end_date", endDate);
    }

    if (accountId) {
      params.set("account", accountId);
    }

    return api.get(
      `/api/accounting/reports/general-ledger/?${params}`
    );
  },


  getTrialBalance({
    companyId,
    startDate,
    endDate,
  }) {
    const params = new URLSearchParams();

    params.set("company", companyId);

    if (startDate) {
      params.set("start_date", startDate);
    }

    if (endDate) {
      params.set("end_date", endDate);
    }

    return api.get(
      `/api/accounting/reports/trial-balance/?${params}`
    );
  },


  getIncomeStatement({
    companyId,
    startDate,
    endDate,
  }) {
    const params = new URLSearchParams();

    params.set("company", companyId);

    if (startDate) {
      params.set("start_date", startDate);
    }

    if (endDate) {
      params.set("end_date", endDate);
    }

    return api.get(
      `/api/accounting/reports/income-statement/?${params}`
    );
  },


  getBalanceSheet({
    companyId,
    asOfDate,
  }) {
    const params = new URLSearchParams();

    params.set("company", companyId);

    if (asOfDate) {
      params.set("as_of_date", asOfDate);
    }

    return api.get(
      `/api/accounting/reports/balance-sheet/?${params}`
    );
  },


  getCashFlow({
    companyId,
    startDate,
    endDate,
  }) {
    const params = new URLSearchParams();

    params.set("company", companyId);

    if (startDate) {
      params.set("start_date", startDate);
    }

    if (endDate) {
      params.set("end_date", endDate);
    }

    return api.get(
      `/api/accounting/reports/cash-flow/?${params}`
    );
  },


  // ==========================================================
  // PDF REPORTS
  // ==========================================================

  getGeneralLedgerPDF({
    companyId,
    startDate,
    endDate,
    accountId,
  }) {
    const params = new URLSearchParams();

    params.set("company", companyId);

    if (startDate) {
      params.set("start_date", startDate);
    }

    if (endDate) {
      params.set("end_date", endDate);
    }

    if (accountId) {
      params.set("account", accountId);
    }

    return `/api/accounting/reports/general-ledger/pdf/?${params}`;
  },


  getTrialBalancePDF({
    companyId,
    startDate,
    endDate,
  }) {
    const params = new URLSearchParams();

    params.set("company", companyId);

    if (startDate) {
      params.set("start_date", startDate);
    }

    if (endDate) {
      params.set("end_date", endDate);
    }

    return `/api/accounting/reports/trial-balance/pdf/?${params}`;
  },


  getIncomeStatementPDF({
    companyId,
    startDate,
    endDate,
  }) {
    const params = new URLSearchParams();

    params.set("company", companyId);

    if (startDate) {
      params.set("start_date", startDate);
    }

    if (endDate) {
      params.set("end_date", endDate);
    }

    return `/api/accounting/reports/income-statement/pdf/?${params}`;
  },


  getBalanceSheetPDF({
    companyId,
    asOfDate,
  }) {
    const params = new URLSearchParams();

    params.set("company", companyId);

    if (asOfDate) {
      params.set("as_of_date", asOfDate);
    }

    return `/api/accounting/reports/balance-sheet/pdf/?${params}`;
  },


  getCashFlowPDF({
    companyId,
    startDate,
    endDate,
  }) {
    const params = new URLSearchParams();

    params.set("company", companyId);

    if (startDate) {
      params.set("start_date", startDate);
    }

    if (endDate) {
      params.set("end_date", endDate);
    }

    return `/api/accounting/reports/cash-flow/pdf/?${params}`;
  },
};