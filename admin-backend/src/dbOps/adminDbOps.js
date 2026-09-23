// admindbops.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const sqlqueries = require('../dbOps/sqlQueries')
const { sanitizeError } = require('../utils/safeError');
const appDefines = require('../constants/appDefines');
// Category deletion cascades to its products and must be all-or-nothing.
const { withTransaction } = require('./withTransaction');

/**
 * A real bcrypt hash of a value that is no admin's password. Compared against
 * on the account-not-found path so a failed login costs the same whether or not
 * the email exists. Hardcoded rather than generated at boot — hashing at cost
 * 12 takes ~230ms and that would be paid on every cold start.
 *
 * Cost 12, matching appDefines.password.BCRYPT_COST. Raise that constant and
 * this must be regenerated, or the timing gap reopens. See CLAUDE.md AB-19e.
 */
const DUMMY_HASH = '$2b$12$I4dTwYOh1APoqQm65IJMjO/iIGlWTHMrZhPkyxdAWe8LGXRFBA.KW';

class Cmds {

    // Verify admin password.
    //
    // Constant-time-ish with respect to WHETHER THE ACCOUNT EXISTS. The old
    // code returned the moment the email was not found, skipping bcrypt: an
    // existing account cost ~235ms while an unknown one returned in ~19ms, a
    // reliable oracle. Mirrors the customer-side fix. See CLAUDE.md AB-19e.
    async verifyAdminPasswd(pri_email, passwd) {
        try {
            const [rows] = await pool.query(sqlqueries.login.getUserDetails, [pri_email]);

            // No such account, or no usable hash — a NULL `pass` used to make
            // bcrypt.compare reject and surface as a 500 instead of a 401.
            if (rows.length === 0 || !rows[0].pass) {
                await bcrypt.compare(passwd, DUMMY_HASH);
                return null;
            }

            const user = rows[0];
            const match = await bcrypt.compare(passwd, user.pass);
            if (!match) return null;

            // Transparent rehash — the admin row is still cost 10 (the original
            // DB-08 shared hash). Failure is swallowed: the admin has already
            // authenticated and must not be blocked by a background upgrade.
            const cost = parseInt(String(user.pass).split('$')[2], 10);
            if (Number.isFinite(cost) && cost < appDefines.password.BCRYPT_COST) {
                try {
                    const upgraded = await bcrypt.hash(passwd, appDefines.password.BCRYPT_COST);
                    await pool.query(sqlqueries.login.updatePasswordHash, [upgraded, user.user_id]);
                } catch (rehashErr) {
                    console.error('Password rehash failed (login still succeeded):', sanitizeError(rehashErr));
                }
            }

            return user;
        } catch (err) {
            console.error("Error in verifyAdminPasswd:", sanitizeError(err));
            throw err;
        }
    }

    //create a new session
    async insertNewSession(user_id, pri_email, session_id, login_token, SESSION_ACTIVE, conn = null) {
        try {
            const [result] = await (conn || pool).query(
                sqlqueries.login.createNewSession,
                [session_id, user_id, pri_email, login_token, SESSION_ACTIVE]
            );
            return result.insertId || null;
        } catch (err) {
            console.error("Error in insertNewSession:", sanitizeError(err));
            throw err;
        }
    }

    // `getAdminLastSessionByEmail`, `updateToken` and `updateSessionStatus` were
    // removed here (CLAUDE.md AB-30). They were the pre-Phase-2 session layer and
    // had zero call sites — the live path uses `getActiveSessionById` on every
    // request and `logoutSessionBySessionId` on logout, both below. Their SQL
    // (`login.getSessionDetails`, `login.updateToken`, `login.updateSessionStatus`)
    // went with them, since nothing else referenced it.

    // --- Phase 2 auth --------------------------------------------------

