const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { loginLimiter, signupLimiter } = require('../middlewares/rateLimiters');


// Customer signup — 10 requests per IP per 15 min, limits bulk account
// creation. See CLAUDE.md CB-11.
router.post('/signup', signupLimiter, customerController.customerSignup);


// Customer login — 10 FAILED attempts per IP per 15 min. Successful logins are
// not counted, so normal use never locks anyone out. Also mitigates the bcrypt
// CPU-exhaustion DoS on the single Node thread. See CLAUDE.md CB-11.
router.post('/customer-login', loginLimiter, customerController.customerLogin);

// router.js
router.get('/get-user-details/:user_id', customerController.getUserDetails);


// To get the collection
router.get('/collections', customerController.getAllCollections);

//To get bestseller collections
router.get('/bestsellers', customerController.getBestSellers);

//To get the categories
router.get('/categories', customerController.getAllCategories);

//To get productbyID
router.get('/:productId', customerController.getProductById);

router.get('/products/new-releases', customerController.getNewReleaseProducts);

// get products by category
router.get('/products/:category', customerController.getProductsByCategory);



// add product to wishlistt and get roduct in the wish list and remove product from wish list
router.get('/wishlist/check-test', customerController.checkWishlist);
router.post('/wishlist/add', customerController.addToWishlist);
router.get('/wishlist/:user_id', customerController.getWishlist);
router.delete('/wishlist/remove', customerController.removeWishlist);
router.get('/wishlist/count/:user_id', customerController.wishlistCount);
router.post("/wishlist/move-to-cart", customerController.moveWishlistToCart);


router.get("/cart/cart-data", customerController.getCart);
router.post("/cart/update", customerController.updateCartQuantity);
router.delete("/cart/remove", customerController.removeFromCart);
router.post("/cart/add", customerController.addToCart);

// ORDER APIs
router.post('/orders/create', customerController.createOrder);
router.get('/order/:order_id', customerController.getOrderById);
router.get('/orders/user/:user_id', customerController.getOrdersByUser);
router.post('/order/add-item', customerController.addOrderItem);



module.exports = router;
