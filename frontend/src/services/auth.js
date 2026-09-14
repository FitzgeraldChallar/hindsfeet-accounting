const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const AUTH_USER_KEY = "auth_user";


// ============================================================
// TOKEN HELPERS
// ============================================================

export function getAccessToken() {
  return localStorage.getItem(
    ACCESS_TOKEN_KEY
  );
}


export function getRefreshToken() {
  return localStorage.getItem(
    REFRESH_TOKEN_KEY
  );
}


export function hasAccessToken() {
  return Boolean(
    getAccessToken()
  );
}


// ============================================================
// USER HELPERS
// ============================================================

export function getStoredUser() {
  try {
    const stored =
      localStorage.getItem(
        AUTH_USER_KEY
      );

    return stored
      ? JSON.parse(stored)
      : null;
  } catch {
    return null;
  }
}


// ============================================================
// LOGIN
// ============================================================

export async function login(
  username,
  password
) {
  const response = await fetch(
    `${API_BASE_URL}/api/accounts/login/`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    }
  );

  let data = null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(
      data?.detail ||
        data?.message ||
        "Login failed."
    );

    error.status =
      response.status;

    error.data = data;

    throw error;
  }


  if (data?.access) {
    localStorage.setItem(
      ACCESS_TOKEN_KEY,
      data.access
    );
  }


  if (data?.refresh) {
    localStorage.setItem(
      REFRESH_TOKEN_KEY,
      data.refresh
    );
  }


  if (data?.user) {
    localStorage.setItem(
      AUTH_USER_KEY,
      JSON.stringify(
        data.user
      )
    );
  }


  return data;
}


// ============================================================
// REFRESH ACCESS TOKEN
// ============================================================

export async function refreshAccessToken() {
  const refreshToken =
    getRefreshToken();

  if (!refreshToken) {
    throw new Error(
      "No refresh token available."
    );
  }


  const response = await fetch(
    `${API_BASE_URL}/api/accounts/token/refresh/`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        refresh:
          refreshToken,
      }),
    }
  );


  let data = null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }


  if (!response.ok) {
    const error = new Error(
      data?.detail ||
        data?.message ||
        "Session refresh failed."
    );

    error.status =
      response.status;

    error.data = data;

    throw error;
  }


  if (!data?.access) {
    throw new Error(
      "The server did not return a new access token."
    );
  }


  localStorage.setItem(
    ACCESS_TOKEN_KEY,
    data.access
  );


  /*
   * If refresh-token rotation is enabled
   * on the backend, store the new refresh
   * token as well.
   */
  if (data?.refresh) {
    localStorage.setItem(
      REFRESH_TOKEN_KEY,
      data.refresh
    );
  }


  return data.access;
}


// ============================================================
// CURRENT USER
// ============================================================

export async function getCurrentUser() {
  let accessToken =
    getAccessToken();


  if (!accessToken) {
    throw new Error(
      "No access token available."
    );
  }


  let response =
    await fetch(
      `${API_BASE_URL}/api/accounts/me/`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
      }
    );


  /*
   * If the access token has expired,
   * silently refresh it and retry once.
   */
  if (
    response.status === 401
  ) {
    try {
      accessToken =
        await refreshAccessToken();

      response =
        await fetch(
          `${API_BASE_URL}/api/accounts/me/`,
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
              "Content-Type":
                "application/json",
            },
          }
        );
    } catch {
      throw new Error(
        "Your session has expired."
      );
    }
  }


  let data = null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }


  if (!response.ok) {
    const error = new Error(
      data?.detail ||
        data?.message ||
        "Unable to load current user."
    );

    error.status =
      response.status;

    error.data = data;

    throw error;
  }


  localStorage.setItem(
    AUTH_USER_KEY,
    JSON.stringify(data)
  );


  return data;
}


// ============================================================
// LOGOUT
// ============================================================

export function logout() {
  localStorage.removeItem(
    ACCESS_TOKEN_KEY
  );

  localStorage.removeItem(
    REFRESH_TOKEN_KEY
  );

  localStorage.removeItem(
    AUTH_USER_KEY
  );


  /*
   * Tell AuthContext that the session
   * has ended.
   */
  window.dispatchEvent(
    new Event("auth:logout")
  );
}


export {
  API_BASE_URL,
};