// customerDbOps.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const sqlqueries = require('../dbOps/sqlQueries');
const { sanitizeError } = require('../utils/safeError');

class CustomerCmds {

  // ---------------------- CUSTOMER SIGN UP ----------------------

// Insert customer
async insertCustomerUser(userData) {
  try {
    const {
      user_name,
      pri_email,
      phone_number,
      address,
      hashedPassword
    } = userData;

    const [result] = await pool.query(
      sqlqueries.signup.insertCustomer,
      [
        user_name,
        pri_email,
        phone_number,
        address,
        hashedPassword,
        2 // CUSTOMER role_id
      ]
    );

    return {
      user_id: result.insertId,
      pri_email,
    };

  } catch (err) {
    console.error("Error in insertCustomerUser:", sanitizeError(err));
    throw err;
  }
}


  
  // Verify customer password
  async verifyCustomerPasswd(pri_email, passwd) {
    try {
      const [rows] = await pool.query(sqlqueries.login.getUserDetails, [pri_email]);
      if (rows.length === 0) return null;
      const user = rows[0];
      const match = await bcrypt.compare(passwd, user.pass);

      return match ? user : null;
    } catch (err) {
      console.error("Error in verifyCustomerPasswd:", sanitizeError(err));
      throw err;
    }
  }

  // Get last session for given customer email
  async getCustomerLastSessionByEmail(pri_email) {
    try {
      const [rows] = await pool.query(sqlqueries.login.getSessionDetails, [pri_email]);
      return rows[0] || null;
    } catch (err) {
      console.error("Error in getCustomerLastSessionByEmail:", sanitizeError(err));
      throw err;
    }
  }

  // Create a new customer session
  async insertNewCustomerSession(user_id, pri_email, session_id, login_token, SESSION_ACTIVE, conn = null) {
    try {
      const [result] = await (conn || pool).query(
        sqlqueries.login.createNewSession,
        [session_id, user_id, pri_email, login_token, SESSION_ACTIVE]
      );
      return result.insertId || null;
    } catch (err) {
      console.error("Error in insertNewCustomerSession:", sanitizeError(err));
      throw err;
    }
  }


