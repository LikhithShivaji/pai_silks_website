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

export function SelectComponent({ value, onChange }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Change Status" />
      </SelectTrigger>

      <SelectContent>
        <SelectGroup>
          <SelectLabel>Delivery Status</SelectLabel>

          <SelectItem value="Pending" className="text-yellow-500">
            Pending
          </SelectItem>

          <SelectItem value="Rejected" className="text-red-500">
            Rejected
          </SelectItem>

          <SelectItem value="Shipped" className="text-blue-500">
            Shipped
          </SelectItem>

          <SelectItem value="Delivered" className="text-green-500">
            Delivered
          </SelectItem>

        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
