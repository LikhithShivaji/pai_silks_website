import React from "react";
import Lottie from "lottie-react";
import premiumLoader from "../assets/lottie/animation.json";
import footerBg from "../assets/footerbgimage.svg";

const PageLoader = () => {
  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#FFF8F0] font-['Poppins']"
    >
      {/* Texture Background */}
      <div 
        className="absolute inset-0 opacity-[0.05] pointer-events-none bg-repeat"
        style={{ backgroundImage: `url(${footerBg})` }}
      />

      {/* Glass Container for Animation */}
      <div className="
        relative
        w-40 h-40
        flex items-center justify-center
        rounded-3xl
        border border-white/50
        shadow-[0_20px_40px_rgba(104,35,43,0.1)]
      ">
        <div className="w-32 h-32">
          <Lottie animationData={premiumLoader} loop={true} />
        </div>
      </div>

      {/* Loading Text */}
      <div className="mt-8 flex flex-col items-center">
        <h2 className="text-[#68232B] text-xl font-bold tracking-[0.2em] uppercase animate-pulse">
          Pai Silks
        </h2>
        <div className="h-0.5 w-12 bg-gradient-to-r from-[#FEDB87] to-[#BD7923] mt-2 rounded-full"></div>
      </div>
    </div>
  );
};

export default PageLoader;