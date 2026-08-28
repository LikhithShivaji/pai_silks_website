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
      <div className="overflow-hidden rounded-md">
        <Table>
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
