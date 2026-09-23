import { formatDate } from "@/utils/formatDate";

/**
 * Print a packing invoice for one order.
 *
 * WHY A NEW WINDOW RATHER THAN window.print() ON THE PAGE
 * Printing the admin panel directly would carry the sidebar, the header, the
 * status dropdown and the despatch form onto the paper, and print stylesheets
 * that hide all that are fragile — one new element and the sheet is wrong
 * again. Building the document explicitly means what is printed is exactly what
 * is written here, and it cannot drift as the panel changes around it.
 *
 * WHY THE HTML IS ASSEMBLED HERE RATHER THAN RENDERED BY REACT
 * The invoice goes in the parcel, so it must be self-contained: no Tailwind
 * build, no fonts to fetch, nothing that could still be loading when the print
 * dialog opens and leave the customer's copy half-styled.
 */

/** Escape everything interpolated — a saree name or address is not trusted markup. */
const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `₹${n.toFixed(2)}` : "—";
};

export function printInvoice(order, shopDetails = {}) {
  if (!order) return;

  const {
    name: shopName = "PAI Silks",
    address = "City Bus Stand Road, Vidya Bhavan Building, Opposite City Bus Stand, Hassan – 573201, Karnataka",
    phone = "+91 89713 69898",
    email = "paisilks@gmail.com",
    gstin = "29AFRPP8577M1Z2",
  } = shopDetails;

  // ⚠️ This reads the NORMALISED order, not the raw API row.
  //
  // AdminHomePage.normalizeOrders renames every field before the order reaches
  // the page — product_list→product, customer_name→customerName,
  // shipping_address→address, status_of_order→status, and so on. This file was
  // written against the raw names, so nearly every lookup returned undefined
  // and printed an em dash.
  //
  // The giveaway was that Subtotal, Shipping and Total were CORRECT: `amount`
  // and `shipping_fee` are the only two fields whose names are identical in
  // both shapes. Everything else was blank.
  const items = Array.isArray(order.product) ? order.product : [];

  const rows = items
    .map((it, i) => {
      const qty = Number(it.qty) || 1;
      const price = Number(it.price) || 0;
      return `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${esc(it.name || "Product")}</td>
          <td class="num">${qty}</td>
          <td class="num">${money(price)}</td>
          <td class="num">${money(price * qty)}</td>
        </tr>`;
    })
    .join("");

  // Subtotal is derived from the LINE ITEMS, and the total is the stored
  // order amount — never the other way round. The order total is what the
  // customer was actually charged (AB-16); recomputing it here would produce a
  // second opinion on paper about a figure that is already settled.
  const shipping = Number(order.shipping_fee) || 0;
  const total = Number(order.amount) || 0;
  const subtotal = total - shipping;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice — Order ${esc(order.orderId ?? order.id)}</title>
<style>
  /* mm, not px: this is measured on paper, not a screen. */
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #1a1a1a; font-size: 12px; margin: 0;
  }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 2px solid #68232B; padding-bottom: 10px; margin-bottom: 14px; }
  .shop-name { font-size: 20px; font-weight: 700; color: #68232B; margin: 0 0 4px; }
  .muted { color: #555; line-height: 1.5; }
  .doc-title { font-size: 16px; font-weight: 700; text-align: right; margin: 0 0 4px; }
  .grid { display: flex; gap: 24px; margin-bottom: 14px; }
  .grid > div { flex: 1; }
  h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
       color: #68232B; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { background: #f6f1ea; text-align: left; padding: 7px 8px;
       border-bottom: 1px solid #ddd; font-size: 11px; text-transform: uppercase;
       letter-spacing: .04em; }
  td { padding: 7px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  th.num { text-align: right; }
  tfoot td { border-bottom: none; padding: 4px 8px; }
  tfoot .label { text-align: right; color: #555; }
  tfoot .grand td { border-top: 2px solid #68232B; font-weight: 700; font-size: 14px;
                    color: #68232B; padding-top: 8px; }
  .foot { margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee;
          text-align: center; color: #777; font-size: 11px; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <p class="shop-name">${esc(shopName)}</p>
      <div class="muted">
        ${esc(address)}<br>
        ${esc(phone)} &nbsp;·&nbsp; ${esc(email)}<br>
        GSTIN: ${esc(gstin)}
      </div>
    </div>
    <div>
      <p class="doc-title">INVOICE</p>
      <div class="muted" style="text-align:right">
        Order #${esc(order.orderId ?? order.id)}<br>
        ${esc(formatDate(order.date))}
      </div>
    </div>
  </div>

  <div class="grid">
    <div>
      <h3>Deliver to</h3>
      <div class="muted">
        <strong>${esc(order.customerName || "—")}</strong><br>
        ${esc(order.address || "—")}<br>
        ${esc(order.contactNumber || "—")}<br>
        ${esc(order.email || "")}
      </div>
    </div>
    <div>
      <h3>Order details</h3>
      <div class="muted">
        Status: ${esc(order.status || "—")}<br>
        Payment: ${esc(order.paymentMethod || "—")} (${esc(order.paymentStatus || "—")})<br>
        ${
          order.carrier
            ? `Carrier: ${esc(order.carrier)}<br>Consignment: ${esc(order.consignment_number || "—")}`
            : "Carrier: not yet despatched"
        }
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:32px">#</th>
        <th>Item</th>
        <th class="num" style="width:50px">Qty</th>
        <th class="num" style="width:90px">Price</th>
        <th class="num" style="width:90px">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="5" style="text-align:center;color:#888">No items recorded</td></tr>`}
    </tbody>
    <tfoot>
      <tr><td colspan="4" class="label">Subtotal</td><td class="num">${money(subtotal)}</td></tr>
      <tr><td colspan="4" class="label">Shipping</td><td class="num">${money(shipping)}</td></tr>
      <tr class="grand"><td colspan="4" class="label">Total</td><td class="num">${money(total)}</td></tr>
    </tfoot>
  </table>

  <div class="foot">
    Prices are inclusive of GST. Thank you for shopping with ${esc(shopName)}.
  </div>
</body>
</html>`;

  // A HIDDEN IFRAME, not a pop-up window.
  //
  // This used to be window.open(): it flashed a second browser window, and
  // nothing ever closed it — dismissing the print dialog left an `about:blank`
  // window full of invoice sitting there for the admin to close by hand, every
  // single time. It was also blockable by the pop-up blocker.
  //
  // An iframe prints exactly the same document with no window at all, cannot be
  // pop-up blocked, and removes itself when the dialog closes. Same-origin, so
  // contentWindow.print() is reachable.
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("title", "Invoice");
  // Positioned off-screen rather than display:none — a hidden iframe has no
  // layout box in some browsers, which can print a blank sheet.
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(frame);

  // Guarded so a double afterprint (some browsers fire it more than once)
  // cannot try to remove a node that is already gone.
  let removed = false;
  const cleanUp = () => {
    if (removed) return;
    removed = true;
    frame.remove();
  };

  frame.onload = () => {
    const win = frame.contentWindow;
    // Cleanup is driven by afterprint, with a timer as the backstop: Safari has
    // historically not fired afterprint inside an iframe, and leaking one
    // invisible iframe per print would accumulate silently over a day's orders.
    // 60s is far longer than any dialog stays open, and removing the frame
    // early would cancel a print in progress — the worse failure of the two.
    win.addEventListener("afterprint", cleanUp, { once: true });
    setTimeout(cleanUp, 60000);

    win.focus();
    win.print();
  };

  // Written AFTER onload is attached. Assigning srcdoc/writing first can fire
  // load before the handler exists in some browsers, leaving nothing to print.
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
}
