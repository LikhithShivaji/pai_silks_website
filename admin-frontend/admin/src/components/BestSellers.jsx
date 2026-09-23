import React, { useEffect, useState } from "react";
import { ADMIN_API, apiFetch } from "@/config/api";
import { normalizeBestSellers } from "@/utils/normalizeBestSellers";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    // Intl.format(NaN) renders the literal "₹NaN" rather than throwing, so the
    // guard has to be here and not in a try/catch. See CLAUDE.md AF-C-FIX.
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

/**
 * Every product that has sold, ranked by units sold.
 *
 * The dashboard shows the top three; this is what "View All" opens. It fetches
 * its OWN data rather than reusing the dashboard's array, because that array is
 * deliberately capped at the dashboard limit — reusing it would make "View All"
 * show exactly the same ten rows, which is the bug rather than the feature.
 *
 * Ordering comes from the server (`ORDER BY total_sold DESC`); this component
 * does not re-sort, so the ranking shown is the ranking the database computed.
 */
export default function BestSellers({ onBack = () => {} }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    // Asks for the server's ceiling. The endpoint refuses anything higher, so
    // this cannot turn back into the unbounded query that returned the entire
    // delivered catalogue (AB-17).
    apiFetch(`${ADMIN_API}/api/get-bestSeller-list?limit=200`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        // ok BEFORE json(): an HTML error page or an empty body throws on
        // .json(), which otherwise surfaces as a misleading network error.
        if (!res.ok) {
          throw new Error(
            res.status === 401
              ? "Your session has expired. Please log in again."
              : `Could not load best sellers (HTTP ${res.status}).`
          );
        }
        const body = await res.json();
        if (!body.success) throw new Error(body.message || "Could not load best sellers.");
        setRows(normalizeBestSellers(body.data));
        setError(null);
      })
      .catch((err) => {
        // An abort means the admin navigated on. Not a failure, and it must not
        // clear the screen the newer navigation is building.
        if (err.name === "AbortError") return;
        console.error("Failed to load best sellers:", err);
        setError(err.message || "Could not load best sellers.");
        setRows([]);
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const totalUnits = rows.reduce((sum, r) => sum + r.totalSold, 0);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex flex-col gap-2">
          <p className="text-3xl sm:text-4xl">Best Sellers</p>
          <p className="text-base sm:text-xl">Home {">"} Dashboard {">"} Best Sellers</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-white cursor-pointer bg-[#68232B] px-5 py-3 rounded-xl hover:bg-[#8B2E39] transition-colors"
        >
          ← Back
        </button>
      </div>

      <div className="w-full bg-white rounded-2xl p-4 sm:p-6">
        {loading ? (
          <p className="py-10 text-center text-gray-500">Loading…</p>
        ) : error ? (
          <p className="py-10 text-center text-[#68232B]">{error}</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-gray-500">
            Nothing has sold yet. Products appear here once an order is marked
            Delivered.
          </p>
        ) : (
          <>
            {/* Totals first: the reason to open this screen is usually "how much
                has this shop actually sold", and that answer should not require
                adding up the rows by eye. */}
            <div className="flex flex-wrap gap-4 sm:gap-10 border-b border-gray-100 pb-4 mb-2">
              <div>
                <p className="text-xs text-gray-500">Products sold</p>
                <p className="text-lg sm:text-xl font-semibold">{rows.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total units</p>
                <p className="text-lg sm:text-xl font-semibold">{totalUnits}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total revenue</p>
                <p className="text-lg sm:text-xl font-semibold text-[#68232B]">
                  {money(totalRevenue)}
                </p>
              </div>
            </div>

            {/* Horizontal scroll rather than a fixed layout: on a phone the
                rank, name, units and revenue cannot all fit, and squeezing them
                overlaps the columns. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-3 px-3 w-12">#</th>
                    <th className="py-3 px-3">Product</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Price</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Units sold</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item, index) => (
                    <tr
                      key={item.id}
                      className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-3 text-gray-400 font-medium">{index + 1}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden border border-gray-200 shrink-0">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src = "https://placehold.co/100?text=No+Img";
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate" title={item.name}>
                              {item.name}
                            </p>
                            <p className="text-[10px] text-gray-400">ID: {item.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {Number.isFinite(item.price) ? money(item.price) : "—"}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold whitespace-nowrap">
                        {item.totalSold}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-[#68232B] whitespace-nowrap">
                        {money(item.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs text-gray-400">
              Counts Delivered orders only, at the price actually charged —
              cancelled and refunded orders are excluded because the money went
              back to the customer.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
