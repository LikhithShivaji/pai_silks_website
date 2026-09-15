/**
 * Carriers the shop despatches with, and the shape of their consignment
 * numbers. See CLAUDE.md DB-09.
 *
 * ⚠️ MIRRORS admin-backend `appDefines.CARRIERS`. The server rejects anything
 * not in its own list, so adding a carrier here alone gets a 400 at save time;
 * both lists must change together. Kept as a plain mirror rather than fetched,
 * because a dropdown that cannot render until a request returns is worse than
 * two short lists — but that makes it a hand-sync point, like the order status
 * enum (DEP-13 is the general version of this problem).
 */
export const CARRIERS = ["DTDC", "India Post"];

/**
 * Per-carrier consignment number patterns.
 *
 * These are a MIS-SCAN CHECK, not a security control — the server validates
 * independently. The value is catching a damaged barcode or a mistyped number
 * while the receipt is still in the admin's hand, rather than after a customer
 * follows a dead link.
 *
 * ⚠️ NOT YET VERIFIED AGAINST REAL RECEIPTS.
 * India Post follows the international UPU S10 format — two letters, nine
 * digits, two letters (e.g. EX123456789IN) — which is well documented and
 * stable. DTDC's format is less consistent across service types, so its rule is
 * deliberately loose: length and character class only. If a real DTDC number is
 * rejected, widen this rather than working around it at the call site.
 *
 * The owner is scanning a real receipt from each carrier to confirm both the
 * pattern AND whether the barcode carries extra characters (some encode a
 * prefix or a service code, and some scanners add their own). Tighten once that
 * comes back.
 */
const PATTERNS = {
  "India Post": /^[A-Z]{2}\d{9}[A-Z]{2}$/,
  // Length-and-charset only, on purpose — see above.
  DTDC: /^[A-Z0-9]{8,20}$/,
};

/**
 * True when `value` is a plausible consignment number for `carrier`.
 *
 * An unknown carrier returns true rather than false: the server is the
 * authority on which carriers exist, and rejecting here would block a carrier
 * the backend has legitimately started accepting before this file caught up.
 * Failing open on an unknown carrier and closed on a known bad shape is the
 * right way round — the alternative silently blocks valid work.
 */
export const isValidConsignment = (carrier, value) => {
  const pattern = PATTERNS[carrier];
  if (!pattern) return true;
  return pattern.test(String(value || "").trim().toUpperCase());
};

/**
 * Public tracking URL for a consignment.
 *
 * ⚠️ URLs NOT YET CONFIRMED — the owner is checking each against a real
 * consignment number. Returns null for an unknown carrier so callers render
 * the number as plain text rather than a link to nowhere; a broken tracking
 * link is worse than no link, because the customer believes they have checked.
 */
const TRACKING_URLS = {
  "India Post": (cn) =>
    `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?logicalname=${encodeURIComponent(cn)}`,
  DTDC: (cn) => `https://www.dtdc.in/tracking.asp?strCnno=${encodeURIComponent(cn)}`,
};

export const trackingUrl = (carrier, consignmentNumber) => {
  const build = TRACKING_URLS[carrier];
  if (!build || !consignmentNumber) return null;
  return build(consignmentNumber);
};
