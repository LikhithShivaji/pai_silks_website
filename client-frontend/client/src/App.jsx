import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom"; // ✅ Added useLocation

import Header from "./components/Header";
import ProductCard from "./components/ProductCard";
import FilterAndSort from "./components/FilterandSort";
import Footer from "./components/Footer";
import { ADMIN_API } from "@/config/api";

import { CartContext } from "./CartContext";

import footerBg from "@/assets/footerbgimage.webp";
import { ArrowLeft, X } from "lucide-react"; // ✅ Added X icon
import PeacockLoader from "./components/PeacockLoader";
import { useToast } from "./ToastContext";

const App = () => {
  const navigate = useNavigate();
  const location = useLocation(); // ✅ Hook to receive state

  const {
    cartItems,
    setCartItems,
    wishListItems,
    setWishListItems,
    handleAddToCart,
  } = useContext(CartContext);

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
  useEffect(() => {
    fetch(`${ADMIN_API}/api/get-all-product-details`)
      .then((res) => res.json())
      .then((res) => {
        const data = res.data || (res.success ? res.data : []);
        setProducts(Array.isArray(data) ? data : []);
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

      // 3. ✅ Collection Filter (The new logic)
      let collectionMatch = true;
      if (activeCollection) {
        const target = activeCollection.toLowerCase().trim();
        const pColl = (product.collection || "").toLowerCase().trim();
        const pDesc = (product.description || "").toLowerCase();

        // Match 'collection' field OR check if description contains it
        collectionMatch = pColl === target || pDesc.includes(target);
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

  const categories = [...new Set(normalizedProducts.map((p) => p.category))];

  return (
    <>
      <Header
        cartItems={cartItems}
        onUpdate={setCartItems}
        wishListItems={wishListItems}
        onWishListUpdate={setWishListItems}
      />

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
