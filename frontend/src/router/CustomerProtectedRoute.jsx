import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function CustomerProtectedRoute({ children }) {
  const location = useLocation();

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role"); // "customer" expected

  if (!token || role !== "customer") {
    return <Navigate to="/portal/login" replace state={{ from: location.pathname }} />;
  }

  // ✅ IMPORTANT: render wrapped layout/page
  return children;
}