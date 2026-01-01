import React, { useEffect, useState, useContext } from "react";
import { Package, Calendar, ChevronRight, Clock, CheckCircle, Loader2, ShoppingBag } from "lucide-react";

import { CartContext } from "@/CartContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const OrderCard = ({ order }) => {
  const status = order.order_status || order.status || "Pending";
  const price = order.total_amount || order.price || 0;
  const dateStr = order.created_at || order.order_date || new Date().toISOString();
  const orderId = order.id || order.order_id || "N/A";
  
  // --- SMART ITEM DETECTION ---
  const firstItem = order.items && order.items.length > 0 ? order.items[0] : null;

  // 1. Try to find the image (looking in multiple places)
  const displayImage = firstItem?.image || firstItem?.product_image || firstItem?.product?.image || "https://placehold.co/150?text=Package";
  
  // 2. Try to find the Name (The Fix for "Undefined")
  // It checks: product_name, then name, then product.name, then fallback.
  const rawName = firstItem?.product_name || firstItem?.name || firstItem?.product?.name || "Unknown Product";
  
  const displayName = firstItem 
    ? `${rawName} ${order.items.length > 1 ? `+ ${order.items.length - 1} others` : ""}` 
    : `Order #${orderId}`;

  const getStatusStyle = (s) => {
    switch (s) {
      case "Delivered": return "bg-green-100 text-green-700 border-green-200";
      case "Pending": return "bg-amber-100 text-amber-700 border-amber-200";
      case "Shipped": return "bg-blue-100 text-blue-700 border-blue-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  // Format date for display
  const displayDate = new Date(dateStr).toLocaleDateString("en-IN", {
    year: "numeric", month: "short", day: "numeric"
  });

  return (
    <div className="group flex flex-col md:flex-row items-center gap-6 p-6 mb-6 bg-white/40 backdrop-blur-md border border-white/40 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300">
      
      {/* Image Section */}
      <div className="relative w-full md:w-32 aspect-4/5 md:aspect-square shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-white flex items-center justify-center">
        <img 
          src={displayImage} 
          alt={displayName} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          onError={(e) => { e.target.src = "https://placehold.co/150?text=PaiSilks"; }} 
        />
      </div>

      {/* Info Section */}
      <div className="flex-1 w-full text-center md:text-left">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2">
          <h3 className="text-xl font-bold text-[#68232B] font-['Poppins']">
            {displayName}
          </h3>
          
          {/* Status Badge */}
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusStyle(status)} mt-2 md:mt-0 flex items-center gap-1 mx-auto md:mx-0`}>
             {status === "Delivered" ? <CheckCircle size={12}/> : <Clock size={12}/>}
             {status}
          </span>
        </div>

        <p className="text-sm text-gray-500 mb-4 flex items-center justify-center md:justify-start gap-2">
          <span className="font-medium">Order ID:</span> {orderId}
          <span className="text-gray-300">|</span>
          <Calendar size={14} /> {displayDate}
        </p>

        {/* Price & Qty Row */}
        <div className="flex items-center justify-center md:justify-start gap-8 border-t border-[#68232B]/10 pt-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Total Amount</p>
            <p className="font-bold text-[#68232B] text-lg">₹ {price}</p>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="w-full md:w-auto mt-4 md:mt-0">
        <button className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white border border-[#68232B]/30 text-[#68232B] font-medium hover:bg-[#68232B] hover:text-[#FFCB85] transition-all duration-300 shadow-sm cursor-pointer">
          View Details
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};


// --- Main Component ---
const MyOrders = () => {
  const { cartItems, setCartItems, wishListItems, setWishListItems } = useContext(CartContext);
  
  const updateCart = (dynamicCartItem) => setCartItems(dynamicCartItem);
  const updateWishList = (dynamicWishListItem) => setWishListItems(dynamicWishListItem);

  const [recentOrders, setRecentOrders] = useState([]);
  const [previousOrders, setPreviousOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- FETCH & FILTER LOGIC ---
  useEffect(() => {
    const fetchAndSortOrders = async () => {
      const userId = localStorage.getItem("user_id");
      
      // 1. Log the ID we are asking for
      // console.log(`👤 Checking orders for User ID: ${userId} on Server -1`);

      if (!userId) {
        console.warn("⛔ No 'user_id' found in localStorage.");
        setLoading(false);
        return; 
      }

      try {
        // ✅ Keeping your correct -1 URL
        const response = await fetch(`https://pai-silks-website-1.onrender.com/api/orders/user/${userId}`);
        
        if (!response.ok) {
           throw new Error(`Server Error: ${response.status}`);
        }

        const result = await response.json();
        
        // 🛑 IMPORTANT: Look at this log in your Console!
        // console.log("📦 RAW API RESPONSE:", result);

        // 2. Universal Data Finder (catches all common backend wrappers)
        let allOrders = [];
        
        if (Array.isArray(result)) {
            allOrders = result;
        } else if (result.data && Array.isArray(result.data)) {
            allOrders = result.data;
        } else if (result.orders && Array.isArray(result.orders)) {
            allOrders = result.orders;
        } else if (result.order && Array.isArray(result.order)) { // Common typo fix
            allOrders = result.order;
        }

        // console.log(`📊 Found ${allOrders.length} orders to map.`);

        // 3. Filter Logic (Safe Date Parsing)
        let today = new Date();
        const recent = [];
        const previous = [];

        allOrders.forEach((item) => {
          // Fallback to 'created_at', 'order_date', 'date', or NOW.
          const rawDate = item.created_at || item.order_date || item.date || new Date();
          const orderDate = new Date(rawDate);
          
          // Calculate difference safely
          const diffTime = Math.abs(today - orderDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

          if (diffDays <= 30) {
            recent.push(item);
          } else {
            previous.push(item);
          }
        });

        // 4. Update State
        setRecentOrders(recent.sort((a, b) => new Date(b.created_at || b.order_date) - new Date(a.created_at || a.order_date)));
        setPreviousOrders(previous.sort((a, b) => new Date(b.created_at || b.order_date) - new Date(a.created_at || a.order_date)));

      } catch (error) {
        console.error("❌ FETCH ERROR:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAndSortOrders();
  }, []);

  return (
    <>
      <Header
        cartItems={cartItems}
        onUpdate={updateCart}
        wishListItems={wishListItems}
        onWishListUpdate={updateWishList}
      />

      {/* Main Container */}
      <div className="min-h-screen backdrop-blur-md bg-[#FFF8F0] relative font-['Poppins'] pb-20">
        
        {/* Decorative Top Bar */}
        <div className="h-2 w-full bg-[#68232B]" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          
          {/* Page Header */}
          <div className="flex items-center gap-4 mb-12">
            <div className="p-3 bg-[#68232B]/5 rounded-2xl text-[#68232B]">
              <Package size={32} strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#68232B]">My Orders</h1>
              <p className="text-gray-500 mt-1">Track and manage your purchases</p>
            </div>
          </div>

          {/* LOADING STATE */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#68232B]/50">
                <Loader2 size={48} className="animate-spin mb-4" />
                <p>Loading your orders...</p>
            </div>
          ) : (
            <>
              {/* --- Recent Orders Section --- */}
              <div className="mb-16">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-8 w-1 bg-[#FFCB85] rounded-full" />
                  <h2 className="text-2xl font-bold text-[#4A1D1F]">Recent Orders</h2>
                </div>
                
                <div className="space-y-4">
                  {recentOrders.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 bg-white/40 rounded-3xl border border-dashed border-gray-300">
                        No recent orders in the last 30 days.
                    </div>
                  ) : (
                    recentOrders.map((order) => (
                      <OrderCard key={order.id || order.order_id || Math.random()} order={order} />
                    ))
                  )}
                </div>
              </div>

              {/* --- Previous Orders Section --- */}
              <div>
                <div className="flex items-center gap-3 mb-6 opacity-80">
                  <div className="h-8 w-1 bg-gray-300 rounded-full" />
                  <h2 className="text-2xl font-bold text-gray-600">Previous Orders</h2>
                </div>
                
                <div className="space-y-4 opacity-90 hover:opacity-100 transition-opacity">
                  {previousOrders.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 bg-white/40 rounded-3xl border border-dashed border-gray-300">
                        No previous order history found.
                    </div>
                  ) : (
                    previousOrders.map((order) => (
                      <OrderCard key={order.id || order.order_id || Math.random()} order={order} />
                    ))
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      <Footer />
    </>
  );
};

export default MyOrders;