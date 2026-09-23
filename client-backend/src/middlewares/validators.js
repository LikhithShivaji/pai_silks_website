const { body, param, query } = require('express-validator');
const appDefines = require('../constants/appDefines');

/**
 * express-validator rule sets for the customer API.
 *
 * Before Phase 3 no handler validated anything beyond truthiness, so these all
 * got through: quantity -5, quantity 2147483647, a 1-character password, an
 * email of "x", a 500-character name that MySQL then rejected with a raw
 * ER_DATA_TOO_LONG, and objects/arrays that reshape the SQL. See CLAUDE.md
 * CB-17, CB-28, CB-29, CB-36.
 *
 * Limits mirror the actual column widths so a bad value is refused with a clear
 * message here rather than surfacing as a database error the client can read.
 *   user_name    varchar(50)
 *   pri_email    varchar(100)
 *   phone_number varchar(15)
 */

const { MIN_LENGTH: PW_MIN, MAX_BYTES: PW_MAX } = appDefines.password;

/**
 * Accepted phone numbers — India and the USA (owner, 2026-08-25).
 *
 * The storefront sends E.164 (`+91XXXXXXXXXX` / `+1XXXXXXXXXX`) built from an
 * explicit country dropdown, so the server can validate the country code
 * rather than guessing: "9876543210" is a valid national number in BOTH
 * countries, which is exactly why the dropdown exists.
 *
 * Legacy bare 10-digit values are still accepted — existing rows predate the
 * country selector and would otherwise fail on any profile update.
 *
 * Keep in sync with client-frontend/src/config/phone.js. This side is the
 * authority; the frontend rules are for immediate feedback only.
 */
const PHONE_PATTERNS = [
  /^\+91[6-9]\d{9}$/,            // India, E.164
  /^\+1[2-9]\d{2}[2-9]\d{6}$/,   // USA, E.164 (NANP)
  /^[6-9]\d{9}$/,                // legacy bare Indian number
];

const isAcceptedPhone = (value) => {
  const compact = String(value ?? '').replace(/[\s\-()]/g, '');
  return PHONE_PATTERNS.some((re) => re.test(compact));
};

const signup = [
  body('user_name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ max: 50 }).withMessage('Name must be 50 characters or fewer.'),

  body('pri_email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Enter a valid email address.')
    .isLength({ max: 100 }).withMessage('Email must be 100 characters or fewer.')
    // Lowercases the domain and trims. Deliberately NOT the aggressive gmail
    // dot/plus stripping — that silently rewrites what the user typed, and two
    // people who believe they have different addresses would collide on the
    // UNIQUE index with a confusing "already registered".
    .normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),

  body('phone_number')
    .trim()
    .notEmpty().withMessage('Phone number is required.')
    .isLength({ max: 20 }).withMessage('Phone number is too long.')
    .custom(isAcceptedPhone)
    .withMessage('Enter a valid India (+91) or USA (+1) phone number.'),

  // Address is REQUIRED at signup, and so are the three parts that make it
  // deliverable. It was `optional`, so accounts could exist with no address —
  // and then checkout had nothing to prefill and the customer retyped the whole
  // thing on every order. A courier cannot deliver to a street name alone.
  //
  // Existing rows are unaffected: this governs new signups only, which is
  // exactly why the columns are nullable in migration 012. Backfilling 22
  // customers with data nobody holds is not possible, and inventing it is worse
  // than leaving it absent.
  body('address')
    .trim()
    .notEmpty().withMessage('Address is required.')
    .isLength({ max: 500 }).withMessage('Address is too long.'),

  body('city')
    .trim()
    .notEmpty().withMessage('City is required.')
    .isLength({ max: 100 }).withMessage('City is too long.'),

  body('state')
    .trim()
    .notEmpty().withMessage('State is required.')
    .isLength({ max: 100 }).withMessage('State is too long.'),

  // Exactly six digits, not starting with 0 — the Indian PIN format. Kept as a
  // STRING all the way down: leading digits are significant and arithmetic on a
  // PIN is meaningless, so the column is VARCHAR and so is this.
  body('pincode')
    .trim()
    .notEmpty().withMessage('PIN code is required.')
    .matches(/^[1-9][0-9]{5}$/)
    .withMessage('Enter a valid 6-digit PIN code.'),

  // Length is enforced here AND in the handler. The handler check stays because
  // it guards bcrypt's silent 72-byte truncation, which is a correctness issue
  // rather than a validation preference. See CB-28.
  // `passwd`, matching both login endpoints. This was `password` while login
  // took `passwd` — one API, two names for the same field. See CLAUDE.md CB-40.
  body('passwd')
    .isString().withMessage('Password is required.')
    .isLength({ min: PW_MIN }).withMessage(`Password must be at least ${PW_MIN} characters.`)
    .custom((v) => Buffer.byteLength(v, 'utf8') <= PW_MAX)
    .withMessage(`Password must be ${PW_MAX} bytes or fewer.`),
];

