import facebook from "../assets/Facebook.svg";
import instagram from "../assets/instagram.svg";
import whatsapp from "../assets/whatsapp.svg";
import footerBg from "../assets/footerbgimage.webp";
import { Input } from "./ui/input";

function Footer() {
  return (
    <>
      {/* --- MAIN FOOTER --- */}
      <footer
        className="
          font-['Poppins']
          text-white
          text-center
          py-12              /* Increased padding for elegance */
          bg-no-repeat
          bg-cover
          bg-fixed
          bg-center
          flex flex-col gap-10 /* Spacing between sections */
        "
        style={{ backgroundImage: `url(${footerBg})` }}
      >
        
        {/* 1. NEWSLETTER (Now visible on Mobile!) */}
        <div
          className="
            mx-auto
            w-[90%] md:w-fit
            px-6 py-6
            bg-[#ffd596]/95 backdrop-blur-sm  /* Glass effect */
            text-[#551920]
            rounded-[2rem]
            shadow-xl
            border border-white/20
          "
        >
          <h2 className="text-lg md:text-xl font-bold mb-4">
            Subscribe to our newsletter!
          </h2>

          <form className="flex flex-col md:flex-row items-center gap-3">
            <Input
              type="email"
              placeholder="Your Email address"
              required
              className="
                h-12
                w-full md:w-80
                rounded-xl
                border-none
                px-4
                outline-none
                bg-white
                text-black
                placeholder:text-gray-400
                shadow-inner
              "
            />
            <button
              type="submit"
              className="
                h-12
                w-full md:w-auto
                px-8
                bg-[#551920]
                text-white
                font-semibold
                rounded-xl
                shadow-lg
                hover:bg-[#6d2029]
                hover:scale-105
                active:scale-95
                transition-all duration-300
              "
            >
              Subscribe
            </button>
          </form>
        </div>

        {/* 2. LINKS & INFO */}
        <div
          className="
            grid grid-cols-2 
            gap-8
            px-6 md:px-6
            w-full max-w-8xl mx-auto
          "
        >
          {/* Left Column: Quick Links */}
          <div className="text-left flex flex-col gap-4">
            <h1 className="text-xl md:text-2xl font-bold relative inline-block w-fit">
              Quick Links
              <span className="absolute -bottom-1 left-0 w-1/2 h-0.5 bg-[#ffd596] rounded-full"></span>
            </h1>
            <div className="flex flex-col gap-2 text-sm md:text-lg text-white/80">
              <a href="/" className="hover:text-[#ffd596] hover:translate-x-1 transition-all w-fit">Home</a>
              <a href="/about-us" className="hover:text-[#ffd596] hover:translate-x-1 transition-all w-fit">About Us</a>
              <a href="/shop" className="hover:text-[#ffd596] hover:translate-x-1 transition-all w-fit">Categories</a>
              <a href="/shop" className="hover:text-[#ffd596] hover:translate-x-1 transition-all w-fit">All Products</a>
            </div>
          </div>

          {/* Right Column: About/Contact */}
          <div className="text-right flex flex-col gap-4 items-end">
            <h1 className="text-xl md:text-2xl font-bold relative inline-block w-fit">
              Contact
              <span className="absolute -bottom-1 right-0 w-1/2 h-0.5 bg-[#ffd596] rounded-full"></span>
            </h1>
            <div className="flex flex-col gap-2 text-sm md:text-lg text-white/80">
              <p className="hover:text-[#ffd596] transition-colors">+91 98745 60759</p>
              <p className="hover:text-[#ffd596] transition-colors">paisilks@gmail.com</p>
              <div className="mt-2">
                <p>Opp. Old Bus Stand, Near</p>
                <p>Hemavathi statue, Hassan</p>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* --- BOTTOM BAR --- */}
      <div className="bg-[#551920] py-4 px-5 flex flex-col-reverse md:flex-row items-center justify-between gap-4 text-white border-t border-white/10">
        <div className="flex flex-col items-center md:items-start gap-1">
            <p className="text-center md:text-left text-xs md:text-sm text-white/60">
              Copyright © 2025 SHRIDHARA VENKATARAMANA PAI. All Rights Reserved
            </p>
            
            {/* 👇 YOUR CREDIT LINE */}
            <a 
              href="mailto:codearctechsolutions@gmail.com" 
              className="text-[10px] md:text-xs text-[#ffd596] hover:scale-105 transition-all duration-300 cursor-pointer"
            >
              Designed by <b>CodeArc Tech Solutions</b>
            </a>
        </div>
        

        <div className="flex items-center gap-6">
          {[facebook, instagram, whatsapp].map((icon, index) => (
            <a
              key={index}
              href="#"
              className="
                h-8 w-8
                flex items-center justify-center
                hover:scale-125
                hover:brightness-125
                transition-all duration-300
              "
            >
              <img src={icon} alt="social" className="w-full h-full object-contain" />
            </a>
          ))}
        </div>
      </div>
    </>
  );
}

export default Footer;