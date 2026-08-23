import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { CLIENT_API, apiFetch } from "@/config/api";

/**
 * Route guard that asks the SERVER whether the session is valid.
 *
 * /my-orders, /my-profile and /checkout previously had no guard at all — they
 * rendered for anyone, and /checkout reached its submit handler before its own
 * userId check. See CLAUDE.md CF-08.
 *
 * It deliberately does NOT read localStorage. A localStorage flag is something
 * the visitor can set themselves; only the server can say whether the session
 * cookie is real. The equivalent admin-side check was exactly that mistake —
 * `localStorage.setItem("admin_auth","true")` granted the whole panel (AF-02).
 *
 * This is a UX guard, not the security boundary. Every protected API route
 * enforces authMiddleware independently, so bypassing this in DevTools reveals
 * an empty page and nothing more.
 */
const PrivateRoute = ({ children }) => {
  const [status, setStatus] = useState("checking"); // checking | in | out
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    apiFetch(`${CLIENT_API}/api/verify-token`)
      .then((res) => {
        if (!cancelled) setStatus(res.ok ? "in" : "out");
      })
      .catch(() => {
        // Network failure is not proof of logout, but we cannot render
        // protected content without confirmation. Fail closed.
        if (!cancelled) setStatus("out");
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDF8F4]">
        <p className="text-[#68232B]">Loading…</p>
      </div>
    );
  }

  if (status === "out") {
    // `from` lets the login page send the user back where they were heading —
    // the existing login flow already reads location.state.from.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default PrivateRoute;
