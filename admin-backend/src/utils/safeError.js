/**
 * Error sanitising for the ADMIN backend.
 *
 * The logic lives in `shared/safeError.js` — one copy, used by both services.
 * This file exists to keep the import path (`utils/safeError`) unchanged for
 * the files that require it, and to declare the one thing that IS specific to
 * this service: which UNIQUE constraints it can actually violate.
 */
const { sanitizeError, redactQuoted, makeDescribeDuplicate } = require('../../../shared/safeError');

/**
 * UNIQUE constraints reachable from THIS service.
 *
 * Derived from the tables admin-backend writes to: category, product,
 * product_images, product_stock, orders, session, master_user.
 *
 * Deliberately does NOT list the cart or wishlist constraints — the admin panel
 * never touches either, so those violations are unreachable from here.
 *
 * `pri_email` IS listed despite there being no admin signup: `SEC-02b` changes
 * the admin's email address, and `master_user.pri_email` is UNIQUE, so that
 * operation can collide. See CLAUDE.md DEP-13.
 *
 * ⚠️ If this service ever starts writing to a new table with a UNIQUE index,
 * add it here — otherwise the violation falls through to the generic
 * "That value is already in use." message.
 */
const DUPLICATE_FIELDS = [
  { key: 'product_code', field: 'product_code', message: 'That product code is already in use.' },
  { key: 'category.name', field: 'name', message: 'That category already exists.' },
  { key: 'uniq_product_stock_product', field: 'product_id', message: 'That product already has a stock record.' },
  { key: 'pri_email', field: 'pri_email', message: 'That email address is already in use.' },
];

const describeDuplicate = makeDescribeDuplicate(DUPLICATE_FIELDS);

module.exports = { sanitizeError, redactQuoted, describeDuplicate };
