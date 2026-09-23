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
  showToast,
  // Defaults to true so callers that do not pass it behave exactly as before.
  in_stock = true,
}) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/product/${id}`);
  };

  const addToCart = (e) => {
    e.stopPropagation();
    // Out-of-stock is refused HERE rather than at the end of checkout.
    //
    // The storefront had no stock awareness: an unavailable saree went into the
    // cart, showed a total, and failed only after the customer had typed their
    // whole address — "Insufficient stock for product_id 12". The server still
    // enforces stock at checkout; this just stops the customer wasting the trip.
    // See CLAUDE.md CF-20.
    if (!in_stock) {
      showToast("Sorry, this saree is out of stock.");
      return;
    }
    onAddToCart();
    showToast("Added to Cart", "cart");
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
          relative
          w-full
          aspect-3/4
          overflow-hidden
          rounded-[1.2rem]
          mb-3
          bg-white/10
        "
      >
        {/* SOLD OUT. The Add to Cart button was already disabled at zero stock
            (CF-20), but nothing SAID so — the customer saw an ordinary card
            with a button that ignored them, which reads as the site being
            broken rather than the saree being gone. The overlay also stops
            them getting as far as the product page before finding out.
            `in_stock` is a boolean, not a count: exact inventory is not
            customer data (CB-22). */}
        {!in_stock && (
          <>
            <div className="absolute inset-0 z-10 bg-white/60" />
            <span className="absolute top-3 left-3 z-20 rounded-full bg-[#68232B] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#FFCB85] shadow">
              Sold Out
            </span>
          </>
        )}
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
          mb-1
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

        {/* ADD BUTTON — visibly disabled when out of stock, so the customer
            can see it before clicking rather than being told afterwards. */}
        <button
          onClick={addToCart}
          disabled={!in_stock}
          title={in_stock ? "Add to cart" : "Out of stock"}
          className="
            w-10.5
            h-10.5
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
            disabled:opacity-40 disabled:cursor-not-allowed
            disabled:hover:scale-100 disabled:active:scale-100
          "
          style={{ backgroundImage: `url(${addButton})` }}
        ><Plus/></button>
      </div>
    </div>
  );
}

export default ProductCard;