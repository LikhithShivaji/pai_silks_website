import React from "react";

/**
 * Table cell content that cuts off with an ellipsis and reveals the full value
 * on hover.
 *
 * WHY NOT A HORIZONTAL SCROLLBAR
 * The order table has eight columns and a long saree name pushes it past the
 * viewport. Scrolling was considered and rejected by the owner: the admin would
 * have to scroll sideways to read a customer's phone number, and the columns
 * that matter most are the ones that fall off the end. Truncating keeps the
 * whole row visible and readable at a glance, and the full text is one hover
 * away for the rare case it is needed.
 *
 * WHY `title` RATHER THAN A TOOLTIP COMPONENT
 * The browser's native tooltip needs no library, no portal, no positioning
 * logic, and it cannot be clipped by an ancestor's `overflow: hidden` — which
 * this cell sits inside by definition. A styled tooltip inside a truncating
 * container is exactly the case where custom tooltips get cut in half.
 *
 * The `title` is set ONLY when the text is long enough to plausibly truncate.
 * Putting one on every cell means hovering anywhere in the table pops a box
 * repeating what is already fully visible, which trains people to ignore them.
 */
export default function TruncatedCell({
  text,
  threshold = 18,
  // A cap on THIS cell, not on the table. The table uses auto layout, so a
  // column grows to fit its content — one long saree name would otherwise widen
  // the column and squeeze everything else. Capping here is what makes the
  // ellipsis appear at all; without a width limit `truncate` has nothing to
  // truncate against.
  maxWidthClass = "max-w-[180px]",
  className = "",
  children,
}) {
  const value = text ?? "";
  const mayTruncate = String(value).length > threshold;

  return (
    <div
      // `truncate` is overflow-hidden + text-ellipsis + whitespace-nowrap.
      // `mx-auto` keeps the capped box centred in its cell, matching the
      // centred alignment the rest of the table uses.
      className={`truncate mx-auto ${maxWidthClass} ${className}`}
      title={mayTruncate ? String(value) : undefined}
    >
      {children ?? value}
    </div>
  );
}