    /**
     * Fetch an ACTIVE, unexpired session by session_id, joined to its user.
     * Called on every authenticated request — see CLAUDE.md AB-01.
     */
    async getActiveSessionById(session_id, activeStatus, maxAgeSeconds) {
        try {
            const [rows] = await pool.query(
                sqlqueries.login.getActiveSessionById,
                [session_id, activeStatus, maxAgeSeconds]
            );
            return rows[0] || null;
        } catch (err) {
            console.error("Error in getActiveSessionById:", sanitizeError(err));
            throw err;
        }
    }

    /**
     * All ACTIVE, unexpired sessions for a user, OLDEST FIRST.
     * Used to enforce the 2-device cap at login.
     */
    /**
     * Take an exclusive lock on the user row for the rest of the transaction.
     * Serialises concurrent logins so the device-cap check cannot race.
     * See CLAUDE.md AB-15.
     */
    async lockUserForSessionUpdate(user_id, conn) {
        await conn.query(sqlqueries.login.lockUserForSessionUpdate, [user_id]);
    }

    async getActiveSessionsForUser(user_id, activeStatus, maxAgeSeconds, conn = null) {
        try {
            const [rows] = await (conn || pool).query(
                sqlqueries.login.getActiveSessionsForUser,
                [user_id, activeStatus, maxAgeSeconds]
            );
            return rows;
        } catch (err) {
            console.error("Error in getActiveSessionsForUser:", sanitizeError(err));
            throw err;
        }
    }

    /**
     * Revoke a session by session_id, scoped to its owner.
     * @returns {number} rows affected — 0 means nothing matched
     */
    async logoutSessionBySessionId(session_id, user_id, logoutStatus, conn = null) {
        try {
            const [result] = await (conn || pool).query(
                sqlqueries.login.logoutSessionBySessionId,
                [logoutStatus, session_id, user_id]
            );
            return result.affectedRows;
        } catch (err) {
            console.error("Error in logoutSessionBySessionId:", sanitizeError(err));
            throw err;
        }
    }

    async createProduct(productData, conn = null) {
    // `conn` lets this join a caller's transaction. Without it the query grabs
    // its own pool connection — a separate conversation with the database that
    // commits independently and that a rollback cannot reach. See withTransaction.
        try {

            const isNewRelease = productData.is_new_release !== undefined 
            ? Number(productData.is_new_release)
            : 0;
            const [result] = await (conn || pool).query(sqlqueries.product.insertProduct, [productData.name,
            productData.description || null,
            productData.category || null,
            productData.collection || null,
            productData.material || null,
            productData.product_code || null,
            productData.product_wash_care || null,
            productData.regular_price,
            productData.selling_price || null,
            productData.saree_length || null,
            isNewRelease
            ]);

        
            return result.insertId;
        } catch (err) {
            // Was logging "Error in updateSessionStatus" — a copy-paste label from
            // the session helper this was cloned from. A failed product insert
            // would have pointed whoever read the logs at the wrong function.
            console.error("Error in createProduct:", sanitizeError(err));
            throw err;
        }
    }

    async insertProductStock(product_id, stock_qty, conn = null) {
    // `conn` lets this join a caller's transaction. Without it the query grabs
    // its own pool connection — a separate conversation with the database that
    // commits independently and that a rollback cannot reach. See withTransaction.
        try {
            await (conn || pool).query(
            sqlqueries.product.insertProductStock,
            [product_id, stock_qty ?? 0]
    );
        } catch (err) {
            console.error("Error in insertProductStock:", sanitizeError(err));
            throw err;
  }
}

    // The active-status list and the terminal status are bound, not inlined.
    // mysql2 expands a JS array into an `IN (?)` list, so ORDER_STATUS_ACTIVE
    // drives the count directly from the enum. See CLAUDE.md AB-17 (a).
    async getOrderStats() {
        try {
            // Both are arrays, both expand to `IN (?)`. ORDER_STATUS_TERMINAL
            // became a list when Cancelled/Refunded were added — passing it to
            // the old `status = ?` would have silently dropped those orders
            // from both dashboard cards (AB-17).
            const [rows] = await pool.query(sqlqueries.dashBoard.getOrderStats, [
                appDefines.ORDER_STATUS_ACTIVE,
                appDefines.ORDER_STATUS_TERMINAL
            ]);
            return rows[0]; // single aggregated row
        } catch (error) {
            console.error("Error in getOrderStats:", sanitizeError(error));
            throw error;
        }
    }

