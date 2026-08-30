/**
 * Code shared by admin-backend and client-backend.
 *
 * Each service still has its own file at the original path
 * (`src/utils/safeError.js`, `src/middlewares/validate.js`,
 * `src/dbOps/withTransaction.js`) which re-exports from here. That keeps all 16
 * existing import sites unchanged — the shared move is invisible to them.
 *
 * See shared/README.md for why this exists and what belongs here.
 */
const { sanitizeError, redactQuoted, makeDescribeDuplicate } = require('./safeError');
const { validate, rejectNonScalarBody } = require('./validate');
const { createWithTransaction } = require('./withTransaction');

module.exports = {
  sanitizeError,
  redactQuoted,
  makeDescribeDuplicate,
  validate,
  rejectNonScalarBody,
  createWithTransaction,
};
