"use client"

import { MoreHorizontal } from "lucide-react"
import { ArrowUpDown } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

import { Button } from "../ui/button"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"

import { useToast } from "@/ToastContext"

/**
 * The per-row actions menu.
 *
 * Extracted into a component so it can use hooks — TanStack calls `cell` as a
 * plain function, so a hook there would be a hook outside a component.
 *
 * The "Copy" item had three bugs in a single line. See CLAUDE.md AF-25:
 *
 *   1. `event.stopPropagation()` referenced an UNDECLARED GLOBAL. It resolved
 *      to `window.event`, which only Chrome provides, so in Firefox and Safari
 *      it threw ReferenceError and the copy never ran.
 *   2. The alert fired FIRST, so it announced success before that throw —
 *      Firefox users were told the ID was copied when nothing had been.
 *   3. It copied `payment.id`, which is the ORDER id, while labelling it a
 *      payment ID. This object carries no payment id at all.
 */
const RowActions = ({ row }) => {
  const { showToast } = useToast()
  const order = row.original
  const orderId = String(order.orderId ?? order.id ?? "")

  const copyOrderId = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(orderId)
      showToast(`Order ID ${orderId} copied.`, "success")
    } catch {
      // The Clipboard API needs a secure context and permission; it genuinely
      // fails on plain http and in some browsers. Say so rather than claiming
      // success, which is what the old code did.
      showToast("Could not copy — your browser blocked clipboard access.")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={copyOrderId}>Copy order ID</DropdownMenuItem>
        {/* "View customer" and "View payment details" were menu items with no
            onClick at all — dead affordances that looked functional. Removed
            rather than left in place; AF-30 covers the rest of that pattern. */}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const columns = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ), 
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },

  {
    accessorKey: "product",
    // 1. Keep your existing Sortable Header
    header: ({ column }) => {
      return (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Product
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    },
    // 2. Add this Cell Renderer for the "+X more" logic
    cell: ({ row }) => {
      // Get the list of products
      const products = row.original.product; 

      // Safety check: Ensure it is an array
      if (!Array.isArray(products) || products.length === 0) {
        return <div className="text-center">-</div>;
      }

      // Logic: Get 1st name & count the rest
      // products[0] is guarded for array-ness above but not for element type.
      // A null first element threw "Cannot read properties of null (reading
      // 'name')", which killed the cell and — with no ErrorBoundary — the page.
      // Verified. See CLAUDE.md AF-C-F13.
      const firstName = products[0]?.name || "Unknown Product";
      const remainingCount = products.length - 1;

      return (
        <div className="flex flex-col items-center text-center">
          <span className="font-medium">{firstName}</span>
          
          {remainingCount > 0 && (
            <span className="text-xs text-[#68232B] font-bold">
              +{remainingCount} others
            </span>
          )}
        </div>
      );
    },
  },


  {
    accessorKey: "orderId",
    header: ({ column }) => {
      return (
        <div className="flex justify-center">
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Order ID
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
        </div>
      )
    },
  },
  {
    accessorKey: "date",
    header: ({ column }) => {
      return (
        <div className="flex justify-center">
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
        </div>
      )
    },
  },
  {
    accessorKey: "customerName",
    header: ({ column }) => {
      return (
        <div className="flex justify-center">
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Customer Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
        </div>
      )
    },
  },

  {
    accessorKey: "contactNumber",
    header: ({ column }) => {
      return (
        <div className="flex justify-center">
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Contact Number
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
        </div>
      )
    },
  },

  {
    accessorKey: "status",
    header: () => <div className="text-center">Status</div>,
  },

  {
    accessorKey: "amount",
    header: () => <div className="">Amount</div>,
    cell: ({ row }) => {
      // Intl.format(NaN) renders the literal "₹NaN" rather than throwing, so a
      // missing or non-numeric amount silently displayed ₹NaN to the admin.
      // Verified: parseFloat(undefined) -> NaN -> "₹NaN". See CLAUDE.md AF-C-FIX.
      const amount = parseFloat(row.getValue("amount"))
      if (!Number.isFinite(amount)) {
        return <div className="font-medium text-gray-400">—</div>
      }
      const formatted = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
      }).format(amount)

      return <div className=" font-medium">{formatted}</div>
    },
  },
  {
    id: "actions",
    // Rendered as a real component, not called as a plain function.
    //
    // `cell` is invoked by TanStack, so calling a hook directly inside it would
    // be a hook call outside a component — unsafe. Returning <RowActions /> lets
    // RowActions legitimately use useToast.
    cell: ({ row }) => <RowActions row={row} />,
  },
]

