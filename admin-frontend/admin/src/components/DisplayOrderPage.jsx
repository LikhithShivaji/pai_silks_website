import React, { useEffect } from "react";
import { SelectComponent } from "./ui/SelectComponent";

import {

  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";

// Dates and money arriving from the API are not guaranteed present or numeric.
//
// Verified behaviour of the unguarded versions:
//   new Date(undefined).toLocaleString()  -> "Invalid Date"   (rendered as-is)
//   new Date(null).toLocaleString()       -> "1/1/1970"       (silently WRONG,
//                                            worse than an error, because it
//                                            looks like a real order date)
//   undefined * 2                          -> NaN             -> "₹NaN"
// See CLAUDE.md AF-C-FIX.
// Rendered as "29 August 2026 4:24 PM" (owner's preference, 2026-08-29).
//
// `toLocaleString()` with no arguments produced "29/8/2026, 4:24:54 pm" — it
// follows whatever locale the admin's machine happens to use, so the same order
// could read 8/29/2026 on another computer. Naming the locale and the fields
// makes the output stable regardless of who is looking at it. Seconds are
// dropped: nobody chases an order by the second.
//
// `en-IN` inserts " at " between date and time and lower-cases the meridiem, so
// both are normalised afterwards.
const formatDate = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  return d
    .toLocaleString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(" at ", " ")
    .replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
};

const formatMoney = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `₹${n.toFixed(2)}` : "—";
};


