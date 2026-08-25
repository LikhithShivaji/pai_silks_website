const { validationResult } = require('express-validator');

/**
 * Runs after a route's express-validator rules and turns any failures into a
 * single 400 response.
 *
 * Neither backend had a validation library at all, so handlers only ever
 * checked truthiness. That let through negative quantities, prices of "abc"
 * (coerced to 0, publishing free products), arbitrary order-status strings, and
 * objects/arrays that mangle the SQL query shape. See CLAUDE.md Phase 3.
 *
 * Shape matches the rest of the API — { success:false, message } — plus an
 * `errors` array so a form can highlight individual fields.
 *
 * Field NAMES are echoed back but values are not: a rejected value may be a
 * password or another user's id, and reflecting it into a response body (or a
 * log) is how validation layers start leaking the very data they guard.
 */
const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map((e) => ({
    field: e.path,
    message: e.msg,
  }));

  return res.status(400).json({
    success: false,
    message: errors[0].message,
    errors,
  });
};

/**
 * Rejects any value that is not a primitive.
 *
 * Both backends use pool.query(), which ESCAPES client-side rather than
 * binding. An array expands into extra SQL value slots and shifts every
 * subsequent column; an object becomes an `ident` = value expression that
 * changes the query's shape entirely:
 *
 *   { "regular_price": [1,2,3] }  ->  VALUES (..., 1, 2, 3, ...)
 *   { "user_id": {"x":1} }        ->  WHERE `x` = 1
 *
 * Values stay escaped so this is not SQL injection, but it is silent data
 * corruption plus a useful error oracle. See CLAUDE.md AB-11, CB-29.
 *
 * Applied as a blanket body check so a field nobody thought to validate cannot
 * become the hole.
 */
const rejectNonScalarBody = (req, res, next) => {
  if (!req.body || typeof req.body !== 'object') return next();

  for (const [key, value] of Object.entries(req.body)) {
    if (value === null || value === undefined) continue;

    if (typeof value === 'object') {
      return res.status(400).json({
        success: false,
        message: `Invalid value for "${key}".`,
      });
    }

    // NaN and Infinity survive JSON.parse only as strings, but a number field
    // computed client-side can still arrive as one of these via coercion.
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return res.status(400).json({
        success: false,
        message: `Invalid value for "${key}".`,
      });
    }
  }

  return next();
};

module.exports = { validate, rejectNonScalarBody };
