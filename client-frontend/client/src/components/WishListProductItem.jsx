import React from "react";
import { Trash2, ShoppingBag } from "lucide-react";

function WishListProductItem({ item, index, onRemove, onMoveToCart }) {
  const removeItem = (e) => {
    onRemove(e, index);
  };

  const imageSrc = item.image1 || item.image_url || item.image || item.product_image || "https://placehold.co/100";

  // const addToCartOperation = (e) => {
  //   e.stopPropagation();
  //   // Logic placeholder
  //   console.log("Added to cart", item.name);
  // };

  return (
    <div className="flex gap-4 p-3 group hover:bg-white/40 transition-colors duration-300 rounded-xl">
      
      {/* --- IMAGE SECTION --- */}
      <div className="w-20 h-24 shrink-0 rounded-xl overflow-hidden border border-white/50 shadow-sm bg-white">
        <img
          src={imageSrc}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
      </div>

      {/* --- DETAILS SECTION --- */}
      <div className="flex-1 flex flex-col justify-between py-1">
        
        {/* Name & Price */}
        <div>
          <h2 className="text-[#68232B] font-bold ">
            {item.name}
          </h2>
          <h3 className="text-[#68232B] font-extrabold text-lg mt-1 leading-none font-['Poppins']">
            ₹ {item.discounted_price}
          </h3>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between gap-3 mt-2">
          
          {/* Add to Cart Button */}
          <button
            onClick={onMoveToCart}
            className="
              flex-1
              flex items-center justify-center gap-2
              bg-[#68232B] text-[#FFCB85]
              px-3 py-1.5
              rounded-full
              text-xs font-bold
              shadow-sm shadow-[#68232B]/20
              hover:bg-[#8B2E39] hover:shadow-md
              active:scale-95
              transition-all duration-300
            "
          >
            <ShoppingBag size={14} strokeWidth={2.5} />
            <span className="whitespace-nowrap">Add to Cart</span>
          </button>

          {/* Remove Icon Button */}
          <button
            onClick={removeItem}
            className="
              p-2
              rounded-full
              text-[#68232B]/50
              hover:bg-red-50 hover:text-red-600
              hover:shadow-sm
              transition-all duration-200
            "
            title="Remove from Wishlist"
          >
            <Trash2 size={18} />
          </button>
        </div>
        
      </div>
    </div>
  );
}

export default WishListProductItem;