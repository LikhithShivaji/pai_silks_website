import React, { useEffect, useState } from "react";
import { Trash } from "lucide-react";

const AllProducts = ({ categoryName, onBack, onAddProductClick,onUpdateProduct}) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(
          "https://pai-silks-website.onrender.com/api/get-all-product-details"
        );

        const apiResponse = await res.json();

        console.log("Full API response:", apiResponse);
        const productList = apiResponse.data || [];
        const filtered = productList.filter((p) => p.category === categoryName);

        const mapped = filtered.map((p) => ({
          id: p.product_id,
          name: p.name,
          category: p.category,
          collection: p.collection,
          description: p.description,
          material: p.material,
          code: p.product_code,
          washCare: p.product_wash_care,
          length: p.saree_length,
          regularPrice: p.regular_price,
          discountedPrice: p.selling_price,
          stockQty: p.stock_qty,
          images: p.image_url || [],
        }));

        setProducts(mapped);
      } catch (err) {
        console.error("Failed to fetch products:", err);
        setError("Failed to load products");
      } finally {
        setLoading(false);
      }
    };

    if (categoryName) {
      fetchProducts();
    }
  }, [categoryName]);

  const handleDeleteProduct = (productId) => {
    console.log("product deleted was", productId)
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-gray-600">Loading products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
        <p className="text-red-500 font-semibold">Failed to load products 😢</p>
        <p className="text-sm text-gray-500">{error}</p>
        <button
          onClick={onBack}
          className="mt-2 bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4 h-full p-4 rounded-xl">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          {categoryName || "All Products"}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
          >
            ← Back
          </button>
          <button
            onClick={onAddProductClick}
            className="bg-[#68232B] text-white px-3 py-1 rounded hover:bg-[#82323c]"
          >
            + Add Product
          </button>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          No products found in this category.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="p-5 bg-[#F5F5F5] rounded-2xl shadow-sm hover:shadow-xl cursor-pointer flex flex-col gap-5"
              onClick={()=>onUpdateProduct(product)}
            >
              <div className="w-full flex items-center gap-3">
                <div className="flex border-1 border-black max-w-30 h-30 justify-center items-center rounded-2xl overflow-hidden">
                  {product.images && product.images.length > 0 && (
                    <img
                      src={product.images[0]}
                      alt={`${product.name}-cover`}
                      className="object-cover rounded-lg border w-full h-full"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <p className="font-semibold text-base">{product.name}</p>
                  <p className="text-gray-600 text-sm">{product.category}</p>
                  <div className="flex gap-10 items-baseline">
                    <p className="font-semibold text-sm text-gray-400">
                      <del>₹{product.regularPrice}</del>
                    </p>
                    <p className="font-semibold text-sm">
                      ₹{product.discountedPrice}
                      ₹{product.stockQty}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[2.8fr_0.2fr] gap-1">
                <div>
                  <p className="text-sm font-medium">Summary</p>
                  <p className="text-gray-500 font-light text-sm line-clamp-3">
                    {product.description}
                  </p>
                </div>
                <button
                  type="button"
                  className="flex items-start justify-end text-red-500 hover:text-red-700 transition transform hover:scale-110"
                  onClick={() => {alert(Clicked); handleDeleteProduct(product.id)}}
                >
                  <Trash size={28} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AllProducts;
