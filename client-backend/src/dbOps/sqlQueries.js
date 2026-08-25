const sqlqueries = {


   signup: {
  insertCustomer: `
    INSERT INTO master_user
    (user_name, pri_email, phone_number, address, pass, role_id, created, is_delete)
    VALUES (?, ?, ?, ?, ?, ?, NOW(), 0)
  `
},




    login: {
        getUserDetails: `SELECT * FROM master_user WHERE pri_email = ?`,
        getSessionDetails: `SELECT * FROM session WHERE pri_email = ? ORDER BY login_date_time DESC LIMIT 1`,
        createNewSession: `INSERT INTO session (session_id, user_id, pri_email, token, status) VALUES (?,?,?,?,?)`,
        // NOTE: there is no `token_created_time` column in this database —
        // customerAuthManager.js:29 reads it and always gets undefined, so
        // `now - new Date(undefined)` is NaN and the token-age check silently
        // never passes. AB-11 assumed the column existed but was NULL; it does
        // not exist at all.
        //
        // Not adding it: from Phase 2 the JWT carries its own `exp` claim, so a
        // separate DB timestamp is redundant. The renewal path that reads it is
        // replaced in Slice 4. See CLAUDE.md AB-11.
        updateToken: `UPDATE session SET token = ? WHERE sid = ?`,
        updateSessionStatus: `UPDATE session SET status = ?, logout_date_time = ? WHERE sid = ?`,

        // --- Phase 2 auth ---------------------------------------------------

        // Called by authMiddleware on EVERY authenticated request. Joins the
        // user so a single query answers all three questions: is the session
        // active, is it unexpired, and has the account been soft-deleted
        // (CB-21 — login previously ignored is_delete entirely).
        //
        // Expiry is enforced here in SQL rather than in JS so a clock skew or a
        // forgotten check cannot let a stale session through.
        getActiveSessionById: `
            SELECT s.sid, s.session_id, s.user_id, s.pri_email, s.status,
                   s.login_date_time, u.role_id, u.is_delete
            FROM session s
            JOIN master_user u ON u.user_id = s.user_id
            WHERE s.session_id = ?
              AND s.status = ?
              AND s.login_date_time > (NOW() - INTERVAL ? SECOND)
            LIMIT 1
        `,

        // Serialises concurrent logins for ONE user.
        //
        // read sessions -> evict oldest -> insert new is a check-then-act race.
        // Without a lock, concurrent logins all read the same count, all
        // conclude there is room, and all insert. Demonstrated on the admin
        // side: SIX simultaneous logins produced FOUR sessions against a cap of
        // two. See CLAUDE.md AB-15.
        //
        // The lock is on master_user, not session: `FOR UPDATE` on `session`
        // locks only rows that already match, so a user with zero active
        // sessions has nothing locked and the race survives.
        //
        // MUST be called inside a transaction.
        lockUserForSessionUpdate: `
            SELECT user_id FROM master_user WHERE user_id = ? FOR UPDATE
        `,

        // Active, unexpired sessions for a user, oldest first — used to enforce
        // the 2-device cap. Oldest first so the head of the list is what gets
        // evicted.
        getActiveSessionsForUser: `
            SELECT sid, session_id, login_date_time
            FROM session
            WHERE user_id = ?
              AND status = ?
              AND login_date_time > (NOW() - INTERVAL ? SECOND)
            ORDER BY login_date_time ASC
        `,

        // Revoke by session_id (logout). Scoped to the owning user so one
        // account can never terminate another's session.
        logoutSessionBySessionId: `
            UPDATE session
            SET status = ?, logout_date_time = NOW()
            WHERE session_id = ? AND user_id = ?
        `,

        getUserDetails: `SELECT * FROM master_user WHERE pri_email = ?`,
        getUserById: `
      SELECT user_id, user_name, pri_email, phone_number, address 
      FROM master_user 
      WHERE user_id = ?
    `,
    },

    product: {
    
    getAllCollections: `
      SELECT DISTINCT collection 
      FROM product 
      WHERE is_deleted = 0 
      ORDER BY collection;
    `,

    getAllCategories: `
      SELECT DISTINCT category 
      FROM product 
      WHERE is_deleted = 0 
      ORDER BY category;
    `,

    // ✅ Get Bestsellers (includes product, stock, and primary image)
    getBestSellers: `
      SELECT 
    p.id,
    p.name,
    p.description,
    p.category,
    p.collection,
    p.material,
    p.product_code,
    p.product_wash_care,
    p.regular_price,
    p.saree_length,
    p.selling_price,
    IFNULL(ps.stock_qty, 0) AS stock_qty,
    SUM(oi.quantity) AS total_sold, -- Changed from COUNT to SUM for unit accuracy
    pi.image_url AS primary_image
    FROM order_items oi
    JOIN product p ON oi.product_id = p.id
    LEFT JOIN product_stock ps ON p.id = ps.product_id
    LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary_image = 1
    WHERE p.is_deleted = 0 
      AND IFNULL(ps.stock_qty, 0) > 0
    GROUP BY 
        p.id, 
        ps.stock_qty, 
        pi.image_url
    ORDER BY total_sold DESC
    LIMIT ?;
    `,

  getProductByIdWithImages: `
  SELECT 
      p.id,
      p.name,
      p.description,
      p.category,
      p.collection,
      p.material,
      p.product_code,
      p.product_wash_care,
      p.regular_price,
      p.saree_length,
      p.selling_price,
      IFNULL(ps.stock_qty, 0) AS stock_qty,
      GROUP_CONCAT(pi.image_url) AS images
  FROM product p
  LEFT JOIN product_stock ps ON p.id = ps.product_id
  LEFT JOIN product_images pi ON p.id = pi.product_id
  WHERE p.is_deleted = 0 AND p.id = ?
  GROUP BY 
      p.id, p.name, p.description, p.category, p.collection, 
      p.material, p.product_code, p.product_wash_care, 
      p.regular_price, p.selling_price, ps.stock_qty;
`,

getProductsByCategory: `
      SELECT 
      p.id,
      p.name,
      p.description,
      p.category,
      p.collection,
      p.material,
      p.product_code,
      p.product_wash_care,
      p.regular_price,
      p.saree_length,
      p.selling_price,
      IFNULL(ps.stock_qty, 0) AS stock_qty,
      pi.id AS image_id,
      pi.image_url,
      pi.is_primary_image
  FROM product p
  LEFT JOIN product_stock ps ON p.id = ps.product_id
  LEFT JOIN product_images pi ON p.id = pi.product_id
  WHERE p.category = ? AND p.is_deleted = 0
  ORDER BY p.name, pi.is_primary_image DESC;
    `,

getNewReleaseProducts: `
    SELECT *
    FROM product
    WHERE is_new_release = 1
      AND is_deleted = 0
    ORDER BY created_at DESC;
    `,
    
  },


    wishlist: {
    checkWishlist: `
      SELECT wishlist_id 
      FROM wishlist 
      WHERE user_id = ? AND product_id = ?;
    `,

    addToWishlist: `
      INSERT INTO wishlist (user_id, product_id) 
      VALUES (?, ?);
    `,

    getWishlist: `
      SELECT 
      w.wishlist_id, 
      p.*, 
      pi.image_url
      FROM wishlist w
      -- is_deleted = 0: same reasoning as getCart. A soft-deleted product must
      -- not keep appearing in saved items. See CLAUDE.md CB-08s.
      JOIN product p ON w.product_id = p.id AND p.is_deleted = 0
      LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary_image = 1
      WHERE w.user_id = ?
      ORDER BY w.added_at DESC;
    `,

    removeWishlist: `
      DELETE FROM wishlist 
      WHERE user_id = ? AND product_id = ?;
    `,

    wishlistCount: `
    SELECT COUNT(*) AS count FROM wishlist WHERE user_id = ?;
  `,
},

    cart: {
  // Check if product already exists in cart
  checkCart: `
    SELECT * FROM cart WHERE user_id = ? AND product_id = ?;
  `,
  
  // Add product to cart.
  //
  // "Add to cart" means "ensure this product is in the cart" — it is NOT a
  // quantity increment. Repeating it is a deliberate no-op, which matches the
  // storefront, where clicking add on an item already in the cart changes
  // nothing. Quantity changes go through updateCartQuantity.
  //
  // The ON DUPLICATE KEY clause depends on the unique index added in
  // migrations/001_cart_unique_user_product.sql. Without it this was a bare
  // INSERT, so every click created another row and checkout — which bills from
  // the database — charged the customer once per click. See CLAUDE.md CB-22.
  addToCart: `
    INSERT INTO cart (user_id, product_id, quantity, added_at)
    VALUES (?, ?, 1, NOW())
    ON DUPLICATE KEY UPDATE quantity = quantity;
  `,

 getCart: `
    SELECT 
    c.cart_id, 
    c.quantity, 
    p.id AS product_id,
    p.name,
    p.selling_price AS price,
    p.regular_price,
    p.category,
    pi.image_url
    FROM cart c
    -- is_deleted = 0: a soft-deleted product must not remain purchasable.
    -- Without it, a product deleted from the admin panel stayed in any cart it
    -- was already in, checked out, and reduced stock. See CLAUDE.md CB-08s.
    --
    -- The item silently disappears from the cart (owner decision, 2026-08-26).
    -- Telling the customer "an item is no longer available" is better UX and is
    -- logged as a follow-up; it needs a frontend change to detect the drop.
    JOIN product p ON c.product_id = p.id AND p.is_deleted = 0
    LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary_image = 1
    WHERE c.user_id = ?
    ORDER BY c.added_at DESC;
  `,

  updateCartQuantity: `
      UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ?;
    `,

  removeFromCart: `
      DELETE FROM cart WHERE user_id = ? AND product_id = ?;
    `,

  clearCart: `
    DELETE FROM cart WHERE user_id = ?;
    `

  
},

    order: {

    createOrder: `
    INSERT INTO orders 
    (user_id, total_amount, shipping_address, payment_method, payment_status, status, order_date)
    VALUES (?, ?, ?, ?, ?, ?, NOW());
  `,

  addOrderItem: `
    INSERT INTO order_items 
    (order_id, product_id, quantity, price)
    VALUES (?, ?, ?, ?);
  `,

    getOrderById: `
      SELECT * FROM orders 
      WHERE order_id = ?;
  `,

  getOrderItems: `
     SELECT 
        oi.order_item_id, 
        oi.product_id, 
        oi.quantity, 
        oi.price, 
        p.name, 
        p.selling_price,
        pi.image_url
    FROM order_items oi
    JOIN product p ON oi.product_id = p.id
    LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary_image = 1
    WHERE oi.order_id = ?;

   `,
 
  getOrdersByUser: `
    SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC;
  `,
  getOrdersByUser: `
      SELECT order_id, user_id, total_amount, shipping_address,
             payment_method, payment_status, status, order_date
      FROM orders
      WHERE user_id = ?
      ORDER BY order_date DESC;
    `

},

    stock: {
  reduceStock: `
    UPDATE product_stock SET stock_qty = stock_qty - ? 
    WHERE product_id = ? AND stock_qty >= ?;
  `,
  getStock: `SELECT stock_qty FROM product_stock WHERE product_id = ?;`
}


  
};
(module.exports = sqlqueries);
