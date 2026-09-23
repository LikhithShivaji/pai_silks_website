import React, { useEffect } from "react";
import { SelectComponent } from "./ui/SelectComponent";
import DispatchEntry from "./DispatchEntry";
import { formatDate } from "@/utils/formatDate";
import { Printer } from "lucide-react";
import { printInvoice } from "./printInvoice";

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
// Moved to utils/formatDate.js and imported at the top of this file. The orders
// TABLE had no formatter at all and was printing raw ISO strings; rather than
// copy this one, both now share it — a second copy is how the two would drift
// into showing the same order's date two different ways.

const formatMoney = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `₹${n.toFixed(2)}` : "—";
};


export default function DisplayOrderPage({
  order,
  onBack = () => {},
  onChangeStatus,
  onSaveDispatch,
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
    <div className="p-3 sm:p-6">
      {/* Stacks on a phone. Side by side, the title wrapped to three lines
          while the two buttons squeezed into narrow columns that wrapped their
          own labels ("Back / to / orders"). Full-width buttons below the title
          read as buttons and are comfortably tappable. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:w-full sm:justify-between">
        <div className="flex flex-col gap-2 sm:gap-3">
          {/* Was the literal "OrderDetails2" — a developer's working title left
              on screen, which told the admin nothing about WHICH order they had
              opened. */}
          <p className="text-2xl font-bold">
            Order #{order.orderId ?? order.id} Details
          </p>
          <p className="text-sm">
            Home {">"} Order List {">"} Order Details
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Packing invoice. Opens a self-contained print document rather than
              printing this page — printing the panel would carry the sidebar,
              the status dropdown and the despatch form onto the paper. */}
          <button
            onClick={() => printInvoice(order)}
            title="Print the invoice for this order"
            className="flex flex-1 sm:flex-none items-center justify-center gap-2 whitespace-nowrap text-sm text-[#68232B] cursor-pointer border border-[#68232B] bg-white px-4 py-3 sm:p-4 rounded-xl hover:bg-[#68232B] hover:text-white transition-colors"
          >
            <Printer size={16} />
            Print invoice
          </button>
          <button
            onClick={onBack}
            className="flex-1 sm:flex-none whitespace-nowrap text-sm text-white cursor-pointer bg-[#68232B] px-4 py-3 sm:p-4 rounded-xl hover:bg-[#8B2E39] transition-colors"
          >
            ← Back to orders
          </button>
        </div>
      </div>

      <div className="my-5">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-4">
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

          {/* One column on a phone. At `grid-cols-2` on a 390px screen each
              column is ~170px, so the email and the ISO date below overflowed
              their cells and printed ON TOP of each other. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <h3 className="font-medium">Customer</h3>
              <p className="font-semibold">{order.customerName ?? "-"}</p>
              {order.email && (
                // break-words: an address with no spaces cannot wrap otherwise
                // and simply runs past the edge of its column.
                <p className="text-sm text-gray-500 break-words">{order.email}</p>
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
                {/* Was `{order.date}` raw, printing the unformatted
                    "2026-09-21T16:33:40.000Z" straight from the API while the
                    identical date three lines above was already formatted.
                    Same helper as everywhere else. */}
                <p>Date: {formatDate(order.date)}</p>
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
                      <div className="w-12 h-12 shrink-0 overflow-hidden rounded">
                        <img
                          src={it.image}
                          alt={it.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {/* min-w-0 lets the name column actually shrink, and the
                        price gets shrink-0 + whitespace-nowrap so it keeps its
                        own line instead of being pushed into the wrapping
                        product name — which is what made "₹4999.00" sit on top
                        of "Royal Crimson Kanchipuram Silk". Aligned to the top
                        so the price lines up with the FIRST line of the name,
                        not the middle of a three-line block. */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-semibold min-w-0 break-words">
                          {it.name || it.title || it.product || "Product"}
                        </div>
                        <div className="text-sm text-gray-600 shrink-0 whitespace-nowrap">
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
      <div className="w-full bg-white rounded-xl p-4 sm:p-5 flex flex-col gap-6 sm:gap-10 my-5">
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

        {/* Dispatch details, directly under the status control because the two
            are one action in practice: the admin returns from the courier and
            records "this went out, here is the number". The server refuses to
            set a dispatched status without them (DB-09). */}
        <DispatchEntry
          orderId={order.orderId ?? order.id}
          currentCarrier={order.carrier}
          currentConsignment={order.consignment_number}
          onSave={onSaveDispatch}
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
      <div className="w-full bg-white rounded-xl p-4 sm:p-5 flex flex-col gap-6 sm:gap-10 my-5">
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
