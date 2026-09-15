import React from "react";
import { Minus, Plus, Trash2 } from "lucide-react";

// Matches the server's own rule — `validators.js` allows 1..100 on
// /api/cart/update (CB-17). Duplicated here so the button disables at the
// ceiling instead of firing a request the server will reject; the server
// remains the authority.
const MAX_QUANTITY = 100;

function CartItem({ item, index, onQuantityChange, onRemove }) {
  // No local `itemCount` state. See CLAUDE.md CF-42.
  //
  // This component used to hold its own copy of the quantity and keep it in
  // step with the prop through an effect — the third level of duplication for
  // one number (context `cartItems` -> `dynamicCartItem` -> `itemCount`). The
  // copy could disagree with its source for a render, and when a parent update
  // was rolled back after a failed request (CF-17) the local value stayed at
  // the rejected number, showing a quantity the server had refused.
  //
  // Reading the prop directly means there is nothing to fall out of sync.
  const itemCount = item.quantity || 1;
  const imageSrc = item.image1 || item.image_url || item.image || item.product_image || "https://placehold.co/100";

  const incrementOperation = () => {
    // Bounded. It was unbounded, and `POST /api/cart/update` writes the value
    // verbatim — so a customer holding the + button sent ever-larger quantities
    // until the server's own limit refused one, with the UI meanwhile showing a
    // number that was never accepted.
    if (itemCount >= MAX_QUANTITY) return;
    onQuantityChange(index, itemCount + 1);
  };

  const decrementOperation = () => {
    if (itemCount <= 1) return;
    onQuantityChange(index, itemCount - 1);
  };


  return (
    <div className="flex gap-4 p-3 group">
      {/* --- IMAGE SECTION --- */}
      <div className="w-20 h-24 fshrink-0 rounded-lg overflow-hidden border border-white/40 shadow-sm bg-white">
        <img
          src={imageSrc}
          alt={item.name}
          className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
        />
      </div>

      {/* --- DETAILS SECTION --- */}
      <div className="flex-1 flex flex-col justify-between py-1">
        {/* Top Row: Name & Remove */}
        <div className="flex justify-between items-start gap-2">
          <h2 className="text-[#68232B] font-bold text-sm md:text-base leading-tight line-clamp-2">
            {item.name}
          </h2>

          <button
            onClick={(e) => {
              e.stopPropagation(); // Stop bubbling
              onRemove(); // <--- UPDATED: Just call it (parent handles ID)
            }}
            className="text-[#68232B]/50 hover:text-red-600 transition-colors p-1 cursor-pointer"
            title="Remove Item"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* Bottom Row: Qty & Price */}
        <div className="flex justify-between items-end mt-2">
          {/* Quantity Stepper */}
          <div className="flex items-center gap-3 bg-[#68232B]/5 rounded-full px-2 py-1 border border-[#68232B]/10">
            <button
              onClick={decrementOperation}
              disabled={itemCount <= 1}
              className="
                w-6 h-6 flex items-center justify-center 
                rounded-full bg-white text-[#68232B] shadow-sm
                hover:bg-[#68232B] hover:text-white 
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all
                cursor-pointer
              "
            >
              <Minus size={12} strokeWidth={3} />
            </button>

            <span className="text-sm font-bold text-[#68232B] min-w-4 text-center">
              {itemCount}
            </span>

            <button
              onClick={incrementOperation}
              // Disabled at the ceiling rather than silently ignoring the
              // click, so the limit is visible instead of the button appearing
              // broken. CF-42.
              disabled={itemCount >= MAX_QUANTITY}
              title={itemCount >= MAX_QUANTITY ? `Maximum ${MAX_QUANTITY} per item` : undefined}
              className="
                w-6 h-6 flex items-center justify-center
                rounded-full bg-white text-[#68232B] shadow-sm
                hover:bg-[#68232B] hover:text-white
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-[#68232B]
                transition-all
                cursor-pointer
              "
            >
              <Plus size={12} strokeWidth={3} />
            </button>
          </div>

          {/* Price */}
          <div className="text-right">
            <h3 className="text-[#68232B] font-bold text-lg leading-none">
              ₹{" "}
              {(
                itemCount *
                (item.discounted_price || item.price || item.selling_price || 0)
              ).toFixed(0)}
            </h3>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CartItem;