/**
 * Error sanitising for the CUSTOMER backend.
 *
 * The logic lives in `shared/safeError.js` — one copy, used by both services.
 * This file exists to keep the import path (`utils/safeError`) unchanged for
 * the 10 files that require it, and to declare the one thing that IS specific
 * to this service: which UNIQUE constraints it can actually violate.
 */
const { sanitizeError, redactQuoted, makeDescribeDuplicate } = require('../../../shared/safeError');

/**
 * UNIQUE constraints reachable from THIS service.
 *
 * Derived from the tables client-backend writes to: cart, wishlist,
 * order_items, orders, product_stock, session, master_user. Every UNIQUE index
 * in the schema was audited against its write path (2026-08-25, re-checked
 * 2026-08-30).
 *
 * Deliberately does NOT list `product.product_code` or `category.name` — this
 * service never creates products or categories, so those violations are
 * unreachable from here. The previous copy carried all six entries, which made
 * the two services' lists look like duplicates that had to be kept in sync.
 * They are not: each declares its own surface. See CLAUDE.md DEP-13.
 *
 * ⚠️ If this service ever starts writing to a new table with a UNIQUE index,
 * add it here — otherwise the violation falls through to the generic
 * "That value is already in use." message.
 */
const DUPLICATE_FIELDS = [
  { key: 'pri_email', field: 'pri_email', message: 'Email already registered.' },
  { key: 'uniq_cart_user_product', field: 'product_id', message: 'That item is already in the cart.' },
  { key: 'wishlist', field: 'product_id', message: 'That item is already in your wishlist.' },
];

const describeDuplicate = makeDescribeDuplicate(DUPLICATE_FIELDS);

module.exports = { sanitizeError, redactQuoted, describeDuplicate };
