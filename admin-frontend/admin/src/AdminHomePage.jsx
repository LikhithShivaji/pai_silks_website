import React, { useEffect } from "react";
import PaiLogo from "./assets/PaiLogo.svg";
import { useState, useRef } from "react";

// `import data from "@/productData.json"` removed along with the file. It was a
// two-line stub — {"categories": []} — and the binding was shadowed by a local
// `const data` in every function that used that name, so the import was never
// read. It was also one of the standing no-unused-vars lint errors (AF-33).
import DashBoard from "./components/DashBoard";
import AllProducts from "./components/AllProducts";
import OrderList from "./components/OrderList";
import AddProduct from "./components/AddProduct";
import DisplayOrderPage from "./components/DisplayOrderPage";
import UpdateProduct from "./components/UpdateProduct";
import { Menu, X, Trash, Bell } from "lucide-react";
// CLIENT_API is no longer imported here: this page's last cross-service call
// (bestsellers) moved to the admin backend. AddProduct.jsx still fetches
// collections from the client backend — see the API-ownership item in
// CLAUDE.md, scheduled after the phases.
import { ADMIN_API, apiFetch } from "@/config/api";
import { useToast } from "@/ToastContext";

const AdminHomePage = () => {
  const { showToast } = useToast();
  const notifications = 3;
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [activeView, setActiveView] = useState("dashboard");
  const [currentView, setCurrentView] = useState("dashboard");

  // Changed: Categories will now store objects from DB: [{id: 1, name: "Silk"}]
  const [categories, setCategories] = useState([]);
  // `categoryProducts` state removed — the last remnant of AF-08. It backed a
  // localStorage cache whose writes were deleted in Phase 5.5 Slice 4; the state
  // itself was then never read and never set, but still read like a live cache.

  const [newCategory, setNewCategory] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [actionOpenIndex, setActionOpenIndex] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [updateProductDetails, setUpdateProductDetails] = useState(null);
  const containerRef = useRef(null);
  const [bestSellers, setBestSellers] = useState([]);
  // Server-computed dashboard counts. null until the fetch lands, which is the
  // signal DashBoard uses to fall back to counting locally.
  const [orderStats, setOrderStats] = useState(null);
  // Order-load state. Previously a failure was invisible: `orders` stayed [] and
  // the dashboard looked like a shop with no orders. See CLAUDE.md AF-C-FIX.
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState(null);

  /**
   * Log out.
   *
   * The button previously had no onClick at all — it was inert, and
   * `admin_auth` persisted forever. On a shared machine the next person to open
   * the browser was still "logged in". See CLAUDE.md AF-06.
   *
   * The server call is what actually matters: it flips the session row to
   * LOGOUT and clears the httpOnly cookies, so the session is dead even if this
   * tab never reloads. Clearing localStorage only tidies the UI hint.
   */
  const handleLogout = async () => {
    try {
      await apiFetch(`${ADMIN_API}/api/logout`, { method: "POST" });
    } catch (err) {
      // Even if the network call fails, still clear locally and send the user
      // to the login page — leaving them on an authenticated-looking panel
      // would be worse.
      console.error("Logout request failed:", err);
    } finally {
      localStorage.removeItem("admin_auth");
      localStorage.removeItem("admin_user");
      localStorage.removeItem("admin_token"); // legacy key, never read
      window.location.href = "/";
    }
  };

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

  // --- 1. NEW LOGIC: Fetch Categories from Database ---
  const fetchCategories = async () => {
    try {
      const res = await apiFetch(`${ADMIN_API}/api/getcategory`);
      const data = await res.json();
      if (data.success) {
        setCategories(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  // Load categories on mount (Replaces the localStorage useEffect)
  useEffect(() => {
    fetchCategories();
  }, []);


  // Bestsellers now come from the ADMIN backend, not the CLIENT one.
  //
  // Two reasons this moved:
  //
  // 1. Revenue was being computed HERE, in the browser, as
  //    selling_price × total_sold — today's price applied to historical sales.
  //    Verified: dropping one saree from ₹1,999 to ₹999 made the dashboard
  //    under-report that product by ₹11,000, with nothing refunded. The admin
  //    query sums oi.price × oi.quantity, the price actually charged on each
  //    order line, so a later price change cannot rewrite past revenue.
  //
  // 2. The admin panel was calling the storefront's API for its own dashboard.
  //    If the client service was down or cold-starting, the admin's bestseller
  //    panel broke for no reason connected to the admin.
  //
  // See CLAUDE.md AB-17 and AF-09.
  useEffect(() => {
    apiFetch(`${ADMIN_API}/api/get-bestSeller-list`)
      .then(async (res) => {
        const data = await res.json();

        if (data.success && Array.isArray(data.data)) {
          const cleanData = data.data.map((p) => ({
            id: p.id,
            name: p.name,
            image: p.primary_image || "https://placehold.co/100",
            totalSold: Number(p.total_sold) || 0,
            // Server-computed. total_revenue is a DECIMAL, which mysql2 returns
            // as a string to protect precision — Number() it once here rather
            // than letting a string reach Intl.NumberFormat.
            revenue: Number(p.total_revenue) || 0,
          }));

          setBestSellers(cleanData);
        }
      })
      .catch((err) => {
        console.error("BestSeller API error:", err);
      });
  }, []);

  // Stat cards, computed by the server rather than in this browser.
  //
  // The local calculation only ever saw the orders this page had fetched, and
  // used a status vocabulary that did not match the database. The endpoint
  // counts every row against the real enum. DashBoard falls back to a local
  // count if this fails, so the cards still render.
  useEffect(() => {
    apiFetch(`${ADMIN_API}/api/get-order-stats`)
      .then(async (res) => {
        const data = await res.json();
        if (data.success && data.data) setOrderStats(data.data);
      })
      .catch((err) => {
        console.error("Order stats API error:", err);
      });
  }, []);

  // Orders load, with the failure made VISIBLE.
  //
  // This was `.catch(console.error)`. Any failure — network, a non-JSON
  // response, a throw inside normalizeOrders — left `orders` as [] and the
  // dashboard rendered as though the shop had no orders at all. No error, no
  // retry, nothing to indicate anything had gone wrong. An ErrorBoundary cannot
  // help here: the throw happens inside a promise chain, so React never sees it
  // and the .catch swallows it first. See CLAUDE.md AF-C-FIX.
  //
  // Extracted into a named function so Retry can call it again.
  const loadOrders = React.useCallback(async () => {
    setOrdersError(null);
    setOrdersLoading(true);
    try {
      const res = await apiFetch(`${ADMIN_API}/api/get-order-detils`);
      // Check ok BEFORE parsing: an HTML error page or an empty body throws on
      // .json(), which previously surfaced as a generic swallowed error.
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Your session has expired. Please log in again."
            : `Could not load orders (HTTP ${res.status}).`
        );
      }
      const body = await res.json();
      if (!body.success) {
        throw new Error(body.message || "Could not load orders.");
      }
      setOrders(normalizeOrders(body.data));
    } catch (err) {
      console.error("Failed to load orders:", err);
      setOrders([]);
      setOrdersError(err.message || "Could not load orders.");
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const normalizeOrders = (apiOrders) => {
    // Defensive: the caller already checks success, but a malformed payload
    // would otherwise throw .map of undefined inside the promise chain — the
    // exact class of error that used to vanish into .catch(console.error).
    if (!Array.isArray(apiOrders)) return [];

    return apiOrders.map((o) => ({
      id: o.id,
      orderId: o.id,
      date: o.date,
      customerName: o.customer_name || "Guest",
      // The table has always had a "Contact Number" column and a search box
      // offering to search by phone, but nothing ever populated this key — so
      // the column was blank on every row and the phone half of the search
      // could not match. See CLAUDE.md AB-42.
      contactNumber: o.contact_number || "",
      // DisplayOrderPage renders `order.email`, and nothing ever set it — the
      // Email line on every order was blank. See CLAUDE.md AB-43.
      email: o.customer_email || "",
      status: o.status_of_order || o.status || "Pending",
      // The server's stored total_amount — what the customer was charged,
      // shipping included. It is no longer recomputed from the line items,
      // which double-counted across non-1:1 joins and omitted shipping anyway.
      // See CLAUDE.md AB-16.
      amount: o.amount,
      shipping_fee: o.shipping_fee ?? 0,
      address: o.shipping_address,
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      // `?? []` — an order with no product_list must not take down the whole
      // list. This was `o.product_list.map(...)` unguarded: one such order threw
      // inside normalizeOrders, the surrounding .catch swallowed it, and the
      // dashboard showed ZERO orders with no error. See CLAUDE.md AF-C-FIX.
      //
      // Newly reachable: getAllOrderData was changed to a LEFT JOIN in this
      // slice so an itemless order becomes visible instead of being silently
      // dropped from the admin's view. Those orders cannot be created any more
      // (CB-06 wrapped checkout in a transaction), but production still runs
      // the pre-transaction code and may already hold some.
      product: (o.product_list ?? []).map((p) => ({
        name: p.product_name || "Product",
        qty: p.quantity,
        price: Number(p.price),
        image: p.image_url, 
      })),
    }));
  };

  /**
   * Change an order's status.
   *
   * Two bugs lived here.
   *
   * AF-10 — the panel LIED about what saved. The UI was updated first and, on
   * failure, the only response was a console.error: no rollback, nothing shown
   * to the admin. A failed request left "Delivered" on screen while the
   * database still said "Pending". Worse, `await res.json()` ran BEFORE the
   * `res.ok` check, so an HTML error page or an empty body threw past that
   * check and landed in the network catch — reporting a network error when the
   * server had in fact answered.
   *
   * AF-24 — the body sent SIX keys for two values (id / orderId / order_id and
   * status / status_of_order / order_status) because the API contract was
   * unknown when it was written. The server reads exactly two:
   * `const { order_id, status } = req.body`. The rest was noise, and becomes
   * dangerous the day the server reads a different pair than the UI maintains.
   *
   * The optimistic update is KEPT — it makes the dropdown feel instant — but
   * the previous value is captured first and restored if the server refuses.
   */
  const changeOrderStatus = async (orderId, newStatus) => {
    // Captured BEFORE mutating, so a failure can put it back.
    const previousStatus = orders.find(
      (o) => String(o.id) === String(orderId)
    )?.status;

    setOrders((prev) =>
      prev.map((o) =>
        String(o.id) === String(orderId) ? { ...o, status: newStatus } : o
      )
    );

    const rollback = () => {
      if (previousStatus === undefined) return;
      setOrders((prev) =>
        prev.map((o) =>
          String(o.id) === String(orderId) ? { ...o, status: previousStatus } : o
        )
      );
    };

    try {
      const res = await apiFetch(`${ADMIN_API}/api/update-order-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // Exactly the two fields the server destructures.
        body: JSON.stringify({ order_id: orderId, status: newStatus }),
      });

      // res.ok BEFORE parsing. A 401 HTML page or an empty body makes .json()
      // throw, which previously masked a server answer as a network failure.
      if (!res.ok) {
        let message = `Could not update the order (HTTP ${res.status}).`;
        if (res.status === 401) {
          message = "Your session has expired. Please log in again.";
        } else {
          // Best effort: prefer the server's own message when it sent JSON.
          try {
            const body = await res.json();
            if (body?.message) message = body.message;
          } catch {
            /* not JSON — keep the status-based message */
          }
        }
        rollback();
        showToast(message);
        return;
      }

      const data = await res.json();
      if (!data.success) {
        rollback();
        showToast(data.message || "Could not update the order.");
        return;
      }

      showToast(`Order #${orderId} set to ${newStatus}.`, "success");
    } catch (err) {
      console.error("Order status update failed:", err);
      rollback();
      showToast("Could not reach the server. The order was not updated.");
    }
  };

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return <DashBoard
          displayOrderPage={displayOrderPage}
          bestSellers={bestSellers}
          orders={orders}
          orderStats={orderStats}
          ordersLoading={ordersLoading}
          ordersError={ordersError}
          onRetryOrders={loadOrders}
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
            // Map objects back to strings for child component compatibility
            categories={categories.map(c => c.name)}
            categoryName={selectedCategory}
            onBack={() => setCurrentView("allProducts")}
          />
        );

      case "updateProduct":
        return (
          <UpdateProduct
            categoryName={selectedCategory}
            onBack={() => setCurrentView("allProducts")}
            updateProductDetails={updateProductDetails}
          />
        );

      default:
        // The default branch omitted `orders`, so DashBoard fell back to its
        // `orders = []` default and rendered a dashboard with zero orders and
        // an empty table. Passed explicitly now, same as the case above.
        return <DashBoard
          displayOrderPage={displayOrderPage}
          bestSellers={bestSellers}
          orders={orders}
          orderStats={orderStats}
          ordersLoading={ordersLoading}
          ordersError={ordersError}
          onRetryOrders={loadOrders}
        />;
    }
  };

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [currentView]);

  const handleAddClick = () => setIsAdding(true);

  // --- 2. NEW LOGIC: Save to Database ---
  const handleSave = async () => {
    if (newCategory.trim() === "") return;
    
    try {
      const res = await apiFetch(`${ADMIN_API}/api/addcategory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategory }),
      });

      const data = await res.json();
      if (data.success) {
        // Refresh list to get the new ID
        fetchCategories();
        setNewCategory("");
        setIsAdding(false);
      }
    } catch (err) {
      console.error("Error adding category:", err);
      alert("Failed to add category");
    }
  };

  const handleCancel = () => {
    setNewCategory("");
    setIsAdding(false);
  };

  // --- 3. NEW LOGIC: Delete from Database ---
  const handleDelete = async (id) => {
    // Note: The UI loop passes 'cat.id' now, not index
    if (!window.confirm("Are you sure you want to delete this category?")) return;

    try {
      const res = await apiFetch(`${ADMIN_API}/api/categories/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchCategories(); // Refresh list
        setActionOpenIndex(null);
      } else {
        alert("Failed to delete category");
      }
    } catch (err) {
      console.error("Error deleting category:", err);
    }
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

        {categories.map((cat, index) => (
          <div
            key={cat.id || index} // Use DB ID for key
            className={`relative border rounded-xl flex justify-between items-center transition-colors duration-300 cursor-pointer 
            ${
              activeView === cat.name
                ? "bg-[#68232B] text-white"
                : "hover:bg-[#68232B] hover:text-white text-black"
            }`}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <p
              className="w-full h-full p-3 rounded-xl"
              onClick={() => {
                setSelectedCategory(cat.name); // Pass name string
                setActiveView(cat.name);
                handleGoToAllProductsPage();
                setIsMobileMenuOpen(false);
              }}
            >
              {cat.name}
            </p>
            {hoveredIndex === index && (
              <div
                className="absolute right-2 cursor-pointer flex justify-center items-center"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(cat.id); // Pass DB ID to delete
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
                <button
                    onClick={handleLogout}
                    className="px-4 py-2 rounded-md border border-[#68232B] text-[#68232B] font-medium hover:bg-[#68232B] hover:text-white transition cursor-pointer"
                >
                    Logout
                </button>
            </div>
        </div>
        <div
          ref={containerRef}
          className="h-[90%] w-full bg-[#FFE9CC] overflow-y-auto scrollbar-hide p-5"
        >
          <div className="w-full h-full">{renderView()}</div>
        </div>
      </div>
    </div>
  );
};

export default AdminHomePage;