    async getBestSellers(limit = appDefines.DASHBOARD_LIMITS.BEST_SELLERS) {
        try {
            const [rows] = await pool.query(sqlqueries.dashBoard.getBestSellers, [
                // ORDER_STATUS_DELIVERED, not ORDER_STATUS_TERMINAL.
                //
                // The query is `WHERE o.status = ?` — a single value — and
                // TERMINAL is now a LIST, so passing it here would break the
                // binding. More importantly the two mean different things:
                // 'Cancelled' and 'Refunded' are terminal but are NOT sales.
                // Counting them would inflate best-sellers and revenue with
                // orders whose money went back to the customer.
                appDefines.ORDER_STATUS_DELIVERED,
                // Coerced and clamped: LIMIT cannot be a placeholder in every
                // MySQL configuration path, and an unbounded caller-supplied
                // limit would re-open the DoS this LIMIT exists to close.
                Number(limit) > 0 ? Math.min(Number(limit), 100) : appDefines.DASHBOARD_LIMITS.BEST_SELLERS
            ]);
            return rows;
        } catch (error) {
            console.error("Error in getBestSellers:", sanitizeError(error));
            throw error;
        }
    }

    async getRecentOrders(limit = appDefines.DASHBOARD_LIMITS.RECENT_ORDERS) {
        try {
            const [rows] = await pool.query(sqlqueries.dashBoard.getRecentOrders, [
                Number(limit) > 0 ? Math.min(Number(limit), 100) : appDefines.DASHBOARD_LIMITS.RECENT_ORDERS
            ]);
            return rows;
        } catch (error) {
            console.error("Error in getRecentOrders:", sanitizeError(error));
            throw error;
        }
    }

    async getCategoryWiseCount() {
        try {
            const [rows] = await pool.query(sqlqueries.product.getCategoryWiseCount);
            return rows;
        } catch (err) {
            console.error("Error in getCategoryWiseCount:", sanitizeError(err));
            throw err;
        }
    }

    async getAllProductDetails() {
        try {
            const [rows] = await pool.query(sqlqueries.product.getAllProductDetails);
            return rows;
        } catch (err) {
            console.error("Error in getAllProductDetails:", sanitizeError(err));
            throw err;
        }
    }

    async getAllOrderData() {
        try {
            const [rows] = await pool.query(sqlqueries.orders.getAllOrderData);
            return rows;
        } catch (error) {
            console.error("Error in getOrderDetails:", sanitizeError(error));
            throw error;
        }
    }

async updateProduct(productData, conn = null) {
    // `conn` lets this join a caller's transaction. Without it the query grabs
    // its own pool connection — a separate conversation with the database that
    // commits independently and that a rollback cannot reach. See withTransaction.
  try {
    const [result] = await (conn || pool).query(sqlqueries.product.updateProduct, [
      productData.name,
      productData.description || null,
      productData.category || null,
      productData.collection || null,
      productData.material || null,
      productData.product_code || null,
      productData.product_wash_care || null,
      productData.regular_price,
      productData.selling_price || null,
      productData.saree_length || null,
      productData.is_new_release,
      productData.id
    ]);

    // The query now carries `AND is_deleted = 0`, so 0 rows means the product
    // either does not exist or has been deleted. Returning the count lets the
    // caller answer 404 rather than reporting a success that never happened —
    // the AB-13 mistake, where a guard existed but its result was never read.
    // See CLAUDE.md AB-12s.
    return result.affectedRows;
  } catch (err) {
    console.error("Error in updateProduct:", sanitizeError(err));
    throw err;
  }
}

/**
 * Compare-and-swap stock update.
 *
 * @param expected_stock_qty what the admin saw when the form loaded
 * @returns {number} affectedRows — 0 means someone else changed it first
 *
 * See CLAUDE.md AB-15b and the note on updateProductStockCAS in sqlQueries.
 */
async updateProductStockCAS(product_id, stock_qty, expected_stock_qty, conn = null) {
    try {
        const [result] = await (conn || pool).query(
            sqlqueries.product.updateProductStockCAS,
            [stock_qty, product_id, expected_stock_qty]
        );
        return result.affectedRows;
    } catch (err) {
        console.error("Error in updateProductStockCAS:", sanitizeError(err));
        throw err;
    }
}




