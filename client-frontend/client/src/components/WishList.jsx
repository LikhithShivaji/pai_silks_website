import React, { useState, useEffect, useContext } from "react";
import WishListProductItem from "./WishListProductItem";
import footerBg from "../assets/footerbgimage.webp";
import { X, Heart, ShoppingBag } from "lucide-react";
import { CartContext } from "../CartContext"; // <--- IMPORT CONTEXT

// No apiFetch/CLIENT_API/useAuth here any more. This component made its own
// wishlist-removal requests and needed all three; now it delegates to the
// context, which owns the request, the auth check and the rollback. That is the
// point of CF-44 — one implementation, not three.
const WishList = ({ onClose }) => {
  // Use Context instead of local props for single source of truth
  const {
    wishListItems,
    handleAddToCart,
    handleRemoveFromWishList,
  } = useContext(CartContext);

  const [dynamicWishListItem, setDynamicWishListItem] = useState([]);

  // Sync local state with Global Context
  useEffect(() => {
    setDynamicWishListItem(wishListItems);
  }, [wishListItems]);

  // ---------------------------------------------------------
  // 1. REMOVE FROM WISHLIST
  // ---------------------------------------------------------
  // Delegates to the context. This component used to carry its own full copy of
  // the removal logic — API call, optimistic update and rollback — operating on
  // `dynamicWishListItem` while Homepage and ViewProductPage used the context
  // version. Two implementations of one operation, and they had already
  // diverged: only this one checked `res.ok` and rolled back, so whether a
  // failed removal was undone depended on which screen the customer clicked.
  //
  // Those protections now live in the context (CF-44), so this is a thin
  // adapter: stop the click bubbling to the row, resolve the id, delegate. The
  // local mirror below re-syncs from context via the existing useEffect.
  const handleWishListProductRemove = async (e, item) => {
    if (e) e.stopPropagation();
    if (!item) return;

    await handleRemoveFromWishList(item.id || item.product_id);
  };

  // ---------------------------------------------------------
  // 2. MOVE SINGLE ITEM TO CART
  // ---------------------------------------------------------
  const handleMoveToCart = async (product) => {
    // 1. Add to Cart (Context handles DB sync automatically!)
    await handleAddToCart(product);

    // 2. Remove from Wishlist (since it's moved). Keyed by product id — this
    // previously did a findIndex and then removed BY POSITION, which is the
    // stale-index hazard CF-12 describes, reintroduced one call later.
    await handleRemoveFromWishList(product.id || product.product_id);
  };

  // ---------------------------------------------------------
  // 3. ADD ALL TO CART
  // ---------------------------------------------------------
  const handleAddAllToCart = async () => {
    // Snapshot before anything mutates, so a partial failure is recoverable.
    const items = [...dynamicWishListItem];

    // A. Add every item to the cart. Sequential because the context de-dups
    // against current cart state per call (CF-02) — firing these in parallel
    // races that check and can create duplicate rows.
    for (const item of items) {
      await handleAddToCart(item);
    }

    // B. Remove each from the wishlist through the context — the SAME single
    // implementation the drawer and the product pages use.
    //
    // This block previously did its own thing, and it was the third copy of
    // wishlist removal in the codebase. It was also the most broken:
    //   - it cleared the wishlist BEFORE the requests, then mapped over the
    //     already-emptied state to build them, working only by accident of the
    //     closure capturing the pre-clear array;
    //   - it sent `user_id` in the body, which the server ignores — identity
    //     comes from the session cookie (CF-55);
    //   - it read `item.id` only, so any item shaped with `product_id` sent
    //     `product_id: undefined` and silently deleted nothing;
    //   - and one `catch` around a `Promise.all` meant a single failure logged
    //     once while the UI showed the whole wishlist emptied — items stayed in
    //     the database and reappeared on the next reload (CF-17).
    // Delegating fixes all four, and each removal now rolls back on its own.
    for (const item of items) {
      await handleRemoveFromWishList(item.id || item.product_id);
    }

    // Optional: Close wishlist after adding all
    // onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300">
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
          style={{
            backgroundImage: `url(${footerBg})`,
            backgroundSize: "cover", // 👈 Forces image to shrink to fit the box
            backgroundPosition: "center", // 👈 Keeps the important part in the middle
            backgroundRepeat: "no-repeat", // 👈 Prevents tiling if the box is huge
          }}
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
            dynamicWishListItem.map((item) => (
              <div
                key={item.id}
                className="bg-white/60 backdrop-blur-md rounded-lg border border-white/10 hover:shadow-lg overflow-hidden transition-all duration-300"
              >
                {/* Pass the new MoveToCart handler down to the child */}
                <WishListProductItem
                  item={item}
                  onRemove={handleWishListProductRemove}
                  onMoveToCart={() => handleMoveToCart(item)}
                />
              </div>
            ))
          )}
        </div>

        {/* --- FOOTER BUTTON --- */}
        {dynamicWishListItem.length > 0 && (
          <div
            className="p-6 border-t border-[#68232B]/10 bg-white/50 backdrop-blur-md"
            style={{ backgroundImage: `url(${footerBg})` }}
          >
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
