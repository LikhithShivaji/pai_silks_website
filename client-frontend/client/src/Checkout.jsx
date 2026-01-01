import React, { useContext, useEffect, useState } from "react";
import { CartContext } from "@/CartContext.jsx"; 
import CheckOutItem from "@/components/CheckOutItem.jsx"; 
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


export default function Checkout() {
  const { cartItems, setCartItems } = useContext(CartContext);

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

  useEffect(() => {
    const newTotal = cartItems.reduce((acc, item) => {
      // 👇 FIX: Check all 4 possible names for price
      const price = 
        Number(item.discounted_price) || 
        Number(item.selling_price) || 
        Number(item.price) || 
        Number(item.amount) || 
        0;

      const qty = Number(item.quantity) || 1;
      
      return acc + (price * qty);
    }, 0);

    setLocalTotal(newTotal);
  }, [cartItems]);

  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    const userEmail = localStorage.getItem("user_email");

    if (userEmail) form.setValue("email", userEmail);

    if (userId) {
      fetch(
        `https://pai-silks-website-1.onrender.com/api/orders/user/${userId}`
      )
        .then((res) => res.json())
        .then((response) => {
          if (response.success && response.data && response.data.length > 0) {
            const lastOrder = response.data[0];

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

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    const userId = localStorage.getItem("user_id");

    if (!userId) {
      alert("Please login first.");
      navigate("/login", { state: { from: "checkout" } });
      return;
    }

    try {
      const orderPayload = {
        user_id: userId,
        customer_name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        phone_number: data.phone || "9999999999", 
        shipping_address: `${data.address}, ${data.city}, ${data.state} - ${data.pincode}`,
        total_amount: localTotal + 99,
        payment_status: "Paid",
        payment_method: "UPI",
        order_status: "Pending",
        items: cartItems.map(item => ({
            product_id: item.id || item.product_id,
            quantity: item.quantity || 1,
            price: Number(item.discounted_price || item.selling_price || item.price)
        }))
      };

      // console.log("Creating Order:", orderPayload);

      const response = await fetch("https://pai-silks-website-1.onrender.com/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      const result = await response.json();
      // console.log("Order Result:", result);

      if (result.success || result.order_id || result.id) {
        setCartItems([]); 
        localStorage.removeItem("cart");
        

        alert("Order Placed Successfully!");
        navigate("/my-orders");
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
      <header className="h-20 bg-white shadow flex justify-center items-center">
        <img src={logo} alt="Logo" className="h-16" />
      </header>

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
                className="w-full h-12 text-lg bg-linear-to-r from-[#ffe2a0] to-[#e8a348]"
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

        <div className="bg-gray-50 p-10 border-l border-gray-200 animate-in slide-in-from-right duration-500">
          <div className="space-y-4 sticky top-10">
            <h2 className="text-xl font-semibold mb-4 text-[#68232B]">
              Order Summary
            </h2>

            <div className="max-h-[60vh] overflow-y-auto scrollbar-hide pr-2 space-y-4">
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
                <span>₹ {localTotal + 99}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
