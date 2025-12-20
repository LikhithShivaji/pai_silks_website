import React from "react"
import { DataTable } from "../OrderedProducts/Data-table"
import {columns} from "./columns"
import { RecentOrders as recentOrdersData } from "@/RecentOrders";

export default function OrderedProducts() {
  return (
    <div className="container mx-auto py-10">
      <p className="text-2xl">Ordered Products</p>
      <DataTable columns={columns} data={recentOrdersData}/>
    </div>
  );
}