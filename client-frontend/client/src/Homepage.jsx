import Footer from "./components/Footer";
import Header from "./components/Header";
import ProductCard from "./components/ProductCard";
import CategoryCard from "./components/Categorycard.jsx";
import ReviewCard from "./components/ReviewCard.jsx";
import { useNavigate } from "react-router-dom";

import frame from "./assets/heroframe.svg";
import finisher from "./assets/finisher.svg";
import underprice from "./assets/underpricecoll.svg";

import trendingProducts from "./products.js";
import { categories } from "./categoryData";
import reviews from "./reviews.js";

import React, { useEffect, useState, useContext } from "react";
import { CartContext } from "./CartContext.jsx";
import footerBg from "./assets/footerbgimage.svg";
import HeroImage from "@/assets/HeroImage.png";
import { Heart } from "lucide-react";
import PeacockLoader from "./components/PeacockLoader";
// import PageLoader from "./components/Pageloader";

function Homepage() {
  const navigate = useNavigate();
  const {
    cartItems,
    setCartItems,
    wishListItems,
    setWishListItems,
    handleAddToCart,
    handleAddToWishList,
  } = useContext(CartContext);

  const topFourProducts = trendingProducts.slice(0, 9);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [loadingBestSellers, setLoadingBestSellers] = useState(true);
  const [fillColor, setFillColor] = useState("transparent");

  const [bestSellers, setBestSellers] = useState([]);
  const [currentBestIndex, setCurrentBestIndex] = useState(0);
  const currentProduct = bestSellers[currentBestIndex];

  const updateCart = (c) => setCartItems(c);
  const updateWishList = (w) => setWishListItems(w);

  const handleSvgClick = () => {
    setFillColor((c) => (c === "transparent" ? "#ffc780" : "transparent"));
  };

  useEffect(() => {
    if (loadingBestSellers || loadingCollections) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [loadingCollections, loadingBestSellers]);

  /* Reviews auto-scroll */
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev === reviews.length - 1 ? 0 : prev + 1));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  /* Collections */
  useEffect(() => {
    fetch("https://pai-silks-website-1.onrender.com/api/collections")
      .then((res) => res.json())
      .then((data) => data.success && setCollections(data.data))
      .finally(() => setLoadingCollections(false));
  }, []);

  /* Best sellers */
  useEffect(() => {
    fetch("https://pai-silks-website-1.onrender.com/api/bestsellers")
      .then((res) => res.json())
      .then((res) => res.success && setBestSellers(res.data))
      .finally(() => setLoadingBestSellers(false));
  }, []);

  useEffect(() => {
    if (!bestSellers.length) return;
    const interval = setInterval(() => {
      setCurrentBestIndex((prev) =>
        prev === bestSellers.length - 1 ? 0 : prev + 1
      );
    }, 5000);
    return () => clearInterval(interval);
  }, [bestSellers]);

  const onHeartClick = async () => {
    const userId = localStorage.getItem("user_id");

    const productForWishlist = {
      id: currentProduct.product_id || currentProduct.id,
      name: currentProduct.name,
      image1: currentProduct.image_url || currentProduct.image1,
      discounted_price: Number(currentProduct.selling_price), 
      regular_price: Number(currentProduct.regular_price),
      description: currentProduct.description,
    };

    handleSvgClick(); 
    handleAddToWishList(productForWishlist);

    if (userId) {
      try {
        const response = await fetch("https://pai-silks-website-1.onrender.com/api/wishlist/add", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            product_id: productForWishlist.id,
          }),
        });

        const data = await response.json();
        if (data.success) {
          console.log("Successfully added to Wishlist DB");
        } else {
          console.error("Failed to add to DB:", data.message);
        }
      } catch (error) {
        console.error("API Error:", error);
      }
    } else {
        console.log("User not logged in, saved to local storage only.");
    }
  };

  return (
    <div className="scrollbar-hide w-full">
      <Header
        cartItems={cartItems}
        onUpdate={updateCart}
        wishListItems={wishListItems}
        onWishListUpdate={updateWishList}
      />

      {/* HERO SECTION */}
      <section
        className="text-white text-center py-4 bg-cover bg-fixed w-full"
        style={{ backgroundImage: `url(${footerBg})` }}
      >
        <img src={frame} className="w-[95%] rotate-180 mx-auto" />

        <div className="w-full flex justify-center">
          <div className="relative flex justify-center items-center rounded-xl w-[85%] h-130 overflow-hidden  aspect-square md:aspect-video max-h-80 sm:max-h-full">
            <img
              src={HeroImage}
              alt="Hero background"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <img src={frame} className="w-[95%] mx-auto" />

        <h1 className="text-xl md:text-5xl my-[1%] py-[4%] text-[#FFCB85]">
          <u>Check out our Collections</u>
        </h1>

        <div
          className="grid grid-cols-3 md:grid-cols-6 items-center cursor-pointer"
          onClick={() => navigate("/shop")}
        >
          {loadingCollections ? (
            <PeacockLoader />
          ) : (
            collections.map((c) => (
              <div key={c.id} className="cursor-pointer">
                <img
                  src={c.image || underprice}
                  className="max-w-[80%] mx-auto transition-transform duration-500 hover:scale-105"
                />
                <h2 className="text-[1.6vw]">{c.collection}</h2>
              </div>
            ))
          )}
        </div>

        <div className="pt-4">
          <img src={finisher} className="w-[95%] mx-auto" />
        </div>
      </section>

      {/* TRENDING */}
      <h1 className="text-xl md:text-5xl my-[1%] py-[4%] text-center text-[#68232B]">
        <u>Check out our Newest Collections</u>
      </h1>

      <div className="flex gap-4 overflow-x-auto px-2 py-4 scrollbar-hide">
        {topFourProducts.map((product) => (
          <div
            key={product.id}
            className="flex-none min-w-[190px] w-[clamp(150px,25vw,220px)]"
          >
            <ProductCard
              {...product}
              onAddToCart={() => handleAddToCart(product)}
            />
          </div>
        ))}
      </div>

      {/* BEST SELLER */}
      {currentProduct && (
        <section
          className="py-12 bg-cover bg-fixed flex flex-col items-center"
          style={{ backgroundImage: `url(${footerBg})` }}
        >
          {/* Top Frame */}
          <img
            src={frame}
            className="max-w-[95%] w-full rotate-180 opacity-90"
            alt="Frame Top"
          />

          {/* Section Title */}
          <h1 className="text-2xl md:text-5xl font-bold text-[#FFCB85] py-5 font-['Poppins']">
            <u>Best Sellers</u>
          </h1>

          {/* --- MAIN CONTENT CONTAINER --- */}
          {loadingBestSellers ? (
            <PeacockLoader />
          ) : (
            <div className="w-full max-w-[90%] md:max-w-[85%] mx-auto">
              <div className="flex flex-col lg:grid lg:grid-cols-[1.6fr_1fr] gap-8 lg:gap-12 items-start">
                <div className="w-full flex flex-col md:flex-row-reverse gap-4 bg-white/3 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl">
                  <div className="w-full md:w-[80%] bg-transparent rounded-2xl overflow-hidden shadow-sm border border-stone-200/50">
                    <div className="aspect-[3/4] lg:aspect-square w-full relative group">
                      <img
                        src={currentProduct.image_url}
                        alt={currentProduct.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-in-out group-hover:scale-105"
                      />
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col gap-3 md:w-[20%] justify-between md:justify-start">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="relative aspect-[3/4] w-full cursor-pointer rounded-xl overflow-hidden border border-stone-200/50 hover:border-[#BD7923] transition-all"
                      >
                        <img
                          src={currentProduct.image_url}
                          alt={`Thumbnail ${i}`}
                          className="absolute inset-0 w-full h-full object-cover hover:opacity-90 transition-opacity"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-full flex flex-col justify-center h-full gap-6 text-[#FFCB85] text-left rounded-3xl shadow-xl">
                  <div className="flex justify-between items-center gap-5 h-40 flex ">
                    <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold font-['Poppins'] text-[#FFCB85] leading-tight">
                      {currentProduct.name}
                    </h1>
                    <Heart
                      size={100}
                      className="md:w-10 md:h-10 cursor-pointer flex-shrink-0 hover:scale-150 transition-transform"
                      fill={fillColor}
                      onClick={onHeartClick}
                    />
                  </div>

                  <p className="text-sm md:text-lg text-[#FFCB85]/90 leading-relaxed h-20 flex items-center">
                    {currentProduct.description}
                  </p>

                  <div className="flex items-baseline gap-4 mt-2">
                    <h2 className="text-3xl md:text-5xl font-bold text-white">
                      ₹ {currentProduct.selling_price}
                    </h2>
                    <h5 className="text-lg md:text-2xl text-gray-400 decoration-1 line-through">
                      ₹ {currentProduct.regular_price}
                    </h5>
                  </div>

                  <div className="h-px w-full bg-[#FFCB85]/20 my-2"></div>

                  <div className="flex flex-col sm:flex-row gap-4 w-full mt-4">
                    <button
                      onClick={() => {
                        if (!currentProduct) return;

                        const productForCart = {
                          id: currentProduct.product_id || currentProduct.id,
                          name: currentProduct.name,
                          image1: currentProduct.image_url,
                          discounted_price: Number(
                            currentProduct.selling_price
                          ),
                          regular_price: Number(currentProduct.regular_price),
                          description: currentProduct.description,
                          quantity: 1,
                        };

                        handleAddToCart(productForCart);
                      }}
                      className="flex-1 py-4 px-6 rounded-full font-bold text-lg md:text-xl text-white shadow-lg shadow-orange-900/20
                 hover:bg-gradient-to-r hover:from-[#FEDB87] hover:to-[#BD7923] cursor-pointer border-2 border-[#FEDB87] bg-transparent
                 hover:brightness-110 active:scale-95 transition-all duration-200"
                    >
                      Add to Cart
                    </button>

                    <button
                      onClick={() => {
                        if (!currentProduct) return;

                        const productForCart = {
                          id: currentProduct.product_id || currentProduct.id,
                          name: currentProduct.name,
                          image1: currentProduct.image_url,
                          discounted_price: Number(
                            currentProduct.selling_price
                          ),
                          regular_price: Number(currentProduct.regular_price),
                          description: currentProduct.description,
                          quantity: 1,
                        };

                        handleAddToCart(productForCart);
                        navigate("/checkout");
                      }}
                      className="flex-1 py-4 px-6 rounded-full font-bold text-lg md:text-xl text-white shadow-lg shadow-orange-900/20
                 border-2 border-[#FEDB87] bg-transparent hover:bg-gradient-to-r hover:from-[#FEDB87] hover:to-[#BD7923] cursor-pointer
                 hover:bg-[#FEDB87]/10 active:scale-95 transition-all duration-200"
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Frame */}
          <img
            src={frame}
            className="max-w-[95%] w-full mt-12 opacity-90"
            alt="Frame Bottom"
          />
        </section>
      )}

      {/* CATEGORIES SCROLL */}
      <section className="text-center text-[#68232B] py-4">
        <h1 className="text-xl md:text-5xl">
          <u>Our Categories</u>
        </h1>
        <div className="overflow-hidden">
          <div className="flex gap-4 animate-[scrollLeft_25s_linear_infinite] w-max">
            {[...categories, ...categories].map((cat, i) => (
              <CategoryCard key={i} {...cat} />
            ))}
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="py-[1vw]">
        <h1 className="text-xl md:text-5xl text-center text-[#68232B] py-[2vw]">
          <u>Our Happy Customers</u>
        </h1>
        <div className="flex justify-center py-4 transition-opacity duration-3000">
          <ReviewCard review={reviews[currentIndex]} />
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default Homepage;
