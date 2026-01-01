import React, { useEffect, useState } from "react";
import { Trash } from "lucide-react";

const AllProducts = ({ categoryName, onBack, onAddProductClick, onUpdateProduct }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [debugLog, setDebugLog] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);

        const res = await fetch("https://pai-silks-website.onrender.com/api/get-all-product-details");
        const apiResponse = await res.json();
        console.log("api response is",apiResponse)
        
        const productList = apiResponse.data || [];
        console.log("productList is",productList)
        
        const filtered = productList.filter((p) => {
            if (!p.category || !categoryName) return false;
            const dbCat = p.category.toString().toLowerCase().trim();
            const sideCat = categoryName.toString().toLowerCase().trim();
            return dbCat === sideCat;
        });

        if (filtered.length === 0 && productList.length > 0) {
            setDebugLog(productList.map(p => p.category));
        }

        const mapped = filtered.map((p) => {
          let rawImages = p.image_url || p.images || [];
          let cleanImages = [];

          if (Array.isArray(rawImages)) {
             cleanImages = rawImages.map(img => typeof img === 'object' ? (img.image_url || img.url) : img);
          } else if (typeof rawImages === 'string') {
             cleanImages = rawImages.includes(',') ? rawImages.split(',') : [rawImages];
          }

          return {
            id: p.product_id || p.id,
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
            images: cleanImages,
            isNewRelease: p.is_new_release
          };
        });

        setProducts(mapped);
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (categoryName) fetchProducts();
  }, [categoryName]);

  const handleDeleteProduct = async (productId) => {
    const isConfirmed = window.confirm("Are you sure you want to delete this product?");
    if (!isConfirmed) return;

    try {
      // ✅ FIX: Add the ID to the URL using template literals `${productId}`
      const res = await fetch(`https://pai-silks-website.onrender.com/api/delete-product/${productId}`, {
        method: "DELETE", // Usually route parameters use DELETE, but if this fails, try "POST"
        headers: {
          "Content-Type": "application/json",
        },
        // ❌ No body needed anymore, because the ID is in the URL
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        alert("Product deleted successfully!");
      } else {
        alert("Failed to delete: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Delete Error:", err);
      alert("Something went wrong.");
    }
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="w-full flex flex-col gap-4 h-full rounded-xl">
      <div className="flex justify-between items-center py-5 border-b-1 border-b-white">
        <h2 className="text-xl font-semibold">
          {categoryName} <span className="text-sm text-gray-500">({products.length})</span>
        </h2>
        <div className="flex gap-2">
          <button onClick={onBack} className="bg-gray-200 px-3 py-1 rounded">← Back</button>
          <button onClick={onAddProductClick} className="bg-[#68232B] text-white px-3 py-1 rounded">+ Add</button>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
           <p className="text-gray-500">No products found matching "{categoryName}".</p>
           
           <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg max-w-md text-sm text-yellow-800">
              <p className="font-bold">⚠️ Tips for Exact Matching:</p>
              <p>Since we switched to strict matching, your Sidebar Category must match the Database Category <strong>exactly</strong> (ignoring case).</p>
              <p className="mt-2">Sidebar: <strong>"{categoryName}"</strong></p>
              <p className="mt-2">Available Categories in DB:</p>
              <ul className="list-disc pl-5 max-h-32 overflow-y-auto">
                  {[...new Set(debugLog)].map((cat, i) => (
                      <li key={i}>{cat || "Undefined"}</li>
                  ))}
              </ul>
           </div>
        </div>
      ) : (
        <div className="grid gap-[1.7rem] p-6
              grid-cols-[repeat(auto-fill,minmax(300px,1fr))]
              max-[600px]:gap-4 max-[600px]:p-4
              max-[600px]:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]
              max-[380px]:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
          {products.map((product) => (
            <div key={product.id} className="p-5 bg-[#F5F5F5] rounded-2xl cursor-pointer flex flex-col gap-5 hover:shadow-lg transition-all" onClick={() => onUpdateProduct(product)}>
              <div className="w-full flex items-center gap-3">
                <div className="w-24 h-24 flex-shrink-0 border bg-white rounded-xl overflow-hidden">
                    <img src={product.images[0] || "https://placehold.co/100"} alt="" className="w-full h-full object-cover object-center"/>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="font-semibold line-clamp-1">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.category}</p>
                  <p className="font-bold text-[#68232B]">₹{product.discountedPrice}</p>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t mt-auto">
                  <p className="text-xs text-gray-500 truncate w-3/4">{product.description}</p>
                  <button className="text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }}>
                    <Trash size={18} />
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