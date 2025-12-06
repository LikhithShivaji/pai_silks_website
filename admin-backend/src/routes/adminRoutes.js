const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

//used to create a product
router.post('/create-product', adminController.createProduct);

router.get('/get-order-stats', adminController.getOrderStats);

router.get('/get-bestSeller-list', adminController.getBestSellerList);

router.get('/get-recent-orders', adminController.getRecentOrders);

router.get('/get-category-count', adminController.getCategoryWiseCount);

router.get('/get-all-product-details', adminController.getAllProductDetails);

router.get('/get-order-detils',adminController.getOrderDetails);

router.put('/update-product', adminController.updateProduct);

router.put('/update-order-status', adminController.updateOrderStatus);

module.exports = router;
