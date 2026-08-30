import React, { useState } from "react";
import logo from "../assets/logo.svg";
// Three SVG imports stood here — Heart.svg, ShoppingBag.svg and List.svg —
// superseded by the lucide-react icons imported below (Heart, ShoppingCart,
// Menu) and never removed. This was their ONLY importer, so the asset files
// went with them.
import ProfileSection from "./ProfileSection";
import Cart from "./Cart";
import WishList from "./WishList";
import headerBg from "../assets/backgroundimagenew.jpg";
import { ShoppingCart } from 'lucide-react';
import { Heart } from 'lucide-react';
import { Menu } from 'lucide-react';

// Takes no props. It used to accept cartItems/onUpdate/wishListItems/
// onWishListUpdate from all six pages purely to forward them to <Cart> and
// <WishList> — and both of those are `({ onClose })` and read CartContext
// directly, so every one of those props was discarded on arrival.
// See CLAUDE.md CF-34.
function Header() {
  const [isProfileSectionOpen, setIsProfileSectionOpen] = useState(false);
  const [isWishListOpen, setIsWishListOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

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
          onClick={() => {
            setIsProfileSectionOpen(true);
            setIsWishListOpen(false);
            setIsCartOpen(false);
          }}
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

        {/* CART + WISHLIST */}
        <div className="flex items-center z-[1] gap-5 px-5 text-[#4d0000] flex justify-center items-center">
          {/* WISHLIST */}
          <div
            className="h-6 w-6 px-4 cursor-pointer sm:10 sm:w-10 sm:px-2"
            onClick={() => {
              setIsWishListOpen(true);
              setIsCartOpen(false);
              setIsProfileSectionOpen(false);
            }}
          >
            <Heart/>
          </div>

          {/* CART */}

          <div
            className="h-6 w-6 px-4 cursor-pointer sm:10 sm:w-10 sm:px-2"
            onClick={() => {
              setIsCartOpen(true);
              setIsWishListOpen(false);
              setIsProfileSectionOpen(false);
            }}
          >
            <ShoppingCart/>
          </div>
        </div>
      </header>

      {/* PANELS */}
      {isProfileSectionOpen && (
        <ProfileSection onClose={() => setIsProfileSectionOpen(false)} />
      )}

      {isWishListOpen && <WishList onClose={() => setIsWishListOpen(false)} />}

      {isCartOpen && <Cart onClose={() => setIsCartOpen(false)} />}
    </>
  );
}

export default Header;
