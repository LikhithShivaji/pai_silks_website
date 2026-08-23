import Footer from "./components/Footer";
import Header from "./components/Header";
import ProductCard from "./components/ProductCard";
import CategoryCard from "./components/Categorycard.jsx";
import ReviewCard from "./components/ReviewCard.jsx";
import { useNavigate } from "react-router-dom";
import { CLIENT_API, ADMIN_API } from "@/config/api";
import frame from "./assets/heroframe.svg";
import finisher from "./assets/finisher.svg";
import trendingProducts from "./products.js";
import { categories } from "./categoryData";
import reviews from "./reviews.js";
import React, { useEffect, useState, useContext } from "react";
import { CartContext } from "./CartContext.jsx";
import footerBg from "./assets/footerbgimage.webp";
import HeroImage from "@/assets/HeroImage.png";
import { Heart } from "lucide-react";
import PeacockLoader from "./components/PeacockLoader";
import { useToast } from "./ToastContext";
import underprice from "./assets/underpricecoll.svg";
import casualcoll from "@/assets/casualcoll.svg";
import festivecoll from "@/assets/festivecoll.svg";
import partywearcoll from "@/assets/partywearcoll.svg";
import weddingcoll from "@/assets/weddingcoll.svg";
import ethniccoll from "@/assets/ethniccoll.svg";
import { Sparkle } from "lucide-react";

