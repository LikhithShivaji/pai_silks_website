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
