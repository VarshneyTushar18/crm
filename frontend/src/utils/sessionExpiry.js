const AUTH_KEYS = [
  "token",
  "authToken",
  "jwt",
  "user",
  "currentUser",
  "auth",
  "role",
  "customer",
  "customer_token",
  "isLogout",
];

let redirecting = false;

const clearAuthStorage = () => {
  AUTH_KEYS.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  });
};

const getRole = () => {
  try {
    const role = window.localStorage.getItem("role");
    if (role) return role;
    const user = JSON.parse(window.localStorage.getItem("user") || "{}");
    return user?.role || null;
  } catch {
    return null;
  }
};

const resolveLoginPath = () => {
  const path = window.location.pathname || "";
  const role = getRole();
  if (role === "customer" || path.startsWith("/portal")) {
    return "/portal/login";
  }
  return "/login";
};

export const isAuthSessionError = (error) => {
  const response = error?.response;
  if (!response || response.status !== 401) return false;

  const data = response.data || {};
  if (data.jwtExpired) return true;

  const errorName = data?.error?.name || "";
  if (errorName === "JsonWebTokenError" || errorName === "TokenExpiredError") {
    return true;
  }

  const message = String(data.message || "").toLowerCase();
  return (
    message.includes("session expired") ||
    message.includes("authorization denied") ||
    message.includes("already logout") ||
    message.includes("no authentication token") ||
    message.includes("token verification failed") ||
    message.includes("user doesn't exist") ||
    message.includes("user doens't exist")
  );
};

/**
 * Clear auth and redirect to login once (prevents 401 toast spam).
 * @returns {boolean} true when this was treated as a session expiry
 */
export const redirectOnSessionExpired = () => {
  if (typeof window === "undefined") return false;
  if (redirecting) return true;

  const path = window.location.pathname || "";
  if (
    path === "/login" ||
    path === "/portal/login" ||
    path.startsWith("/logout") ||
    path.startsWith("/register") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password")
  ) {
    clearAuthStorage();
    return true;
  }

  redirecting = true;
  const loginPath = resolveLoginPath();
  clearAuthStorage();
  window.location.replace(loginPath);
  return true;
};

export const attachAuthExpiryInterceptor = (client) => {
  if (!client?.interceptors?.response) return;

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (isAuthSessionError(error)) {
        redirectOnSessionExpired();
      }
      return Promise.reject(error);
    }
  );
};
