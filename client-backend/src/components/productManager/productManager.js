// components/productManager/productManager.js
const dbCmds = require('../../dbOps/customerDbOps');
const { sanitizeError } = require('../../utils/safeError');

const getAllCollections = async () => {
  try {
    const collections = await dbCmds.getAllCollections();
    return collections;
  } catch (err) {
    console.error("Error in getAllCollections:", sanitizeError(err));
    throw err;
  }
};


const getBestSellers = async () => {
  try {
    const bestSellers = await dbCmds.getBestSellers();
    return bestSellers;
  } catch (err) {
    console.error("Error in getBestSellers:", sanitizeError(err));
    throw err;
  }
};

/** Real categories with images, holding at least one product. CF-35. */
const getCategoryTiles = async () => {
  try {
    return await dbCmds.getCategoryTiles();
  } catch (err) {
    console.error("Error in productManager.getCategoryTiles:", sanitizeError(err));
    throw err;
  }
};

const getAllCategories = async () => {
  try {
    // 1. Await the database operation and store the result in a variable
    const categories = await dbCmds.getAllCategories();
    
    // 2. Return the stored result
    return categories; 
  } catch (err) { // Use 'err' or 'error' for consistency, here 'err' matches the example
    console.error("Error in productManager.getAllCategories:", sanitizeError(err));
    throw err;
  }
};


// ✅ New: Get a single product by ID with all images
const getProductById = async (productId) => {
  try {
    const product = await dbCmds.getProductByIdWithImages(productId);
    return product; 
  } catch (err) {
    console.error("Error in productManager.getProductById:", sanitizeError(err));
    throw err;
  }
};

//Get all the products of a category
const getProductsByCategory = async (category) => {
  try {
    // Same collapse as every other product endpoint, via the shared helper.
    // This was an inline copy that also passed through `stock_qty`; the query
    // now returns `in_stock` instead, since this endpoint is public. See CF-22.
    return groupProductRows(await dbCmds.getProductsByCategory(category));
  } catch (err) {
    console.error("Error in getProductsByCategory:", sanitizeError(err));
    throw err;
  }
};

/**
 * Collapse flat product+image rows into products carrying an images[] array.
 *
 * The product queries LEFT JOIN product_images, so a product with four images
 * arrives as four rows. Every storefront product endpoint needs the same
 * collapse, and getProductsByCategory already had this logic inline — this is
 * the shared version so a third copy is not created. The image object shape
 * ({id, url, is_primary}) matches what that endpoint already returns, so the
 * storefront normaliser needs no change.
 *
 * SQL orders primary images first, so images[0] is the card image.
 */
const groupProductRows = (rows) => {
  const productsMap = {};

  (rows || []).forEach((row) => {
    if (!productsMap[row.id]) {
      productsMap[row.id] = {
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        collection: row.collection,
        material: row.material,
        product_code: row.product_code,
        product_wash_care: row.product_wash_care,
        regular_price: row.regular_price,
        selling_price: row.selling_price,
        saree_length: row.saree_length,
        // Boolean, not a count. MySQL returns a comparison as 1/0.
        in_stock: Boolean(row.in_stock),
        images: []
      };
    }

    if (row.image_id) {
      productsMap[row.id].images.push({
        id: row.image_id,
        url: row.image_url,
        is_primary: row.is_primary_image
      });
    }
  });

  return Object.values(productsMap);
};

/**
 * The whole live catalogue, for /shop.
 *
 * New in Phase 5 Slice 3. Until now the storefront had no client-side source
 * for the full catalogue and used the ADMIN backend's get-all-product-details
 * instead — which Phase 2 put behind admin auth, so customers would have got
 * 401 and an empty shop. See CLAUDE.md CF-22 and CONSTRAINT 5.
 */
const getAllProducts = async () => {
  try {
    return groupProductRows(await dbCmds.getAllProducts());
  } catch (err) {
    console.error("Error in getAllProducts:", sanitizeError(err));
    throw err;
  }
};

// Get new release products
//
// Now grouped: the query returns one row per image where it previously
// returned none at all, so the homepage can use this endpoint instead of
// downloading all 35 products from the admin backend to filter 7 in the
// browser.
const getNewReleaseProducts = async () => {
  try {
    return groupProductRows(await dbCmds.getNewReleaseProducts());
  } catch (err) {
    console.error("Error in getNewReleaseProducts:", sanitizeError(err));
    throw err;
  }
};

/**
 * Revoke a session. Scoped to user_id so one account cannot log another out.
 * See CLAUDE.md CB-13.
 */
const logoutSession = async (session_id, user_id, logoutStatus) => {
  try {
    return await dbCmds.logoutSessionBySessionId(session_id, user_id, logoutStatus);
  } catch (err) {
    console.error("Error in logoutSession:", sanitizeError(err));
    throw err;
  }
};

// ====== ADD PRODUCT TO WISHLIST ======
const addToWishlist = async (user_id, product_id) => {
  try {
    const exists = await dbCmds.checkWishlist(user_id, product_id);

    if (exists.length > 0) {
      return { already: true };
    }

    await dbCmds.addToWishlist(user_id, product_id);

    return { already: false };
  } catch (err) {
    console.error("Error in addToWishlist:", sanitizeError(err));
    throw err;
  }
};

// ====== GET USER WISHLIST ======
const getWishlist = async (user_id) => {
  try {
    return await dbCmds.getWishlist(user_id);
  } catch (err) {
    console.error("Error in getWishlist:", sanitizeError(err));
    throw err;
  }
};

