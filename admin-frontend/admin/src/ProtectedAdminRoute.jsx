// src/ProtectedAdminRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ADMIN_API, apiFetch } from "@/config/api";
import RateLimited from "@/components/RateLimited";

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
  const [status, setStatus] = useState("checking"); // checking | in | out | limited
  const [retryAfter, setRetryAfter] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    apiFetch(`${ADMIN_API}/api/verify-token`)
      .then((res) => {
        if (cancelled) return;

        if (res.ok) {
          setStatus("in");
          return;
        }

        // ⚠️ Only 401 and 403 mean "not authenticated".
        //
        // This used to be `setStatus(res.ok ? "in" : "out")`, so EVERY non-OK
        // response sent the admin to the login page — a rate limit, a 500, a
        // backend restart mid-request. That is why hitting the request cap
        // looked exactly like being logged out: the session was perfectly
        // valid, and the panel said otherwise.
        //
        // 429 is a different situation with a different remedy, so it gets its
        // own screen rather than a misleading trip to the login form.
        if (res.status === 429) {
          // Seconds until the window resets. `RateLimit-Reset` is the standard
          // header the limiter sets; Retry-After is the older spelling. Either
          // may be absent, in which case the page falls back to "an hour".
          const reset =
            res.headers.get("ratelimit-reset") ?? res.headers.get("retry-after");
          setRetryAfter(reset);
          setStatus("limited");
          return;
        }

        if (res.status === 401 || res.status === 403) {
          // Clear the stale UI hint so the login page does not look logged in.
          localStorage.removeItem("admin_auth");
          localStorage.removeItem("admin_user");
          setStatus("out");
          return;
        }

        // Anything else (500, 502, a cold-start error page) is a SERVER fault,
        // not a statement about this session. Fail closed — protected content
        // cannot render without confirmation — but do not wipe the local hint,
        // because nothing has told us the session ended.
        setStatus("out");
      })
      .catch(() => {
        // Network failure is not proof of logout, but protected content cannot
        // be rendered without confirmation. Fail closed.
        if (!cancelled) setStatus("out");
      });

    return () => {
      cancelled = true;
    };
    // `attempt` lets the lockout page's Try again button re-run this check
    // without a full page reload — which would itself spend another page load
    // against the very limit the admin is waiting out.
  }, [location.pathname, attempt]);

  if (status === "checking") {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <p className="text-[#68232B]">Checking session…</p>
      </div>
    );
  }

  if (status === "limited") {
    return (
      <RateLimited
        retryAfterSeconds={retryAfter}
        onRetry={() => {
          setStatus("checking");
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  if (status === "out") {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedAdminRoute;
