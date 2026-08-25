const sqlqueries = {
    login: {
        getUserDetails: `SELECT * FROM master_user WHERE pri_email = ?`,
        getSessionDetails: `SELECT * FROM session WHERE pri_email = ? ORDER BY login_date_time DESC LIMIT 1`,
        createNewSession: `INSERT INTO session (session_id, user_id, pri_email, token, status) VALUES (?,?,?,?,?)`,
        // NOTE: there is no `token_created_time` column in this database —
        // adminAuthManager.js:29 reads it and always gets undefined, so
        // `now - new Date(undefined)` is NaN and the token-age check silently
        // never passes. AB-11 assumed the column existed but was NULL; it does
        // not exist at all.
        //
        // Not adding it: from Phase 2 the JWT carries its own `exp` claim, so a
        // separate DB timestamp is redundant. The renewal path that reads it is
        // replaced in Slice 5. See CLAUDE.md AB-11.
        updateToken: `UPDATE session SET token = ? WHERE sid = ?`,
        updateSessionStatus: `UPDATE session SET status = ?, logout_date_time = ? WHERE sid = ?`,

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
        resetPrimaryImageByImageId: `UPDATE product_images SET is_primary_image = 0 WHERE product_id = (SELECT product_id FROM product_images WHERE id = ?)`,
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
    },

    dashBoard: {
        getOrderStats: `SELECT COUNT(*) AS totalOrders, SUM(status = 'Active') AS activeOrders, SUM(status = 'Delivered') AS completedOrders FROM orders`,
        // p.is_deleted = 0 — a product removed from the catalogue should not
        // appear in a "best sellers" list the admin uses to decide what to
        // restock. The CLIENT's getBestSellers already filtered this; the two
        // disagreed. See CLAUDE.md AB-17b.
        //
        // Note this is the bestseller LIST, not order history: past orders for
        // a deleted product are still visible via getOrderItems, deliberately.
        getBestSellers: `SELECT p.id, p.name, p.selling_price, SUM(oi.quantity) AS total_sales, SUM(oi.price * oi.quantity) AS total_revenue FROM order_items oi JOIN product p ON oi.product_id = p.id JOIN orders o ON oi.order_id = o.order_id WHERE o.status = 'Delivered' AND p.is_deleted = 0 GROUP BY p.id, p.name, p.selling_price ORDER BY total_sales DESC`,
        getRecentOrders: `SELECT o.order_id, o.order_date, o.status, o.total_amount, u.user_name AS customer_name FROM orders o JOIN master_user u ON o.user_id = u.user_id ORDER BY o.order_date DESC`
    },

    orders: {
        getAllOrderData: `SELECT 
    o.order_id, o.order_date, o.status, o.shipping_address, o.payment_method, 
    o.payment_status, oi.product_id, oi.quantity, oi.price, s.shipment_status, 
    mu.user_name, p.name as product_name, 
    pi.image_url -- Select the image URL here
    FROM orders o 
    JOIN order_items oi ON oi.order_id = o.order_id 
    LEFT JOIN shipments s ON s.order_id = o.order_id 
    LEFT JOIN master_user mu ON mu.user_id = o.user_id 
    LEFT JOIN product p ON p.id = oi.product_id
    LEFT JOIN product_images pi ON pi.product_id = oi.product_id AND pi.is_primary_image = 1`,
        updateOrderStatus: `UPDATE orders SET status = ? WHERE order_id = ?`
    }   

};
(module.exports = sqlqueries);