// ====== REMOVE PRODUCT FROM WISHLIST ======
const removeWishlist = async (user_id, product_id) => {
  try {
    await dbCmds.removeWishlist(user_id, product_id);
    return true;
  } catch (err) {
    console.error("Error in removeWishlist:", sanitizeError(err));
    throw err;
  }
};

// Check wishlist (for heart icon)
const checkWishlist = async (user_id, product_id) => {
  try {
    return await dbCmds.checkWishlist(user_id, product_id);
  } catch (err) {
    console.error("Error in checkWishlist:", sanitizeError(err));
    throw err;
  }
};

// Wishlist count
const wishlistCount = async (user_id) => {
  try {
    const result = await dbCmds.wishlistCount(user_id);
    return result;
  } catch (err) {
    console.error("Error in wishlistCount:", sanitizeError(err));
    throw err;
  }
};

// ====== MOVE WISHLIST ITEM TO CART ======
const moveWishlistToCart = async (user_id, product_id) => {
  try {

     // 1️⃣ Check if product exists in wishlist
    const inWishlist = await dbCmds.checkWishlist(user_id, product_id);
    if (inWishlist.length === 0) {
      throw new Error("Product not in wishlist");
    }

    // Check if already in cart
    const inCart = await dbCmds.checkCart(user_id, product_id);
    if (inCart.length > 0) {
      throw new Error("Product already in cart");
    }

    // Add to cart
    await dbCmds.addToCart(user_id, product_id);

    // Remove from wishlist
    await dbCmds.removeWishlist(user_id, product_id);

    return true;
  } catch (err) {
    console.error("Error in moveWishlistToCart:", sanitizeError(err));
    throw err;
  }
};

const getCart = async (user_id) => {
  try {
    const cartItems = await dbCmds.getCart(user_id);

    // Return the items with a fallback image if image_url is missing
    return cartItems.map(item => ({
      ...item,
      // If image_url is null from the JOIN, provide a placeholder
      image_url: item.image_url || 'https://via.placeholder.com/200x200?text=No+Image'
    }));
    } catch (err) {
    console.error("Error in getCart:", sanitizeError(err));
    throw err;
  }
};

const updateCartQuantity = async (user_id, product_id, quantity) => {
  try {
    const result = await dbCmds.updateCartQuantity(user_id, product_id, quantity);
    return result;
  } catch (err) {
    console.error("Error in updateCartQuantity:", sanitizeError(err));
    throw err;
  }
};

// ====== REMOVE ITEM FROM CART ======
const removeFromCart = async (user_id, product_id) => {
  try {
    const result = await dbCmds.removeFromCart(user_id, product_id);
    return result;
  } catch (err) {
    console.error("Error in removeFromCart:", sanitizeError(err));
    throw err;
  }
};

// ====== ADD ITEM TO CART ======
const addToCart = async (user_id, product_id) => {
  try {
    const result = await dbCmds.addToCart(user_id, product_id);
    return result; // { success: true, message: "Product added to cart" }
  } catch (err) {
    console.error("Error in addToCart:", sanitizeError(err));
    throw err;
  }
};


// Create order
// Named object rather than positional arguments — see the note on
// dbCmds.createOrder. Two money fields and two address-ish strings sat
// adjacent, and any swap would have written wrong data without erroring.
const createOrder = async (order, conn = null) => {
  try {
    const order_id = await dbCmds.createOrder(order, conn);
    return order_id;
  } catch (err) {
    console.error("Error in createOrder:", sanitizeError(err));
    throw err;
  }
};

// Add item to order
const addOrderItem = async (order_id, product_id, quantity, price, conn = null) => {
  try {
    return await dbCmds.addOrderItem(order_id, product_id, quantity, price, conn);
  } catch (err) {
    console.error("Error in addOrderItem:", sanitizeError(err));
    throw err;
  }
};

// Reduce stock
const reduceStock = async (product_id, quantity, conn = null) => {
  try {
    return await dbCmds.reduceStock(product_id, quantity, conn);
  } catch (err) {
    console.error("Error in reduceStock:", sanitizeError(err));
    throw err;
  }
};

// Clear user's cart
const clearCart = async (user_id, conn = null) => {
  try {
    return await dbCmds.clearCart(user_id, conn);
  } catch (err) {
    console.error("Error in clearCart:", sanitizeError(err));
    throw err;
  }
};

const getStock = async (product_id) => {
  return await dbCmds.getStock(product_id);
};


const getOrderById = async (order_id) => {
  try {
    return await dbCmds.getOrderById(order_id);
  } catch (err) {
    console.error("Error in getOrderById:", sanitizeError(err));
    throw err;
  }
};

const getOrderItems = async (order_id) => {
  try {
    return await dbCmds.getOrderItems(order_id);
  } catch (err) {
    console.error("Error in getOrderItems:", sanitizeError(err));
    throw err;
  }
};

const getOrdersByUser = async (user_id) => {
    try {
      return await dbCmds.getOrdersByUser(user_id);
    } catch (err) {
      console.error("Error in getOrdersByUser:", sanitizeError(err));
      throw err;
    }
  }

  

module.exports = {
  getAllCollections,
  getBestSellers,
  getAllCategories,
  getCategoryTiles,
  getProductById,
  getProductsByCategory,
  addToWishlist,
  getWishlist,
  removeWishlist,
  wishlistCount,
  moveWishlistToCart, // <-- add here
  checkWishlist,
  getCart,
  updateCartQuantity,
  removeFromCart,
  addToCart,
  createOrder,
  addOrderItem,
  reduceStock,
  clearCart,
  getStock,
  getOrderById,
  getOrderItems,
  getOrdersByUser,
  getAllProducts,
  getNewReleaseProducts,
  logoutSession
};
