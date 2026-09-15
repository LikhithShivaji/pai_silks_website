import React, { useEffect, useState } from "react";
import { Package, Calendar, ChevronRight, Clock, CheckCircle, Loader2, ShoppingBag, ArrowLeft, Truck } from "lucide-react";

import { useAuth } from "@/AuthContext";
import { CLIENT_API, apiFetch } from "@/config/api";
import { trackingTarget } from "@/config/carriers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useNavigate } from "react-router-dom";

const OrderCard = ({ order }) => {
  // OrderCard's own navigate. The one in MyOrders below is a different scope —
  // this component is declared outside it, not nested inside.
  const navigate = useNavigate();

  const status = order.order_status || order.status || "Pending";
  const price = order.total_amount || order.price || 0;
  const dateStr = order.created_at || order.order_date || new Date().toISOString();
  const orderId = order.id || order.order_id || "N/A";
  
  // --- SMART ITEM DETECTION ---
  // `[order]` removed as a fallback: it wrapped the ORDER in an array and
  // treated it as an item, so extraCount counted orders as products (CF-38).
  const itemsArray = Array.isArray(order.items)
    ? order.items
    : Array.isArray(order.order_items)
      ? order.order_items
      : [];

  const firstItem = itemsArray.length > 0 ? itemsArray[0] : null;

  // Optional chaining throughout.
  //
  // firstItem was deliberately set to null when an order has no items — and
  // then dereferenced on the very next line, so `firstItem.image` threw a
  // TypeError during render and blanked the ENTIRE /my-orders page, hiding
  // every other order the customer had. Reachable: an order with zero items
  // can exist (see AF-C-FIX; the checkout transaction stops new ones, but
  // production still runs the pre-transaction code). See CLAUDE.md CF-16.
  const displayImage =
    firstItem?.image ||
    firstItem?.product_image ||
    firstItem?.image_url ||
    firstItem?.primary_image ||
    firstItem?.product?.image ||
    order.image ||
    order.product_image ||
    "https://placehold.co/150?text=Package";

  const rawName =
    firstItem?.product_name ||
    firstItem?.name ||
    firstItem?.product?.name ||
    order.product_name ||
    "Unknown Product";
  
  const extraCount = itemsArray.length > 1 ? itemsArray.length - 1 : 0;

  const displayName = itemsArray.length > 0 && rawName !== "Unknown Product"
    ? `${rawName} ${extraCount > 0 ? `+ ${extraCount} others` : ""}` 
    : `Order #${orderId}`;

  // The product this card links to: the first item in the order.
  //
  // `getOrderItems` returns `product_id` alongside the name and primary image,
  // so the card can link straight to that product's page. Null when the order
  // has no items — an order with zero items is a real, reachable state (see
  // CF-16) — and the card is then rendered non-interactive rather than linking
  // nowhere.
  //
  // ⚠️ On a multi-item order this links to the FIRST product only, which is the
  // same one whose name and image the card already shows. Every order in the
  // database today has exactly one distinct product, so the choice is currently
  // invisible; once real multi-product orders exist, an order-detail page is the
  // honest destination. See CLAUDE.md CF-37.
  const linkProductId = firstItem?.product_id ?? null;

  // Dispatch details (DB-09). Both null until the admin records a despatch, so
  // the tracking row simply does not render for an order still being packed.
  const carrierName = order.carrier ?? null;
  const consignmentNumber = order.consignment_number ?? null;
  const track = trackingTarget(carrierName, consignmentNumber);

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

  // Whole card is the control now, replacing a "View Details" button that had
  // no onClick at all — it carried a hover style and `cursor-pointer`, so it
  // looked live and did nothing on every order a customer had. See CF-37.
  //
  // Rendered as a <button> rather than a <div onClick>: it is keyboard
  // focusable and Enter/Space activate it for free, which a clickable div does
  // not give you. `text-left` undoes the browser's centring so the existing
  // layout is unchanged.
  const cardClasses =
    "group w-full text-left flex flex-col md:flex-row items-center gap-6 p-6 mb-6 bg-white/40 backdrop-blur-md border border-white/40 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.05)] transition-all duration-300";

  const Card = ({ children }) =>
    linkProductId ? (
      <button
        type="button"
        onClick={() => navigate(`/product/${linkProductId}`)}
        aria-label={`View ${rawName}`}
        className={`${cardClasses} hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] cursor-pointer`}
      >
        {children}
      </button>
    ) : (
      // No item to link to. Deliberately NOT a button: a control that goes
      // nowhere is the bug being fixed, not a smaller version of it.
      <div className={cardClasses}>{children}</div>
    );

  return (
    <Card>
      
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

        {/* --- Tracking (DB-09) --------------------------------------------
            Shown only once the admin has recorded a despatch. Before this the
            customer saw a badge reading "Shipped" and nothing else — no number,
            no link, no way to find the parcel without messaging the shop.

            There is no carrier API at launch, so this is the consignment number
            plus a link to the carrier's own tracking page. That needs nobody's
            permission and works on day one.

            ⚠️ The <span> and stopPropagation exist because the whole card is a
            <button> that navigates to the product (CF-37). A nested <a> inside
            a <button> is invalid HTML and browsers handle it inconsistently, so
            this is a span that opens the URL itself and stops the click from
            also triggering the card's navigation — otherwise one click would
            both open the tracking page AND navigate away behind it. */}
        {consignmentNumber && (
          <div className="mt-4 pt-4 border-t border-[#68232B]/10 flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1 text-sm">
            <Truck size={16} className="text-[#68232B] shrink-0" />
            {carrierName && (
              <span className="text-gray-600">{carrierName}</span>
            )}
            <span className="font-mono text-[#68232B] font-medium select-all">
              {consignmentNumber}
            </span>
            {track && (
              <span
                role="link"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(track.url, "_blank", "noopener,noreferrer");
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(track.url, "_blank", "noopener,noreferrer");
                }}
                className="underline underline-offset-2 text-[#68232B] hover:text-[#8B2E39] cursor-pointer"
              >
                {/* Wording follows where the link actually LANDS.
                    A direct link goes to this parcel's status, so "Track your
                    parcel" is honest. The fallback lands on the carrier's
                    tracking form with nothing filled in — promising "track your
                    parcel" there sets the customer up to arrive at an empty
                    search box and think the link is broken. Naming the carrier
                    tells them what to expect and what to do. */}
                {track.isDirect ? "Track your parcel" : `Track on ${carrierName}`}
              </span>
            )}
          </div>
        )}
        {track && !track.isDirect && (
          <p className="mt-1 text-xs text-gray-500 text-center md:text-left">
            Copy the number above and paste it on the {carrierName} tracking page.
          </p>
        )}
      </div>

      {/* The "View Details" button that stood here is gone — it had no onClick
          and never did anything. The whole card now navigates to the product.
          A chevron remains as the affordance, so the card still reads as
          interactive without promising a page that does not exist. */}
      {linkProductId && (
        <div className="w-full md:w-auto mt-4 md:mt-0 flex justify-center md:justify-end text-[#68232B]/40 group-hover:text-[#68232B] transition-colors">
          <ChevronRight size={24} />
        </div>
      )}
    </Card>
  );
};


