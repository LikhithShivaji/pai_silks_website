import React, { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";

// Assets
import frame from "../assets/heroframe.svg";
import HeartSvg from "../assets/bestsellerheart.svg?react";
import bgImage from "../assets/backgroundimagenew.jpg";
import footerBgImage from "../assets/footerbgimage.svg";
import { Sparkle } from "lucide-react";
import { Heart } from 'lucide-react';

// Components
import Header from "./Header";
import Footer from "./Footer";
import ProductCard from "./ProductCard";

// Context
import { CartContext } from "../CartContext";
import PeacockLoader from "./PeacockLoader";

function ViewProductPage() {
  const { productId } = useParams();
  const navigate = useNavigate();

  const {
    cartItems,
    setCartItems,
    wishListItems,
    setWishListItems,
    handleAddToCart,
    handleAddToWishList,
  } = useContext(CartContext);

  const [product, setProduct] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [fillColor, setFillColor] = useState("transparent");
  const [loading, setLoading] = useState(true);

  const updateCart = (c) => setCartItems(c);
  const updateWishList = (w) => setWishListItems(w);

  const handleSvgClick = () => {
    setFillColor((c) => (c === "transparent" ? "#ffc780" : "transparent"));
  };

  /* ---------------- FETCH PRODUCT BY ID ---------------- */
  useEffect(() => {
    // Scroll to top when productId changes (navigating from similar products)
    window.scrollTo(0, 0);
    setLoading(true);

    fetch(`https://pai-silks-website-1.onrender.com/api/${productId}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          const p = res.data;
          setProduct({
            id: p.product_id, // Ensure this matches DB column
            name: p.name,
            description: p.description,
            category: p.category,
            product_code: p.product_code,
            material: p.material,
            saree_length: p.saree_length,
            wash_and_care: p.product_wash_care,
            main_price: p.regular_price,
            discounted_price: p.selling_price,
            image1: p.image_url,
            image2: p.image_url,
            image3: p.image_url,
            image4: p.image_url,
          });
        }
      })
      .catch(console.error)
      .finally(() => {
        // Only stop loading after fetch is done + small delay if you want
        setTimeout(() => setLoading(false), 1000);
      });
  }, [productId]);

  /* ---------------- FETCH SIMILAR PRODUCTS ---------------- */
  useEffect(() => {
    if (!product?.category) return;

    fetch(
      `https://pai-silks-website-1.onrender.com/api/products/${product.category}`
    )
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          const filtered = res.data
            // FIX 1: Use p.product_id instead of p.id for filtering
            // Converting to String/Number ensures types match
            .filter((p) => String(p.product_id) !== String(productId))
            .map((p) => ({
              // FIX 2: Ensure we extract 'product_id'. Fallback to 'id' if 'product_id' is missing.
              id: p.product_id || p.id,
              name: p.name,
              description: p.description,
              category: p.category,
              product_code: p.product_code,
              material: p.material,
              saree_length: p.saree_length,
              wash_and_care: p.product_wash_care,
              main_price: p.regular_price,
              discounted_price: p.selling_price,
              image1: p.image_url,
              image2: p.image_url,
              image3: p.image_url,
              image4: p.image_url,
            }));

          setSimilarProducts(filtered);
          // REMOVED: console.log("ProductCard ID:", id); <- This caused the ReferenceError
        }
      })
      .catch(console.error);
  }, [product, productId]); // Added productId to dependency

  if (loading) return <PeacockLoader />;

  if (!product)
    return (
      <p className="text-center mt-10">
        Product not found{" "}
        <button
          onClick={() => navigate("/")}
          className="text-blue-500 underline"
        >
          Go Back
        </button>
      </p>
    );

  return (
    <div
      className="min-h-screen bg-cover bg-fixed bg-center bg-no-repeat m-0 w-full"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <Header
        cartItems={cartItems}
        onUpdate={updateCart}
        wishListItems={wishListItems}
        onWishListUpdate={updateWishList}
      />

      {/* Back Button */}
      <button
        onClick={() => navigate("/")}
        className="m-4 px-4 py-2 bg-white/80 rounded hover:bg-white text-[#68232B] font-bold cursor-pointer"
      >
        ⬅ Back
      </button>

      {/* --- Main Product Display Section --- */}
      <div
        className="text-center py-4 text-white bg-cover bg-fixed bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${footerBgImage})` }}
      >
        <img
          src={frame}
          className="max-w-[95%] mx-auto pb-0 rotate-180 block"
          alt="Frame Top"
        />

        <div className="w-full max-w-[90%] md:max-w-[85%] mx-auto mt-8 mb-12">
          <div className="flex flex-col lg:grid lg:grid-cols-[1.6fr_1fr] gap-8 lg:gap-12 items-start">
            <div className="w-full flex flex-col md:flex-row-reverse gap-4">
              {/* Main Image */}
              <div className="w-full md:w-[80%] rounded-2xl overflow-hidden shadow-sm border border-stone-200">
                <div className="aspect-[3/4] lg:aspect-square w-full relative group">
                  <img
                    src={product.image1}
                    alt="Main Saree"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-in-out group-hover:scale-105"
                  />
                </div>
              </div>

              {/* Thumbnails */}
              <div className="flex flex-row md:flex-col gap-3 md:w-[20%] justify-between md:justify-start">
                {[product.image2, product.image3, product.image4].map(
                  (img, index) => (
                    <div
                      key={index}
                      className="relative aspect-[3/4] w-full cursor-pointer rounded-xl overflow-hidden border border-stone-200 hover:border-[#BD7923] transition-all"
                    >
                      <img
                        src={img}
                        alt={`View ${index + 2}`}
                        className="absolute inset-0 w-full h-full object-cover hover:opacity-90 transition-opacity"
                      />
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Description Section */}
            <div className="w-full flex flex-col justify-center h-full gap-6 text-[#FFCB85] text-left">
              <div className="flex justify-between items-start">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-['Poppins'] text-[#FFCB85] leading-tight">
                  {product.name}
                </h1>
                <Heart size={100}
                  className="md:w-10 md:h-10 cursor-pointer flex-shrink-0 hover:scale-150 transition-transform"
                  fill={fillColor}
                  onClick={() => {
                    handleAddToWishList(product);
                    handleSvgClick();
                  }}
                />
              </div>

              <p className="text-base md:text-lg text-[#FFCB85]/90 leading-relaxed">
                {product.description}
              </p>

              <div className="flex items-baseline gap-4 mt-2">
                <h2 className="text-4xl md:text-5xl font-bold text-white">
                  ₹ {product.discounted_price}
                </h2>
                <h5 className="text-xl md:text-2xl text-gray-400 decoration-1 line-through">
                  ₹ {product.main_price}
                </h5>
              </div>

              <div className="h-px w-full bg-[#FFCB85]/20 my-2"></div>

              <div className="flex flex-col sm:flex-row gap-4 w-full mt-4">
                <button
                  onClick={() => handleAddToCart(product)}
                  className="flex-1 py-4 px-6 rounded-full font-bold text-lg md:text-xl text-white shadow-lg shadow-orange-900/20
                     hover:bg-gradient-to-r hover:from-[#FEDB87] hover:to-[#BD7923] cursor-pointer border-2 border-[#FEDB87] bg-transparent
                     hover:brightness-110 active:scale-95 transition-all duration-200"
                >
                  Add to Cart
                </button>
                <button 
                 onClick={()=>{handleAddToCart(product); navigate("/checkout")}}
                  className="flex-1 py-4 px-6 rounded-full font-bold text-lg md:text-xl text-white shadow-lg border-2 border-[#FEDB87] bg-transparent hover:bg-gradient-to-r hover:from-[#FEDB87] hover:to-[#BD7923] cursor-pointer active:scale-95 transition-all duration-200">
                  Buy Now
                </button>
              </div>
            </div>
          </div>
        </div>

        <img
          src={frame}
          className="max-w-[95%] mx-auto pt-0 block"
          alt="Frame Bottom"
        />
      </div>

      {/* --- Product Description Section --- */}
      <div className="flex justify-center w-full py-8">
        <div className="w-full max-w-4xl bg-white/20 backdrop-blur-md border border-white/40 shadow-[0_8px_32px_0_rgba(31,38,135,0.1)] rounded-3xl p-8 md:p-12 mx-4">
          <div className="flex flex-col items-center mb-12 text-[#68232B]">
            <div className="flex gap-4 items-center mb-4">
              <Sparkle className="w-8 h-8" />
              <h1 className="text-2xl font-bold underline decoration-[#68232B] decoration-2 underline-offset-4">
                Product Description
              </h1>
            </div>
            <p className="text-lg leading-relaxed font-medium opacity-90 text-center max-w-2xl">
              {product.description}
            </p>
          </div>

          <div className="w-2/3 h-px bg-[#68232B]/20 mx-auto mb-12"></div>

          <div className="flex flex-col items-center text-[#68232B]">
            <div className="flex gap-4 items-center mb-8">
              <Sparkle className="w-8 h-8" />
              <h1 className="text-2xl font-bold underline decoration-[#68232B] decoration-2 underline-offset-4">
                Product Details
              </h1>
            </div>
            <div className="w-full max-w-2xl">
              {[
                { label: "Product Code", value: product.product_code },
                { label: "Material", value: product.material },
                { label: "Saree Length", value: product.saree_length },
                { label: "Wash and Care", value: product.wash_and_care },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-4 border-b border-[#68232B]/30 hover:bg-[#68232B]/5 px-4 transition-colors h-20"
                >
                  <h4 className="font-bold text-lg">{item.label}</h4>
                  <p className="font-medium">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- Similar Products --- */}
      <div className="flex gap-5 items-center m-4 text-[#68232B] justify-center">
        <Sparkle />
        <h1 className="text-xl lg:text-4xl pb-2 m-0 font-bold underline decoration-[#68232B]">
          More Like This
        </h1>
      </div>

      <div className="flex px-2 items-center gap-4 overflow-x-auto py-4 scrollbar-hide">
        {similarProducts.slice(0, 10).map((p) => (
          <div
            key={p.id}
            className="flex-none min-w-[200px] w-[clamp(150px,25vw,220px)]"
          >
            <ProductCard {...p} onAddToCart={() => handleAddToCart(p)} />
          </div>
        ))}
      </div>

      <Footer />
    </div>
  );
}

export default ViewProductPage;