    /**
     * @returns {number} rows affected — 0 means no such order.
     *
     * The destructuring on the next line is the fix. mysql2 resolves to
     * [rows, fields], so `result.affectedRows` on the undestructured array was
     * always `undefined` — and `undefined === 0` is false. The "no order found"
     * guard could therefore never fire, and updating a NONEXISTENT order id
     * returned 200 "Order status updated successfully". See CLAUDE.md AB-13.
     *
     * Returning the count rather than throwing lets the controller answer 404,
     * which is the honest status for "that order does not exist".
     */
    async updateOrderStatus(order_id, new_status) {
        try {
            const [result] = await pool.query(
                sqlqueries.orders.updateOrderStatus,
                [new_status, order_id]
            );
            return result.affectedRows;
        } catch (error) {
            console.error("Error in updateOrderStatus:", error.code || error.message);
            throw error;
        }
    }

    /**
     * Update status together with the dispatch details, in one statement.
     *
     * `carrier` and `consignment_number` are written as a pair so an order can
     * never be left marked Shipped with no way to track it. Pass null for both
     * to clear them (e.g. moving an order back out of a dispatched state).
     *
     * See CLAUDE.md DB-09.
     */
    async updateOrderDispatch(order_id, new_status, carrier, consignment_number) {
        try {
            const [result] = await pool.query(
                sqlqueries.orders.updateOrderDispatch,
                [new_status, carrier ?? null, consignment_number ?? null, order_id]
            );
            return result.affectedRows;
        } catch (error) {
            console.error("Error in updateOrderDispatch:", sanitizeError(error));
            throw error;
        }
    }

    /**
     * Returns the order_id already carrying this consignment number, or null.
     *
     * Excludes `excludeOrderId` so re-saving the same order is not a clash.
     */
    async findOrderByConsignment(consignment_number, excludeOrderId) {
        try {
            const [rows] = await pool.query(
                sqlqueries.orders.findOrderByConsignment,
                [consignment_number, excludeOrderId]
            );
            return rows.length ? rows[0].order_id : null;
        } catch (error) {
            console.error("Error in findOrderByConsignment:", sanitizeError(error));
            throw error;
        }
    }

  // Delete all images for a product
    async deleteImagesByProductId(product_id, conn = null) {
    // `conn` lets this join a caller's transaction. Without it the query grabs
    // its own pool connection — a separate conversation with the database that
    // commits independently and that a rollback cannot reach. See withTransaction.
        const [result] = await (conn || pool).query(sqlqueries.product.deleteImagesByProductId, [product_id]);
        return result.affectedRows;
    }


    // Optional: fetch images for a product
    async getImagesByProductId(product_id) {
        const [rows] = await pool.query(sqlqueries.product.getImagesByProductId, [product_id]);
        return rows;
    }

    // `resetPrimaryImageByImageId` removed (CLAUDE.md AB-30). It cleared
    // is_primary_image for ALL of a product's images — the first half of a
    // "set a new cover image" operation whose second half was never written.
    // Called alone it leaves a product with no primary image, and the 9
    // storefront queries that join `AND pi.is_primary_image = 1` then return
    // NULL for image_url, so the product silently loses its picture on the shop.
    // Cover-image selection is recorded in CLAUDE.md Deferred work; it needs
    // both statements in one transaction, not this half on its own.


