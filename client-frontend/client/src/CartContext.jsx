import React, { createContext, useState, useEffect } from "react";
import { CLIENT_API } from "@/config/api";

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [wishListItems, setWishListItems] = useState([]);
  const [dynamicCartItem, setDynamicCartItem] = useState([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem("user_id");

    if (userId) {
      const fetchUserData = async () => {
        try {
          const cartRes = await fetch(`${CLIENT_API}/api/cart/cart-data?user_id=${userId}`);
          const cartData = await cartRes.json();
          
          // console.log("RAW CART DATA FROM API:", cartData);
          if (cartData.success) {
            const safeCart = cartData.data.map(item => ({
                ...item,
                id: item.id || item.product_id,
                image1: item.image1 || item.image || item.product_image || item.image_url || "https://placehold.co/100"
            }));
            
            // console.log("Normalized Cart Data:", safeCart);
            setCartItems(safeCart); 
          }

          const wishRes = await fetch(`${CLIENT_API}/api/wishlist/${userId}`);
          const wishData = await wishRes.json();
          // console.log("RAW CART DATA FROM API:", cartData); // Fixed copy-paste typo in label
          if (wishData.success) {
            const safeWishlist = wishData.data.map(item => ({
                ...item,
                id: item.id || item.product_id,
                // Added image_url fallback here as well
                image1: item.image1 || item.image || item.product_image || item.image_url || "https://placehold.co/100",
                discounted_price: item.discounted_price || item.price || item.selling_price || 0,
                name: item.name || item.product_name
            }));
            
            // console.log("Normalized Wishlist:", safeWishlist);
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
    setCartItems((prev) => {
      if (prev.some((item) => (item.id || item.product_id) === (product.id || product.product_id))) return prev;
      return [...prev, product];
    });

    // B. If Logged In -> Sync to DB
    if (userId) {
      try {
        await fetch(`${CLIENT_API}/api/cart/add`, {
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
        await fetch(`${CLIENT_API}/api/wishlist/add`, {
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
  // 5. REMOVE FROM WISHLIST HANDLER (Hybrid) - NEW!
  // -----------------------------------------------------------
  const handleRemoveFromWishList = async (productId) => {
    const userId = localStorage.getItem("user_id");

    // A. Immediate UI Update (Optimistic)
    setWishListItems((prev) => prev.filter((item) => (item.id || item.product_id) !== productId));

    // B. If Logged In -> Call API to remove from DB
    if (userId) {
      try {
        await fetch(`${CLIENT_API}/api/wishlist/remove`, {
          method: "DELETE", // Assuming DELETE method based on typical API standards
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            product_id: productId
          }),
        });
        // console.log("Removed from DB Wishlist");
      } catch (error) {
        console.error("Error removing from DB Wishlist:", error);
      }
    }
  };

  const handleRemoveFromCart = async (productId) => {
    const userId = localStorage.getItem("user_id");
    setCartItems((prev) => prev.filter((item) => String(item.id || item.product_id) !== String(productId)));

    if (userId) {
      try {
        await fetch(`${CLIENT_API}/api/cart/remove`, {
          method: "DELETE", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            product_id: productId
          }),
        });
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
      handleRemoveFromWishList, // <--- EXPORTED HERE
      handleRemoveFromCart 
    }}>
      {children}
    </CartContext.Provider>
  );
};