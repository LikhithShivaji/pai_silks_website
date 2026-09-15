const adminAuthManager = require('../components/adminLoginManager/adminAuthManager');
const productManager = require('../components/productManager/productManager')
const adminLoginManager = require('../components/adminLoginManager/adminLoginManager');
const dashBoardManager = require('../components/dashBoardManager/dashBoardManager')
const orderManager = require('../components/orderManager/orderManager')
const utils = require('../utils/utils');
const appDefines = require('../constants/appDefines');
const CookiesKey = require('../constants/cookieKeys');
const admindb = require('../dbOps/adminDbOps'); // adjust path if needed
const { sanitizeError, describeDuplicate } = require('../utils/safeError');

// adminController.js

// adminController.js
exports.adminLogin = async (req, res, next) => {
  const { pri_email, passwd } = req.body;

  if (!pri_email || !passwd) {
    return utils.handleMissingParams(
      res,
      'pri_email, passwd are missing',
      'msg.error.missingRequiredFields'
    );
  }

  try {
    // Step 1: credentials only. Session handling is no longer entangled with
    // credential checking — see the note in adminAuthManager.
    const loginResult = await adminAuthManager.validateAdminLogin(
      pri_email,
      passwd
    );

    if (!loginResult.success) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        localeStr: 'msg.error.loginFailed'
      });
    }

    // Step 2: ALWAYS create a fresh session.
    //
    // The old flow had a "valid session already exists" branch that returned
    // `{ validSession: true }` while setting no session_id cookie — so a second
    // device was told "Login successful" and handed nothing to authenticate
    // with (AB-28).
    //
    // It also caused AF-16: the frontend gated on `data.validSession`, which
    // only appeared on that branch. A genuine FIRST login fell through to the
    // failure path and alerted "Login successful" as an error, so the admin had
    // to click LOGIN twice. Returning a consistent shape fixes both ends.
    const result = await adminLoginManager.loginAdminUser(loginResult.userData);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Login failed',
        localeStr: 'msg.error.loginFailed'
      });
    }

    // Two cookies, not four. Both share the session lifetime; the token is the
    // JWT and carries its own matching `exp`.
    //
    // role_id and pri_email are NO LONGER SET — both were httpOnly and read by
    // nothing (verified by grep across both backends), so they only advertised
    // this account's privilege level on every request. On the admin side that
    // is worse: a cookie announcing role_id=0 marks the request as the
    // administrator's. requireAdmin reads the role from the database row, never
    // from a cookie (AB-08). Logout still CLEARS both names so anyone holding
    // them from an older session has them removed. See CLAUDE.md CB-09.
    const cookieSettings = [
      { key: CookiesKey.session_id, value: result.session_id },
      { key: CookiesKey.token, value: result.token },
    ];

    cookieSettings.forEach(({ key, value }) => {
      if (value !== undefined && value !== null) {
        utils.setCookies(
          res,
          key,
          value,
          appDefines.expiryTime.sessionExpiryTime
        );
      }
    });

    // `sid` (the session table's auto-increment PK) is no longer returned — it
    // exposed internal DB structure for no client benefit (AB-26).
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        user_id: loginResult.userData.user_id,
        pri_email: loginResult.userData.pri_email,
        role_id: loginResult.userData.role_id
      },
      localeStr: 'msg.success.loginSuccess'
    });
  } catch (error) {
    return next(error);
  }
};


exports.insertImage = async (req, res) => {
  try {
    const { product_id } = req.body;

    if (!product_id || !req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product ID and images are required"
      });
    }

    // Extract Cloudinary URLs
    const images = req.files.map((file, index) => ({
      image_url: file.path,   // ✅ Cloudinary URL
      is_primary_image: index === 0 ? 1 : 0
    }));

    await productManager.insertImages(product_id, images);

    res.status(200).json({
      success: true,
      message: "Images uploaded successfully",
      images
    });
  } catch (error) {
    console.error("Insert Image Error:", sanitizeError(error));
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const productData = req.body;
    const productId = await productManager.createProduct(productData);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product_id: productId
    });

  } catch (error) {
    // product.product_code is UNIQUE. Without this branch a duplicate code
    // surfaced as a generic 500, leaving the admin no way to know which field
    // was wrong. Found by auditing every UNIQUE index against its write path.
    // See CLAUDE.md AB-10c.
    const duplicate = describeDuplicate(error);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: duplicate.message,
        field: duplicate.field,
      });
    }

    console.error("Error in createProduct Controller:", sanitizeError(error));
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

