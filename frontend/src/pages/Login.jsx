import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  UserRound,
} from "lucide-react";

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

// Imported via relative path to ensure webpack/vite builds the logo correctly
import hindsfeetLogo from "../assets/hindsfeet-logo.png";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!username.trim()) {
      setError("Please enter your username.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    try {
      setSubmitting(true);

      await login(username.trim(), password);

      // Always send a newly authenticated user to
      // the Welcome/Cover page first.
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err?.data?.detail ||
          err?.message ||
          "Unable to sign in. Please check your credentials."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      {/* Decorative background */}
      <div className="login-background-shape login-shape-one" />
      <div className="login-background-shape login-shape-two" />

      <div className="login-container">
        {/* Branding */}
        <div className="login-brand">
          <div className="login-brand-mark">
            <img
              src={hindsfeetLogo}
              alt="Hindsfeet Logo"
              className="login-brand-logo-img"
            />
          </div>

          <div>
            <div className="login-brand-name">Hindsfeet</div>
            <div className="login-brand-subtitle">ACCOUNTING</div>
          </div>
        </div>

        {/* Card */}
        <div className="login-card">
          <div className="login-heading">
            <h1>Welcome back</h1>
            <p>Sign in to access your accounting workspace.</p>
          </div>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div className="login-field">
              <label htmlFor="username">
                Username
              </label>

              <div className="login-input-wrapper">
                <UserRound size={17} />

                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(event.target.value)
                  }
                  placeholder="Enter your username"
                  autoComplete="username"
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Password */}
            <div className="login-field">
              <label htmlFor="password">
                Password
              </label>

              <div className="login-input-wrapper">
                <LockKeyhole size={17} />

                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={submitting}
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (value) => !value
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="login-submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="login-spinner" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="login-footer">
          Hindsfeet Accounting{" "}
          <span>•</span>{" "}
          Secure financial management
        </div>
      </div>
    </div>
  );
}