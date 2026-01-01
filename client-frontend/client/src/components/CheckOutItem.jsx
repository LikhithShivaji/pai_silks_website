import React from "react";

function CheckOutItem({ item, quantity }) {
  
  // 1. FIX PRICE: Check all possible names (price, selling_price, etc.)
  const unitPrice = 
    Number(item.discounted_price) || 
    Number(item.selling_price) || 
    Number(item.price) || 
    Number(item.amount) || 
    0;

  // 2. FIX IMAGE: Check image_url as well
  const imageSrc = 
    item.image1 || 
    item.image_url || // <--- Added this (DB usually sends this)
    item.image || 
    item.primary_image ||
    "https://placehold.co/100";

  return (
    <div
      key={item.id}
      className="
        relative
        grid
        grid-cols-[30%_55%_15%]
        border-b border-gray-100 pb-2 mb-2
      "
    >
      {/* IMAGE + QUANTITY */}
      <div
        className="
          relative
          flex
          items-center
          justify-center
          h-[12vh]
          w-[6vw]
          overflow-hidden
          m-2
          rounded-[10px]
          border border-gray-200
        "
      >
        <img
          src={imageSrc} 
          alt={item.name}
          className="
            w-full
            h-full
            object-cover
            rounded-[10px]
          "
        />

        {/* Quantity badge */}
        <div className="absolute top-0 right-0 p-1"> {/* Added positioning */}
          <div
            className="
              px-2
              py-0.5
              rounded-full
              bg-gray-800
              text-white
              text-[10px]
              font-semibold
              shadow-sm
            "
          >
            {quantity} {/* Use the passed prop, not item.quantity */}
          </div>
        </div>
      </div>

      {/* DESCRIPTION */}
      <div className="flex items-center px-2">
        <p className="text-sm font-medium text-gray-700 line-clamp-2 leading-tight">
          {item.name}
        </p>
      </div>

      {/* PRICE */}
      <div className="flex items-center justify-end pr-2">
        {/* 3. FIX CALCULATION: Use the robust 'unitPrice' variable */}
        <p className="font-semibold text-gray-900 text-sm">
          ₹ {quantity * unitPrice}
        </p>
      </div>
    </div>
  );
}

export default CheckOutItem;