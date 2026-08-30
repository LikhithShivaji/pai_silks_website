/**
 * Strip the sensitive parts off an error before it reaches a log.
 *
 * SHARED by admin-backend and client-backend. There is ONE copy of this logic;
 * see shared/README.md for why. What is NOT shared is the per-service list of
 * UNIQUE constraints — see makeDescribeDuplicate below.
 *
 * mysql2 errors leak customer data in FOUR places, not one. Verified against a
 * real duplicate-key error on this database:
 *
 *   code       ER_DUP_ENTRY
 *   message    Duplicate entry 'likhith@gmail.com' for key 'master_user.pri_email'
 *   sqlMessage same as message
 *   sql        INSERT INTO master_user (...) VALUES ('X','likhith@gmail.com',
 *              '9876543210','12 MG Road, Bengaluru 560001','$2b$12$...',...)
 *   stack      begins "Error: <message>", so it reproduces the value again
 *
 * So a bare `console.error("signup failed:", err)` wrote a customer's name,
 * email, phone, postal address and password hash to stdout — and then into
 * whatever aggregates those logs. See CLAUDE.md AB-32, CB-38.
 *
 * `sql` is dropped outright. `message`, `sqlMessage` and `stack` are kept but
 * with every single-quoted literal redacted, because that is where the driver
 * puts the offending VALUE.
 *
 * The cost is losing the constraint name, which is also quoted. That is an
 * acceptable trade: `code` plus the log's own context string identifies the
 * failure well enough, and no amount of debugging convenience justifies
 * writing customer addresses to a log file.
 */

// Replaces the contents of every '...'-quoted run. Handles escaped quotes so a
// value containing an apostrophe cannot terminate the match early and leave the
// remainder of the string exposed.
const redactQuoted = (text) =>
  typeof text === 'string'
    ? text.replace(/'(?:[^'\\]|\\.)*'/g, "'[redacted]'")
    : text;

const sanitizeError = (err) => {
  if (!err || typeof err !== 'object') return err;

  return {
    name: err.name,
    code: err.code,        // ER_DUP_ENTRY, ER_BAD_FIELD_ERROR, ... — safe
    errno: err.errno,
    sqlState: err.sqlState,
    message: redactQuoted(err.message),
    sqlMessage: redactQuoted(err.sqlMessage),
    // The stack must be redacted too. Its first line is "Error: <message>", so
    // an unredacted stack reproduces the offending value verbatim even after
    // message and sqlMessage have been cleaned. Found by testing.
    stack: redactQuoted(err.stack),
    // Deliberately omitted: `sql` — the full query with values interpolated.
  };
};

/**
 * Build a duplicate-error describer for ONE service's constraints.
 *
 * The mechanism is shared; the LIST is not, and deliberately so. Each service
 * can only ever violate the constraints on tables it writes to:
 *
 *   admin-backend  writes category, product, product_images, product_stock
 *   client-backend writes cart, wishlist, order_items, master_user
 *
 * Both copies previously carried all six entries, each listing constraints it
 * could never encounter — which made them look like copies that had to be kept
 * in sync. They do not. Passing the list in means each service declares only
 * what it can actually hit, and there is nothing to keep identical.
 *
 * ⚠️ When a service starts writing to a NEW table with a UNIQUE index, add that
 * constraint to that service's list. Otherwise the violation falls through to
 * the generic "That value is already in use." — not a crash, but a worse
 * message, and nothing will flag it.
 *
 * mysql2 puts the constraint name in err.message, e.g.
 *   Duplicate entry 'x@y.com' for key 'master_user.pri_email'
 * The offending VALUE is deliberately never echoed back — for pri_email that
 * would confirm to an attacker that an account exists (CB-27).
 *
 * @param {Array<{key:string, field:string, message:string}>} duplicateFields
 * @returns {(err:any) => ({field:string|null, message:string}|null)}
 */
const makeDescribeDuplicate = (duplicateFields = []) => (err) => {
  if (!err || err.code !== 'ER_DUP_ENTRY') return null;
  const raw = String(err.message || '');
  const hit = duplicateFields.find(({ key }) => raw.includes(key));
  return hit
    ? { field: hit.field, message: hit.message }
    : { field: null, message: 'That value is already in use.' };
};

module.exports = { sanitizeError, redactQuoted, makeDescribeDuplicate };
