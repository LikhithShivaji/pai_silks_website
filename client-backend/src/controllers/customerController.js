const customerAuthManager = require('../components/customerLoginManager/customerAuthManager');
const customerLoginManager = require('../components/customerLoginManager/customerLoginManager');
const utils = require('../utils/utils');
const appDefines = require('../constants/appDefines');
const CookiesKey = require('../constants/cookieKeys');
const productManager = require('../components/productManager/productManager')
const customerSignupManager = require('../components/customerLoginManager/customerSignupManager');
const bcrypt = require('bcrypt');

exports.customerSignup = async (req, res) => {
  try {
    const { user_name, pri_email, phone_number, address, password } = req.body;

    if (!user_name || !pri_email || !password || !phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await customerSignupManager.registerCustomer({
      user_name,
      pri_email,
      phone_number,
      address,
      hashedPassword,
    });

    return res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      data: result,
    });

  } catch (error) {
    console.error('Error in customerSignup:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Signup failed',
    });
  }
};





// customerController.js
exports.customerLogin = async (req, res) => {
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
    const loginResult = await customerAuthManager.validateCustomerLogin(
      pri_email,
      passwd,
      session_id,
      token
    );

    if (!loginResult.success) {
      return res.status(401).json({
        message: 'Invalid credentials',
        localeStr: 'msg.error.loginFailed',
      });
    }

    // Step 2: If valid session (still within 1 day)
    if (loginResult.validSession) {
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
        user_id: loginResult.userData.user_id,
        validSession: true,
        localeStr: 'msg.success.loginSuccess',
      });
    }

    // Step 3: If session expired or doesn't exist, create new session & token
    if (loginResult.createSession) {
      const result = await customerLoginManager.loginCustomerUser(
        loginResult.userData
      );

      if (!result.success) {
        return res.status(500).json({
          message: 'Login failed',
          localeStr: 'msg.error.loginFailed',
        });
      }

      // Set cookies for the new session
      const cookieSettings = [
        {
          key: CookiesKey.session_id,
          value: result.session_id,
          expiryTime: appDefines.expiryTime.sessionExpiryTime,
        },
        {
          key: CookiesKey.token,
          value: result.token,
          expiryTime: appDefines.expiryTime.tokenExpiryTime,
        },
        {
          key: CookiesKey.role_id,
          value: result.role_id,
          expiryTime: appDefines.expiryTime.sessionExpiryTime,
        },
        {
          key: CookiesKey.pri_email,
          value: result.pri_email,
          expiryTime: appDefines.expiryTime.sessionExpiryTime,
        },
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
        user_status_id: res.user_status_id,
        user_id: loginResult.userData.user_id,              // ✅ important for frontend
        pri_email: loginResult.userData.pri_email,
        localeStr: 'msg.success.loginSuccess',
      });
    }

    // Fallback
    return res.status(500).json({
      message: 'Unexpected login flow',
      localeStr: 'msg.error.loginFailed',
    });
  } catch (error) {
    return res.status(error.httpCode || 500).json({
      message: error.message || 'Login failed',
      localeStr: 'msg.error.loginFailed',
    });
  }
};


exports.getAllCollections = async (req, res) => {
  try {
    const collections = await productManager.getAllCollections();

    return res.status(200).json({
      success: true,
      data: collections,
      message: "Collections fetched successfully",
    });
  } catch (error) {
    console.error("Error in getAllCollections Controller:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch collections",
    });
  }
};


// ---------------------- GET BESTSELLERS ----------------------
exports.getBestSellers = async (req, res) => {
  try {
    const bestSellers = await productManager.getBestSellers();
    return res.status(200).json({
      success: true,
      data: bestSellers,
      message: 'Bestsellers fetched successfully',
    });
  } catch (error) {
    console.error('Error in getBestSellers Controller:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch bestsellers',
    });
  }
};

// ---------------------- GET ALL CATEGORIES ----------------------
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await productManager.getAllCategories();

    return res.status(200).json({
      success: true,
      data: categories,
      message: "Categories fetched successfully",
    });
  } catch (error) {
    console.error("Error in getAllCategories Controller:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch categories",
    });
  }
};


