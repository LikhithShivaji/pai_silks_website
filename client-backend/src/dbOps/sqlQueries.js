const sqlqueries = {


   signup: {
  insertCustomer: `
    INSERT INTO master_user
    (user_name, pri_email, phone_number, address, city, state, pincode,
     pass, role_id, created, is_delete)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 0)
  `
},




    login: {
        // Columns are named, not `SELECT *`.
        //
        // `pass` IS included — this query backs password verification, so the
        // hash is genuinely needed here. What is no longer pulled is everything
        // else the row happens to carry. The hash was never leaked to a client
        // (verified: the login response hand-picks its fields), so this is
        // defence in depth: one careless `res.json(user)` in future would have
        // exposed every field this returned. See CLAUDE.md AB-11b.
        getUserDetails: `
            SELECT user_id, user_name, pri_email, phone_number, address,
                   pass, role_id, is_delete
              FROM master_user
             WHERE pri_email = ?
        `,

        // Transparent cost upgrade at login. CB-28 raised bcrypt to cost 12 for
        // NEW hashes only, leaving every pre-existing account at cost 10 — all
        // 22 of them, verified. See the rehash block in customerDbOps.
        updatePasswordHash: `UPDATE master_user SET pass = ? WHERE user_id = ?`,
        createNewSession: `INSERT INTO session (session_id, user_id, pri_email, token, status) VALUES (?,?,?,?,?)`,
        // `getSessionDetails`, `updateToken` and `updateSessionStatus` were
        // removed with the pre-Phase-2 session helpers that were their only
        // callers. See CLAUDE.md AB-30 (client twin).
        //
        // Retained note from `updateToken` (still true, and worth keeping):
        // there is no `token_created_time` column in this database. AB-11
        // assumed it existed but was NULL; it does not exist at all. Not adding
        // it — from Phase 2 the JWT carries its own `exp` claim, so a separate
        // DB timestamp is redundant.

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
                   s.login_date_time, u.role_id, u.is_delete,
                   -- Added so the greeting can come from the SERVER instead of
                   -- localStorage. The join to master_user already existed, so
                   -- this costs nothing extra. See CLAUDE.md CF-46.
                   u.user_name,
                   -- Also from the existing join: lets checkout prefill the
                   -- delivery phone for a FIRST-time customer, who has no
                   -- previous order to copy it from. See CLAUDE.md CF-09.
                   u.phone_number
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

        // NOTE: `getUserDetails` is NOT redefined here.
        //
        // It was declared twice inside this same `login` object — once at the
        // top and again at this position, with identical text. JavaScript keeps
        // the LAST definition silently, so the first was dead code that looked
        // live: editing it would have changed nothing, with no error to explain
        // why. See CLAUDE.md CB-16.
        getUserById: `
      SELECT user_id, user_name, pri_email, phone_number, address,
             city, state, pincode
      FROM master_user
      WHERE user_id = ?
    `,

        // Profile self-service update. Backs PUT /api/update-profile, which did
        // not exist at all until now — MyProfile.jsx called it, got a 404, and
        // tried to JSON.parse the HTML error body, so every save died on
        // "Network error". Customers could never change their phone or address.
        // See CLAUDE.md CF-06.
        //
        // The three editable columns are listed explicitly rather than built
        // from the request body. The frontend sends its whole `user` state
        // object, so a bound field list is what stops a spread payload from
        // reaching columns it has no business touching.
        //
        // pri_email is deliberately NOT updatable here:
        //   - it is the UNIQUE login identity, so a collision is a 500, and
        //   - session.pri_email is a DENORMALISED COPY, so changing one without
        //     the other silently rots every existing session row.
        // The UI already renders the email input as disabled. Changing an email
        // is the SEC-02b procedure — email + session cleanup in one transaction.
        //
        // is_delete = 0 so a soft-deleted account cannot edit itself back into
        // a usable state. The caller MUST check affectedRows and 404 on 0.
        updateUserProfile: `
      UPDATE master_user
         SET user_name = ?, phone_number = ?, address = ?,
             city = ?, state = ?, pincode = ?
       WHERE user_id = ? AND is_delete = 0
    `,
    },

    product: {
    
    getAllCollections: `
      SELECT DISTINCT collection 
      FROM product 
      WHERE is_deleted = 0 
      ORDER BY collection;
    `,

    // Categories for the homepage strip: from the CATEGORY TABLE, with images,
    // and only those that actually have something to show. See CF-35.
    //
    // The homepage tiles used to come from a hardcoded frontend file whose six
    // names matched nothing in the catalogue — every tile returned zero
    // products. Driving them from the table fixes that, but the table alone is
    // not enough either: a category with no live products would render a tile
    // leading to an empty shop, which is the same failure in a new place. The
    // EXISTS clause is what prevents that.
    //
    // Joined on NAME because product.category is free text duplicating
    // category.name (AB-31/DB-06), and LOWER(TRIM(...)) on both sides because
    // the two columns were populated independently.
    getCategoryTilesWithImages: `
      SELECT c.id, c.name, c.image_url
        FROM category c
       WHERE c.is_deleted = 0
         AND EXISTS (
               SELECT 1 FROM product p
                WHERE p.is_deleted = 0
                  -- Explicit COLLATE, and it is REQUIRED, not defensive.
                  --
                  -- The two columns carry different collations —
                  -- product.category is utf8mb4_0900_ai_ci and category.name is
                  -- utf8mb4_unicode_ci — so comparing them raises
                  -- ER_CANT_AGGREGATE_2COLLATIONS and the query fails outright
                  -- rather than returning wrong rows. The tables were created
                  -- at different times under different server defaults.
                  --
                  -- This only bites when comparing the two COLUMNS to each
                  -- other; comparing either against a bound PARAMETER takes the
                  -- connection's collation and works, which is why the category
                  -- delete-cascade queries (AB-31) never hit it.
                  AND LOWER(TRIM(p.category)) COLLATE utf8mb4_unicode_ci
                    = LOWER(TRIM(c.name))    COLLATE utf8mb4_unicode_ci
             )
       ORDER BY c.name ASC;
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
    -- in_stock, not stock_qty — public endpoint, see CF-22. The WHERE clause
    -- below already excludes anything out of stock, so this is always 1 here;
    -- it is kept for shape consistency with the other product endpoints.
    IFNULL(ps.stock_qty, 0) > 0 AS in_stock,
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
      -- Boolean, not the count. The other three public product endpoints were
      -- converted to in_stock (CF-22) on the grounds that how many sarees are
      -- in the back room is inventory data and whether one is buyable is not.
      -- This query was missed, so the single-product page was still handing the
      -- exact figure to every anonymous visitor.
      -- (No backticks in this comment: one would close the JS template literal
      --  this SQL lives inside and silently truncate the query.)
      IFNULL(ps.stock_qty, 0) > 0 AS in_stock,
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
      -- in_stock, not stock_qty: this is a PUBLIC endpoint and the exact count
      -- is inventory data. Nothing in the storefront reads a count. See CF-22.
      IFNULL(ps.stock_qty, 0) > 0 AS in_stock,
      pi.id AS image_id,
      pi.image_url,
      pi.is_primary_image
  FROM product p
  LEFT JOIN product_stock ps ON p.id = ps.product_id
  LEFT JOIN product_images pi ON p.id = pi.product_id
  WHERE p.category = ? AND p.is_deleted = 0
  ORDER BY p.name, pi.is_primary_image DESC;
    `,

// The full live catalogue, for the storefront's /shop page.
    //
    // This endpoint is NEW. The storefront had no client-side source for the
    // whole catalogue, so it fetched from the ADMIN backend's
    // get-all-product-details instead — see CLAUDE.md CF-22 and CONSTRAINT 5.
    // That worked only because the deployed admin backend has no auth (AB-01);
    // once Phase 2's authMiddleware ships, an anonymous customer gets 401 and
    // the shop renders empty.
    //
    // Columns are listed explicitly, never SELECT *. A customer receives what a
    // customer needs:
    //   - no stock_qty      -> `in_stock` boolean instead. The exact count is
    //                          inventory data; whether a saree can be bought is
    //                          not. Nothing in the storefront reads a count
    //                          (verified: zero occurrences), and a boolean is
    //                          what CF-20 needs to disable Add to Cart at zero.
    //   - no created_at / updated_at / is_deleted / is_new_release
    //
    // One row per image, grouped into an images[] array by the manager — same
    // shape as getProductsByCategory so both feed the same normaliser.
    // ORDER BY puts the primary image first, so images[0] is the card image.
    getAllProducts: `
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
          p.selling_price,
          p.saree_length,
          IFNULL(ps.stock_qty, 0) > 0 AS in_stock,
          pi.id               AS image_id,
          pi.image_url,
          pi.is_primary_image
      FROM product p
      LEFT JOIN product_stock  ps ON ps.product_id = p.id
      LEFT JOIN product_images pi ON pi.product_id = p.id
      WHERE p.is_deleted = 0
      ORDER BY p.name ASC, pi.is_primary_image DESC, pi.id ASC;
    `,

    // Was `SELECT *`, which had two problems:
    //
    //   1. It leaked is_deleted, created_at and updated_at to a PUBLIC endpoint
    //      (CLAUDE.md CB-35).
    //   2. It returned NO images at all. The homepage was therefore unable to
    //      use it and pulled the entire 35-product catalogue from the admin
    //      backend just to filter 7 new releases in the browser. Switching the
    //      homepage to this endpoint without adding images would have rendered
    //      seven products with blank pictures.
    //
    // Same column set and same image grouping as getAllProducts above, so both
    // feed the storefront's existing normaliser unchanged.
    getNewReleaseProducts: `
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
          p.selling_price,
          p.saree_length,
          IFNULL(ps.stock_qty, 0) > 0 AS in_stock,
          pi.id               AS image_id,
          pi.image_url,
          pi.is_primary_image
      FROM product p
      LEFT JOIN product_stock  ps ON ps.product_id = p.id
      LEFT JOIN product_images pi ON pi.product_id = p.id
      WHERE p.is_new_release = 1
        AND p.is_deleted = 0
      ORDER BY p.created_at DESC, pi.is_primary_image DESC, pi.id ASC;
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

    // Named columns, not `p.*`.
      //
      // Two problems, both verified live:
      //
      // 1. `p.*` leaked is_deleted, is_new_release, created_at and updated_at
      //    into the wishlist response — the same internal-column leak closed in
      //    getNewReleaseProducts (CB-35); this sibling was missed.
      //
      // 2. WishListProductItem.jsx renders `item.discounted_price`, which this
      //    query never returned, so every saved item showed "₹ undefined" for
      //    the whole session after login. The alias below is what the component
      //    actually reads; selling_price is kept alongside it because other
      //    call sites use that name. See CLAUDE.md CF-15.
      getWishlist: `
        SELECT
        w.wishlist_id,
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
        p.selling_price AS discounted_price,
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

    // contact_phone added by migrations/007_order_contact_phone.sql.
    //
    // The customer types a delivery number at checkout and Checkout.jsx has
    // always sent it as `phone_number` — but createOrder never read it and the
    // table had no column for it, so it was discarded on every order. The
    // shipping ADDRESS was stored per order while the contact PHONE for the
    // same parcel was thrown away. See CLAUDE.md AB-42 / CF-09.
    // shipping_fee added by migrations/008_order_shipping_fee.sql.
    //
    // The fee is part of total_amount and is ALSO stored on its own, so a
    // charge can be broken down after the fact. Deriving it as
    // total_amount - SUM(line items) works only while the total has exactly two
    // parts; a future discount or tax would be silently relabelled "shipping".
    // Razorpay reconciliation needs the exact breakdown. See CLAUDE.md AB-16.
    createOrder: `
    INSERT INTO orders
    (user_id, total_amount, shipping_fee, shipping_address, contact_phone, payment_method, payment_status, status, order_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW());
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
 
  // Defined once. There were two `getOrdersByUser` keys here: a `SELECT *` and
  // the explicit column list below. The explicit one won by being last, so the
  // SELECT * never ran despite sitting in the file looking authoritative.
  // See CLAUDE.md CB-16.
  getOrdersByUser: `
      SELECT order_id, user_id, total_amount, shipping_address,
             payment_method, payment_status, status, order_date,
             -- Dispatch details (DB-09). Both NULL until the admin records
             -- them. Listed explicitly rather than SELECT *, so a future column
             -- on \`orders\` is never silently exposed to customers — the lesson
             -- of CB-35 and CF-15, where p.* leaked is_deleted and internal
             -- timestamps into storefront responses.
             carrier, consignment_number
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
