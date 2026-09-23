// customerDbOps.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const sqlqueries = require('../dbOps/sqlQueries');
const { sanitizeError } = require('../utils/safeError');
const appDefines = require('../constants/appDefines');

/**
 * A real bcrypt hash of a value that is not any user's password.
 *
 * Compared against on the account-not-found path so a failed login costs the
 * same whether or not the email exists. Hardcoded rather than generated at
 * boot: hashing at cost 12 takes ~230ms, and paying that on every process
 * start (Render cold starts included) to produce a constant is wasteful.
 *
 * Generated at cost 12 to match appDefines.password.BCRYPT_COST. If that
 * constant is ever raised, regenerate this too — a mismatched cost reintroduces
 * the timing gap it exists to close. See CLAUDE.md AB-19e.
 */
const DUMMY_HASH = '$2b$12$I4dTwYOh1APoqQm65IJMjO/iIGlWTHMrZhPkyxdAWe8LGXRFBA.KW';

/**
 * Escape the LIKE metacharacters in a customer-supplied search term.
 *
 * `%` and `_` are WILDCARDS inside LIKE, not literals. Without this, searching
 * for "%" matches the entire catalogue and "_" matches every single-character
 * position — so the search box would quietly behave as a "show me everything"
 * control, and a customer looking for a saree code containing an underscore
 * would get nonsense.
 *
 * The backslash must be escaped FIRST, otherwise escaping % and _ would then
 * have their own added backslashes re-escaped.
 */
