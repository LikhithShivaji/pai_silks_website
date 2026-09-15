import React, { createContext, useState, useEffect } from "react";
import { CLIENT_API, apiFetch } from "@/config/api";
import { useAuth } from "./AuthContext";

export const CartContext = createContext();

/**
 * Read a JSON array from localStorage, tolerating anything that is not one.
 *
 * Returns [] and discards the key on corrupt data, so a bad value cannot
 * survive a reload and brick the site on every subsequent visit.
 * See CLAUDE.md CF-10.
 */
const readStoredArray = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error(`Discarding corrupt localStorage key "${key}".`);
    try {
      localStorage.removeItem(key);
    } catch {
      // localStorage unavailable (private browsing) — nothing further to do.
    }
    return [];
  }
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [wishListItems, setWishListItems] = useState([]);
  const [dynamicCartItem, setDynamicCartItem] = useState([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Whether to sync with the server is decided by the SERVER, not by a string
  // in localStorage.
  //
  // Every branch below used to test `localStorage.getItem("user_id")`. When
  // that key went stale — which it does, because it outlives the session
  // cookie — a signed-in customer was silently treated as a guest: items were
  // added to React state and localStorage only, never reached the database, and
  // vanished on refresh. Reported as "the cart empties when I refresh",
  // 2026-08-29. See CLAUDE.md CF-55.
  //
  // `status` is also needed, not just the boolean: while it is "checking" the
  // answer is not yet known, and acting on "not signed in" during that window
  // would fetch the guest cart and then have to undo it.
  const { isAuthenticated, status: authStatus } = useAuth();

  useEffect(() => {
    // Wait for a definitive answer before choosing a mode.
    if (authStatus === "checking") return;

    if (isAuthenticated) {
      const fetchUserData = async () => {
        try {
          const cartRes = await apiFetch(`${CLIENT_API}/api/cart/cart-data`);
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

          const wishRes = await apiFetch(`${CLIENT_API}/api/wishlist`);
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
      // JSON.parse throws on malformed input, and this runs inside the
      // provider that wraps the whole app — an unguarded throw here blanked
      // every route, permanently, because the bad value survived reloads.
      // A corrupt key now self-heals instead. See CLAUDE.md CF-10.
      setCartItems(readStoredArray("cart"));
      setWishListItems(readStoredArray("wishlist"));
      setLoaded(true);
    }
    // Re-runs when auth resolves or changes. With an empty dependency array
    // this ran once, before /api/verify-token had answered, so it always took
    // the guest branch on a fresh load.
  }, [isAuthenticated, authStatus]);

  // 2. SYNC TO LOCALSTORAGE (For Guests & Backup)
  useEffect(() => {
    if (loaded) {
      localStorage.setItem("cart", JSON.stringify(cartItems));
      localStorage.setItem("wishlist", JSON.stringify(wishListItems));
    }
  }, [cartItems, wishListItems, loaded]);


  // 3. ADD TO CART HANDLER (Hybrid)
  const handleAddToCart = async (product) => {
    // Server-confirmed, not a localStorage string. See CLAUDE.md CF-55.
    const userId = isAuthenticated;
    const productId = product.id || product.product_id;

    // Decide BEFORE touching state whether this is a genuine addition.
    // The POST below used to fire on every call, outside the de-dup guard, so
    // N clicks created N cart rows in the database while the UI showed one.
    // Checkout bills from the database, so the customer was charged N times
    // what the screen showed. See CLAUDE.md CF-02.
    const alreadyInCart = cartItems.some(
      (item) => (item.id || item.product_id) === productId
    );

    setCartItems((prev) => {
      if (prev.some((item) => (item.id || item.product_id) === productId)) return prev;
      return [...prev, product];
    });

    if (alreadyInCart) return;

    // B. If Logged In -> Sync to DB
    if (userId) {
      try {
        await apiFetch(`${CLIENT_API}/api/cart/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
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
    // Server-confirmed, not a localStorage string. See CLAUDE.md CF-55.
    const userId = isAuthenticated;
    const productId = product.id || product.product_id;

    // Same de-dup guard as handleAddToCart — the POST previously fired on
    // every call regardless of whether the item was already saved. See CF-02.
    const alreadyInWishList = wishListItems.some(
      (item) => (item.id || item.product_id) === productId
    );

    // A. Immediate UI Update
    setWishListItems((prev) => {
      if (prev.some((item) => (item.id || item.product_id) === productId)) return prev;
      return [...prev, product];
    });

    if (alreadyInWishList) return;

    // B. If Logged In -> Sync to DB
    if (userId) {
      try {
        await apiFetch(`${CLIENT_API}/api/wishlist/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
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
  /**
   * Remove one product from the wishlist. THE single implementation.
   *
   * `WishList.jsx` used to carry a second, divergent copy of this — keyed off
   * an array index, operating on its own `dynamicWishListItem` mirror — while
   * Homepage and ViewProductPage used this one. Two implementations of the same
   * operation drift, and these had: the drawer's copy had been hardened by
   * CF-12/CF-17/CF-55 while this one had not, so whether a failed removal was
   * rolled back depended on WHERE the customer clicked the heart.
   *
   * The drawer's protections were the better half and are folded in here; the
   * copy is gone. See CLAUDE.md CF-44.
   */
  const handleRemoveFromWishList = async (productId) => {
    // Server-confirmed, not a localStorage string. See CLAUDE.md CF-55.
    const userId = isAuthenticated;

    // Snapshot BEFORE mutating so a failed request can be undone. Captured
    // from the functional update rather than the outer `wishListItems`, which
    // may be stale inside a handler that has already fired once.
    let previous = null;

    // A. Immediate UI Update (Optimistic)
    setWishListItems((prev) => {
      previous = prev;
      return prev.filter((item) => (item.id || item.product_id) !== productId);
    });

    // B. If Logged In -> Call API to remove from DB
    if (userId) {
      try {
        const res = await apiFetch(`${CLIENT_API}/api/wishlist/remove`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: productId
          }),
        });

        // fetch only rejects on a NETWORK failure — an HTTP 500 resolves
        // normally. Without this check a server-side failure looked identical
        // to success: the item vanished from the screen, stayed in the
        // database, and reappeared on the next reload with no explanation.
        // See CLAUDE.md CF-17.
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (error) {
        console.error("Error removing from DB Wishlist:", error);
        if (previous) setWishListItems(previous);
      }
    }
  };

  const handleRemoveFromCart = async (productId) => {
    // Server-confirmed, not a localStorage string. See CLAUDE.md CF-55.
    const userId = isAuthenticated;
    setCartItems((prev) => prev.filter((item) => String(item.id || item.product_id) !== String(productId)));

    if (userId) {
      try {
        await apiFetch(`${CLIENT_API}/api/cart/remove`, {
          method: "DELETE", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
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

      // Whether the cart has finished hydrating — from the API for a logged-in
      // customer, from localStorage for a guest. Set in BOTH branches of the
      // effect above (the authenticated one sets it in `finally`, so a failed
      // fetch still resolves rather than hanging).
      //
      // Exposed because "cartItems is empty" and "cartItems has not loaded yet"
      // are indistinguishable from the outside, and both look like `[]`. Any
      // consumer that acts on an empty cart — Checkout redirects on one — must
      // wait for this, or it will act on the gap before the data arrives.
      // See CLAUDE.md CF-29.
      cartLoaded: loaded,

      handleAddToCart,
      handleAddToWishList,
      handleRemoveFromWishList, // <--- EXPORTED HERE
      handleRemoveFromCart
    }}>
      {children}
    </CartContext.Provider>
  );
};