{/*import { Navigate, Outlet } from "react-router-dom";

const getRole = () => {
  try {
    return JSON.parse(localStorage.getItem("user"))?.role || null;
  } catch {
    return null;
  }
};

const redirectByRole = (role) => {
  if (role === "admin") return "/admin";
  if (role === "worker") return "/worker";
  if (role === "customer") return "/portal";
  return "/login";
};

export default function ProtectedRoute({ allowRoles = [] }) {
  const token = localStorage.getItem("token");
  const role = getRole();

  if (!token) return <Navigate to="/login" replace />;

  if (!role) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return <Navigate to="/login" replace />;
  }

  if (allowRoles.length && !allowRoles.includes(role)) {
    return <Navigate to={redirectByRole(role)} replace />;
  }

  return <Outlet />;
}
*/}


import { Navigate, Outlet } from "react-router-dom";

const parseJwt = (token) => {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("authToken");
  localStorage.removeItem("jwt");
  localStorage.removeItem("user");
  localStorage.removeItem("currentUser");
  localStorage.removeItem("auth");
};

export default function ProtectedRoute({ allowRoles = [] }) {
  const token = localStorage.getItem("token");
  const userRaw = localStorage.getItem("user");

  let user = null;
  try {
    user = userRaw ? JSON.parse(userRaw) : null;
  } catch {
    user = null;
  }

  if (!token || !user) {
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  const payload = parseJwt(token);
  if (!payload || (payload.role && payload.role !== user.role) || (payload.id && user._id && payload.id !== user._id)) {
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  if (allowRoles.length && !allowRoles.includes(user.role)) {
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
