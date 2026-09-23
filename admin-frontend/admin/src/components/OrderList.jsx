import React from 'react'

import RecentOrders from "@/components/RecentOrders/RecentOrders"


const OrderList = ({ orders, displayOrderPage }) => {
  return (
    <div className="p-5">
      <div className="flex flex-col gap-4 mb-6">
        <p className="text-4xl">OrderList</p>
        <p className="text-xl">Home &gt; OrderList</p>
      </div>

      {/* `p-6` matches the dashboard's wrapper around this same component. It
          was missing here, so the identical table sat flush against the panel
          edge on this screen and inset on the other. */}
      <div className="my-5 w-full bg-white rounded-2xl p-4 sm:p-6">
        <RecentOrders
          orders={orders}
          displayOrderPage={displayOrderPage}
        />
      </div>
    </div>
  );
}

export default OrderList
