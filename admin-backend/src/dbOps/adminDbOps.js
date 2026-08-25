// admindbops.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const sqlqueries = require('../dbOps/sqlQueries')
const { sanitizeError } = require('../utils/safeError');

class Cmds {

    // Verify admin password
    async verifyAdminPasswd(pri_email, passwd) {
        try {
            const [rows] = await pool.query(sqlqueries.login.getUserDetails, [pri_email]);
            if (rows.length === 0) return null;
            const user = rows[0];
            const match = await bcrypt.compare(passwd, user.pass);
            return match ? user : null;
        } catch (err) {
            console.error("Error in verifyAdminPasswd:", sanitizeError(err));
            throw err;
        }
    }

    // Get last session for given email
    async getAdminLastSessionByEmail(pri_email) {
        try {
            const [rows] = await pool.query(sqlqueries.login.getSessionDetails, [pri_email]);
            return rows[0] || null;
        } catch (err) {
            console.error("Error in getAdminLastSessionByEmail:", sanitizeError(err));
            throw err;
        }
    }

    //create a new session
    async insertNewSession(user_id, pri_email, session_id, login_token, SESSION_ACTIVE) {
        try {
            const [result] = await pool.query(
                sqlqueries.login.createNewSession,
                [session_id, user_id, pri_email, login_token, SESSION_ACTIVE]
            );
            return result.insertId || null;
        } catch (err) {
            console.error("Error in insertNewSession:", sanitizeError(err));
            throw err;
        }
    }

    // Update session token
    async updateToken(token, sid) {
        try {
            await pool.query(sqlqueries.login.updateToken, [token, sid]);
        } catch (err) {
            console.error("Error in updateToken:", sanitizeError(err));
            throw err;
        }
    }

    // Update session status and logout time
    async updateSessionStatus(logoutTime, status, sid) {
        try {
            await pool.query(sqlqueries.login.updateSessionStatus, [status, logoutTime, sid]);
        } catch (err) {
            console.error("Error in updateSessionStatus:", sanitizeError(err));
            throw err;
        }
    }

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
    async getActiveSessionsForUser(user_id, activeStatus, maxAgeSeconds) {
        try {
            const [rows] = await pool.query(
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
    async logoutSessionBySessionId(session_id, user_id, logoutStatus) {
        try {
            const [result] = await pool.query(
                sqlqueries.login.logoutSessionBySessionId,
                [logoutStatus, session_id, user_id]
            );
            return result.affectedRows;
        } catch (err) {
            console.error("Error in logoutSessionBySessionId:", sanitizeError(err));
            throw err;
        }
    }

    async createProduct(productData) {
        try {

            const isNewRelease = productData.is_new_release !== undefined 
            ? Number(productData.is_new_release)
            : 0;
            const [result] = await pool.query(sqlqueries.product.insertProduct, [productData.name,
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
            console.error("Error in updateSessionStatus:", sanitizeError(err));
            throw err;
        }
    }

    async insertProductStock(product_id, stock_qty) {
        try {
            await pool.query(
            sqlqueries.product.insertProductStock,
            [product_id, stock_qty ?? 0]
    );
        } catch (err) {
            console.error("Error in insertProductStock:", sanitizeError(err));
            throw err;
  }
}

    async getOrderStats() {
        try {
            const [rows] = await pool.query(sqlqueries.dashBoard.getOrderStats);
            return rows[0]; // single aggregated row
        } catch (error) {
            console.error("Error in getOrderStats:", sanitizeError(error));
            throw error;
        }
    }

    async getBestSellers() {
        try {
            const [rows] = await pool.query(sqlqueries.dashBoard.getBestSellers);
            return rows; // return full list
        } catch (error) {
            console.error("Error in getBestSellers:", sanitizeError(error));
            throw error;
        }
    }

    async getRecentOrders() {
        try {
            const [rows] = await pool.query(sqlqueries.dashBoard.getRecentOrders);
            return rows; // return full list
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

async updateProduct(productData) {
  try {
    await pool.query(sqlqueries.product.updateProduct, [
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
  } catch (err) {
    console.error("Error in updateProduct:", sanitizeError(err));
    throw err;
  }
}

async updateProductStock(product_id, stock_qty) {
  await pool.query(
    sqlqueries.product.updateProductStock,
    [stock_qty, product_id]
  );
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

  // Delete all images for a product
    async deleteImagesByProductId(product_id) {
        const [result] = await pool.query(sqlqueries.product.deleteImagesByProductId, [product_id]);
        return result.affectedRows;
    }


    // Optional: fetch images for a product
    async getImagesByProductId(product_id) {
        const [rows] = await pool.query(sqlqueries.product.getImagesByProductId, [product_id]);
        return rows;
    }

    // Optional: reset primary image
    async resetPrimaryImageByImageId(image_id) {
        await pool.query(sqlqueries.product.resetPrimaryImageByImageId, [image_id]);
    }


    async insertImages(product_id, images) {
  try {
    const values = images.map(img => [
      product_id,
      img.image_url,
      img.is_primary_image ?? 0
    ]);

    const [result] = await pool.query(
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

    async deleteCategoryById(categoryId) {
  try {
    const [result] = await pool.query(sqlqueries.product.deleteCategory, [categoryId]);
    return result;
  } catch (err) {
    console.error("Error in dbCmds.deleteCategoryById:", sanitizeError(err));
    throw err;
  }
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
