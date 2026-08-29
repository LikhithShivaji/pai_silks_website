import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CLIENT_API, apiFetch } from "@/config/api";

/**
 * The single source of truth for "is this visitor signed in?".
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 * ---------------------------------------------------------------------------
 * Identity was answered independently in FOURTEEN places, all of them reading
 * `localStorage.getItem("user_id")` — a plain string the visitor can edit, and
 * one that has no connection to whether the httpOnly session cookie is still
 * valid. Phase 2 fixed the security half (PrivateRoute and every protected API
 * route verify server-side), but the UI's notion of identity was never
 * converted, so the two could drift apart.
 *
 * They did, in practice, on 2026-08-29: the storefront greeted the owner by
 * name and offered a Logout button while `/my-orders` bounced him to `/login`.
 * The database session was genuinely ACTIVE; the browser had simply lost the
 * cookie, and `localStorage` outlived it. Same root cause behind "the cart
 * empties when I refresh" — `CartContext` reads the same key to decide whether
 * to sync with the server, so a stale key silently drops a logged-in customer
 * into guest mode, where items never reach the database.
 * See CLAUDE.md CF-55, CF-05, CF-46.
 *
 * ---------------------------------------------------------------------------
 * The rule
 * ---------------------------------------------------------------------------
 * The SERVER decides who you are. localStorage may hold display niceties (a
 * name to greet you with) but must never decide identity, access or whether a
 * cart syncs.
 *
 * This is still a UX layer, not a security boundary: every protected route
 * enforces `authMiddleware` independently, so forging state here reveals an
 * empty page and nothing more.
 */
const AuthContext = createContext({
  status: "checking",
  user: null,
  isAuthenticated: false,
  refresh: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  // "checking" until the first answer arrives. Consumers must handle it — a
  // component that treats "not yet known" as "logged out" produces exactly the
  // flicker-then-redirect this context exists to remove.
  const [status, setStatus] = useState("checking");
  const [user, setUser] = useState(null);

  const check = useCallback(async () => {
    try {
      const res = await apiFetch(`${CLIENT_API}/api/verify-token`);
      if (res.ok) {
        const body = await res.json();
        setUser(body.user ?? null);
        setStatus("in");
        return true;
      }
      // A 401 is a definitive answer: the session is gone.
      setUser(null);
      setStatus("out");
      return false;
    } catch {
      // A network failure is NOT proof of logout — the backend may simply be
      // cold-starting. Treated as signed out because protected content cannot
      // be rendered without confirmation, but deliberately kept distinct in
      // intent from a real 401, and the stale display name is cleared either
      // way so the UI cannot claim a session it has not confirmed.
      setUser(null);
      setStatus("out");
      return false;
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  /**
   * Sign out.
   *
   * The server call is what matters: it flips the session row to LOGOUT and
   * clears the httpOnly cookies, so the session dies even if this tab never
   * reloads. Clearing localStorage only tidies the display hints.
   *
   * `wishlist` is cleared alongside `cart` — it was previously left behind, so
   * on a shared device the next visitor saw the previous customer's saved
   * items, prices and images (CF-11).
   */
  const signOut = useCallback(async () => {
    try {
      await apiFetch(`${CLIENT_API}/api/logout`, { method: "POST" });
    } catch (err) {
      // Even if the call fails, clear locally — leaving someone on a page that
      // looks authenticated is worse than a server session that ages out.
      console.error("Logout request failed:", err);
    } finally {
      try {
        ["user_id", "user_name", "user_email", "cart", "wishlist"].forEach((k) =>
          localStorage.removeItem(k)
        );
      } catch {
        // localStorage can throw in private browsing; nothing further to do.
      }
      setUser(null);
      setStatus("out");
    }
  }, []);

  const value = {
    status,
    user,
    isAuthenticated: status === "in",
    refresh: check,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
