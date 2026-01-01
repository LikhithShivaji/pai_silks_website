import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import footerBg from "@/assets/footerbgimage.webp";
import {
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Loader2,
} from "lucide-react";

const SignupPage = () => {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    user_name: "",
    pri_email: "",
    password: "",
    phone_number: "",
    address: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("https://pai-silks-website-1.onrender.com/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        alert("Account created successfully! Please login.");
        navigate("/login");
      } else {
        alert(data.message || "Signup failed. Please try again.");
      }
    } catch (error) {
      console.error("Signup Error:", error);
      alert("Server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FFF8F0] relative overflow-hidden font-['Poppins'] py-10">
      
      {/* Background Texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none bg-repeat"
        style={{ backgroundImage: `url(${footerBg})` }}
      />

      {/* Ambient Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-[#68232B]/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-[#FFCB85]/10 rounded-full blur-[100px]" />

      {/* Glass Card */}
      <div
        className="
          relative z-10
          w-full max-w-lg mx-4
          bg-white/60 backdrop-blur-xl
          border border-white/40
          rounded-[2.5rem]
          shadow-[0_20px_40px_rgba(104,35,43,0.1)]
          p-8 md:p-10
          animate-in fade-in zoom-in duration-500
        "
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-[#68232B]/5 rounded-2xl mb-4 text-[#68232B]">
            <Sparkles size={28} strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-bold text-[#68232B] mb-2">
            Create Account
          </h1>
          <p className="text-[#68232B]/60 text-sm">
            Join us to explore our exclusive collection
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} className="space-y-5">
          
          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#68232B] uppercase tracking-wider ml-1">
              Full Name
            </label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#68232B]/40 group-focus-within:text-[#68232B] transition-colors">
                <User size={20} />
              </div>
              <input
                type="text"
                name="user_name"
                value={formData.user_name}
                onChange={handleChange}
                placeholder="John Doe"
                required
                className="
                  w-full pl-12 pr-4 py-3 bg-white/50 border border-[#68232B]/10 rounded-2xl
                  text-[#68232B] placeholder:text-[#68232B]/30
                  focus:outline-none focus:border-[#68232B]/30 focus:ring-4 focus:ring-[#68232B]/5
                  transition-all duration-300
                "
              />
            </div>
          </div>

          {/* Email & Phone (Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#68232B] uppercase tracking-wider ml-1">
                Email
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#68232B]/40 group-focus-within:text-[#68232B] transition-colors">
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  name="pri_email"
                  value={formData.pri_email}
                  onChange={handleChange}
                  placeholder="name@mail.com"
                  required
                  className="
                    w-full pl-12 pr-4 py-3 bg-white/50 border border-[#68232B]/10 rounded-2xl
                    text-[#68232B] placeholder:text-[#68232B]/30
                    focus:outline-none focus:border-[#68232B]/30 focus:ring-4 focus:ring-[#68232B]/5
                    transition-all duration-300
                  "
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#68232B] uppercase tracking-wider ml-1">
                Phone
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#68232B]/40 group-focus-within:text-[#68232B] transition-colors">
                  <Phone size={20} />
                </div>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  placeholder="+91 98765..."
                  required
                  className="
                    w-full pl-12 pr-4 py-3 bg-white/50 border border-[#68232B]/10 rounded-2xl
                    text-[#68232B] placeholder:text-[#68232B]/30
                    focus:outline-none focus:border-[#68232B]/30 focus:ring-4 focus:ring-[#68232B]/5
                    transition-all duration-300
                  "
                />
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#68232B] uppercase tracking-wider ml-1">
              Password
            </label>
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
                minLength={6}
                className="
                  w-full pl-12 pr-12 py-3 bg-white/50 border border-[#68232B]/10 rounded-2xl
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

          {/* Address */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#68232B] uppercase tracking-wider ml-1">
              Address
            </label>
            <div className="relative group">
              <div className="absolute left-4 top-4 text-[#68232B]/40 group-focus-within:text-[#68232B] transition-colors">
                <MapPin size={20} />
              </div>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Enter your full shipping address..."
                required
                className="
                  w-full pl-12 pr-4 py-3 h-24 bg-white/50 border border-[#68232B]/10 rounded-2xl
                  text-[#68232B] placeholder:text-[#68232B]/30 resize-none
                  focus:outline-none focus:border-[#68232B]/30 focus:ring-4 focus:ring-[#68232B]/5
                  transition-all duration-300
                "
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="
              w-full py-4 rounded-2xl font-bold text-lg text-white
              shadow-lg shadow-orange-900/20
              bg-gradient-to-r from-[#FEDB87] to-[#BD7923]
              hover:brightness-110 hover:shadow-xl hover:-translate-y-0.5
              active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed
              transition-all duration-300
              flex items-center justify-center gap-2 mt-4
            "
          >
            {loading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <>
                Create Account <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-[#68232B]/70 text-sm">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-bold text-[#BD7923] hover:text-[#68232B] hover:underline transition-all"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;