export default function DisplayOrderPage({
  order,
  onBack = () => {},
  onChangeStatus,
}) {
  useEffect(() => {
  }, []);

  if (!order) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="mb-4">
          ← Back
        </button>
        <div>No order selected.</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex w-full justify-between">
        <div className="flex flex-col gap-3">
          <p className="text-2xl font-bold">OrderDetails2</p>
          <p className="text-sm">
            Home {">"} Order List {">"} Order Details
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-white cursor-pointer bg-[#68232B] p-4 rounded-xl "
        >
          ← Back to orders
        </button>
      </div>

      <div className="my-5">
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-semibold">
                Order {order.orderId ?? order.id}
              </h2>
              {order.date && (
                <p className="text-sm text-gray-500">
                  Placed: {formatDate(order.date)}
                </p>
              )}
              <p className="mt-1 text-sm">
                Status: <strong>{order.status ?? "—"}</strong>
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-500">Amount</p>
              <p className="text-xl font-semibold">{formatMoney(order.amount)}</p>
              {order.paymentId && (
                <p className="text-xs text-gray-500 mt-1">
                  Payment: {order.paymentId}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium">Customer</h3>
              <p className="font-semibold">{order.customerName ?? "-"}</p>
              {order.email && (
                <p className="text-sm text-gray-500">{order.email}</p>
              )}
              {order.contactNumber && (
                <p className="text-sm text-gray-500">
                  Phone: {order.contactNumber}
                </p>
              )}
            </div>

            <div>
              <h3 className="font-medium">Order Meta</h3>
              <div className="text-sm text-gray-600">
                <p>Order ID: {order.orderId ?? order.id}</p>
                <p>Date: {order.date ?? "-"}</p>
              </div>
            </div>
          </div>

          {/* Products (simple) */}
          <div>
            <h3 className="font-medium mb-2">Products</h3>
            <div>
              {Array.isArray(order.product) ? (
                order.product.map((it, idx) => (
                  <div
                    key={idx}
                    className="flex gap-3 items-center p-2 border rounded mb-2"
                  >
                    {it.image && (
                      <div className="w-12 h-12 overflow-hidden rounded">
                        <img
                          src={it.image}
                          alt={it.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <div className="font-semibold">
                          {it.name || it.title || it.product || "Product"}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatMoney(it.price ?? it.amount)}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Qty: {it.qty ?? 1}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-2 border rounded">
                  {String(order.product ?? "-")}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
        </div>
      </div>
      <div className="w-full bg-white rounded-xl p-5 flex flex-col gap-10 my-5">
        <div className="flex gap-5 items-center">
          <h2 className="font-semibold text-xl">
            Order ID: #{order.orderId ?? order.id}
          </h2>
          <div className="text-xs p-3 bg-yellow-300 rounded-xl">
            {order.status}
          </div>
        </div>
        <SelectComponent
          value={order.status ?? "Pending"}
          onChange={(newStatus) => onChangeStatus(newStatus)}
        />
        <div className="w-full border-1 rounded-xl p-5 flex flex-col gap-2">
          {/* Every field falls back to an em dash. A blank after "Email:" is
              indistinguishable from a customer who has no email — it reads as
              missing data rather than a bug, which is exactly why the empty
              Email line went unnoticed until an order was inspected by hand.
              See CLAUDE.md AB-43. */}
          <p className="font-bold ">Customer</p>
          <p className="text-sm text-gray-500">
            Full Name: {order.customerName || "—"}
          </p>
          <p className="text-sm text-gray-500">Email: {order.email || "—"}</p>
          <p className="text-sm text-gray-500">
            Phone Number: {order.contactNumber || "—"}
          </p>
          <p className="text-sm text-gray-500">Address: {order.address || "—"}</p>
          <p className="text-sm text-gray-500">
            Order Date: {formatDate(order.date)}
          </p>
        </div>
      </div>
      <div className="w-full bg-white rounded-xl p-5 flex flex-col gap-10 my-5">
        <Table>
          <TableCaption>A list of your recent invoices.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Invoice</TableHead>
              <TableHead className="w-[100px]">Product Image</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Product Id</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* `?? []` — the sibling render at :128 checks Array.isArray but
                this one did not, on the SAME object, 85 lines apart. An order
                whose product list is missing threw here and, with no
                ErrorBoundary, blanked the whole order-detail page.
                See CLAUDE.md AF-C-F3. */}
            {(Array.isArray(order.product) ? order.product : []).map((product, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">
                  #{order.orderId}-{index + 1}
                </TableCell>
                <TableCell className="h-24 w-24 p-2">
                  <div className="h-20 w-20 rounded-xl overflow-hidden border">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                        No Img
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{product.name}</TableCell>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{product.qty}</TableCell>
                <TableCell>{order.status}</TableCell>
                <TableCell>{order.paymentMethod}</TableCell>
                <TableCell className="text-right">
                  {formatMoney(Number(product.price) * Number(product.qty))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>

          {/* Subtotal / Shipping / Total.
              `amount` is the order's stored total_amount — what the customer
              was actually charged — and it INCLUDES shipping. Showing only the
              total made the ₹100 look unaccounted for next to the item lines,
              so the breakdown is spelled out. Subtotal is derived here purely
              for display; both real figures come from the server.
              See CLAUDE.md AB-16. */}
          {/* colSpan is 7, not 6.
              The table has EIGHT columns (Invoice, Product Image, Product Name,
              Product Id, Quantity, Status, Method, Amount). colSpan={6} plus one
              amount cell is only SEVEN, so every total landed in column 7 and
              sat visibly left of the Amount column it was meant to line up
              with. 7 + 1 = 8. See CLAUDE.md AF-30. */}
          <TableFooter>
            {Number(order.shipping_fee) > 0 && (
              <>
                <TableRow>
                  <TableCell colSpan={7}>Subtotal</TableCell>
                  <TableCell className="text-right">
                    ₹{(Number(order.amount) - Number(order.shipping_fee)).toFixed(2)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={7}>Shipping</TableCell>
                  <TableCell className="text-right">
                    ₹{Number(order.shipping_fee).toFixed(2)}
                  </TableCell>
                </TableRow>
              </>
            )}
            <TableRow>
              <TableCell colSpan={7} className="font-semibold">Total</TableCell>
              <TableCell className="text-right font-semibold">
                ₹{Number(order.amount ?? 0).toFixed(2)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
