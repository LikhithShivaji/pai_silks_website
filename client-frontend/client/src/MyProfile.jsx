import React, { useState, useEffect } from "react";
import { User, Mail, Phone, Save, Edit3, MapPinHouse, Loader2, ArrowLeft } from "lucide-react";

// Keep your original imports
import Header from "./components/Header";
import Footer from "./components/Footer";
import { useAuth } from "./AuthContext";
import { CLIENT_API, apiFetch } from "@/config/api";
import { useNavigate } from "react-router-dom";

// The Popover + Calendar imports that used to sit here backed a Date-of-Birth
// field that was commented out of the JSX. Because the imports stayed live,
// Vite still pulled react-day-picker and date-fns into the customer bundle for
// a control nobody could see. Removing them lets both packages leave
// package.json. If DOB is ever wanted, it needs a `dob` column on `customers`
// and a field in the update endpoint first — neither exists. See CLAUDE.md CF-40.

const MyProfile = () => {
  // The CartContext destructure and the updateCart/updateWishList wrappers that
  // stood here existed only to be handed to <Header>, which discarded them.
  // CF-34.
  const { isAuthenticated } = useAuth();

  const navigate = useNavigate();

  // `const API_BASE = CLIENT_API` was removed and CLIENT_API is now used
  // directly. The alias was re-created on every render, so the effect below
  // took it as a dependency it did not declare — a react-hooks/exhaustive-deps
  // warning. CLIENT_API is a module-level constant read once from
  // import.meta.env, so it belongs outside the component entirely, and using it
  // directly removes the dependency rather than suppressing the warning.

  // --- State ---
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({
    name: "",
    email: "",
    phone: "",
    // dob: "",
    address: "",
    city: "",
    state: "",
    pincode: ""
  });

  const [isEditing, setIsEditing] = useState(false);

  // --- 1. FETCH USER DETAILS ON MOUNT ---
  useEffect(() => {
    const fetchUserDetails = async () => {
      // Server-confirmed, not localStorage. This page is behind PrivateRoute,
      // so the guard only avoids a request during the "checking" window.
      // See CLAUDE.md CF-55.
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        const response = await apiFetch(`${CLIENT_API}/api/me`);
        const result = await response.json();

        if (result.success && result.data) {
          const userData = result.data;
          
          // Map backend keys to frontend state
          setUser({
            name: userData.name || userData.customer_name || "",
            email: userData.email || userData.pri_email || "",
            phone: userData.phone || userData.pri_mobile || "",
            address: userData.address || userData.shipping_address || "",
            city: userData.city || "",
            state: userData.state || "",
            pincode: userData.pincode || "",
            // Handle date formatting safely
            // dob: userData.dob ? userData.dob.split("T")[0] : "", 
          });
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
    // Re-runs when auth resolves — an empty array fired before
    // /api/verify-token had answered and gave up permanently.
  }, [isAuthenticated]);

  // --- Handlers ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser((prev) => ({ ...prev, [name]: value }));
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // Send the three editable fields by name, not `{...user}`.
      //
      // The spread shipped whatever happened to be in state — including `email`,
      // which is read-only, and anything a later feature adds to this object.
      // The server ignores unknown keys, but a payload that quietly grows is how
      // a field nobody meant to expose ends up being written.
      const response = await apiFetch(`${CLIENT_API}/api/update-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.name,
          phone: user.phone,
          address: user.address,
          // These MUST be sent even when unchanged. The server stores an absent
          // value as NULL (one representation for "not set"), so omitting them
          // here would silently wipe the customer's city, state and PIN every
          // time they edited their name.
          city: user.city,
          state: user.state,
          pincode: user.pincode,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Render what the server stored, not the optimistic local copy — they
        // differ whenever the server trims or normalises a value.
        if (result.data) setUser(result.data);
        setIsEditing(false);
      } else {
        // Surface the real reason. This used to be a flat "Failed to update
        // profile", which told a customer with a bad phone number nothing at
        // all about what to change.
        //
        // `message` is already the first validation error — validate.js sets
        // it from errors[0].message — so no need to dig into the array.
        alert(result.message || "Failed to update profile.");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Could not reach the server. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Helper for input styles ---
  const getInputClass = () => {
    return isEditing
      ? "text-right font-semibold text-gray-900 bg-red-50/50 border-b-2 border-red-200 focus:border-[#68232B] focus:outline-none w-full md:w-2/3 px-2 py-1 rounded transition-all"
      : "text-right font-semibold text-gray-900 bg-transparent border-none w-full md:w-2/3 px-2 py-1 cursor-default focus:ring-0";
  };

  return (
    <>
      <Header />

      {/* Main Background Section */}
      <div className="bg-white/5 backdrop-blur-md min-h-screen">

      <button
          onClick={() => navigate("/")}
          className="hidden md:flex m-4 px-2 bg-white/80 rounded-4xl hover:bg-[#68232B] hover:text-[#FEDB87] cursor-pointer font-bold justify-center gap-3 items-center p-3 w-50"
        >
          <ArrowLeft /> <p>Back</p>
        </button>

        <div className="h-2 w-full bg-[#68232B]" />
        
        <div className="w-full flex items-center justify-center p-4 font-sans relative">
          
          {/* Glassmorphism Card */}
          <div className="bg-white/30 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 w-full max-w-2xl rounded-3xl overflow-hidden relative mt-8 mb-8">

            <div className="p-8 md:p-12">
              
              {/* Card Header */}
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h2 className="text-3xl font-bold text-[#68232B] tracking-tight">My Profile</h2>
                  <p className="text-sm text-gray-500 mt-1">Manage your personal details</p>
                </div>
                <div className="p-3 bg-red-50 rounded-full text-[#68232B]">
                  <User className="w-6 h-6" />
                </div>
              </div>

              {/* LOADING STATE */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                   <Loader2 className="w-10 h-10 animate-spin mb-4 text-[#68232B]" />
                   <p>Loading profile...</p>
                </div>
              ) : (
                /* FORM CONTENT */
                <div className="space-y-6">
                  
                  {/* Name Field */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between py-4 border-b border-gray-100">
                    <div className="flex items-center gap-4 text-gray-500 mb-2 md:mb-0">
                      <User className="w-5 h-5 text-[#68232B]" />
                      <span className="font-medium text-gray-600">Name</span>
                    </div>
                    <input
                      type="text"
                      name="name"
                      value={user.name}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={getInputClass()}
                      placeholder="Enter your name"
                    />
                  </div>

                  {/* Email Field */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between py-4 border-b border-gray-100">
                    <div className="flex items-center gap-4 text-gray-500 mb-2 md:mb-0">
                      <Mail className="w-5 h-5 text-[#68232B]" />
                      <span className="font-medium text-gray-600">Email</span>
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={user.email}
                      onChange={handleChange}
                      disabled={true} // Usually email is read-only or requires verify
                      className={`${getInputClass()} opacity-60 cursor-not-allowed`}
                      title="Email cannot be changed"
                    />
                  </div>

                  {/* Phone Field */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between py-4 border-b border-gray-100">
                    <div className="flex items-center gap-4 text-gray-500 mb-2 md:mb-0">
                      <Phone className="w-5 h-5 text-[#68232B]" />
                      <span className="font-medium text-gray-600">Phone</span>
                    </div>
                    <input
                      type="tel"
                      name="phone"
                      value={user.phone}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={getInputClass()}
                      placeholder="Add phone number"
                    />
                  </div>

                  {/* Address Field */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between py-4 border-b border-gray-100">
                    <div className="flex items-center gap-4 text-gray-500 mb-2 md:mb-0">
                      <MapPinHouse className="w-5 h-5 text-[#68232B]" />
                      <span className="font-medium text-gray-600">Address</span>
                    </div>
                    <input
                      type="text"
                      name="address"
                      value={user.address}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={getInputClass()}
                      placeholder="House / flat number, street, area"
                    />
                  </div>

                  {/* City / State / PIN.
                      Stored separately from the street line (migration 012) so
                      a saved address can prefill the checkout form, which has
                      always asked for these as distinct fields. Editable here
                      rather than read-only: the API accepts them, and a field
                      the customer can see but never change is worse than one
                      that is absent. */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between py-4 border-b border-gray-100">
                    <div className="flex items-center gap-4 text-gray-500 mb-2 md:mb-0">
                      <MapPinHouse className="w-5 h-5 text-[#68232B]" />
                      <span className="font-medium text-gray-600">City</span>
                    </div>
                    <input
                      type="text"
                      name="city"
                      value={user.city}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={getInputClass()}
                      placeholder="Add city"
                    />
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between py-4 border-b border-gray-100">
                    <div className="flex items-center gap-4 text-gray-500 mb-2 md:mb-0">
                      <MapPinHouse className="w-5 h-5 text-[#68232B]" />
                      <span className="font-medium text-gray-600">State</span>
                    </div>
                    <input
                      type="text"
                      name="state"
                      value={user.state}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={getInputClass()}
                      placeholder="Add state"
                    />
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between py-4 border-b border-gray-100">
                    <div className="flex items-center gap-4 text-gray-500 mb-2 md:mb-0">
                      <MapPinHouse className="w-5 h-5 text-[#68232B]" />
                      <span className="font-medium text-gray-600">PIN Code</span>
                    </div>
                    {/* Not type="number": a PIN is an identifier, not a
                        quantity — a spinner and thousands separators are both
                        wrong for it. */}
                    <input
                      type="text"
                      name="pincode"
                      value={user.pincode}
                      onChange={handleChange}
                      disabled={!isEditing}
                      inputMode="numeric"
                      maxLength={6}
                      className={getInputClass()}
                      placeholder="Add PIN code"
                    />
                  </div>

                </div>
              )}

              {/* Action Buttons */}
              {!loading && (
                <div className="mt-10">
                  {isEditing ? (
                    <button 
                      onClick={handleSave}
                      className="w-full bg-[#68232B] hover:bg-[#8B2E39] text-[#FFCB85] font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer"
                    >
                      <span>Save Details</span>
                      <Save className="w-5 h-5" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="w-full bg-white/40 border-2 border-[#68232B] text-[#68232B] hover:bg-red-50 font-semibold py-4 px-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer"
                    >
                      <span>Update My Details</span>
                      <Edit3 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default MyProfile;