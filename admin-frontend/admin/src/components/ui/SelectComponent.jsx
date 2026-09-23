import * as React from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ORDER_STATUSES } from "@/constants/orderStatus"

/**
 * Colour per status. Presentation only — the list of statuses itself is NEVER
 * defined here.
 *
 * A status with no entry falls back to neutral text, so adding one to the enum
 * can never make this component throw or drop an option; it just appears
 * unstyled until a colour is chosen for it.
 */
const STATUS_COLOURS = {
  Pending: "text-yellow-600",
  Confirmed: "text-amber-600",
  Packed: "text-indigo-600",
  Shipped: "text-blue-600",
  "Out for Delivery": "text-cyan-700",
  Delivered: "text-green-600",
  Cancelled: "text-red-600",
  Refunded: "text-purple-600",
};

/**
 * Order status picker, driven by the ORDER_STATUSES enum.
 *
 * ⚠️ THIS LIST WAS HARDCODED AND WRONG. It offered
 * `Pending / Rejected / Shipped / Delivered`:
 *
 *   - **"Rejected" is not a status this system has ever had.** Choosing it sent
 *     a value the server's `isIn(appDefines.ORDER_STATUSES)` validator refuses,
 *     so the update failed with a 400 and the admin was told the status could
 *     not be changed, with no hint that the option itself was invented.
 *   - `Confirmed`, `Packed`, `Out for Delivery`, `Cancelled` and `Refunded`
 *     were UNREACHABLE — the database and the API accept them, and the
 *     dashboard counts them, but no one could select them.
 *
 * That is the AB-17 failure in a fourth place: another list of statuses,
 * written by hand, disagreeing with the enum. Deriving the options means the
 * admin panel, the API validator and the dashboard groupings can no longer
 * drift apart — adding a status to `ORDER_STATUSES` makes it selectable here
 * automatically.
 */
export function SelectComponent({ value, onChange }) {
  return (
    <Select value={value} onValueChange={onChange}>
      {/* Full width on a phone, 180px from `sm` up. A fixed 180px left the
          status control looking like an orphaned island above the full-width
          despatch fields below it. */}
      <SelectTrigger className="w-full sm:w-[180px]">
        <SelectValue placeholder="Change Status" />
      </SelectTrigger>

      <SelectContent>
        <SelectGroup>
          <SelectLabel>Delivery Status</SelectLabel>

          {ORDER_STATUSES.map((status) => (
            <SelectItem
              key={status}
              value={status}
              className={STATUS_COLOURS[status] ?? ""}
            >
              {status}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
