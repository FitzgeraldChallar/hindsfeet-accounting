import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  ImagePlus,
  LockKeyhole,
  Mail,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";

import { api, API_BASE_URL } from "../services/api";
import { useCompany } from "../context/CompanyContext";


function extractError(error) {
  const data = error?.data;

  if (data && typeof data === "object") {
    if (data.detail) {
      if (Array.isArray(data.detail)) {
        return data.detail.join(", ");
      }

      return data.detail;
    }

    if (data.message) {
      return data.message;
    }

    return Object.entries(data)
      .map(([field, message]) => {
        const value = Array.isArray(message)
          ? message.join(", ")
          : message;

        return `${field}: ${value}`;
      })
      .join(" ");
  }

  return (
    error?.message ||
    "Something went wrong. Please try again."
  );
}


function initials(user) {
  const name = [
    user?.first_name,
    user?.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!name) {
    return (
      user?.username?.charAt(0)?.toUpperCase() ||
      "U"
    );
  }

  const parts = name.split(" ");

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (
    `${parts[0].charAt(0)}${
      parts[parts.length - 1].charAt(0)
    }`.toUpperCase()
  );
}


function roleLabel(role) {
  const labels = {
    OWNER: "Owner",
    ADMIN: "Administrator",
    ACCOUNTANT: "Accountant",
    USER: "User",
  };

  return labels[role] || role || "User";
}


