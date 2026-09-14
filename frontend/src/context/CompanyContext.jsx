import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api } from "../services/api";
import { useAuth } from "./AuthContext";


const CompanyContext = createContext(null);


export function CompanyProvider({ children }) {
  const {
    isAuthenticated,
    loading: authLoading,
  } = useAuth();


  const [companies, setCompanies] = useState([]);
  const [currentCompany, setCurrentCompany] =
    useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);


  // ==========================================================
  // LOAD COMPANIES
  // ==========================================================

  useEffect(() => {

    // Do nothing while authentication is being resolved.
    if (authLoading) {
      return;
    }

    // Do nothing if the user is not authenticated.
    if (!isAuthenticated) {
      setCompanies([]);
      setCurrentCompany(null);
      setLoading(false);
      return;
    }

    loadCompanies();

  }, [
    authLoading,
    isAuthenticated,
  ]);


  async function loadCompanies() {
    setLoading(true);
    setError(null);

    try {

      const data = await api.get(
        "/api/companies/"
      );


      const companyList =
        Array.isArray(data)
          ? data
          : data?.results || [];


      setCompanies(companyList);


      // ======================================================
      // RESTORE PREVIOUS COMPANY
      // ======================================================

      const storedCompanyId =
        localStorage.getItem(
          "current_company_id"
        );


      let selectedCompany = null;


      if (storedCompanyId) {

        selectedCompany =
          companyList.find(
            (company) =>
              String(company.id) ===
              String(storedCompanyId)
          );

      }


      // ======================================================
      // DEFAULT TO FIRST COMPANY
      // ======================================================

      if (
        !selectedCompany &&
        companyList.length > 0
      ) {

        selectedCompany =
          companyList[0];

      }


      setCurrentCompany(
        selectedCompany
      );


      if (selectedCompany) {

        localStorage.setItem(
          "current_company_id",
          String(
            selectedCompany.id
          )
        );

      }

    } catch (err) {

      console.error(
        "Failed to load companies:",
        err
      );

      setError(
        err.message ||
        "Unable to load companies."
      );

      setCompanies([]);
      setCurrentCompany(null);

    } finally {

      setLoading(false);

    }
  }


  // ==========================================================
  // SELECT COMPANY
  // ==========================================================

  function selectCompany(company) {

    setCurrentCompany(company);


    if (company) {

      localStorage.setItem(
        "current_company_id",
        String(company.id)
      );

    } else {

      localStorage.removeItem(
        "current_company_id"
      );

    }

  }


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
      refreshCompanies:
        loadCompanies,
    }),
    [
      companies,
      currentCompany,
      loading,
      error,
    ]
  );


  return (
    <CompanyContext.Provider
      value={value}
    >
      {children}
    </CompanyContext.Provider>
  );
}


// ============================================================
// HOOK
// ============================================================

export function useCompany() {

  const context =
    useContext(
      CompanyContext
    );


  if (!context) {

    throw new Error(
      "useCompany must be used inside CompanyProvider."
    );

  }


  return context;
}