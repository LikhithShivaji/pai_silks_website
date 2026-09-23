const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { loginLimiter, signupLimiter } = require('../middlewares/rateLimiters');
const authMiddleware = require('../middlewares/authMiddleware');
const { validate, rejectNonScalarBody } = require('../middlewares/validate');
const v = require('../middlewares/validators');

// Blanket guard: reject objects/arrays/NaN in any request body before it can
// reach a mysql2 placeholder and reshape the query. See CLAUDE.md CB-29.
router.use(rejectNonScalarBody);

/**
 * ROUTE ORDERING — read before adding anything.
 *
 * `GET /:productId` is a catch-all for any SINGLE path segment. Express matches
 * in registration order, so every single-segment GET must be declared ABOVE it.
 * Declaring one below makes it silently unreachable — that already happened
 * once with /verify-token, which returned "Product not found". See CB-39.
 *
 * AUTHENTICATION
 * Routes below are split into PUBLIC and PROTECTED. Protected routes carry
 * `authMiddleware`, which attaches req.user from the verified session.
 *
 * Handlers on protected routes MUST take the user's identity from req.user and
 * never from the body, params or query. Previously every one of these accepted
 * a client-supplied user_id, so anyone could read or modify any customer's
 * cart, wishlist, orders and profile by changing a number. IDs are sequential,
 * so all 25 customers could be scraped in 25 requests. See CB-02.
 *
 * That is also why the own-resource routes no longer take a :user_id segment —
 * removing the parameter makes the vulnerability unexpressible rather than
 * merely guarded.
 */

// ===========================================================================
// PUBLIC — no session required
// ===========================================================================

// Signup — 10 requests per IP per 15 min, limits bulk account creation (CB-11).
router.post('/signup', signupLimiter, v.signup, validate, customerController.customerSignup);

// Login — 10 FAILED attempts per IP per 15 min. Successful logins are not
// counted, so normal use never locks anyone out. Also mitigates the bcrypt
// CPU-exhaustion DoS on the single Node thread (CB-11).
router.post('/customer-login', loginLimiter, v.login, validate, customerController.customerLogin);

// Catalogue — genuinely public, no session needed.
//
// ⚠️ These are SINGLE-SEGMENT GETs, so they MUST stay above the /:productId
// catch-all further down. That trap has already fired twice (CB-39): a route
// declared below it returns {"success":false,"message":"Product not found"}
// instead of running, because ":productId" matches the literal word.
//
// /products is the storefront's whole catalogue. It exists because the shop
// previously fetched it from the ADMIN backend, which Phase 2 locked behind
// admin auth — so every customer would have got 401 and an empty shop page.
// See CLAUDE.md CF-22 and CONSTRAINT 5.
router.get('/products', customerController.getAllProducts);
router.get('/collections', customerController.getAllCollections);
router.get('/bestsellers', customerController.getBestSellers);
router.get('/categories', customerController.getAllCategories);
// Homepage tile strip — real categories with images (CF-35). Declared above the
// `/:productId` catch-all further down, like every other named GET here (CB-39).
router.get('/category-tiles', customerController.getCategoryTiles);

// ===========================================================================
// PROTECTED — single-segment, MUST stay above /:productId
// ===========================================================================

router.post('/logout', authMiddleware, customerController.logout);
router.get('/verify-token', authMiddleware, customerController.verifyToken);

// Replaces GET /get-user-details/:user_id. The caller can only ever read their
// own profile now — there is no parameter to tamper with.
router.get('/me', authMiddleware, customerController.getUserDetails);

// The write counterpart to /me. This route is NEW — MyProfile.jsx has called it
// since day one and always got a 404, so profile editing never worked. CF-06.
//
// Kept above the catch-all for consistency with its siblings even though the
// catch-all is GET-only and could not have shadowed a PUT. The next
// single-segment route added here may not be so lucky — see CB-39.
router.put('/update-profile', authMiddleware, v.updateProfile, validate, customerController.updateUserProfile);

// SINGLE-segment, so it must live above the catch-all. Its multi-segment
// siblings (/wishlist/add, /wishlist/count, ...) are declared further down and
// are unaffected — but this one is not. It returned "Product not found" until
// it was moved here. CB-39, twice in one phase.
router.get('/wishlist', authMiddleware, customerController.getWishlist);

// ===========================================================================
// ⚠️  CATCH-ALL — nothing single-segment may be declared below this line
// ===========================================================================
router.get('/:productId', v.productIdParam, validate, customerController.getProductById);

// ===========================================================================
// PUBLIC — multi-segment (unaffected by the catch-all)
// ===========================================================================

router.get('/products/new-releases', customerController.getNewReleaseProducts);
router.get('/products/:category', v.categoryParam, validate, customerController.getProductsByCategory);

// ===========================================================================
// PROTECTED — multi-segment
// ===========================================================================

// Wishlist. :user_id segments removed — the owner comes from the session.
router.get('/wishlist/check-test', authMiddleware, v.wishlistCheck, validate, customerController.checkWishlist);
router.get('/wishlist/count', authMiddleware, customerController.wishlistCount);
router.post('/wishlist/add', authMiddleware, v.productIdBody, validate, customerController.addToWishlist);
router.delete('/wishlist/remove', authMiddleware, v.productIdBody, validate, customerController.removeWishlist);
router.post('/wishlist/move-to-cart', authMiddleware, v.productIdBody, validate, customerController.moveWishlistToCart);
// NOTE: GET /wishlist itself is declared ABOVE the catch-all, not here.

// Cart. The ?user_id= query parameter is gone for the same reason.
router.get('/cart/cart-data', authMiddleware, customerController.getCart);
router.post('/cart/update', authMiddleware, v.cartUpdate, validate, customerController.updateCartQuantity);
router.delete('/cart/remove', authMiddleware, v.productIdBody, validate, customerController.removeFromCart);
router.post('/cart/add', authMiddleware, v.productIdBody, validate, customerController.addToCart);

// Orders.
router.post('/orders/create', authMiddleware, v.createOrder, validate, customerController.createOrder);
router.get('/orders/mine', authMiddleware, customerController.getOrdersByUser);

// :order_id has to stay — you are addressing a specific order — so the handler
// verifies the order actually belongs to req.user before returning it.
router.get('/order/:order_id', authMiddleware, v.orderIdParam, validate, customerController.getOrderById);

// REMOVED: POST /order/add-item
// It accepted { order_id, product_id, quantity, price } and inserted them
// verbatim — no ownership check, no product lookup, no stock reduction, and
// orders.total_amount was never recalculated. Anyone could attach any product
// to any order at any price. Order items are only ever created inside
// createOrder, which prices them from the product table. See CB-04.

module.exports = router;
