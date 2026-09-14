import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  getCurrentUser,
  getStoredUser,
  hasAccessToken,
  login as loginRequest,
  logout as logoutRequest,
} from "../services/auth";


const AuthContext =
  createContext(null);


export function AuthProvider({
  children,
}) {
  const [
    user,
    setUser,
  ] = useState(
    getStoredUser
  );


  const [
    loading,
    setLoading,
  ] = useState(true);


  // ==========================================================
  // INITIAL SESSION CHECK
  // ==========================================================

  useEffect(() => {
    async function loadUser() {
      if (!hasAccessToken()) {
        setLoading(false);
        return;
      }


      try {
        /*
         * getCurrentUser() now automatically
         * refreshes an expired access token.
         */
        const currentUser =
          await getCurrentUser();


        setUser(
          currentUser
        );


        localStorage.setItem(
          "auth_user",
          JSON.stringify(
            currentUser
          )
        );
      } catch {
        /*
         * Only reach this point when the
         * access token AND refresh token
         * are no longer usable.
         */
        logoutRequest();
        setUser(null);
      } finally {
        setLoading(false);
      }
    }


    loadUser();
  }, []);


  // ==========================================================
  // LISTEN FOR SESSION EXPIRATION
  // ==========================================================

  useEffect(() => {
    function handleLogout() {
      setUser(null);
    }


    window.addEventListener(
      "auth:logout",
      handleLogout
    );


    return () => {
      window.removeEventListener(
        "auth:logout",
        handleLogout
      );
    };
  }, []);


  // ==========================================================
  // LOGIN
  // ==========================================================

  async function login(
    username,
    password
  ) {
    const data =
      await loginRequest(
        username,
        password
      );


    const authenticatedUser =
      data.user ||
      getStoredUser();


    setUser(
      authenticatedUser
    );


    return data;
  }


  // ==========================================================
  // LOGOUT
  // ==========================================================

  function logout() {
    logoutRequest();

    setUser(null);
  }


  // ==========================================================
  // CONTEXT VALUE
  // ==========================================================

  const value = {
    user,
    loading,

    isAuthenticated:
      Boolean(user),

    login,
    logout,
  };


  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const context =
    useContext(
      AuthContext
    );


  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }


  return context;
}