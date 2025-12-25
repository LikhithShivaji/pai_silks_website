// customerDbOps.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const sqlqueries = require('../dbOps/sqlQueries');

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
    console.error("Error in insertCustomerUser:", err);
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
      console.error("Error in verifyCustomerPasswd:", err);
      throw err;
    }
  }

  // Get last session for given customer email
  async getCustomerLastSessionByEmail(pri_email) {
    try {
      const [rows] = await pool.query(sqlqueries.login.getSessionDetails, [pri_email]);
      return rows[0] || null;
    } catch (err) {
      console.error("Error in getCustomerLastSessionByEmail:", err);
      throw err;
    }
  }

  // Create a new customer session
  async insertNewCustomerSession(user_id, pri_email, session_id, login_token, SESSION_ACTIVE) {
    try {
      const [result] = await pool.query(
        sqlqueries.login.createNewSession,
        [session_id, user_id, pri_email, login_token, SESSION_ACTIVE]
      );
      return result.insertId || null;
    } catch (err) {
      console.error("Error in insertNewCustomerSession:", err);
      throw err;
    }
  }

  // Update customer session token
  async updateCustomerToken(token, sid) {
    try {
      await pool.query(sqlqueries.login.updateToken, [token, sid]);
    } catch (err) {
      console.error("Error in updateCustomerToken:", err);
      throw err;
    }
  }

  // Update session status (logout etc.)
  async updateCustomerSessionStatus(logoutTime, status, sid) {
    try {
      await pool.query(sqlqueries.login.updateSessionStatus, [status, logoutTime, sid]);
    } catch (err) {
      console.error("Error in updateCustomerSessionStatus:", err);
      throw err;
    }
  }


  // get collections
  async getAllCollections() {
    try {
      const [rows] = await pool.query(sqlqueries.product.getAllCollections);
      return rows;
    } catch (err) {
      console.error("Error in getAllCollections:", err);
      throw err;
    }
  }

  // ✅ NEW: Get all best sellers (includes stock + primary image)
  async getBestSellers(limit = 6) {
    try {
      const [rows] = await pool.query(sqlqueries.product.getBestSellers, [limit]);
      return rows;
    } catch (err) {
      console.error("Error in getBestSellers:", err);
      throw err;
    }
  }
  

  // Get all categories
async getAllCategories() {
  try {
    const [rows] = await pool.query(sqlqueries.product.getAllCategories);
    return rows;
  } catch (err) {
    console.error("Error in getAllCategories:", err);
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
    console.error("Error in getProductByIdWithImages:", err);
    throw err;
  }
}

// Get products by category
async getProductsByCategory(category) {
  try {
    const [rows] = await pool.query(sqlqueries.product.getProductsByCategory, [category]);
    return rows;
  } catch (err) {
    console.error("Error in getProductsByCategory:", err);
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
    console.error("Error in checkWishlist:", err);
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
    console.error("Error in getNewReleaseProducts:", err);
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
    console.error("Error in addToWishlist:", err);
    throw err;
  }
}

// Get all wishlist items for a user
async getWishlist(user_id) {
  try {
    const [rows] = await pool.query(sqlqueries.wishlist.getWishlist, [
      user_id,
    ]);
    return rows;
  } catch (err) {
    console.error("Error in getWishlist:", err);
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
    console.error("Error in removeWishlist:", err);
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
      console.error("Error in wishlistCount:", err);
      throw err;
    }
  }

async getCart(user_id) {
  try {
    const [rows] = await pool.query(sqlqueries.cart.getCart, [user_id]);
    return rows; // Return empty array if none
  } catch (err) {
    console.error("Error in getCart:", err);
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
      console.error("Error in checkCart:", err);
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
      console.error("Error in addToCart:", err);
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
      console.error("Error in updateCartQuantity:", err);
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
      console.error("Error in removeFromCart:", err);
      throw err;
    }
  }


// ==========================
// ORDER DB OPERATIONS
// ==========================

  // Create Order
  async createOrder(user_id, total_amount, shipping_address, payment_method, payment_status, status) {
    const [result] = await pool.query(sqlqueries.order.createOrder, [
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
  async addOrderItem(order_id, product_id, quantity, price) {
    await pool.query(sqlqueries.order.addOrderItem, [
      order_id,
      product_id,
      quantity,
      price
    ]);
  }



  // Reduce stock
  async reduceStock(product_id, quantity) {
    const [result] = await pool.query(sqlqueries.stock.reduceStock, [
      quantity,
      product_id,
      quantity
    ]);
    if (result.affectedRows === 0) {
      throw new Error(`Insufficient  stock for product_id ${product_id}`);
    }
  }

  // Clear cart
  async clearCart(user_id) {
    await pool.query(sqlqueries.cart.clearCart, [user_id]);
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
    console.error("Error in getOrderById:", err);
    throw err;
  }
}

// 📌 Get items inside an order
async getOrderItems(order_id) {
  try {
    const [rows] = await pool.query(sqlqueries.order.getOrderItems, [order_id]);
    return rows;
  } catch (err) {
    console.error("Error in getOrderItems:", err);
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
      console.error("Error in getOrdersByUser:", err);
      throw err;
    }
  }






}

module.exports = new CustomerCmds();
