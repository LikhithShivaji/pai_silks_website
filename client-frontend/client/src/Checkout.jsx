import React, { useContext, useEffect, useRef, useState } from "react";
import { CartContext } from "@/CartContext.jsx";
import { useAuth } from "@/AuthContext";
import { useToast } from "@/ToastContext";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/**
 * Split one stored name into the two fields this form shows.
 *
 * The database holds a single `user_name` / `customer_name`; the checkout asks
 * for First and Last separately. Everything before the first space is the first
 * name, everything after it is the surname — so "Likhith Shivaji Kumar" gives
 * "Likhith" + "Shivaji Kumar" rather than dropping the middle part, and a
 * one-word name fills First and leaves Last empty instead of inventing one.
 */
const splitFullName = (fullName) => {
  const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
};

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
  const { cartItems, setCartItems, cartLoaded } = useContext(CartContext);
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();

  const [localTotal, setLocalTotal] = useState(0);

  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set the instant an order succeeds, BEFORE the cart is cleared.
  //
  // A ref, not state: the empty-cart guard below must see the new value in the
  // same render pass that the cart becomes empty, and a state update would not
  // be visible until the next one — which is exactly the window the guard runs in.
  const orderPlacedRef = useRef(false);

  // --- Empty-cart guard ---------------------------------------------------
  // /checkout was reachable with nothing in the cart. It rendered an empty
  // summary, a total of just the ₹100 shipping fee, and a live "Pay Now" that
  // came back 400 "Cart is empty" — a checkout page offering to charge for
  // nothing. See CLAUDE.md CF-29.
  //
  // Two things make this trickier than `if (empty) redirect`:
  //
  // 1. `cartLoaded`. An un-hydrated cart and an empty cart are both `[]`. The
  //    cart arrives asynchronously — over the network for a logged-in customer
  //    — so redirecting on length alone would bounce a real customer with a
  //    full cart off the page before their data landed. Same late-resolve trap
  //    as the auth bug fixed in the effect further down.
  //
  // 2. `orderPlacedRef`. A SUCCESSFUL order clears the cart and then navigates
  //    to /my-orders. Between those two statements the cart is legitimately
  //    empty, and without this flag the guard would fire in that gap and send a
  //    customer who has just paid to /shop instead of their order confirmation.
  useEffect(() => {
    if (!cartLoaded) return;          // still hydrating — say nothing yet
    if (orderPlacedRef.current) return; // just ordered; the cart SHOULD be empty
    if (cartItems.length > 0) return;

    navigate("/shop", { replace: true });
  }, [cartLoaded, cartItems.length, navigate]);

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
    // The email is prefilled from the SERVER's answer where available — it is
    // the address the session actually belongs to. localStorage is only the
    // fallback, and only for prefilling a form field, never for identity.
    // See CLAUDE.md CF-55.
    // Server only. The `|| localStorage.getItem("user_email")` fallback that
    // stood here is gone with the writes that fed it (CF-46) — nothing sets
    // that key any more, so the fallback could only ever return a stale value
    // left over from a previous session on a shared device, prefilling one
    // customer's email into another's checkout.
    const userEmail = user?.pri_email;
    if (userEmail) form.setValue("email", userEmail);

    // Prefill the delivery phone from the ACCOUNT.
    //
    // Only the last order's phone was used, so a first-time customer — who by
    // definition has no previous order — typed a number the shop already had.
    // Set before the orders request below, deliberately: if a previous order
    // exists its delivery number wins, because that is the number the customer
    // last chose for a parcel and may differ from the account holder's (an
    // order sent as a gift, for instance).
    //
    // Stored E.164, split back into the country + national parts the form uses.
    if (user?.phone_number) {
      const { countryCode, nationalNumber } = fromE164(user.phone_number);
      if (countryCode) form.setValue("countryCode", countryCode);
      if (nationalNumber) form.setValue("phoneNumber", nationalNumber);
    }

    // Prefill the name from the ACCOUNT, for the same reason as the phone above.
    //
    // The only thing that ever filled these two fields was `customer_name` off
    // the last order — so a first-time customer got nothing, and the account
    // name the shop already holds went unused. The last-order block below still
    // overrides this when a previous order exists, because that is the name the
    // customer last chose to put on a parcel.
    //
    // `user_name` is one column, the form is two fields: everything before the
    // first space is the first name, the remainder is the surname. A single-word
    // name therefore fills First Name and leaves Last Name empty rather than
    // guessing at one.
    if (user?.user_name) {
      const { firstName, lastName } = splitFullName(user.user_name);
      if (firstName) form.setValue("firstName", firstName);
      if (lastName) form.setValue("lastName", lastName);
    }

    if (isAuthenticated) {
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

          const { firstName, lastName } = splitFullName(lastOrder.customer_name);

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
    // `isAuthenticated` and `user?.pri_email` added — this was NOT just a lint
    // warning, it was the same late-auth bug already fixed in MyProfile.
    //
    // `useAuth` resolves asynchronously via /api/verify-token. With only
    // `[form]` here the effect ran ONCE, on mount, while isAuthenticated was
    // still unresolved — so the `if (isAuthenticated)` branch was false, the
    // autofill fetch never fired, and it never re-ran when auth landed. A
    // customer navigating straight to /checkout got an empty form even though
    // the server had their details. It only appeared to work when auth happened
    // to resolve before this component mounted.
    //
    // These two values settle once per session, so this re-runs at most once
    // more — it cannot loop.
  }, [form, isAuthenticated, user?.pri_email, user?.phone_number, user?.user_name]);

  const onSubmit = async (data) => {
    // The guard runs BEFORE setIsSubmitting.
    //
    // It used to set the flag first and then return early, skipping the `try`
    // whose `finally` would have cleared it — so an interrupted submit left the
    // button stuck in its spinner forever. See CLAUDE.md CF-28.
    //
    // The check itself is now the shared server-confirmed state, not a third
    // independent reading of localStorage. See CLAUDE.md CF-55.
    if (!isAuthenticated) {
      showToast("Please log in to place your order.");
      navigate("/login", { state: { from: "checkout" } });
      return;
    }

    setIsSubmitting(true);

    try {
      // ONLY the fields the server actually reads.
      //
      // createOrder destructures exactly three:
      //   const { shipping_address, payment_method, phone_number } = req.body
      // It builds the order lines from the DATABASE cart, never from the
      // request — that is the CF-01 / CB-03 defence against a client naming its
      // own prices. total_amount, payment_status and status are server-assigned
      // for the same reason.
      //
      // ⚠️ `items` was a BREAKING leftover, not just dead weight. Phase 3 added
      // `rejectNonScalarBody` router-wide (AB-11 / CB-29: non-scalar values
      // corrupt mysql2 placeholders) and `items` is an array — so from that
      // commit onward EVERY real checkout was refused with
      //   Invalid value for "items".
      // It went unnoticed because the curl tests for this endpoint never sent
      // the field the actual form sends. Reproduced and confirmed 2026-08-29.
      //
      // `customer_name` and `email` are dropped for the same reason minus the
      // breakage: the server reads neither, and both already live on the
      // account row reached through the session.
      const orderPayload = {
        // Was `data.phone || "9999999999"` — a field that never existed, so
        // every order got the fallback. Now the real value, in E.164.
        phone_number: toE164(data.countryCode, data.phoneNumber),
        // The apartment / flat number is INCLUDED.
        //
        // It was collected on the form and then silently dropped from the
        // composed address, so a flat number never reached the courier —
        // parcels went to the building with nothing saying which door.
        // Confirmed on a real order: "Hiranandani flat" was typed and the
        // stored address read "B. Road Hassan, Hassan, Karnataka - 573201".
        // See CLAUDE.md CF-23.
        //
        // It is optional, so it is only inserted when present — otherwise the
        // address would carry an empty segment and read ", , Hassan".
        shipping_address: [
          data.address,
          data.apartment?.trim(),
          data.city,
          `${data.state} - ${data.pincode}`,
        ]
          .filter(Boolean)
          .join(", "),
        payment_method: "UPI",
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
        // BEFORE clearing the cart. The empty-cart guard watches cartItems and
        // would otherwise fire in the gap between the clear and the navigate,
        // redirecting a customer who has just paid to /shop. See CF-29.
        orderPlacedRef.current = true;

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

              {/* "Keep me updated with offers" removed. See CLAUDE.md CF-30.
                  The Checkbox had no name, no control and no onCheckedChange —
                  it could be ticked and nothing anywhere recorded it. Removed
                  rather than wired up because the owner confirmed on 2026-09-03
                  that PAI Silks sends no promotional messages at all, which the
                  Privacy Policy now states. A consent box for messages that are
                  never sent is a promise with no mechanism behind it. */}

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
