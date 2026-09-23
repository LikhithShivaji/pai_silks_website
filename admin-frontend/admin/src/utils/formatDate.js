/**
 * Order dates, formatted once for the whole admin panel.
 *
 * Extracted from DisplayOrderPage because the orders TABLE had no date
 * formatter at all — it rendered the raw value straight from the API, so every
 * row read `2026-08-29T10:54:34.090Z`. That is unreadable, and it also made the
 * Date column far wider than it needed to be, crowding the columns beside it.
 *
 * `en-IN` with explicit fields rather than the machine's default locale: the
 * same order would otherwise read 29/8/2026 on one computer and 8/29/2026 on
 * another. Naming the locale and every field makes the output identical
 * wherever it is viewed. Seconds are dropped — nobody chases an order by the
 * second.
 *
 * `en-IN` inserts " at " between date and time and lower-cases the meridiem,
 * so both are normalised afterwards.
 *
 * Returns an em dash for a missing or unparseable value, never "Invalid Date".
 */
export const formatDate = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  return d
    .toLocaleString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(" at ", " ")
    .replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
};

/**
 * Compact variant for the orders table, where the full form is too wide.
 * "29 Aug 2026, 4:25 PM" rather than "29 August 2026 4:25 PM".
 */
export const formatDateShort = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  return d
    .toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(" at ", ", ")
    .replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
};
