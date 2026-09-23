import React, { useState, useContext } from "react";
import logo from "../assets/logo.svg";
// Three SVG imports stood here — Heart.svg, ShoppingBag.svg and List.svg —
// superseded by the lucide-react icons imported below (Heart, ShoppingCart,
// Menu) and never removed. This was their ONLY importer, so the asset files
// went with them.
import ProfileSection from "./ProfileSection";
import Cart from "./Cart";
import WishList from "./WishList";
import SearchPanel from "./SearchPanel";
import headerBg from "../assets/backgroundimagenew.jpg";
import { ShoppingCart } from 'lucide-react';
import { Heart } from 'lucide-react';
import { Menu } from 'lucide-react';
import { Search } from 'lucide-react';
import { CartContext } from "../CartContext";

/**
 * Count bubble for the wishlist and cart icons.
 *
 * Renders NOTHING at zero rather than a "0". An empty cart is the default
 * state, and a permanent badge reading 0 trains the eye to ignore the badge —
 * which makes it useless on the day it means something. Same reasoning that
 * removed the hardcoded "3" from the admin bell (CLAUDE.md AF-30).
 *
 * Capped at 99+ so a large count cannot stretch the bubble across the icon.
 */
const CountBadge = ({ count, label }) => {
  if (!Number.isFinite(count) || count <= 0) return null;

  return (
    <span
      // aria-label rather than the bare number: a screen reader announcing
      // "3" beside a heart conveys nothing on its own.
      aria-label={`${count} ${label}`}
      className="
        absolute -top-2 -right-2
        min-w-[18px] h-[18px] px-1
        flex items-center justify-center
        rounded-full bg-[#68232B] text-white
        text-[10px] font-bold leading-none
        ring-2 ring-[#FFF8F0]
      "
    >
      {count > 99 ? "99+" : count}
    </span>
  );
};

// Takes no props. It used to accept cartItems/onUpdate/wishListItems/
// onWishListUpdate from all six pages purely to forward them to <Cart> and
// <WishList> — and both of those are `({ onClose })` and read CartContext
// directly, so every one of those props was discarded on arrival.
// See CLAUDE.md CF-34.
function Header() {
  const [isProfileSectionOpen, setIsProfileSectionOpen] = useState(false);
  const [isWishListOpen, setIsWishListOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Straight from the context, which is already the single source of truth for
  // both lists: server-backed for a signed-in customer, localStorage for a
  // guest. So the badges follow the user's own data without this component
  // fetching anything or holding a second copy that could drift.
  const { cartItems, wishListItems } = useContext(CartContext);

  // Cart counts UNITS, not lines: three of one saree is three items in the bag,
  // and showing "1" there would contradict the cart screen. `quantity` may be
  // missing on an item added straight from a product card, so it falls back to
  // 1 rather than dropping the row from the count.
  const cartCount = (cartItems ?? []).reduce((sum, item) => {
    const qty = Number(item?.quantity);
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 1);
  }, 0);

  // Wishlist has no quantity — it is a set of saved sarees, so its count is
  // simply how many are saved.
  const wishListCount = (wishListItems ?? []).length;

  // Opening any panel closes the others. Previously repeated inline at each
  // icon, which is how the fourth one would have been added with a line missing.
  const openPanel = (panel) => {
    setIsProfileSectionOpen(panel === "profile");
    setIsWishListOpen(panel === "wishlist");
    setIsCartOpen(panel === "cart");
    setIsSearchOpen(panel === "search");
  };

  return (
    <>
      {/* HEADER */}
      <header
        className="
    sticky top-0 z-[4]
    w-full h-[5rem]
    flex items-center justify-between
    shadow-[10px_0px_15px_5px_rgba(0,0,0,0.4)]
    text-white
  "
        style={{
          backgroundImage: `url(${headerBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* PROFILE MENU */}
        <div
          className="pl-4 cursor-pointer z-[1] text-[#4d0000]"
          onClick={() => openPanel("profile")}
        >
          <Menu/>
        </div>

        {/* LOGO */}
        <div
          className="
            absolute left-1/2 -translate-x-1/2
            top-[1%]
            h-[3rem]
            sm:top-[5%]
          "
        >
          <img src={logo} alt="Logo" className="h-[5rem] w-auto" />
        </div>

        {/* SEARCH + WISHLIST + CART.
            Buttons rather than divs so all three are keyboard reachable, and
            `relative` on each so its badge can anchor to the icon. */}
        <div className="flex items-center z-[1] gap-4 sm:gap-5 px-4 sm:px-5 text-[#4d0000]">
          {/* SEARCH — to the LEFT of the wishlist. */}
          <button
            type="button"
            onClick={() => openPanel("search")}
            aria-label="Search products"
            className="relative cursor-pointer hover:opacity-70 transition-opacity"
          >
            <Search />
          </button>

          {/* WISHLIST */}
          <button
            type="button"
            onClick={() => openPanel("wishlist")}
            aria-label="Open wishlist"
            className="relative cursor-pointer hover:opacity-70 transition-opacity"
          >
            <Heart />
            <CountBadge count={wishListCount} label="items saved" />
          </button>

          {/* CART */}
          <button
            type="button"
            onClick={() => openPanel("cart")}
            aria-label="Open cart"
            className="relative cursor-pointer hover:opacity-70 transition-opacity"
          >
            <ShoppingCart />
            <CountBadge count={cartCount} label="items in cart" />
          </button>
        </div>
      </header>

      {/* PANELS */}
      {isProfileSectionOpen && (
        <ProfileSection onClose={() => setIsProfileSectionOpen(false)} />
      )}

      {isWishListOpen && <WishList onClose={() => setIsWishListOpen(false)} />}

      {isCartOpen && <Cart onClose={() => setIsCartOpen(false)} />}

      {isSearchOpen && <SearchPanel onClose={() => setIsSearchOpen(false)} />}
    </>
  );
}

export default Header;
