import React, { useEffect } from "react";
import PaiLogo from "./assets/PaiLogo.svg";
import { useState, useRef } from "react";

import data from "@/productData.json";

import DashBoard from "./components/DashBoard";
import AllProducts from "./components/AllProducts";
import OrderList from "./components/OrderList";
import AddProduct from "./components/AddProduct";
import DisplayOrderPage from "./components/DisplayOrderPage";
import UpdateProduct from "./components/UpdateProduct";
import { Menu, X, Trash, Bell } from "lucide-react";

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
  fetch("https://pai-silks-website-1.onrender.com/api/bestsellers")
    .then(async (res) => {
      const data = await res.json();

      if (data.success) {
        const cleanData = data.data.map((p) => {
          // 1. Calculate Revenue Manually
          const price = parseFloat(p.selling_price || 0);
          const sold = parseInt(p.total_sold || 0);
          const totalRevenue = price * sold;

          return {
            id: p.id,
            name: p.name,
            image: p.primary_image || "https://placehold.co/100", 
            totalSold: sold,
            revenue: totalRevenue, 
          };
        });

        setBestSellers(cleanData);
        console.log("clean data is",cleanData)
      }
    })
    .catch((err) => {
      console.error("BestSeller API error:", err);
    });
}, []);



  useEffect(() => {
    fetch("https://pai-silks-website.onrender.com/api/get-order-detils")
      .then((res) => res.json())
      .then((res) => {
        console.log("🔥 FRESH DATA FROM DB:", res);
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
      status: o.status_of_order || o.status || "Pending",
      amount: o.amount,
      address: o.shipping_address,
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      product: o.product_list.map((p) => ({
        name: p.product_name || "Product",
        qty: p.quantity,
        price: Number(p.price),
        // 👇 ADD THIS LINE
        image: p.image_url, 
      })),
    }));
  };

  const changeOrderStatus = async (orderId, newStatus) => {
    // 1. Optimistic UI Update (Keep this, it's good!)
    setOrders((prev) =>
      prev.map((o) => (String(o.id) === String(orderId) ? { ...o, status: newStatus } : o))
    );

    console.log("📤 Sending Update for ID:", orderId, "Status:", newStatus);

    try {
      const res = await fetch(
        "https://pai-silks-website.onrender.com/api/update-order-status",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          
          // 👇 THE UNIVERSAL PAYLOAD (Send every possible name)
          body: JSON.stringify({ 
              // ID variations
              id: orderId,
              orderId: orderId, 
              order_id: orderId,

              // Status variations
              status: newStatus, 
              status_of_order: newStatus,
              order_status: newStatus
          }),
        }
      );

      const data = await res.json();
      console.log("📥 Backend Response:", data);

      if (!res.ok) {
        console.error("Update failed on backend");
        // Optional: Revert UI if failed
      } 
    } catch (err) {
      console.error("❌ Network error", err);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return <DashBoard
      displayOrderPage={displayOrderPage}
      bestSellers={bestSellers}
      orders={orders}
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
            categories={categories}
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

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const renderSidebarContent = () => (
    <div className="flex flex-col gap-20 items-center p-[5%] w-full h-full overflow-y-scroll">
      
      <div className="flex flex-col w-full h-fit gap-5">
        <div className="w-full flex justify-between items-center">
           <div className="flex-1 flex justify-center">
             <img src={PaiLogo} alt="" />
           </div>
           
           <div className="xl:hidden cursor-pointer" onClick={() => setIsMobileMenuOpen(false)}>
             <X size={28} />
           </div>
        </div>

        <div
          onClick={() => {
            handleGoToDashBoardPage();
            setIsMobileMenuOpen(false); 
          }}
          className={`rounded-xl w-full p-3 text-center cursor-pointer transition-colors duration-300
          ${
            activeView === "dashboard"
              ? "bg-[#68232B] text-white"
              : "hover:bg-[#68232B] hover:text-white text-black"
          }`}
        >
          Dashboard
        </div>

        <div
          onClick={() => {
            handleOrderList();
            setIsMobileMenuOpen(false);
          }}
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
                setActiveView(category);
                handleGoToAllProductsPage();
                setIsMobileMenuOpen(false);
              }}
            >
              {category}
            </p>
            {hoveredIndex === index && (
              <div
                className="absolute right-2 cursor-pointer flex justify-center items-center"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(index);
                }}
              >
                <Trash size={18} />
              </div>
            )}
          </div>
        ))}

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
  );

  return (
    <div className="bg-[#FAFAFA] flex h-screen w-full relative">
      
      <div className="h-full w-[20%] hidden xl:flex border-r border-gray-200">
        {renderSidebarContent()}
      </div>
      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      <div className={`fixed top-0 left-0 h-full w-[75%] bg-[#FAFAFA] z-50 transform transition-transform duration-300 shadow-2xl xl:hidden ${
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
         {renderSidebarContent()}
      </div>

      <div className="h-full flex-1 flex flex-col w-full">
        <div className="h-[10%] p-3 px-5 md:px-10 flex items-center justify-between border-b">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="xl:hidden p-2 rounded-md hover:bg-gray-200"
                >
                    <Menu className="w-6 h-6 text-black" />
                </button>
            </div>
            <div className="flex gap-5 items-center">
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
                <button className="bg-[]">Logout</button>
            </div>
        </div>
        <div
          ref={containerRef}
          className="h-[90%] w-full bg-[#FFE9CC] overflow-y-auto scrollbar-hide"
        >
          <div className="w-full h-full">{renderView()}</div>
        </div>
      </div>
    </div>
  );
};

export default AdminHomePage;
