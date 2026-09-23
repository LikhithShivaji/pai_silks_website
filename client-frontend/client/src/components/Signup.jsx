import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CLIENT_API, apiFetch } from "@/config/api";
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  getCountry,
  validateNationalNumber,
  toE164,
} from "@/config/phone";
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
  ArrowLeft,
} from "lucide-react";

const SignupPage = () => {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    user_name: "",
    pri_email: "",
    password: "",
    countryCode: DEFAULT_COUNTRY,
    phone_number: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  // Per-field messages. The form previously relied on `required` and a bare
  // minLength={6} — so "abc" was an acceptable phone number and the only
  // feedback on a bad value was whatever MySQL happened to say. See CF-45.
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear this field's error as soon as the user edits it, rather than
    // leaving a stale message under a field they have already corrected.
    if (errors[e.target.name]) {
      setErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
    }
  };

  /** @returns {object} field -> message, empty when the form is valid */
  const validateForm = () => {
    const next = {};

    const name = formData.user_name.trim();
    if (!name) next.user_name = "Name is required";
    else if (name.length > 50) next.user_name = "Name must be 50 characters or fewer";

    const email = formData.pri_email.trim();
    if (!email) next.pri_email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      next.pri_email = "Enter a valid email address";
    else if (email.length > 100) next.pri_email = "Email is too long";

    const phoneError = validateNationalNumber(formData.countryCode, formData.phone_number);
    if (phoneError) next.phone_number = phoneError;

    // Mirrors the server policy in appDefines.password. The 72-byte ceiling is
    // not arbitrary: bcrypt silently ignores anything past it, so a longer
    // password would give the user false confidence. See CB-28.
    if (!formData.password) next.password = "Password is required";
    else if (formData.password.length < 8)
      next.password = "Password must be at least 8 characters";
    else if (new Blob([formData.password]).size > 72)
      next.password = "Password is too long (maximum 72 bytes)";

    // Address is now required, along with the three parts that make it
    // deliverable. Mirrors validators.signup on the server — this is feedback,
    // the server is the boundary.
    const address = formData.address.trim();
    if (!address) next.address = "Address is required";
    else if (address.length > 500) next.address = "Address is too long";

    const city = formData.city.trim();
    if (!city) next.city = "City is required";
    else if (city.length > 100) next.city = "City is too long";

    const state = formData.state.trim();
    if (!state) next.state = "State is required";
    else if (state.length > 100) next.state = "State is too long";

    const pincode = formData.pincode.trim();
    if (!pincode) next.pincode = "PIN code is required";
    else if (!/^[1-9][0-9]{5}$/.test(pincode))
      next.pincode = "Enter a valid 6-digit PIN code";

    return next;
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    const found = validateForm();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);

    try {
      // countryCode is a UI concern only — the server stores one E.164 string.
      // `password` is the local form field; the API field is `passwd`, matching
      // both login endpoints. The signup endpoint used to accept `password`,
      // which made it the odd one out of the three auth endpoints.
      // See CLAUDE.md CB-40. LoginPage.jsx and AdminLogin.jsx map the same way.
      const { countryCode, phone_number, password, ...rest } = formData;
      const payload = {
        ...rest,
        passwd: password,
        phone_number: toE164(countryCode, phone_number),
      };

      const response = await apiFetch(`${CLIENT_API}/api/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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
      <button
          onClick={() => navigate("/")}
          className="absolute top-0 left-0 z-1 flex m-4 px-2 rounded-4xl bg-[#68232B] text-[#FEDB87] cursor-pointer font-bold justify-center gap-1 md:gap-3 items-center p-3 w-20 text-xs md:text-lg md:w-50 hover:shadow-xl hover:border-[#68232B]/20 hover:-translate-y-0.5"
        >
          <ArrowLeft /> <p>Back</p>
        </button>
      
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
          w-full max-w-lg mx-4 my-10
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
              {errors.user_name && (
                <p className="text-xs text-red-600 ml-1">{errors.user_name}</p>
              )}

          {/* Email and Phone each get their own full-width row.
              These were a 2-column grid, which squeezed the phone field — the
              country dropdown plus the number left almost no room for the
              number itself, so the placeholder was cut off mid-word.

              The email error node below was ALSO misplaced: it sat outside its
              field's wrapper but inside the grid, so an invalid email created a
              third grid cell and shunted the phone field onto the next row. */}
          <div className="flex flex-col gap-4">

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
              {errors.pri_email && (
                <p className="text-xs text-red-600 ml-1">{errors.pri_email}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#68232B] uppercase tracking-wider ml-1">
                Phone
              </label>
              {/* Country + national number. The dropdown removes the ambiguity
                  of a bare 10-digit number, which is valid in both supported
                  countries. See CLAUDE.md CF-45. */}
              <div className="flex gap-2">
                <select
                  name="countryCode"
                  value={formData.countryCode}
                  onChange={handleChange}
                  aria-label="Country calling code"
                  className="
                    shrink-0 px-3 py-3 bg-white/50 border border-[#68232B]/10 rounded-2xl
                    text-[#68232B]
                    focus:outline-none focus:border-[#68232B]/30 focus:ring-4 focus:ring-[#68232B]/5
                    transition-all duration-300
                  "
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.dial}
                    </option>
                  ))}
                </select>

                <div className="relative group flex-1">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#68232B]/40 group-focus-within:text-[#68232B] transition-colors">
                    <Phone size={20} />
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={14}
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    placeholder={`Ex: ${getCountry(formData.countryCode).example}`}
                    aria-invalid={Boolean(errors.phone_number)}
                    className={`
                      w-full pl-12 pr-4 py-3 bg-white/50 border rounded-2xl
                      text-[#68232B] placeholder:text-[#68232B]/30
                      focus:outline-none focus:ring-4 focus:ring-[#68232B]/5
                      transition-all duration-300
                      ${errors.phone_number
                        ? "border-red-400 focus:border-red-500"
                        : "border-[#68232B]/10 focus:border-[#68232B]/30"}
                    `}
                  />
                </div>
              </div>
              {errors.phone_number && (
                <p className="text-xs text-red-600 ml-1">{errors.phone_number}</p>
              )}
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
              {errors.password && (
                <p className="text-xs text-red-600 ml-1">{errors.password}</p>
              )}

          {/* Address.
              Street, city, state and PIN are captured SEPARATELY rather than as
              one free-text blob. Checkout has always asked for them as separate
              fields, so storing one string here meant the saved address could
              never prefill that form — there is no reliable way to split a
              typed line back into four parts, and guessing wrong puts a PIN in
              the state box. See migration 012. */}
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
                placeholder="House / flat number, street, area..."
                required
                aria-invalid={Boolean(errors.address)}
                className="
                  w-full pl-12 pr-4 py-3 h-24 bg-white/50 border border-[#68232B]/10 rounded-2xl
                  text-[#68232B] placeholder:text-[#68232B]/30 resize-none
                  focus:outline-none focus:border-[#68232B]/30 focus:ring-4 focus:ring-[#68232B]/5
                  transition-all duration-300
                "
              />
            </div>
            {errors.address && (
              <p className="text-xs text-red-600 ml-1">{errors.address}</p>
            )}
          </div>

          {/* City and State side by side, PIN on its own row — PIN is six
              characters and does not need half the form's width. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#68232B] uppercase tracking-wider ml-1">
                City
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Hassan"
                required
                aria-invalid={Boolean(errors.city)}
                className="
                  w-full px-4 py-3 bg-white/50 border border-[#68232B]/10 rounded-2xl
                  text-[#68232B] placeholder:text-[#68232B]/30
                  focus:outline-none focus:border-[#68232B]/30 focus:ring-4 focus:ring-[#68232B]/5
                  transition-all duration-300
                "
              />
              {errors.city && (
                <p className="text-xs text-red-600 ml-1">{errors.city}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#68232B] uppercase tracking-wider ml-1">
                State
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="Karnataka"
                required
                aria-invalid={Boolean(errors.state)}
                className="
                  w-full px-4 py-3 bg-white/50 border border-[#68232B]/10 rounded-2xl
                  text-[#68232B] placeholder:text-[#68232B]/30
                  focus:outline-none focus:border-[#68232B]/30 focus:ring-4 focus:ring-[#68232B]/5
                  transition-all duration-300
                "
              />
              {errors.state && (
                <p className="text-xs text-red-600 ml-1">{errors.state}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[#68232B] uppercase tracking-wider ml-1">
              PIN Code
            </label>
            {/* inputMode="numeric" brings up the number pad on a phone without
                making this type="number", which would let the browser strip a
                leading digit and attach a spinner to something that is not a
                quantity. maxLength stops the typo rather than reporting it. */}
            <input
              type="text"
              name="pincode"
              value={formData.pincode}
              onChange={handleChange}
              placeholder="573201"
              inputMode="numeric"
              maxLength={6}
              required
              aria-invalid={Boolean(errors.pincode)}
              className="
                w-full sm:w-48 px-4 py-3 bg-white/50 border border-[#68232B]/10 rounded-2xl
                text-[#68232B] placeholder:text-[#68232B]/30
                focus:outline-none focus:border-[#68232B]/30 focus:ring-4 focus:ring-[#68232B]/5
                transition-all duration-300
              "
            />
            {errors.pincode && (
              <p className="text-xs text-red-600 ml-1">{errors.pincode}</p>
            )}
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