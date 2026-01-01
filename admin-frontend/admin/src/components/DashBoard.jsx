import React, { useMemo } from "react"; // Import useMemo
import RecentOrders from "@/components/RecentOrders/RecentOrders";
import ThreeDotts from "../assets/svg/ThreeDots.svg?react";
import OrderBag from "../assets/svg/OrderBag.svg?react";

const DashBoard = ({ displayOrderPage, bestSellers = [], orders = [] }) => {
  // 1. Calculate Stats (Total, Active, Completed)
  const stats = useMemo(() => {
    return {
      total: orders.length,
      active: orders.filter((o) =>
        ["pending", "processing", "shipped"].includes(o.status?.toLowerCase())
      ).length,
      completed: orders.filter((o) =>
        ["completed", "delivered"].includes(o.status?.toLowerCase())
      ).length,
    };
  }, [orders]);

  // 2. Filter for the Table (Pending Only)
  const pendingOrders = orders.filter(
    (order) => order.status && order.status.trim().toLowerCase() === "pending"
  );

  return (
    <div className="p-5">
      <div className="flex flex-col gap-4 mb-6">
        <p className="text-4xl ">Dashboard</p>
        <p className="text-xl">Home {`>`} Dashboard</p>
      </div>

      {/* --- STATS CARDS --- */}
      <div className="flex flex-col lg:flex-row w-full gap-5 lg:gap-10 my-5">
        {/* Total Orders */}
        <div className="bg-white rounded-2xl p-5 px-10 w-full flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <p className="font-semibold">Total Orders</p>
            <ThreeDotts className="cursor-pointer" />
          </div>
          <div className="flex justify-center gap-6 items-center">
            <div className="bg-[#68232B] p-3 rounded-xl">
              <OrderBag />
            </div>
            {/* 🔥 Fixed: Shows Real Number */}
            <p className="font-semibold text-2xl">{stats.total}</p>
          </div>
        </div>

        {/* Active Orders */}
        <div className="bg-white rounded-2xl p-5 px-10 w-full flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <p className="font-semibold">Active Orders</p>
            <ThreeDotts className="cursor-pointer" />
          </div>
          <div className="flex justify-center gap-6 items-center">
            <div className="bg-[#68232B] p-3 rounded-xl">
              <OrderBag />
            </div>
            {/* 🔥 Fixed: Shows Real Number */}
            <p className="font-semibold text-2xl">{stats.active}</p>
          </div>
        </div>

        {/* Completed Orders */}
        <div className="bg-white rounded-2xl p-5 px-10 w-full flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <p className="font-semibold">Completed Orders</p>
            <ThreeDotts className="cursor-pointer" />
          </div>
          <div className="flex justify-center gap-6 items-center">
            <div className="bg-[#68232B] p-3 rounded-xl">
              <OrderBag />
            </div>
            {/* 🔥 Fixed: Shows Real Number */}
            <p className="font-semibold text-2xl">{stats.completed}</p>
          </div>
        </div>
      </div>

      {/* --- BEST SELLERS SECTION --- */}
      <div className="w-full bg-white p-6 rounded-2xl flex flex-col gap-5">
        <div className="flex justify-between">
          <p className="font-semibold text-2xl border-b-1 w-full">
            Best Sellers
          </p>
          <ThreeDotts className="cursor-pointer" />
        </div>

        {bestSellers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-5 opacity-50">
            <p className="text-gray-500">No best sellers yet</p>
          </div>
        ) : (
          bestSellers.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="flex justify-between items-center my-3 border-b border-gray-100 pb-2 last:border-0"
            >
              <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0 pr-2">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl bg-gray-100 overflow-hidden border border-gray-200 shadow-sm flex-shrink-0">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = "https://placehold.co/100?text=No+Img";
                    }}
                  />
                </div>

                <div className="flex flex-col min-w-0">
                  <p className="font-semibold text-gray-800 text-sm md:text-base truncate">
                    {item.name}
                  </p>
                  <p className="text-[10px] md:text-xs text-gray-400">
                    ID: {item.id}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end flex-shrink-0">
                <p className="font-bold text-sm md:text-lg text-[#68232B]">
                  {new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  }).format(item.revenue)}
                </p>
                <p className="text-[10px] md:text-xs text-gray-500 font-medium whitespace-nowrap">
                  {item.totalSold} sold
                </p>
              </div>
            </div>
          ))
        )}

        <div className="bg-[#68232B] max-w-fit text-white px-5 py-2 rounded-xl text-sm font-medium cursor-pointer mt-2 hover:bg-[#8B2E39] transition-colors">
          View All
        </div>
      </div>

      {/* --- RECENT ORDERS TABLE --- */}
      <div className="my-5 w-full bg-white rounded-2xl p-6">
        <RecentOrders
          displayOrderPage={displayOrderPage}
          orders={pendingOrders}
        />
      </div>
    </div>
  );
};

export default DashBoard;
