import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";

import Header from "./components/Header";
import ProductCard from "./components/ProductCard";
import FilterAndSort from "./components/FilterandSort";
import Footer from "./components/Footer";

import { CartContext } from "./CartContext";

import footerBg from "@/assets/footerbgimage.svg";
import { ArrowLeft } from 'lucide-react';
// import PageLoader from "./components/Pageloader";
import PeacockLoader from "./components/PeacockLoader";

const App = () => {
  const navigate = useNavigate();

  const {
    cartItems,
    setCartItems,
    wishListItems,
    setWishListItems,
    handleAddToCart,
  } = useContext(CartContext);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    minPrice: 0,
    maxPrice: 100000,
    categories: [],
  });

  const [sortOption, setSortOption] = useState("");
  const [isDivOpen, setIsDivOpen] = useState(false);

  /* ---------------- FETCH PRODUCTS ---------------- */
  useEffect(() => {
    fetch("https://pai-silks-website.onrender.com/api/get-all-product-details")
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          setProducts(res.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  /* ---------------- NORMALIZE DATA ---------------- */
  const normalizedProducts = products.map((p) => ({
    id: p.product_id,
    name: p.name,
    category: p.category,
    description: p.description,
    main_price: Number(p.regular_price),
    discounted_price: Number(p.selling_price),
    image1: p.image_url,
    material: p.material,
    saree_length: p.saree_length,
    wash_and_care: p.product_wash_care,
    product_code: p.product_code,
  }));

  /* ---------------- FILTER + SORT ---------------- */
  const filteredProducts = normalizedProducts
    .filter(
      (product) =>
        product.discounted_price >= filters.minPrice &&
        product.discounted_price <= filters.maxPrice &&
        (filters.categories.length === 0 ||
          filters.categories.includes(product.category))
    )
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

      {/* Back Button (unchanged) */}
      <div></div>

      {/* ================= Filter Button ================= */}
      <div
        className="
          w-full
          p-2
          flex
          items-center
          justify-center
          md:justify-between
        "
        style={{ backgroundImage: `url(${footerBg})` }}
      >
        <button onClick={() => navigate("/")} className="hidden md:flex m-4 px-2 bg-white/80 rounded-4xl hover:bg-[#68232B] hover:text-[#FEDB87] cursor-pointer font-bold justify-center gap-3 items-center p-3 w-50"><ArrowLeft/> <p>Back</p></button>

        <button
          onClick={() => setIsDivOpen(true)}
          className="
            flex
            justify-center
            items-center
            p-3
            w-50
            bg-gradient-to-r 
            from-[#FEDB87] to-[#BD7923]
            text-[#551920]
            rounded-4xl
            border-none
            cursor-pointer
          "
        >
          <h4 className="m-0 p-0">Filter and Sort</h4>
        </button>
      </div>

      {/* ================= Wrapper ================= */}
      <div className="relative">
        {isDivOpen && (
          <FilterAndSort
            onFilterChange={setFilters}
            onSortChange={setSortOption}
            categories={categories}
            onClose={() => setIsDivOpen(false)}
          />
        )}

        {loading ? (
          <PeacockLoader/>
        ) : (
          <div
            className="
              grid
              gap-[1.7rem]
              p-6
              grid-cols-[repeat(auto-fill,minmax(210px,1fr))]

              max-[600px]:gap-4
              max-[600px]:p-4
              max-[600px]:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]

              max-[380px]:grid-cols-[repeat(auto-fill,minmax(130px,1fr))]
            "
          >
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                {...product}
                onAddToCart={() => handleAddToCart(product)}
              />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </>
  );
};

export default App;
