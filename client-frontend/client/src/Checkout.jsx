import React, { useContext, useEffect, useState } from "react";
import { CartContext } from "@/CartContext.jsx"; // Adjust path if needed
import CheckOutItem from "@/components/CheckOutItem.jsx"; // Adjust path if needed
import logo from "@/assets/logo.svg";
import { useNavigate } from "react-router-dom";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/* ---------------- SCHEMA ---------------- */

const checkoutSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1, "First Name is required"),
  lastName: z.string().min(1, "Last Name is required"),
  address: z.string().min(1, "Address is required"),
  apartment: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().length(6, "Pincode must be 6 digits"),
  paymentMethod: z.literal("razorpay"),
  rememberMe: z.boolean().optional(),
});

/* ---------------- COMPONENT ---------------- */

export default function Checkout() {
  // CHANGE 1: Get 'cartItems' instead of dynamicCartItem
  const { cartItems, setCartItems } = useContext(CartContext);

  // CHANGE 2: Local state for total calculation
  const [localTotal, setLocalTotal] = useState(0);

  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      address: "",
      apartment: "",
      city: "",
      state: "",
      pincode: "",
      paymentMethod: "razorpay",
      rememberMe: false,
    },
  });

  // --------------------------------------------------------
  // 1. CALCULATE TOTAL (Independent Logic)
  // --------------------------------------------------------
  useEffect(() => {
    // This runs as soon as cartItems loads from Context (DB or LocalStorage)
    const newTotal = cartItems.reduce((acc, item) => {
      // Ensure we handle strings/numbers safely
      const price = Number(item.discounted_price || item.selling_price || 0);
      const qty = Number(item.quantity || 1);
      return acc + price * qty;
    }, 0);

    setLocalTotal(newTotal);
  }, [cartItems]);

  // --------------------------------------------------------
  // 2. AUTO-FILL LOGIC
  // --------------------------------------------------------
  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    const userEmail = localStorage.getItem("user_email");

    // Pre-fill email from local storage immediately if available
    if (userEmail) form.setValue("email", userEmail);

    if (userId) {
      fetch(
        `https://pai-silks-website-1.onrender.com/api/orders/user/${userId}`
      )
        .then((res) => res.json())
        .then((response) => {
          // FIX: Use optional chaining (?.) so it doesn't crash if 'data' is missing
          if (response.success && response.data && response.data.length > 0) {
            const lastOrder = response.data[0];

            // Safe check for name splitting
            const fullName = lastOrder.customer_name || "";
            const nameParts = fullName.trim().split(" ");
            const firstName = nameParts[0] || "";
            const lastName =
              nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

            form.setValue("email", lastOrder.email || userEmail || "");
            form.setValue("firstName", firstName);
            form.setValue("lastName", lastName);
            form.setValue("address", lastOrder.shipping_address || "");
            form.setValue("phone", lastOrder.phone_number || "");
          }
        })
        .catch((err) => console.error("Failed to auto-fill details:", err));
    }
  }, [form]);

  // --------------------------------------------------------
  // 3. SUBMIT ORDER
  // --------------------------------------------------------
  // ... (Keep existing imports)

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    const userId = localStorage.getItem("user_id");

    if (!userId) {
      alert("Please login first.");
      navigate("/login", { state: { from: "checkout" } });
      return;
    }

    try {
      // 1. PREPARE ORDER PAYLOAD
      const orderPayload = {
        user_id: userId,
        customer_name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        phone_number: data.phone || "9999999999", // Add phone to form if missing
        shipping_address: `${data.address}, ${data.city}, ${data.state} - ${data.pincode}`,
        total_amount: localTotal + 99,
        payment_status: "Paid",
        payment_method: "UPI",
        order_status: "Pending",
        // We send items here. If your backend 'createOrder' handles items, this is enough.
        items: cartItems.map(item => ({
            product_id: item.id || item.product_id,
            quantity: item.quantity || 1,
            price: Number(item.discounted_price || item.selling_price || item.price)
        }))
      };

      console.log("Creating Order:", orderPayload);

      // 2. CALL CREATE ORDER API
      const response = await fetch("https://pai-silks-website-1.onrender.com/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      const result = await response.json();
      console.log("Order Result:", result);

      if (result.success || result.order_id || result.id) {
        
        // --- [OPTIONAL] PLAN B: If backend needs items added separately ---
        // If your database shows the Order Header but NO ITEMS, uncomment this block:
        /*
        const newOrderId = result.order_id || result.id;
        await Promise.all(cartItems.map(item => 
            fetch("https://pai-silks-website-1.onrender.com/api/order/add-item", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    order_id: newOrderId,
                    product_id: item.id || item.product_id,
                    quantity: item.quantity || 1,
                    price: item.discounted_price || item.price
                })
            })
        ));
        */
        // ------------------------------------------------------------------

        // 3. SUCCESS: CLEAR CART & NAVIGATE
        setCartItems([]); // Clear Context
        localStorage.removeItem("cart"); // Clear Storage
        
        // If logged in, clear DB cart too (Optional but clean)
        // await fetch(`.../api/cart/clear?user_id=${userId}`, { method: 'DELETE' });

        alert("Order Placed Successfully!");
        navigate("/my-orders"); // <--- Redirect to the new My Orders page
      } else {
        alert("Failed to place order: " + (result.message || "Unknown error"));
      }

    } catch (error) {
      console.error("Order Error:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* HEADER */}
      <header className="h-20 bg-white shadow flex justify-center items-center">
        <img src={logo} alt="Logo" className="h-16" />
      </header>

      {/* MAIN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen bg-white px-5 lg:px-30 font-['Poppins']">
        {/* LEFT – FORM */}
        <div className="bg-white p-10 animate-in slide-in-from-left duration-500">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <h2 className="text-xl font-semibold">Contact</h2>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="you@example.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center space-x-2">
                <Checkbox />
                <span className="text-sm">Keep me updated with offers</span>
              </div>

              <h2 className="text-xl font-semibold">Delivery</h2>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Street, House No." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apartment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apartment (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                {["city", "state", "pincode"].map((name) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="capitalize">{name}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              <h2 className="text-xl font-semibold">Payment</h2>

              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <RadioGroup
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                    className="border rounded-md p-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="razorpay" />
                      <span className="font-medium">
                        Razorpay (Cards, UPI, NetBanking)
                      </span>
                    </div>
                  </RadioGroup>
                )}
              />

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 text-lg bg-gradient-to-r from-[#ffe2a0] to-[#e8a348]"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  "Pay Now"
                )}
              </Button>
            </form>
          </Form>
        </div>

        {/* RIGHT – CART SUMMARY */}
        <div className="bg-gray-50 p-10 border-l border-gray-200 animate-in slide-in-from-right duration-500">
          <div className="space-y-4 sticky top-10">
            <h2 className="text-xl font-semibold mb-4 text-[#68232B]">
              Order Summary
            </h2>

            <div className="max-h-[60vh] overflow-y-auto scrollbar-hide pr-2 space-y-4">
              {/* CHANGE 5: Iterate over cartItems directly */}
              {cartItems.map((item, index) => (
                <CheckOutItem
                  key={item.id || index}
                  item={item}
                  index={index}
                  quantity={item.quantity || 1}
                />
              ))}
            </div>

            <div className="border-t border-gray-300 pt-6 space-y-3">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>₹ {localTotal}</span>
              </div>

              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span className="text-green-600">₹ 99</span>
              </div>

              <div className="flex justify-between font-bold text-2xl text-[#68232B] pt-2">
                <span>Total</span>
                {/* CHANGE 6: Display localTotal */}
                <span>₹ {localTotal + 99}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
