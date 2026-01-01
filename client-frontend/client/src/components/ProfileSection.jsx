import React, { useState, useEffect, useContext } from "react";
import footerBg from "../assets/footerbgimnage.png";
import { useNavigate } from "react-router-dom";
import { CartContext } from "../CartContext"; 
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
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    setIsLoggedIn(!!userId); 
    // console.log(userId)
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_email");
    localStorage.removeItem("cart"); 
    
    setCartItems([]);
    setWishListItems([]);

    // 3. Update State & Navigate
    setIsLoggedIn(false);
    onClose();
    navigate("/"); 
    window.location.reload(); 
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
            <h2 className="text-xl font-bold text-[#FFCB85] tracking-wide">
              {isLoggedIn ? `Hello, ${localStorage.getItem("user_name")?.split(" ")[0] || "User"}` : "Profile"}
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