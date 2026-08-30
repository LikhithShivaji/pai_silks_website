/**
 * This service's transaction helper, bound to its own connection pool.
 *
 * The implementation lives in `shared/withTransaction.js` — one copy, used by
 * both services. It is a factory because each service owns a different pool;
 * binding it here means call sites keep the signature they already had:
 *
 *   await withTransaction(async (conn) => { ... });
 *
 * See shared/withTransaction.js for the full reasoning, and CLAUDE.md AB-14a /
 * AB-14b for the failures this prevents in createProduct and updateProduct.
 */
const pool = require('../config/db');
const { createWithTransaction } = require('../../../shared/withTransaction');

const withTransaction = createWithTransaction(pool);

module.exports = { withTransaction };