// ---------------------- GET PRODUCT BY ID ----------------------
exports.getProductById = async (req, res) => {
  try {
    const { productId } = req.params;

    // Call productManager to get product details with images
    const product = await productManager.getProductById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
      message: 'Product fetched successfully',
    });
  } catch (error) {
    console.error('Error in getProductById Controller:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch product',
    });
  }
};

// ---------------------- GET PRODUCT BY Category ----------------------

exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required"
      });
    }

    const products = await productManager.getProductsByCategory(category);

    return res.status(200).json({
      success: true,
      data: products,
      message: "Products fetched successfully"
    });
  } catch (error) {
    console.error("Error in getProductsByCategory Controller:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch products"
    });
  }
};

// ---------------------- GET NEW RELEASE PRODUCTS ----------------------

exports.getNewReleaseProducts = async (req, res) => {
  try {
    const products = await productManager.getNewReleaseProducts();

    return res.status(200).json({
      success: true,
      data: products,
      message: "New release products fetched successfully"
    });

  } catch (error) {
    console.error("Error in getNewReleaseProducts Controller:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch new release products"
    });
  }
};


// ====== ADD TO WISHLIST ======
exports.addToWishlist = async (req, res) => {
  const { user_id, product_id } = req.body;

  if (!user_id || !product_id) {
    return res.status(400).json({
      success: false,
      message: "user_id and product_id are required",
    });
  }

  try {
    const result = await productManager.addToWishlist(user_id, product_id);

    if (result.already) {
      return res.status(200).json({
        success: true,
        message: "Product already in wishlist",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Product added to wishlist",
    });

  } catch (error) {
    console.error("Error in addToWishlist controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add product to wishlist",
    });
  }
};

// ====== GET WISHLIST ITEMS ======
exports.getWishlist = async (req, res) => {
  try {
    const { user_id } = req.params;
    if (!user_id) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const wishlistItems = await productManager.getWishlist(user_id);

    return res.status(200).json({
      success: true,
      data: wishlistItems,
      message: "Wishlist fetched successfully",
    });
  } catch (err) {
    console.error("Error in getWishlist Controller:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch wishlist" });
  }
};


// ====== REMOVE FROM WISHLIST ======
exports.removeWishlist = async (req, res) => {
  const { user_id, product_id } = req.body;

  if (!user_id || !product_id) {
    return res.status(400).json({
      success: false,
      message: "user_id and product_id are required",
    });
  }

  try {
    await productManager.removeWishlist(user_id, product_id);
    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist",
    });

  } catch (error) {
    console.error("Error in removeWishlist controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove from wishlist",
    });
  }
};

