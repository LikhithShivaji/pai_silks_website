import React from "react"
import { DataTable } from "../RecentOrders/Data-table"
// Casing matters: the file is Columns.jsx. macOS (APFS) and Windows resolve
// "./columns" anyway because their filesystems are case-insensitive, so this
// built fine locally while failing on every Linux build — Vercel, Netlify,
// Docker, CI — with "Failed to resolve import". See CLAUDE.md AF-17.
import { columns } from "./Columns"
import {
  ORDER_FILTERS,
  DEFAULT_ORDER_FILTER,
  ORDER_SORTS,
  DEFAULT_ORDER_SORT,
  DASHBOARD_ORDER_LIMIT,
  filterOrdersByKey,
} from "@/constants/orderStatus"

/**
 * Dashboard orders table.
 *
 * Previously the parent passed a pre-filtered `pendingOrders` array, so this
 * table showed ONLY orders with status "Pending" despite being titled "Recent
 * Orders". With the four real orders in the database — all Delivered — it
 * rendered zero rows. An order that had been Confirmed or Packed vanished from
 * the dashboard entirely.
 *
 * It now receives the full list and does its own filtering, so the tabs can
 * switch between groups without refetching. See CLAUDE.md AB-17.
 */
export default function RecentOrders({ orders, displayOrderPage }) {
  const [filterKey, setFilterKey] = React.useState(DEFAULT_ORDER_FILTER)
  const [sortKey, setSortKey] = React.useState(DEFAULT_ORDER_SORT)

  const activeSort =
    ORDER_SORTS.find((s) => s.key === sortKey) ?? ORDER_SORTS[0]

  // Sorting is lifted here so the dropdown and the column headers drive the
  // SAME TanStack state. Clicking a header updates the table; picking from the
  // dropdown does too. One mechanism, not two competing ones.
  const [sorting, setSorting] = React.useState(activeSort.sorting)

  const handleSortChange = (key) => {
    setSortKey(key)
    const next = ORDER_SORTS.find((s) => s.key === key)
    if (next) setSorting(next.sorting)
  }

  const visibleOrders = React.useMemo(() => {
    const filtered = filterOrdersByKey(orders, filterKey)
    // Cap the dashboard summary. The full list lives in the Orders section.
    return filtered.slice(0, DASHBOARD_ORDER_LIMIT)
  }, [orders, filterKey])

  const totalMatching = filterOrdersByKey(orders, filterKey).length

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-2xl">Recent Orders</p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* --- Filter tabs --- */}
          {/* A 2×2 grid on small screens, a single row from `sm` up.
              `flex-wrap` produced the ragged "three on one line, one orphaned
              underneath" layout — the break point depended on the label widths,
              so it looked accidental rather than designed. A grid puts the four
              filters on a fixed, even footprint at every width. */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 sm:flex sm:flex-nowrap">
            {ORDER_FILTERS.map((f) => {
              const isActive = f.key === filterKey
              const count = filterOrdersByKey(orders, f.key).length
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilterKey(f.key)}
                  aria-pressed={isActive}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-[#68232B] text-white"
                      : "text-gray-600 hover:bg-white hover:text-[#68232B]"
                  }`}
                >
                  {f.label}
                  <span
                    className={`ml-1.5 text-xs ${
                      isActive ? "text-white/70" : "text-gray-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* --- Sort --- */}
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <span className="whitespace-nowrap">Sort by</span>
            <select
              value={sortKey}
              onChange={(e) => handleSortChange(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-[#68232B]"
            >
              {ORDER_SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {totalMatching > DASHBOARD_ORDER_LIMIT && (
        <p className="mt-2 text-xs text-gray-400">
          Showing {DASHBOARD_ORDER_LIMIT} of {totalMatching} — open Orders to
          see all.
        </p>
      )}

      <DataTable
        columns={columns}
        data={visibleOrders}
        displayOrderPage={displayOrderPage}
        sorting={sorting}
        onSortingChange={setSorting}
      />
    </div>
  );
}
