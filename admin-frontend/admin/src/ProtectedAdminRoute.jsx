// src/components/ProtectedAdminRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";

const ProtectedAdminRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem("admin_auth");

  // If we have the key, show the page
  if (isAuthenticated) {
    return children;
  }

  // If NOT, go back to Login (which is "/" in your router)
  return <Navigate to="/" replace />;
};

export default ProtectedAdminRoute;