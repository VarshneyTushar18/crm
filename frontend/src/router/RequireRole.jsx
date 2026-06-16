import { Navigate } from "react-router-dom";

export default function RequireRole({ allow = [], children }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) return <Navigate to="/login" replace />;
  if (allow.length && !allow.includes(role)) return <Navigate to="/login" replace />;

  return children;
}
