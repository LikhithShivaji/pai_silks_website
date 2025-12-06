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
                    status_of_order: row.status,
                    shipping_address: row.shipping_address,
                    payment_method: row.payment_method,
                    payment_status: row.payment_status,
                    shipment_status: row.shipment_status,
                    amount: 0, // will sum later
                    product_list: []
                };
            }

            ordersMap[orderId].product_list.push({
                product_name: row.name,
                prod_id: row.product_id,
                quantity: row.quantity,
                price: row.price
            });

            ordersMap[orderId].amount = ordersMap[orderId].product_list.reduce(
                (sum, prod) => sum + prod.price * prod.quantity,
                0
            );
        });

        const result = Object.values(ordersMap);

        return result;

    } catch (error) {
        error.httpCode = error.httpCode || appConstants.HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
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