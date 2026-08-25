const pool = require('../config/db');

/**
 * Run a set of queries as one atomic unit — all of them commit, or none do.
 *
 * Identical to admin-backend/src/dbOps/withTransaction.js. Kept as a copy
 * because the two services have no shared package; see CLAUDE.md DEP-13.
 * Any change here must be applied to that file explicitly.
 *
 * Neither backend used a transaction anywhere: grepping for
 * getConnection|beginTransaction|commit|rollback returned ZERO hits across
 * both. Every multi-step write could therefore half-succeed.
 *
 * For this service the case that matters is createOrder, which does four
 * writes: create the order, insert each item, reduce stock per item, clear the
 * cart. A failure partway left an order that exists, items partially recorded,
 * stock reduced for only some products, and the customer's cart still full —
 * so they would retry and place a second order. See CLAUDE.md CB-06.
 *
 * Usage — the callback receives a connection to thread down into dbOps:
 *
 *   await withTransaction(async (conn) => {
 *     const orderId = await productManager.createOrder(..., conn);
 *     await productManager.addOrderItem(orderId, ..., conn);
 *   });
 *
 * Every dbOp inside MUST receive that connection. A query that grabs its own
 * from the pool is a separate conversation with the database — it commits
 * independently and a rollback will not reach it.
 *
 * `release()` sits in a finally block. A leaked connection is worse than the
 * bug being fixed: the pool is capped at 10, so leaking them eventually hangs
 * every request on the service with no error explaining why.
 */
const withTransaction = async (work) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      // Log but do not throw: surfacing the rollback failure would mask the
      // ORIGINAL error, which is the one that explains what went wrong.
      console.error('Rollback failed:', rollbackErr.code || rollbackErr.message);
    }
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = { withTransaction };
