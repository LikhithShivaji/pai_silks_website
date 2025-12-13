import React, { useEffect } from "react";
import PaiLogo from "./assets/PaiLogo.svg?react";
import { useState, useRef } from "react";

import data from "@/productData.json";

import DashBoard from "./components/DashBoard";
import AllProducts from "./components/AllProducts";
import OrderList from "./components/OrderList";
import AddProduct from "./components/AddProduct";
import { Bell, Trash } from "lucide-react";
import DisplayOrderPage from "./components/DisplayOrderPage";
import UpdateProduct from "./components/UpdateProduct";

const AdminHomePage = () => {
  const notifications = 3;
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [activeView, setActiveView] = useState("dashboard");
  const [currentView, setCurrentView] = useState("dashboard");

  const [categories, setCategories] = useState([]);
  const [categoryProducts, setCategoryProducts] = useState({});

  const [newCategory, setNewCategory] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [actionOpenIndex, setActionOpenIndex] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [updateProductDetails, setUpdateProductDetails] = useState(null);
  const containerRef = useRef(null);
  const [bestSellers, setBestSellers] = useState([]);

  const handleGoToDashBoardPage = () => {
    setCurrentView("dashboard");
    setActiveView("dashboard");
  };

  const handleGoToAllProductsPage = () => setCurrentView("allProducts");

  const handleOrderList = () => {
    setCurrentView("orderList");
    setActiveView("orders");
  };

  const handleAddProductPage = () => setCurrentView("addProduct");

  const handleUpdateProductPage = (product) => {
    setUpdateProductDetails(product);
    setCurrentView("updateProduct");
  };

  const displayOrderPage = (order) => {
    setSelectedOrderId(order.id);
    setCurrentView("displayOrderPage");
  };

  const selectedOrder = orders.find(
    (o) => String(o.id) === String(selectedOrderId)
  );

  useEffect(() => {
  fetch("https://pai-silks-website.onrender.com/api/get-bestSeller-list")
    .then(async (res) => {
      console.log("BestSeller API status:", res.status);

      const data = await res.json();
      console.log("BestSeller API raw response:", data);

      if (data.success) {
        setBestSellers(normalizeBestSellers(data.data));
      }
    })
    .catch((err) => {
      console.error("BestSeller API error:", err);
    });
}, []);


const normalizeBestSellers = (list) => {
  return list.map((p) => ({
    id: p.product_id,
    name: p.product_name,
    image: p.image_url || null,
    totalSold: p.total_quantity,
    revenue: p.total_revenue,
  }));
};



  useEffect(() => {
    fetch("https://pai-silks-website.onrender.com/api/get-order-detils")
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          setOrders(normalizeOrders(res.data));
          console.log("response is ", res);
        }
      })
      .catch(console.error);
  }, []);

  const normalizeOrders = (apiOrders) => {
    return apiOrders.map((o) => ({
      id: o.id,
      orderId: o.id,
      date: o.date,
      customerName: o.customer_name || "Guest",
      status: o.status_of_order,
      amount: o.amount,
      address: o.shipping_address,
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      product: o.product_list.map((p) => ({
        name: p.product_name || "Product",
        qty: p.quantity,
        price: Number(p.price),
      })),
    }));
  };

  const changeOrderStatus = async (orderId, newStatus) => {
    // optimistic update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );

    try {
      const res = await fetch(
        "https://pai-silks-website.onrender.com/api/update-order-status",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, status: newStatus }),
        }
      );

      console.log("PUT status code:", res.status);

      const data = await res.json();
      console.log("PUT response body:", data);

      if (!res.ok) {
        console.error("Update failed on backend");
      } else {
        console.log("✅ Order status updated successfully");
      }
    } catch (err) {
      console.error("❌ Network / fetch error", err);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return <DashBoard
      displayOrderPage={displayOrderPage}
      bestSellers={bestSellers}
    />;

      case "allProducts":
        return (
          <AllProducts
            categoryName={selectedCategory}
            onBack={() => setCurrentView("dashboard")}
            onAddProductClick={handleAddProductPage}
            onUpdateProduct={handleUpdateProductPage}
          />
        );

      case "displayOrderPage":
        return (
          <DisplayOrderPage
            order={selectedOrder}
            onBack={handleOrderList}
            onChangeStatus={(status) =>
              changeOrderStatus(selectedOrderId, status)
            }
          />
        );

      case "orderList":
        return (
          <OrderList orders={orders} displayOrderPage={displayOrderPage} />
        );

      case "addProduct":
        return (
          <AddProduct
            categoryName={selectedCategory}
            setCategoryProducts={setCategoryProducts}
            onBack={() => setCurrentView("allProducts")}
          />
        );

      case "updateProduct":
        return (
          <UpdateProduct
            categoryName={selectedCategory}
            setCategoryProducts={setCategoryProducts}
            onBack={() => setCurrentView("allProducts")}
            updateProductDetails={updateProductDetails}
          />
        );

      default:
        return <DashBoard
      displayOrderPage={displayOrderPage}
      bestSellers={bestSellers}
    />;;
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("categories");
    if (stored) {
      setCategories(JSON.parse(stored));
    } else {
      setCategories(data.categories); // load from data.json initially
    }
  }, []);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [currentView]);

  const updateCategories = (newList) => {
    setCategories(newList);
    localStorage.setItem("categories", JSON.stringify(newList));
  };

  const handleAddClick = () => setIsAdding(true);

  const handleSave = () => {
    if (newCategory.trim() === "") return;
    updateCategories([...categories, newCategory]);
    setNewCategory("");
    setIsAdding(false);
  };

  const handleCancel = () => {
    setNewCategory("");
    setIsAdding(false);
  };

  const handleDelete = (index) => {
    updateCategories(categories.filter((_, i) => i !== index));
    setActionOpenIndex(null);
  };

  return (
    <div className="bg-[#FAFAFA] flex h-screen">
      <div className="h-full w-[20%] flex flex-col gap-20 items-center p-[2%] border-1">
        <div className="flex flex-col w-full h-fit gap-5">
          <div className="w-full flex justify-center">
            <PaiLogo alt="" />
          </div>

          {/* Dashboard */}
          <div
            onClick={handleGoToDashBoardPage}
            className={`rounded-xl w-full p-3 text-center cursor-pointer transition-colors duration-300
          ${
            activeView === "dashboard"
              ? "bg-[#68232B] text-white"
              : "hover:bg-[#68232B] hover:text-white text-black"
          }`}
          >
            Dashboard
          </div>

          {/* Order List */}
          <div
            onClick={handleOrderList}
            className={`rounded-xl w-full p-3 text-center cursor-pointer transition-colors duration-300
          ${
            activeView === "orders"
              ? "bg-[#68232B] text-white"
              : "hover:bg-[#68232B] hover:text-white text-black"
          }`}
          >
            Order List
          </div>
        </div>

        <div className="flex flex-col gap-5 w-full">
          <p className="text-2xl w-full text-center font-semibold">
            Categories
          </p>

          {/* Render saved categories */}
          {categories.map((category, index) => (
            <div
              key={index}
              className={`relative border rounded-xl flex justify-between items-center transition-colors duration-300 cursor-pointer 
            ${
              activeView === category
                ? "bg-[#68232B] text-white"
                : "hover:bg-[#68232B] hover:text-white text-black"
            }`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <p
                className="w-full h-full p-3 rounded-xl"
                onClick={() => {
                  setSelectedCategory(category);
                  setActiveView(category); // ✅ highlight this category
                  handleGoToAllProductsPage();
                }}
              >
                {category}
              </p>

              {/* Show delete icon on hover */}
              {hoveredIndex === index && (
                <div
                  className="absolute right-2 cursor-pointer flex justify-center items-center"
                  onClick={(e) => {
                    e.stopPropagation(); // prevent triggering category click
                    handleDelete(index);
                  }}
                >
                  <Trash />
                </div>
              )}
            </div>
          ))}

          {/* Add new category input + buttons */}
          {isAdding && (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Enter category name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="p-2 border rounded-lg outline-none"
              />
              <div className="flex w-full justify-center gap-3">
                <div
                  onClick={handleCancel}
                  className="bg-black w-full text-white px-3 py-1 rounded-lg text-center"
                >
                  Cancel
                </div>
                <div
                  onClick={handleSave}
                  className="bg-black w-full text-white px-3 py-1 rounded-lg text-center"
                >
                  Save
                </div>
              </div>
            </div>
          )}

          {/* Add category button */}
          {!isAdding && (
            <div
              className="border-1 p-3 rounded-xl bg-[#68232B] flex justify-center items-center text-white cursor-pointer"
              onClick={handleAddClick}
            >
              ADD CATEGORY
            </div>
          )}
        </div>
      </div>

      <div className="h-full w-[85%]">
        <div className="h-[10%] p-3 px-10 flex gap-5 items-center justify-end border-1">
          <div
            className="relative inline-block cursor-pointer"
            onClick={() => alert("Go to OrderSection")}
          >
            <Bell className="w-6 h-6 text-gray-800" />
            {notifications > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {notifications}
              </span>
            )}
          </div>
          <div>Admin</div>
        </div>
        <div
          ref={containerRef}
          className=" h-[90%] w-full bg-[#FFE9CC] overflow-y-auto scrollbar-hide"
        >
          <div className="w-full h-full border-1">{renderView()}</div>
        </div>
      </div>
    </div>
  );
};

export default AdminHomePage;
