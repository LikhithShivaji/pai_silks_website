// Central API base URLs.
//
// These come from Vite env vars, which are substituted at BUILD time —
// `npm run dev` loads .env, `npm run build` loads .env.production.
// The values end up as plain strings in the bundle, so they are PUBLIC.
// Never put a secret (AWS key, API secret, JWT secret) in a VITE_* var.
//
// The localhost fallbacks let `npm run dev` work with no .env present.

export const ADMIN_API =
  import.meta.env.VITE_ADMIN_API_BASE ?? "http://localhost:9032";

// The admin panel also reads a couple of endpoints from the customer
// backend (bestsellers, collections). See CLAUDE.md AF-07.
export const CLIENT_API =
  import.meta.env.VITE_CLIENT_API_BASE ?? "http://localhost:9034";

/**
 * fetch() that always sends cookies.
 *
 * Every call in this app used bare fetch(), which defaults to
 * credentials:'same-origin'. Because the API is on a different origin, the
 * browser DISCARDED the Set-Cookie headers at login and never sent a cookie
 * afterwards — the entire session mechanism was inert. See CLAUDE.md AF-15.
 *
 * A wrapper rather than 13 hand-edited call sites: forgetting the option on one
 * new call would silently log that request out, and nothing would fail loudly
 * enough to notice. Safe by default is the point.
 *
 * Callers can still override anything, including credentials, since `options`
 * is spread last.
 */
export const apiFetch = (url, options = {}) =>
  fetch(url, { credentials: "include", ...options });
