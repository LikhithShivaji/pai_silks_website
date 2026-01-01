import facebook from "../assets/Facebook.svg";
import instagram from "../assets/instagram.svg";
import whatsapp from "../assets/whatsapp.svg";
import footerBg from "../assets/footerbgimage.webp";
import { Input } from "./ui/input";

function Footer() {
  return (
    <>
      {/* MAIN FOOTER */}
      <footer
        className="
          font-['Poppins']
          text-white
          text-center
          py-8
          bg-no-repeat
          bg-cover
          bg-fixed
          bg-center
        "
        style={{ backgroundImage: `url(${footerBg})` }}
      >
        {/* NEWSLETTER */}
        <div
          className="
            mx-auto
            px-4 py-3
            w-fit
            bg-[#ffd596]
            text-[#111]
            rounded-[1.5rem]
            hidden
            sm:block
          "
        >
          <h2 className="my-2">Subscribe to our newsletter!</h2>

          <form className="flex items-center justify-center">
            <Input
              type="email"
              placeholder="Your Email address"
              required
              className="
                h-12
                w-80
                rounded-xl
                border-none
                px-4
                outline-none
                bg-white
              "
            />
            <button
              type="submit"
              className="
                ml-4
                h-12
                px-10

                bg-[#551920]
                text-white
                rounded-lg
              "
            >
              Subscribe
            </button>
          </form>
        </div>

        {/* QUICK LINKS + ABOUT */}
        <div
          className="
            flex
            justify-between
            px-5
            pt-8
            mx-auto
          "
        >
          {/* QUICK LINKS */}
          <div className="text-left flex flex-col gap-5 sm:gap-5">
            <h1 className="md:text-2xl text-lg">Quick Links</h1>
            <div className="flex flex-col">
              <p className="md:text-lg text-xs">Home</p>
              <p className="md:text-lg text-xs">About Us</p>
              <p className="md:text-lg text-xs">Categories</p>
              <p className="md:text-lg text-xs">All Products</p>
            </div>
          </div>

          {/* ABOUT */}
          <div className="text-right flex flex-col gap-5 sm:gap-5">
            <h1 className="md:text-2xl text-lg">About</h1>
            <div className="flex flex-col">
              <p className="md:text-lg text-xs">+91 98745 60759</p>
              <p className="md:text-lg text-xs">paisilks@gmail.com</p>
              <p className="md:text-lg text-xs">Opp. Old Bus Stand, Near</p>
              <p className="md:text-lg text-xs">Hemavathi statue, Hassan</p>
            </div>
          </div>
        </div>
      </footer>

      {/* GST + SOCIAL FOOTER */}
      <div className="bg-[#551920] h-10 flex flex-col sm:flex-row items-center justify-between text-white">
        <p className="text-center text-xs sm:text-base">
          Copyright © 2025 SHRIDHARA VENKATARAMANA PAI. All Rights Reserved
        </p>

        <div className="flex items-center">
          {[facebook, instagram, whatsapp].map((icon, index) => (
            <a
              key={index}
              href="#"
              className="
                h-8
                w-8
                mx-4
                flex
                items-center
                justify-center
              "
            >
              <img src={icon} alt="" className="w-full h-full object-contain" />
            </a>
          ))}
        </div>
      </div>
    </>
  );
}

export default Footer;
