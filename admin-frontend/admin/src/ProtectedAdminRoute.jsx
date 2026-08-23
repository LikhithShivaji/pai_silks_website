// src/ProtectedAdminRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ADMIN_API, apiFetch } from "@/config/api";

/**
 * Route guard that asks the SERVER whether the session is a valid ADMIN one.
 *
 * This previously read `localStorage.getItem("admin_auth")`. Typing
 * `localStorage.setItem("admin_auth","true")` in DevTools granted the entire
 * admin panel — product management, order status, customer data. That was the
 * only gate in the whole application. See CLAUDE.md AF-02.
 *
 * /api/verify-token runs behind authMiddleware AND requireAdmin, so a 200 means
 * both "the session is real" and "this account is an admin". A customer session
 * gets 403 and lands back on the login page.
 *
 * This is a UX guard, not the security boundary. Every admin API route enforces
 * both middlewares independently, so bypassing this in DevTools now yields a
 * panel where every request returns 401 or 403.
 */
const ProtectedAdminRoute = ({ children }) => {
  const [status, setStatus] = useState("checking"); // checking | in | out
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    apiFetch(`${ADMIN_API}/api/verify-token`)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          // 401 (no/invalid session) or 403 (valid session, not an admin).
          // Clear the stale UI hint so the login page does not look logged in.
          localStorage.removeItem("admin_auth");
          localStorage.removeItem("admin_user");
        }
        setStatus(res.ok ? "in" : "out");
      })
      .catch(() => {
        // Network failure is not proof of logout, but protected content cannot
        // be rendered without confirmation. Fail closed.
        if (!cancelled) setStatus("out");
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (status === "checking") {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <p className="text-[#68232B]">Checking session…</p>
      </div>
    );
  }

  if (status === "out") {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedAdminRoute;
