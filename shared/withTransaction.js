/**
 * Run a unit of work inside a single database transaction.
 *
 * SHARED by admin-backend and client-backend — one copy, see shared/README.md.
 *
 * Exported as a FACTORY rather than a plain function because each service owns
 * its own connection pool. `createWithTransaction(pool)` binds it once, so call
 * sites keep the exact signature they had before: `withTransaction(work)`.
 *
 * WHY THIS EXISTS
 * Neither backend used transactions anywhere — a grep for
 * getConnection|beginTransaction|commit|rollback returned zero hits across
 * both. Every multi-step write could therefore half-succeed:
 *
 *   admin-backend  createProduct inserts the product and its stock row as two
 *                  separate queries. When the second failed the first stayed,
 *                  leaving a product with no stock record. getStock returns 0
 *                  for a missing row, so the product sat on the storefront
 *                  looking normal and every checkout hit "Insufficient stock"
 *                  after the customer had filled in their address. It happened
 *                  to 29 of 35 products. See CLAUDE.md AB-14a.
 *
 *   client-backend createOrder does four writes: create the order, insert each
 *                  item, reduce stock per item, clear the cart. A failure
 *                  partway left an order that exists, items recorded for only
 *                  some products, stock reduced for only some, and the cart
 *                  still full — so the customer would retry and order twice.
 *                  See CLAUDE.md CB-06.
 *
 * USAGE — every query inside must receive `conn`, or it silently escapes the
 * transaction: a query that grabs its own pool connection is a separate
 * conversation with the database that commits independently and that a rollback
 * cannot reach.
 *
 *   await withTransaction(async (conn) => {
 *     const id = await dbCmds.createProduct(data, conn);
 *     await dbCmds.insertProductStock(id, qty, conn);
 *     return id;
 *   });
 *
 * ⚠️ A rollback undoes DATABASE work only. Anything already uploaded to object
 * storage inside the callback stays there as an orphan. Upload BEFORE opening
 * the transaction, and delete after it commits — which is what updateProduct
 * does (AB-10). This applies equally to the planned S3 migration; changing
 * provider does not change it.
 *
 * The connection is always released in `finally`, including on the rollback
 * path. The pool is capped at 10, so a leaked connection eventually hangs every
 * request behind it.
 *
 * @param {import('mysql2/promise').Pool} pool
 */
const createWithTransaction = (pool) => async (work) => {
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

module.exports = { createWithTransaction };
