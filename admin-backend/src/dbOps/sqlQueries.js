const sqlqueries = {
    login: {
        // Named columns, not `SELECT *`. `pass` is included because this query
        // backs password verification; everything else the row carries is not.
        // The hash was never leaked (the login response hand-picks its fields),
        // so this is defence in depth. See CLAUDE.md AB-11b.
        getUserDetails: `
            SELECT user_id, user_name, pri_email, phone_number, address,
                   pass, role_id, is_delete
              FROM master_user
             WHERE pri_email = ?
        `,

        // Transparent bcrypt cost upgrade at login — see adminDbOps.
        updatePasswordHash: `UPDATE master_user SET pass = ? WHERE user_id = ?`,
        createNewSession: `INSERT INTO session (session_id, user_id, pri_email, token, status) VALUES (?,?,?,?,?)`,
        // `getSessionDetails`, `updateToken` and `updateSessionStatus` were
        // removed with the pre-Phase-2 session helpers that were their only
        // callers. See CLAUDE.md AB-30.
        //
        // Retained note from `updateToken` (still true, and worth keeping):
        // there is no `token_created_time` column in this database. AB-11
        // assumed it existed but was NULL; it does not exist at all. Not adding
        // it — from Phase 2 the JWT carries its own `exp` claim, so a separate
        // DB timestamp is redundant.

        // --- Phase 2 auth ---------------------------------------------------

        // Called by authMiddleware on EVERY authenticated request. Joins the
        // user so one query answers all of: is the session active, is it
        // unexpired, is the account soft-deleted, and what is the real role.
        //
        // Expiry is enforced in SQL rather than JS so clock skew or a missed
        // check cannot let a stale session through.
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

        // Active, unexpired sessions for a user, oldest first — used to enforce
        // the 2-device cap. Oldest first so the head of the list is evicted.
        //
        // Serialises concurrent logins for ONE user.
        //
        // The sequence read sessions -> evict oldest -> insert new is a
        // check-then-act race. Without a lock, concurrent logins all read the
        // same count, all conclude there is room, and all insert. Verified
        // empirically: SIX simultaneous logins produced FOUR active sessions
        // against a cap of two. See CLAUDE.md AB-15.
        //
        // The lock is taken on the MASTER_USER row, deliberately, not on the
        // session rows. `SELECT ... FOR UPDATE` on `session` locks only the
        // rows that match — so a user with zero active sessions has nothing to
        // lock and concurrent logins would slip straight through. The
        // master_user row always exists, so the lock is guaranteed.
        //
        // MUST be called inside a transaction. Outside one MySQL commits each
        // statement immediately and releases the lock, making it a no-op.
        lockUserForSessionUpdate: `
            SELECT user_id FROM master_user WHERE user_id = ? FOR UPDATE
        `,

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
        `
    },

    product: {
        insertProduct: `INSERT INTO product (name, description, category, collection, material, product_code, product_wash_care, regular_price, selling_price, saree_length, is_new_release) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        getCategoryWiseCount:  `SELECT p.category, COUNT(p.id) AS sari_count FROM product p WHERE p.is_deleted = 0 GROUP BY p.category`,
        getAllProductDetails: `SELECT p.id AS product_id, p.name, p.description, p.category, p.collection, p.material, p.product_code, p.product_wash_care, p.regular_price, p.selling_price, p.saree_length, p.is_new_release, ps.stock_qty, p.created_at, p.updated_at, pi.id AS image_id, pi.image_url, pi.is_primary_image FROM product p LEFT JOIN product_images pi ON p.id = pi.product_id LEFT JOIN product_stock ps ON p.id = ps.product_id WHERE p.is_deleted = 0`,
        // AND is_deleted = 0 — editing a soft-deleted product silently brought
        // it back to life: change its price and it was live on the storefront
        // again with nothing indicating it had been deleted. See CLAUDE.md
        // AB-12s.
        //
        // The caller MUST check affectedRows and 404 on 0. Without that this
        // repeats AB-13, where a guard existed but its result was never read,
        // so updating a nonexistent row reported success.
        updateProduct: `UPDATE product SET name = ?, description = ?, category = ?, collection = ?, material = ?, product_code = ?, product_wash_care = ?, regular_price = ?, selling_price = ?, saree_length = ?, is_new_release = ? WHERE id = ? AND is_deleted = 0`,
        insertImage: `INSERT INTO product_images (product_id, image_url, is_primary_image) VALUES ?`,
        // `resetPrimaryImageByImageId` removed with its only caller — see
        // CLAUDE.md AB-30 and the Deferred "set cover image" entry. It cleared
        // is_primary_image for every image of a product without setting a new
        // one, which would drop the product's picture from the storefront.
        getImagesByProductId: `SELECT * FROM product_images WHERE product_id = ?`,
        deleteImagesByProductId: `DELETE FROM product_images WHERE product_id = ?`,
        insertProductStock: `INSERT INTO product_stock (product_id, stock_qty) VALUES (?, ?)`,
        // REMOVED: updateProductStock — the absolute `SET stock_qty = ?`.
        // It was last-write-wins: two admins editing at once silently discarded
        // one of the changes with no error. Verified on real data before the
        // fix (A sets 100, B sets 200 -> 200, A's edit gone).
        //
        // Deleted rather than deprecated. It had no callers left once
        // productManager moved to CAS, and leaving an obvious-sounding
        // `updateProductStock` in place invites the next person to reach for it
        // and reintroduce the race. Use updateProductStockCAS.

        // Compare-and-swap: only apply if the stock is still what the admin saw.
        //
        // Replaces the absolute SET removed above, which was last-write-wins:
        // two admins editing at the same moment — A sets 100, B sets 200 —
        // silently ended at 200 with no error, and A never learned their change
        // was discarded. Demonstrated on real data. See CLAUDE.md AB-15b.
        //
        // stock_qty is the version token, so no schema change is needed.
        // `updated_at` was the obvious candidate but is a 1-second-resolution
        // TIMESTAMP: two edits inside the same second share a value, so it
        // cannot distinguish them. Verified before choosing this.
        //
        // Read affectedRows, NOT changedRows:
        //   matched, value changed -> affectedRows 1, changedRows 1  (applied)
        //   matched, same value    -> affectedRows 1, changedRows 0  (valid no-op)
        //   did not match          -> affectedRows 0                 (CONFLICT)
        // changedRows would report a legitimate no-op as a conflict.
        updateProductStockCAS: `
            UPDATE product_stock
               SET stock_qty = ?, updated_at = NOW()
             WHERE product_id = ? AND stock_qty = ?
        `,
        deleteProduct: `UPDATE product SET is_deleted = 1 WHERE id = ?`,
        addCategory: `INSERT INTO category (name) VALUES (?);`,
        getAllCategory: `SELECT id, name FROM category WHERE is_deleted = 0 ORDER BY name ASC;`,
        deleteCategory: `UPDATE category SET is_deleted = 1 WHERE id = ?;`,

        // How many live products carry this category's name.
        //
        // `product.category` is free text duplicating `category.name`
        // (AB-31/DB-06), so the link is by name, not by id. Matched on
        // LOWER(TRIM(...)) both sides because the two were populated
        // independently and casing cannot be assumed identical.
        countProductsInCategory: `
            SELECT COUNT(*) AS product_count
              FROM product
             WHERE is_deleted = 0
               AND LOWER(TRIM(category)) = LOWER(TRIM(?))
        `,

        // Soft-delete every live product in a category, in one statement.
        //
        // Soft, like deleteProduct — past orders reference product rows through
        // order_items, and hard deletion would break order history for a
        // customer who already bought one.
        softDeleteProductsInCategory: `
            UPDATE product
               SET is_deleted = 1
             WHERE is_deleted = 0
               AND LOWER(TRIM(category)) = LOWER(TRIM(?))
        `,

        getCategoryNameById: `SELECT name FROM category WHERE id = ? AND is_deleted = 0`,
    },

    dashBoard: {
        // Two bugs, both silent.
        //
        // 1. It counted SUM(status = 'Active'). 'Active' is not — and never was
        //    — one of the six statuses this system writes, so the admin's
        //    "Active Orders" card read 0 permanently. Verified with one order
        //    in each of the six states: 10 orders in the table, SQL reported 0
        //    active. Now driven by appDefines.ORDER_STATUS_ACTIVE via an IN
        //    list, so the enum is the single source of truth.
        //
        // 2. SUM() over zero rows returns NULL, not 0 — verified
        //    (SELECT SUM(status='Delivered') FROM orders WHERE 1=0 -> NULL).
        //    That matters at HANDOVER: the placeholder data gets wiped before
        //    the client takes over, so the very first dashboard they load has
        //    an empty orders table and would render null. COALESCE fixes it.
        //
        // The status list is bound as a single array parameter (mysql2 expands
        // `IN (?)` from an array), so this stays a bound query with no string
        // building.
        //
        // CAST(... AS UNSIGNED) because SUM() returns DECIMAL and mysql2 maps
        // DECIMAL to a STRING to avoid float precision loss. Without the cast
        // this endpoint returned {totalOrders: 4, activeOrders: "0"} — a number
        // and two strings in the same object, so `stats.active + 1` would have
        // produced "01". Counts are integers; money stays DECIMAL.
        // See CLAUDE.md AB-17 (a).
        // `completedOrders` binds a LIST now, not a single value.
        //
        // It was `SUM(status = ?)` against the one terminal status 'Delivered'.
        // With 'Cancelled' and 'Refunded' added as terminal states (2026-09-07),
        // an equality test would have counted them in NEITHER card: not active
        // (they are terminal) and not completed (they are not 'Delivered'). That
        // is precisely the AB-17 failure — orders vanishing from both totals —
        // so both halves are `IN (?)` and `active + completed = total` holds for
        // every status in the enum.
        getOrderStats: `
            SELECT COUNT(*) AS totalOrders,
                   CAST(COALESCE(SUM(status IN (?)), 0) AS UNSIGNED) AS activeOrders,
                   CAST(COALESCE(SUM(status IN (?)), 0) AS UNSIGNED) AS completedOrders
              FROM orders
        `,
        // p.is_deleted = 0 — a product removed from the catalogue should not
        // appear in a "best sellers" list the admin uses to decide what to
        // restock. The CLIENT's getBestSellers already filtered this; the two
        // disagreed. See CLAUDE.md AB-17b.
        //
        // Note this is the bestseller LIST, not order history: past orders for
        // a deleted product are still visible via getOrderItems, deliberately.
        // Adds, versus the original:
        //
        //   LIMIT          — a query named "best sellers" returned the ENTIRE
        //                    delivered catalogue, unbounded.
        //   primary image  — the dashboard needs a thumbnail. Without it the
        //                    admin panel had to fetch bestsellers from the
        //                    CLIENT backend instead, which is why the admin
        //                    dashboard depended on the storefront API being up.
        //   total_sold     — aliased to match what the UI already reads. The
        //                    old name was total_sales, which differed from the
        //                    client backend's field for the same concept.
        //
        // total_revenue is SUM(oi.price * oi.quantity) — the price actually
        // PAID, captured on the order line. The dashboard was instead computing
        // selling_price × quantity in the browser, i.e. today's price applied to
        // historical sales. Verified: dropping one saree from ₹1999 to ₹999
        // made the browser under-report that product by ₹11,000 with nothing
        // refunded. Money is computed here, in SQL, from what was charged.
        //
        // The image subquery (rather than a JOIN) keeps this one row per
        // product: a LEFT JOIN to product_images multiplies rows when a product
        // has more than one primary image, which is exactly the AB-16
        // double-count. Nothing enforces a single primary image.
        // See CLAUDE.md AB-17 (b).
        getBestSellers: `
            SELECT p.id,
                   p.name,
                   p.selling_price,
                   CAST(SUM(oi.quantity) AS UNSIGNED) AS total_sold,
                   SUM(oi.price * oi.quantity)        AS total_revenue,
                   (SELECT pi.image_url
                      FROM product_images pi
                     WHERE pi.product_id = p.id AND pi.is_primary_image = 1
                     LIMIT 1)                   AS primary_image
              FROM order_items oi
              JOIN product p  ON oi.product_id = p.id
              JOIN orders  o  ON oi.order_id   = o.order_id
             WHERE o.status = ? AND p.is_deleted = 0
             GROUP BY p.id, p.name, p.selling_price
             ORDER BY total_sold DESC
             LIMIT ?
        `,

        // Two fixes:
        //
        //   LIMIT      — "recent orders" returned every order ever placed.
        //   LEFT JOIN  — this was an INNER JOIN on master_user, so an order
        //                whose customer row was removed vanished entirely.
        //                That made the dashboard disagree with itself:
        //                getOrderStats counts orders directly, so the totals
        //                card and this list would report different numbers with
        //                no indication why. A missing customer now shows as
        //                NULL and the order stays visible.
        // See CLAUDE.md AB-17 (c).
        getRecentOrders: `
            SELECT o.order_id,
                   o.order_date,
                   o.status,
                   o.total_amount,
                   u.user_name AS customer_name
              FROM orders o
              LEFT JOIN master_user u ON o.user_id = u.user_id
             ORDER BY o.order_date DESC
             LIMIT ?
        `
    },

    orders: {
        // o.total_amount and o.shipping_fee are selected because the manager
        // must NOT recompute the order value by summing these rows.
        //
        // The joins below are not one-to-one: `shipments` and `product_images`
        // can each return multiple rows per order line. Two shipment rows means
        // every order_item appears twice, so a SUM over these rows doubles the
        // order — verified: order 10, real total ₹11,996, summed ₹23,992. It is
        // latent only because `shipments` is empty; it fires the day parcels
        // are recorded for DTDC / India Post.
        //
        // And even with no duplication the sum was already WRONG: it counts
        // only the line items, while the customer was charged line items plus
        // shipping. Verified on a real order — customer paid ₹4,099, the admin
        // panel showed ₹3,999. That one is live on every order placed since the
        // shipping fee was introduced. See CLAUDE.md AB-16.
        //
        // order_item_id is selected so the manager can de-duplicate the product
        // list by a stable key rather than by position.
        getAllOrderData: `SELECT
    o.order_id, o.order_date, o.status, o.shipping_address, o.payment_method,
    o.total_amount, o.shipping_fee, oi.order_item_id,
    -- Dispatch details (DB-09). Both NULL until the admin records them; the
    -- admin table shows them so staff can see at a glance which despatched
    -- orders are still missing tracking.
    o.carrier, o.consignment_number,
    o.payment_status, oi.product_id, oi.quantity, oi.price, s.shipment_status,
    mu.user_name,
    -- The order-detail page renders an Email line and it was always BLANK,
    -- because this query never selected one. Same shape as the contact-number
    -- gap below: the field existed in the UI and nothing supplied it. Reported
    -- by the owner from a real order, 2026-08-29. See CLAUDE.md AB-43.
    mu.pri_email AS customer_email,
    -- The "Contact Number" column in the admin order table rendered blank for
    -- every order, and the search box labelled "Search by phone number or order
    -- ID" could never match a phone, because no phone was ever selected here.
    -- See CLAUDE.md AB-42.
    --
    -- COALESCE order matters: the per-order delivery contact wins, because that
    -- is the number the customer gave for THIS parcel. The account phone is
    -- only the fallback, used for orders placed before migration 007 added
    -- contact_phone (all four existing orders) or where none was captured.
    COALESCE(o.contact_phone, mu.phone_number) AS contact_number,
    p.name as product_name,
    pi.image_url -- Select the image URL here
    FROM orders o
    -- LEFT, not INNER. An INNER JOIN dropped any order with no order_items
    -- rows from the result entirely, so such an order was INVISIBLE in the
    -- admin panel: the customer may have been charged, and the operator could
    -- not find the order to investigate.
    --
    -- These cannot be created any more — CB-06 wrapped checkout in a
    -- transaction, verified: a crash after the order row is written now rolls
    -- it back. But production still runs the pre-transaction code, so it may
    -- already hold some, and this is how they become visible.
    --
    -- Requires the nullish-coalescing guard on product_list in
    -- normalizeOrders: without it, surfacing one of these orders throws inside
    -- the promise chain and takes the ENTIRE order list down silently. Guards
    -- shipped first, in the same slice. See CLAUDE.md AF-C-FIX.
    --
    -- NOTE: no backticks in these comments. This is a JS template literal, so a
    -- backtick here silently TERMINATES the query string mid-statement — the
    -- file still parses, and MySQL then fails with a confusing
    -- "Unknown column 'oi.order_item_id'" because every JOIN below was cut off.
    LEFT JOIN order_items oi ON oi.order_id = o.order_id
    LEFT JOIN shipments s ON s.order_id = o.order_id 
    LEFT JOIN master_user mu ON mu.user_id = o.user_id 
    LEFT JOIN product p ON p.id = oi.product_id
    LEFT JOIN product_images pi ON pi.product_id = oi.product_id AND pi.is_primary_image = 1`,
        updateOrderStatus: `UPDATE orders SET status = ? WHERE order_id = ?`,

        // Status plus dispatch details in ONE statement.
        //
        // Separate queries would mean an order could end up marked Shipped with
        // no consignment number (or the reverse) if the second write failed —
        // and "Shipped with no tracking" is the exact dead end DB-09 exists to
        // remove. One UPDATE makes the pair atomic without needing a
        // transaction for two columns on one row.
        updateOrderDispatch: `
            UPDATE orders
               SET status = ?, carrier = ?, consignment_number = ?
             WHERE order_id = ?
        `,

        // Guards against scanning the right receipt into the wrong order.
        //
        // With a barcode scanner a typo is unlikely, but having order #53 open
        // while scanning #52's receipt is easy — and that failure is invisible:
        // both orders look tracked, one customer follows a stranger's parcel.
        // Excludes the order being updated so re-saving the same order with the
        // same number is not treated as a clash.
        findOrderByConsignment: `
            SELECT order_id
              FROM orders
             WHERE consignment_number = ?
               AND order_id <> ?
             LIMIT 1
        `
    }

};
(module.exports = sqlqueries);
