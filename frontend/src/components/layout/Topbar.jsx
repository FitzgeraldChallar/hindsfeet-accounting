import {
  Bell,
  Check,
  ChevronDown,
  Menu,
  Search,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { useCompany } from "../../context/CompanyContext";


export default function Topbar() {
  const {
    user,
    logout,
  } = useAuth();

  const {
    companies,
    currentCompany,
    selectCompany,
  } = useCompany();


  const [companyMenuOpen, setCompanyMenuOpen] =
    useState(false);

  const [userMenuOpen, setUserMenuOpen] =
    useState(false);


  const companyMenuRef = useRef(null);
  const userMenuRef = useRef(null);


  // ==========================================================
  // USER DISPLAY
  // ==========================================================

  const userName =
    user?.full_name ||
    user?.name ||
    user?.username ||
    "User";


  const userRole =
    user?.role ||
    "User";


  // ==========================================================
  // CLOSE DROPDOWNS WHEN CLICKING OUTSIDE
  // ==========================================================

  useEffect(() => {

    function handleClickOutside(event) {

      if (
        companyMenuRef.current &&
        !companyMenuRef.current.contains(
          event.target
        )
      ) {
        setCompanyMenuOpen(false);
      }


      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(
          event.target
        )
      ) {
        setUserMenuOpen(false);
      }

    }


    document.addEventListener(
      "mousedown",
      handleClickOutside
    );


    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };

  }, []);


  // ==========================================================
  // SELECT COMPANY
  // ==========================================================

  function handleCompanySelect(company) {

    selectCompany(company);

    setCompanyMenuOpen(false);

  }


  // ==========================================================
  // LOGOUT
  // ==========================================================

  function handleLogout() {

    setUserMenuOpen(false);

    logout();

  }


  return (
    <header className="topbar">

      {/* ====================================================
          MOBILE MENU
          ==================================================== */}

      <button
        type="button"
        className="topbar-icon-button mobile-menu-button"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>


      {/* ====================================================
          SEARCH
          ==================================================== */}

      <div className="topbar-search">

        <Search
          size={18}
          strokeWidth={2}
        />

        <input
          type="text"
          placeholder="Search anything..."
        />

        <span className="search-shortcut">
          /
        </span>

      </div>


      {/* ====================================================
          RIGHT SIDE
          ==================================================== */}

      <div className="topbar-actions">


        {/* ==================================================
            COMPANY SELECTOR
            ================================================== */}

        <div
          className="company-selector-wrapper"
          ref={companyMenuRef}
        >

          <button
            type="button"
            className={`company-selector ${
              companyMenuOpen
                ? "company-selector-open"
                : ""
            }`}
            onClick={() =>
              setCompanyMenuOpen(
                (value) => !value
              )
            }
            aria-haspopup="listbox"
            aria-expanded={companyMenuOpen}
          >

            <div className="company-selector-logo">
              {currentCompany?.name
                ?.charAt(0)
                ?.toUpperCase() || "H"}
            </div>


            <div className="company-selector-info">

              <span className="company-selector-label">
                Current Company
              </span>

              <span className="company-selector-name">
                {currentCompany?.name ||
                  "Select Company"}
              </span>

            </div>


            <ChevronDown
              size={16}
              className={
                companyMenuOpen
                  ? "company-selector-chevron-open"
                  : ""
              }
            />

          </button>


          {/* =================================================
              COMPANY DROPDOWN
              ================================================= */}

          {companyMenuOpen && (
            <div
              className="company-selector-menu"
              role="listbox"
            >

              <div className="company-selector-menu-header">
                <span>
                  Switch Company
                </span>

                <span>
                  {companies.length}{" "}
                  {companies.length === 1
                    ? "company"
                    : "companies"}
                </span>
              </div>


              <div className="company-selector-menu-list">

                {companies.length === 0 ? (

                  <div className="company-selector-empty">
                    No companies available.
                  </div>

                ) : (

                  companies.map((company) => {

                    const isSelected =
                      String(
                        currentCompany?.id
                      ) ===
                      String(company.id);


                    return (
                      <button
                        key={company.id}
                        type="button"
                        className={`company-option ${
                          isSelected
                            ? "company-option-selected"
                            : ""
                        }`}
                        onClick={() =>
                          handleCompanySelect(
                            company
                          )
                        }
                        role="option"
                        aria-selected={
                          isSelected
                        }
                      >

                        <div className="company-option-logo">
                          {company.name
                            ?.charAt(0)
                            ?.toUpperCase() || "H"}
                        </div>


                        <div className="company-option-info">

                          <span className="company-option-name">
                            {company.name}
                          </span>

                          {company.legal_name &&
                            company.legal_name !==
                              company.name && (
                              <span className="company-option-legal-name">
                                {company.legal_name}
                              </span>
                            )}

                        </div>


                        {isSelected && (
                          <Check
                            size={17}
                            className="company-option-check"
                          />
                        )}

                      </button>
                    );

                  })

                )}

              </div>

            </div>
          )}

        </div>


        {/* ==================================================
            NOTIFICATIONS
            ================================================== */}

        <button
          type="button"
          className="topbar-icon-button notification-button"
          aria-label="Notifications"
        >
          <Bell size={19} />

          <span className="notification-dot" />
        </button>


        {/* ==================================================
            DIVIDER
            ================================================== */}

        <div className="topbar-divider" />


        {/* ==================================================
            USER MENU
            ================================================== */}

        <div
          className="user-menu-wrapper"
          ref={userMenuRef}
        >

          <button
            type="button"
            className={`user-menu ${
              userMenuOpen
                ? "user-menu-open"
                : ""
            }`}
            onClick={() =>
              setUserMenuOpen(
                (value) => !value
              )
            }
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
          >

            <div className="user-avatar">
              {userName
                .charAt(0)
                .toUpperCase()}
            </div>


            <div className="user-info">

              <span className="user-name">
                {userName}
              </span>

              <span className="user-role">
                {userRole}
              </span>

            </div>


            <ChevronDown
              size={15}
              className={
                userMenuOpen
                  ? "user-menu-chevron-open"
                  : ""
              }
            />

          </button>


          {userMenuOpen && (
            <div className="user-menu-dropdown">

              <div className="user-menu-header">

                <strong>
                  {userName}
                </strong>

                <span>
                  {userRole}
                </span>

              </div>


              <div className="user-menu-divider" />


              <button
                type="button"
                onClick={handleLogout}
              >
                Sign Out
              </button>

            </div>
          )}

        </div>

      </div>

    </header>
  );
}