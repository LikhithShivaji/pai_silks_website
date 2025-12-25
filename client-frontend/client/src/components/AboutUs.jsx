import React, { useContext } from "react";
import Header from "./Header";
import Footer from "./Footer";

import AboutUsImage from "../assets/aboutusimage.png";
import whatsapp from "../assets/whatsapp.svg";
import instagram from "../assets/instagram.svg";
import call from "../assets/call.svg";
import maps from "../assets/map-trifold.svg";

import { CartContext } from "../CartContext";

// Using the pattern as a subtle texture overlay instead of a heavy background
import footerBgPattern from "@/assets/footerbgimage.svg";

const AboutUs = () => {
  const { cartItems, setCartItems, wishListItems, setWishListItems } =
    useContext(CartContext);

  const updateCart = (dynamicCartItem) => setCartItems(dynamicCartItem);
  const updateWishList = (dynamicWishListItem) =>
    setWishListItems(dynamicWishListItem);

  const socialIcons = [
    { icon: whatsapp, alt: "WhatsApp" },
    { icon: instagram, alt: "Instagram" },
    { icon: call, alt: "Call Us" },
    { icon: maps, alt: "Locate Us" },
  ];

  return (
    <div className="min-h-screen backdrop-blur-md font-['Poppins']">
      <Header
        cartItems={cartItems}
        onUpdate={updateCart}
        wishListItems={wishListItems}
        onWishListUpdate={updateWishList}
      />

        <div className="h-2 w-full bg-[#68232B]" />
      {/* --- Main Content Wrapper with subtle pattern overlay --- */}
      <div 
        className="relative w-full py-16 md:py-24 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center"
      >
        
         {/* Subtle Texture Overlay */}
         <div 
            className="absolute inset-0 opacity-[0.03] bg-center bg-repeat pointer-events-none"
            style={{ backgroundImage: `url(${footerBgPattern})` }}
         />
        {/* --- Premium Glassmorphism About Card --- */}
        <div
          className="
            relative
            max-w-6xl
            w-full
            bg-white/30
            backdrop-blur-xl       
            border border-white/40   
            rounded-[3rem]  
            shadow-[0_20px_60px_-15px_rgba(104,35,43,0.15)]
            overflow-hidden
            flex flex-col lg:flex-row
            items-center
            gap-8 lg:gap-16
            p-8 lg:p-12
          "
        >
          {/* IMAGE SECTION */}
          <div className="w-full lg:w-1/2 flex-shrink-0 relative group">
            {/* Decorative Gold Frame effect underneath */}
            <div className="absolute inset-0 bg-[#FFCB85] rounded-[2.5rem] rotate-3 opacity-30 group-hover:rotate-6 transition-transform duration-500 -z-10 blur-sm"></div>
            
            <div
              className="
                aspect-[4/3] lg:aspect-square
                rounded-[2.5rem]
                overflow-hidden
                shadow-lg
                border-[3px] border-white/80
              "
            >
              <img
                src={AboutUsImage}
                alt="Pai Silks Store"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
          </div>

          {/* DESCRIPTION SECTION */}
          <div className="w-full lg:w-1/2 flex flex-col text-[#68232B] text-left">
            
            {/* Heading with decorative element */}
            <div className="mb-8 relative">
                <h5 className="text-[#ffa939] font-medium tracking-widest uppercase mb-2">Our Story</h5>
                <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
                  About Pai Silks
                </h1>
                {/* Elegant separator line instead of underline */}
                <div className="h-1 w-60 bg-gradient-to-r from-[#68232B] to-[#FFCB85] rounded-full mt-4"></div>
            </div>

            <div className="text-lg leading-relaxed opacity-90 space-y-6 font-medium">
              <p>
                At Pai Silks, tradition meets elegance. For decades, we have been
                dedicated to bringing the timeless beauty of silk to every
                occasion.
              </p>
              <p>
                Known for our uncompromising quality and craftsmanship, Pai Silks
                has become a trusted name for customers who seek authentic silk
                sarees, contemporary designs, and handpicked collections that
                celebrate India’s rich textile heritage.
              </p>
              <p>
                From classic Kanjeevaram sarees to modern designer drapes, each
                piece at Pai Silks is curated with care, ensuring that every fabric
                tells a story of artistry, culture, and sophistication.
              </p>
            </div>
          </div>
        </div>

        {/* --- REACH US SECTION --- */}
        <div className="text-center text-[#68232B] mt-20 relative z-10">
          <h2 className="text-3xl font-bold mb-10">
            Reach Us At
          </h2>

          <div className="flex flex-wrap justify-center items-center gap-6">
            {socialIcons.map((item, index) => (
              <div
                key={index}
                className="
                  group
                  w-16 h-16
                  rounded-full
                  bg-[#6b5c5e]
                  border-[#6b5c5e]
                  border-2 border-[#68232B]/30
                  flex items-center justify-center
                  p-4
                  cursor-pointer
                  shadow-md
                  transition-all duration-300
                  hover:bg-[#6f121d]
                  hover:border-[#6f121d]
                  hover:-translate-y-2
                  hover:shadow-xl
                "
              >
                <img 
                    src={item.icon} 
                    alt={item.alt} 
                    className="w-full h-full object-contain transition-all duration-300 group-hover:brightness-0 group-hover:invert-[.85] group-hover:sepia-[.2] group-hover:saturate-[3] group-hover:hue-rotate-[330deg]" 
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default AboutUs;