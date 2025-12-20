import React from 'react'

import RecentOrders from "@/components/RecentOrders/RecentOrders"


const OrderList = ({ orders, displayOrderPage }) => {
  return (
    <div className="p-10">
      <div className="flex flex-col gap-4 mb-6">
        <p className="text-4xl">OrderList</p>
        <p className="text-xl">Home &gt; OrderList</p>
      </div>

      <div className="my-5 w-full bg-white rounded-2xl p-6">
        <RecentOrders
          orders={orders}
          displayOrderPage={displayOrderPage}
        />
      </div>
    </div>
  );
}

export default OrderList
