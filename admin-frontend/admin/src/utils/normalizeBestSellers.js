/**
 * Shape the /api/get-bestSeller-list payload for display.
 *
 * Shared by the dashboard preview and the full "View All" screen so the two
 * cannot drift into formatting the same figures differently — the failure mode
 * that produced two different names for `total_sold` across the two backends in
 * the first place.
 *
 * `total_revenue` is a SQL DECIMAL, which mysql2 returns as a STRING to protect
 * precision. Coerced once here rather than letting a string reach
 * Intl.NumberFormat, which renders "₹NaN" instead of throwing.
 */
export function normalizeBestSellers(rows) {
  if (!Array.isArray(rows)) return [];

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    image: p.primary_image || "https://placehold.co/100",
    price: Number(p.selling_price),
    totalSold: Number(p.total_sold) || 0,
    revenue: Number(p.total_revenue) || 0,
  }));
}
