const dashboardDbOps = require('../../dbOps/adminDbOps');
const appConstants = require('../../constants/appConstants');

async function getOrderStats() {
    try {
        return await dashboardDbOps.getOrderStats();
    } catch (error) {
        error.httpCode = error.httpCode || appConstants.HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
        throw error;
    }
}

async function getBestSellers(limit) {
    try {
        // Passed through, not defaulted here — `undefined` lets the dbOp's own
        // default parameter apply, so the dashboard limit is defined in exactly
        // one place rather than being restated at every layer.
        return await dashboardDbOps.getBestSellers(limit);
    } catch (error) {
        error.httpCode = error.httpCode || appConstants.HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
        throw error;
    }
}

async function getRecentOrders() {
    try {
        return await dashboardDbOps.getRecentOrders();
    } catch (error) {
        error.httpCode = error.httpCode || appConstants.HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
        throw error;
    }
}

module.exports = {
    getOrderStats,
    getBestSellers,
    getRecentOrders
};
