import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { Mail, Phone } from "lucide-react";

import Header from "./Header";
import Footer from "./Footer";
import { CartContext } from "../CartContext";

/**
 * Password-reset help page.
 *
 * `LoginPage.jsx` has always linked to /forgot-password, and that route has
 * never existed — clicking it rendered a blank white page. See CLAUDE.md CF-08.
 *
 * This is NOT a self-service reset, and it deliberately does not pretend to be.
 * A real reset needs an outbound email channel (SMTP credentials, a sender
 * domain, a single-use expiring token table) and none of that is configured.
 * Shipping a form that silently does nothing would be worse than the blank
 * page it replaces, because the customer would believe an email was sent.
 *
 * So the page tells the truth and routes the customer to a human, using the
 * shop's real contact details — the same ones in the footer. Self-service reset
 * is logged as deferred work in CLAUDE.md.
 */
const SHOP_EMAIL = "paisilks@gmail.com";
const SHOP_PHONE = "+91 98745 60759";

const ForgotPassword = () => {
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

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl md:text-3xl font-semibold text-[#551920]">
            Reset your password
          </h1>

          <p className="mt-4 text-sm md:text-base text-black/70 leading-relaxed">
            We can&apos;t reset your password automatically just yet. Get in
            touch and we&apos;ll restore access to your account.
          </p>

          <div className="mt-8 flex flex-col gap-3 text-left">
            <a
              href={`mailto:${SHOP_EMAIL}?subject=Password%20reset%20request`}
              className="flex items-center gap-3 px-5 py-4 rounded-xl border border-[#551920]/20 hover:border-[#551920] transition-colors"
            >
              <Mail className="w-5 h-5 text-[#551920] shrink-0" />
              <span className="text-sm md:text-base text-[#551920] break-all">
                {SHOP_EMAIL}
              </span>
            </a>

            <a
              href={`tel:${SHOP_PHONE.replace(/\s/g, "")}`}
              className="flex items-center gap-3 px-5 py-4 rounded-xl border border-[#551920]/20 hover:border-[#551920] transition-colors"
            >
              <Phone className="w-5 h-5 text-[#551920] shrink-0" />
              <span className="text-sm md:text-base text-[#551920]">
                {SHOP_PHONE}
              </span>
            </a>
          </div>

          <p className="mt-6 text-xs text-black/50">
            Please write from the email address on your account so we can
            confirm it&apos;s you.
          </p>

          <Link
            to="/login"
            className="mt-8 inline-block text-sm text-[#551920] underline underline-offset-4 hover:opacity-70"
          >
            Back to Login
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ForgotPassword;
