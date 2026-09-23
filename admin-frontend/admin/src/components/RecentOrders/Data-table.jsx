"use client";
import * as React from "react";

import { Button } from "../ui/button";
import { Input } from "@/components/ui/input";

import {
  // ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DataTable({
  columns,
  data,
  displayOrderPage,
  // Optional controlled sorting. When the parent passes these (RecentOrders
  // does, to drive the sort dropdown), the parent owns the state; otherwise the
  // table keeps its own. Uncontrolled callers are unaffected.
  sorting: sortingProp,
  onSortingChange: onSortingChangeProp,
}) {
  const [internalSorting, setInternalSorting] = React.useState([]);
  const isControlled = sortingProp !== undefined;
  const sorting = isControlled ? sortingProp : internalSorting;
  const setSorting = isControlled ? onSortingChangeProp : setInternalSorting;

  const [columnFilters, setColumnFilters] = React.useState([]);
  // {} not [] — this is a Record<columnId, boolean>. It was initialised to an
  // array, which is truthy and iterable but has no column keys, so visibility
  // lookups silently missed.
  const [columnVisibility, setColumnVisibility] = React.useState({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [globalFilter, setGlobalFilter] = React.useState("");

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    // AF-20: every one of these was missing.
    //
    // The table was passed `state` — making it FULLY CONTROLLED — while
    // registering only onGlobalFilterChange. TanStack therefore had no way to
    // write back any other piece of state, so it silently froze:
    //   - every sort header did nothing when clicked
    //   - the row-select checkboxes never checked
    //   - the Columns dropdown never hid a column
    // Nothing errored; the UI just ignored the user. getSortedRowModel was
    // also absent, so even a sorting state would not have reordered rows.
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),

    globalFilterFn: (row, columnId, filterValue) => {
      const search = filterValue.toLowerCase();

      const phone = String(row.original.contactNumber ?? "").toLowerCase();
      const orderId = String(row.original.orderId ?? "").toLowerCase();

      return phone.includes(search) || orderId.includes(search);
    },
  });

  return (
    <div>
      <div className="flex items-center py-4">
        <Input
          placeholder="Search by phone number or order ID..."
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Two things here.

          PADDING: the shadcn primitives use `px-2` / `p-2` on cells, so the
          first and last columns sat flush against the container border — the
          row looked clipped rather than laid out. Applied with child selectors
          rather than by editing components/ui/table.jsx, which is vendored and
          shared by every other table in the panel.

          TRUNCATION, not scrolling: a long product or customer name is cut off
          with an ellipsis and the full value is on hover, so the table keeps
          its shape instead of growing a horizontal scrollbar.

          ⚠️ AUTO layout, deliberately NOT `table-fixed`. Fixed layout splits the
          width equally across all eight columns regardless of content, so every
          cell must then truncate or it spills into its neighbour — the columns
          visibly overlapped, headers included. Auto layout lets each column take
          what it needs, and the long ones are capped individually with
          max-width on the cell instead. Constrain the few that can be long;
          leave the rest alone. */}
      <div
        className="overflow-hidden rounded-md
          [&_th:first-child]:pl-6 [&_td:first-child]:pl-6
          [&_th:last-child]:pr-6  [&_td:last-child]:pr-6"
      >
        <Table className="w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                // Each Row data is available
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                  onClick={() => {
                    displayOrderPage(row.original);
                  }} //This is the code which is opening the displayOrderPage.
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-center py-7 ">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