exports.checkWishlist = async (req, res) => {
  try {

    const user_id = parseInt(req.query.user_id);
    const product_id = parseInt(req.query.product_id);

    if (!user_id || !product_id) {
      return res.status(400).json({
        success: false,
        message: "user_id and product_id are required",
      });
    }

    const result = await productManager.checkWishlist(user_id, product_id);


    res.status(200).json({
      success: true,
      exists: result.length > 0,
      data: result
    });
  } catch (err) {
    console.error("Error in checkWishlist:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.wishlistCount = async (req, res) => {
  try {
    const user_id = req.params.user_id;

    if (!user_id) {
      return res.status(400).json({ success: false, message: "user_id is required" });
    }

    const result = await productManager.wishlistCount(user_id);

    res.status(200).json({
      success: true,
      count: result.count,
    });
  } catch (err) {
    console.error("Error in wishlistCount:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};



exports.moveWishlistToCart = async (req, res) => {
  try {
    const { user_id, product_id } = req.body;

    if (!user_id || !product_id) {
      return res.status(400).json({
        success: false,
        message: "user_id and product_id are required",
      });
    }

    const result = await productManager.moveWishlistToCart(user_id, product_id);

    res.status(200).json({
      success: true,
      message: "Moved product from wishlist to cart",
      data: result
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};



exports.getCart = async (req, res) => {
  try {    
    const user_id = req.query.user_id;
    const cartItems = await productManager.getCart(user_id);

    return res.status(200).json({
      success: true,
      data: cartItems,
      message: "Cart fetched successfully"
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};



// PUT /api/cart/update
exports.updateCartQuantity = async (req, res) => {
  try {
    const { user_id, product_id, quantity } = req.body;
    const result = await productManager.updateCartQuantity(user_id, product_id, quantity);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/cart/remove
exports.removeFromCart = async (req, res) => {
  try {
    const { user_id, product_id } = req.body;
    const result = await productManager.removeFromCart(user_id, product_id);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


//addtocart

exports.addToCart = async (req, res) => {
  try {
    const { user_id, product_id } = req.body;

    if (!user_id || !product_id) {
      return res.status(400).json({
        success: false,
        message: "user_id and product_id are required"
      });
    }

    const result = await productManager.addToCart(user_id, product_id);

    return res.status(200).json({
      success: true,
      message: result.message
    });

  } catch (err) {
    console.error("Error in addToCart controller:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { user_id, shipping_address, payment_method, payment_status, status } = req.body;

    if (!user_id || !shipping_address || !payment_method) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // 1️⃣ Fetch cart
    const cartItems = await productManager.getCart(user_id);
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // 2️⃣ Map cart items & calculate total_amount
    const mappedItems = cartItems.map(item => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      return { product_id: Number(item.product_id), price, quantity };
    }).filter(item => item.price > 0 && item.quantity > 0);

    if (mappedItems.length === 0) {
      return res.status(400).json({ success: false, message: "No valid items in cart" });
    }

    const total_amount = mappedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // 3️⃣ Validate stock
    for (const item of mappedItems) {
      const stock = await productManager.getStock(item.product_id);
      if (stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for product_id ${item.product_id}` });
      }
    }

    // 4️⃣ Create order
    const order_id = await productManager.createOrder(
      user_id,
      total_amount,
      shipping_address,
      payment_method,
      payment_status,
      status
    );

    // 5️⃣ Add order items & reduce stock
    for (const item of mappedItems) {
      await productManager.addOrderItem(order_id, item.product_id, item.quantity, item.price);
      await productManager.reduceStock(item.product_id, item.quantity);
    }

    // 6️⃣ Clear cart
    await productManager.clearCart(user_id);

    return res.status(200).json({ success: true, message: "Order created successfully", order_id });

  } catch (err) {
    console.error("Error in createOrder:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};




exports.getOrderById = async (req, res) => {
  try {
    const order_id = req.params.order_id;

    if (!order_id) {
      return res.status(400).json({ success: false, message: "order_id is required" });
    }

    // 1️⃣ Get order details
    const order = await productManager.getOrderById(order_id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // 2️⃣ Get all items of this order
    const items = await productManager.getOrderItems(order_id);

    // 3️⃣ Return combined data
    return res.status(200).json({
      success: true,
      order,
      items
    });

  } catch (error) {
    console.error("Error in getOrderById:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOrdersByUser = async (req, res) => {
  try {
    const { user_id } = req.params;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Fetch orders for the user
    const orders = await productManager.getOrdersByUser(user_id);

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No orders found for this user"
      });
    }

    // Attach items to each order
    for (const order of orders) {
      const items = await productManager.getOrderItems(order.order_id);
      order.items = items;
    }

    return res.status(200).json({
      success: true,
      orders
    });

  } catch (err) {
    console.error("Error in getOrdersByUser:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.addOrderItem = async (req, res) => {
  try {
    const { order_id, product_id, quantity, price } = req.body;

    if (!order_id || !product_id || !quantity || !price) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Call productManager.addOrderItem which now returns result
    const result = await productManager.addOrderItem(order_id, product_id, quantity, price);

    return res.status(200).json({
      success: true,
      message: "Item added to order successfully",
      data: result, // contains insertId, order_id, product_id, quantity, price
    });

  } catch (err) {
    console.error("Error in addOrderItem:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
