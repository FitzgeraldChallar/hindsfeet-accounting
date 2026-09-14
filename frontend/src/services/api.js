import {
  refreshAccessToken,
  logout,
} from "./auth";


const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";


let refreshPromise = null;


// ============================================================
// REFRESH TOKEN — SINGLE REQUEST LOCK
// ============================================================

async function getFreshAccessToken() {
  /*
   * Prevent multiple simultaneous API requests
   * from triggering multiple refresh requests.
   */
  if (!refreshPromise) {
    refreshPromise =
      refreshAccessToken()
        .finally(() => {
          refreshPromise = null;
        });
  }

  return refreshPromise;
}


// ============================================================
// API REQUEST
// ============================================================

async function request(
  endpoint,
  options = {},
  retry = true
) {
  let token =
    localStorage.getItem(
      "access_token"
    );


  const headers = {
    "Content-Type":
      "application/json",
    ...(options.headers || {}),
  };


  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }


  let response;


  try {
    response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,
        headers,
      }
    );
  } catch (error) {
    throw error;
  }


  /*
   * ========================================================
   * ACCESS TOKEN EXPIRED
   * ========================================================
   *
   * Attempt one silent refresh.
   */
  if (
    response.status === 401 &&
    retry
  ) {
    try {
      const newToken =
        await getFreshAccessToken();


      return request(
        endpoint,
        {
          ...options,
          headers: {
            ...(options.headers || {}),
            Authorization:
              `Bearer ${newToken}`,
          },
        },
        false
      );
    } catch (refreshError) {
      /*
       * Refresh token is also invalid/
       * expired. Now the user really
       * needs to authenticate again.
       */
      logout();

      const error =
        new Error(
          "Your session has expired. Please log in again."
        );

      error.status = 401;
      error.data =
        refreshError?.data;

      throw error;
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
    const error =
      new Error(
        data?.detail ||
          data?.message ||
          "Something went wrong."
      );

    error.status =
      response.status;

    error.data = data;

    throw error;
  }


  return data;
}


// ============================================================
// API METHODS
// ============================================================

export const api = {
  get(
    endpoint,
    options = {}
  ) {
    return request(
      endpoint,
      {
        ...options,
        method: "GET",
      }
    );
  },


  post(
    endpoint,
    body,
    options = {}
  ) {
    return request(
      endpoint,
      {
        ...options,
        method: "POST",
        body:
          JSON.stringify(body),
      }
    );
  },


  put(
    endpoint,
    body,
    options = {}
  ) {
    return request(
      endpoint,
      {
        ...options,
        method: "PUT",
        body:
          JSON.stringify(body),
      }
    );
  },


  patch(
    endpoint,
    body,
    options = {}
  ) {
    return request(
      endpoint,
      {
        ...options,
        method: "PATCH",
        body:
          JSON.stringify(body),
      }
    );
  },


  delete(
    endpoint,
    options = {}
  ) {
    return request(
      endpoint,
      {
        ...options,
        method: "DELETE",
      }
    );
  },
};


export {
  API_BASE_URL,
};