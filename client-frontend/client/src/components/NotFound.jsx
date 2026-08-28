import React, { useContext } from "react";
import { Link } from "react-router-dom";

import Header from "./Header";
import Footer from "./Footer";
import { CartContext } from "../CartContext";

/**
 * 404 page.
 *
 * Until now the router had no `path="*"`, so any URL that did not match one of
 * the ten declared routes rendered a completely blank white page — no header,
 * no footer, no way back. See CLAUDE.md CF-08.
 *
 * That was reachable by ordinary means, not just typos: the "Forgot Password?"
 * link on the login page pointed at a route that did not exist, so a customer
 * who could not remember their password hit a white screen and had no path
 * forward at all.
 *
 * Header and Footer are mounted deliberately. A 404 that keeps the shop's
 * navigation is a recoverable dead end; one that does not is where the visit
 * ends.
 */
const NotFound = () => {
  const { cartItems, setCartItems, wishListItems, setWishListItems } =
    useContext(CartContext);

  return (
    <div className="font-['Poppins'] flex flex-col min-h-screen">
      <Header
        cartItems={cartItems}
        onUpdate={setCartItems}
        wishListItems={wishListItems}
        onWishListUpdate={setWishListItems}
      />

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <p className="text-6xl md:text-8xl font-bold text-[#551920]">404</p>

        <h1 className="mt-4 text-2xl md:text-3xl font-semibold text-[#551920]">
          This page doesn&apos;t exist
        </h1>

        <p className="mt-3 max-w-md text-sm md:text-base text-black/60">
          The page you were looking for may have been moved, or the link you
          followed may be out of date.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link
            to="/"
            className="px-6 py-3 rounded-full bg-[#551920] text-white text-sm md:text-base hover:opacity-90 transition-opacity"
          >
            Back to Home
          </Link>
          <Link
            to="/shop"
            className="px-6 py-3 rounded-full border border-[#551920] text-[#551920] text-sm md:text-base hover:bg-[#551920] hover:text-white transition-colors"
          >
            Browse Sarees
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default NotFound;
