import React, { useState, useEffect } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";

function CartItem({ item, index, onQuantityChange, onRemove }) {
  // Sync local state with props to ensure UI updates if parent changes
  const [itemCount, setItemCount] = useState(item.quantity || 1);

  useEffect(() => {
    setItemCount(item.quantity || 1);
  }, [item.quantity]);

  const incrementOperation = () => {
    const newCount = itemCount + 1;
    setItemCount(newCount);
    onQuantityChange(index, newCount);
  };

  const decrementOperation = () => {
    if (itemCount <= 1) return;
    const newCount = itemCount - 1;
    setItemCount(newCount);
    onQuantityChange(index, newCount);
  };

  return (
    <div className="flex gap-4 p-3 group">
      {/* --- IMAGE SECTION --- */}
      <div className="w-20 h-24 flex-shrink-0 rounded-lg overflow-hidden border border-white/40 shadow-sm bg-white">
        <img
          src={item.image1 || item.image || "https://placehold.co/100"}
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

            <span className="text-sm font-bold text-[#68232B] min-w-[1rem] text-center">
              {itemCount}
            </span>

            <button
              onClick={incrementOperation}
              className="
                w-6 h-6 flex items-center justify-center 
                rounded-full bg-white text-[#68232B] shadow-sm
                hover:bg-[#68232B] hover:text-white 
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
