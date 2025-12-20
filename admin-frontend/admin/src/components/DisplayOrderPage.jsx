import React, { useState } from "react";
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

export default function DisplayOrderPage({
  order,
  onBack = () => {},
  onChangeStatus,
}) {
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
                  Placed: {new Date(order.date).toLocaleString()}
                </p>
              )}
              <p className="mt-1 text-sm">
                Status: <strong>{order.status ?? "—"}</strong>
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-500">Amount</p>
              <p className="text-xl font-semibold">₹{order.amount ?? "-"}</p>
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
                          ₹{it.price ?? it.amount ?? "-"}
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
          <p className="font-bold ">Customer</p>
          <p className="text-sm text-gray-500">
            Full Name: {order.customerName}
          </p>
          <p className="text-sm text-gray-500">Email: {order.email}</p>
          <p className="text-sm text-gray-500">
            Phone Number: {order.contactNumber}
          </p>
          <p className="text-sm text-gray-500">Address: {order.address}</p>
          <p className="text-sm text-gray-500">
            Order Date: {new Date(order.date).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="w-full bg-white rounded-xl p-5 flex flex-col gap-10 my-5">
        <Table>
          <TableCaption>A list of your recent invoices.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Invoice</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Product Id</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.product.map((product, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">
                  #{order.orderId}-{index + 1}
                </TableCell>
                <TableCell>{product.name}</TableCell>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{product.qty}</TableCell>
                <TableCell>{order.status}</TableCell>
                <TableCell>{order.paymentMethod}</TableCell>
                <TableCell className="text-right">
                  ₹{product.price * product.qty}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>

          <TableFooter>
            <TableRow>
              <TableCell colSpan={6}>Total</TableCell>
              <TableCell className="text-right">₹{order.amount}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
