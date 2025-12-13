const adminAuthManager = require('../components/adminLoginManager/adminAuthManager');
const productManager = require('../components/productManager/productManager')
const adminLoginManager = require('../components/adminLoginManager/adminLoginManager');
const dashBoardManager = require('../components/dashBoardManager/dashBoardManager')
const orderManager = require('../components/orderManager/orderManager')
const utils = require('../utils/utils');
const appDefines = require('../constants/appDefines');
const CookiesKey = require('../constants/cookieKeys');
// adminController.js

// adminController.js
exports.adminLogin = async (req, res) => {
  const { pri_email, passwd } = req.body;
  const token = req.cookies[CookiesKey.token];
  const session_id = req.cookies[CookiesKey.session_id];

  // Step 0: Validate input
  if (!pri_email || !passwd) {
    return utils.handleMissingParams(
      res,
      'pri_email, passwd are missing',
      'msg.error.missingRequiredFields'
    );
  }

  try {
    // Step 1: Validate credentials and check session/token expiry
    const loginResult = await adminAuthManager.validateAdminLogin(
      pri_email,
      passwd,
      session_id,
      token
    );

    if (!loginResult.success) {
      return res.status(401).json({
        message: 'Invalid credentials',
        localeStr: 'msg.error.loginFailed'
      });
    }

    // Step 2: If valid session (still within 1 day)
    if (loginResult.validSession) {
      // If new token was generated, set it in cookies
      if (loginResult.token) {
        utils.setCookies(
          res,
          CookiesKey.token,
          loginResult.token,
          appDefines.expiryTime.tokenExpiryTime
        );
      }
      return res.status(200).json({
        message: 'Login successful',
        validSession: true,
        localeStr: 'msg.success.loginSuccess'
      });
    }

    // Step 3: If session expired or doesn't exist, create new session & token
    if (loginResult.createSession) {
      const result = await adminLoginManager.loginAdminUser(loginResult.userData);
      if (!result.success) {
        return res.status(500).json({
          message: 'Login failed',
          localeStr: 'msg.error.loginFailed'
        });
      }

      // Set cookies for the new session
      const cookieSettings = [
        {
          key: CookiesKey.session_id,
          value: result.session_id,
          expiryTime: appDefines.expiryTime.sessionExpiryTime
        },
        {
          key: CookiesKey.token,
          value: result.token,
          expiryTime: appDefines.expiryTime.tokenExpiryTime
        },
        {
          key: CookiesKey.role_id,
          value: result.role_id,
          expiryTime: appDefines.expiryTime.sessionExpiryTime
        },
        {
          key: CookiesKey.pri_email,
          value: result.pri_email,
          expiryTime: appDefines.expiryTime.sessionExpiryTime
        }
      ];

      cookieSettings.forEach(({ key, value, expiryTime }) => {
        if (value) {
          const calculatedExpiryTime =
            key === CookiesKey.token
              ? expiryTime
              : utils.convertDaysToMsec(expiryTime);
          utils.setCookies(res, key, value, calculatedExpiryTime);
        }
      });

      return res.status(200).json({
        sid: result.sid,
        message: 'Login successful',
        user_status_id: result.user_status_id,
        localeStr: 'msg.success.loginSuccess'
      });
    }

    // Fallback (should not reach here)
    return res.status(500).json({
      message: 'Unexpected login flow',
      localeStr: 'msg.error.loginFailed'
    });

  } catch (error) {
    return res.status(error.httpCode || 500).json({
      message: error.message || 'Login failed',
      localeStr: 'msg.error.loginFailed'
    });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const productData = req.body;
    const result = await productManager.createProduct(productData);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
    });
  } catch (error) {
    console.error("Error in createProduct Controller:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOrderStats = async (req, res) => {
  try {
    const result = await dashBoardManager.getOrderStats();
    return utils.sendResponse(res, result);
  } catch (error) {
    console.error("Error in getOrderStats:", error);
    return utils.sendError(res, error);
  }
};

exports.getBestSellerList = async (req, res) => {
  try {
    const result = await dashBoardManager.getBestSellers();
    return utils.sendResponse(res, result);
  } catch (error) {
    console.error("Error in getBestSellerList:", error);
    return utils.sendError(res, error);
  }
};

exports.getRecentOrders = async (req, res) => {
  try {
    const result = await dashBoardManager.getRecentOrders();
    return utils.sendResponse(res, result);
  } catch (error) {
    console.error("Error in getRecentOrders:", error);
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
    console.error("Error in getCategoryWiseCount Controller:", error);
    res.status(500).json({ success: false, message: error.message });
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
    console.error("Error in getAllProductDetails Controller:", error);
    res.status(500).json({ success: false, message: error.message });
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
    console.error("Error to get AllOrderDetails Controller:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const productData = req.body;
    const result = await productManager.updateProduct(productData);
    res.status(200).json({
      success: true,
      message: "Product updated successfully",
    });
  } catch (error) {
    console.error("Error in updateProduct Controller:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { order_id, status } = req.body;
    const result = await orderManager.updateOrderStatus(order_id, status);
    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
    });
  } catch (error) {
    console.error("Error in updateOrderStatus Controller:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};