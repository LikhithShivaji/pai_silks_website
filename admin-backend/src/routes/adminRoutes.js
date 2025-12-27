const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const upload = require('../middlewares/cloudinaryUpload')



router.post('/create-product', adminController.createProduct);

router.put(
  '/update-product',
  upload.array('images', 10),   // 👈 accept images here
  adminController.updateProduct
);

router.get('/get-order-stats', adminController.getOrderStats);

router.get('/get-bestSeller-list', adminController.getBestSellerList);

router.get('/get-recent-orders', adminController.getRecentOrders);

router.get('/get-category-count', adminController.getCategoryWiseCount);

router.get('/get-all-product-details', adminController.getAllProductDetails);

router.get('/get-order-detils',adminController.getOrderDetails);

router.put('/update-product', adminController.updateProduct);

router.put('/update-order-status', adminController.updateOrderStatus);


router.post("/insert-image",
upload.array("images", 5), // frontend key = "images"
  adminController.insertImage
);  

//Update product images
//router.put('/products/:id/images', upload.array('images', 10), adminController.updateProductImages);

module.exports = router;