  // dbCmds.js
async getUserById(user_id) {
  try {
    const [rows] = await pool.query(
      sqlqueries.login.getUserById, 
      [user_id]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error("Error in getUserById dbCmd:", sanitizeError(err));
    throw err;
  }
}

  // Update customer session token
  async updateCustomerToken(token, sid) {
    try {
      await pool.query(sqlqueries.login.updateToken, [token, sid]);
    } catch (err) {
      console.error("Error in updateCustomerToken:", sanitizeError(err));
      throw err;
    }
  }

  // Update session status (logout etc.)
  async updateCustomerSessionStatus(logoutTime, status, sid) {
    try {
      await pool.query(sqlqueries.login.updateSessionStatus, [status, logoutTime, sid]);
    } catch (err) {
      console.error("Error in updateCustomerSessionStatus:", sanitizeError(err));
      throw err;
    }
  }

  // --- Phase 2 auth ------------------------------------------------------

  /**
   * Fetch an ACTIVE, unexpired session by session_id, joined to its user.
   * Returns null if the session is missing, logged out, expired, or the
   * account has been soft-deleted (is_delete is checked by the caller).
   *
   * Called on every authenticated request — see CLAUDE.md CB-01.
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
   * Serialises concurrent logins so the device-cap check cannot race. AB-15.
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
   * Revoke a session by session_id. Scoped to user_id so one account can never
   * terminate another's session.
   *
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


  // get collections
  async getAllCollections() {
    try {
      const [rows] = await pool.query(sqlqueries.product.getAllCollections);
      return rows;
    } catch (err) {
      console.error("Error in getAllCollections:", sanitizeError(err));
      throw err;
    }
  }

  // ✅ NEW: Get all best sellers (includes stock + primary image)
  async getBestSellers(limit = 6) {
    try {
      const [rows] = await pool.query(sqlqueries.product.getBestSellers, [limit]);
      return rows;
    } catch (err) {
      console.error("Error in getBestSellers:", sanitizeError(err));
      throw err;
    }
  }
  

  // Get all categories
async getAllCategories() {
  try {
    const [rows] = await pool.query(sqlqueries.product.getAllCategories);
    return rows;
  } catch (err) {
    console.error("Error in getAllCategories:", sanitizeError(err));
    throw err;
  }
}


// Get product by ID with all images
async getProductByIdWithImages(productId) {
  try {
    const [rows] = await pool.query(
      sqlqueries.product.getProductByIdWithImages,
      [productId]
    );

    if (rows.length === 0) return null;

    // Convert images string to array
    const product = rows[0];
    product.images = product.images ? product.images.split(',') : [];

    return product;
  } catch (err) {
    console.error("Error in getProductByIdWithImages:", sanitizeError(err));
    throw err;
  }
}

// Get products by category
async getProductsByCategory(category) {
  try {
    const [rows] = await pool.query(sqlqueries.product.getProductsByCategory, [category]);
    return rows;
  } catch (err) {
    console.error("Error in getProductsByCategory:", sanitizeError(err));
    throw err;
  }
}

// Check if product already exists
async checkWishlist(user_id, product_id) {
  try {
    const [rows] = await pool.query(sqlqueries.wishlist.checkWishlist, [
      user_id,
      product_id,
    ]);
    return rows;
  } catch (err) {
    console.error("Error in checkWishlist:", sanitizeError(err));
    throw err;
  }
}

// Get new release products
async getNewReleaseProducts() {
  try {
    const [rows] = await pool.query(
      sqlqueries.product.getNewReleaseProducts
    );
    return rows;
  } catch (err) {
    console.error("Error in getNewReleaseProducts:", sanitizeError(err));
    throw err;
  }
}

// Add product to wishlist
async addToWishlist(user_id, product_id) {
  try {
    const [rows] = await pool.query(sqlqueries.wishlist.addToWishlist, [
      user_id,
      product_id,
    ]);
    return rows;
  } catch (err) {
    console.error("Error in addToWishlist:", sanitizeError(err));
    throw err;
  }
}

// Get all wishlist items for a user
async getWishlist(user_id) {
  try {
    const [rows] = await pool.query(sqlqueries.wishlist.getWishlist, [user_id]);

    // Map through the rows to ensure every item has a valid image string
    const wishlistWithImages = rows.map(item => ({
      ...item,
      // If image_url is null from the database, provide a fallback placeholder
      image_url: item.image_url || 'https://via.placeholder.com/300x400?text=No+Image+Available'
    }));

    return wishlistWithImages;
  } catch (err) {
    console.error("Error in getWishlist:", sanitizeError(err));
    throw err;
  }
}

// Remove a product from wishlist
async removeWishlist(user_id, product_id) {
  try {
    const [rows] = await pool.query(sqlqueries.wishlist.removeWishlist, [
      user_id,
      product_id,
    ]);
    return rows;
  } catch (err) {
    console.error("Error in removeWishlist:", sanitizeError(err));
    throw err;
  }
}



// Wishlist count
async wishlistCount(user_id) {
    try {
      const [rows] = await pool.query(sqlqueries.wishlist.wishlistCount, [
        user_id,
      ]);
      return rows[0];
    } catch (err) {
      console.error("Error in wishlistCount:", sanitizeError(err));
      throw err;
    }
  }

async getCart(user_id) {
  try {
    // This calls your updated SQL query that includes the JOIN
    const [rows] = await pool.query(sqlqueries.cart.getCart, [user_id]);

    // Optional: Add a fallback for products without images
    const cartWithImages = rows.map(item => ({
      ...item,
      image_url: item.image_url || 'https://via.placeholder.com/150' // Default image if null
    }));

    return cartWithImages;
  } catch (err) {
    console.error("Error in getCart:", sanitizeError(err));
    throw err;
  }
}

// Check if product exists in cart
async checkCart(user_id, product_id) {
    try {
      const [rows] = await pool.query(sqlqueries.cart.checkCart, [
        user_id,
        product_id,
      ]);
      return rows;
    } catch (err) {
      console.error("Error in checkCart:", sanitizeError(err));
      throw err;
    }

  }
  

// Add product to cart
   async addToCart(user_id, product_id) {
    try {
      await pool.query(sqlqueries.cart.addToCart, [user_id, product_id]);
      return {
        success: true,
        message: "Product added to cart",
      };
    } catch (err) {
      console.error("Error in addToCart:", sanitizeError(err));
      throw err;
    }
  }




//Update cart
 async updateCartQuantity(user_id, product_id, quantity) {
    try {
      const [result] = await pool.query(sqlqueries.cart.updateCartQuantity, [
        quantity,
        user_id,
        product_id
      ]);
      return result.affectedRows === 0
        ? { success: false, message: "Cart item not found" }
        : { success: true, message: "Quantity updated successfully" };
    } catch (err) {
      console.error("Error in updateCartQuantity:", sanitizeError(err));
      throw err;
    }
  }

  // Remove product from cart
  async removeFromCart(user_id, product_id) {
    try {
      const [result] = await pool.query(sqlqueries.cart.removeFromCart, [
        user_id,
        product_id
      ]);
      return result.affectedRows === 0
        ? { success: false, message: "Cart item not found" }
        : { success: true, message: "Cart item removed successfully" };
    } catch (err) {
      console.error("Error in removeFromCart:", sanitizeError(err));
      throw err;
    }
  }


// ==========================
// ORDER DB OPERATIONS
// ==========================

  // Create Order
  // `conn` lets these join a caller's transaction. Without it each query grabs
  // its own pool connection — a separate conversation with the database that
  // commits independently and that a rollback cannot reach. See withTransaction.
  async createOrder(user_id, total_amount, shipping_address, payment_method, payment_status, status, conn = null) {
    const [result] = await (conn || pool).query(sqlqueries.order.createOrder, [
      user_id,
      total_amount,
      shipping_address,
      payment_method,
      payment_status,
      status
    ]);
    return result.insertId; // return order_id
  }

  // Add Order Items
  async addOrderItem(order_id, product_id, quantity, price, conn = null) {
    await (conn || pool).query(sqlqueries.order.addOrderItem, [
      order_id,
      product_id,
      quantity,
      price
    ]);
  }



  // Reduce stock
  async reduceStock(product_id, quantity, conn = null) {

    // 1. Force convert to Numbers to prevent string concatenation issues
    const pId = Number(product_id);
    const qty = Number(quantity);

    // These coerced values were computed and then NOT USED — the query received
    // the original un-coerced arguments, so the very problem the comment above
    // describes was still live. They were only ever read by the console.log
    // below. See CLAUDE.md CB-31.
    const [result] = await (conn || pool).query(sqlqueries.stock.reduceStock, [
      qty,
      pId,
      qty
    ]);
    if (result.affectedRows === 0) {
      throw new Error(`Insufficient stock for product_id ${pId}`);
    }
  }

  // Clear cart
  async clearCart(user_id, conn = null) {
    await (conn || pool).query(sqlqueries.cart.clearCart, [user_id]);
  }

  
  async getStock(product_id) {
  const [rows] = await pool.query(sqlqueries.stock.getStock, [product_id]);
  return rows[0]?.stock_qty || 0;
}
  
// 📌 Get order details
async getOrderById(order_id) {
  try {
    const [rows] = await pool.query(sqlqueries.order.getOrderById, [order_id]);
    return rows.length ? rows[0] : null;
  } catch (err) {
    console.error("Error in getOrderById:", sanitizeError(err));
    throw err;
  }
}

// 📌 Get items inside an order
async getOrderItems(order_id) {
  try {
    const [rows] = await pool.query(sqlqueries.order.getOrderItems, [order_id]);
    return rows;
  } catch (err) {
    console.error("Error in getOrderItems:", sanitizeError(err));
    throw err;
  }
}

async getOrdersByUser(user_id) {
    try {
      const [rows] = await pool.query(
        sqlqueries.order.getOrdersByUser,
        [user_id]
      );
      return rows;
    } catch (err) {
      console.error("Error in getOrdersByUser:", sanitizeError(err));
      throw err;
    }
  }






}

module.exports = new CustomerCmds();
