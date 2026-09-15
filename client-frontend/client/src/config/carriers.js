/**
 * Public tracking links for the carriers the shop despatches with.
 * See CLAUDE.md DB-09.
 *
 * WHY THE STOREFRONT NEEDS THIS AT ALL
 * There is no carrier API at launch — DTDC assigns credentials only after the
 * site is live, and India Post has no self-service API — so the customer cannot
 * be shown live status. What they CAN be given is the consignment number and a
 * link straight to the carrier's own tracking page, which needs nobody's
 * permission and works on day one. Until this, a despatched order showed a
 * status badge and nothing else.
 *
 * ⚠️ URLs NOT YET CONFIRMED AGAINST A REAL CONSIGNMENT NUMBER.
 * The owner is checking both. They are the carriers' public tracking pages and
 * the query parameters are the documented ones, but carriers change these
 * without notice and a wrong link is worse than no link: the customer believes
 * they have checked, sees nothing, and contacts the shop anyway.
 *
 * ⚠️ MIRRORS admin-frontend `src/constants/carriers.js`. The admin side needs
 * the same list to validate entry. Two copies is the DEP-13 problem in
 * miniature — but these are separate applications with separate builds, and the
 * storefront must not import from the admin bundle.
 */
const TRACKING_URLS = {
  "India Post": (cn) =>
    `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?logicalname=${encodeURIComponent(cn)}`,
  DTDC: (cn) => `https://www.dtdc.in/tracking.asp?strCnno=${encodeURIComponent(cn)}`,
};

/**
 * Each carrier's plain tracking page, with no consignment number in it.
 *
 * The safety net for the deep links above. Those encode a query parameter that
 * the carrier can rename at any time, without notice and without breaking their
 * own site — at which point every deep link here silently stops working and the
 * customer lands on a page showing nothing about their parcel. That reads as
 * "the shop has lost it".
 *
 * These pages cannot break that way: the customer arrives at the carrier's own
 * tracking form and pastes the number, which is displayed next to the link and
 * selectable in one click. Slower by one step, and it always works.
 */
const TRACKING_HOMES = {
  "India Post": "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx",
  DTDC: "https://www.dtdc.in/tracking",
};

/**
 * Where to send a customer to track a consignment.
 *
 * Returns `{ url, isDirect }`, or null when nothing can be built.
 *
 *   isDirect true  — the link should land on this parcel's status.
 *   isDirect false — the link lands on the carrier's tracking form and the
 *                    customer pastes the number. The caller should word the
 *                    link accordingly, so nobody expects a status they then
 *                    have to go and ask for.
 *
 * Null for an unknown carrier: with no carrier there is no site to send anyone
 * to, and inventing one is worse than showing the number alone.
 */
export const trackingTarget = (carrier, consignmentNumber) => {
  if (!consignmentNumber) return null;

  // ⚠️ Flip to `true` for a carrier once its deep link has been confirmed
  // against a REAL consignment number. Until then every carrier uses its plain
  // tracking page, because an unverified deep link that fails is worse than one
  // extra paste — it looks like the parcel does not exist.
  const DEEP_LINK_VERIFIED = {
    "India Post": false,
    DTDC: false,
  };

  if (DEEP_LINK_VERIFIED[carrier] && TRACKING_URLS[carrier]) {
    return { url: TRACKING_URLS[carrier](consignmentNumber), isDirect: true };
  }
  if (TRACKING_HOMES[carrier]) {
    return { url: TRACKING_HOMES[carrier], isDirect: false };
  }
  return null;
};
