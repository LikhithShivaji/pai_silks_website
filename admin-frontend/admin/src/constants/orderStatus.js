/**
 * Order statuses — the frontend's copy of the backend enum.
 *
 * MUST stay in sync with admin-backend/src/constants/appDefines.js
 * (ORDER_STATUSES / ORDER_STATUS_ACTIVE / ORDER_STATUS_TERMINAL).
 *
 * ---------------------------------------------------------------------------
 * Why this file exists
 * ---------------------------------------------------------------------------
 * The dashboard used to run THREE disagreeing vocabularies at once:
 *
 *   database  Pending · Confirmed · Packed · Shipped · Out for Delivery · Delivered
 *   SQL       SUM(status = 'Active')          <- a status that never existed
 *   this app  ['pending','processing','shipped'] / ['completed','delivered']
 *
 * Consequences, both verified against real rows:
 *   - "Active Orders" read 0 permanently, because nothing is ever 'Active'.
 *   - Confirmed, Packed and Out for Delivery were counted in NEITHER the
 *     active nor the completed card — three of six states simply invisible.
 *
 * The lists below are DERIVED from ORDER_STATUSES rather than retyped, so
 * adding a seventh status cannot silently drop it from the counts again. That
 * re-typing is precisely what caused the bug. See CLAUDE.md AB-17.
 */

export const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
];

/** The one terminal state. Everything else is still in flight. */
export const ORDER_STATUS_TERMINAL = "Delivered";

/** Derived, never hand-listed — see the note above. */
export const ORDER_STATUS_ACTIVE = ORDER_STATUSES.filter(
  (s) => s !== ORDER_STATUS_TERMINAL
);

/**
 * Compare statuses case- and whitespace-insensitively.
 *
 * Order rows have reached the UI as "delivered", "Delivered" and " Delivered "
 * depending on the path, and the old code compared with `===` in one place and
 * `.toLowerCase()` in another. Normalising in one helper removes that class of
 * mismatch.
 */
export const normalizeStatus = (value) =>
  String(value ?? "").trim().toLowerCase();

const inGroup = (statuses) => {
  const set = new Set(statuses.map(normalizeStatus));
  return (order) => set.has(normalizeStatus(order?.status));
};

/**
 * The dashboard's filter tabs.
 *
 * Naming (owner decision, 2026-08-28):
 *   New         - just arrived, not yet actioned
 *   Processing  - accepted and being prepared
 *   Dispatched  - with the courier (DTDC / India Post)
 *   All Orders  - everything, start to date
 *
 * "New" rather than "Recent" deliberately: the group is defined by STATE, not
 * by time, and the table is separately sortable by date.
 *
 * Delivered has no tab of its own — it is finished business and appears under
 * All Orders.
 */
export const ORDER_FILTERS = [
  {
    key: "new",
    label: "New",
    statuses: ["Pending"],
  },
  {
    key: "processing",
    label: "Processing",
    statuses: ["Confirmed", "Packed"],
  },
  {
    key: "dispatched",
    label: "Dispatched",
    statuses: ["Shipped", "Out for Delivery"],
  },
  {
    key: "all",
    label: "All Orders",
    statuses: ORDER_STATUSES,
  },
];

export const DEFAULT_ORDER_FILTER = "new";

/** Rows shown in the dashboard table (owner decision: 10). */
export const DASHBOARD_ORDER_LIMIT = 10;

export const filterOrdersByKey = (orders, key) => {
  const list = Array.isArray(orders) ? orders : [];
  const filter = ORDER_FILTERS.find((f) => f.key === key);
  if (!filter || filter.key === "all") return list;
  return list.filter(inGroup(filter.statuses));
};

/**
 * Sort options.
 *
 * Labelled by outcome ("Newest first") rather than by mechanism ("date
 * descending") — an admin reads the former without having to work out which
 * way "ascending" runs on a date.
 *
 * `id` values are TanStack column ids and must match the accessorKeys in
 * RecentOrders/Columns.jsx.
 */
export const ORDER_SORTS = [
  { key: "newest", label: "Newest first", sorting: [{ id: "date", desc: true }] },
  { key: "oldest", label: "Oldest first", sorting: [{ id: "date", desc: false }] },
  { key: "orderId", label: "Order ID", sorting: [{ id: "orderId", desc: false }] },
];

export const DEFAULT_ORDER_SORT = "newest";

/** Stat-card counts. active + completed === total, by construction. */
export const countOrderStats = (orders) => {
  const list = Array.isArray(orders) ? orders : [];
  const isActive = inGroup(ORDER_STATUS_ACTIVE);
  const active = list.filter(isActive).length;
  const completed = list.filter(inGroup([ORDER_STATUS_TERMINAL])).length;
  return { total: list.length, active, completed };
};