const escapeLike = (term) =>
  String(term ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');

/**
 * Words the search should ignore.
 *
 * "saree" and "sarees" are in here because EVERY product is a saree: as a
 * search word it matches the whole catalogue and contributes nothing but noise
 * to the ranking. A customer typing "green saree" means "green" — the second
 * word is how people speak, not a filter. Dropping it is what makes that query
 * return green sarees instead of the entire shop with the green ones nudged to
 * the top.
 *
 * Kept deliberately SHORT. A long stop-word list starts removing words that
 * carry meaning in a specific catalogue, and the damage is invisible: the
 * customer just sees worse results with no indication why.
 */
const SEARCH_STOP_WORDS = new Set([
  'saree', 'sarees', 'sari', 'saris',
  'a', 'an', 'the', 'and', 'or', 'for', 'with', 'in', 'of', 'me', 'my',
  'show', 'find', 'want', 'need', 'buy',
]);

/** Longest query we will tokenise. Bounds the generated SQL and the parameter
 *  list — 6 words is far more than any real product search. */
const MAX_SEARCH_TOKENS = 6;

/**
 * Break a search phrase into the words worth matching.
 *
 * Steps, in order, and each one earns its place:
 *
 *   1. lowercase + split on anything that is not a letter or digit, so
 *      "green,silk" and "green silk" behave the same.
 *   2. drop stop words (see above).
 *   3. drop single characters — "s" matches almost every product and ranks
 *      nothing usefully.
 *   4. strip ONE trailing "s" from words longer than 3 characters. This is the
 *      plural fix and it only works in this direction: LIKE '%saree%' already
 *      matches "sarees" because it is a substring, but LIKE '%sarees%' does NOT
 *      match "Saree". Stemming the WORD rather than the column means "georgettes"
 *      finds "Georgette" without touching the data.
 *   5. de-duplicate, so "silk silk saree" is not scored twice for one word.
 *
 * If every word is filtered out — "the sarees" — the caller returns an empty
 * list. That is honest: we cannot tell what they were looking for.
 */
const tokenizeSearch = (term) => {
  const words = String(term ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const kept = [];
  for (const word of words) {
    if (SEARCH_STOP_WORDS.has(word)) continue;
    if (word.length < 2) continue;

    const stem = word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
    if (!kept.includes(stem)) kept.push(stem);
    if (kept.length === MAX_SEARCH_TOKENS) break;
  }
  return kept;
};

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
      city,
      state,
      pincode,
      hashedPassword
    } = userData;

    const [result] = await pool.query(
      sqlqueries.signup.insertCustomer,
      [
        user_name,
        pri_email,
        phone_number,
        address,
        // `?? null` on each: these columns are nullable, and an absent value
        // must be stored as NULL, not the string "undefined". Passing an
        // `undefined` through pool.query escapes to the literal NULL anyway,
        // but relying on that is how CB-23 silently overrode column DEFAULTs.
        city ?? null,
        state ?? null,
        pincode ?? null,
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


  
  // Verify customer password.
  //
  // Constant-time-ish with respect to WHETHER THE ACCOUNT EXISTS.
  //
  // The old code returned null the moment the email was not found, skipping
  // bcrypt entirely. Measured: an existing account took ~235ms (a real cost-12
  // compare) while an unknown one returned in ~19ms. That 216ms gap is a
  // reliable oracle — anyone could test any email address and learn whether
  // this shop has an account for it. See CLAUDE.md AB-19e / CB-27.
  //
  // The miss path now burns an equivalent bcrypt compare against a fixed dummy
  // hash, so both branches cost roughly the same. The dummy is generated at the
  // SAME cost as new passwords (appDefines.password.BCRYPT_COST) — a cheaper
  // dummy would simply invert the signal rather than remove it.
  async verifyCustomerPasswd(pri_email, passwd) {
    try {
      const [rows] = await pool.query(sqlqueries.login.getUserDetails, [pri_email]);

      // No such account, OR the row has no usable hash. A NULL `pass` used to
      // make bcrypt.compare reject and surface as a 500 instead of a 401.
      if (rows.length === 0 || !rows[0].pass) {
        await bcrypt.compare(passwd, DUMMY_HASH);
        return null;
      }

      const user = rows[0];
      const match = await bcrypt.compare(passwd, user.pass);
      if (!match) return null;

      // Transparent rehash.
      //
      // CB-28 raised the cost from 10 to 12, but only for NEW hashes — every
      // account created before that change is still cost 10. Verified: all 22
      // existing rows are $2b$10$ while a fresh signup is $2b$12$. Leaving them
      // means weaker hashes forever AND a residual timing difference, since a
      // cost-10 compare is ~4x faster than the cost-12 dummy above.
      //
      // Re-hashing here is the standard fix: the plaintext is available exactly
      // once, at login. Failure is swallowed deliberately — the user has
      // already authenticated and must not be blocked by a background upgrade.
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
      console.error("Error in verifyCustomerPasswd:", sanitizeError(err));
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

  // Returns affectedRows, NOT the OkPacket. 0 means the user does not exist or
  // has been soft-deleted, and the caller turns that into a 404.
  //
  // affectedRows rather than changedRows on purpose: opening the form and
  // saving without editing anything matches the row but changes nothing, which
  // is a valid no-op. changedRows would report that as "user not found". Same
  // distinction as the admin-side stock CAS.
  async updateUserProfile(user_id, { user_name, phone_number, address, city, state, pincode }) {
    try {
      const [result] = await pool.query(
        sqlqueries.login.updateUserProfile,
        [user_name, phone_number, address, city, state, pincode, user_id]
      );
      return result.affectedRows;
    } catch (err) {
      console.error("Error in updateUserProfile dbCmd:", sanitizeError(err));
      throw err;
    }
  }

  // `getCustomerLastSessionByEmail`, `updateCustomerToken` and
  // `updateCustomerSessionStatus` were removed here (CLAUDE.md AB-30, client
  // twin). Same story as the admin side: the pre-Phase-2 session layer, zero
  // call sites, superseded by `getActiveSessionById` and
  // `logoutSessionBySessionId` below. Their SQL went with them.

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
/**
 * Categories for the homepage tiles: real names, their images, and only those
 * that actually have products. See CLAUDE.md CF-35.
 *
 * Separate from getAllCategories below, which returns DISTINCT
 * product.category for filtering and has no image to offer.
 */
async getCategoryTiles() {
    try {
        const [rows] = await pool.query(sqlqueries.product.getCategoryTilesWithImages);
        return rows;
    } catch (err) {
        console.error("Error in getCategoryTiles:", sanitizeError(err));
        throw err;
    }
}

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

// Full live catalogue for the storefront's /shop page.
// Returns FLAT rows — one per image — which the manager groups into products
// with an images[] array, same as getProductsByCategory. See CLAUDE.md CF-22.
async searchProducts(term, limit = 12) {
  try {
    const tokens = tokenizeSearch(term);

    // Every word was punctuation or a stop word. Return nothing rather than
    // running a query with zero conditions, which would produce `WHERE ... AND ()`
    // — a syntax error — or, if written defensively, the whole catalogue.
    if (tokens.length === 0) return [];

    // Each word becomes a %contains% pattern, repeated once per searched
    // column. The relevance params come first, then the WHERE params, then the
    // LIMIT — matching the placeholder order the query builder emits. Getting
    // this order wrong would not error; it would silently rank by the wrong
    // column, which is why the two are built from the SAME token list here
    // rather than assembled separately.
    const patterns = tokens.map((t) => `%${escapeLike(t)}%`);
    const perToken = (p) => [p, p, p, p, p]; // name, category, collection, material, description

    const params = [
      ...patterns.flatMap(perToken), // relevance (SELECT)
      ...patterns.flatMap(perToken), // match (WHERE)
      limit,
    ];

    const [rows] = await pool.query(
      sqlqueries.product.searchProducts(tokens.length),
      params
    );
    return rows;
  } catch (err) {
    console.error("Error in searchProducts:", sanitizeError(err));
    throw err;
  }
}

async getAllProducts() {
  try {
    const [rows] = await pool.query(sqlqueries.product.getAllProducts);
    return rows;
  } catch (err) {
    console.error("Error in getAllProducts:", sanitizeError(err));
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
  // Takes a named object, not positional arguments.
  //
  // This was seven positionals and shipping_fee would have made eight, with two
  // adjacent money fields (total_amount, shipping_fee) and two adjacent
  // strings (shipping_address, contact_phone) — swap either pair and it still
  // runs, silently writing the wrong values. The previous comment here said to
  // convert on the eighth field; this is it.
  async createOrder(order, conn = null) {
    const {
      user_id,
      total_amount,
      shipping_fee,
      shipping_address,
      contact_phone,
      payment_method,
      payment_status,
      status
    } = order;

    const [result] = await (conn || pool).query(sqlqueries.order.createOrder, [
      user_id,
      total_amount,
      // Coalesced so a caller that omits it records 0.00 rather than NULL —
      // the column is NOT NULL, and "no shipping charged" is a real value.
      shipping_fee ?? 0,
      shipping_address,
      // Normalised to NULL rather than undefined: mysql2 escapes undefined to
      // the literal NULL anyway, but being explicit keeps "no number given"
      // as one representation instead of two. See CB-23.
      contact_phone || null,
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
