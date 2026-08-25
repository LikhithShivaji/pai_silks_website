import React, { useContext, useEffect, useState } from "react";
import { CartContext } from "@/CartContext.jsx";
import CheckOutItem from "@/components/CheckOutItem.jsx";
import { CLIENT_API, SHIPPING_FEE, apiFetch } from "@/config/api";
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  validateNationalNumber,
  toE164,
  fromE164,
} from "@/config/phone";
import logo from "@/assets/logo.svg";
import { useNavigate } from "react-router-dom";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";

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
  email: z.string().email("Enter a valid email address"),
  firstName: z.string().min(1, "First Name is required"),
  lastName: z.string().min(1, "Last Name is required"),

  // phoneNumber was MISSING from this schema entirely. The form renders a field
  // named `phoneNumber`, but zodResolver strips keys the schema does not
  // declare — so it never survived parsing. onSubmit then read `data.phone`,
  // a name that appears in neither the schema nor the form, which was always
  // undefined and fell through to the hardcoded "9999999999".
  //
  // Result: EVERY order was stored with a fake phone number and the merchant
  // could not contact any customer. See CLAUDE.md CF-06 / CF-09.
  //
  // The country is an explicit choice rather than something parsed out of a
  // free-text number: "9876543210" is a valid national number in both India
  // and the USA, so without the dropdown the stored value is ambiguous.
  countryCode: z.enum(["IN", "US"]),
  phoneNumber: z.string().min(1, "Phone number is required"),

  address: z.string().min(1, "Address is required"),
  apartment: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  paymentMethod: z.literal("razorpay"),
  rememberMe: z.boolean().optional(),
})
  // Cross-field: the number is only meaningful against a country, so the rule
  // has to run after both are known. India requires 10 digits starting 6-9;
  // the USA requires NANP format. Rules live in config/phone.js so the signup
  // form and this one cannot drift apart.
  .superRefine((data, ctx) => {
    const error = validateNationalNumber(data.countryCode, data.phoneNumber);
    if (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phoneNumber"],
        message: error,
      });
    }
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
      countryCode: DEFAULT_COUNTRY,
      phoneNumber: "",
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

      return acc + price * qty;
    }, 0);

    setLocalTotal(newTotal);
  }, [cartItems]);

  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    const userEmail = localStorage.getItem("user_email");

    if (userEmail) form.setValue("email", userEmail);

    if (userId) {
      apiFetch(
        `${CLIENT_API}/api/orders/mine`
      )
        .then((res) => res.json())
        .then((response) => {
          // The API returns { success, orders } — this block previously checked
          // `response.data`, which is always undefined, so the entire autofill
          // was unreachable. That is why the phone field was never populated
          // and always fell through to the "9999999999" fallback.
          // See CLAUDE.md CF-09.
          const orders = response.orders;
          if (!response.success || !Array.isArray(orders) || orders.length === 0) return;

          const lastOrder = orders[0];

          const fullName = (lastOrder.customer_name || "").trim();
          const nameParts = fullName ? fullName.split(" ") : [];
          const firstName = nameParts[0] || "";
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

          if (lastOrder.email || userEmail) {
            form.setValue("email", lastOrder.email || userEmail);
          }
          if (firstName) form.setValue("firstName", firstName);
          if (lastName) form.setValue("lastName", lastName);
          if (lastOrder.shipping_address) {
            form.setValue("address", lastOrder.shipping_address);
          }

          // Was form.setValue("phone", ...) — a field that exists in neither
          // the schema nor the form. Split the stored E.164 value back into the
          // country and national parts the form actually uses.
          if (lastOrder.phone_number) {
            const { countryCode, nationalNumber } = fromE164(lastOrder.phone_number);
            form.setValue("countryCode", countryCode);
            form.setValue("phoneNumber", nationalNumber);
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
        customer_name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        // Was `data.phone || "9999999999"` — a field that never existed, so
        // every order got the fallback. Now the real value, in E.164.
        phone_number: toE164(data.countryCode, data.phoneNumber),
        shipping_address: `${data.address}, ${data.city}, ${data.state} - ${data.pincode}`,
        // total_amount, payment_status and order_status are NOT sent. The
        // server computes the total from its own product prices, adds its own
        // shipping fee, and assigns the statuses. A client cannot set its own
        // price or declare its own order paid. See CF-01, CF-03, CB-03.
        payment_method: "UPI",
        items: cartItems.map((item) => ({
          product_id: item.id || item.product_id,
          quantity: item.quantity || 1,
          price: Number(
            item.discounted_price || item.selling_price || item.price
          ),
        })),
      };

      // console.log("Creating Order:", orderPayload);

      const response = await apiFetch(
        `${CLIENT_API}/api/orders/create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderPayload),
        }
      );

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
      <header className="relative h-20 bg-white shadow flex justify-center items-center">
        <button
          onClick={() => navigate("/")}
          className="absolute top-0 left-0 z-1 flex m-4 px-2 rounded-4xl bg-[#68232B] text-[#FEDB87] cursor-pointer font-bold justify-center gap-1 md:gap-3 items-center p-3 w-20 text-xs md:text-lg md:w-50 hover:shadow-xl hover:border-[#68232B]/20 hover:-translate-y-0.5"
        >
          <ArrowLeft size={15} /> <p>Back</p>
        </button>
        <img src={logo} alt="Logo" className="h-16" />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen bg-white px-0 lg:px-30 font-['Poppins']">
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
                        <Input {...field} placeholder="Ex: Swapna" />
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
                        <Input {...field} placeholder="Ex: Kumari" />
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

              {/* Country + national number.
                  A dropdown rather than a free-text field: "9876543210" is a
                  valid national number in both India and the USA, so without an
                  explicit country the stored value is ambiguous and the merchant
                  cannot reliably dial it. See CLAUDE.md CF-09. */}
              <FormItem>
                <FormLabel>Contact Number</FormLabel>
                <div className="flex gap-2">
                  <FormField
                    control={form.control}
                    name="countryCode"
                    render={({ field }) => (
                      <FormControl>
                        <select
                          {...field}
                          aria-label="Country calling code"
                          className="h-9 shrink-0 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          {COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.flag} {c.dial}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          maxLength={14}
                          placeholder={`Ex: ${
                            COUNTRIES.find(
                              (c) => c.code === form.watch("countryCode")
                            )?.example ?? "9876543210"
                          }`}
                        />
                      </FormControl>
                    )}
                  />
                </div>
                <FormMessage>
                  {form.formState.errors.phoneNumber?.message}
                </FormMessage>
              </FormItem>

              <FormField
                control={form.control}
                name="apartment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apartment (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Hiranandani flat" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                {["city", "state", "pincode"].map((name) => {
                  // Define your placeholders here
                  const placeholders = {
                    city: "Ex: Bengaluru",
                    state: "Ex: Karnataka",
                    pincode: "Ex: 560001",
                  };

                  return (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="capitalize">{name}</FormLabel>
                          <FormControl>
                            {/* Use the map to get the correct placeholder */}
                            <Input
                              {...field}
                              placeholder={placeholders[name]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  );
                })}
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
                <span className="text-green-600">₹ {SHIPPING_FEE}</span>
              </div>

              <div className="flex justify-between font-bold text-2xl text-[#68232B] pt-2">
                <span>Total</span>
                <span>₹ {localTotal + SHIPPING_FEE}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