function PasswordField({
  label,
  name,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  disabled,
}) {
  return (
    <label className="settings-field">
      <span>{label}</span>

      <div className="settings-password-input">
        <LockKeyhole size={16} />

        <input
          type={show ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="new-password"
        />

        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={
            show
              ? "Hide password"
              : "Show password"
          }
        >
          {show ? (
            <EyeOff size={16} />
          ) : (
            <Eye size={16} />
          )}
        </button>
      </div>
    </label>
  );
}


export default function Settings() {
  const {
    currentCompany,
    selectCompany,
  } = useCompany();

  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);

  const [savingProfile, setSavingProfile] =
    useState(false);

  const [changingPassword, setChangingPassword] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [logoSaving, setLogoSaving] =
    useState(false);

  const [logoError, setLogoError] =
    useState("");

  const [showRemoveLogoModal, setShowRemoveLogoModal] =
    useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [activeSection, setActiveSection] =
    useState("profile");

  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  const [password, setPassword] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [showPasswords, setShowPasswords] =
    useState({
      current: false,
      new: false,
      confirm: false,
    });


  /* ==========================================================
     LOAD USER
     ========================================================== */

  const loadUser = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await api.get(
          "/api/accounts/me/"
        );

        setUser(response);

        setProfile({
          first_name:
            response?.first_name || "",

          last_name:
            response?.last_name || "",

          email:
            response?.email || "",

          phone:
            response?.phone || "",
        });
      } catch (err) {
        setError(
          extractError(err) ||
            "Unable to load your account information."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );


  useEffect(() => {
    loadUser();
  }, [loadUser]);


  /* ==========================================================
     LOAD CURRENT COMPANY LOGO
     ========================================================== */

  const loadCompanyBranding = useCallback(
    async () => {
      if (!currentCompany?.id) {
        return;
      }

      try {
        setLogoError("");

        const token =
          localStorage.getItem("access_token");

        const response = await fetch(
          `${API_BASE_URL}/api/companies/${currentCompany.id}/logo/`,
          {
            method: "GET",
            headers: token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {},
          }
        );

        const data =
          await response.json().catch(
            () => ({})
          );

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              data?.message ||
              "Unable to load company branding."
          );
        }

        if (data?.company) {
          selectCompany(data.company);
        }
      } catch (err) {
        setLogoError(
          err?.message ||
            "Unable to load company branding."
        );
      }
    },
    [
      currentCompany?.id,
      selectCompany,
    ]
  );


  useEffect(() => {
    loadCompanyBranding();
  }, [loadCompanyBranding]);


  /* ==========================================================
     COMPANY BRANDING PERMISSION
     ========================================================== */

  const canManageCompanyBranding =
    Boolean(
      user?.is_superuser ||
        user?.role === "OWNER" ||
        user?.role === "ADMIN"
    );


  /* ==========================================================
     PROFILE CHANGE
     ========================================================== */

  const handleProfileChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setProfile((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };


  /* ==========================================================
     PASSWORD CHANGE
     ========================================================== */

  const handlePasswordChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setPassword((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };


  /* ==========================================================
     SAVE PROFILE
     ========================================================== */

  const saveProfile = async (event) => {
    event.preventDefault();

    if (!user?.id) {
      setError(
        "Your account information is not available."
      );
      return;
    }

    if (
      !profile.first_name.trim() ||
      !profile.last_name.trim()
    ) {
      setError(
        "First name and last name are required."
      );
      return;
    }

    if (!profile.email.trim()) {
      setError(
        "Email address is required."
      );
      return;
    }

    setSavingProfile(true);
    setError("");
    setSuccess("");

    try {
      const updatedUser =
        await api.patch(
          "/api/accounts/profile/",
          {
            first_name:
              profile.first_name.trim(),

            last_name:
              profile.last_name.trim(),

            email:
              profile.email.trim(),

            phone:
              profile.phone.trim(),
          }
        );

      const nextUser = {
        ...user,
        ...(updatedUser || {}),
      };

      setUser(nextUser);

      setProfile({
        first_name:
          nextUser?.first_name || "",

        last_name:
          nextUser?.last_name || "",

        email:
          nextUser?.email || "",

        phone:
          nextUser?.phone || "",
      });

      setSuccess(
        "Your profile has been updated successfully."
      );
    } catch (err) {
      setError(
        extractError(err) ||
          "Unable to update your profile."
      );
    } finally {
      setSavingProfile(false);
    }
  };


  /* ==========================================================
     CHANGE PASSWORD
     ========================================================== */

  const changePassword = async (event) => {
    event.preventDefault();

    if (
      !password.current_password ||
      !password.new_password ||
      !password.confirm_password
    ) {
      setError(
        "Please complete all password fields."
      );
      return;
    }

    if (
      password.new_password !==
      password.confirm_password
    ) {
      setError(
        "New password and confirmation do not match."
      );
      return;
    }

    if (
      password.new_password.length < 8
    ) {
      setError(
        "Your new password must contain at least 8 characters."
      );
      return;
    }

    if (
      password.current_password ===
      password.new_password
    ) {
      setError(
        "Your new password must be different from your current password."
      );
      return;
    }

    setChangingPassword(true);
    setError("");
    setSuccess("");

    try {
      await api.post(
        "/api/accounts/change-password/",
        {
          current_password:
            password.current_password,

          new_password:
            password.new_password,

          confirm_password:
            password.confirm_password,
        }
      );

      setPassword({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });

      setShowPasswords({
        current: false,
        new: false,
        confirm: false,
      });

      setSuccess(
        "Your password has been changed successfully."
      );
    } catch (err) {
      setError(
        extractError(err) ||
          "Unable to change your password."
      );
    } finally {
      setChangingPassword(false);
    }
  };


  /* ==========================================================
     COMPANY LOGO UPLOAD
     ========================================================== */

  const uploadCompanyLogo = async (event) => {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file || !currentCompany?.id) {
      return;
    }

    setLogoError("");
    setError("");
    setSuccess("");

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setLogoError(
        "Please select a PNG, JPEG or WebP image."
      );
      return;
    }

    const maxSize =
      5 * 1024 * 1024;

    if (file.size > maxSize) {
      setLogoError(
        "Company logo must be 5 MB or smaller."
      );
      return;
    }

    setLogoSaving(true);

    try {
      const formData =
        new FormData();

      formData.append(
        "logo",
        file
      );

      const token =
        localStorage.getItem(
          "access_token"
        );

      const response = await fetch(
        `${API_BASE_URL}/api/companies/${currentCompany.id}/logo/`,
        {
          method: "PATCH",
          headers: token
            ? {
                Authorization:
                  `Bearer ${token}`,
              }
            : {},
          body: formData,
        }
      );

      const data =
        await response.json().catch(
          () => ({})
        );

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            "Unable to upload company logo."
        );
      }

      if (data?.company) {
        selectCompany(data.company);
      }

      setSuccess(
        "Company logo updated successfully. New invoices and payslips will use this logo."
      );
    } catch (err) {
      setLogoError(
        err?.message ||
          "Unable to upload company logo."
      );
    } finally {
      setLogoSaving(false);
    }
  };


  /* ==========================================================
     REMOVE COMPANY LOGO
     ========================================================== */

  const removeCompanyLogo = async () => {
    if (!currentCompany?.id) {
      return;
    }

    setLogoSaving(true);
    setLogoError("");
    setError("");
    setSuccess("");

    try {
      const token =
        localStorage.getItem(
          "access_token"
        );

      const response = await fetch(
        `${API_BASE_URL}/api/companies/${currentCompany.id}/logo/`,
        {
          method: "DELETE",
          headers: token
            ? {
                Authorization:
                  `Bearer ${token}`,
              }
            : {},
        }
      );

      const data =
        await response.json().catch(
          () => ({})
        );

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            "Unable to remove company logo."
        );
      }

      if (data?.company) {
        selectCompany(data.company);
      } else {
        selectCompany({
          ...currentCompany,
          logo: null,
        });
      }

      setSuccess(
        "Company logo removed successfully."
      );
    } catch (err) {
      setLogoError(
        err?.message ||
          "Unable to remove company logo."
      );
    } finally {
      setLogoSaving(false);
    }
  };


  const openRemoveLogoModal = () => {
    if (
      !currentCompany?.id ||
      !currentCompany?.logo ||
      logoSaving ||
      !canManageCompanyBranding
    ) {
      return;
    }

    setLogoError("");
    setShowRemoveLogoModal(true);
  };


  const closeRemoveLogoModal = () => {
    if (!logoSaving) {
      setShowRemoveLogoModal(false);
    }
  };


  const confirmRemoveLogo = async () => {
    await removeCompanyLogo();
    setShowRemoveLogoModal(false);
  };


  /* ==========================================================
     COMPANY DISPLAY NAME
     ========================================================== */

  const companyDisplayName =
    useMemo(() => {
      const name =
        currentCompany?.name ||
        "Company";

      const legalName =
        currentCompany?.legal_name ||
        "";

      if (
        legalName &&
        legalName !== name
      ) {
        return `${name} - ${legalName}`;
      }

      return name;
    }, [
      currentCompany?.name,
      currentCompany?.legal_name,
    ]);


  /* ==========================================================
     ACCOUNT SUMMARY
     ========================================================== */

  const accountStatus = useMemo(() => {
    if (!user) {
      return "Unknown";
    }

    return user.is_active_employee !== false
      ? "Active"
      : "Inactive";
  }, [user]);


  /* ==========================================================
     LOADING
     ========================================================== */

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-loading">
          <RefreshCw
            size={22}
            className="settings-spin"
          />

          <span>
            Loading account settings...
          </span>
        </div>
      </div>
    );
  }


  /* ==========================================================
     MAIN RENDER
     ========================================================== */

  return (
    <div className="settings-page">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="settings-page-header">
        <div>
          <div className="settings-eyebrow">
            ACCOUNT SETTINGS
          </div>

          <h1>Settings</h1>

          <p>
            Manage your profile, security and
            company branding.
          </p>
        </div>

        <button
          type="button"
          className="settings-refresh-button"
          onClick={() => loadUser(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={16}
            className={
              refreshing
                ? "settings-spin"
                : ""
            }
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>


      {/* =====================================================
          ALERTS
          ===================================================== */}

      {error && (
        <div className="settings-alert settings-alert-error">
          <AlertCircle size={17} />

          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={15} />
          </button>
        </div>
      )}


      {success && (
        <div className="settings-alert settings-alert-success">
          <CheckCircle2 size={17} />

          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="Dismiss success"
          >
            <X size={15} />
          </button>
        </div>
      )}


      {/* =====================================================
          ACCOUNT HERO
          ===================================================== */}

      <section className="settings-account-card">
        <div className="settings-account-avatar">
          {initials(user)}
        </div>

        <div className="settings-account-main">
          <div className="settings-account-name">
            {[
              user?.first_name,
              user?.last_name,
            ]
              .filter(Boolean)
              .join(" ") ||
              user?.username ||
              "User"}
          </div>

          <div className="settings-account-username">
            @{user?.username || "user"}
          </div>

          <div className="settings-account-meta">
            <span>
              <Mail size={14} />

              {user?.email ||
                "No email address"}
            </span>

            {user?.phone && (
              <span>
                <Phone size={14} />

                {user.phone}
              </span>
            )}
          </div>
        </div>

        <div className="settings-account-status">
          <span className="settings-status-dot" />

          <div>
            <span>Account Status</span>

            <strong>
              {accountStatus}
            </strong>
          </div>
        </div>
      </section>


      {/* =====================================================
          SETTINGS LAYOUT
          ===================================================== */}

      <div className="settings-layout">

        {/* ===================================================
            NAVIGATION
            =================================================== */}

        <aside className="settings-sidebar">

          <div className="settings-sidebar-title">
            SETTINGS
          </div>

          <button
            type="button"
            className={
              activeSection === "profile"
                ? "settings-nav-item settings-nav-item-active"
                : "settings-nav-item"
            }
            onClick={() =>
              setActiveSection("profile")
            }
          >
            <UserRound size={17} />

            <span>Profile</span>
          </button>


          <button
            type="button"
            className={
              activeSection === "security"
                ? "settings-nav-item settings-nav-item-active"
                : "settings-nav-item"
            }
            onClick={() =>
              setActiveSection("security")
            }
          >
            <ShieldCheck size={17} />

            <span>Security</span>
          </button>


          <button
            type="button"
            className={
              activeSection === "branding"
                ? "settings-nav-item settings-nav-item-active"
                : "settings-nav-item"
            }
            onClick={() =>
              setActiveSection("branding")
            }
          >
            <Building2 size={17} />

            <span>
              Company Branding
            </span>
          </button>

        </aside>


        {/* ===================================================
            CONTENT
            =================================================== */}

        <main className="settings-content">

          {/* =================================================
              PROFILE
              ================================================= */}

          {activeSection === "profile" && (
            <section className="settings-panel">

              <div className="settings-panel-header">

                <div className="settings-panel-icon">
                  <UserRound size={19} />
                </div>

                <div>
                  <div className="settings-section-label">
                    PROFILE INFORMATION
                  </div>

                  <h2>
                    Personal Information
                  </h2>

                  <p>
                    Update the personal information
                    associated with your Hindsfeet
                    account.
                  </p>
                </div>

              </div>


              <form
                className="settings-form"
                onSubmit={saveProfile}
              >

                <div className="settings-form-grid">

                  <label className="settings-field">
                    <span>
                      First Name *
                    </span>

                    <input
                      type="text"
                      name="first_name"
                      value={
                        profile.first_name
                      }
                      onChange={
                        handleProfileChange
                      }
                      placeholder="First name"
                      disabled={
                        savingProfile
                      }
                      required
                    />
                  </label>


                  <label className="settings-field">
                    <span>
                      Last Name *
                    </span>

                    <input
                      type="text"
                      name="last_name"
                      value={
                        profile.last_name
                      }
                      onChange={
                        handleProfileChange
                      }
                      placeholder="Last name"
                      disabled={
                        savingProfile
                      }
                      required
                    />
                  </label>


                  <label className="settings-field">
                    <span>
                      Email Address *
                    </span>

                    <div className="settings-input-with-icon">

                      <Mail size={16} />

                      <input
                        type="email"
                        name="email"
                        value={
                          profile.email
                        }
                        onChange={
                          handleProfileChange
                        }
                        placeholder="you@example.com"
                        disabled={
                          savingProfile
                        }
                        required
                      />

                    </div>
                  </label>


                  <label className="settings-field">
                    <span>
                      Phone Number
                    </span>

                    <div className="settings-input-with-icon">

                      <Phone size={16} />

                      <input
                        type="tel"
                        name="phone"
                        value={
                          profile.phone
                        }
                        onChange={
                          handleProfileChange
                        }
                        placeholder="Phone number"
                        disabled={
                          savingProfile
                        }
                      />

                    </div>
                  </label>


                  <label className="settings-field settings-field-full">
                    <span>
                      Username
                    </span>

                    <input
                      type="text"
                      value={
                        user?.username ||
                        ""
                      }
                      disabled
                    />

                    <small>
                      Your username is managed
                      by the system and cannot
                      be changed here.
                    </small>
                  </label>

                </div>


                <div className="settings-form-footer">

                  <div>
                    <span>
                      Account Role
                    </span>

                    <strong>
                      {roleLabel(
                        user?.role
                      )}
                    </strong>
                  </div>

                  <button
                    type="submit"
                    className="settings-primary-button"
                    disabled={
                      savingProfile
                    }
                  >
                    {savingProfile ? (
                      <>
                        <RefreshCw
                          size={16}
                          className="settings-spin"
                        />

                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />

                        Save Changes
                      </>
                    )}
                  </button>

                </div>

              </form>

            </section>
          )}


          {/* =================================================
              SECURITY
              ================================================= */}

          {activeSection === "security" && (
            <section className="settings-panel">

              <div className="settings-panel-header">

                <div className="settings-panel-icon">
                  <ShieldCheck size={19} />
                </div>

                <div>
                  <div className="settings-section-label">
                    ACCOUNT SECURITY
                  </div>

                  <h2>
                    Change Password
                  </h2>

                  <p>
                    Keep your Hindsfeet account
                    secure by using a strong,
                    private password.
                  </p>
                </div>

              </div>


              <form
                className="settings-form"
                onSubmit={
                  changePassword
                }
              >

                <div className="settings-password-grid">

                  <PasswordField
                    label="Current Password *"
                    name="current_password"
                    value={
                      password.current_password
                    }
                    onChange={
                      handlePasswordChange
                    }
                    show={
                      showPasswords.current
                    }
                    onToggle={() =>
                      setShowPasswords(
                        (current) => ({
                          ...current,
                          current:
                            !current.current,
                        })
                      )
                    }
                    placeholder="Enter current password"
                    disabled={
                      changingPassword
                    }
                  />


                  <PasswordField
                    label="New Password *"
                    name="new_password"
                    value={
                      password.new_password
                    }
                    onChange={
                      handlePasswordChange
                    }
                    show={
                      showPasswords.new
                    }
                    onToggle={() =>
                      setShowPasswords(
                        (current) => ({
                          ...current,
                          new:
                            !current.new,
                        })
                      )
                    }
                    placeholder="Enter new password"
                    disabled={
                      changingPassword
                    }
                  />


                  <PasswordField
                    label="Confirm New Password *"
                    name="confirm_password"
                    value={
                      password.confirm_password
                    }
                    onChange={
                      handlePasswordChange
                    }
                    show={
                      showPasswords.confirm
                    }
                    onToggle={() =>
                      setShowPasswords(
                        (current) => ({
                          ...current,
                          confirm:
                            !current.confirm,
                        })
                      )
                    }
                    placeholder="Confirm new password"
                    disabled={
                      changingPassword
                    }
                  />

                </div>


                <div className="settings-password-guidance">

                  <LockKeyhole size={18} />

                  <div>
                    <strong>
                      Password security
                    </strong>

                    <span>
                      Use at least 8 characters
                      and avoid using passwords
                      that are easy to guess.
                    </span>
                  </div>

                </div>


                <div className="settings-form-footer settings-form-footer-end">

                  <button
                    type="submit"
                    className="settings-primary-button"
                    disabled={
                      changingPassword
                    }
                  >
                    {changingPassword ? (
                      <>
                        <RefreshCw
                          size={16}
                          className="settings-spin"
                        />

                        Updating...
                      </>
                    ) : (
                      <>
                        <LockKeyhole
                          size={16}
                        />

                        Change Password
                      </>
                    )}
                  </button>

                </div>

              </form>

            </section>
          )}


          {/* =================================================
              COMPANY BRANDING
              ================================================= */}

          {activeSection === "branding" && (
            <section className="settings-panel">

              <div className="settings-panel-header">

                <div className="settings-panel-icon">
                  <Building2 size={19} />
                </div>

                <div>
                  <div className="settings-section-label">
                    COMPANY BRANDING
                  </div>

                  <h2>
                    Company Logo
                  </h2>

                  <p>
                    Upload your company logo once and
                    Hindsfeet will automatically use it
                    on generated invoices and employee
                    payslips.
                  </p>
                </div>

              </div>


              {logoError && (
                <div className="settings-branding-error">
                  <AlertCircle size={16} />

                  <span>
                    {logoError}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setLogoError("")
                    }
                    aria-label="Dismiss branding error"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}


              {!currentCompany ? (
                <div className="settings-branding-empty">

                  <Building2 size={24} />

                  <div>
                    <strong>
                      No company selected
                    </strong>

                    <span>
                      Select a company before managing
                      its branding.
                    </span>
                  </div>

                </div>
              ) : (
                <div className="settings-company-branding-card">

                  <div className="settings-company-branding-preview">

                    <div className="settings-company-branding-logo">

                      {currentCompany?.logo ? (
                        <img
                          src={
                            currentCompany.logo
                          }
                          alt={`${companyDisplayName} logo`}
                        />
                      ) : (
                        <div className="settings-company-branding-placeholder">

                          <ImagePlus
                            size={30}
                          />

                          <span>
                            No Logo
                          </span>

                        </div>
                      )}

                    </div>


                    <div className="settings-company-branding-company">

                      <span className="settings-section-label">
                        CURRENT COMPANY
                      </span>

                      <h3>
                        {companyDisplayName}
                      </h3>

                      {currentCompany?.address && (
                        <p>
                          {currentCompany.address}
                        </p>
                      )}

                      <div className="settings-company-branding-meta">

                        {currentCompany?.phone && (
                          <span>
                            {currentCompany.phone}
                          </span>
                        )}

                        {currentCompany?.email && (
                          <span>
                            {currentCompany.email}
                          </span>
                        )}

                        {currentCompany?.currency && (
                          <span>
                            Currency:{" "}
                            {currentCompany.currency}
                          </span>
                        )}

                      </div>

                    </div>

                  </div>


                  <div className="settings-branding-actions">

                    <label
                      className={
                        logoSaving
                          ? "settings-branding-upload settings-branding-upload-disabled"
                          : "settings-branding-upload"
                      }
                    >

                      <Upload size={16} />

                      <span>
                        {logoSaving
                          ? "Uploading..."
                          : currentCompany?.logo
                            ? "Replace Logo"
                            : "Upload Logo"}
                      </span>

                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={
                          uploadCompanyLogo
                        }
                        disabled={
                          logoSaving ||
                          !canManageCompanyBranding
                        }
                        hidden
                      />

                    </label>


                    {currentCompany?.logo && (
                      <button
                        type="button"
                        className="settings-branding-remove"
                        onClick={
                          openRemoveLogoModal
                        }
                        disabled={
                          logoSaving ||
                          !canManageCompanyBranding
                        }
                      >

                        <Trash2 size={16} />

                        {logoSaving
                          ? "Removing..."
                          : "Remove Logo"}

                      </button>
                    )}

                  </div>


                  <div className="settings-branding-guidance">

                    <div>
                      <strong>
                        Logo requirements
                      </strong>

                      <span>
                        PNG, JPEG or WebP · Maximum
                        file size 5 MB
                      </span>
                    </div>

                    <div>
                      <strong>
                        Automatic document branding
                      </strong>

                      <span>
                        The selected company's logo is
                        automatically loaded when Hindsfeet
                        generates invoices and payslips.
                      </span>
                    </div>

                  </div>


                  {!canManageCompanyBranding && (
                    <div className="settings-branding-permission">

                      <ShieldCheck size={16} />

                      <span>
                        Only company owners and
                        administrators can change company
                        branding.
                      </span>

                    </div>
                  )}

                </div>
              )}

            </section>
          )}


          {/* =================================================
              ACCOUNT INFORMATION
              ================================================= */}

          <section className="settings-account-information">

            <div className="settings-information-header">

              <div>
                <div className="settings-section-label">
                  ACCOUNT INFORMATION
                </div>

                <h3>
                  Account Details
                </h3>
              </div>

            </div>


            <div className="settings-information-grid">

              <div>
                <span>
                  Username
                </span>

                <strong>
                  {user?.username ||
                    "—"}
                </strong>
              </div>


              <div>
                <span>
                  Role
                </span>

                <strong>
                  {roleLabel(
                    user?.role
                  )}
                </strong>
              </div>


              <div>
                <span>
                  Account Status
                </span>

                <strong>
                  {accountStatus}
                </strong>
              </div>


              <div>
                <span>
                  Current Company
                </span>

                <strong>
                  {currentCompany?.name ||
                    "No company selected"}
                </strong>
              </div>


              <div>
                <span>
                  Company Currency
                </span>

                <strong>
                  {currentCompany?.currency ||
                    "—"}
                </strong>
              </div>


              <div>
                <span>
                  Account ID
                </span>

                <strong>
                  {user?.id || "—"}
                </strong>
              </div>

            </div>

          </section>

        </main>

      </div>


      {/* =====================================================
          REMOVE LOGO CONFIRMATION MODAL
          ===================================================== */}

      {showRemoveLogoModal && (
        <div
          className="settings-confirm-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !logoSaving
            ) {
              closeRemoveLogoModal();
            }
          }}
        >

          <div
            className="settings-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-logo-title"
            aria-describedby="remove-logo-description"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="settings-confirm-icon">
              <Trash2 size={22} />
            </div>


            <div className="settings-confirm-content">

              <h3 id="remove-logo-title">
                Remove company logo?
              </h3>

              <p id="remove-logo-description">
                This will remove the logo from{" "}
                <strong>
                  {companyDisplayName}
                </strong>
                . New invoices and payslips will no longer
                display the company logo.
              </p>

            </div>


            <div className="settings-confirm-actions">

              <button
                type="button"
                className="settings-confirm-cancel"
                onClick={closeRemoveLogoModal}
                disabled={logoSaving}
              >
                Cancel
              </button>


              <button
                type="button"
                className="settings-confirm-danger"
                onClick={confirmRemoveLogo}
                disabled={logoSaving}
              >

                {logoSaving ? (
                  <>
                    <RefreshCw
                      size={15}
                      className="settings-spin"
                    />

                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />

                    Remove Logo
                  </>
                )}

              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}