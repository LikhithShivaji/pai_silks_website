import React from "react";
import { useNavigate } from "react-router-dom";
import addButton from "../assets/button.svg";
import { Plus, X } from "lucide-react";

function ProductCard({
  id,
  name,
  main_price,
  discounted_price,
  image1,
  onAddToCart,
}) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/product/${id}`);
  };

  const addToCart = (e) => {
    e.stopPropagation();
    onAddToCart();
  };

  return (
    <div
      onClick={handleCardClick}
      className="
        relative
        font-['Poppins']
        text-center
        rounded-[1.5rem]
        text-[#68232B]
        cursor-pointer
        transition-all
        duration-300
        p-3

        bg-white/10
        backdrop-blur-md
        shadow-sm

        hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]
        hover:bg-white/30
        hover:-translate-y-1
      "
    >
      {/* IMAGE */}
      <div
        className="
          w-full
          aspect-[3/4]
          overflow-hidden
          rounded-[1.2rem]
          mb-3
          bg-white/10
        "
      >
        <img
          src={image1 || "/placeholder.png"}
          alt={name}
          className="
            w-full
            h-full
            object-cover
            transition-transform
            duration-700
            ease-in-out
            hover:scale-110
          "
        />
      </div>

      {/* NAME */}
      <h4
        className="
          mt-0
          mb-[4px]
          px-1
          h-[3em]
          flex
          items-center
          justify-center
          text-base
          lg:text-20
          text-20
          font-semibold
          leading-tight
        "
      >
        {name}
      </h4>

      {/* PRICE + BUTTON */}
      <div
        className="
          flex
          justify-between
          items-center
          px-2
          pb-1
        "
      >
        <div className="flex flex-col items-start leading-none gap-1">
          <h6 className="m-0 p-0 text-xs opacity-70">
            <del>₹ {main_price}</del>
          </h6>
          <h3 className="m-0 p-0 text-md font-bold">₹ {discounted_price}</h3>
        </div>

        {/* ADD BUTTON */}
        <button
          onClick={addToCart}
          className="
            w-[42px]
            h-[42px]
            bg-[#68232B]/10
            bg-center
            bg-cover
            rounded-xl
            shadow-md
            transition-transform
            duration-200
            hover:scale-110
            hover:shadow-lg
            active:scale-95
            flex justify-center items-center
            cursor-pointer
          "
          style={{ backgroundImage: `url(${addButton})` }}
        ><Plus/></button>
      </div>
    </div>
  );
}

export default ProductCard;