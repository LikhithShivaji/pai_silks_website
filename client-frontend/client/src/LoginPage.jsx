import React, { useState, useContext } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { CartContext } from "./CartContext";
import footerBg from "@/assets/footerbgimage.webp";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Loader2,
  ArrowLeft,
} from "lucide-react";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation(); 

  const { cartItems, wishListItems, setCartItems, setWishListItems } =
    useContext(CartContext);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // 1. Keep a backup of the Guest Cart before we do anything
    const guestCart = [...cartItems];

    try {
      const response = await fetch("https://pai-silks-website-1.onrender.com/api/customer-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            pri_email: formData.email, 
            passwd: formData.password
        }),
      });

      const data = await response.json();

      if (data.user_id) {
        const userId = data.user_id;
        const userName = data.name || data.customer_name || formData.email.split("@")[0];

        localStorage.setItem("user_id", userId);
        localStorage.setItem("user_name", userName);
        localStorage.setItem("user_email", formData.email);

        try {
            const syncPromises = [];

            // Sync Cart (Keep this as is)
            if (guestCart.length > 0) {
              guestCart.forEach(item => {
                syncPromises.push(
                    fetch("https://pai-silks-website-1.onrender.com/api/cart/add", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            user_id: userId,
                            product_id: item.id || item.product_id,
                            quantity: item.quantity || 1
                        })
                    })
                );
              });
            }

            // Sync Wishlist (Keep as is)
            if (wishListItems.length > 0) {
                wishListItems.forEach(item => {
                    syncPromises.push(
                        fetch("https://pai-silks-website-1.onrender.com/api/wishlist/add", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                user_id: userId,
                                product_id: item.id || item.product_id
                            })
                        })
                    );
                });
            }

            await Promise.all(syncPromises);

            // Fetch final server data
            const finalCartRes = await fetch(`https://pai-silks-website-1.onrender.com/api/cart/cart-data?user_id=${userId}`);
            const finalCartData = await finalCartRes.json();

            if(finalCartData.success) {
                const cleanCartData = finalCartData.data.map(serverItem => {
                    // 👇 SMART MERGE LOGIC STARTS HERE
                    // Try to find this item in our local guest cart
                    const localItem = guestCart.find(local => 
                        (local.id === serverItem.product_id) || 
                        (local.id === serverItem.id) ||
                        (local.product_id === serverItem.product_id)
                    );

                    // If we have a local quantity, prefer it (because it's the most recent user action)
                    // Otherwise use server quantity
                    const localQty = localItem ? Number(localItem.quantity) : 0;
                    const serverQty = Number(serverItem.quantity || 1);
                    
                    // Use the HIGHER of the two to be safe
                    const finalQty = Math.max(localQty, serverQty); 

                    return {
                        ...serverItem,
                        id: serverItem.product_id || serverItem.id, 
                        name: serverItem.product_name || serverItem.name,
                        image: serverItem.image_url || serverItem.product_image || serverItem.image || serverItem.image1,
                        quantity: finalQty, // <--- Using the smart quantity
                        discounted_price: Number(serverItem.discounted_price || serverItem.selling_price || serverItem.price || 0),
                        selling_price: Number(serverItem.selling_price || serverItem.price || 0)
                    };
                });

                setCartItems(cleanCartData);
            }

            // Wishlist fetch...
            const finalWishRes = await fetch(`https://pai-silks-website-1.onrender.com/api/wishlist/${userId}`);
            const finalWishData = await finalWishRes.json();
            if(finalWishData.success) setWishListItems(finalWishData.data);

        } catch (syncErr) {
            console.warn("Sync warning:", syncErr);
        }

        // Navigate
        if (guestCart.length > 0 || location.state?.from === "checkout") {
             navigate("/checkout");
        } else {
             navigate("/");
        }

      } else {
        alert(data.message || "Invalid Email or Password");
      }

    } catch (error) {
      console.error("Login Error:", error);
      alert("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FFF8F0] relative overflow-hidden font-['Poppins']">
      <button
          onClick={() => navigate("/")}
          className="absolute top-0 left-0 z-1 flex m-4 px-2 rounded-4xl bg-[#68232B] text-[#FEDB87] cursor-pointer font-bold justify-center gap-1 md:gap-3 items-center p-3 w-20 text-xs md:text-lg md:w-50 hover:shadow-xl hover:border-[#68232B]/20 hover:-translate-y-0.5"
        >
          <ArrowLeft /> <p>Back</p>
        </button>
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none bg-repeat"
        style={{ backgroundImage: `url(${footerBg})` }}
      />

      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-[#68232B]/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-[#FFCB85]/10 rounded-full blur-[100px]" />
      <div
        className="
          relative z-10 my-20
          w-full max-w-md mx-4
          bg-white/60 backdrop-blur-xl
          border border-white/40
          rounded-[2.5rem]
          shadow-[0_20px_40px_rgba(104,35,43,0.1)]
          p-8 md:p-10
          animate-in fade-in zoom-in duration-500
        "
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-[#68232B]/5 rounded-2xl mb-4 text-[#68232B]">
            <Sparkles size={28} strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-bold text-[#68232B] mb-2">
            Welcome Back
          </h1>
          <p className="text-[#68232B]/60 text-sm">
            Please enter your details to sign in
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#68232B] uppercase tracking-wider ml-1">
              Email Address
            </label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#68232B]/40 group-focus-within:text-[#68232B] transition-colors">
                <Mail size={20} />
              </div>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="hello@example.com"
                required
                className="
                  w-full pl-12 pr-4 py-4 bg-white/50 border border-[#68232B]/10 rounded-2xl
                  text-[#68232B] placeholder:text-[#68232B]/30
                  focus:outline-none focus:border-[#68232B]/30 focus:ring-4 focus:ring-[#68232B]/5
                  transition-all duration-300
                "
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="text-xs font-bold text-[#68232B] uppercase tracking-wider">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-[#BD7923] hover:text-[#68232B] transition-colors"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#68232B]/40 group-focus-within:text-[#68232B] transition-colors">
                <Lock size={20} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                className="
                  w-full pl-12 pr-12 py-4 bg-white/50 border border-[#68232B]/10 rounded-2xl
                  text-[#68232B] placeholder:text-[#68232B]/30
                  focus:outline-none focus:border-[#68232B]/30 focus:ring-4 focus:ring-[#68232B]/5
                  transition-all duration-300
                "
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#68232B]/40 hover:text-[#68232B] transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Login Button with Loading State */}
          <button
            type="submit"
            disabled={loading}
            className="
              w-full py-4 rounded-2xl font-bold text-lg text-white
              shadow-lg shadow-orange-900/20
              bg-linear-to-r from-[#FEDB87] to-[#BD7923]
              hover:brightness-110 hover:shadow-xl hover:-translate-y-0.5
              active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed
              transition-all duration-300
              flex items-center justify-center gap-2 mt-2
            "
          >
            {loading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <>
                Sign In <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center my-6">
          <p className="text-[#68232B]/70 text-sm">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="font-bold text-[#BD7923] hover:text-[#68232B] hover:underline transition-all"
            >
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
