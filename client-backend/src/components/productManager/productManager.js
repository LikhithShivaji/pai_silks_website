// components/productManager/productManager.js
const dbCmds = require('../../dbOps/customerDbOps');

const getAllCollections = async () => {
  try {
    const collections = await dbCmds.getAllCollections();
    return collections;
  } catch (err) {
    console.error("Error in getAllCollections:", err);
    throw err;
  }
};


const getBestSellers = async () => {
  try {
    const bestSellers = await dbCmds.getBestSellers();
    return bestSellers;
  } catch (err) {
    console.error("Error in getBestSellers:", err);
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
    console.error("Error in productManager.getAllCategories:", err);
    throw err;
  }
};


// ✅ New: Get a single product by ID with all images
const getProductById = async (productId) => {
  try {
    const product = await dbCmds.getProductByIdWithImages(productId);
    return product; 
  } catch (err) {
    console.error("Error in productManager.getProductById:", err);
    throw err;
  }
};

//Get all the products of a category
const getProductsByCategory = async (category) => {
  try {
    const rows = await dbCmds.getProductsByCategory(category);

    // Convert flat rows into products with images array
    const productsMap = {};

    rows.forEach(row => {
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
          stock_qty: row.stock_qty,
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
  } catch (err) {
    console.error("Error in getProductsByCategory:", err);
    throw err;
  }
};

// Get new release products
const getNewReleaseProducts = async () => {
  try {
    return await dbCmds.getNewReleaseProducts();
  } catch (err) {
    console.error("Error in getNewReleaseProducts:", err);
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
    console.error("Error in addToWishlist:", err);
    throw err;
  }
};

// ====== GET USER WISHLIST ======
const getWishlist = async (user_id) => {
  try {
    const wishlistItems = await dbCmds.getWishlist(user_id);
    return wishlistItems; // each item now contains `images` array
  } catch (err) {
    console.error("Error in getWishlist:", err);
    throw err;
  }
};

// ====== REMOVE PRODUCT FROM WISHLIST ======
const removeWishlist = async (user_id, product_id) => {
  try {
    await dbCmds.removeWishlist(user_id, product_id);
    return true;
  } catch (err) {
    console.error("Error in removeWishlist:", err);
    throw err;
  }
};

// Check wishlist (for heart icon)
const checkWishlist = async (user_id, product_id) => {
  try {
    return await dbCmds.checkWishlist(user_id, product_id);
  } catch (err) {
    console.error("Error in checkWishlist:", err);
    throw err;
  }
};

// Wishlist count
const wishlistCount = async (user_id) => {
  try {
    const result = await dbCmds.wishlistCount(user_id);
    return result;
  } catch (err) {
    console.error("Error in wishlistCount:", err);
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
    console.error("Error in moveWishlistToCart:", err);
    throw err;
  }
};

const getCart = async (user_id) => {
  try {
    const rows = await dbCmds.getCart(user_id);

    // Map cart items to include product images
    const cartMap = {};

    rows.forEach(row => {
      if (!cartMap[row.cart_id]) {
        cartMap[row.cart_id] = {
          cart_id: row.cart_id,
          quantity: row.quantity,
          product: {
            id: row.product_id,
            name: row.name,
            price: row.price,
            regular_price: row.regular_price,
            category: row.category,
            images: []
          }
        };
      }

      // Push image if exists
      if (row.image_id) {
        cartMap[row.cart_id].product.images.push({
          id: row.image_id,
          url: row.image_url,
          is_primary: row.is_primary_image
        });
      }
    });

    return Object.values(cartMap);
  } catch (err) {
    console.error("Error in getCart ProductManager:", err);
    throw err;
  }
};

const updateCartQuantity = async (user_id, product_id, quantity) => {
  try {
    const result = await dbCmds.updateCartQuantity(user_id, product_id, quantity);
    return result;
  } catch (err) {
    console.error("Error in updateCartQuantity:", err);
    throw err;
  }
};

// ====== REMOVE ITEM FROM CART ======
const removeFromCart = async (user_id, product_id) => {
  try {
    const result = await dbCmds.removeFromCart(user_id, product_id);
    return result;
  } catch (err) {
    console.error("Error in removeFromCart:", err);
    throw err;
  }
};

// ====== ADD ITEM TO CART ======
const addToCart = async (user_id, product_id) => {
  try {
    const result = await dbCmds.addToCart(user_id, product_id);
    return result; // { success: true, message: "Product added to cart" }
  } catch (err) {
    console.error("Error in addToCart:", err);
    throw err;
  }
};


// Create order
const createOrder = async (user_id, total_amount, shipping_address, payment_method, payment_status, status) => {
  try {
    const order_id = await dbCmds.createOrder(
      user_id,
      total_amount,
      shipping_address,
      payment_method,
      payment_status,
      status
    );
    return order_id;
  } catch (err) {
    console.error("Error in createOrder:", err);
    throw err;
  }
};

// Add item to order
const addOrderItem = async (order_id, product_id, quantity, price) => {
  try {
    return await dbCmds.addOrderItem(order_id, product_id, quantity, price);
  } catch (err) {
    console.error("Error in addOrderItem:", err);
    throw err;
  }
};

// Reduce stock
const reduceStock = async (product_id, quantity) => {
  try {
    return await dbCmds.reduceStock(product_id, quantity);
  } catch (err) {
    console.error("Error in reduceStock:", err);
    throw err;
  }
};

// Clear user's cart
const clearCart = async (user_id) => {
  try {
    return await dbCmds.clearCart(user_id);
  } catch (err) {
    console.error("Error in clearCart:", err);
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
    console.error("Error in getOrderById:", err);
    throw err;
  }
};

const getOrderItems = async (order_id) => {
  try {
    return await dbCmds.getOrderItems(order_id);
  } catch (err) {
    console.error("Error in getOrderItems:", err);
    throw err;
  }
};

const getOrdersByUser = async (user_id) => {
    try {
      return await dbCmds.getOrdersByUser(user_id);
    } catch (err) {
      console.error("Error in getOrdersByUser:", err);
      throw err;
    }
  }

  

module.exports = {
  getAllCollections,
  getBestSellers,
  getAllCategories,
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
  getNewReleaseProducts
};
