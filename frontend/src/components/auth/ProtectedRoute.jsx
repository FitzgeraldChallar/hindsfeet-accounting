import {
  Navigate,
  Outlet,
} from "react-router-dom";

import { useAuth } from "../../context/AuthContext";


export default function ProtectedRoute() {
  const {
    isAuthenticated,
    loading,
  } = useAuth();


  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />

        <p>
          Loading your account...
        </p>
      </div>
    );
  }


  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }


  return <Outlet />;
}