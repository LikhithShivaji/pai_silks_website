import React, { useState, useEffect, useContext } from "react";
import WishListProductItem from "./WishListProductItem";
import footerBg from "../assets/footerbgimage.svg";
import { X, Heart, ShoppingBag } from "lucide-react";
import { CartContext } from "../CartContext"; // <--- IMPORT CONTEXT

const WishList = ({ onClose }) => {
  // Use Context instead of local props for single source of truth
  const { 
    wishListItems, 
    setWishListItems, 
    handleAddToCart,
    cartItems // Needed to check if already in cart
  } = useContext(CartContext);

  const [dynamicWishListItem, setDynamicWishListItem] = useState([]);

  // Sync local state with Global Context
  useEffect(() => {
    setDynamicWishListItem(wishListItems);
  }, [wishListItems]);

  // ---------------------------------------------------------
  // 1. REMOVE FROM WISHLIST (Hybrid: API + Local)
  // ---------------------------------------------------------
  const handleWishListProductRemove = async (e, index) => {
    if(e) e.stopPropagation();
    
    const itemToRemove = dynamicWishListItem[index];
    const userId = localStorage.getItem("user_id");

    // A. Optimistic UI Update
    const newWishListItems = dynamicWishListItem.filter((_, i) => i !== index);
    setDynamicWishListItem(newWishListItems);
    setWishListItems(newWishListItems); // Update Context

    // B. API Call if User
    if (userId) {
      try {
        await fetch("https://pai-silks-website-1.onrender.com/api/wishlist/remove", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            user_id: userId, 
            product_id: itemToRemove.id || itemToRemove.product_id 
          }),
        });
      } catch (err) {
        console.error("Failed to remove from DB wishlist", err);
      }
    }
  };

  // ---------------------------------------------------------
  // 2. MOVE SINGLE ITEM TO CART
  // ---------------------------------------------------------
  const handleMoveToCart = async (product) => {
    // 1. Add to Cart (Context handles DB sync automatically!)
    await handleAddToCart(product); 

    // 2. Remove from Wishlist (since it's moved)
    // Find index of this product
    const index = dynamicWishListItem.findIndex(item => item.id === product.id);
    if(index !== -1) {
        handleWishListProductRemove(null, index);
    }
  };

  // ---------------------------------------------------------
  // 3. ADD ALL TO CART
  // ---------------------------------------------------------
  const handleAddAllToCart = async () => {
    const userId = localStorage.getItem("user_id");

    // A. Loop through all items and add to Cart Context
    // We use a loop because your Context handles the "User vs Guest" logic internally for each add
    for (const item of dynamicWishListItem) {
        await handleAddToCart(item);
    }

    // B. Clear Wishlist (UI + Context)
    setDynamicWishListItem([]);
    setWishListItems([]);

    // C. If User -> Clear Wishlist in DB or Move All API
    if (userId) {
        // Option 1: Call your specific "Move All" API if you have one
        // Option 2: Just loop delete from wishlist since we added them to cart above
        try {
            await Promise.all(dynamicWishListItem.map(item => 
                fetch("https://pai-silks-website-1.onrender.com/api/wishlist/remove", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: userId, product_id: item.id })
                })
            ));
        } catch (err) {
            console.error("Error syncing empty wishlist to DB", err);
        }
    }
    
    // Optional: Close wishlist after adding all
    // onClose(); 
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300" >
      
      {/* Sidebar Container */}
      <div
        className="
          fixed inset-y-0 right-0
          w-[85vw] md:w-[450px]
          bg-[#FFF8F0]/95 backdrop-blur-xl
          shadow-2xl
          flex flex-col
          font-['Poppins']
          animate-in slide-in-from-right duration-300
        "
      >
        {/* --- HEADER --- */}
        <div 
          className="relative px-6 py-6 border-b border-[#68232B]/10 flex justify-between items-center bg-white/50"
          style={{ backgroundImage: `url(${footerBg})`}}
        >
          <div className="flex items-center gap-3 z-10">
            <div className="p-2 bg-[#68232B]/10 rounded-full text-[#FFCB85]">
                <Heart size={20} fill="#FFCB85" />
            </div>
            <h2 className="text-xl font-bold text-[#FFCB85] tracking-wide">
              Your WishList
            </h2>
            <span className="bg-[#68232B] text-[#FFCB85] text-xs font-bold px-2 py-0.5 rounded-full">
              {dynamicWishListItem.length}
            </span>
          </div>

          <button
            onClick={onClose}
            className="z-10 p-2 hover:bg-[#68232B]/10 rounded-full transition-colors text-[#FFCB85] cursor-pointer"
          >
            <X size={24} />
          </button>
        </div>

        {/* --- CONTENT --- */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FFCB85]/70 backdrop-blur-md">
          {dynamicWishListItem.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#68232B]/60 gap-4">
              <div className="p-6 bg-[#68232B]/5 rounded-full">
                <Heart size={48} strokeWidth={1} />
              </div>
              <p className="text-lg font-medium">Your wishlist is empty</p>
              <button 
                onClick={onClose}
                className="text-sm underline underline-offset-4 hover:text-[#68232B]"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            dynamicWishListItem.map((item, index) => (
              <div 
                key={item.id} 
                className="bg-white/60 backdrop-blur-md rounded-lg border border-white/10 hover:shadow-lg overflow-hidden transition-all duration-300"
              >
                 {/* Pass the new MoveToCart handler down to the child */}
                 <WishListProductItem
                  item={item}
                  index={index}
                  onRemove={handleWishListProductRemove}
                  onMoveToCart={() => handleMoveToCart(item)} 
                />
              </div>
            ))
          )}
        </div>

        {/* --- FOOTER BUTTON --- */}
        {dynamicWishListItem.length > 0 && (
          <div className="p-6 border-t border-[#68232B]/10 bg-white/50 backdrop-blur-md" style={{ backgroundImage: `url(${footerBg})`}}>
            <button
              onClick={handleAddAllToCart}
              className="
                w-full h-14
                rounded-full
                font-bold text-lg text-white
                shadow-lg shadow-orange-900/20
                bg-gradient-to-r from-[#FEDB87] to-[#BD7923]
                hover:brightness-110
                active:scale-95
                transition-all duration-300
                flex items-center justify-center gap-2
                cursor-pointer
              "
            >
              <ShoppingBag size={20} /> Add All to Cart
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default WishList;