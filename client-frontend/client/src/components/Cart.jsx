import React, { useEffect, useContext } from "react";
import CartItem from "./CartItem";
import { useNavigate } from "react-router-dom";
import { CartContext } from "../CartContext";
import { useAuth } from "../AuthContext";
import { useToast } from "../ToastContext";
import { CLIENT_API, SHIPPING_FEE, apiFetch } from "@/config/api";
import footerBg from "../assets/footerbgimage.webp";
import { X, ShoppingBag } from "lucide-react";

const Cart = ({ onClose }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const {
    cartItems,
    setCartItems,
    dynamicCartItem,
    setDynamicCartItem,
    total,
    setTotal,
    handleRemoveFromCart, // <--- 1. Import the new function
  } = useContext(CartContext);

  // 1. Initialize quantities from Global Cart when drawer opens
  useEffect(() => {
    const itemsWithQty = cartItems.map((item) => ({
      ...item,
      quantity: item.quantity || 1,
    }));
    setDynamicCartItem(itemsWithQty);
  }, [cartItems, setDynamicCartItem]);

  // --------------------------------------------------------
  // 2. HYBRID QUANTITY CHANGE (Local + DB)
  // --------------------------------------------------------
  const changeQuantity = async (index, newQuantity) => {
    // Server-confirmed identity, not a localStorage string. See CLAUDE.md CF-55.
    const userId = isAuthenticated;
    const itemToUpdate = dynamicCartItem[index];

    // Guard against a stale index — this one was actively dangerous.
    //
    // `index` is captured at RENDER time. If the array shrank between render
    // and click, `dynamicCartItem[index]` was `undefined`, and the line below
    // spread it: `{ ...undefined, quantity: n }` yields `{ quantity: n }` — a
    // nameless, PRICELESS row silently inserted into the cart and then
    // persisted to localStorage by the context's sync effect. The API call
    // then threw on `itemToUpdate.id`. See CLAUDE.md CF-12.
    if (!itemToUpdate) return;

    const productId = itemToUpdate.id || itemToUpdate.product_id;

    // Optimistic UI Update — matched by product_id, not by position.
    const previous = dynamicCartItem;
    const updatedCart = dynamicCartItem.map((item) =>
      (item.id || item.product_id) === productId
        ? { ...item, quantity: newQuantity }
        : item
    );
    setDynamicCartItem(updatedCart);
    setCartItems(updatedCart);

    // API Call
    if (userId) {
      try {
        const res = await apiFetch(
          `${CLIENT_API}/api/cart/update`,
          {
            method: "POST", // Check if your API uses POST or PUT
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              product_id: productId,
              quantity: newQuantity,
            }),
          }
        );
        // Roll back on failure. This matters more here than almost anywhere
        // else: checkout bills from the DATABASE cart while the screen shows
        // React state, so a silently dropped update means the customer is shown
        // one quantity and charged another. See CLAUDE.md CF-17.
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (error) {
        console.error("Failed to update quantity DB:", error);
        setDynamicCartItem(previous);
        setCartItems(previous);
        showToast("Couldn't update the quantity. Please try again.");
      }
    }
  };

  // 3. REMOVE ITEM (Now using Context!)
  // We don't need the local handleProductRemove anymore.

  // 4. Calculate Total
  useEffect(() => {
    const calculatedTotal = dynamicCartItem.reduce((acc, item) => {
      const qty = Number(item.quantity) || 1;

      // 👇 FIX: Added 'item.price' and 'item.amount' to the list
      const price =
        Number(item.discounted_price) ||
        Number(item.price) ||
        Number(item.selling_price) ||
        Number(item.amount) ||
        0;

      return acc + qty * price;
    }, 0);

    setTotal(calculatedTotal);
  }, [dynamicCartItem, setTotal]);

  // 5. PROCEED TO CHECKOUT
  const handleProceedToCheckout = () => {
    // Server-confirmed identity, not a localStorage string. See CLAUDE.md CF-55.
    const userId = isAuthenticated;
    onClose();

    if (userId) {
      navigate("/checkout");
    } else {
      navigate("/login", { state: { from: "checkout" } });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300">
      {/* Sidebar */}
      <div
        className="
          fixed inset-y-0 right-0
          w-[85vw] md:w-[450px]
          bg-[#FFF8F0]/95 backdrop-blur-xl
          shadow-2xl
          flex flex-col
          font-['Poppins']
          animate-in slide-in-from-right duration-300
        "
      >
        {/* --- HEADER --- */}
        <div
          className="relative px-6 py-6 border-b border-[#68232B]/10 flex justify-between items-center bg-white/50"
          style={{
            backgroundImage: `url(${footerBg})`,
            backgroundSize: "cover", // 👈 Forces image to shrink to fit the box
            backgroundPosition: "center", // 👈 Keeps the important part in the middle
            backgroundRepeat: "no-repeat", // 👈 Prevents tiling if the box is huge
          }}
        >
          <div className="flex items-center gap-3 z-10">
            <div className="p-2 bg-[#68232B]/10 rounded-full text-[#FFCB85]">
              <ShoppingBag size={20} />
            </div>
            <h2 className="text-xl font-bold text-[#FFCB85] tracking-wide">
              Your Cart
            </h2>
            <span className="bg-[#68232B] text-[#FFCB85] text-xs font-bold px-2 py-0.5 rounded-full">
              {dynamicCartItem.length}
            </span>
          </div>

          <button
            onClick={onClose}
            className="z-10 p-2 hover:bg-[#68232B]/10 rounded-full transition-colors text-[#FFCB85] cursor-pointer"
          >
            <X size={24} />
          </button>
        </div>

        {/* --- CONTENT --- */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FFCB85]/70 backdrop-blur-md">
          {dynamicCartItem.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#68232B]/60 gap-4">
              <div className="p-6 bg-[#68232B]/5 rounded-full">
                <ShoppingBag size={48} strokeWidth={1} />
              </div>
              <p className="text-lg font-medium">Your cart is empty</p>
              <button
                onClick={onClose}
                className="text-sm underline underline-offset-4 hover:text-[#68232B]"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <>
              {dynamicCartItem.map((item, index) => (
                <div
                  key={item.id || index}
                  className="bg-white/60 backdrop-blur-md rounded-lg border border-white/10 hover:shadow-lg overflow-hidden transition-all duration-300"
                >
                  <CartItem
                    item={item}
                    index={index}
                    onQuantityChange={changeQuantity}
                    // --- 2. Use the Context Function Here ---
                    onRemove={() =>
                      handleRemoveFromCart(item.id || item.product_id)
                    }
                  />
                </div>
              ))}

              {/* Bill Summary */}
              <div className="mt-6 bg-white/80 backdrop-blur-md rounded-xl p-5 border border-white/40 shadow-sm text-[#68232B]">
                <h3 className="font-bold mb-4 border-b border-[#68232B]/10 pb-2">
                  Order Summary
                </h3>
                <div className="flex justify-between mb-2 text-sm">
                  <span className="opacity-80">Order Amount</span>
                  <span className="font-semibold">₹ {total}</span>
                </div>
                <div className="flex justify-between mb-2 text-sm">
                  <span className="opacity-80">Delivery Fee</span>
                  <span className="font-semibold text-green-700">₹ {SHIPPING_FEE}</span>
                </div>
                <div className="flex justify-between mt-4 pt-3 border-t border-[#68232B]/20">
                  <span className="font-bold text-lg">Grand Total</span>
                  <span className="font-bold text-lg">₹ {total + SHIPPING_FEE}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* --- FOOTER --- */}
        {dynamicCartItem.length > 0 && (
          <div
            className="p-6 border-t border-[#68232B]/10 bg-white/50 backdrop-blur-md"
            style={{ backgroundImage: `url(${footerBg})` }}
          >
            <button
              onClick={handleProceedToCheckout}
              className="
                w-full h-14
                rounded-full
                font-bold text-lg text-white
                shadow-lg shadow-orange-900/20
                bg-gradient-to-r from-[#FEDB87] to-[#BD7923]
                hover:brightness-110
                active:scale-95
                transition-all duration-300
                flex items-center justify-center gap-2
                cursor-pointer
              "
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cart;
