import React from "react";

function CheckOutItem({ item, quantity }) {
  return (
    <div
      key={item.id}
      className="
        relative
        grid
        grid-cols-[30%_55%_15%]
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
        "
      >
        <img
          src={item.image1 || item.image || "https://placehold.co/100"} // Fallback added
          alt={item.name}
          className="
            w-full
            h-full
            object-cover
            rounded-[10px]
          "
        />

        {/* Quantity badge */}
        <div className="absolute">
          <div
            className="
              px-1.5
              py-1
              rounded-full
              bg-white
              text-black
              text-xs
              font-semibold
            "
          >
            {item.quantity}
          </div>
        </div>
      </div>

      {/* DESCRIPTION */}
      <div className="flex items-center justify-center px-2">
        <p>{item.name}</p>
      </div>

      {/* PRICE */}
      <div className="flex items-center justify-center">
        <p>₹ {quantity * item.discounted_price}</p>
      </div>
    </div>
  );
}

export default CheckOutItem;