exports.getOrderStats = async (req, res) => {
  try {
    const result = await dashBoardManager.getOrderStats();
    return utils.sendResponse(res, result);
  } catch (error) {
    console.error("Error in getOrderStats:", sanitizeError(error));
    return utils.sendError(res, error);
  }
};

exports.getBestSellerList = async (req, res) => {
  try {
    const result = await dashBoardManager.getBestSellers();
    return utils.sendResponse(res, result);
  } catch (error) {
    console.error("Error in getBestSellerList:", sanitizeError(error));
    return utils.sendError(res, error);
  }
};

exports.getRecentOrders = async (req, res) => {
  try {
    const result = await dashBoardManager.getRecentOrders();
    return utils.sendResponse(res, result);
  } catch (error) {
    console.error("Error in getRecentOrders:", sanitizeError(error));
    return utils.sendError(res, error);
  }
};

exports.getCategoryWiseCount = async (req, res) => {
  try {
    const result = await productManager.getCategoryWiseCount();
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error in getCategoryWiseCount Controller:", sanitizeError(error));
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

exports.getAllProductDetails = async (req, res) => {
  try {
    const result = await productManager.getAllProductDetails();
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error in getAllProductDetails Controller:", sanitizeError(error));
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const result = await orderManager.getOrderDetails();
    res.status(200).json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error("Error to get AllOrderDetails Controller:", sanitizeError(error));
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const productData = req.body;
    const files = req.files || [];

    await productManager.updateProduct(productData, files);

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
    });
  } catch (error) {
    // Same UNIQUE constraint as createProduct, reached by a different path:
    // editing a product to use a product_code another product already has.
    // Missed on the first pass — createProduct and addCategory were handled but
    // this was not, so the admin got a generic 500 with no idea which field
    // clashed. See CLAUDE.md AB-10c.
    const duplicate = describeDuplicate(error);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: duplicate.message,
        field: duplicate.field,
      });
    }

    // Deliberate, admin-facing failures: 404 product missing/deleted (AB-12s),
    // 409 concurrent-edit conflict (AB-15b), 400 missing expected_stock_qty.
    // These carry a message written FOR the admin, so pass it through rather
    // than flattening it to the generic text.
    if ([400, 404, 409].includes(error.statusCode)) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Error in updateProduct Controller:", sanitizeError(error));
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    // All four fields are validated upstream: order_id is a positive integer,
    // status is one of appDefines.ORDER_STATUSES, carrier is one of
    // appDefines.CARRIERS, and consignment_number is normalised, length- and
    // charset-checked. The validator also enforces that carrier and
    // consignment_number arrive together, and that a dispatched status carries
    // both. See AB-13 and DB-09.
    const { order_id, status, carrier, consignment_number } = req.body;

    // Refuse a consignment number already recorded against a different order.
    //
    // With a barcode scanner a mistyped number is unlikely; scanning the RIGHT
    // receipt while the WRONG order is open is not. That failure is silent —
    // both orders look tracked, and one customer follows a stranger's parcel
    // all the way to someone else's door. Checked before writing anything.
    if (consignment_number) {
      const clash = await orderManager.findOrderByConsignment(
        consignment_number,
        order_id
      );
      if (clash) {
        return res.status(409).json({
          success: false,
          message:
            `Consignment number ${consignment_number} is already recorded ` +
            `against order ${clash}. Check you have the right receipt.`,
        });
      }
    }

    // One statement for status + dispatch details when tracking is supplied, so
    // an order cannot end up Shipped-with-no-number if a second write failed.
    // Plain status update otherwise — a status change with no dispatch details
    // must not blank the tracking already on the order.
    const affectedRows = consignment_number
      ? await orderManager.updateOrderDispatch(
          order_id,
          status,
          carrier,
          consignment_number
        )
      : await orderManager.updateOrderStatus(order_id, status);

    // Previously this always returned 200, even for an order id that does not
    // exist — the affectedRows guard in the dbOp was dead code because the
    // mysql2 result was never destructured. An admin could "update" order
    // 99999 and be told it worked.
    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: `No order found with id ${order_id}.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order_id,
      status,
      // Echoed back so the admin UI can render what was actually stored rather
      // than what it hoped was stored — the number is normalised (trimmed and
      // upper-cased) during validation, so the saved value may differ from what
      // was scanned or typed.
      carrier: carrier ?? null,
      consignment_number: consignment_number ?? null,
    });
  } catch (error) {
    return next(error);
  }
};

// REMOVED: updateProductImages — see productManager, AB-10 / AB-30.
// Unrouted, and it called the deleted updateImages helper.

exports.deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is required" });
    }

    await productManager.deleteProduct(productId);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully"
    });

  } catch (error) {
    console.error("Error in deleteProduct Controller:", sanitizeError(error));
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};


exports.addCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Category name is required" });

    const newCategory = await productManager.addCategory(name);
    return res.status(201).json({ success: true, data: newCategory, message: "Category added successfully" });
  } catch (error) {
    // category.name is UNIQUE. Adding an existing category previously returned
    // a generic 500 instead of saying it already exists. See AB-10c.
    const duplicate = describeDuplicate(error);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: duplicate.message,
        field: duplicate.field,
      });
    }

    console.error("Error in addCategory Controller:", sanitizeError(error));
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await productManager.getAllCategories();
    return res.status(200).json({ success: true, data: categories });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};


exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params; // Gets the ID from the URL

    if (!id) {
      return res.status(400).json({ success: false, message: "Category ID is required" });
    }

    await productManager.deleteCategoryById(id);

    return res.status(200).json({
      success: true,
      message: `Category with ID ${id} deleted successfully`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

// ---------------------------------------------------------------------------
// Phase 2 auth endpoints
// ---------------------------------------------------------------------------

const dbCmds = require('../dbOps/adminDbOps');

/**
 * POST /api/logout
 *
 * There was previously no logout endpoint. SESSION_LOGOUT was written in
 * exactly one place — the *expiry* branch of login — so a session could only
 * end by ageing out, and the Logout button in the admin UI had no onClick at
 * all (AF-06). See CLAUDE.md AB-07.
 *
 * Requires authMiddleware: revoking a session needs to know whose it is, and
 * the scoped UPDATE means one account can never log another out.
 */
exports.logout = async (req, res, next) => {
  try {
    await dbCmds.logoutSessionBySessionId(
      req.user.session_id,
      req.user.user_id,
      appDefines.SESSION_STATES.SESSION_LOGOUT
    );

    // Clear cookies with the SAME attributes they were set with. A mismatch on
    // path or sameSite leaves the browser holding a stale cookie.
    const isProduction = process.env.NODE_ENV === 'production';
    const clearOpts = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
    };
    [CookiesKey.token, CookiesKey.session_id, CookiesKey.role_id, CookiesKey.pri_email]
      .forEach((key) => res.clearCookie(key, clearOpts));

    return res.status(200).json({ success: true, message: 'Logged out.' });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/verify-token
 *
 * Lets the admin panel ask the server whether the session is real, instead of
 * trusting `localStorage.admin_auth` — which anyone can set in DevTools
 * (AF-02). Reaching this handler at all means authMiddleware passed.
 */
exports.verifyToken = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      user_id: req.user.user_id,
      pri_email: req.user.pri_email,
      role_id: req.user.role_id,
    },
  });
};