    async insertImages(product_id, images, conn = null) {
    // `conn` lets this join a caller's transaction. Without it the query grabs
    // its own pool connection — a separate conversation with the database that
    // commits independently and that a rollback cannot reach. See withTransaction.
  try {
    const values = images.map(img => [
      product_id,
      img.image_url,
      img.is_primary_image ?? 0
    ]);

    const [result] = await (conn || pool).query(
      sqlqueries.product.insertImage,
      [values] // 👈 IMPORTANT: array of arrays
    );

    return result.affectedRows;
  } catch (err) {
    console.error("Error in insertImages:", sanitizeError(err));
    throw err;
  }
}

    async deleteProduct(productId) {
        try {
            const [result] = await pool.query(sqlqueries.product.deleteProduct, [productId]);
            return result;
        } catch (err) {
            console.error("Error in deleteProduct DB Ops:", sanitizeError(err));
            throw err;
        }
    }

    async addCategory(name) {
        try {
            // Note: Adjust table/column names based on your schema (e.g., a 'categories' table)
            const [result] = await pool.query(sqlqueries.product.addCategory, [name]);
            return { id: result.insertId, name };
        } catch (err) {
            throw err;
        }
    }

    async deleteCategoryById(categoryId, conn = null) {
  try {
    const [result] = await (conn || pool).query(sqlqueries.product.deleteCategory, [categoryId]);
    return result;
  } catch (err) {
    console.error("Error in dbCmds.deleteCategoryById:", sanitizeError(err));
    throw err;
  }
}

    /**
     * Set a category's tile image, returning the URL it replaced.
     *
     * The previous URL is read inside the same call so the caller can destroy
     * the old Cloudinary asset AFTER the database commits. Without that, every
     * re-upload strands a paid asset — the AB-10 failure, which had left 111
     * unreferenced images before it was fixed for products.
     */
    async updateCategoryImage(categoryId, imageUrl) {
        try {
            const [prev] = await pool.query(
                sqlqueries.product.getCategoryImageById,
                [categoryId]
            );
            const [result] = await pool.query(
                sqlqueries.product.updateCategoryImage,
                [imageUrl, categoryId]
            );
            return {
                affectedRows: result.affectedRows,
                previousUrl: prev.length ? prev[0].image_url : null,
            };
        } catch (err) {
            console.error("Error in updateCategoryImage:", sanitizeError(err));
            throw err;
        }
    }

    /** Live category name for an id, or null. */
    async getCategoryNameById(categoryId) {
        try {
            const [rows] = await pool.query(sqlqueries.product.getCategoryNameById, [categoryId]);
            return rows.length ? rows[0].name : null;
        } catch (err) {
            console.error("Error in getCategoryNameById:", sanitizeError(err));
            throw err;
        }
    }

    /** How many live products carry this category name. See CLAUDE.md AB-31. */
    async countProductsInCategory(categoryName) {
        try {
            const [rows] = await pool.query(
                sqlqueries.product.countProductsInCategory,
                [categoryName]
            );
            return Number(rows[0]?.product_count ?? 0);
        } catch (err) {
            console.error("Error in countProductsInCategory:", sanitizeError(err));
            throw err;
        }
    }

    /**
     * Soft-delete a category AND every live product in it, atomically.
     *
     * One transaction on purpose: deleting the category but not its products
     * is exactly the drift AB-31/DB-06 describes — products left pointing at a
     * category that no longer exists, still visible in the shop. A partial
     * failure here would create precisely the state this is meant to prevent.
     */
    async deleteCategoryWithProducts(categoryId, categoryName) {
        return withTransaction(async (conn) => {
            const [productResult] = await conn.query(
                sqlqueries.product.softDeleteProductsInCategory,
                [categoryName]
            );
            await conn.query(sqlqueries.product.deleteCategory, [categoryId]);
            return { productsDeleted: productResult.affectedRows };
        });
    }

    // Get all categories from the database
    async getAllCategories() {
    try {
        const [rows] = await pool.query(sqlqueries.product.getAllCategory);
        return rows;
    } catch (err) {
        console.error("Error in dbCmds.getAllCategories:", sanitizeError(err));
        throw err;
    }
    }
    

    
}

module.exports = new Cmds();
