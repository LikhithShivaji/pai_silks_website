import React, { useMemo } from "react";

const PeacockLoader = () => {
  
  // --- THE "SILK" GENERATOR ---
  // Generates 200+ overlapping strokes to create a soft, non-rectangular texture.
  const silkTexture = useMemo(() => {
    let d = "";
    const density = 100; // High density for realism
    
    for (let i = 0; i <= density; i++) {
      const t = i / density; // 0 (bottom) to 1 (top)
      const y = 180 - (t * 165); 
      
      // 1. ORGANIC SHAPE PROFILE
      // The classic "Peacock Spade" shape
      let width = 0;
      if (t < 0.15) width = 10 + (t * 20);      // Bottom fluff
      else if (t < 0.6) width = 15 + (t * 25);  // Neck
      else width = 38 - ((t - 0.6) * 20);       // Broad Eye area tapering off
      
      // 2. RANDOM VARIATION (The "Wispy" Look)
      // Real feathers are never perfect. We vary length and angle.
      const fuzz = (Math.random() * 8) - 4; 
      const finalW = width + fuzz;
      
      // 3. ANGLE CALCULATION
      // Barbs at the bottom stick out (flat), barbs at top point up (sharp)
      const angleY = y - (5 + (t * 15)); 

      // 4. DRAWING THE HAIRS
      // We start slightly INSIDE the stem (x=-1 / x=1) to overlap and hide the spine gap.
      
      // Left Barb (Curved Upwards)
      d += `M-0.5,${y} Q${-finalW * 0.4},${y} ${-finalW},${angleY} `;
      
      // Right Barb (Curved Upwards)
      d += `M0.5,${y} Q${finalW * 0.4},${y} ${finalW},${angleY} `;
    }
    return d;
  }, []);

  return (
    <div className="z-1000 fixed inset-0 flex flex-col items-center justify-center h-screen w-full font-['Poppins'] backdrop-blur-md bg-black/60">
      
      <svg 
        width="400" 
        height="320" 
        viewBox="0 0 400 320" 
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          {/* --- LUXURY GRADIENTS --- */}
          
          {/* 1. IRIDESCENT GOLD (The Feathers) */}
          <linearGradient id="iridGold" x1="0%" y1="100%" x2="100%" y2="0%">
             <stop offset="0%" stopColor="#8B4513" />   {/* Bronze Root */}
             <stop offset="40%" stopColor="#DAA520" />   {/* Goldenrod */}
             <stop offset="70%" stopColor="#FCEEB5" />   {/* Highlight */}
             <stop offset="100%" stopColor="#B8860B" />  {/* Dark Gold Tip */}
          </linearGradient>

          {/* 2. VELVET PUPIL (The Heart) */}
          <radialGradient id="velvetHeart" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#800020" />   {/* Ruby */}
            <stop offset="100%" stopColor="#2A0505" /> {/* Black-Red */}
          </radialGradient>

          {/* 3. COPPER IRIS */}
          <linearGradient id="copperSheen" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#CD853F" />
            <stop offset="100%" stopColor="#8B4513" />
          </linearGradient>

          {/* --- MASTER FEATHER --- */}
          <g id="SoftFeather">
            
            {/* Layer A: Bottom Fluff (The messy down feathers) */}
            <path 
              d="M0,175 Q-8,170 -12,155 M0,175 Q8,170 12,155 M0,170 Q-15,160 -18,140 M0,170 Q15,160 18,140" 
              stroke="#8B4513" strokeWidth="0.3" fill="none" opacity="0.6"
            />

            {/* Layer B: The Main Silk Texture (Generated Barbs) 
                opacity="0.8" allows them to blend softness */}
            <path 
              d={silkTexture} 
              stroke="url(#iridGold)" 
              strokeWidth="0.35" 
              strokeLinecap="round"
              fill="none" 
            //   opacity="0.85"
            />

            {/* Layer C: The Spine (Rachis) - Very thin and fades out */}
            <path 
              d="M0,180 L0,25" 
              stroke="#FFF8DC" 
              strokeWidth="0.8" 
              opacity="0.7"
            />

            {/* Layer D: THE JEWEL EYE */}
            <g transform="translate(0, 42)">
               
               {/* 1. Gold Halo (Soft Glow) */}
               <path 
                 d="M0,5 C-22,5 -25,-15 -18,-30 C-12,-40 0,-48 0,-48 C0,-48 12,-40 18,-30 C25,-15 22,5 0,5 Z" 
                 fill="#FFD700" opacity="0.12" filter="blur(1px)"
               />

               {/* 2. Iris (Kidney) */}
               <path 
                 d="M0,0 C-16,0 -19,-12 -12,-24 C-6,-30 6,-30 12,-24 C19,-12 16,0 0,0 Z" 
                 fill="url(#copperSheen)" 
                 stroke="#8B4513" strokeWidth="0.2"
               />

               {/* 3. Pupil (Inverted Heart) */}
               <path 
                 d="M0,-3 C-9,-3 -11,-13 0,-22 C11,-13 9,-3 0,-3 Z" 
                 fill="url(#velvetHeart)" 
               />

               {/* 4. Reflection (Wet look) */}
               <path d="M-4,-16 Q-2,-18 0,-16" stroke="white" strokeWidth="1.2" opacity="0.8" strokeLinecap="round" />
            </g>
          </g>
        </defs>

        {/* --- ANIMATION STAGE --- */}
        {/* Pivot Point: (200, 280) */}
        <g transform="translate(200, 20)">
          
          {/* Feather 1: Left */}
          <g className="feather-sway delay-1" style={{ transformOrigin: "0px 180px" }}>
            <use href="#SoftFeather" transform="scale(0.85)"/>
          </g>

          {/* Feather 2: Mid-Left */}
          <g className="feather-sway delay-2" style={{ transformOrigin: "0px 180px" }}>
             <use href="#SoftFeather" transform="scale(0.95)"/>
          </g>

          {/* Feather 3: Center (King) */}
          <g className="feather-sway delay-3" style={{ transformOrigin: "0px 180px" }}>
             <use href="#SoftFeather" transform="scale(1.1)"/>
          </g>

          {/* Feather 4: Mid-Right */}
          <g className="feather-sway delay-4" style={{ transformOrigin: "0px 180px" }}>
             <use href="#SoftFeather" transform="scale(0.95)"/>
          </g>

          {/* Feather 5: Right */}
          <g className="feather-sway delay-5" style={{ transformOrigin: "0px 180px" }}>
             <use href="#SoftFeather" transform="scale(0.85)"/>
          </g>

          {/* The Brooch (Hides the joint) */}
          <g className="z-50 relative">
             <circle cx="0" cy="180" r="8" fill="#500000" stroke="#FFD700" strokeWidth="1.5" />
             <circle cx="0" cy="180" r="3" fill="#FFD700" className="animate-pulse" />
          </g>

        </g>
      </svg>

      {/* Brand Name */}
      <div className="text-center -mt-6 z-10 relative">
        <h2 className="text-[#BD7923] text-xl font-bold tracking-[0.35em] uppercase drop-shadow-sm font-['Poppins']">
          Pai Silks
        </h2>
        <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-[#BD7923] to-transparent mx-auto mt-2 opacity-60"></div>
      </div>

      <style>{`
        /* --- ORGANIC EASING --- 
           Uses a custom bezier to create a "breath" effect.
           Fast open -> Slow hang time -> Fast close.
        */
        :root {
          --feather-ease: cubic-bezier(0.4, 0, 0.2, 1);
        }

        .delay-1 { animation: sway-1 5s var(--feather-ease) infinite; }
        .delay-2 { animation: sway-2 5s var(--feather-ease) infinite; }
        .delay-3 { animation: sway-3 5s var(--feather-ease) infinite; }
        .delay-4 { animation: sway-4 5s var(--feather-ease) infinite; }
        .delay-5 { animation: sway-5 5s var(--feather-ease) infinite; }

        @keyframes sway-1 {
          0%, 100% { transform: rotate(0deg) scale(0.8) translateY(20px); opacity: 0; }
          50% { transform: rotate(-65deg) scale(1) translateY(0); opacity: 1; }
        }
        @keyframes sway-2 {
          0%, 100% { transform: rotate(0deg) scale(0.8) translateY(20px); opacity: 0; }
          50% { transform: rotate(-32deg) scale(1) translateY(0); opacity: 1; }
        }
        @keyframes sway-3 {
          0%, 100% { transform: rotate(0deg) scale(0.8) translateY(20px); opacity: 0; }
          50% { transform: rotate(0deg) scale(1.15) translateY(-5px); opacity: 1; }
        }
        @keyframes sway-4 {
          0%, 100% { transform: rotate(0deg) scale(0.8) translateY(20px); opacity: 0; }
          50% { transform: rotate(32deg) scale(1) translateY(0); opacity: 1; }
        }
        @keyframes sway-5 {
          0%, 100% { transform: rotate(0deg) scale(0.8) translateY(20px); opacity: 0; }
          50% { transform: rotate(65deg) scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default PeacockLoader;