// --- Main Component ---
const MyOrders = () => {
  // The CartContext destructure and the updateCart/updateWishList wrappers that
  // stood here existed only to be handed to <Header>, which discarded them.
  // CF-34.
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [recentOrders, setRecentOrders] = useState([]);
  const [previousOrders, setPreviousOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- FETCH & FILTER LOGIC ---
  useEffect(() => {
    const fetchAndSortOrders = async () => {
      // Server-confirmed, not localStorage. This page also sits behind
      // PrivateRoute, so reaching it already means the session was verified —
      // this guard only avoids a pointless request during the "checking"
      // window. See CLAUDE.md CF-55.
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        // ✅ Keeping your correct -1 URL
        const response = await apiFetch(`${CLIENT_API}/api/orders/mine`);
        
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
          // Signed, not Math.abs. See CLAUDE.md CF-39.
          //
          // Math.abs made a FUTURE date look like a past one: an order dated
          // two months ahead produced a distance of 60 and landed in "previous
          // orders", as though it had already happened. Clock skew on the
          // customer's device is enough to produce one, and it reads as the shop
          // having lost track of the order. A negative difference now means
          // "not yet", which falls through to the recent bucket below.
          const diffTime = today - orderDate;
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
    // Re-runs when auth resolves. With an empty array this fired once, before
    // /api/verify-token had answered, and gave up permanently.
  }, [isAuthenticated]);

  return (
    <>
      <Header />

      {/* Main Container */}
      <div className="min-h-screen backdrop-blur-md bg-[#FFF8F0] relative font-['Poppins'] pb-20">
        
        {/* Decorative Top Bar */}
        <div className="h-2 w-full bg-[#68232B]" />

        <button
          onClick={() => navigate("/")}
          className="hidden md:flex m-4 px-2 rounded-4xl bg-[#68232B] text-[#FEDB87] cursor-pointer font-bold justify-center gap-3 items-center p-3 w-50 hover:shadow-xl hover:border-[#68232B]/20 hover:-translate-y-0.5"
        >
          <ArrowLeft /> <p>Back</p>
        </button>

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
                      <OrderCard key={order.id ?? order.order_id} order={order} />
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
                      <OrderCard key={order.id ?? order.order_id} order={order} />
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