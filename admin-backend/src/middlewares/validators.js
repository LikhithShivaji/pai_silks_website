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

const priceRules = (field, label, { optional = false } = {}) => {
  let c = body(field);
  if (optional) c = c.optional({ values: 'falsy' });
  return c
    .isFloat({ min: 0, max: MAX_DECIMAL_10_2 })
    .withMessage(`${label} must be a number between 0 and ${MAX_DECIMAL_10_2}.`)
    .toFloat();
};

const createProduct = [
  body('name')
    .trim()
    .notEmpty().withMessage('Product name is required.')
    .isLength({ max: 255 }).withMessage('Product name must be 255 characters or fewer.'),

  priceRules('regular_price', 'Regular price'),
  priceRules('selling_price', 'Selling price', { optional: true }),
  sellingNotAboveRegular,

  body('stock_qty')
    .optional({ values: 'falsy' })
    .isInt({ min: 0, max: 1000000 }).withMessage('Stock must be 0 or more.')
    .toInt(),

  body('category').optional({ values: 'falsy' }).trim()
    .isLength({ max: 100 }).withMessage('Category is too long.'),
  body('collection').optional({ values: 'falsy' }).trim()
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
