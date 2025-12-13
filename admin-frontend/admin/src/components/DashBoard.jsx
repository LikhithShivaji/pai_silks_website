import React from "react";

import RecentOrders from "@/components/RecentOrders/RecentOrders";

import ThreeDotts from "../assets/svg/ThreeDots.svg?react";
import OrderBag from "../assets/svg/OrderBag.svg?react";

const DashBoard = ({ displayOrderPage, bestSellers = [] }) => {
  return (
    <div className="p-10">
      <div className="flex flex-col gap-4 mb-6">
        <p className="text-4xl ">DashBoard</p>
        <p className="text-xl">Home {`>`} DashBoard</p>
      </div>
      <div className="flex w-full border-1 gap-10 my-5">
        <div className="bg-white rounded-2xl p-5 px-10 w-full flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <p className="font-semibold">Total Orders</p>
            <ThreeDotts className="cursor-pointer" />
          </div>
          <div className="flex justify-center gap-6 items-center">
            <div className="bg-[#68232B] p-3 rounded-xl">
              <OrderBag />
            </div>
            <p className="font-semibold">Numbers</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 px-10 w-full flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <p className="font-semibold">Active Orders</p>
            <ThreeDotts className="cursor-pointer" />
          </div>
          <div className="flex justify-center gap-6 items-center">
            <div className="bg-[#68232B] p-3 rounded-xl">
              <OrderBag />
            </div>
            <p className="font-semibold">Numbers</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 px-10 w-full flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <p className="font-semibold">Completed Orders</p>
            <ThreeDotts className="cursor-pointer" />
          </div>
          <div className="flex justify-center gap-6 items-center">
            <div className="bg-[#68232B] p-3 rounded-xl">
              <OrderBag />
            </div>
            <p className="font-semibold">Numbers</p>
          </div>
        </div>
      </div>
      <div className="w-full bg-white p-6 rounded-2xl flex flex-col gap-5">
        <div className="flex justify-between">
          <p className="font-semibold text-2xl border-b-1 w-full">
            Best Sellers
          </p>
          <ThreeDotts className="cursor-pointer" />
        </div>

        {bestSellers.length === 0 ? (
          <p className="text-gray-500">No best sellers yet</p>
        ) : (
          bestSellers.slice(0, 3).map((item) => (
            <div key={item.id} className="flex justify-between my-2">
              <div className="flex items-center gap-4 w-full">
                <div className="bg-gray-300 p-6 rounded-xl">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    "img"
                  )}
                </div>
                <div className="font-semibold">{item.name}</div>
              </div>

              <div className="flex flex-col justify-center w-full items-end">
                <p className="font-semibold text-xl">₹{item.revenue}</p>
                <p>{item.totalSold} sold</p>
              </div>
            </div>
          ))
        )}

        <div className="bg-[#68232B] max-w-fit text-white px-4 py-3 rounded-xl">
          View All
        </div>
      </div>

      <div className="my-5 w-full bg-white rounded-2xl p-6">
        <RecentOrders displayOrderPage={displayOrderPage} />
      </div>
    </div>
  );
};

export default DashBoard;
