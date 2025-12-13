import React from "react"
import { DataTable } from "../RecentOrders/Data-table"
import {columns} from "./columns"
import { RecentOrders as recentOrdersData } from "@/RecentOrders";

export default function RecentOrders({orders, displayOrderPage}) {
  return (
    <div className="container mx-auto py-10">
      <p className="text-2xl">Recent Orders</p>
      <DataTable
        columns={columns}
        data={Array.isArray(orders) ? orders : []}
        displayOrderPage={displayOrderPage}
      />
    </div>
  );
}