function Homepage() {
  const navigate = useNavigate();
  const {
    cartItems,
    setCartItems,
    wishListItems,
    setWishListItems,
    handleAddToCart,
    handleAddToWishList,
    handleRemoveFromWishList,
    handleRemoveFromCart,
  } = useContext(CartContext);

  const { showToast } = useToast();

  const topFourProducts = trendingProducts.slice(0, 9);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [loadingBestSellers, setLoadingBestSellers] = useState(true);
  const [fillColor, setFillColor] = useState("transparent");
  const [bestSellers, setBestSellers] = useState([]);
  const [currentBestIndex, setCurrentBestIndex] = useState(0);
  const currentProduct = bestSellers[currentBestIndex];
  const [newReleases, setNewReleases] = useState([]);
  const [loadingNew, setLoadingNew] = useState(true);

  const thumbnails =
    bestSellers.length > 0
      ? [1, 2, 3].map((offset) => {
          const index = (currentBestIndex + offset) % bestSellers.length;
          return { ...bestSellers[index], originalIndex: index };
        })
      : [];

  const updateCart = (c) => setCartItems(c);
  const updateWishList = (w) => setWishListItems(w);

  const handleSvgClick = () => {
    setFillColor((c) => (c === "transparent" ? "#ffc780" : "transparent"));
  };

  const collectionImages = {
    "Casual Wear": casualcoll,
    "Festive Collections": festivecoll,
    "Party Wear": partywearcoll,
    "Wedding Collection": weddingcoll,
    "Ethnic Wear": ethniccoll,
    "Under 2000": underprice,
  };

  const isWishlisted =
    currentProduct &&
    wishListItems.some(
      (item) =>
        (item.id || item.product_id) ===
        (currentProduct.product_id || currentProduct.id)
    );

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
    window.scrollTo(0, 0);
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev === reviews.length - 1 ? 0 : prev + 1));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  /* Collections */
  useEffect(() => {
    fetch(`${CLIENT_API}/api/collections`)
      .then((res) => res.json())
      .then((data) => data.success && setCollections(data.data))
      .finally(() => setLoadingCollections(false));
  }, []);

  /* Best sellers */
  useEffect(() => {
    fetch(`${CLIENT_API}/api/bestsellers`)
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

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(
          `${ADMIN_API}/api/get-all-product-details`
        );
        const result = await response.json();
        if (result.success) {
          const filtered = result.data.filter(
            (p) => Number(p.is_new_release) === 1
          );
          // console.log("filtered new releases are", filtered);
          const safeData = filtered.map((p) => {
            const rawImgObj =
              p.images && p.images.length > 0 ? p.images[0] : p.image_url;
            const finalImgString =
              typeof rawImgObj === "object" && rawImgObj?.image_url
                ? rawImgObj.image_url
                : rawImgObj;
            return {
              ...p,
              id: p.product_id || p.id,
              image1: finalImgString || "https://placehold.co/300",
              name: p.product_name || p.name,
              main_price: p.regular_price || p.regularPrice || 0,
              discounted_price: p.selling_price || p.discountedPrice || 0,
            };
          });
          setNewReleases(safeData);
        }
      } catch (error) {
        console.error("Error fetching new releases:", error);
      } finally {
        setLoadingNew(false);
      }
    };
    fetchProducts();
  }, []);

  const onHeartClick = () => {
    if (!currentProduct) return;
    const prodId = currentProduct.product_id || currentProduct.id;
    if (isWishlisted) {
      handleRemoveFromWishList(prodId);
      showToast("Removed from Wishlist", "error");
    } else {
      const productForWishlist = {
        id: prodId,
        name: currentProduct.name,
        image1: currentProduct.primary_image || currentProduct.image_url || currentProduct.image1,
        primary_image: currentProduct.primary_image, 
        discounted_price: Number(currentProduct.selling_price),
        regular_price: Number(currentProduct.regular_price),
        description: currentProduct.description,
      };
      handleAddToWishList(productForWishlist);
      showToast("Added to Wishlist", "wishlist");
    }
  };

  const isInCart =
    currentProduct &&
    cartItems.some(
      (item) =>
        String(item.id || item.product_id).trim() ===
        String(currentProduct.product_id || currentProduct.id).trim()
    );

  const onCartToggle = () => {
    if (!currentProduct) return;
    const prodId = currentProduct.product_id || currentProduct.id;

    if (isInCart) {
      handleRemoveFromCart(prodId);
      showToast("Removed from Cart", "error");
    } else {
      const productForCart = {
        id: prodId,
        name: currentProduct.name,
        image1: currentProduct.image_url || currentProduct.image1,
        discounted_price: Number(currentProduct.selling_price),
        regular_price: Number(currentProduct.regular_price),
        description: currentProduct.description,
        quantity: 1,
      };
      handleAddToCart(productForCart);
      showToast("Added to Cart", "cart");
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

      <section
        className="text-white text-center py-4 bg-cover bg-fixed w-full"
        style={{ backgroundImage: `url(${footerBg})` }}
      >
        <img src={frame} className="w-[95%] rotate-180 mx-auto" />

        <div className="w-full flex justify-center">
          <div className="relative flex justify-center items-center rounded-xl w-[85%] h-130 overflow-hidden aspect-square md:aspect-video max-h-80 sm:max-h-full">
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

        <div className="grid grid-cols-3 gap-5 md:grid-cols-6 items-center">
          {loadingCollections ? (
            <PeacockLoader />
          ) : (
            collections.map((c, index) => {
              const imageSrc = collectionImages[c.collection] || underprice;
              return (
                <div
                  key={c.id || index}
                  className="cursor-pointer flex flex-col gap-5"
                  onClick={() =>
                    navigate("/shop", {
                      state: { selectedCollection: c.collection },
                    })
                  }
                >
                  <img
                    src={imageSrc}
                    className="max-w-[80%] mx-auto transition-transform duration-500 hover:scale-105"
                    alt={c.collection}
                  />
                  <h2 className="text-[2.5vw] md:text-[1.6vw]">{c.collection}</h2>
                </div>
              );
            })
          )}
        </div>

        <button
          onClick={() => {
            navigate("/shop");
          }}
          className="cursor-pointer group relative overflow-hidden rounded-full p-5 lg:px-12 lg:py-5 my-5 lg:my-10 text-sm lg:text-2xl font-bold font-['Poppins'] text-[#BD7923] border-2 border-[#BD7923] bg-transparent
                      transition-all duration-500 ease-out hover:bg-linear-to-r hover:from-[#FEDB87] hover:to-[#BD7923] hover:text-whitehover:border-transparent
                      hover:scale-105 hover:shadow-[0_0_40px_rgba(189,121,35,0.6)] hover:text-white"
        >
          <div
            className=" absolute inset-0 w-full h-full bg-linear-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] skew-x-[-20deg] transition-transform duration-1000 ease-in-out
                        group-hover:translate-x-[150%]"
          />
          <span className="relative flex items-center gap-3">
            <Sparkle
              className="w-6 h-6 transition-transform duration-700 group-hover:rotate-180"
              fill="currentColor"
            />
            EXPLORE ALL COLLECTIONS
            <Sparkle
              className="w-6 h-6 transition-transform duration-700 group-hover:rotate-180"
              fill="currentColor"
            />
          </span>
        </button>

        <div className="pt-4">
          <img src={finisher} className="w-[95%] mx-auto" />
        </div>
      </section>

      {/* TRENDING */}
      <h1 className="text-xl md:text-5xl my-[1%] py-[4%] text-center text-[#68232B]">
        <u>Check out our Newest Collections</u>
      </h1>

      {/* New Arrivals Section */}
      <div className="flex gap-4 overflow-x-auto px-2 py-4 scrollbar-hide">
        {loadingNew ? (
          // Optional: Simple Loading State (or use your PeacockLoader)
          <div className="flex w-full justify-center p-10">
            <span className="text-[#BD7923] font-bold animate-pulse">
              Loading New Arrivals...
            </span>
          </div>
        ) : newReleases.length > 0 ? (
          newReleases.map((product) => (
            <div
              key={product.id}
              className="flex-none min-w-47.5 w-[clamp(150px,25vw,220px)]"
            >
              <ProductCard
                {...product}
                // Ensure we pass the full object correctly to your cart handler
                onAddToCart={() => handleAddToCart(product)}
                showToast={showToast}
              />
            </div>
          ))
        ) : (
          // Fallback if no new releases found
          <p className="w-full text-center text-gray-500 italic">
            More new collections coming soon!
          </p>
        )}
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
                {/* --- LEFT SIDE: IMAGES --- */}
                <div className="w-full flex flex-col md:flex-row-reverse gap-4 bg-white/3 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl">
                  {/* BIG MAIN IMAGE (Click to View Page) */}
                  <div
                    className="w-full md:w-[80%] bg-transparent rounded-2xl overflow-hidden shadow-sm border border-stone-200/50 cursor-pointer relative group"
                    onClick={() =>
                      navigate(
                        `/product/${
                          currentProduct.product_id || currentProduct.id
                        }`
                      )
                    }
                  >
                    <div className="aspect-3/4 lg:aspect-square w-full h-full relative">
                      <img
                        src={currentProduct.primary_image}
                        alt={currentProduct.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-in-out group-hover:scale-105"
                      />
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span className="bg-white/90 text-[#68232B] px-4 py-2 rounded-full font-bold shadow-lg">
                          View Product
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* THUMBNAILS (Click to Rotate) */}
                  <div className="flex flex-row md:flex-col gap-3 md:w-[20%] justify-between md:justify-start">
                    {thumbnails.map((thumb) => (
                      <div
                        key={thumb.id || thumb.product_id}
                        onClick={() => setCurrentBestIndex(thumb.originalIndex)} // 👈 CLICK TO SWAP IMAGE
                        className="relative aspect-3/4 w-full cursor-pointer rounded-xl overflow-hidden border border-stone-200/50 hover:border-[#BD7923] transition-all group"
                      >
                        <img
                          src={thumb.primary_image} // 👈 Shows the OTHER products
                          alt={thumb.name}
                          className="absolute inset-0 w-full h-full object-cover hover:opacity-90 transition-opacity"
                        />
                        {/* Optional active ring effect */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-white/10 transition-colors"></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* --- RIGHT SIDE: DETAILS --- */}
                <div className="w-full flex flex-col justify-center h-full gap-6 text-[#FFCB85] text-left rounded-3xl shadow-xl">
                  <div className="flex justify-between items-center gap-5 h-40 ">
                    <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold font-['Poppins'] text-[#FFCB85] leading-tight">
                      {currentProduct.name}
                    </h1>
                    <Heart
                      size={40}
                      className="md:w-10 md:h-10 cursor-pointer shrink-0 hover:scale-150 transition-transform"
                      fill={isWishlisted ? "#ffc780" : "transparent"}
                      color={isWishlisted ? "#ffc780" : "currentColor"}
                      onClick={onHeartClick}
                    />
                  </div>

                  <p className="text-sm md:text-lg text-[#FFCB85]/90 leading-relaxed h-20 flex items-center line-clamp-3">
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
                        if (isInCart) {
                          onCartToggle();
                        } else {
                          const productForCart = {
                            ...currentProduct,
                            image: currentProduct.primary_image,
                            image_url: currentProduct.primary_image,
                          };
                          handleAddToCart(productForCart);
                        }
                      }}
                      className={`flex-1 py-4 px-6 rounded-full font-bold text-lg md:text-xl text-white  shadow-lg shadow-orange-900/20 cursor-pointer  border-2 border-[#FEDB87]  transition-all duration-200 active:scale-95
                        ${
                          isInCart
                            ? "bg-linear-to-r from-[#FEDB87] to-[#BD7923] brightness-110"
                            : "bg-transparent hover:bg-linear-to-r hover:from-[#FEDB87] hover:to-[#BD7923]"
                        }
                      `}
                    >
                      {isInCart ? "Added" : "Add to Cart"}
                    </button>

                    <button
                      onClick={() => {
                        if (!currentProduct) return;

                        const productForCart = {
                          id: currentProduct.product_id || currentProduct.id,
                          name: currentProduct.name,
                          image1: currentProduct.primary_image,
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
       border-2 border-[#FEDB87] bg-transparent hover:bg-linear-to-r hover:from-[#FEDB87] hover:to-[#BD7923] cursor-pointer
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
