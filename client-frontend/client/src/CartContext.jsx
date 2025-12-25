import React, { createContext, useState, useEffect } from "react";

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [wishListItems, setWishListItems] = useState([]);
  const [dynamicCartItem, setDynamicCartItem] = useState([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // 1. INITIAL LOAD (Database or LocalStorage?)
  useEffect(() => {
    const userId = localStorage.getItem("user_id");

    if (userId) {
      // --- LOGGED IN: Fetch from API ---
      const fetchUserData = async () => {
        try {
          // A. Fetch Cart
          const cartRes = await fetch(`https://pai-silks-website-1.onrender.com/api/cart/cart-data?user_id=${userId}`);
          const cartData = await cartRes.json();
          
          if (cartData.success) {
            // --- FIX: NORMALIZE DATA ---
            // We map the DB response to ensure 'discounted_price' always exists
            const safeCart = cartData.data.map(item => ({
                ...item,
                // If DB sends 'price' or 'selling_price', we copy it to 'discounted_price'
                discounted_price: item.discounted_price || item.price || item.selling_price || 0,
                // Ensure ID is consistent
                id: item.id || item.product_id,
                // Ensure Image is consistent
                image1: item.image1 || item.image || item.product_image || "https://placehold.co/100"
            }));
            
            console.log("Normalized Cart Data:", safeCart); // Debug log
            setCartItems(safeCart); 
          }

          // B. Fetch Wishlist
          const wishRes = await fetch(`https://pai-silks-website-1.onrender.com/api/wishlist/${userId}`);
          const wishData = await wishRes.json();
          if (wishData.success) {
            // NORMALIZE WISHLIST DATA
            const safeWishlist = wishData.data.map(item => ({
                ...item,
                // Ensure ID and Image match what your UI expects
                id: item.id || item.product_id,
                image1: item.image1 || item.image || item.product_image || "https://placehold.co/100",
                discounted_price: item.discounted_price || item.price || item.selling_price || 0,
                name: item.name || item.product_name
            }));
            
            console.log("Normalized Wishlist:", safeWishlist);
            setWishListItems(safeWishlist);
          }
        } catch (error) {
          console.error("Failed to load user data:", error);
        } finally {
          setLoaded(true);
        }
      };

      fetchUserData();

    } else {
      // --- GUEST: Fetch from LocalStorage ---
      const savedCart = JSON.parse(localStorage.getItem("cart")) || [];
      const savedWishList = JSON.parse(localStorage.getItem("wishlist")) || [];
      setCartItems(savedCart);
      setWishListItems(savedWishList);
      setLoaded(true);
    }
  }, []);

  // 2. SYNC TO LOCALSTORAGE (For Guests & Backup)
  useEffect(() => {
    if (loaded) {
      localStorage.setItem("cart", JSON.stringify(cartItems));
      localStorage.setItem("wishlist", JSON.stringify(wishListItems));
    }
  }, [cartItems, wishListItems, loaded]);


  // 3. ADD TO CART HANDLER (Hybrid)
  const handleAddToCart = async (product) => {
    const userId = localStorage.getItem("user_id");

    // A. Immediate UI Update (Optimistic)
    setCartItems((prev) => {
      // Prevent duplicates based on ID
      if (prev.some((item) => (item.id || item.product_id) === (product.id || product.product_id))) return prev;
      return [...prev, product];
    });

    // B. If Logged In -> Sync to DB
    if (userId) {
      try {
        await fetch("https://pai-silks-website-1.onrender.com/api/cart/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            product_id: product.id || product.product_id,
            quantity: product.quantity || 1
          }),
        });
      } catch (error) {
        console.error("Error adding to DB Cart:", error);
      }
    }
  };

  // 4. ADD TO WISHLIST HANDLER (Hybrid)
  const handleAddToWishList = async (product) => {
    const userId = localStorage.getItem("user_id");

    // A. Immediate UI Update
    setWishListItems((prev) => {
      if (prev.some((item) => (item.id || item.product_id) === (product.id || product.product_id))) return prev;
      return [...prev, product];
    });

    // B. If Logged In -> Sync to DB
    if (userId) {
      try {
        await fetch("https://pai-silks-website-1.onrender.com/api/wishlist/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            product_id: product.id || product.product_id
          }),
        });
      } catch (error) {
        console.error("Error adding to DB Wishlist:", error);
      }
    }
  };

  // -----------------------------------------------------------
  // 5. REMOVE FROM CART HANDLER (Hybrid) - NEW!
  // -----------------------------------------------------------
  const handleRemoveFromCart = async (productId) => {
    const userId = localStorage.getItem("user_id");

    // A. Immediate UI Update (Optimistic)
    // Filters out the item from the local state instantly
    setCartItems((prev) => prev.filter((item) => (item.id || item.product_id) !== productId));

    // B. If Logged In -> Call API to remove from DB
    if (userId) {
      try {
        await fetch("https://pai-silks-website-1.onrender.com/api/cart/remove", {
          method: "DELETE", // Standard practice is DELETE. Check your API docs if it's POST.
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            product_id: productId
          }),
        });
        console.log("Removed from DB Cart");
      } catch (error) {
        console.error("Error removing from DB Cart:", error);
      }
    }
  };

  return (
    <CartContext.Provider value={{
      cartItems, setCartItems,
      wishListItems, setWishListItems,
      dynamicCartItem, setDynamicCartItem,
      total, setTotal,
      handleAddToCart, 
      handleAddToWishList,
      handleRemoveFromCart // <--- EXPORTED HERE
    }}>
      {children}
    </CartContext.Provider>
  );
};