const login = [
  body('pri_email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isLength({ max: 100 }).withMessage('Invalid credentials.'),
  // No format/length rules on the password at login: the stored hash may
  // predate the current policy, and a "password too short" response on a LOGIN
  // form tells an attacker their guess was the wrong shape rather than simply
  // wrong.
  body('passwd')
    .isString().withMessage('Password is required.')
    .notEmpty().withMessage('Password is required.'),
];

// Quantity: cart.quantity is a signed, nullable int(11) with no constraint, so
// -5, 0, null and 2147483647 were all accepted. A non-positive quantity is what
// triggers CB-24b — the item is silently dropped from the order and then the
// whole cart is cleared, so the customer pays for a subset and loses the rest.
const cartUpdate = [
  body('product_id')
    .isInt({ min: 1 }).withMessage('Invalid product.').toInt(),
  body('quantity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100.')
    .toInt(),
];

const productIdBody = [
  body('product_id')
    .isInt({ min: 1 }).withMessage('Invalid product.').toInt(),
];

const createOrder = [
  body('shipping_address')
    .trim()
    .notEmpty().withMessage('Shipping address is required.')
    .isLength({ max: 500 }).withMessage('Shipping address is too long.'),
  body('payment_method')
    .trim()
    .notEmpty().withMessage('Payment method is required.')
    .isLength({ max: 50 }).withMessage('Invalid payment method.'),

  // Delivery contact for this parcel — stored on the order by migration 007.
  //
  // Optional, not required: orders can be placed from paths that do not collect
  // a per-order number, and those fall back to the account phone when displayed
  // in the admin panel. But if one IS sent it must be a real number, using the
  // same isAcceptedPhone rule as signup and profile — three places accepting
  // three different formats is how a number becomes unusable for calling.
  body('phone_number')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 20 }).withMessage('Phone number is too long.')
    .custom(isAcceptedPhone)
    .withMessage('Enter a valid India (+91) or USA (+1) phone number.'),
];

const orderIdParam = [
  param('order_id').isInt({ min: 1 }).withMessage('Invalid order.').toInt(),
];

// product.id is an int. Without this, `/api/1abc` returned product 1 (MySQL
// coerces on comparison) and `/api/anything` did a full-table comparison before
// 404ing. See CB-36.
const productIdParam = [
  param('productId').isInt({ min: 1 }).withMessage('Invalid product.').toInt(),
];

const categoryParam = [
  param('category')
    .trim()
    .notEmpty().withMessage('Category is required.')
    .isLength({ max: 100 }).withMessage('Invalid category.'),
];

// PUT /api/update-profile. Backs CF-06.
//
// Field names are the FRONTEND's (name/phone/address), not the column names —
// this validates the request body, and MyProfile.jsx has always used these
// keys. The controller maps them to columns.
//
// Same phone rule as signup, via the shared isAcceptedPhone: if the two ever
// disagreed, a number accepted at signup could become unsaveable on the
// profile page, which is precisely the kind of split-brain rule nobody finds
// until a customer reports it.
//
// Deliberately no `pri_email` / `email` rule: email is not updatable here. The
// UI disables the input, and the column is UNIQUE with a denormalised copy in
// session.pri_email. Adding it later means the SEC-02b procedure, not a rule.
const updateProfile = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ max: 50 }).withMessage('Name must be 50 characters or fewer.'),

  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required.')
    .isLength({ max: 20 }).withMessage('Phone number is too long.')
    .custom(isAcceptedPhone)
    .withMessage('Enter a valid India (+91) or USA (+1) phone number.'),

  // Optional because address is nullable, and a customer who has not set one
  // must still be able to save a name or phone change.
  //
  // Note this differs DELIBERATELY from signup, where all four are required:
  // signup governs new rows, this governs the 22 existing customers who predate
  // migration 012 and hold none of these values. Forcing them here would lock
  // every one of them out of editing their own name until they filled in an
  // address they may not want to give.
  body('address')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 }).withMessage('Address is too long.'),

  body('city')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 }).withMessage('City is too long.'),

  body('state')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 }).withMessage('State is too long.'),

  body('pincode')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[1-9][0-9]{5}$/)
    .withMessage('Enter a valid 6-digit PIN code.'),
];

// Header product search. `q` is optional — the controller answers an empty
// term with an empty list rather than an error, because a customer clearing the
// box is not a fault. The cap matches the column widths being searched; a
// 500-character "search term" is not a search.
const productSearch = [
  query('q')
    .optional({ values: 'falsy' })
    .isLength({ max: 100 }).withMessage('Search term is too long.')
    .trim(),
];

const wishlistCheck = [
  query('product_id')
    .isInt({ min: 1 }).withMessage('Invalid product.').toInt(),
];

module.exports = {
  signup,
  login,
  cartUpdate,
  productIdBody,
  createOrder,
  orderIdParam,
  productIdParam,
  categoryParam,
  wishlistCheck,
  productSearch,
  updateProfile,
};
