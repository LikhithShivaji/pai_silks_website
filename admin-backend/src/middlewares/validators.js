const { body, param } = require('express-validator');
const appDefines = require('../constants/appDefines');

/**
 * express-validator rule sets for the admin API.
 *
 * Before Phase 3 the only check anywhere was `if (!name || !regular_price)`.
 * The price fields are plain text inputs on the frontend, so "abc" became
 * `Number("abc") || 0` — a product published at price ZERO — and "-500"
 * persisted as a negative price. Neither was ever compared against the other,
 * so selling_price could exceed regular_price. See CLAUDE.md AB-10c, AF-18.
 *
 * Limits mirror the real column widths so bad input is refused here with a
 * clear message rather than surfacing as a raw ER_DATA_TOO_LONG the client can
 * read:
 *   name              varchar(255)
 *   category          varchar(100)
 *   collection        varchar(100)
 *   material          varchar(100)
 *   product_code      varchar(50)
 *   product_wash_care varchar(255)
 *   saree_length      varchar(50)
 *   decimal(10,2)     -> max 99,999,999.99
 */

const MAX_DECIMAL_10_2 = 99999999.99;

/**
 * selling_price must not exceed regular_price.
 *
 * Written as a custom validator on the body rather than on one field, because
 * it is a relationship between two values. Both are optional on update, so it
 * only fires when both are actually present.
 */
const sellingNotAboveRegular = body().custom((_, { req }) => {
  const reg = req.body?.regular_price;
  const sell = req.body?.selling_price;
  if (reg === undefined || sell === undefined) return true;
  if (reg === null || sell === null || reg === '' || sell === '') return true;
  if (Number(sell) > Number(reg)) {
    throw new Error('Selling price cannot be higher than the regular price.');
  }
  return true;
});

/**
 * Prices must be GREATER THAN ZERO — not merely non-negative.
 *
 * `min: 0` allowed a price of exactly 0, and selling_price was `optional`, so a
 * product could be saved with no selling price at all. Product 49 in the local
 * catalogue is exactly that: regular_price 4999.00, selling_price NULL.
 *
 * A product with no price is not merely cosmetic. getCart aliases
 * `p.selling_price AS price`, so such a row reaches checkout with `price: null`
 * and the order path treats it as unbillable. Before CB-24b was fixed it was
 * silently dropped from the order and the whole cart was then cleared, so the
 * customer paid for a subset and lost the rest. See CLAUDE.md CB-24b-data.
 *
 * Owner decision, 2026-08-29: neither price may be null, empty or 0.
 *
 * MIN_PRICE is 0.01 rather than a bare `> 0` because the column is
 * DECIMAL(10,2) — anything smaller rounds to 0.00 on write, which would store
 * exactly the value this rule exists to reject.
 */
const MIN_PRICE = 0.01;

const priceRules = (field, label, { optional = false } = {}) => {
  let c = body(field);
  // `optional` now means "absent is fine on an update" — it does NOT mean an
  // empty string or 0 is acceptable. `values: 'undefined'` rather than
  // 'falsy' is what makes that distinction: '' and 0 are falsy and would
  // previously have skipped validation entirely.
  if (optional) c = c.optional({ values: 'undefined' });
  return c
    .exists({ checkNull: true })
    .withMessage(`${label} is required and cannot be empty.`)
    .bail()
    .isFloat({ min: MIN_PRICE, max: MAX_DECIMAL_10_2 })
    .withMessage(`${label} must be greater than 0.`)
    .toFloat();
};

const createProduct = [
  body('name')
    .trim()
    .notEmpty().withMessage('Product name is required.')
    .isLength({ max: 255 }).withMessage('Product name must be 255 characters or fewer.'),

  // Both required on create. selling_price was `optional`, which is how a
  // product could be created with no price at all and then sit in the catalogue
  // being unbuyable. See CLAUDE.md CB-24b-data.
  priceRules('regular_price', 'Regular price'),
  priceRules('selling_price', 'Selling price'),
  sellingNotAboveRegular,

  body('stock_qty')
    .optional({ values: 'falsy' })
    .isInt({ min: 0, max: 1000000 }).withMessage('Stock must be 0 or more.')
    .toInt(),

  body('category').optional({ values: 'falsy' }).trim()
    .isLength({ max: 100 }).withMessage('Category is too long.'),
  // REQUIRED, not optional: product.collection is NOT NULL with no default.
  // Marking it optional here meant an omitted collection reached the INSERT as
  // null and failed with ER_BAD_NULL_ERROR — surfacing to the admin as a
  // generic 500 with no indication of which field was wrong. Caught while
  // testing the createProduct transaction.
  body('collection')
    .trim()
    .notEmpty().withMessage('Collection is required.')
    .isLength({ max: 100 }).withMessage('Collection is too long.'),
  body('material').optional({ values: 'falsy' }).trim()
    .isLength({ max: 100 }).withMessage('Material is too long.'),
  body('product_code').optional({ values: 'falsy' }).trim()
    .isLength({ max: 50 }).withMessage('Product code is too long.'),
  body('product_wash_care').optional({ values: 'falsy' }).trim()
    .isLength({ max: 255 }).withMessage('Wash care text is too long.'),
  body('saree_length').optional({ values: 'falsy' }).trim()
    .isLength({ max: 50 }).withMessage('Saree length is too long.'),
  body('description').optional({ values: 'falsy' }).trim()
    .isLength({ max: 5000 }).withMessage('Description is too long.'),

  body('is_new_release').optional({ values: 'null' })
    .isIn([0, 1, '0', '1', true, false]).withMessage('Invalid new-release flag.'),
];

// Update carries an id and allows partial fields, but any field that IS present
// must still be valid — otherwise update becomes a way around create's rules.
const updateProduct = [
  body('id').isInt({ min: 1 }).withMessage('Invalid product id.').toInt(),

  body('name').optional({ values: 'falsy' }).trim()
    .isLength({ max: 255 }).withMessage('Product name must be 255 characters or fewer.'),

  priceRules('regular_price', 'Regular price', { optional: true }),
  priceRules('selling_price', 'Selling price', { optional: true }),
  sellingNotAboveRegular,

  body('stock_qty').optional({ values: 'falsy' })
    .isInt({ min: 0, max: 1000000 }).withMessage('Stock must be 0 or more.').toInt(),
];

// The enum is the whole point: `status` was written verbatim from the body, so
// a lowercase "delivered" would persist and silently break the dashboard's
// exact-string comparison. See AB-13.
const updateOrderStatus = [
  body('order_id')
    .isInt({ min: 1 }).withMessage('Invalid order id.').toInt(),
  body('status')
    .trim()
    .isIn(appDefines.ORDER_STATUSES)
    .withMessage(`Status must be one of: ${appDefines.ORDER_STATUSES.join(', ')}.`),
];

const addCategory = [
  body('name')
    .trim()
    .notEmpty().withMessage('Category name is required.')
    .isLength({ max: 250 }).withMessage('Category name must be 250 characters or fewer.'),
];

const idParam = [
  param('id').isInt({ min: 1 }).withMessage('Invalid id.').toInt(),
];

const insertImage = [
  body('product_id')
    .isInt({ min: 1 }).withMessage('Invalid product id.').toInt(),
];

module.exports = {
  createProduct,
  updateProduct,
  updateOrderStatus,
  addCategory,
  idParam,
  insertImage,
};
