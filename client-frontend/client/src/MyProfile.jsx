import React, { useState, useContext } from "react";
import { User, Mail, Phone, Calendar as CalendarIcon, Save, Edit3 } from "lucide-react";

// Keep your original imports
import Header from "./components/Header";
import Footer from "./components/Footer";
import { CartContext } from "./CartContext";

// Shadcn Imports (Ensure these components exist in your project)
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

  // --- Original State ---
  const [user, setUser] = useState({
    name: "Likhith Shivaji",
    email: "likhith@example.com",
    phone: "9876543210",
    dob: "2001-10-05",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // --- Original Handlers ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser((prev) => ({ ...prev, [name]: value }));
  };

  // --- New Date Handler for Calendar ---
  const handleDateSelect = (date) => {
    if (date) {
      // Create YYYY-MM-DD string using standard JS
      const offset = date.getTimezoneOffset();
      const localDate = new Date(date.getTime() - (offset * 60 * 1000));
      const formattedDate = localDate.toISOString().split('T')[0];
      
      setUser((prev) => ({ ...prev, dob: formattedDate }));
      setIsCalendarOpen(false); 
    }
  };

  const handleSave = async () => {
    try {
      // Your API call
      const response = await fetch("http://localhost:5000/api/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(user),
      });

      const result = await response.json();
      console.log("Update success:", result);

      setIsEditing(false); // Switch back to view mode after saving
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  // --- Helper for input styles ---
  // This switches the look based on isEditing state
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
      <div className="bg-white/5 backdrop-blur-md">
        <div className="h-2 w-full bg-[#68232B]" />
      <div className=" w-full flex items-center justify-center p-4 font-sans relative">
        
        {/* Optional: Background Texture Overlay if you have one, or just the color above */}
        
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

            {/* Form Fields */}
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
                  disabled={!isEditing}
                  className={getInputClass()}
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
                />
              </div>

              {/* DOB Field (Replaced with Shadcn Calendar) */}
              <div className="flex flex-col md:flex-row md:items-center justify-between py-4 border-b border-gray-100">
                <div className="flex items-center gap-4 text-gray-500 mb-2 md:mb-0">
                  <CalendarIcon className="w-5 h-5 text-[#68232B]" />
                  <span className="font-medium text-gray-600">Date of Birth</span>
                </div>
                
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button
                      disabled={!isEditing}
                      // We apply the exact same logic as 'getInputClass' but adapted for a button
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
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-10">
              {isEditing ? (
                <button 
                  onClick={()=>handleSave()}
                  className="w-full bg-[#68232B] hover:bg-[#8B2E39] text-[#FFCB85] font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-3"
                >
                  <span>Save Details</span>
                  <Save className="w-5 h-5" />
                </button>
              ) : (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="w-full bg-white/40 border-2 border-[#68232B] text-[#68232B] hover:bg-red-50 font-semibold py-4 px-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-3"
                >
                  <span>Update My Details</span>
                  <Edit3 className="w-5 h-5" />
                </button>
              )}
            </div>

          </div>
        </div>
      </div>
      </div>
      <Footer />
    </>
  );
};

export default MyProfile;