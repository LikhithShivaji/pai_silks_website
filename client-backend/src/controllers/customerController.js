const customerAuthManager = require('../components/customerLoginManager/customerAuthManager');
const customerLoginManager = require('../components/customerLoginManager/customerLoginManager');
const utils = require('../utils/utils');
const appDefines = require('../constants/appDefines');
const CookiesKey = require('../constants/cookieKeys');
const productManager = require('../components/productManager/productManager')
const customerSignupManager = require('../components/customerLoginManager/customerSignupManager');
const bcrypt = require('bcrypt');
const { sanitizeError } = require('../utils/safeError');
const { withTransaction } = require('../dbOps/withTransaction');

exports.customerSignup = async (req, res) => {
  try {
    // Field is `passwd`, not `password`.
    //
    // Signup used to accept `password` while BOTH login endpoints (customer and
    // admin) accept `passwd`. Same concept, two names, on adjacent endpoints of
    // the same API — an integrator posting the signup shape to login got a
    // "Password is required." 400 with a correct password. Standardised on
    // `passwd`: it was already 2 of the 3 auth endpoints and it matches the
    // abbreviated `pri_email` convention used throughout. See CLAUDE.md CB-40.
    const { user_name, pri_email, phone_number, address, city, state, pincode, passwd } =
      req.body;

    // Address is now required, and so are the three parts that make it
    // deliverable. It used to be optional, so an account could exist with no
    // address at all — and then checkout had nothing to prefill and the
    // customer retyped it on every order. A saree cannot be posted to a street
    // name alone: a courier needs city, state and PIN.
    if (!user_name || !pri_email || !passwd || !phone_number ||
        !address || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Password policy. Previously the only check was `!passwd`, so "a" was a
    // valid password. See CLAUDE.md CB-28.
    const { MIN_LENGTH, MAX_BYTES, BCRYPT_COST } = appDefines.password;

    if (typeof passwd !== 'string' || passwd.length < MIN_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${MIN_LENGTH} characters.`,
      });
    }

    // bcrypt silently truncates past 72 BYTES. Rejecting is honest; accepting
    // and ignoring the remainder would give the user false confidence.
    if (Buffer.byteLength(passwd, 'utf8') > MAX_BYTES) {
      return res.status(400).json({
        success: false,
        message: `Password is too long (maximum ${MAX_BYTES} bytes).`,
      });
    }

    const hashedPassword = await bcrypt.hash(passwd, BCRYPT_COST);

    const result = await customerSignupManager.registerCustomer({
      user_name,
      pri_email,
      phone_number,
      address,
      city,
      state,
      pincode,
      hashedPassword,
    });

    return res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      data: result,
    });

  } catch (error) {
    console.error('Error in customerSignup:', sanitizeError(error));

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
exports.customerLogin = async (req, res, next) => {
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
    // credential checking — see the note in customerAuthManager.
    const loginResult = await customerAuthManager.validateCustomerLogin(
      pri_email,
      passwd
    );

    if (!loginResult.success) {
      return res.status(401).json({
        message: 'Invalid credentials',
        localeStr: 'msg.error.loginFailed',
      });
    }

    // Step 2: ALWAYS create a fresh session.
    //
    // Every login is a device. The old flow had a "valid session already
    // exists" branch that returned success while setting no session_id cookie
    // at all — so a second device was told "Login successful" and handed
    // nothing to authenticate with. Creating a session unconditionally is what
    // makes the 2-device policy work; the cap and eviction are enforced inside
    // loginCustomerUser. See CLAUDE.md CB-30.
    const result = await customerLoginManager.loginCustomerUser(
      loginResult.userData
    );

    if (!result.success) {
      return res.status(500).json({
        message: 'Login failed',
        localeStr: 'msg.error.loginFailed',
      });
    }

    // Two cookies, not four. Both share the session lifetime; the token is the
    // JWT and carries its own matching `exp` (see appDefines).
    //
    // role_id and pri_email are NO LONGER SET. They were write-only: both were
    // httpOnly, so the frontend could not read them, and a grep across both
    // backends confirms nothing ever read them either. They simply travelled on
    // every request advertising the account's privilege level and address.
    //
    // role_id in particular must never come from a cookie — it is in the signed
    // JWT, where it cannot be forged. requireAdmin reads it from the database
    // row regardless (AB-08). Logout still CLEARS these two names so anyone
    // holding them from an older session has them removed. See CLAUDE.md CB-09.
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

    // `sid` (the session table's auto-increment PK) is deliberately no longer
    // returned — it exposed internal DB structure and row counts for no client
    // benefit. See CLAUDE.md CB-20.
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user_id: loginResult.userData.user_id,
      pri_email: loginResult.userData.pri_email,
      localeStr: 'msg.success.loginSuccess',
    });
  } catch (error) {
    return next(error);
  }
};



// customerController.js
exports.getUserDetails = async (req, res) => {
  try {
    // user_id comes from the verified session, never the request. See CB-02.
    const user_id = req.user.user_id;
    const userData = await customerLoginManager.getUserProfile(user_id);

    if (!userData) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Mapping based on your exact column names:
    return res.status(200).json({
      success: true,
      data: {
        name: userData.user_name || "",
        email: userData.pri_email || "",
        phone: userData.phone_number || "", // Changed from pri_mobile to phone_number
        address: userData.address || "",
        // Same shape as the PUT response below — the two must agree, or the
        // profile page renders different fields depending on whether it just
        // loaded or just saved.
        city: userData.city || "",
        state: userData.state || "",
        pincode: userData.pincode || ""
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};


// PUT /api/update-profile
//
// This route did not exist. MyProfile.jsx has always called it, always got the
// 404 HTML page, and always threw on response.json() — so the customer saw
// "Network error" and profile editing was a permanent no-op. See CLAUDE.md CF-06.
//
// The frontend sends its whole `user` state object. Only these three keys are
// read; anything else in the body is ignored, and pri_email/role_id/is_delete
// are not reachable from here at all. Identity comes from the verified session,
// never the body — same rule as every other handler since CB-02.
exports.updateUserProfile = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const { name, phone, address, city, state, pincode } = req.body;

    // Every nullable column follows the same rule: an empty value is stored as
    // NULL, never as "". Otherwise "no city" has two representations and every
    // downstream check has to test for both.
    const orNull = (v) => (v ? v : null);

    const updated = await customerLoginManager.updateUserProfile(user_id, {
      user_name: name,
      phone_number: phone,
      address: orNull(address),
      city: orNull(city),
      state: orNull(state),
      pincode: orNull(pincode),
    });

    // Echo the saved row back in the same shape GET /api/me returns, so the
    // client can render what the server actually stored rather than trusting
    // its own optimistic copy.
    return res.status(200).json({
      success: true,
      message: 'Profile updated.',
      data: {
        name: updated.user_name || "",
        email: updated.pri_email || "",
        phone: updated.phone_number || "",
        address: updated.address || "",
        city: updated.city || "",
        state: updated.state || "",
        pincode: updated.pincode || ""
      }
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }
    console.error("Error in updateUserProfile Controller:", sanitizeError(error));
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
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
    console.error("Error in getAllCollections Controller:", sanitizeError(error));
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.' || "Failed to fetch collections",
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
    console.error('Error in getBestSellers Controller:', sanitizeError(error));
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.' || 'Failed to fetch bestsellers',
    });
  }
};

// ---------------------- GET ALL CATEGORIES ----------------------
/**
 * Categories for the homepage tile strip. See CLAUDE.md CF-35.
 *
 * Distinct from getAllCategories below: this returns the real category rows
 * with their images, and only those holding at least one live product — a tile
 * leading to an empty shop is the failure being fixed, not a smaller version
 * of it.
 */
exports.getCategoryTiles = async (req, res) => {
  try {
    const categories = await productManager.getCategoryTiles();
    return res.status(200).json({
      success: true,
      data: categories,
      message: "Category tiles fetched successfully",
    });
  } catch (error) {
    console.error("Error in getCategoryTiles Controller:", sanitizeError(error));
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await productManager.getAllCategories();

    return res.status(200).json({
      success: true,
      data: categories,
      message: "Categories fetched successfully",
    });
  } catch (error) {
    console.error("Error in getAllCategories Controller:", sanitizeError(error));
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.' || "Failed to fetch categories",
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
    console.error('Error in getProductById Controller:', sanitizeError(error));
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.' || 'Failed to fetch product',
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
    console.error("Error in getProductsByCategory Controller:", sanitizeError(error));
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.' || "Failed to fetch products"
    });
  }
};

// ---------------------- GET NEW RELEASE PRODUCTS ----------------------

// GET /api/products — the full live catalogue for the storefront's /shop page.
//
// Public and unauthenticated, deliberately: this is a shop window. It replaces
// the storefront's call to the ADMIN backend's get-all-product-details, which
// Phase 2 put behind admin auth — leaving customers with a 401 and an empty
// shop. See CLAUDE.md CF-22 and CONSTRAINT 5.
/**
 * GET /api/products/search?q=...
 *
 * Public, like the rest of the catalogue. Returns a short, ranked list shaped
 * for the header dropdown — id, name, category, price, stock flag and ONE
 * image. Deliberately not the full product row: this feeds a list of
 * suggestions, and the product page fetches the rest when one is opened.
 *
 * A blank or whitespace-only term returns an EMPTY list rather than the whole
 * catalogue. "No query" and "query matched nothing" must not look different to
 * the client, and the alternative — treating empty as "match everything" — is
 * how a search box becomes an accidental full-table dump.
 */
exports.searchProducts = async (req, res) => {
  try {
    const term = String(req.query.q ?? '').trim();
    if (!term) {
      return res.status(200).json({ success: true, data: [], message: 'No query' });
    }

    const products = await productManager.searchProducts(term);

    return res.status(200).json({
      success: true,
      data: products,
      message: 'Search results'
    });
  } catch (error) {
    console.error("Error in searchProducts Controller:", sanitizeError(error));
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const products = await productManager.getAllProducts();

    return res.status(200).json({
      success: true,
      data: products,
      message: "Products fetched successfully"
    });
  } catch (error) {
    console.error("Error in getAllProducts Controller:", sanitizeError(error));
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

exports.getNewReleaseProducts = async (req, res) => {
  try {
    const products = await productManager.getNewReleaseProducts();

    return res.status(200).json({
      success: true,
      data: products,
      message: "New release products fetched successfully"
    });

  } catch (error) {
    console.error("Error in getNewReleaseProducts Controller:", sanitizeError(error));
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.' || "Failed to fetch new release products"
    });
  }
};


// ====== ADD TO WISHLIST ======
exports.addToWishlist = async (req, res) => {
  // user_id comes from the verified session, never the request. See CB-02.
  const user_id = req.user.user_id;
  const { product_id } = req.body;

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
    console.error("Error in addToWishlist controller:", sanitizeError(error));
    return res.status(500).json({
      success: false,
      message: "Failed to add product to wishlist",
    });
  }
};

// ====== GET WISHLIST ITEMS ======
exports.getWishlist = async (req, res) => {
  try {
    // user_id comes from the verified session, never the request. See CB-02.
    const user_id = req.user.user_id;
    if (!user_id) {
       return res.status(400).json({
        success: false,
        message: "user_id is required",
      });
    }

   const result = await productManager.getWishlist(user_id);

    res.status(200).json({
      success: true,
      data: result,
      message: "Wishlist fetched successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch wishlist",
    });
  }
};


// ====== REMOVE FROM WISHLIST ======
exports.removeWishlist = async (req, res) => {
  // user_id comes from the verified session, never the request. See CB-02.
  const user_id = req.user.user_id;
  const { product_id } = req.body;

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
    console.error("Error in removeWishlist controller:", sanitizeError(error));
    return res.status(500).json({
      success: false,
      message: "Failed to remove from wishlist",
    });
  }
};

exports.checkWishlist = async (req, res) => {
  try {

    // user_id comes from the verified session, never the request. See CB-02.
    const user_id = req.user.user_id;
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
    console.error("Error in checkWishlist:", sanitizeError(err));
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};


exports.wishlistCount = async (req, res) => {
  try {
    // user_id comes from the verified session, never the request. See CB-02.
    const user_id = req.user.user_id;

    if (!user_id) {
      return res.status(400).json({ success: false, message: "user_id is required" });
    }

    const result = await productManager.wishlistCount(user_id);

    res.status(200).json({
      success: true,
      count: result.count,
    });
  } catch (err) {
    console.error("Error in wishlistCount:", sanitizeError(err));
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};



exports.moveWishlistToCart = async (req, res) => {
  try {
    // user_id comes from the verified session, never the request. See CB-02.
  const user_id = req.user.user_id;
  const { product_id } = req.body;

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
    res.status(400).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};



exports.getCart = async (req, res) => {
  try {    
    // user_id comes from the verified session, never the request. See CB-02.
    const user_id = req.user.user_id;
    const cartItems = await productManager.getCart(user_id);

    return res.status(200).json({
      success: true,
      data: cartItems,
      message: "Cart fetched successfully"
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};



// PUT /api/cart/update
exports.updateCartQuantity = async (req, res) => {
  try {
    // user_id comes from the verified session, never the request. See CB-02.
    const user_id = req.user.user_id;
    const { product_id, quantity } = req.body;
    const result = await productManager.updateCartQuantity(user_id, product_id, quantity);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

// DELETE /api/cart/remove
exports.removeFromCart = async (req, res) => {
  try {
    // user_id comes from the verified session, never the request. See CB-02.
  const user_id = req.user.user_id;
  const { product_id } = req.body;
    const result = await productManager.removeFromCart(user_id, product_id);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};


//addtocart

exports.addToCart = async (req, res) => {
  try {
    // user_id comes from the verified session, never the request. See CB-02.
  const user_id = req.user.user_id;
  const { product_id } = req.body;

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
    console.error("Error in addToCart controller:", sanitizeError(err));
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

exports.createOrder = async (req, res) => {
  try {
    // payment_status and status are deliberately NOT read from the request.
    // A client must never be able to declare its own order paid. See
    // CLAUDE.md CB-03 / CF-01.
    // user_id comes from the verified session, never the request. See CB-02.
    const user_id = req.user.user_id;
    // phone_number is the DELIVERY contact for this parcel, not the account's
    // phone. The checkout form has always collected and sent it; this handler
    // never read it and the table had no column, so it was discarded on every
    // order — the shipping address was stored while the phone for the same
    // parcel was thrown away. Validated by v.createOrder against the same rules
    // as signup and profile. See CLAUDE.md AB-42 / CF-09, migration 007.
    const { shipping_address, payment_method, phone_number } = req.body;
    const contact_phone = phone_number || null;

    if (!user_id || !shipping_address || !payment_method) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Server-assigned. Until a payment gateway is integrated, every order is
    // created unpaid and pending. payment_status may only become 'Paid' via a
    // verified gateway callback — never from a client request body.
    const payment_status = "Unpaid";
    const status = "Pending";

    // 1️⃣ Fetch cart
    const cartItems = await productManager.getCart(user_id);
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // 2️⃣ Map cart items & calculate total_amount
    // Every cart row must be billable. Invalid rows are REJECTED, never dropped.
    //
    // This was `.filter(item => item.price > 0 && item.quantity > 0)`, which
    // silently discarded any unpriced or non-positive-quantity row, created the
    // order from whatever survived, and then cleared the WHOLE cart — so the
    // customer paid for a subset and lost the rest with no notification, while
    // receiving "Order created successfully". Reproduced on real data: a cart
    // holding product 49 (NULL selling_price) plus a valid saree produced a
    // one-item order and an emptied cart. See CLAUDE.md CB-24b.
    //
    // `Number(null)` is 0 and `Number(undefined)` is NaN, so both a missing
    // price and a malformed one land in `invalidItems` rather than being
    // rounded away by `|| 0`.
    const mappedItems = [];
    const invalidItems = [];

    for (const item of cartItems) {
      const price = Number(item.price);
      const quantity = Number(item.quantity);
      const product_id = Number(item.product_id);

      if (!Number.isFinite(price) || price <= 0) {
        invalidItems.push({ product_id, name: item.name, reason: 'is not available for purchase right now' });
        continue;
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        invalidItems.push({ product_id, name: item.name, reason: 'has an invalid quantity' });
        continue;
      }
      mappedItems.push({ product_id, price, quantity });
    }

    if (invalidItems.length > 0) {
      // Named, so the customer can act on it — and the cart is left untouched,
      // so nothing is lost while they do.
      const names = invalidItems
        .map((i) => `"${i.name || `product ${i.product_id}`}" ${i.reason}`)
        .join('; ');
      return res.status(400).json({
        success: false,
        message: `Your order was not placed because ${names}. Please remove it from your cart and try again.`,
        invalid_items: invalidItems.map((i) => i.product_id)
      });
    }

    if (mappedItems.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const subtotal = mappedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Shipping is added server-side from a server-owned constant. It is never
    // read from the request — the client cannot choose its own shipping fee.
    // See CLAUDE.md CF-03.
    const shipping_fee = appDefines.SHIPPING_FEE;
    const total_amount = subtotal + shipping_fee;

    // 3️⃣ Validate stock
    for (const item of mappedItems) {
      const stock = await productManager.getStock(item.product_id);
      if (stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for product_id ${item.product_id}` });
      }
    }

    // 4️⃣-6️⃣ Order, items, stock and cart are ONE unit.
    //
    // These were four independent writes. A failure partway — most likely
    // reduceStock losing a race for the last unit — left the order row created,
    // items recorded for only some products, stock reduced for only some, and
    // the customer's cart STILL FULL. They would see an error, retry, and place
    // a second order for things the first had already taken stock for.
    //
    // The stock check at step 3 does not prevent this: another customer can buy
    // the last unit between that check and the decrement here. The transaction
    // is what makes the whole sequence all-or-nothing. See CLAUDE.md CB-06.
    const order_id = await withTransaction(async (conn) => {
      const newOrderId = await productManager.createOrder(
        {
          user_id,
          total_amount,
          // Stored alongside the total so the charge can be broken down later.
          // total_amount already includes it — this is not an extra charge.
          shipping_fee,
          shipping_address,
          contact_phone,
          payment_method,
          payment_status,
          status
        },
        conn
      );

      for (const item of mappedItems) {
        await productManager.addOrderItem(newOrderId, item.product_id, item.quantity, item.price, conn);
        await productManager.reduceStock(item.product_id, item.quantity, conn);
      }

      await productManager.clearCart(user_id, conn);

      return newOrderId;
    });

    // Return the authoritative amounts the server actually charged, so the
    // client can display them rather than recomputing its own figure.
    return res.status(200).json({
      success: true,
      message: "Order created successfully",
      order_id,
      subtotal,
      shipping_fee,
      total_amount
    });

  } catch (err) {
    console.error("Error in createOrder:", sanitizeError(err));
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
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

    // 2️⃣ OWNERSHIP CHECK. This route has to keep :order_id — you are
    // addressing a specific order — so the guard lives here instead. Without
    // it any authenticated customer could read any order's total, shipping
    // address and payment status just by incrementing the id. See CB-02.
    //
    // 404 rather than 403: a 403 would confirm the order exists, letting an
    // attacker map valid order ids.
    if (Number(order.user_id) !== Number(req.user.user_id)) {
      console.warn(
        `[authz] order ownership denied: user=${req.user.user_id} order=${order_id}`
      );
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // 3️⃣ Get all items of this order
    const items = await productManager.getOrderItems(order_id);

    // 3️⃣ Return combined data
    return res.status(200).json({
      success: true,
      order,
      items
    });

  } catch (error) {
    console.error("Error in getOrderById:", sanitizeError(error));
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

exports.getOrdersByUser = async (req, res) => {
  try {
    // user_id comes from the verified session, never the request. See CB-02.
    const user_id = req.user.user_id;

    // Fetch orders for the user
    const orders = await productManager.getOrdersByUser(user_id);

    // An empty order history is a valid state, not an error. This previously
    // returned 404, which forced the client to treat "no orders yet" as a
    // failure and leaked whether an account had ever ordered. See CB-34.
    if (!orders || orders.length === 0) {
      return res.status(200).json({ success: true, orders: [] });
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
    console.error("Error in getOrdersByUser:", sanitizeError(err));
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

// REMOVED: exports.addOrderItem (POST /api/order/add-item)
//
// It read { order_id, product_id, quantity, price } from the body and inserted
// them verbatim into order_items — no ownership check on order_id, no product
// lookup, no stock reduction, and orders.total_amount was never recalculated.
// Anyone could attach any product to any order at price 0.01.
//
// The storefront never called it (verified by grep), so an attacker had to hit
// the API directly — but with no auth in front of it, that was trivial.
//
// Order items are now only ever created inside createOrder, which prices every
// line from the product table. The productManager.addOrderItem helper it uses
// internally is retained; only the public HTTP entry point is gone.
// See CLAUDE.md CB-04.

// ---------------------------------------------------------------------------
// Phase 2 auth endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/logout
 *
 * There was previously no logout endpoint at all. SESSION_LOGOUT was written in
 * exactly one place — the *expiry* branch of login — so a session could only
 * end by ageing out. Combined with the cookie bug fixed in Phase 1 Slice 8,
 * which set cookies to expire in the year 238,581, a stolen cookie was
 * effectively permanent. See CLAUDE.md CB-13.
 *
 * Requires authMiddleware: revoking a session needs to know whose it is, and
 * the scoped UPDATE means one account can never log another out.
 */
exports.logout = async (req, res, next) => {
  try {
    await productManager.logoutSession(
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
 * Lets the frontend ask "is my session still valid?" without guessing from
 * localStorage. authMiddleware has already done the work by the time this
 * runs — reaching the handler at all means the session is good.
 *
 * Returns only non-sensitive identity fields.
 */
exports.verifyToken = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      user_id: req.user.user_id,
      pri_email: req.user.pri_email,
      role_id: req.user.role_id,
      // Included so the storefront can greet the customer by name from the
      // SERVER's answer. Without it, ProfileSection read the name out of
      // localStorage — a value the visitor can edit — which kept the
      // identity keys alive after CF-55 had already made the session the
      // authority for everything else. See CLAUDE.md CF-46.
      user_name: req.user.user_name ?? null,
      // Stored in E.164 (`+919812345678`). The checkout splits it back into
      // country + national parts with fromE164 before filling the form.
      phone_number: req.user.phone_number ?? null,
    },
  });
};
