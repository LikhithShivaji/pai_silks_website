const pool = require('../config/db');

/**
 * Run a set of queries as one atomic unit — all of them commit, or none do.
 *
 * Neither backend used a transaction anywhere: grepping for
 * getConnection|beginTransaction|commit|rollback returned ZERO hits across
 * both. Every multi-step write could therefore half-succeed.
 *
 * That is not theoretical. 29 of 35 products ended up with no product_stock
 * row, because createProduct inserts the product and the stock row as two
 * separate queries and the second one failed. The products stayed on the
 * storefront and every checkout attempt hit "Insufficient stock" after the
 * customer had filled in their address. See CLAUDE.md AB-14a.
 *
 * Usage — the callback receives a connection to thread down into dbOps:
 *
 *   await withTransaction(async (conn) => {
 *     const id = await dbCmds.createProduct(data, conn);
 *     await dbCmds.insertProductStock(id, qty, conn);
 *     return id;
 *   });
 *
 * Every dbOp inside MUST receive that connection. A query that grabs its own
 * from the pool is a separate conversation with the database — it commits
 * independently and a rollback will not reach it.
 *
 * `release()` sits in a finally block. A leaked connection is worse than the
 * bug being fixed: the pool is capped at 10, so leaking them eventually hangs
 * every request on the service with no error explaining why.
 *
 * ⚠️  A rollback undoes DATABASE work only. Anything already uploaded to object
 * storage inside the callback stays there as an orphan — and nothing in this
 * codebase ever deletes a remote asset (AB-10). This applies equally to the
 * planned S3 migration; changing provider does not change it. Upload before
 * opening the transaction where possible, and keep transactions short.
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
