import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { api } from "../services/api";
import { useAuth } from "./AuthContext";


const CompanyContext = createContext(null);

const WORKSPACE_STORAGE_PREFIX = "hindsfeet_workspace_currency_";


function normalizeCurrency(value) {
  const currency = String(value || "").trim().toUpperCase();
  return currency || null;
}


function getWorkspaceStorageKey(companyId) {
  return `${WORKSPACE_STORAGE_PREFIX}${companyId}`;
}


export function CompanyProvider({ children }) {
  const {
    isAuthenticated,
    loading: authLoading,
  } = useAuth();

  const [companies, setCompanies] = useState([]);
  const [currentCompany, setCurrentCompany] = useState(null);

  const [workspace, setWorkspace] = useState(null);
  const [workspaceCurrency, setWorkspaceCurrencyState] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const workspaceRequestId = useRef(0);


  // ==========================================================
  // LOAD COMPANY WORKSPACE
  // ==========================================================

  const loadWorkspace = useCallback(async (companyId, options = {}) => {
    const { silent = false } = options;
    if (!companyId) {
      setWorkspace(null);
      setWorkspaceCurrencyState(null);
      setWorkspaceError(null);
      setWorkspaceLoading(false);
      return null;
    }

    const requestId = ++workspaceRequestId.current;

    if (!silent) {
      setWorkspaceLoading(true);
    }
    setWorkspaceError(null);

    try {
      const data = await api.get(
        `/api/companies/${companyId}/workspace/`
      );

      // Ignore a slower response that belongs to an older company selection.
      if (requestId !== workspaceRequestId.current) {
        return null;
      }

      const currencies = Array.isArray(data?.currencies)
        ? data.currencies
        : [];

      const activeCurrencies = currencies.filter(
        (item) => item?.is_active !== false
      );

      const storedCurrency = normalizeCurrency(
        localStorage.getItem(
          getWorkspaceStorageKey(companyId)
        )
      );

      const defaultCurrency = normalizeCurrency(
        data?.default_workspace_currency
      );

      const functionalCurrency = normalizeCurrency(
        data?.functional_currency
      );

      const activeCurrencyCodes = activeCurrencies
        .map((item) => normalizeCurrency(item?.currency))
        .filter(Boolean);

      const selectedCurrency =
        storedCurrency && activeCurrencyCodes.includes(storedCurrency)
          ? storedCurrency
          : defaultCurrency && activeCurrencyCodes.includes(defaultCurrency)
            ? defaultCurrency
            : functionalCurrency && activeCurrencyCodes.includes(functionalCurrency)
              ? functionalCurrency
              : activeCurrencyCodes[0] || null;

      setWorkspace(data || null);
      setWorkspaceCurrencyState(selectedCurrency);

      if (selectedCurrency) {
        localStorage.setItem(
          getWorkspaceStorageKey(companyId),
          selectedCurrency
        );
      }

      return data || null;
    } catch (err) {
      if (requestId !== workspaceRequestId.current) {
        return null;
      }

      console.error("Failed to load company workspace:", err);
      setWorkspaceError(
        err?.message ||
          "Unable to load company workspace."
      );

      // Keep the last known workspace during a refresh failure. This is
      // important for a stable UI: a temporary network/API failure must not
      // make the workspace selector or currency settings appear empty.
      return null;
    } finally {
      if (requestId === workspaceRequestId.current && !silent) {
        setWorkspaceLoading(false);
      }
    }
  }, []);


  // ==========================================================
  // LOAD COMPANIES
  // ==========================================================

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.get(
        "/api/companies/"
      );

      const companyList = Array.isArray(data)
        ? data
        : data?.results || [];

      setCompanies(companyList);

      const storedCompanyId = localStorage.getItem(
        "current_company_id"
      );

      let selectedCompany = null;

      if (storedCompanyId) {
        selectedCompany = companyList.find(
          (company) =>
            String(company.id) === String(storedCompanyId)
        );
      }

      if (!selectedCompany && companyList.length > 0) {
        selectedCompany = companyList[0];
      }

      setCurrentCompany(selectedCompany || null);

      if (selectedCompany) {
        localStorage.setItem(
          "current_company_id",
          String(selectedCompany.id)
        );
      } else {
        localStorage.removeItem("current_company_id");
      }
    } catch (err) {
      console.error("Failed to load companies:", err);

      setError(
        err?.message ||
          "Unable to load companies."
      );

      setCompanies([]);
      setCurrentCompany(null);
      setWorkspace(null);
      setWorkspaceCurrencyState(null);
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      workspaceRequestId.current += 1;
      setCompanies([]);
      setCurrentCompany(null);
      setWorkspace(null);
      setWorkspaceCurrencyState(null);
      setWorkspaceError(null);
      setLoading(false);
      setWorkspaceLoading(false);
      return;
    }

    loadCompanies();
  }, [
    authLoading,
    isAuthenticated,
    loadCompanies,
  ]);


  useEffect(() => {
    if (!currentCompany?.id) {
      setWorkspace(null);
      setWorkspaceCurrencyState(null);
      setWorkspaceError(null);
      setWorkspaceLoading(false);
      return;
    }

    // Give the UI an immediate, deterministic workspace value while the
    // authoritative workspace configuration is loading. This prevents the
    // selector and financial pages from briefly falling back to USD or 0.
    const storedCurrency = normalizeCurrency(
      localStorage.getItem(
        getWorkspaceStorageKey(currentCompany.id)
      )
    );

    const companyCurrency = normalizeCurrency(
      currentCompany?.currency
    );

    setWorkspaceCurrencyState(
      storedCurrency ||
        companyCurrency ||
        null
    );

    loadWorkspace(currentCompany.id);
  }, [
    currentCompany?.id,
    currentCompany?.currency,
    loadWorkspace,
  ]);


  // ==========================================================
  // SELECT COMPANY
  // ==========================================================

  const selectCompany = useCallback((company) => {
    setCurrentCompany(company || null);

    if (company?.id) {
      localStorage.setItem(
        "current_company_id",
        String(company.id)
      );
    } else {
      localStorage.removeItem("current_company_id");
    }
  }, []);


  // ==========================================================
  // SELECT WORKSPACE CURRENCY
  // ==========================================================

  const selectWorkspaceCurrency = useCallback((currency) => {
    const normalized = normalizeCurrency(currency);

    if (!normalized || !currentCompany?.id) {
      return;
    }

    const activeCurrencies = Array.isArray(workspace?.currencies)
      ? workspace.currencies
          .filter((item) => item?.is_active !== false)
          .map((item) => normalizeCurrency(item?.currency))
          .filter(Boolean)
      : [];

    if (
      activeCurrencies.length > 0 &&
      !activeCurrencies.includes(normalized)
    ) {
      return;
    }

    setWorkspaceCurrencyState(normalized);
    localStorage.setItem(
      getWorkspaceStorageKey(currentCompany.id),
      normalized
    );
  }, [
    currentCompany?.id,
    workspace?.currencies,
  ]);


  const refreshWorkspace = useCallback(async (options = {}) => {
    if (!currentCompany?.id) {
      return null;
    }

    return loadWorkspace(currentCompany.id, options);
  }, [
    currentCompany?.id,
    loadWorkspace,
  ]);


  // ==========================================================
  // DERIVED WORKSPACE DATA
  // ==========================================================

  const currencies = useMemo(
    () => (
      Array.isArray(workspace?.currencies)
        ? workspace.currencies
        : []
    ),
    [workspace?.currencies]
  );

  const activeCurrencies = useMemo(
    () => currencies.filter(
      (item) => item?.is_active !== false
    ),
    [currencies]
  );

  const exchangeRates = useMemo(
    () => (
      Array.isArray(workspace?.exchange_rates)
        ? workspace.exchange_rates
        : []
    ),
    [workspace?.exchange_rates]
  );

  const functionalCurrency = normalizeCurrency(
    workspace?.functional_currency ||
      currentCompany?.currency
  );

  const defaultWorkspaceCurrency = normalizeCurrency(
    workspace?.default_workspace_currency ||
      functionalCurrency
  );


  // ==========================================================
  // CONTEXT VALUE
  // ==========================================================

  const value = useMemo(
    () => ({
      companies,
      currentCompany,
      loading,
      error,
      selectCompany,
      refreshCompanies: loadCompanies,

      workspace,
      currentMembership: workspace?.membership || null,
      subscription: workspace?.subscription || null,
      subscriptionFeatures: workspace?.subscription?.features || {},
      workspaceCurrency,
      currencies,
      activeCurrencies,
      exchangeRates,
      functionalCurrency,
      defaultWorkspaceCurrency,
      workspaceLoading,
      workspaceError,
      selectWorkspaceCurrency,
      refreshWorkspace,
    }),
    [
      companies,
      currentCompany,
      loading,
      error,
      selectCompany,
      loadCompanies,
      workspace,
      workspace?.membership,
      workspace?.subscription,
      workspace?.subscription?.features,
      workspaceCurrency,
      currencies,
      activeCurrencies,
      exchangeRates,
      functionalCurrency,
      defaultWorkspaceCurrency,
      workspaceLoading,
      workspaceError,
      selectWorkspaceCurrency,
      refreshWorkspace,
    ]
  );


  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}


export function useCompany() {
  const context = useContext(CompanyContext);

  if (!context) {
    throw new Error(
      "useCompany must be used inside CompanyProvider."
    );
  }

  return context;
}
