const sqlqueries = {
    login: {
        getUserDetails: `SELECT * FROM master_user WHERE pri_email = ?`,
        getSessionDetails: `SELECT * FROM session WHERE pri_email = ? ORDER BY login_date_time DESC LIMIT 1`,
        createNewSession: `INSERT INTO session (session_id, user_id, pri_email, token, status) VALUES (?,?,?,?,?)`,
        updateToken: `UPDATE session SET token = ? WHERE sid = ?`,
        updateSessionStatus: `UPDATE session SET status = ?, logout_date_time = ? WHERE sid = ?`
    },

    product: {
        insertProduct: `INSERT INTO product (name, description, category, collection, material, product_code, product_wash_care, regular_price, selling_price, saree_length) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        getCategoryWiseCount:  `SELECT p.category, COUNT(p.id) AS sari_count FROM product p WHERE p.is_deleted = 0 GROUP BY p.category`,
        getAllProductDetails: `SELECT p.id AS product_id, p.name, p.description, p.category, p.collection, p.material, p.product_code, p.product_wash_care, p.regular_price, p.selling_price, p.saree_length, COALESCE(pi.image_url, '') AS image_url, ps.stock_qty, p.created_at, p.updated_at FROM product p LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary_image = 1 LEFT JOIN product_stock ps ON p.id = ps.product_id WHERE p.is_deleted = 0`,
        updateProduct: `UPDATE product SET name = ?, description = ?, category = ?, collection = ?, material = ?, product_code = ?, product_wash_care = ?, regular_price = ?, selling_price = ?, saree_length = ? WHERE id = ?`
    },

    dashBoard: {
        getOrderStats: `SELECT COUNT(*) AS totalOrders, SUM(status = 'Active') AS activeOrders, SUM(status = 'Delivered') AS completedOrders FROM orders`,
        getBestSellers: `SELECT p.id, p.name, p.selling_price, SUM(oi.quantity) AS total_sales, SUM(oi.price * oi.quantity) AS total_revenue FROM order_items oi JOIN product p ON oi.product_id = p.id JOIN orders o ON oi.order_id = o.order_id WHERE o.status = 'Delivered' GROUP BY p.id, p.name, p.selling_price ORDER BY total_sales DESC`,
        getRecentOrders: `SELECT o.order_id, o.order_date, o.status, o.total_amount, u.user_name AS customer_name FROM orders o JOIN master_user u ON o.user_id = u.user_id ORDER BY o.order_date DESC`
    },

    orders: {
        getAllOrderData: `SELECT o.order_id, o.order_date, o.user_id, o.status, o.shipping_address,o.payment_method,o.payment_status, oi.product_id, oi.quantity, oi.price, s.shipment_status, mu.user_name, mu.pri_email, p.name from orders o JOIN order_items oi ON oi.order_id = o.order_id LEFT JOIN shipments s ON s.order_id = o.order_id LEFT JOIN payments py ON py.order_id = o.order_id LEFT JOIN master_user mu ON mu.user_id = o.user_id LEFT JOIN product p ON p.id = oi.product_id`,
        updateOrderStatus: `UPDATE orders SET status = ? WHERE order_id = ?`
    }   

};
(module.exports = sqlqueries);
