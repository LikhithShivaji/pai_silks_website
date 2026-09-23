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
import BestSellers from "./components/BestSellers";
import { normalizeBestSellers } from "@/utils/normalizeBestSellers";
import UpdateProduct from "./components/UpdateProduct";
import { Menu, X, Trash, Bell } from "lucide-react";
// CLIENT_API is no longer imported here: this page's last cross-service call
// (bestsellers) moved to the admin backend. AddProduct.jsx still fetches
// collections from the client backend — see the API-ownership item in
// CLAUDE.md, scheduled after the phases.
import { ADMIN_API, apiFetch } from "@/config/api";
import { useToast } from "@/ToastContext";
// Destructive confirmations. Replaces window.confirm for category deletion so
// the consequence can be given real emphasis rather than a line of prompt text.
import ConfirmDialog from "./components/ConfirmDialog";

const AdminHomePage = () => {
  const { showToast } = useToast();
  // `const notifications = 3` removed with the badge it drove — a hardcoded
  // count that never changed and never meant anything. See CLAUDE.md AF-30.
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
  // `actionOpenIndex` state removed — it tracked which row's action menu was
  // open, but nothing ever read it, so no menu was driven by it. Its single
  // setter call (closing the menu after a category delete) went with it.
  // Checked case-insensitively before removal, which is how the sibling
  // `setCategoryProducts` was missed earlier in this phase. See CLAUDE.md AF-33.
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

  /**
   * Navigation — the URL hash IS the location.
   *
   * This panel renders views by swapping component state, not by routing, and
   * that had two consequences. Every "← Back" button had a HARDCODED
   * destination, wrong whenever the admin did not arrive from there; and the
   * BROWSER's back button (or a mouse's back button) left the panel entirely,
   * because nothing the admin did inside it ever created a history entry.
   *
   * An in-app stack fixed the first problem and could never fix the second: the
   * browser does not know about it. So the state now lives in the hash —
   *
   *   #view=dashboard
   *   #view=allProducts&category=Art%20Silk%20Sarees
   *   #view=displayOrderPage&order=56
   *
   * — and every navigation pushes a real history entry. Back then works from
   * the browser button, the mouse button, the keyboard and the in-app button
   * alike, because `goBack` simply calls `history.back()`. ONE mechanism, not
   * two that can disagree.
   *
   * Walking back out of the panel lands on the login page, which is the correct
   * end of the chain: those entries precede the panel in the same tab's history.
   *
   * The hash rather than the path deliberately — the app is served at a single
   * route, and a path change would need a server rewrite rule to survive a
   * refresh. A hash never reaches the server.
   */
  const VIEW_PARAM_KEYS = { allProducts: "category", addProduct: "category", displayOrderPage: "order" };

  const buildHash = (view, param) => {
    const key = VIEW_PARAM_KEYS[view];
    const params = new URLSearchParams({ view });
    if (key && param != null && param !== "") params.set(key, String(param));
    return `#${params.toString()}`;
  };

  const go = (view, param, { replace = false } = {}) => {
    const hash = buildHash(view, param);
    if (replace) window.history.replaceState({ view }, "", hash);
    else window.history.pushState({ view }, "", hash);
  };

  /** Restore the view the hash describes. Sets state only — never pushes. */
  const applyHash = React.useCallback((hash) => {
    const params = new URLSearchParams((hash || "").replace(/^#/, ""));
    const view = params.get("view") || "dashboard";
    const category = params.get("category");
    const order = params.get("order");

    if (category) setSelectedCategory(category);
    if (order) setSelectedOrderId(order);

    // `updateProduct` is deliberately NOT restorable. It needs the full product
    // object, which is passed in memory and is not in the URL; restoring the
    // view without it would render an edit form with every field blank and a
    // Save button that would wipe the product. Land on the product list
    // instead — the screen the admin would have used to get there anyway.
    const restorable = view === "updateProduct" ? "allProducts" : view;

    setCurrentView(restorable);
    if (restorable === "dashboard") setActiveView("dashboard");
    else if (restorable === "orderList" || restorable === "displayOrderPage") setActiveView("orders");
    else if (category) setActiveView(category);
  }, []);

  // Seed the first history entry, and follow the browser from then on.
  //
  // replaceState on mount, not pushState: pushing would leave the entry the
  // admin arrived on (the login page) one step further back than it looks, so
  // the first Back would appear to do nothing.
  useEffect(() => {
    if (window.location.hash) applyHash(window.location.hash);
    else window.history.replaceState({ view: "dashboard" }, "", buildHash("dashboard"));

    const onPopState = () => applyHash(window.location.hash);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyHash]);

  const goBack = () => window.history.back();

  // Sidebar destinations. These push like everything else — the admin asked for
  // category → dashboard → login to be walkable, so a sidebar click is a step
  // in the journey, not a reset of it.
  const handleGoToDashBoardPage = () => {
    setCurrentView("dashboard");
    setActiveView("dashboard");
    go("dashboard");
  };

  const handleGoToAllProductsPage = (categoryName) => {
    setCurrentView("allProducts");
    go("allProducts", categoryName ?? selectedCategory);
  };

  const handleOrderList = () => {
    setCurrentView("orderList");
    setActiveView("orders");
    go("orderList");
  };

  const handleAddProductPage = () => {
    setCurrentView("addProduct");
    go("addProduct", selectedCategory);
  };

  const handleUpdateProductPage = (product) => {
    setUpdateProductDetails(product);
    setCurrentView("updateProduct");
    go("updateProduct");
  };

  const displayOrderPage = (order) => {
    setSelectedOrderId(order.id);
    setCurrentView("displayOrderPage");
    go("displayOrderPage", order.id);
  };

  const handleViewAllBestSellers = () => {
    setCurrentView("bestSellers");
    go("bestSellers");
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
          // Shared with the full "View All" screen so the two renderings of the
          // same numbers cannot drift apart.
          setBestSellers(normalizeBestSellers(data.data));
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
      // Spelling corrected from `get-order-detils` (AB-37). The backend keeps
      // the misspelt path as a deprecated alias, so this is safe to deploy
      // before the backend if the two ever ship out of step.
      const res = await apiFetch(`${ADMIN_API}/api/get-order-details`);
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
      // Carried through so a despatched order still shows its tracking after a
      // reload. The server has always returned both (migration 009), but this
      // mapper dropped them, so DispatchEntry rendered EMPTY for an order whose
      // consignment number was already saved — and the printed invoice said
      // "not yet despatched" for a parcel already on its way. They only ever
      // appeared because changeOrderStatus writes them back into this object
      // after a successful save, which lasted until the next refresh.
      carrier: o.carrier ?? null,
      consignment_number: o.consignment_number ?? null,
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
  const changeOrderStatus = async (orderId, newStatus, dispatch = null) => {
    // `dispatch` is { carrier, consignment_number } when the admin is recording
    // a despatch, and null for a plain status change. Sent only when present —
    // omitting the keys leaves any tracking already on the order untouched,
    // whereas sending nulls would wipe it. See CLAUDE.md DB-09.

    // Captured BEFORE mutating, so a failure can put it back. All three fields,
    // not just the status: a rejected despatch must restore the carrier and
    // consignment number too, or the row keeps values the server never accepted.
    const previous = orders.find((o) => String(o.id) === String(orderId));
    const previousStatus = previous?.status;
    const previousCarrier = previous?.carrier ?? null;
    const previousConsignment = previous?.consignment_number ?? null;

    setOrders((prev) =>
      prev.map((o) =>
        String(o.id) === String(orderId)
          ? {
              ...o,
              status: newStatus,
              ...(dispatch
                ? {
                    carrier: dispatch.carrier,
                    consignment_number: dispatch.consignment_number,
                  }
                : {}),
            }
          : o
      )
    );

    const rollback = () => {
      if (previousStatus === undefined) return;
      setOrders((prev) =>
        prev.map((o) =>
          String(o.id) === String(orderId)
            ? {
                ...o,
                status: previousStatus,
                carrier: previousCarrier,
                consignment_number: previousConsignment,
              }
            : o
        )
      );
    };

    try {
      const res = await apiFetch(`${ADMIN_API}/api/update-order-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // Exactly the fields the server destructures. The dispatch pair is
        // spread in only when recording a despatch — see the note above.
        body: JSON.stringify({
          order_id: orderId,
          status: newStatus,
          ...(dispatch
            ? {
                carrier: dispatch.carrier,
                consignment_number: dispatch.consignment_number,
              }
            : {}),
        }),
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
        // Returned as well as toasted so DispatchEntry can render it beside the
        // field. A 409 ("that number is already on order 13") is a correction
        // the admin must act on with the receipt in hand — a toast that fades
        // is the wrong place for it.
        return message;
      }

      const data = await res.json();
      if (!data.success) {
        rollback();
        const message = data.message || "Could not update the order.";
        showToast(message);
        return message;
      }

      // Adopt the server's stored values rather than the submitted ones. The
      // consignment number is normalised server-side (trimmed, upper-cased), so
      // showing what was typed would display something other than what is
      // actually recorded against the order.
      if (dispatch) {
        setOrders((prev) =>
          prev.map((o) =>
            String(o.id) === String(orderId)
              ? {
                  ...o,
                  carrier: data.carrier ?? null,
                  consignment_number: data.consignment_number ?? null,
                }
              : o
          )
        );
        showToast(
          `Order #${orderId}: ${data.carrier} ${data.consignment_number} recorded.`,
          "success"
        );
      } else {
        showToast(`Order #${orderId} set to ${newStatus}.`, "success");
      }
    } catch (err) {
      console.error("Order status update failed:", err);
      rollback();
      const message = "Could not reach the server. The order was not updated.";
      showToast(message);
      return message;
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
          onViewAllBestSellers={handleViewAllBestSellers}
        />;

      case "allProducts":
        return (
          <AllProducts
            categoryName={selectedCategory}
            // The category row, looked up by name — `selectedCategory` is the
            // name string, and the upload needs the id. CF-35.
            categoryId={
              categories.find((c) => c.name === selectedCategory)?.id ?? null
            }
            categoryImageUrl={
              categories.find((c) => c.name === selectedCategory)?.image_url ?? null
            }
            // Update in place rather than refetching: the server has already
            // confirmed the new URL, so a round trip would only risk showing a
            // stale thumbnail if it raced.
            onCategoryImageUploaded={(id, url) =>
              setCategories((prev) =>
                prev.map((c) => (c.id === id ? { ...c, image_url: url } : c))
              )
            }
            onBack={goBack}
            onAddProductClick={handleAddProductPage}
            onUpdateProduct={handleUpdateProductPage}
          />
        );

      case "displayOrderPage":
        return (
          <DisplayOrderPage
            order={selectedOrder}
            onBack={goBack}
            onChangeStatus={(status) =>
              changeOrderStatus(selectedOrderId, status)
            }
            // Keeps the order's CURRENT status — this records the despatch, it
            // does not advance the workflow. The admin sets "Shipped" with the
            // dropdown; the server then refuses that status unless tracking is
            // present, so the two operations stay independent but consistent.
            //
            // Returns the failure message (or undefined on success) so
            // DispatchEntry can show it inline — above all the server's 409
            // when this number already belongs to another order, which needs to
            // appear next to the field rather than as a toast that scrolls away.
            onSaveDispatch={(dispatch) =>
              changeOrderStatus(
                selectedOrderId,
                selectedOrder?.status ?? "Pending",
                dispatch
              )
            }
          />
        );

      case "bestSellers":
        return <BestSellers onBack={goBack} />;

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
            onBack={goBack}
          />
        );

      case "updateProduct":
        return (
          <UpdateProduct
            categoryName={selectedCategory}
            onBack={goBack}
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
          onViewAllBestSellers={handleViewAllBestSellers}
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
  /**
   * Delete a category, cascading to its products on an informed confirmation.
   *
   * The old flow asked "Are you sure you want to delete this category?" and
   * deleted only the category row — leaving its products live in the shop under
   * a category that no longer existed. That is the drift in AB-31/DB-06, and
   * the prompt gave the admin no way to know it was about to happen.
   *
   * Now the SERVER decides. It answers 409 with the real product count, and the
   * admin is asked a question that names the consequence. The count comes from
   * the database rather than anything the browser inferred, and the cascade
   * itself runs in one transaction server-side — the confirmation flag is
   * re-checked there, so this dialog is a courtesy, not the control.
   */
  const handleDelete = async (id, { confirmCascade = false } = {}) => {
    try {
      const res = await apiFetch(`${ADMIN_API}/api/categories/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirmCascade ? { confirmCascade: true } : {}),
      });

      const body = await res.json().catch(() => ({}));

      // 409 + requiresConfirmation means the category still holds products and
      // the cascade flag was missing. The dialog asks before we ever get here,
      // so reaching this is a genuine disagreement — the count changed between
      // the list loading and the click, or the request was made outside the UI.
      // Re-ask rather than silently forcing it through.
      if (res.status === 409 && body.requiresConfirmation) {
        setDeleteTarget({
          id,
          name: body.categoryName,
          productCount: body.productCount,
        });
        return;
      }

      if (!res.ok || !body.success) {
        showToast(body.message || "Failed to delete category.");
        return;
      }

      showToast(body.message, "success");
      fetchCategories();

      // Products may have gone with it. AllProducts refetches from the server
      // whenever a category is opened, so there is no separate product list in
      // this component's state to invalidate.
    } catch (err) {
      console.error("Error deleting category:", err);
      showToast("Could not reach the server. Nothing was deleted.");
    }
  };

  /**
   * Open the delete dialog for a category.
   *
   * The product count comes from the category list, which the server now
   * returns it with — so the dialog can state the consequence in its FIRST
   * question rather than asking twice. The server still enforces the cascade
   * flag independently; this is the explanation, not the gate.
   */
  const confirmDeleteCategory = (cat) => {
    setDeleteTarget({
      id: cat.id,
      name: cat.name,
      productCount: Number(cat.product_count) || 0,
    });
  };

  // The category awaiting delete confirmation: { id, name, productCount }, or
  // null when the dialog is closed. `deleteBusy` keeps the dialog open and its
  // buttons disabled during the request, so a slow response cannot be
  // double-submitted by an impatient second click.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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
                // Passed explicitly rather than relying on the setState above:
                // `selectedCategory` still holds the OLD value in this closure,
                // so the hash would have recorded the previously-open category
                // and Back would return to the wrong one.
                handleGoToAllProductsPage(cat.name);
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
                  // Goes through the confirming wrapper. If the category holds
                  // products the server answers 409 and handleDelete asks a
                  // second question naming how many would be removed with it.
                  confirmDeleteCategory(cat);
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

      {/* Category delete confirmation. Replaces window.confirm — see
          ConfirmDialog for why. Rendered at the top level so it overlays the
          whole panel rather than being clipped by the sidebar's overflow. */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete "${deleteTarget?.name}"?`}
        message={
          `Are you sure you want to delete the "${deleteTarget?.name}" category?`
        }
        // Stated only when something actually cascades. A warning shown for an
        // empty category would be false, and a warning that is sometimes false
        // stops being read.
        consequence={
          deleteTarget?.productCount > 0
            ? `Deleting it will also delete all ${deleteTarget.productCount} ` +
              `product${deleteTarget.productCount === 1 ? "" : "s"} in it. ` +
              `This action cannot be reversed.`
            : null
        }
        confirmLabel={
          deleteTarget?.productCount > 0
            ? `Delete category and ${deleteTarget.productCount} product${deleteTarget.productCount === 1 ? "" : "s"}`
            : "Delete category"
        }
        busy={deleteBusy}
        onCancel={() => {
          if (!deleteBusy) setDeleteTarget(null);
        }}
        onConfirm={async () => {
          const target = deleteTarget;
          if (!target) return;
          setDeleteBusy(true);
          try {
            // The cascade flag is sent only when products are involved, so an
            // empty category is never deleted under a confirmation the admin
            // was not actually shown.
            await handleDelete(target.id, {
              confirmCascade: target.productCount > 0,
            });
          } finally {
            setDeleteBusy(false);
            setDeleteTarget(null);
          }
        }}
      />

      {/* Sidebar: a FIXED width that does not shrink.
          It was `w-[20%]`, a percentage of a flex row whose other child grows
          with its content — so the sidebar's real width changed depending on
          how wide the table inside the content area happened to be. Switching
          between Order List and a category visibly resized it.
          `shrink-0` is the other half: without it flex compresses the sidebar
          to make room for a wide table, which is the same symptom by a
          different route. Steps up on larger screens rather than scaling
          continuously, so the width is predictable at any size. */}
      <div className="h-full w-60 2xl:w-72 shrink-0 hidden xl:flex border-r border-gray-200">
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

      {/* `min-w-0` is THE fix, and it is not cosmetic.
          A flex item defaults to `min-width: auto`, meaning it refuses to
          shrink below its own content. So a wide table did not get clipped —
          it forced this panel wider, pushing the whole row past the viewport
          and squeezing the sidebar. `min-w-0` lets the panel be narrower than
          its content, which is what allows the cells to truncate instead.
          `w-full` removed: it fought `flex-1` for control of the width. */}
      <div className="h-full flex-1 min-w-0 flex flex-col">
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
                {/* Notification bell, now honest. See CLAUDE.md AF-30.
                    It carried a hardcoded red "3" badge that never changed and
                    never corresponded to anything, and clicking it fired
                    alert("Go to OrderSection") — a developer note shown to the
                    shop owner as if it were the product. Three permanent
                    unread notifications also train the user to ignore the
                    badge, so it would be worthless even once real.
                    The bell now goes to the order list, which is what the alert
                    text said it was for. The badge is gone until something
                    real can populate it. */}
                <div
                    className="relative inline-block cursor-pointer"
                    onClick={handleOrderList}
                    title="Orders"
                >
                    <Bell className="w-6 h-6 text-gray-800" />
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
          // Tighter side padding on a phone. `p-5` (20px) each side costs 40px
          // of a 390px screen — a tenth of the width — which is what squeezed
          // the order table and the product cards. 8px is enough to keep cards
          // off the edge without pretending a phone has desktop margins.
          className="h-[90%] w-full bg-[#FFE9CC] overflow-y-auto scrollbar-hide p-0 sm:p-5"
        >
          <div className="w-full h-full">{renderView()}</div>
        </div>
      </div>
    </div>
  );
};

export default AdminHomePage;