// Central API base URLs.
//
// These come from Vite env vars, which are substituted at BUILD time —
// `npm run dev` loads .env, `npm run build` loads .env.production.
// The values end up as plain strings in the bundle, so they are PUBLIC.
// Never put a secret (AWS key, API secret, JWT secret) in a VITE_* var.
//
// The localhost fallbacks let `npm run dev` work with no .env present.

export const CLIENT_API =
  import.meta.env.VITE_CLIENT_API_BASE ?? "http://localhost:9034";

// The storefront currently pulls its product catalogue from the ADMIN
// backend. That is a known defect (CLAUDE.md CF-22) to be fixed in
// Phase 5; the base URL is parameterised here so the switch is a
// one-line change when we get there.
export const ADMIN_API =
  import.meta.env.VITE_ADMIN_API_BASE ?? "http://localhost:9032";

// Flat shipping fee, in rupees — FOR DISPLAY ONLY.
//
// The server owns the real value (client-backend appDefines.SHIPPING_FEE)
// and adds it to total_amount itself. This constant exists so the cart and
// checkout can show the customer what they will be charged before the order
// is created. If the two ever drift, the SERVER value is what gets billed.
//
// Keep this in sync with client-backend/src/constants/appDefines.js.
// See CLAUDE.md CF-03.
export const SHIPPING_FEE = 100;
