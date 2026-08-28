const dbCmds = require('../../dbOps/adminDbOps');
const appConstants = require('../../constants/appConstants');

const getOrderDetails = async () => {
    try {
        const rows = await dbCmds.getAllOrderData();
        const ordersMap = {};

        rows.forEach(row => {
            const orderId = row.order_id;

            if (!ordersMap[orderId]) {
                ordersMap[orderId] = {
                    id: orderId,
                    date: row.order_date,
                    customer_name: row.user_name,
                    // Per-order delivery contact, falling back to the account
                    // phone for orders that predate migration 007. See AB-42.
                    contact_number: row.contact_number,
                    // Tracks which order_item rows have already been added, so
                    // a duplicated join row cannot add the same line twice.
                    _seenItems: new Set(),
                    status_of_order: row.status,
                    shipping_address: row.shipping_address,
                    payment_method: row.payment_method,
                    payment_status: row.payment_status,
                    shipment_status: row.shipment_status,
                    // Taken from the order row, NOT recomputed from the joined
                    // line items. See the note on getAllOrderData: re-summing
                    // double-counts whenever a non-1:1 join duplicates rows,
                    // and it silently omits the shipping fee even when it does
                    // not. This is the figure the customer was charged.
                    amount: Number(row.total_amount),
                    shipping_fee: Number(row.shipping_fee ?? 0),
                    product_list: []
                };
            }

            // De-duplicated by order_item_id. Two shipment rows (or two primary
            // images) repeat every line, which previously listed the same saree
            // twice on the order detail page. See CLAUDE.md AB-16.
            if (row.order_item_id != null && !ordersMap[orderId]._seenItems.has(row.order_item_id)) {
                ordersMap[orderId]._seenItems.add(row.order_item_id);
                ordersMap[orderId].product_list.push({
                    order_item_id: row.order_item_id,
                    product_name: row.product_name,
                    prod_id: row.product_id,
                    quantity: row.quantity,
                    price: row.price,
                    image_url: row.image_url
                });
            }
        });

        // Drop the internal de-duplication bookkeeping before returning — a Set
        // does not survive JSON.stringify as anything useful, and it is not part
        // of the API contract.
        return Object.values(ordersMap).map(({ _seenItems, ...order }) => order);
    } catch (error) {
        throw error;
    }
};

const updateOrderStatus = async (order_id, new_status) => {
    try {
        const result = await dbCmds.updateOrderStatus(order_id, new_status);
        return result;
    } catch (error) {
        error.httpCode = error.httpCode || appConstants.HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
        throw error;
    }
};

module.exports = {
    getOrderDetails,
    updateOrderStatus
}