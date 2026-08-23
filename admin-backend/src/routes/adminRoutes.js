const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const upload = require('../middlewares/cloudinaryUpload')
const authMiddleware = require('../middlewares/authMiddleware');
const requireAdmin = require('../middlewares/requireAdmin');

/**
 * EVERY route in this file requires an authenticated admin.
 *
 * Before Phase 2 all 15 were fully anonymous. `curl -X DELETE
 * .../api/delete-product/1` worked from anywhere, and GET /api/get-order-detils
 * dumped every customer's name, shipping address, payment method and payment
 * status to any caller on the internet. See CLAUDE.md AB-01, AB-08, C-2.
 *
 * Applied with router.use() rather than per-route so a newly added route is
 * protected BY DEFAULT. Listing middleware on each line invites the one
 * omission that reopens the hole.
 *
 * Note /api/admin-login is NOT here — it is mounted directly in server.js,
 * before this router, precisely because it must stay public.
 */

// Logout runs before requireAdmin: any authenticated user should be able to end
// their own session, even if their role would not grant panel access.
router.post('/logout', authMiddleware, adminController.logout);

// --- everything below requires an authenticated ADMIN ---------------------
router.use(authMiddleware, requireAdmin);

// Lets the panel ask the server whether the session is real, rather than
// trusting localStorage.admin_auth — which anyone can set in DevTools (AF-02).
router.get('/verify-token', adminController.verifyToken);

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

router.post('/addcategory', adminController.addCategory);
router.get('/getcategory', adminController.getAllCategories);
router.delete('/categories/:id', adminController.deleteCategory);

router.get('/get-all-product-details', adminController.getAllProductDetails);

router.get('/get-order-detils',adminController.getOrderDetails);

// REMOVED: a second `router.put('/update-product', ...)` was registered here
// without the upload middleware. Express matches the first registration, so it
// was unreachable dead code and a trap for anyone editing it. See AB-22.

router.put('/update-order-status', adminController.updateOrderStatus);


router.post("/insert-image",
upload.array("images", 5), // frontend key = "images"
  adminController.insertImage
);

router.delete('/delete-product/:id', adminController.deleteProduct);

//Update product images
//router.put('/products/:id/images', upload.array('images', 10), adminController.updateProductImages);

module.exports = router;
