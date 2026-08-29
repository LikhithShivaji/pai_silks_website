import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";

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
  // Reads the SHARED auth state instead of making its own /api/verify-token
  // call on every navigation.
  //
  // Two reasons. One: it was the only part of the app asking the server, while
  // the header asked localStorage — so the two could disagree, and did (the
  // storefront greeted a signed-out customer by name and then refused them
  // their orders). Two: it re-checked on every route change, so moving between
  // protected pages issued a request each time. One context, one answer.
  // See CLAUDE.md CF-55.
  const { status } = useAuth();
  const location = useLocation();

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
