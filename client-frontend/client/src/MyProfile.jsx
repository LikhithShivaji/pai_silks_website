import React, { useState, useEffect, useContext } from "react";
import { User, Mail, Phone, Calendar as CalendarIcon, Save, Edit3, MapPinHouse, Loader2, ArrowLeft } from "lucide-react";

// Keep your original imports
import Header from "./components/Header";
import Footer from "./components/Footer";
import { CartContext } from "./CartContext";
import { CLIENT_API } from "@/config/api";
import { useNavigate, useLocation } from "react-router-dom";

// Shadcn Imports
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover";
import { Calendar } from "./components/ui/calendar";

const MyProfile = () => {
  // --- Original Context Logic ---
  const { cartItems, setCartItems, wishListItems, setWishListItems } = useContext(CartContext);
  const updateCart = (dynamicCartItem) => setCartItems(dynamicCartItem);
  const updateWishList = (dynamicWishListItem) => setWishListItems(dynamicWishListItem);

  const navigate = useNavigate();

  // API Base URL
  const API_BASE = CLIENT_API;

  // --- State ---
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({
    name: "",
    email: "",
    phone: "",
    // dob: "",
    address: ""
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // --- 1. FETCH USER DETAILS ON MOUNT ---
  useEffect(() => {
    const fetchUserDetails = async () => {
      const userId = localStorage.getItem("user_id");

      if (!userId) {
        console.warn("No User ID found. User might be guest.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/get-user-details/${userId}`);
        const result = await response.json();

        if (result.success && result.data) {
          const userData = result.data;
          
          // Map backend keys to frontend state
          setUser({
            name: userData.name || userData.customer_name || "",
            email: userData.email || userData.pri_email || "",
            phone: userData.phone || userData.pri_mobile || "",
            address: userData.address || userData.shipping_address || "",
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
  }, []);

  // --- Handlers ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser((prev) => ({ ...prev, [name]: value }));
  };

  // const handleDateSelect = (date) => {
  //   if (date) {
  //     // Create YYYY-MM-DD string using standard JS logic to avoid timezone shifts
  //     const offset = date.getTimezoneOffset();
  //     const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  //     const formattedDate = localDate.toISOString().split('T')[0];
      
  //     setUser((prev) => ({ ...prev, dob: formattedDate }));
  //     setIsCalendarOpen(false); 
  //   }
  // };

  const handleSave = async () => {
    const userId = localStorage.getItem("user_id");
    if (!userId) return;

    try {
      const response = await fetch(`${API_BASE}/api/update-profile`, {
        method: "PUT", // Usually update is PUT, but check your backend if it needs POST
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
            user_id: userId, // Pass ID so backend knows who to update
            ...user
        }),
      });

      const result = await response.json();

      if (result.success) {
        setIsEditing(false); // Switch back to view mode after saving
        // Optional: Show success toast here
      } else {
        alert("Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Network error");
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
      <Header
        cartItems={cartItems}
        onUpdate={updateCart}
        wishListItems={wishListItems}
        onWishListUpdate={updateWishList}
      />

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
                      placeholder="Add address"
                    />
                  </div>

                  {/* DOB Field */}
                  {/* <div className="hidden flex-col md:flex-row md:items-center justify-between py-4 border-b border-gray-100">
                    <div className="flex items-center gap-4 text-gray-500 mb-2 md:mb-0">
                      <CalendarIcon className="w-5 h-5 text-[#68232B]" />
                      <span className="font-medium text-gray-600">Date of Birth</span>
                    </div>
                    
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          disabled={!isEditing}
                          className={`gap-5 text-right font-semibold text-gray-900 w-full md:w-2/3 px-2 py-1 transition-all flex justify-end items-center ${
                            isEditing
                              ? "bg-red-50/50 border-none cursor-pointer rounded"
                              : "bg-transparent border-none cursor-default"
                          }`}
                        >
                          {user.dob ? (
                            new Date(user.dob).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })
                          ) : (
                            <span className="text-gray-400">Pick a date</span>
                          )}
                          <CalendarIcon className="w-5 h-5 text-[#68232B]" />
                        </button>
                      </PopoverTrigger>

                      <PopoverContent
                        className="w-auto p-0 bg-white border border-[#68232B]/20 shadow-xl rounded-xl"
                        align="end"
                      >
                        <Calendar
                          mode="single"
                          selected={user.dob ? new Date(user.dob) : undefined}
                          onSelect={handleDateSelect}
                          initialFocus
                          className="rounded-md border-none"
                          classNames={{
                            day_selected:
                              "bg-[#68232B] text-white hover:bg-[#68232B] focus:bg-[#68232B]",
                            day_today: "bg-red-50 text-[#68232B]",
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div> */}
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