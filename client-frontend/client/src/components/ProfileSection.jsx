import React, { useContext } from "react";
import footerBg from "../assets/footerbgimage.webp";
import { useNavigate } from "react-router-dom";
import { CartContext } from "../CartContext";
import { useAuth } from "../AuthContext";
import { 
  X, 
  User, 
  Package, 
  Info, 
  ChevronRight, 
  UserCircle, 
  LogIn,
  LogOut 
} from "lucide-react";

const Profile = ({ onClose }) => {
  const navigate = useNavigate();
  const { setCartItems, setWishListItems } = useContext(CartContext);

  // Auth comes from the SERVER, not localStorage.
  //
  // This was `setIsLoggedIn(!!localStorage.getItem("user_id"))`. That string
  // outlives the session cookie, so the header could greet a signed-out
  // customer by name and offer them Logout while every protected page bounced
  // them to /login. Observed exactly that on 2026-08-29. See CLAUDE.md CF-55.
  const { isAuthenticated, signOut, user } = useAuth();
  const isLoggedIn = isAuthenticated;

  const handleLogout = async () => {
    // signOut calls POST /api/logout, so the session row is flipped to LOGOUT
    // and the httpOnly cookies are cleared server-side. Clearing localStorage
    // alone never ended the session — it only hid it from this tab.
    //
    // It also removes `wishlist`, which this function used to leave behind: on
    // a shared device the next visitor saw the previous customer's saved items,
    // with names, prices and images. See CLAUDE.md CF-11.
    await signOut();

    setCartItems([]);
    setWishListItems([]);

    onClose();
    navigate("/");
    // No window.location.reload(). It ran synchronously in the same handler,
    // BEFORE React could commit the two setState calls above — so the clearing
    // never took effect and was pointless. AuthContext now holds the state, so
    // there is nothing to reload for. See CLAUDE.md CF-11.
  };

  // --- LOGIN LOGIC ---
  const handleLogin = () => {
    onClose();
    navigate("/login");
  };

  // Helper component for Navigation Items
  const NavItem = ({ icon: Icon, label, onClick }) => (
    <div
      onClick={onClick}
      className="
        group
        flex items-center justify-between
        p-4 mb-3
        bg-white/60 backdrop-blur-md
        border border-white/40
        rounded-xl
        cursor-pointer
        hover:shadow-lg hover:border-[#68232B]/20
        hover:-translate-y-0.5
        transition-all duration-300
      "
    >
      <div className="flex items-center gap-4">
        <div className="p-2 bg-[#68232B]/5 rounded-lg text-[#68232B] group-hover:bg-[#68232B] group-hover:text-[#FFCB85] transition-colors">
          <Icon size={20} />
        </div>
        <h3 className="text-[#68232B] font-semibold text-base m-0">{label}</h3>
      </div>
      <ChevronRight 
        size={20} 
        className="text-[#68232B]/40 group-hover:text-[#68232B] transition-colors"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300">
      
      <div
        className="
          fixed inset-y-0 left-0
          w-[85vw] sm:w-100
          bg-[#FFF8F0]/95 backdrop-blur-xl
          shadow-2xl
          flex flex-col
          font-['Poppins']
          animate-in slide-in-from-left duration-300
        "
      >
        <div 
          className="relative px-6 py-6 border-b border-[#68232B]/10 flex justify-between items-center bg-white/50"
          style={{ 
    backgroundImage: `url(${footerBg})`,
    backgroundSize: 'cover',   // 👈 Forces image to shrink to fit the box
    backgroundPosition: 'center', // 👈 Keeps the important part in the middle
    backgroundRepeat: 'no-repeat' // 👈 Prevents tiling if the box is huge
  }}
        >
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-cover bg-center"/>
          
          <div className="flex items-center gap-3 z-10">
            <div className="p-2 bg-[#68232B]/10 rounded-full text-[#FFCB85]">
                <User size={20} fill="#FFCB85" className="text-[#FFCB85]"/>
            </div>
            {/* The greeting is only shown once the SERVER has confirmed the
                session. localStorage supplies the display name — a nicety, not
                identity — and is only consulted when `isLoggedIn` is already
                true, so a leftover name can no longer imply a session that does
                not exist. See CLAUDE.md CF-55. */}
            {/* The name now comes from the SERVER — /api/verify-token returns
                `user_name` — rather than from localStorage, which the visitor
                can edit. CF-55 made the session the authority for whether
                someone is signed in; this closes the same gap for who they
                are. Falls back to "there" when the name is missing, so the
                greeting still reads naturally. See CLAUDE.md CF-46. */}
            <h2 className="text-xl font-bold text-[#FFCB85] tracking-wide">
              {isLoggedIn
                ? `Hello, ${user?.user_name?.split(" ")[0] || "there"}`
                : "Profile"}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="z-10 p-2 hover:bg-[#68232B]/10 rounded-full transition-colors text-[#FFCB85] cursor-pointer"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-[#FFCB85]/70 backdrop-blur-md">
          
          <div className="space-y-1">
            <NavItem 
              icon={Package} 
              label="My Orders" 
              onClick={(e) => {
                navigate(isLoggedIn ? "/my-orders" : "/login");
                onClose();
                e.stopPropagation();
              }} 
            />

            <NavItem 
              icon={UserCircle} 
              label="My Profile" 
              onClick={(e) => {
                navigate(isLoggedIn ? "/my-profile" : "/login");
                onClose();
                e.stopPropagation();
              }} 
            />

            <NavItem 
              icon={Info} 
              label="About Us" 
              onClick={(e) => {
                navigate("/about-us");
                onClose();
                e.stopPropagation();
              }} 
            />
          </div>

        </div>

        <div 
          className="p-6 border-t border-[#68232B]/10 bg-white/50 backdrop-blur-md" 
          style={{ 
    backgroundImage: `url(${footerBg})`,
    backgroundSize: 'cover',   // 👈 Forces image to shrink to fit the box
    backgroundPosition: 'center', // 👈 Keeps the important part in the middle
    backgroundRepeat: 'no-repeat' // 👈 Prevents tiling if the box is huge
  }}
        >
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="
                w-full h-14
                rounded-full
                font-bold text-lg text-white
                shadow-lg shadow-red-900/20
                bg-linear-to-r from-red-400 to-red-600
                hover:brightness-110
                active:scale-95
                transition-all duration-300
                flex items-center justify-center gap-2
                cursor-pointer
              "
            >
              <LogOut size={20} />
              Logout
            </button>
          ) : (
            <button
              onClick={handleLogin}
              className="
                w-full h-14
                rounded-full
                font-bold text-lg text-white
                shadow-lg shadow-orange-900/20
                bg-linear-to-r from-[#FEDB87] to-[#BD7923]
                hover:brightness-110
                active:scale-95
                transition-all duration-300
                flex items-center justify-center gap-2
                cursor-pointer
              "
            >
              <LogIn size={20} />
              Login / Register
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default Profile;