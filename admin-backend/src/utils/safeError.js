/**
 * Strip the sensitive parts off an error before it reaches a log.
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

module.exports = { sanitizeError, redactQuoted };
