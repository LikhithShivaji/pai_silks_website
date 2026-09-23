import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom"; // ✅ Added useLocation

import Header from "./components/Header";
import ProductCard from "./components/ProductCard";
import FilterAndSort from "./components/FilterandSort";
import Footer from "./components/Footer";
// ADMIN_API is deliberately NOT imported. The storefront must never depend on
// the admin service: those routes require an admin session (Phase 2), so a
// customer would get 401, and the shop would also break whenever the admin
// backend was down. See CLAUDE.md CF-22 and CONSTRAINT 5.
import { CLIENT_API, apiFetch } from "@/config/api";

import { CartContext } from "./CartContext";

import footerBg from "@/assets/footerbgimage.webp";
import { ArrowLeft, X } from "lucide-react"; // ✅ Added X icon
import PeacockLoader from "./components/PeacockLoader";
import { useToast } from "./ToastContext";

const App = () => {
  const navigate = useNavigate();
  const location = useLocation(); // ✅ Hook to receive state

  // cartItems/setCartItems/wishListItems/setWishListItems were pulled out only
  // to feed <Header>, which discarded them (CF-34). handleAddToCart is the one
  // this page genuinely uses.
  const { handleAddToCart } = useContext(CartContext);

  const { showToast } = useToast();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filters, setFilters] = useState({
    minPrice: 0,
    maxPrice: 100000,
    categories: [],
  });

  // ✅ New State: Active Collection Filter
  const [activeCollection, setActiveCollection] = useState(null);

  const [sortOption, setSortOption] = useState("");
  const [isDivOpen, setIsDivOpen] = useState(false);

  /* ---------------- FETCH PRODUCTS ---------------- */
  // The catalogue comes from the CLIENT backend, not the admin one.
  //
  // This page used to call ADMIN_API/api/get-all-product-details. Phase 2 put
  // every admin route behind authMiddleware + requireAdmin, so a customer with
  // no admin session gets 401, `res.data` is undefined, and the shop renders
  // EMPTY. It looks fine locally only because browser cookies ignore port
  // numbers — with the admin panel open on localhost, this request carries the
  // owner's admin session. In production (paisilks.com -> onrender.com) there
  // is no such cookie. See CLAUDE.md CF-22 and CONSTRAINT 5.
  //
  // /api/products is public and returns customer-safe fields only — no exact
  // stock count, no created_at/updated_at/is_deleted.
  useEffect(() => {
    apiFetch(`${CLIENT_API}/api/products`)
      .then((res) => res.json())
      .then((res) => {
        // Was `res.data || (res.success ? res.data : [])` — an unreachable
        // ternary: if res.data is falsy both branches yield undefined (CF-33).
        setProducts(Array.isArray(res.data) ? res.data : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  /* ---------------- 👂 LISTEN FOR HOMEPAGE CLICK ---------------- */
  useEffect(() => {
    if (location.state && location.state.selectedCollection) {
      // console.log("Receiving Collection:", location.state.selectedCollection);
      setActiveCollection(location.state.selectedCollection);
      // Clear state history so refresh doesn't stick
      window.history.replaceState({}, document.title);
    }

    // Category tiles on the homepage arrive the same way (CF-35). Applied as a
    // checked filter rather than a separate mode, so the customer can see which
    // category is active in the filter panel and clear it there — a hidden
    // filter they cannot see or undo is worse than no filter.
    if (location.state && location.state.selectedCategory) {
      setFilters((prev) => ({
        ...prev,
        categories: [location.state.selectedCategory],
      }));
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  /* ---------------- NORMALIZE DATA ---------------- */
  const normalizedProducts = products.map((p) => {
    let cleanImage = "https://placehold.co/400?text=No+Image";
    const rawImg = p.image_url || p.images;

    if (Array.isArray(rawImg) && rawImg.length > 0) {
      const first = rawImg[0];
      cleanImage =
        typeof first === "object" ? first.image_url || first.url : first;
    } else if (typeof rawImg === "string") {
      cleanImage = rawImg.includes(",") ? rawImg.split(",")[0] : rawImg;
    }

    return {
      id: p.product_id || p.id,
      name: p.name,
      // Carried through from the API so the UI can refuse an out-of-stock item
      // BEFORE the customer fills in their address.
      //
      // The old payload exposed a raw `stock_qty` and this normaliser discarded
      // it, so the storefront had no stock awareness at all: an unavailable
      // saree added to the cart, showed a total, and failed only at the final
      // step with "Insufficient stock for product_id 12" — after the whole
      // delivery form had been typed. Slice 3 replaced the raw count with a
      // boolean (the exact figure is inventory data customers should not see);
      // this is where it enters the UI. Defaults to true so a product from an
      // endpoint that does not send the field is not wrongly hidden.
      // See CLAUDE.md CF-20, CF-22.
      in_stock: p.in_stock !== undefined ? Boolean(p.in_stock) : true,
      // quantity is initialised here, at the source.
      //
      // Without it, every product added through ProductCard reached the cart
      // with no quantity key at all, so the guest→login merge computed
      // Number(undefined) -> NaN -> Math.max(NaN, 1) -> NaN, and `quantity: NaN`
      // entered React state and serialised to `null` in localStorage. Downstream
      // `|| 1` fallbacks masked it by luck. See CLAUDE.md CF-13.
      quantity: 1,
      category: p.category,
      collection: p.collection, // ✅ Ensure collection exists
      description: p.description,
      main_price: Number(p.regular_price || p.regularPrice || 0),
      discounted_price: Number(p.selling_price || p.discountedPrice || 0),
      image1: cleanImage,
      material: p.material,
      saree_length: p.saree_length,
      wash_and_care: p.product_wash_care,
      product_code: p.product_code,
    };
  });

  /* ---------------- 🔍 UPDATED FILTER LOGIC ---------------- */
  const filteredProducts = normalizedProducts
    .filter((product) => {
      // 1. Price Filter
      const priceMatch =
        product.discounted_price >= filters.minPrice &&
        product.discounted_price <= filters.maxPrice;

      // 2. Category Filter
      const catMatch =
        filters.categories.length === 0 ||
        filters.categories.includes(product.category);

      // 3. Collection Filter — matched on the `collection` FIELD only.
      //
      // This used to be `pColl === target || pDesc.includes(target)`, i.e. it
      // also searched the product DESCRIPTION for the collection name. A saree
      // whose description happened to read "perfect for party wear" would then
      // appear under Party Wear regardless of the collection it was actually
      // assigned to — the merchant's own categorisation silently overridden by
      // prose. See CLAUDE.md CF-32.
      //
      // Verified against live data before removing: with the six collections in
      // use (Wedding Collection, Casual Wear, Under 2000, Party Wear, Festive
      // Collections, Ethnic Wear), **zero** products currently reach a
      // collection through the description fallback, so nothing on the site
      // changes today. It was a landmine, not an active fault: the first
      // description mentioning another collection's name would have triggered
      // it, with no error and no way for the admin to understand why.
      let collectionMatch = true;
      if (activeCollection) {
        const target = activeCollection.toLowerCase().trim();
        const pColl = (product.collection || "").toLowerCase().trim();
        collectionMatch = pColl === target;
      }

      return priceMatch && catMatch && collectionMatch;
    })
    .sort((a, b) => {
      if (sortOption === "lowToHigh")
        return a.discounted_price - b.discounted_price;
      if (sortOption === "highToLow")
        return b.discounted_price - a.discounted_price;
      return 0;
    });

  // Blank categories are excluded from the filter list.
  //
  // `product.category` is a nullable free-text column, and 3 of the 35 live
  // products have it NULL or empty (verified 2026-08-30). Those fed straight
  // through this Set, so the filter panel rendered an extra checkbox with
  // `key={null}` and an empty label — a tickable, nameless filter.
  //
  // Filtering here rather than in the normaliser: a product with no category is
  // still a valid product and must keep showing in the unfiltered grid. It
  // simply cannot be filtered TO, which is correct — it has no category to
  // filter by. Ordering is deliberately left as-is (product order), since
  // changing it would reorder the panel the customer sees.
  //
  // The underlying problem is that `product.category` is denormalised free text
  // disagreeing with the `category` table — see CLAUDE.md AB-31 / DB-06. This
  // stops the symptom reaching the UI; it does not fix the data.
  const categories = [
    ...new Set(
      normalizedProducts
        .map((p) => p.category)
        .filter((c) => typeof c === "string" && c.trim() !== "")
    ),
  ];

  return (
    <>
      <Header />

      {/* ================= Filter Bar ================= */}
      <div
        className="w-full p-2 flex flex-col md:flex-row items-center justify-center md:justify-between gap-3"
        style={{
          backgroundImage: `url(${footerBg})`,
          backgroundSize: "cover", // 👈 Forces image to shrink to fit the box
          backgroundPosition: "center", // 👈 Keeps the important part in the middle
          backgroundRepeat: "no-repeat", // 👈 Prevents tiling if the box is huge
        }}
      >
        <button
          onClick={() => navigate("/")}
          className="hidden md:flex m-4 px-2 bg-white/80 rounded-4xl hover:bg-[#68232B] hover:text-[#FEDB87] cursor-pointer font-bold justify-center gap-3 items-center p-3 w-50"
        >
          <ArrowLeft /> <p>Back</p>
        </button>

        {/* ✅ Show Active Filter Badge */}
        {activeCollection && (
          <div className="bg-white/90 px-4 py-2 rounded-full flex items-center gap-2 text-[#68232B] font-bold shadow-md animate-in fade-in">
            <span>Showing: {activeCollection}</span>
            <button
              onClick={() => setActiveCollection(null)}
              className="hover:bg-red-100 rounded-full p-1"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <button
          onClick={() => setIsDivOpen(true)}
          className="
            flex justify-center items-center p-3 w-50
            bg-linear-to-r from-[#FEDB87] to-[#BD7923]
            text-[#551920] rounded-4xl border-none cursor-pointer
          "
        >
          <h4 className="m-0 p-0">Filter and Sort</h4>
        </button>
      </div>

      {/* ================= Wrapper ================= */}
      <div className="relative min-h-[50vh]">
        {isDivOpen && (
          <FilterAndSort
            onFilterChange={setFilters}
            onSortChange={setSortOption}
            categories={categories}
            onClose={() => setIsDivOpen(false)}
          />
        )}

        {loading ? (
          <PeacockLoader />
        ) : (
          <div
            className="
              grid gap-[1.7rem] p-6
              grid-cols-[repeat(auto-fill,minmax(210px,1fr))]
              max-[600px]:gap-4 max-[600px]:p-4
              max-[600px]:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]
              max-[380px]:grid-cols-[repeat(auto-fill,minmax(130px,1fr))]
            "
          >
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  {...product}
                  onAddToCart={() => handleAddToCart(product)}
                  showToast={showToast}
                />
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center h-40 text-gray-500">
                <p className="text-xl">
                  No products found in "{activeCollection}"
                </p>
                <button
                  onClick={() => setActiveCollection(null)}
                  className="text-[#68232B] underline mt-2"
                >
                  View All Products
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </>
  );
};

export default App;
